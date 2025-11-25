import { Agent, createTool } from "@voltagent/core";
import { VercelAIProvider } from "@voltagent/vercel-ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { voltOpsClient } from "../volt/voltAgentConfig.js";
import { PassThrough } from "stream";
import { v4 as uuidv4 } from "uuid";
import { db } from "../../db.js";
import editorChatDb from "../db/editorChat.js";
import { getAgentTools, AGENT_TYPES } from "./agents/registry.js";
import {
  createAgentConfig,
  AGENT_ARCHETYPES,
} from "../chat/aiPromptConfigs.js";
import ToolExecutor from "./toolExecutor.js";
import {
  getToolsForArchetype,
  exportToolDefinitions,
  createToolMapping,
} from "./tools/catalogue.js";
import { createFileTracker } from "./tools/fileTracker.js";
import {
  loadProjectContext,
  generateProjectSystemPrompt,
} from "./projectContext.js";
import { getAiModelConfig } from "../chat/openaiClient.js";

// Debug flag - set to true to enable detailed logging
const DEBUG = true;

// Convert tool definitions to Volt Agent format
function convertToVoltTools(tools) {
  return tools.map((tool) => {
    const toolDef = tool.function || tool;

    // Parse parameters schema for Zod conversion
    let parameters = z.object({});
    if (toolDef.parameters && toolDef.parameters.properties) {
      const zodSchema = {};
      for (const [key, prop] of Object.entries(toolDef.parameters.properties)) {
        let schema;
        switch (prop.type) {
          case "string":
            schema = z.string();
            break;
          case "number":
            schema = z.number();
            break;
          case "boolean":
            schema = z.boolean();
            break;
          case "array":
            schema = z.array(z.any());
            break;
          case "object":
            schema = z.object({});
            break;
          default:
            schema = z.any();
        }

        if (prop.description) {
          schema = schema.describe(prop.description);
        }

        // Handle required fields
        if (
          toolDef.parameters.required &&
          toolDef.parameters.required.includes(key)
        ) {
          zodSchema[key] = schema;
        } else {
          zodSchema[key] = schema.optional();
        }
      }
      parameters = z.object(zodSchema);
    }

    return createTool({
      name: toolDef.name,
      description: toolDef.description,
      parameters,
      execute: async (args) => {
        // This will be replaced with actual implementation
        return { success: true, result: "Tool executed" };
      },
    });
  });
}

class EditorChatHandlerVolt {
  constructor({
    user,
    org,
    project = null,
    chatId = null,
    model = "gpt-4.1-mini",
    temperature = 0.7,
    stream = true,
    enableStreaming = true,
    debug = false,
    agentArchetype = "GENERALIST",
  }) {
    // Auto-switch to PROJECT_NAVIGATOR when no project is provided
    if (!project && agentArchetype === "GENERALIST") {
      agentArchetype = "PROJECT_NAVIGATOR";
      console.log(
        "No project context - switching to PROJECT_NAVIGATOR archetype"
      );
    }
    this.user = user;
    this.org = org;
    this.project = project;
    this.chatId = chatId;
    this.model = model;
    this.temperature = temperature;
    this.stream = stream;
    this.enableStreaming = enableStreaming;
    this.debug = debug || DEBUG || process.env.DEBUG_OPENAI === "true";
    this.tools = [];
    this.toolFunctions = {};
    this.agentArchetype = agentArchetype;
    this.toolExecutor = null;
    this.agentConfig = null;
    this.toolsUsed = [];
    this.fileTracker = createFileTracker();
    this.projectContext = null;
    this.agent = null;
  }

  async initialize() {
    if (!this.chatId) {
      const chat = await editorChatDb.create({
        user: this.user._id,
        org: this.org._id,
        project: this.project?._id,
        model: this.model,
        temperature: this.temperature,
        metadata: {
          agentArchetype: this.agentArchetype,
        },
      });
      this.chatId = chat._id;
    }

    // Initialize tool executor
    this.toolExecutor = new ToolExecutor({
      context: {
        user: this.user,
        org: this.org,
        project: this.project,
        chatId: this.chatId,
        agentArchetype: this.agentArchetype,
        agentId: `chat_${this.chatId}`,
        auth: true,
        permissions: this.getUserPermissions(),
        db: editorChatDb.db,
        session: {
          id: this.chatId,
          type: "editorChat",
        },
      },
    });

    // Load project context if project is available
    if (this.project) {
      this.projectContext = await loadProjectContext(this.project._id);
    }

    console.log("Initialize - chatId:", this.chatId);
    // Load tools must happen before agent creation
    const loadedSuccessfully = await this.loadTools();
    if (!loadedSuccessfully) {
      console.warn("Failed to load tools, creating agent without tools");
    }
    await this.createAgent();
    return this.chatId;
  }

