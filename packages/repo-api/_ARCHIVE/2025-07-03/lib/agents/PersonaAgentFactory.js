import { createTool } from "@voltagent/core";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { db } from "../../db.js";
import { UnifiedAgentFactory } from "./UnifiedAgentFactory.js";
import { ProjectReadOnlySDK } from "../sdk/ProjectReadOnlySDK.js";

/**
 * Factory for creating PersonaAgents - public-facing agents for each project
 */
export class PersonaAgentFactory {
  /**
   * Create a PersonaAgent for a specific project
   */
  static async createForProject(projectId, options = {}) {
    const project = await db.projects.findOne({ _id: new ObjectId(projectId) });

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Initialize read-only SDK
    const projectSDK = new ProjectReadOnlySDK(projectId);
    await projectSDK.initialize();

    // Load project-specific persona configuration
    const personaConfig = await db.personaConfigs.findOne({
      projectId: new ObjectId(projectId),
    });

    // Create persona-specific tools
    const personaTools = [
      this.createProjectSearchTool(projectSDK),
      this.createBrowseFilesTool(projectSDK),
      this.createGetProjectInfoTool(projectSDK),
      this.createAnswerQuestionTool(projectSDK),
      this.createListContentTool(projectSDK),
      this.createGetDocumentationTool(projectSDK),
      this.createProjectStructureTool(projectSDK),
    ];

    // Generate instructions
    const instructions =
      personaConfig?.instructions ||
      this.generateDefaultInstructions(project, personaConfig);

    // Use UnifiedAgentFactory to create the agent
    const agent = await UnifiedAgentFactory.createAgent({
      name: personaConfig?.name || `${project.name} Assistant`,
      purpose:
        personaConfig?.purpose ||
        `Public assistant for ${project.name} project`,
      archetype: "PERSONA", // This would need to be added to AGENT_ARCHETYPES
      model: personaConfig?.model || options.model || "gpt-4.1-mini",

      // No user for public agents
      user: null,
      org: { _id: project.orgId }, // Minimal org context
      project,

      interface: "persona",
      sessionId: options.sessionId,
      includeProjectContext: false, // We'll add our own context

      // Custom tools instead of archetype tools
      tools: personaTools,

      // Custom instructions
      customInstructions: instructions,

      metadata: {
        projectId: projectId.toString(),
        agentType: "persona",
        isPublic: true,
        personaConfigId: personaConfig?._id?.toString(),
      },

      memory: false, // Disable SQLite memory

      hooks: {
        onStart: ({ context }) => {
          console.log(`[PersonaAgent] Started for project ${project.name}`);
        },
        onToolStart: ({ tool }) => {
          console.log(`[PersonaAgent] Using tool: ${tool.name}`);
        },
      },

      ...options,
    });

    return agent;
  }

  /**
   * Generate default instructions for a project
   */
  static generateDefaultInstructions(project, config) {
    const customResponses = config?.customResponses || {};

    return `You are the public assistant for the ${project.name} project.

## Project Overview
- **Name**: ${project.name}
- **Description**: ${project.description || "No description provided"}
- **Framework**: ${project.framework || "Not specified"}
- **Language**: ${project.language || "Not specified"}
- **Topics**: ${project.topics?.join(", ") || "None"}

## Your Role
You help users understand and explore this project by:
1. Answering questions about the codebase
2. Searching for specific functionality
3. Explaining how different parts work
4. Providing code examples
5. Helping with documentation

## Behavior Guidelines
- Be helpful and informative
- Focus on the project's public information
- Don't reveal sensitive information (keys, tokens, private configs)
- Provide code examples when helpful
- Suggest relevant files or documentation

## Custom Responses
${customResponses.greeting ? `Greeting: ${customResponses.greeting}` : ""}
${
  customResponses.notFound
    ? `When not found: ${customResponses.notFound}`
    : "When you can't find something, be helpful and suggest alternatives."
}
${
  customResponses.error
    ? `On error: ${customResponses.error}`
    : "If an error occurs, apologize and suggest the user try a different approach."
}

Remember: You have read-only access. You can browse, search, and explain, but cannot modify anything.`;
  }

