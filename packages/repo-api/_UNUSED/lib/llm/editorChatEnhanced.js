/**
 * Enhanced Editor Chat Handler
 * Simplified and more efficient implementation
 * @module editorChatEnhanced
 */

import OpenAI from "openai";
import { PassThrough } from "stream";
import { v4 as uuidv4 } from "uuid";
import editorChatDb from "../db/editorChat.js";
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
import {
  handleOpenAIError,
  handleStreamError,
  validate,
  asyncHandler,
} from "./errorHandler.js";

// OpenAI client configuration
const createOpenAIClient = (useProxy = true) => {
  const config = {
    apiKey: process.env.OPENAI_API_KEY,
  };

  if (useProxy && process.env.HELICONE_AUTH) {
    config.baseURL =
      process.env.OPENAI_BASE_URL || "https://oai.helicone.ai/v1";
    config.defaultHeaders = {
      "Helicone-User-Id": "repo-md-editorChat",
      "Helicone-Auth": process.env.HELICONE_AUTH,
    };
  } else {
    config.baseURL = "https://api.openai.com/v1";
  }

  return new OpenAI(config);
};

// Singleton clients
const openaiProxy = createOpenAIClient(true);
const openaiDirect = createOpenAIClient(false);

/**
 * Enhanced Editor Chat Handler
 */
class EditorChatHandler {
  constructor(options = {}) {
    // Validate required options
    validate.required(options, ["user", "org"]);

    // Set properties with defaults
    this.user = options.user;
    this.org = options.org;
    this.project = options.project || null;
    this.chatId = options.chatId || null;
    this.model = options.model || "gpt-4.1-mini";
    this.temperature = options.temperature || 0.7;
    this.stream = options.stream !== false;
    this.enableStreaming = options.enableStreaming !== false;
    this.debug = options.debug || process.env.DEBUG_OPENAI === "true";
    this.agentArchetype = options.agentArchetype || "GENERALIST";

    // Initialize internals
    this.openai = openaiProxy;
    this.agentConfig = null;
    this.toolExecutor = null;
    this._initialized = false;
  }

  /**
   * Initialize the chat handler
   */
  async initialize() {
    if (this._initialized) return this.chatId;

    try {
      // Create or retrieve chat
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

      // Setup agent configuration
      await this._setupAgent();

      this._initialized = true;
      return this.chatId;
    } catch (error) {
      console.error("Failed to initialize EditorChatHandler:", error);
      throw error;
    }
  }

  /**
   * Setup agent configuration and tools
   */
  async _setupAgent() {
    // Build context
    const context = {
      user: this.user,
      org: this.org,
      project: this.project,
      chatId: this.chatId,
      auth: true,
      permissions: this._getUserPermissions(),
      db: editorChatDb.db,
    };

    // Initialize tool executor
    this.toolExecutor = new ToolExecutor({
      context: {
        ...context,
        agentArchetype: this.agentArchetype,
        agentId: `chat_${this.chatId}`,
        session: {
          id: this.chatId,
          type: "editorChat",
        },
      },
    });

    // Get available tools
    const archetype = AGENT_ARCHETYPES[this.agentArchetype];
    const availableTools = archetype
      ? getToolsForArchetype(this.agentArchetype, archetype.capabilities)
      : [];

    // Create agent configuration
    this.agentConfig = createAgentConfig({
      interface: "editorChat",
      archetype: this.agentArchetype,
      context,
      availableTools,
    });

    // Log initialization
    if (this.debug) {
      console.log("[EditorChat] Initialized with:", {
        archetype: this.agentArchetype,
        toolCount: this.agentConfig.tools.length,
        model: this.agentConfig.modelConfig.model,
      });
    }
  }

  /**
   * Get user permissions
   */
  _getUserPermissions() {
    const permissions = ["read", "write"];

    if (!this.project) return permissions;

    const member = this.project.members?.find(
      (m) => m.userId.toString() === this.user._id.toString()
    );

    if (member) {
      const rolePermissions = {
        owner: ["admin", "deploy"],
        admin: ["admin", "deploy"],
        editor: ["deploy"],
        viewer: [],
      };

      permissions.push(...(rolePermissions[member.role] || []));
    }

    return [...new Set(permissions)]; // Remove duplicates
  }