  async loadTools() {
    try {
      // Create agent configuration
      const context = {
        user: this.user,
        org: this.org,
        project: this.project,
        auth: true,
        permissions: this.getUserPermissions(),
        session: { 
          id: this.chatId || 'temp-session',
          type: "editorChat"
        }, // Add session context for agent spawning
      };

      // Get available tools based on agent archetype
      let availableTools;
      try {
        // Try new tool system first
        const archetype = AGENT_ARCHETYPES[this.agentArchetype];
        if (archetype) {
          console.log("Found archetype:", this.agentArchetype);
          console.log("Archetype capabilities:", archetype.capabilities);
          availableTools = getToolsForArchetype(
            this.agentArchetype,
            archetype.capabilities,
            context
          );
          console.log("Available tools count:", availableTools?.length || 0);
        }
      } catch (err) {
        // Fall back to legacy system
        console.log("Using legacy tool system", err.message);
        console.error("Full error:", err);
      }

      // If no tools from new system, use legacy
      if (!availableTools || availableTools.length === 0) {
        const legacyTools = await getAgentTools(AGENT_TYPES.EDITOR);
        availableTools = legacyTools.map((tool) => ({
          definition: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
          implementation: tool.execute.bind(tool),
          category: "legacy",
        }));
      }

      // Create agent config
      this.agentConfig = createAgentConfig({
        interface: "editorChat",
        archetype: this.agentArchetype,
        context,
        availableTools,
      });

      console.log("Context passed to createAgentConfig:", {
        hasUser: !!context.user,
        hasOrg: !!context.org,
        hasProject: !!context.project,
        auth: context.auth,
        permissions: context.permissions,
      });

      // Export tools for OpenAI format
      this.tools = exportToolDefinitions(this.agentConfig.tools);
      console.log("Exported tools for OpenAI:", this.tools.length, "tools");
      if (this.tools.length === 0) {
        console.warn("⚠️ No tools were exported - this may cause issues");
      } else {
        console.log(
          "Tool names:",
          this.tools.map((t) => t.function?.name || "unknown")
        );
      }

      // Create tool mapping for execution
      this.toolFunctions = createToolMapping(this.agentConfig.tools);
      console.log("Tool functions mapping:", Object.keys(this.toolFunctions));
    } catch (error) {
      console.warn("Could not load tools for editorChat:", error.message);
      console.error("Full stack trace:", error.stack);
      // Continue without tools
      this.tools = [];
      this.toolFunctions = {};
      return false;
    }
    return true;
  }