  /**
   * Tool: Search project content
   */
  static createProjectSearchTool(sdk) {
    return createTool({
      name: "search_project",
      description:
        "Search for content within the project (files, documentation, code)",
      parameters: z.object({
        query: z.string().describe("Search query"),
        type: z
          .enum(["all", "docs", "code", "config", "tests"])
          .optional()
          .describe("Type of content to search"),
        limit: z
          .number()
          .optional()
          .default(10)
          .describe("Maximum number of results"),
      }),
      execute: async ({ query, type, limit }) => {
        try {
          const results = await sdk.searchContent(query, { type, limit });

          if (results.length === 0) {
            return {
              success: true,
              message: `No results found for "${query}"`,
              results: [],
            };
          }

          return {
            success: true,
            message: `Found ${results.length} results for "${query}"`,
            results: results.map((r) => ({
              title: r.title,
              path: r.path,
              excerpt: r.excerpt,
              type: r.type,
              score: r.score,
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    });
  }

  /**
   * Tool: Browse specific files
   */
  static createBrowseFilesTool(sdk) {
    return createTool({
      name: "browse_file",
      description: "Read the contents of a specific file in the project",
      parameters: z.object({
        path: z.string().describe("File path to read"),
        startLine: z.number().optional().describe("Start line number"),
        endLine: z.number().optional().describe("End line number"),
      }),
      execute: async ({ path, startLine, endLine }) => {
        try {
          const file = await sdk.browseFile(path);

          let content = file.content;

          // Handle line range if specified
          if (startLine || endLine) {
            const lines = content.split("\n");
            const start = (startLine || 1) - 1;
            const end = endLine || lines.length;
            content = lines.slice(start, end).join("\n");
          }

          return {
            success: true,
            file: {
              path: file.path,
              name: file.name,
              language: file.language,
              size: file.size,
              content: content,
              lineRange:
                startLine || endLine
                  ? {
                      start: startLine || 1,
                      end: endLine || content.split("\n").length,
                    }
                  : null,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: `Cannot read file: ${error.message}`,
          };
        }
      },
    });
  }

  /**
   * Tool: Get project information
   */
  static createGetProjectInfoTool(sdk) {
    return createTool({
      name: "get_project_info",
      description: "Get general information about the project",
      parameters: z.object({}),
      execute: async () => {
        try {
          const info = await sdk.getProjectInfo();
          const stats = await sdk.getStatistics();

          return {
            success: true,
            project: {
              ...info,
              statistics: stats,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    });
  }

  /**
   * Tool: Answer questions about the project
   */
  static createAnswerQuestionTool(sdk) {
    return createTool({
      name: "answer_question",
      description:
        "Answer a specific question about the project using available context",
      parameters: z.object({
        question: z.string().describe("The question to answer"),
        searchFirst: z
          .boolean()
          .optional()
          .default(true)
          .describe("Whether to search for relevant content first"),
      }),
      execute: async ({ question, searchFirst }) => {
        try {
          let context = "";

          if (searchFirst) {
            // Search for relevant content
            const results = await sdk.searchContent(question, { limit: 5 });
            if (results.length > 0) {
              context =
                "Relevant content found:\n" +
                results.map((r) => `- ${r.path}: ${r.excerpt}`).join("\n");
            }
          }

          // Get project info for context
          const projectInfo = await sdk.getProjectInfo();

          return {
            success: true,
            question,
            context,
            projectInfo: {
              name: projectInfo.name,
              description: projectInfo.description,
              techStack: projectInfo.techStack,
            },
            hint: "Use the context and project info to formulate a helpful answer",
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    });
  }

  /**
   * Tool: List project content
   */
  static createListContentTool(sdk) {
    return createTool({
      name: "list_content",
      description: "List files and directories in the project",
      parameters: z.object({
        type: z
          .enum(["all", "docs", "code", "config", "tests"])
          .optional()
          .describe("Type of content to list"),
        path: z.string().optional().describe("Specific directory path"),
        limit: z.number().optional().default(20),
      }),
      execute: async ({ type, path, limit }) => {
        try {
          const content = await sdk.listContent(type || "all", { limit, path });

          return {
            success: true,
            count: content.length,
            content: content.map((item) => ({
              path: item.path,
              name: item.name,
              type: item.type,
              size: item.size,
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    });
  }

  /**
   * Tool: Get project documentation
   */
  static createGetDocumentationTool(sdk) {
    return createTool({
      name: "get_documentation",
      description: "Retrieve project documentation",
      parameters: z.object({
        path: z
          .string()
          .optional()
          .describe("Specific documentation file path"),
        topic: z
          .string()
          .optional()
          .describe("Documentation topic to search for"),
      }),
      execute: async ({ path, topic }) => {
        try {
          if (path) {
            const doc = await sdk.getDocumentation(path);
            return {
              success: true,
              documentation: doc,
            };
          }

          // Get all docs
          const docs = await sdk.getDocumentation();

          // Filter by topic if provided
          let filtered = docs;
          if (topic) {
            filtered = docs.filter(
              (doc) =>
                doc.title?.toLowerCase().includes(topic.toLowerCase()) ||
                doc.path?.toLowerCase().includes(topic.toLowerCase())
            );
          }

          return {
            success: true,
            documents: filtered,
            count: filtered.length,
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    });
  }

  /**
   * Tool: Get project structure
   */
  static createProjectStructureTool(sdk) {
    return createTool({
      name: "get_project_structure",
      description: "Get the file/directory structure of the project",
      parameters: z.object({
        maxDepth: z
          .number()
          .optional()
          .default(3)
          .describe("Maximum depth of directory tree"),
      }),
      execute: async ({ maxDepth }) => {
        try {
          const structure = await sdk.getProjectStructure(maxDepth);

          if (!structure) {
            return {
              success: false,
              error: "Could not retrieve project structure",
            };
          }

          return {
            success: true,
            structure,
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    });
  }

  /**
   * Create a persona agent for handling public routes
   */
  static async createPublicPersona(projectSlug, options = {}) {
    // Find project by slug for public access
    const project = await db.projects.findOne({
      slug: projectSlug,
      visibility: "public",
    });

    if (!project) {
      throw new Error(`Public project not found: ${projectSlug}`);
    }

    return this.createForProject(project._id, {
      ...options,
      sessionId: `public_${projectSlug}_${Date.now()}`,
    });
  }
}
