import { BaseAgent } from "./BaseAgent.js";
import { openai } from "@ai-sdk/openai";
import { 
  getToolsForArchetype, 
  exportToolDefinitions,
  createToolMapping 
} from "../tools/catalogue.js";
import ToolExecutor from "../toolExecutor.js";
import { getAiModelConfig } from "../../chat/openaiClient.js";
import { createFileTracker } from "../tools/fileTracker.js";
import {
  loadProjectContext,
  generateProjectSystemPrompt,
} from "../projectContext.js";

/**
 * EditorAgent - Specialized agent for code editing and project management
 * 
 * This agent focuses on:
 * - File operations
 * - Code analysis
 * - Project navigation
 * - GitHub integration
 * - Deployment operations
 */
export class EditorAgent extends BaseAgent {
  constructor(options = {}) {
    super({
      name: options.name || "EditorAgent",
      description: options.description || "Specialized agent for code editing and project management",
      ...options
    });

    // Editor-specific context
    this.user = options.user;
    this.org = options.org;
    this.project = options.project;
    this.chatId = options.chatId;
    this.archetype = options.archetype || "GENERALIST";
    
    // Tool execution
    this.toolExecutor = null;
    this.toolMapping = {};
    this.fileTracker = createFileTracker();
    
    // Model configuration
    const modelConfig = getAiModelConfig(this.archetype);
    this.modelId = modelConfig.modelId;
    this.provider = options.provider || openai(this.modelId);
  }

  /**
   * Load tools based on archetype and permissions
   */
  async loadTools() {
    // Get tools for the archetype
    const tools = await getToolsForArchetype(this.archetype, {
      systemRole: this.user?.systemRole,
      orgRole: this.user?.orgs?.find(o => o.id === this.org?._id)?.role,
      hasProject: !!this.project,
      hasGitHubToken: !!this.user?.githubAccessToken,
    });

    // Export tool definitions
    const toolDefinitions = exportToolDefinitions(tools);
    
    // Create tool mapping for execution
    this.toolMapping = createToolMapping(tools);

    // Initialize tool executor
    this.toolExecutor = new ToolExecutor({
      user: this.user,
      org: this.org,
      project: this.project,
      chatId: this.chatId,
      toolMapping: this.toolMapping,
      fileTracker: this.fileTracker,
    });

    // Convert to Volt tools
    this.tools = toolDefinitions.map(toolDef => 
      this.convertToVoltTool(toolDef)
    );
  }

  /**
   * Execute a tool through the ToolExecutor
   */
  async executeTool(toolName, args) {
    if (!this.toolExecutor) {
      throw new Error("ToolExecutor not initialized");
    }

    try {
      const result = await this.toolExecutor.execute(toolName, args);
      return result;
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      return {
        error: error.message || "Tool execution failed",
        details: error.stack
      };
    }
  }

  /**
   * Initialize with project context if available
   */
  async initialize() {
    await super.initialize();

    // Load project context if available
    if (this.project) {
      await this.loadProjectContext();
    }
  }

  /**
   * Load project-specific context
   */
  async loadProjectContext() {
    try {
      const projectContext = await loadProjectContext(this.project._id);
      
      if (projectContext) {
        // Generate system prompt with project context
        const systemPrompt = generateProjectSystemPrompt(
          projectContext,
          this.archetype
        );

        // Update agent's system prompt
        if (this.agent) {
          this.agent.systemPrompt = systemPrompt;
        }
      }
    } catch (error) {
      console.warn("Failed to load project context:", error);
    }
  }

  /**
   * Get file tracker state
   */
  getFileTrackerState() {
    return this.fileTracker.getState();
  }

  /**
   * Update context with new project/org/user
   */
  updateContext(updates) {
    super.updateContext(updates);
    
    // Update specific properties
    if (updates.user) this.user = updates.user;
    if (updates.org) this.org = updates.org;
    if (updates.project) this.project = updates.project;
    
    // Reinitialize tool executor with new context
    if (this.toolExecutor) {
      this.toolExecutor.updateContext({
        user: this.user,
        org: this.org,
        project: this.project,
      });
    }
  }
}