  async createAgent() {
    // If PROJECT_NAVIGATOR, add navigation context
    let navigationContext = "";
    if (this.agentArchetype === "PROJECT_NAVIGATOR" && !this.project) {
      navigationContext = await this.buildNavigationContext();
    }

    // Create Volt tools from our tool definitions
    console.log(
      "Creating Volt tools from this.tools:",
      this.tools?.length || 0
    );
    
    // Store voltTools as instance property so subclasses can access it
    this.voltTools = [];
    
    // Only create Volt tools if we have any tools to convert
    if (this.tools && this.tools.length > 0) {
      this.voltTools = this.tools.map((tool) => {
      const toolDef = tool.function || tool;
      const toolFunc = this.toolFunctions[toolDef.name];

      try {
        const zodParams = this.parseParametersToZod(toolDef.parameters);
        console.log(`Creating Volt tool: ${toolDef.name}`);
        
        return createTool({
          name: toolDef.name,
          description: toolDef.description,
          parameters: zodParams,
          execute: async (args) => {
          // Execute tool using existing infrastructure
          const chat = await editorChatDb.findById(this.chatId);
          const context = {
            user: this.user,
            org: this.org,
            project: this.project,
            chatId: this.chatId,
            sessionBranch: chat?.metadata?.sessionBranch,
            toolExecutor: this.toolExecutor,
          };

          try {
            const result = await toolFunc(args, context);

            // Track tool usage
            this.toolsUsed.push({
              toolName: toolDef.name,
              args: args,
              result: result,
              timestamp: new Date().toISOString(),
            });

            return result;
          } catch (error) {
            // Track failed tool usage
            this.toolsUsed.push({
              toolName: toolDef.name,
              args: args,
              error: error.message,
              timestamp: new Date().toISOString(),
            });

            throw error;
          }
        },
      });
      } catch (error) {
        console.error(`Failed to create Volt tool ${toolDef.name}:`, error);
        console.error("Tool parameters:", toolDef.parameters);
        // Skip this tool if it fails
        return null;
      }
      }).filter(Boolean); // Remove null entries
    }
    
    console.log(`Created ${this.voltTools.length} Volt tools successfully`);

    // Get system prompts from agent config
    let instructions = "";
    if (this.agentConfig && this.agentConfig.prompts) {
      const systemPrompts = this.agentConfig.prompts.filter(
        (m) => m.role === "system"
      );
      instructions = systemPrompts.map((p) => p.content).join("\n\n");
    }

    // Add project context to instructions if available
    if (this.projectContext) {
      instructions += "\n\n" + generateProjectSystemPrompt(this.projectContext);
    }

    // Add navigation context for PROJECT_NAVIGATOR
    if (navigationContext) {
      instructions += "\n\n" + navigationContext;
    }

    // Get model configuration
    const modelConfig = getAiModelConfig(this.model);

    // Create the Volt Agent with Helicone provider
    this.agent = new Agent({
      //   voltOpsClient,
      name: "EditorChat",
      instructions:
        instructions || "You are a helpful AI assistant for code editing.",
      llm: new VercelAIProvider({
        headers: {
          "Helicone-Auth": `Bearer ${
            process.env.HELICONE_AUTH ||
            "sk-helicone-wetdwuy-gjnethy-vxstiti-me3vmxy"
          }`,
          "Helicone-User-Id": "repo-md-editorChat",
          "HTTP-Referer": process.env.API_BASE_URL || "https://api.repo.md",
          "X-Title": "Repo.md Editor Chat",
        },
        providerOptions: {
          openai: {
            baseURL: "https://oai.helicone.ai/v1",
            apiKey: process.env.OPENAI_API_KEY,
          },
        },
      }),
      model: openai(modelConfig.model),
      tools: this.voltTools,
      markdown: true,
      memory: false, // Disable SQLite memory
    });
  }

  async buildNavigationContext() {
    const projects = await db.projects
      .find({
        $or: [
          { "members.userId": this.user._id },
          { orgId: this.org._id },
          { orgId: this.org._id.toString() },
          { orgId: this.org.handle },
        ],
        deleted: { $ne: true },
      })
      .sort({ updatedAt: -1 })
      .limit(20)
      .toArray();

    const recentActivity = await db.editorChats
      .aggregate([
        {
          $match: {
            user: this.user._id,
            createdAt: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: "$project",
            lastUsed: { $max: "$createdAt" },
            chatCount: { $sum: 1 },
          },
        },
        { $limit: 5 },
      ])
      .toArray();

    return (
      `## Available Projects\n\n${projects
        .slice(0, 10)
        .map(
          (p) =>
            `- **${p.name}** (${p.visibility || "private"}): ${
              p.description || "No description"
            }\n` +
            `  - Slug: ${p.slug}\n` +
            `  - Last Updated: ${new Date(p.updatedAt).toLocaleDateString()}`
        )
        .join("\n")}\n\n` +
      `Total projects: ${projects.length}\n\n` +
      `Use the list_projects tool to see all projects with more details, or switch_to_project to select one.`
    );
  }

  parseParametersToZod(parameters) {
    if (!parameters || !parameters.properties) {
      return z.object({});
    }

    const zodSchema = {};
    for (const [key, prop] of Object.entries(parameters.properties)) {
      let schema;
      switch (prop.type) {
        case "string":
          schema = z.string();
          break;
        case "number":
          schema = z.number();
          break;
        case "boolean":
          schema = z.boolean();
          break;
        case "array":
          if (prop.items) {
            switch (prop.items.type) {
              case "string":
                schema = z.array(z.string());
                break;
              case "number":
                schema = z.array(z.number());
                break;
              case "boolean":
                schema = z.array(z.boolean());
                break;
              case "object":
                // Handle nested object schemas in arrays
                if (prop.items.properties) {
                  const itemSchema = this.parseParametersToZod(prop.items);
                  schema = z.array(itemSchema);
                } else {
                  schema = z.array(z.object({}).passthrough());
                }
                break;
              default:
                schema = z.array(z.any());
            }
          } else {
            schema = z.array(z.any());
          }
          break;
        case "object":
          // Handle nested object properties
          if (prop.properties) {
            schema = this.parseParametersToZod(prop);
          } else {
            schema = z.object({}).passthrough(); // Allow any properties
          }
          break;
        default:
          schema = z.any();
      }

      if (prop.description) {
        schema = schema.describe(prop.description);
      }

      // Handle required fields
      if (parameters.required && parameters.required.includes(key)) {
        zodSchema[key] = schema;
      } else {
        zodSchema[key] = schema.optional();
      }
    }

    return z.object(zodSchema);
  }

