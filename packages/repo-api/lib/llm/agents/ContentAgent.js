import { BaseAgent } from "./BaseAgent.js";
import RepoMD from "@repo-md/client";
import { z } from "zod";
import { createTool } from "@voltagent/core";

/**
 * ContentAgent - Specialized agent for RepoMD content operations
 * 
 * This agent uses RepoMD native tools to:
 * - Search and navigate content
 * - Access project documentation
 * - Analyze content structure
 * - Perform content-specific operations
 */
export class ContentAgent extends BaseAgent {
  constructor(options = {}) {
    super({
      name: options.name || "ContentAgent",
      description: options.description || "Specialized agent for RepoMD content operations",
      ...options
    });

    this.project = options.project;
    this.repoMd = null;
    this.toolBlacklist = options.toolBlacklist || [];
  }

  /**
   * Initialize RepoMD instance
   */
  async initialize() {
    if (!this.project) {
      throw new Error("ContentAgent requires a project");
    }

    // Create RepoMD instance
    this.repoMd = new RepoMD({
      project: this.project.slug || this.project.name,
    });

    // Continue with base initialization
    await super.initialize();
  }

  /**
   * Load RepoMD native tools
   */
  async loadTools() {
    if (!this.repoMd) {
      throw new Error("RepoMD not initialized");
    }

    // Get OpenAI tool specifications from RepoMD
    const toolSpec = this.repoMd.getOpenAiToolSpec({
      blacklistedTools: this.toolBlacklist,
    });

    // Convert RepoMD tools to Volt format
    this.tools = toolSpec.functions.map((func) => {
      return createTool({
        name: func.name,
        description: func.description,
        parameters: this.parseParametersToZod(func.parameters),
        execute: async (args) => {
          return await this.executeRepoMDTool(func.name, args);
        }
      });
    });
  }

  /**
   * Execute a RepoMD tool
   */
  async executeRepoMDTool(toolName, args) {
    try {
      // RepoMD expects tool calls in a specific format
      const toolCall = {
        name: toolName,
        arguments: JSON.stringify(args),
      };

      // Execute through RepoMD
      const result = await this.repoMd.callTool(toolCall);

      // Parse result if it's a string
      if (typeof result === "string") {
        try {
          return JSON.parse(result);
        } catch {
          return { result };
        }
      }

      return result;
    } catch (error) {
      console.error(`Error executing RepoMD tool ${toolName}:`, error);
      return {
        error: error.message || "RepoMD tool execution failed",
        details: error.stack
      };
    }
  }

  /**
   * Execute any tool
   */
  async executeTool(toolName, args) {
    // All tools for this agent are RepoMD tools
    return await this.executeRepoMDTool(toolName, args);
  }

  /**
   * Get RepoMD content metadata
   */
  async getContentMetadata() {
    if (!this.repoMd) {
      return null;
    }

    try {
      // Get project structure and stats
      const structure = await this.repoMd.callTool({
        name: "getProjectStructure",
        arguments: "{}"
      });

      return {
        project: this.project.name,
        structure
      };
    } catch (error) {
      console.error("Failed to get content metadata:", error);
      return null;
    }
  }

  /**
   * Enhanced metadata including RepoMD info
   */
  getMetadata() {
    const base = super.getMetadata();
    return {
      ...base,
      project: this.project?.name,
      repoMdInitialized: !!this.repoMd,
      toolBlacklist: this.toolBlacklist
    };
  }
}