  /**
   * Send a message to the chat
   */
  async sendMessage(content, attachments = [], res = null) {
    // Ensure initialized
    await this.initialize();

    // Validate input
    if (!content && (!attachments || attachments.length === 0)) {
      throw new Error("Message content or attachments are required");
    }

    // Create and store user message
    const userMessage = {
      id: uuidv4(),
      role: "user",
      content: content || "",
      attachments,
    };

    await editorChatDb.addMessage(this.chatId, userMessage);

    // Get conversation history
    const chat = await editorChatDb.findById(this.chatId);
    const messages = this._buildMessages(chat.messages);

    // Process message
    if (this.stream) {
      return await this._streamCompletion(messages, res);
    } else {
      return await this._getCompletion(messages);
    }
  }

  /**
   * Build messages array for OpenAI
   */
  _buildMessages(chatMessages) {
    // Start with system prompts
    const messages = [...this.agentConfig.prompts];

    // Add chat messages
    for (const msg of chatMessages) {
      const formatted = {
        role: msg.role,
        content: msg.content || "",
      };

      // Add optional fields
      if (msg.name) formatted.name = msg.name;
      if (msg.tool_calls?.length > 0) formatted.tool_calls = msg.tool_calls;
      if (msg.tool_call_id) formatted.tool_call_id = msg.tool_call_id;

      // Handle attachments
      if (msg.attachments?.length > 0) {
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

      messages.push(formatted);
    }

    return messages;
  }

  /**
   * Stream completion with SSE
   */
  async _streamCompletion(messages, res = null) {
    const stream = res ? null : new PassThrough();
    const assistantMessage = {
      id: uuidv4(),
      role: "assistant",
      content: "",
      tool_calls: [],
    };

    try {
      // Choose client based on streaming preference
      const client = this.enableStreaming ? openaiDirect : this.openai;

      // Create completion stream
      const completion = await client.chat.completions.create({
        model: this.agentConfig.modelConfig.model,
        messages,
        temperature: this.agentConfig.modelConfig.temperature,
        tools: exportToolDefinitions(this.agentConfig.tools),
        stream: true,
      });

      // Process stream
      await this._processStream(completion, assistantMessage, res || stream);

      // Handle tool calls if any
      if (assistantMessage.tool_calls.length > 0) {
        const toolResults = await this._executeTools(
          assistantMessage.tool_calls
        );

        // Save messages
        await editorChatDb.addMessage(this.chatId, assistantMessage);
        for (const result of toolResults) {
          await editorChatDb.addMessage(this.chatId, result);
        }

        // Continue conversation
        const updatedChat = await editorChatDb.findById(this.chatId);
        const updatedMessages = this._buildMessages(updatedChat.messages);
        return await this._streamCompletion(updatedMessages, res);
      }

      // Save assistant message
      await editorChatDb.addMessage(this.chatId, assistantMessage);

      // End stream
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
      if (error.status) {
        handleOpenAIError(error);
      }

      handleStreamError(error, res || stream);
      throw error;
    }
  }

  /**
   * Process streaming chunks
   */
  async _processStream(completion, assistantMessage, output) {
    let currentToolCall = null;

    for await (const chunk of completion) {
      const delta = chunk.choices[0]?.delta;

      // Handle content
      if (delta?.content) {
        assistantMessage.content += delta.content;

        if (this.enableStreaming) {
          const data = `data: ${JSON.stringify({
            type: "content",
            content: delta.content,
          })}\n\n`;

          output.write(data);
          if (output.flush) output.flush();
        }
      }

      // Handle tool calls
      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (toolCall.index !== undefined) {
            if (!assistantMessage.tool_calls[toolCall.index]) {
              assistantMessage.tool_calls[toolCall.index] = {
                id: toolCall.id,
                type: "function",
                function: { name: "", arguments: "" },
              };
              currentToolCall = assistantMessage.tool_calls[toolCall.index];
            }

            if (toolCall.function?.name) {
              currentToolCall.function.name += toolCall.function.name;
            }

            if (toolCall.function?.arguments) {
              currentToolCall.function.arguments += toolCall.function.arguments;
            }
          }
        }
      }
    }