  getUserPermissions() {
    const permissions = ["read", "write"];

    if (this.project) {
      const member = this.project.members?.find(
        (m) => m.userId.toString() === this.user._id.toString()
      );
      if (member) {
        if (member.role === "owner" || member.role === "admin") {
          permissions.push("admin", "deploy");
        } else if (member.role === "editor") {
          permissions.push("deploy");
        }
      }
    }

    return permissions;
  }

  async sendMessage(content, attachments = [], res = null) {
    // Reset tools used for new message
    this.toolsUsed = [];

    // Validate content
    if (!content && (!attachments || attachments.length === 0)) {
      throw new Error("Message content or attachments are required");
    }

    const userMessage = {
      id: uuidv4(),
      role: "user",
      content: content || "",
      attachments,
    };

    await editorChatDb.addMessage(this.chatId, userMessage);

    const chat = await editorChatDb.findById(this.chatId);
    const messages = this.formatMessagesForAgent(chat.messages);

    if (this.stream) {
      return await this.streamCompletion(messages, res);
    } else {
      const response = await this.getCompletion(messages);
      // For non-streaming, return response with tools used
      return {
        ...response,
        toolsUsed: this.toolsUsed,
      };
    }
  }

  formatMessagesForAgent(messages) {
    // Convert messages to format suitable for Volt Agent
    // Filter out system messages as they're handled in agent instructions
    return messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => {
        let content = msg.content || "";

        // Handle image attachments
        if (msg.attachments && msg.attachments.length > 0) {
          const imageAttachments = msg.attachments.filter(
            (a) => a.type === "image"
          );
          if (imageAttachments.length > 0) {
            // For now, append image URLs as text
            // TODO: Handle multimodal properly when Volt supports it
            const imageUrls = imageAttachments
              .map((img) => `[Image: ${img.url}]`)
              .join("\n");
            content = content ? `${content}\n${imageUrls}` : imageUrls;
          }
        }

        return {
          role: msg.role,
          content: content,
        };
      });
  }

  async streamCompletion(messages, res = null) {
    if (this.debug) {
      console.log("[DEBUG] Starting streamCompletion with Volt Agent");
      console.log("[DEBUG] enableStreaming:", this.enableStreaming);
      console.log("[DEBUG] Messages count:", messages.length);
      console.log("[DEBUG] Direct response mode:", !!res);
    }

    // Use PassThrough stream only if no response object provided
    const stream = res ? null : new PassThrough();
    const assistantMessage = {
      id: uuidv4(),
      role: "assistant",
      content: "",
      tool_calls: [],
    };

    try {
      const startTime = Date.now();

      // Build conversation string from messages
      const conversation = messages
        .map((m) => {
          if (m.role === "user") {
            return `User: ${m.content}`;
          } else if (m.role === "assistant") {
            return `Assistant: ${m.content}`;
          } else if (m.role === "tool") {
            return `Tool Result: ${m.content}`;
          }
          return "";
        })
        .join("\n");

      // Use Volt Agent streaming
      const response = await this.agent.streamText(conversation, {
        provider: {
          temperature: this.temperature,
          onError: async (error) => {
            console.error("Stream error:", error);
          },
        },
      });

      // Check if we have fullStream support
      if (response.fullStream) {
        for await (const chunk of response.fullStream) {
          switch (chunk.type) {
            case "text-delta":
              assistantMessage.content += chunk.textDelta;

              if (this.enableStreaming) {
                const sseData = `data: ${JSON.stringify({
                  type: "content",
                  content: chunk.textDelta,
                })}\n\n`;

                if (res) {
                  res.write(sseData);
                  if (res.flush) res.flush();
                } else {
                  stream.write(sseData);
                  if (stream.flush) stream.flush();
                }
              }
              break;

            case "tool-call":
              // Send tool call notification
              const toolCallData = `data: ${JSON.stringify({
                type: "tool_call_start",
                tool_name: chunk.toolName,
              })}\n\n`;

              if (res) {
                res.write(toolCallData);
                if (res.flush) res.flush();
              } else {
                stream.write(toolCallData);
              }
              break;

            case "tool-result":
              // Send tool result notification
              const toolResultData = `data: ${JSON.stringify({
                type: "tool_result",
                tool_name: chunk.toolName,
                result: chunk.result,
              })}\n\n`;

              if (res) {
                res.write(toolResultData);
                if (res.flush) res.flush();
              } else {
                stream.write(toolResultData);
              }
              break;

            case "finish":
              if (this.debug) {
                console.log(`[DEBUG] Stream finished. Usage:`, chunk.usage);
              }

              // Update token usage if available
              if (chunk.usage) {
                await editorChatDb.updateTokenUsage(this.chatId, {
                  prompt: chunk.usage.promptTokens || 0,
                  completion: chunk.usage.completionTokens || 0,
                  total: chunk.usage.totalTokens || 0,
                });
              }
              break;
          }
        }
      } else {
        // Fallback to textStream
        for await (const textChunk of response.textStream) {
          assistantMessage.content += textChunk;

          if (this.enableStreaming) {
            const sseData = `data: ${JSON.stringify({
              type: "content",
              content: textChunk,
            })}\n\n`;

            if (res) {
              res.write(sseData);
              if (res.flush) res.flush();
            } else {
              stream.write(sseData);
              if (stream.flush) stream.flush();
            }
          }
        }
      }

      // Save the assistant message
      const messageToSave = { ...assistantMessage };
      if (messageToSave.tool_calls && messageToSave.tool_calls.length === 0) {
        delete messageToSave.tool_calls;
      }

      // Add toolsUsed if any tools were executed
      if (this.toolsUsed.length > 0) {
        messageToSave.toolsUsed = this.toolsUsed;
      }

      await editorChatDb.addMessage(this.chatId, messageToSave);

      // If streaming is disabled, send the entire content at once
      if (!this.enableStreaming && assistantMessage.content) {
        const data = `data: ${JSON.stringify({
          type: "content",
          content: assistantMessage.content,
        })}\n\n`;

        if (res) {
          res.write(data);
        } else {
          stream.write(data);
        }
      }

      if (this.debug) {
        console.log(`[DEBUG] Streaming completed.`);
        console.log(`[DEBUG] Total time: ${Date.now() - startTime}ms`);
        console.log(
          `[DEBUG] Total content length: ${assistantMessage.content.length}`
        );
      }

      // Send tools used data before done
      if (this.toolsUsed.length > 0) {
        const toolsData = `data: ${JSON.stringify({
          type: "toolsUsed",
          tools: this.toolsUsed,
        })}\n\n`;

        if (res) {
          res.write(toolsData);
        } else {
          stream.write(toolsData);
        }
      }

      const doneData = `data: ${JSON.stringify({ type: "done" })}\n\n`;

      if (res) {
        res.write(doneData);
        res.end();
        return null;
      } else {
        stream.write(doneData);
        stream.end();
        return stream;
      }
    } catch (error) {
      console.error("Error in streamCompletion:", error);

      if (this.debug) {
        console.error("[DEBUG] Full error details:", {
          message: error.message,
          type: error.type,
          code: error.code,
          status: error.status,
          response: error.response?.data || error.response,
        });
      }

      const errorData = `data: ${JSON.stringify({
        type: "error",
        error: error.message,
      })}\n\n`;

      if (res) {
        res.write(errorData);
        res.end();
      } else if (stream) {
        stream.write(errorData);
        stream.end();
      }
      throw error;
    }
  }

  async getCompletion(messages) {
    try {
      // Build conversation string from messages
      const conversation = messages
        .map((m) => {
          if (m.role === "user") {
            return `User: ${m.content}`;
          } else if (m.role === "assistant") {
            return `Assistant: ${m.content}`;
          } else if (m.role === "tool") {
            return `Tool Result: ${m.content}`;
          }
          return "";
        })
        .join("\n");

      const response = await this.agent.generateText(conversation, {
        provider: {
          temperature: this.temperature,
        },
      });

      const assistantMessage = {
        id: uuidv4(),
        role: "assistant",
        content: response.text,
      };

      // Add toolsUsed if any
      if (this.toolsUsed.length > 0) {
        assistantMessage.toolsUsed = this.toolsUsed;
      }

      await editorChatDb.addMessage(this.chatId, assistantMessage);

      if (response.usage) {
        await editorChatDb.updateTokenUsage(this.chatId, {
          prompt: response.usage.promptTokens || 0,
          completion: response.usage.completionTokens || 0,
          total: response.usage.totalTokens || 0,
        });
      }

      return assistantMessage;
    } catch (error) {
      console.error("Error in getCompletion:", error);
      throw error;
    }
  }

  async generateSummary() {
    const chat = await editorChatDb.findById(this.chatId);
    const messages = chat.messages.filter(
      (m) => m.role === "user" || m.role === "assistant"
    );

    if (messages.length < 2) {
      return null;
    }

    // Create a simple summary agent
    const summaryAgent = new Agent({
      name: "SummaryGenerator",
      instructions:
        "Generate a concise summary of this conversation in 1-2 sentences. Focus on the main topic and outcome.",
      llm: new VercelAIProvider({
        headers: {
          "Helicone-Auth": `Bearer ${
            process.env.HELICONE_AUTH ||
            "sk-helicone-wetdwuy-gjnethy-vxstiti-me3vmxy"
          }`,
        },
        providerOptions: {
          openai: {
            baseURL: "https://oai.helicone.ai/v1",
            apiKey: process.env.OPENAI_API_KEY,
          },
        },
      }),
      model: openai("gpt-4.1-mini"),
      memory: false, // Disable memory for summary generation
    });

    const conversationText = messages
      .slice(-10)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const response = await summaryAgent.generateText(conversationText, {
      provider: {
        temperature: 0.5,
        maxTokens: 100,
      },
    });

    const summary = response.text;
    await editorChatDb.updateSummary(this.chatId, summary);

    return summary;
  }

  async generateTitle() {
    const chat = await editorChatDb.findById(this.chatId);
    const firstUserMessage = chat.messages.find((m) => m.role === "user");

    if (!firstUserMessage) {
      return null;
    }

    // Create a simple title generator agent
    const titleAgent = new Agent({
      name: "TitleGenerator",
      instructions:
        "Generate a short title (3-6 words) for this conversation based on the user's first message.",
      llm: new VercelAIProvider({
        headers: {
          "Helicone-Auth": `Bearer ${
            process.env.HELICONE_AUTH ||
            "sk-helicone-wetdwuy-gjnethy-vxstiti-me3vmxy"
          }`,
        },
        providerOptions: {
          openai: {
            baseURL: "https://oai.helicone.ai/v1",
            apiKey: process.env.OPENAI_API_KEY,
          },
        },
      }),
      model: openai("gpt-4.1-mini"),
      memory: false, // Disable memory for title generation
    });

    const response = await titleAgent.generateText(firstUserMessage.content, {
      provider: {
        temperature: 0.5,
        maxTokens: 20,
      },
    });

    const title = response.text;
    await editorChatDb.updateTitle(this.chatId, title);

    return title;
  }

  // Helper methods for file tracking
  isFileOperation(toolName) {
    const fileOps = [
      "create_file",
      "edit_file",
      "delete_file",
      "move_file",
      "replace_file_content",
    ];
    return fileOps.includes(toolName);
  }

  enhanceWithFileTracking(toolName, result) {
    if (!result || !result.path) return result;

    const enhanced = { ...result };

    // Track based on operation type
    switch (result.type) {
      case "created":
        this.fileTracker.trackCreation(result.path, result.content, {
          branch: result.branch,
          commitSha: result.commitSha,
        });
        break;

      case "modified":
        this.fileTracker.trackModification(
          result.path,
          result.originalContent,
          result.content,
          {
            branch: result.branch,
            commitSha: result.commitSha,
            operations: result.operations,
          }
        );
        break;

      case "deleted":
        this.fileTracker.trackDeletion(result.path, result.originalContent, {
          branch: result.branch,
          commitSha: result.commitSha,
        });
        break;
    }

    // Add file tracking summary to result
    const modification = this.fileTracker.getModification(result.path);
    if (modification) {
      enhanced.fileTracking = {
        type: modification.type,
        stats: modification.stats,
        diff: modification.diff,
      };
    }

    // Add overall summary
    enhanced.allFileModifications = this.fileTracker.getSummary();

    return enhanced;
  }
}

export { EditorChatHandlerVolt as EditorChatHandler };
