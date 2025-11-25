import { AgentComposer } from "./agents/AgentComposer.js";
import { EditorAgent } from "./agents/EditorAgent.js";
import { ContentAgent } from "./agents/ContentAgent.js";
import { voltOpsClient } from "../volt/voltAgentConfig.js";
import { db } from "../../db.js";
import editorChatDb from "../db/editorChat.js";
import { v4 as uuidv4 } from "uuid";

/**
 * EditorChatHandler - Composable implementation using the new agent architecture
 * 
 * This implementation:
 * - Uses AgentComposer to combine EditorAgent and ContentAgent
 * - Supports dynamic agent composition
 * - Maintains backward compatibility with existing API
 * - Enables future agent additions without modifying core logic
 */
export class EditorChatHandler extends AgentComposer {
  constructor(options) {
    super({
      name: "EditorChat",
      description: "AI assistant for code editing and project management",
      voltOpsClient,
      routingStrategy: options.routingStrategy || "toolBased",
      ...options
    });

    // Store context
    this.user = options.user;
    this.org = options.org;
    this.project = options.project;
    this.chatId = options.chatId || uuidv4();
    this.sessionId = options.sessionId || this.chatId;
    this.archetype = options.archetype || "GENERALIST";
    
    // Track initialization state
    this.editorAgent = null;
    this.contentAgent = null;
  }

  /**
   * Initialize the composed agents
   */
  async initialize() {
    // Create and add EditorAgent
    this.editorAgent = new EditorAgent({
      user: this.user,
      org: this.org,
      project: this.project,
      chatId: this.chatId,
      archetype: this.archetype,
      voltOpsClient: this.voltOpsClient,
    });

    await this.addAgent(this.editorAgent, {
      id: "editor",
      priority: 10,
      capabilities: ["file", "code", "github", "deploy", "search", "analyze"]
    });

    // Add ContentAgent if we have a project
    if (this.project) {
      this.contentAgent = new ContentAgent({
        project: this.project,
        voltOpsClient: this.voltOpsClient,
        toolBlacklist: ["searchProject", "searchPages"], // Avoid conflicts with editor tools
      });

      await this.addAgent(this.contentAgent, {
        id: "content",
        priority: 20,
        toolPrefix: "content",
        capabilities: ["documentation", "wiki", "content", "repomd", "pages"]
      });
    }

    // Initialize the composer
    await super.initialize();
  }

  /**
   * Send a message and get a response (backward compatibility)
   */
  async sendMessage(content, options = {}) {
    const { stream = false } = options;

    // Load or create chat
    const chat = await this.loadOrCreateChat();

    // Add user message
    await editorChatDb.addMessage(this.chatId, {
      role: "user",
      content,
      metadata: options.metadata
    });

    try {
      // Process message through composed agents
      const response = await this.processMessage(content, {
        stream,
        chatHistory: chat.messages,
        ...options
      });

      if (stream) {
        // For streaming, return the stream and save message later
        return response;
      } else {
        // Save assistant message
        await editorChatDb.addMessage(this.chatId, {
          role: "assistant",
          content: response.content || response.text || response,
          metadata: {
            model: this.editorAgent.modelId,
            ...(response.metadata || {})
          }
        });

        return response;
      }
    } catch (error) {
      console.error("Error in sendMessage:", error);
      throw error;
    }
  }

  /**
   * Stream a response (backward compatibility)
   */
  async streamResponse(prompt, options = {}) {
    return await this.sendMessage(prompt, { ...options, stream: true });
  }

  /**
   * Load or create chat
   */
  async loadOrCreateChat() {
    let chat = await editorChatDb.getChat(this.chatId);

    if (!chat) {
      chat = await editorChatDb.createChat({
        _id: this.chatId,
        userId: this.user?._id,
        orgId: this.org?._id,
        projectId: this.project?._id,
        title: "New Chat",
        archetype: this.archetype,
        messages: []
      });
    }

    return chat;
  }

  /**
   * Generate title for the chat
   */
  async generateTitle() {
    try {
      const chat = await editorChatDb.getChat(this.chatId);
      if (!chat || chat.messages.length < 2) return;

      // Use the editor agent to generate a title
      const prompt = `Based on this conversation, generate a short, descriptive title (max 50 chars):
${chat.messages.slice(0, 4).map(m => `${m.role}: ${m.content.substring(0, 200)}`).join('\n')}`;

      const response = await this.editorAgent.processMessage(prompt);
      const title = response.content || response.text || response;

      // Update chat title
      await editorChatDb.updateChat(this.chatId, {
        title: title.substring(0, 50)
      });

      return title;
    } catch (error) {
      console.error("Error generating title:", error);
    }
  }

  /**
   * Get chat messages
   */
  async getMessages() {
    const chat = await editorChatDb.getChat(this.chatId);
    return chat?.messages || [];
  }

  /**
   * Add a dynamic agent at runtime
   */
  async addDynamicAgent(agent, options) {
    await this.addAgent(agent, options);
  }

  /**
   * Remove a dynamic agent
   */
  removeDynamicAgent(agentId) {
    this.removeAgent(agentId);
  }

  /**
   * Get current agent composition
   */
  getAgentComposition() {
    return this.getMetadata();
  }

  /**
   * Update project context
   */
  async updateProjectContext(project) {
    this.project = project;

    // Update editor agent
    if (this.editorAgent) {
      this.editorAgent.updateContext({ project });
    }

    // Add or remove content agent based on project
    if (project && !this.contentAgent) {
      // Add content agent
      this.contentAgent = new ContentAgent({
        project,
        voltOpsClient: this.voltOpsClient,
        toolBlacklist: ["searchProject", "searchPages"],
      });

      await this.addAgent(this.contentAgent, {
        id: "content",
        priority: 20,
        toolPrefix: "content",
        capabilities: ["documentation", "wiki", "content", "repomd", "pages"]
      });
    } else if (!project && this.contentAgent) {
      // Remove content agent
      this.removeAgent("content");
      this.contentAgent = null;
    }
  }
}