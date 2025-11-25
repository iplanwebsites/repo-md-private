import OpenAI from "openai";
import { PassThrough, Transform } from "stream";
import { v4 as uuidv4 } from "uuid";
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

// Debug flag - set to true to enable detailed logging
const DEBUG = true;

// Initialize OpenAI client with Helicone proxy
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://oai.helicone.ai/v1",
  defaultHeaders: {
    "Helicone-User-Id": "repo-md-editorChat",
    "Helicone-Auth":
      process.env.HELICONE_AUTH ||
      "Bearer sk-helicone-wetdwuy-gjnethy-vxstiti-me3vmxy",
  },
});

// Direct OpenAI client without proxy for streaming
const openaiDirect = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
});

class EditorChatHandler {
  constructor({
    user,
    org,
    project = null,
    chatId = null,
    model = "gpt-4.1-mini",
    temperature = 0.7,
    stream = true,
    enableStreaming = true, // New flag to control streaming
    debug = false, // Debug flag for logging
    agentArchetype = "GENERALIST", // Agent type for tool selection
  }) {
    this.user = user;
    this.org = org;
    this.project = project;
    this.chatId = chatId;
    this.model = model;
    this.temperature = temperature;
    this.stream = stream;
    this.enableStreaming = enableStreaming;
    this.debug = debug || DEBUG || process.env.DEBUG_OPENAI === "true";
    this.openai = openai;
    this.tools = [];
    this.toolFunctions = {};
    this.agentArchetype = agentArchetype;
    this.toolExecutor = null;
    this.agentConfig = null;
    this.toolsUsed = []; // Track tools used in current message
    this.fileTracker = createFileTracker(); // Track file modifications
    this.projectContext = null; // Store project context
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

    await this.loadTools();
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
            archetype.capabilities
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

      // Export tools for OpenAI
      this.tools = exportToolDefinitions(this.agentConfig.tools);
      console.log("Exported tools for OpenAI:", this.tools.length, "tools");
      console.log(
        "Tool names:",
        this.tools.map((t) => t.function?.name || "unknown")
      );

      // Create tool mapping for execution
      this.toolFunctions = createToolMapping(this.agentConfig.tools);
      console.log("Tool functions mapping:", Object.keys(this.toolFunctions));
    } catch (error) {
      console.warn("Could not load tools for editorChat:", error.message);
      console.error("Full stack trace:", error.stack);
      // Continue without tools
      this.tools = [];
      this.toolFunctions = {};
    }
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
    // Don't reset file tracker - keep it for the whole chat session

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
    let messages = this.formatMessagesForOpenAI(chat.messages);

    // Add agent prompts from config
    if (this.agentConfig && this.agentConfig.prompts) {
      // Prepend system prompts
      const systemPrompts = this.agentConfig.prompts.filter(
        (m) => m.role === "system"
      );
      messages = [...systemPrompts, ...messages];
    }

    // Add project context to system prompt if available
    if (this.projectContext) {
      const projectSystemPrompt = {
        role: "system",
        content: generateProjectSystemPrompt(this.projectContext),
      };
      // Insert after other system prompts but before user messages
      const systemPromptCount = messages.filter(
        (m) => m.role === "system"
      ).length;
      messages.splice(systemPromptCount, 0, projectSystemPrompt);
    }

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