    // Send buffered content if streaming was disabled
    if (!this.enableStreaming && assistantMessage.content) {
      const data = `data: ${JSON.stringify({
        type: "content",
        content: assistantMessage.content,
      })}\n\n`;

      output.write(data);
    }
  }

  /**
   * Get non-streaming completion
   */
  async _getCompletion(messages) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.agentConfig.modelConfig.model,
        messages,
        temperature: this.agentConfig.modelConfig.temperature,
        tools: exportToolDefinitions(this.agentConfig.tools),
      });

      const choice = completion.choices[0];
      const assistantMessage = {
        id: uuidv4(),
        role: "assistant",
        content: choice.message.content,
        tool_calls: choice.message.tool_calls,
      };

      await editorChatDb.addMessage(this.chatId, assistantMessage);

      // Handle tool calls
      if (
        choice.finish_reason === "tool_calls" &&
        assistantMessage.tool_calls
      ) {
        const toolResults = await this._executeTools(
          assistantMessage.tool_calls
        );

        for (const result of toolResults) {
          await editorChatDb.addMessage(this.chatId, result);
        }

        const updatedChat = await editorChatDb.findById(this.chatId);
        const updatedMessages = this._buildMessages(updatedChat.messages);

        return await this._getCompletion(updatedMessages);
      }

      // Update token usage
      if (completion.usage) {
        await editorChatDb.updateTokenUsage(this.chatId, {
          prompt: completion.usage.prompt_tokens,
          completion: completion.usage.completion_tokens,
          total: completion.usage.total_tokens,
        });
      }

      return assistantMessage;
    } catch (error) {
      if (error.status) {
        handleOpenAIError(error);
      }
      throw error;
    }
  }

  /**
   * Execute tools efficiently
   */
  async _executeTools(toolCalls) {
    const toolMapping = createToolMapping(this.agentConfig.tools);

    // Execute all tools in parallel
    const executionPromises = toolCalls.map(async (toolCall) => {
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);

      // Create task record
      const task = {
        id: uuidv4(),
        type: functionName,
        input: functionArgs,
        status: "in_progress",
      };

      await editorChatDb.addTask(this.chatId, task);

      try {
        let result;

        // Find tool in config
        const tool = this.agentConfig.tools.find(
          (t) => t.definition.name === functionName
        );

        if (tool && this.toolExecutor) {
          // Use enhanced tool executor
          const execution = await this.toolExecutor.executeTool(
            tool,
            functionArgs,
            {
              sessionBranch: (
                await editorChatDb.findById(this.chatId)
              )?.metadata?.sessionBranch,
            }
          );

          result = execution.success
            ? execution.result
            : { error: execution.error };
        } else if (toolMapping[functionName]) {
          // Fallback to direct execution
          const context = {
            user: this.user,
            org: this.org,
            project: this.project,
            chatId: this.chatId,
            toolExecutor: this.toolExecutor,
          };

          result = await toolMapping[functionName](functionArgs, context);
        } else {
          throw new Error(`Unknown tool function: ${functionName}`);
        }

        // Update task
        await editorChatDb.updateTask(this.chatId, task.id, {
          status: "completed",
          output: result,
        });

        return {
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        };
      } catch (error) {
        console.error(`Tool execution error (${functionName}):`, error);

        await editorChatDb.updateTask(this.chatId, task.id, {
          status: "failed",
          error: error.message,
        });

        return {
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            error: error.message,
            success: false,
          }),
        };
      }
    });

    return Promise.all(executionPromises);
  }

  /**
   * Generate chat summary
   */
  async generateSummary() {
    const chat = await editorChatDb.findById(this.chatId);
    const messages = chat.messages.filter(
      (m) => m.role === "user" || m.role === "assistant"
    );

    if (messages.length < 2) return null;

    const summaryMessages = [
      systemMsg(
        "Generate a concise summary of this conversation in 1-2 sentences. Focus on the main topic and outcome."
      ),
      ...messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: summaryMessages,
        temperature: 0.5,
        max_tokens: 100,
      });

      const summary = completion.choices[0].message.content;
      await editorChatDb.updateSummary(this.chatId, summary);

      return summary;
    } catch (error) {
      console.error("Failed to generate summary:", error);
      return null;
    }
  }

  /**
   * Generate chat title
   */
  async generateTitle() {
    const chat = await editorChatDb.findById(this.chatId);
    const firstUserMessage = chat.messages.find((m) => m.role === "user");

    if (!firstUserMessage) return null;

    const titleMessages = [
      systemMsg(
        "Generate a short title (3-6 words) for this conversation based on the user's first message."
      ),
      userMsg(firstUserMessage.content),
    ];

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: titleMessages,
        temperature: 0.5,
        max_tokens: 20,
      });

      const title = completion.choices[0].message.content;
      await editorChatDb.updateTitle(this.chatId, title);

      return title;
    } catch (error) {
      console.error("Failed to generate title:", error);
      return null;
    }
  }
}

// Helper to create message objects
const { systemMsg, userMsg } = createAgentConfig();

export { EditorChatHandler };