  formatMessagesForOpenAI(messages) {
    return messages.map((msg) => {
      const formatted = {
        role: msg.role,
        content: msg.content || "",
      };

      if (msg.name) formatted.name = msg.name;
      // Only include tool_calls if it's a non-empty array
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        formatted.tool_calls = msg.tool_calls;
      }
      if (msg.tool_call_id) formatted.tool_call_id = msg.tool_call_id;

      if (msg.attachments && msg.attachments.length > 0) {
        const imageAttachments = msg.attachments.filter(
          (a) => a.type === "image"
        );
        if (imageAttachments.length > 0) {
          formatted.content = [
            { type: "text", text: msg.content || "" },
            ...imageAttachments.map((img) => ({
              type: "image_url",
              image_url: { url: img.url },
            })),
          ];
        }
      }

      return formatted;
    });
  }

  async streamCompletion(messages, res = null) {
    if (this.debug) {
      console.log("[DEBUG] Starting streamCompletion");
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
      if (this.debug) {
        console.log(
          "[DEBUG] Creating OpenAI completion request at:",
          new Date().toISOString()
        );
      }

      // Use direct OpenAI client for streaming to avoid proxy buffering
      const client = this.enableStreaming ? openaiDirect : this.openai;

      console.log("[DEBUG] Using model:", this.model);
      console.log("[DEBUG] Tools provided:", this.tools.length);

      if (this.debug && this.tools.length > 0) {
        console.log("[DEBUG] Tools being sent to OpenAI:");
        this.tools.forEach((tool, index) => {
          console.log(
            `  [${index}] ${tool.function?.name || "unknown"}: ${
              tool.function?.description || "no description"
            }`
          );
        });
      }

      const completion = await client.chat.completions.create({
        model: this.model,
        messages,
        temperature: this.temperature,
        tools: this.tools.length > 0 ? this.tools : undefined,
        stream: true,
      });

      if (this.debug) {
        console.log(
          "[DEBUG] OpenAI stream created, time taken:",
          Date.now() - startTime,
          "ms"
        );
      }

      let currentToolCall = null;
      let chunkCount = 0;
      let lastChunkTime = Date.now();

      for await (const chunk of completion) {
        const currentTime = Date.now();
        const timeSinceLastChunk = currentTime - lastChunkTime;
        lastChunkTime = currentTime;

        if (this.debug) {
          console.log(
            `[DEBUG] Chunk #${++chunkCount} received, time since last: ${timeSinceLastChunk}ms`
          );

          // Log finish reason if present
          if (chunk.choices[0]?.finish_reason) {
            console.log(
              `[DEBUG] Finish reason: ${chunk.choices[0].finish_reason}`
            );
          }
        }

        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          assistantMessage.content += delta.content;

          if (this.enableStreaming) {
            // Write and flush for real-time streaming
            const sseData = `data: ${JSON.stringify({
              type: "content",
              content: delta.content,
            })}\n\n`;

            if (res) {
              // Write directly to response
              res.write(sseData);
              if (res.flush) res.flush();
            } else {
              // Write to stream
              stream.write(sseData);
              if (stream.flush) stream.flush();
            }
          }
        }

        if (delta?.tool_calls) {
          if (this.debug) {
            console.log(
              "[DEBUG] Tool calls in chunk:",
              JSON.stringify(delta.tool_calls)
            );
          }

          for (const toolCall of delta.tool_calls) {
            if (toolCall.index !== undefined) {
              if (!assistantMessage.tool_calls[toolCall.index]) {
                assistantMessage.tool_calls[toolCall.index] = {
                  id: toolCall.id,
                  type: "function",
                  function: { name: "", arguments: "" },
                };
                currentToolCall = assistantMessage.tool_calls[toolCall.index];

                if (this.debug) {
                  console.log(`[DEBUG] New tool call started: ${toolCall.id}`);
                }
              }

              if (toolCall.function?.name) {
                currentToolCall.function.name += toolCall.function.name;
              }

              if (toolCall.function?.arguments) {
                currentToolCall.function.arguments +=
                  toolCall.function.arguments;
              }
            }
          }
        }

        if (chunk.choices[0]?.finish_reason === "tool_calls") {
          if (this.debug) {
            console.log("[DEBUG] Tool calls completed:");
            console.log(JSON.stringify(assistantMessage.tool_calls, null, 2));
          }

          // Send tool calls to client
          const toolCallData = `data: ${JSON.stringify({
            type: "tool_calls",
            tool_calls: assistantMessage.tool_calls,
          })}\n\n`;

          if (res) {
            res.write(toolCallData);
            if (res.flush) res.flush();
          } else {
            stream.write(toolCallData);
          }

          // Execute tools
          const toolResults = await this.executeTools(
            assistantMessage.tool_calls
          );

          // Send tool results to client
          const toolResultsData = `data: ${JSON.stringify({
            type: "tool_results",
            results: toolResults.map((r) => ({
              tool_call_id: r.tool_call_id,
              content: r.content,
            })),
          })}\n\n`;

          if (res) {
            res.write(toolResultsData);
            if (res.flush) res.flush();
          } else {
            stream.write(toolResultsData);
          }

          // Clean up the assistant message before saving
          const assistantMessageToSave = { ...assistantMessage };
          if (!assistantMessageToSave.content) {
            assistantMessageToSave.content = "";
          }
          await editorChatDb.addMessage(this.chatId, assistantMessageToSave);

          for (const result of toolResults) {
            await editorChatDb.addMessage(this.chatId, result);
          }

          const updatedChat = await editorChatDb.findById(this.chatId);
          const updatedMessages = this.formatMessagesForOpenAI(
            updatedChat.messages
          );

          // Continue streaming with updated messages (which now include tool results)
          return await this.streamCompletion(updatedMessages, res);
        }
      }

      // Clean up empty tool_calls array before saving
      const messageToSave = { ...assistantMessage };
      if (messageToSave.tool_calls && messageToSave.tool_calls.length === 0) {
        delete messageToSave.tool_calls;
      }

      // Add toolsUsed if any tools were executed
      if (this.toolsUsed.length > 0) {
        messageToSave.toolsUsed = this.toolsUsed;
      }

      await editorChatDb.addMessage(this.chatId, messageToSave);

      const usage = completion.usage;
      if (usage) {
        await editorChatDb.updateTokenUsage(this.chatId, {
          prompt: usage.prompt_tokens,
          completion: usage.completion_tokens,
          total: usage.total_tokens,
        });
      }

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
        console.log(`[DEBUG] Streaming completed. Total chunks: ${chunkCount}`);
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
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        temperature: this.temperature,
        tools: this.tools.length > 0 ? this.tools : undefined,
      });

      const choice = completion.choices[0];
      const assistantMessage = {
        id: uuidv4(),
        role: "assistant",
        content: choice.message.content,
        tool_calls: choice.message.tool_calls,
      };

      // Add toolsUsed to initial message if we're about to execute tools
      const messageToSave = { ...assistantMessage };

      await editorChatDb.addMessage(this.chatId, messageToSave);

      if (
        choice.finish_reason === "tool_calls" &&
        assistantMessage.tool_calls
      ) {
        const toolResults = await this.executeTools(
          assistantMessage.tool_calls
        );

        for (const result of toolResults) {
          await editorChatDb.addMessage(this.chatId, result);
        }

        const updatedChat = await editorChatDb.findById(this.chatId);
        const updatedMessages = this.formatMessagesForOpenAI(
          updatedChat.messages
        );

        return await this.getCompletion(updatedMessages);
      }

      // Update the saved message with toolsUsed if any
      if (this.toolsUsed.length > 0) {
        await editorChatDb.updateMessage(this.chatId, assistantMessage.id, {
          toolsUsed: this.toolsUsed,
        });
      }

      if (completion.usage) {
        await editorChatDb.updateTokenUsage(this.chatId, {
          prompt: completion.usage.prompt_tokens,
          completion: completion.usage.completion_tokens,
          total: completion.usage.total_tokens,
        });
      }

      return assistantMessage;
    } catch (error) {
      console.error("Error in getCompletion:", error);
      throw error;
    }
  }

  async executeTools(toolCalls) {
    if (this.debug) {
      console.log("[DEBUG] Executing tools:", toolCalls.length);
    }

    const results = [];

    // Use tool executor if available for enhanced execution
    if (this.toolExecutor && this.agentConfig) {
      // Prepare tool executions
      const toolExecutions = toolCalls.map((toolCall) => {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        // Find tool in agent config
        const tool = this.agentConfig.tools.find(
          (t) => t.definition.name === functionName
        );

        if (this.debug) {
          console.log(`[DEBUG] Looking for tool: ${functionName}`);
          console.log(`[DEBUG] Found tool: ${tool ? "yes" : "no"}`);
          if (!tool) {
            console.log(
              `[DEBUG] Available tool names:`,
              this.agentConfig.tools.map((t) => t.definition.name)
            );
          }
        }

        return {
          toolCall,
          tool,
          args: functionArgs,
          context: {
            sessionBranch: this.chat?.metadata?.sessionBranch,
            user: {
              ...this.user,
              permissions: this.getUserPermissions(),
            },
            org: this.org,
            project: this.project,
            permissions: this.getUserPermissions(),
            auth: true,
          },
        };
      });

      // Execute tools in parallel for efficiency
      const executionPromises = toolExecutions.map(
        async ({ toolCall, tool, args, context }) => {
          const task = {
            id: uuidv4(),
            type: toolCall.function.name,
            input: args,
            status: "in_progress",
          };

          await editorChatDb.addTask(this.chatId, task);

          try {
            let result;

            if (tool) {
              // Use tool executor for enhanced features
              const execution = await this.toolExecutor.executeTool(
                tool,
                args,
                context
              );
              result = execution.success
                ? execution.result
                : { error: execution.error };
            } else if (this.toolFunctions[toolCall.function.name]) {
              // Fallback to direct execution
              const chat = await editorChatDb.findById(this.chatId);
              const context = {
                user: this.user,
                org: this.org,
                project: this.project,
                chatId: this.chatId,
                sessionBranch: chat?.metadata?.sessionBranch,
                toolExecutor: this.toolExecutor,
              };

              result = await this.toolFunctions[toolCall.function.name](
                args,
                context
              );
            } else {
              throw new Error(
                `Unknown tool function: ${toolCall.function.name}`
              );
            }

            await editorChatDb.updateTask(this.chatId, task.id, {
              status: "completed",
              output: result,
            });

            // Enhanced result with file tracking if applicable
            let enhancedResult = result;
            if (
              this.isFileOperation(toolCall.function.name) &&
              result.success
            ) {
              enhancedResult = this.enhanceWithFileTracking(
                toolCall.function.name,
                result
              );
            }

            // Track tool usage with enhanced result
            this.toolsUsed.push({
              toolName: toolCall.function.name,
              toolCallId: toolCall.id,
              args: args,
              result: enhancedResult,
              timestamp: new Date().toISOString(),
            });

            if (this.debug) {
              console.log(
                `[DEBUG] Tool ${toolCall.function.name} executed successfully:`,
                result
              );

              // Log if tool returned an error state
              if (result && !result.success) {
                console.warn(
                  `[WARNING] Tool ${toolCall.function.name} returned error:`,
                  result.error || "Unknown error"
                );
              }
            }

            return {
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            };
          } catch (error) {
            console.error(
              `Error executing tool ${toolCall.function.name}:`,
              error
            );

            await editorChatDb.updateTask(this.chatId, task.id, {
              status: "failed",
              error: error.message,
            });

            // Track failed tool usage
            this.toolsUsed.push({
              toolName: toolCall.function.name,
              toolCallId: toolCall.id,
              args: args,
              error: error.message,
              timestamp: new Date().toISOString(),
            });

            return {
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: error.message }),
            };
          }
        }
      );

      // Wait for all executions to complete
      const parallelResults = await Promise.all(executionPromises);
      results.push(...parallelResults);
    } else {
      // Legacy execution path
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        const task = {
          id: uuidv4(),
          type: functionName,
          input: functionArgs,
          status: "in_progress",
        };

        await editorChatDb.addTask(this.chatId, task);

        try {
          if (this.toolFunctions[functionName]) {
            const chat = await editorChatDb.findById(this.chatId);
            const context = {
              user: this.user,
              org: this.org,
              project: this.project,
              chatId: this.chatId,
              sessionBranch: chat?.metadata?.sessionBranch,
            };

            const result = await this.toolFunctions[functionName](
              functionArgs,
              context
            );

            await editorChatDb.updateTask(this.chatId, task.id, {
              status: "completed",
              output: result,
            });

            // Enhanced result with file tracking if applicable
            let enhancedResult = result;
            if (this.isFileOperation(functionName) && result.success) {
              enhancedResult = this.enhanceWithFileTracking(
                functionName,
                result
              );
            }

            // Track tool usage
            this.toolsUsed.push({
              toolName: functionName,
              toolCallId: toolCall.id,
              args: functionArgs,
              result: enhancedResult,
              timestamp: new Date().toISOString(),
            });

            results.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          } else {
            throw new Error(`Unknown tool function: ${functionName}`);
          }
        } catch (error) {
          console.error(`Error executing tool ${functionName}:`, error);

          await editorChatDb.updateTask(this.chatId, task.id, {
            status: "failed",
            error: error.message,
          });

          // Track failed tool usage
          this.toolsUsed.push({
            toolName: functionName,
            toolCallId: toolCall.id,
            args: functionArgs,
            error: error.message,
            timestamp: new Date().toISOString(),
          });

          results.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: error.message }),
          });
        }
      }
    }

    return results;
  }

  async generateSummary() {
    const chat = await editorChatDb.findById(this.chatId);
    const messages = chat.messages.filter(
      (m) => m.role === "user" || m.role === "assistant"
    );

    if (messages.length < 2) {
      return null;
    }

    const summaryPrompt = {
      role: "system",
      content:
        "Generate a concise summary of this conversation in 1-2 sentences. Focus on the main topic and outcome.",
    };

    const messagesToSummarize = [
      summaryPrompt,
      ...messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: messagesToSummarize,
      temperature: 0.5,
      max_tokens: 100,
    });

    const summary = completion.choices[0].message.content;
    await editorChatDb.updateSummary(this.chatId, summary);

    return summary;
  }

  async generateTitle() {
    const chat = await editorChatDb.findById(this.chatId);
    const firstUserMessage = chat.messages.find((m) => m.role === "user");

    if (!firstUserMessage) {
      return null;
    }

    const titlePrompt = {
      role: "system",
      content: "Find a short task title for that discussion",
    };

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        titlePrompt,
        { role: "user", content: firstUserMessage.content },
      ],
      temperature: 0.5,
      max_tokens: 20,
    });

    const title = completion.choices[0].message.content;
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

export { EditorChatHandler };
