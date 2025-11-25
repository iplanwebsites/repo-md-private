import { Agent, createTool } from "@voltagent/core";
import { VercelAIProvider } from "@voltagent/vercel-ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { GitHubBulkOps } from "../github-bulk-ops.js";
import { db } from "../../db.js";
import {
  buildProjectGenerationPrompt,
  buildFileGenerationTool,
  generateBoilerplateFiles,
  PROJECT_GENERATION_SYSTEM_PROMPT,
} from "./prompts.js";
import {
  NEW_PROJECT_SYSTEM_PROMPT,
  projectBriefTools,
  conversationStarters,
  getConversationContext,
} from "./newProjectSystem.js";
import {
  CONVO_STATUS,
  CONVO_TYPES,
  MESSAGE_ROLES,
  createConvoDocument,
  addMessageToConvo,
} from "./convoSchema.js";
import { sanitizeFiles, validateProjectStructure } from "./sanitizer.js";
import { createHeliconeProvider } from "../volt/voltAgentConfig.js";

export class ProjectGenerationService {
  constructor(openaiApiKey, githubToken) {
    this.openaiApiKey = openaiApiKey;
    this.githubToken = githubToken;

    if (openaiApiKey && openaiApiKey !== "fake-key") {
      this.isEnabled = true;
    } else {
      this.isEnabled = false;
      console.log("⚠️ OpenAI API key not provided - using mock mode");
    }

    if (githubToken && githubToken !== "fake-token") {
      this.github = new GitHubBulkOps(githubToken);
    } else {
      this.github = null;
      console.log("⚠️ GitHub token not provided - simulation only");
    }
  }

  /**
   * Convert project brief tools to Volt format
   */
  convertProjectBriefTools() {
    return projectBriefTools.map((tool) => {
      const toolDef = tool.function || tool;

      // Parse parameters to Zod schema
      let parameters = z.object({});
      if (toolDef.parameters && toolDef.parameters.properties) {
        const zodSchema = {};

        // Special handling for create_project_brief tool
        if (toolDef.name === "create_project_brief") {
          zodSchema.projectName = z.string().describe("Project name");
          zodSchema.description = z.string().describe("Project description");
          zodSchema.projectType = z.string().describe("Project type");
          zodSchema.targetAudience = z.string().describe("Target audience");
          zodSchema.techStack = z
            .object({
              frontend: z.array(z.string()).optional(),
              backend: z.array(z.string()).optional(),
              database: z.array(z.string()).optional(),
              infrastructure: z.array(z.string()).optional(),
            })
            .describe("Technology stack");
          zodSchema.features = z
            .object({
              core: z.array(z.string()),
              optional: z.array(z.string()).optional(),
            })
            .describe("Features");
          zodSchema.complexity = z
            .enum(["simple", "moderate", "complex"])
            .describe("Project complexity");
          zodSchema.timeline = z.string().describe("Estimated timeline");
        } else {
          // Generic parameter parsing
          for (const [key, prop] of Object.entries(
            toolDef.parameters.properties
          )) {
            let schema = this.parsePropertyToZod(prop);

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
        }
        parameters = z.object(zodSchema);
      }

      return createTool({
        name: toolDef.name,
        description: toolDef.description,
        parameters,
        execute: async (args) => {
          // Return the project brief data
          return {
            success: true,
            message:
              "Project brief created successfully. Ready to generate project.",
            ...args,
          };
        },
      });
    });
  }

  /**
   * Convert file generation tool to Volt format
   */
  createFileGenerationTool() {
    const toolDef = buildFileGenerationTool();

    return createTool({
      name: "generate_project_files",
      description: toolDef.function.description,
      parameters: z.object({
        projectType: z.string().describe("Type of project being generated"),
        description: z.string().describe("Project description"),
        techStack: z.array(z.string()).describe("Technologies used"),
        features: z.array(z.string()).describe("Key features"),
        files: z
          .record(z.string())
          .describe("Map of file paths to file contents"),
      }),
      execute: async (args) => {
        return args;
      },
    });
  }

  /**
   * Parse property schema to Zod
   */
  parsePropertyToZod(prop) {
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
          schema = z.array(this.parsePropertyToZod(prop.items));
        } else {
          schema = z.array(z.any());
        }
        break;
      case "object":
        if (prop.properties) {
          const objSchema = {};
          for (const [key, subProp] of Object.entries(prop.properties)) {
            objSchema[key] = this.parsePropertyToZod(subProp);
          }
          schema = z.object(objSchema);
        } else {
          schema = z.object({});
        }
        break;
      default:
        schema = z.any();
    }

    if (prop.description) {
      schema = schema.describe(prop.description);
    }

    return schema;
  }

  /**
   * Create conversation agent
   */
  createConversationAgent(convo) {
    const systemPrompt =
      NEW_PROJECT_SYSTEM_PROMPT +
      "\n\n" +
      getConversationContext(convo.messages);

    return new Agent({
      name: "ProjectConversationAgent",
      instructions: systemPrompt,
      llm: createHeliconeProvider(),
      model: openai(convo.settings.model || "gpt-4.1-mini"),
      tools: this.convertProjectBriefTools(),
      markdown: true,
      memory: false, // Disable SQLite memory
    });
  }

  /**
   * Create project generation agent
   */
  createProjectGenerationAgent() {
    return new Agent({
      name: "ProjectGenerator",
      instructions: PROJECT_GENERATION_SYSTEM_PROMPT,
      llm: createHeliconeProvider(),
      model: openai("gpt-4.1-mini"),
      tools: [this.createFileGenerationTool()],
      markdown: false,
      memory: false, // Disable SQLite memory
    });
  }

  /**
   * Start a new project generation conversation
   */
  async startProjectConversation({
    userId,
    orgId,
    sessionId,
    userAgent,
    ipAddress,
  }) {
    try {
      // Create new conversation document
      const convo = createConvoDocument({
        userId: new ObjectId(userId),
        orgId: new ObjectId(orgId),
        type: CONVO_TYPES.PROJECT_GENERATION,
        sessionId,
        userAgent,
        ipAddress,
      });

      // Insert into database
      const result = await db.convos.insertOne(convo);
      convo._id = result.insertedId;

      // Add initial system message
      const systemMessage = {
        role: MESSAGE_ROLES.SYSTEM,
        content: NEW_PROJECT_SYSTEM_PROMPT,
      };
      addMessageToConvo(convo, systemMessage);

      // Add initial assistant greeting
      const greetingMessage = {
        role: MESSAGE_ROLES.ASSISTANT,
        content:
          conversationStarters[
            Math.floor(Math.random() * conversationStarters.length)
          ],
      };
      addMessageToConvo(convo, greetingMessage);

      // Save updated conversation
      await db.convos.updateOne({ _id: convo._id }, { $set: convo });

      return {
        success: true,
        conversationId: convo._id.toString(),
        greeting: greetingMessage.content,
      };
    } catch (error) {
      console.error("Error starting project conversation:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Continue project generation conversation
   */
  async continueProjectConversation(conversationId, userMessage) {
    try {
      if (!this.isEnabled) {
        return {
          success: false,
          error: "OpenAI API not configured",
        };
      }

      // Fetch conversation
      const convo = await db.convos.findOne({
        _id: new ObjectId(conversationId),
        status: CONVO_STATUS.ACTIVE,
      });

      if (!convo) {
        throw new Error("Conversation not found or inactive");
      }

      // Add user message
      const userMsg = {
        role: MESSAGE_ROLES.USER,
        content: userMessage,
      };
      addMessageToConvo(convo, userMsg);

      // Create agent for conversation
      const agent = this.createConversationAgent(convo);

      // Build conversation text
      const conversationText = convo.messages
        .filter((m) => m.role !== MESSAGE_ROLES.SYSTEM)
        .map((m) => {
          if (m.role === MESSAGE_ROLES.USER) {
            return `User: ${m.content}`;
          } else if (m.role === MESSAGE_ROLES.ASSISTANT) {
            return `Assistant: ${m.content}`;
          } else if (m.role === MESSAGE_ROLES.FUNCTION) {
            return `Function ${m.name}: ${m.content}`;
          }
          return "";
        })
        .filter((text) => text)
        .join("\n");

      // Get response from agent
      const response = await agent.generateText(conversationText, {
        provider: {
          temperature: convo.settings.temperature,
          maxTokens: convo.settings.maxTokens,
        },
      });

      // Parse response for tool calls (Volt handles this internally)
      let projectBrief = null;
      let conversationComplete = false;

      // Check if the response contains a project brief
      // Since Volt executes tools internally, we need to check the response
      if (response.text.includes("Project brief created successfully")) {
        // Extract project brief from agent's tool execution
        // This is a simplified approach - in production, you'd want better parsing
        conversationComplete = true;
        convo.status = CONVO_STATUS.COMPLETED;
        convo.completedAt = new Date();
      }

      // Add assistant message
      const assistantMsg = {
        role: MESSAGE_ROLES.ASSISTANT,
        content: response.text,
        tokens: {
          prompt: response.usage?.promptTokens || 0,
          completion: response.usage?.completionTokens || 0,
          total: response.usage?.totalTokens || 0,
        },
      };
      addMessageToConvo(convo, assistantMsg);

      // Update conversation duration
      const duration = (new Date() - new Date(convo.createdAt)) / 1000;
      convo.metrics.duration = duration;

      // Save updated conversation
      await db.convos.updateOne({ _id: convo._id }, { $set: convo });

      return {
        success: true,
        message: response.text,
        conversationComplete,
        projectBrief: convo.projectBrief,
      };
    } catch (error) {
      console.error("Error continuing conversation:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate project from completed conversation
   */
  async generateProjectFromConversation(
    conversationId,
    { owner, repo, repoOptions = {} }
  ) {
    try {
      // Fetch conversation with project brief
      const convo = await db.convos.findOne({
        _id: new ObjectId(conversationId),
        status: CONVO_STATUS.COMPLETED,
        projectBrief: { $exists: true },
      });

      if (!convo) {
        throw new Error("Conversation not found or project brief not ready");
      }

      // Update status to generating
      await db.convos.updateOne(
        { _id: convo._id },
        { $set: { status: CONVO_STATUS.GENERATING } }
      );

      // Build comprehensive project description from brief
      const projectDescription = this._buildProjectDescription(
        convo.projectBrief
      );

      // Generate project files
      const generationResult = await this.generateProjectFromBrief(
        projectDescription,
        owner,
        repo,
        {
          ...repoOptions,
          projectBrief: convo.projectBrief,
          orgId: convo.orgId,
          userId: convo.userId,
        }
      );

      // Update conversation with results
      const updateData = {
        generationResult: {
          success: generationResult.success,
          projectId: generationResult.projectId,
          repositoryUrl: generationResult.data?.repository?.url,
          commitSha: generationResult.data?.commitSha,
          filesGenerated: generationResult.data?.fileCount,
          error: generationResult.error,
          generatedAt: new Date(),
        },
      };

      if (generationResult.success) {
        updateData.status = CONVO_STATUS.COMPLETED;
        updateData.projectId = generationResult.projectId;
      } else {
        updateData.status = CONVO_STATUS.FAILED;
      }

      await db.convos.updateOne({ _id: convo._id }, { $set: updateData });

      return generationResult;
    } catch (error) {
      console.error("Error generating project from conversation:", error);

      // Update conversation status to failed
      await db.convos.updateOne(
        { _id: new ObjectId(conversationId) },
        { $set: { status: CONVO_STATUS.FAILED } }
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate project from brief using Volt Agent
   */
  async generateProjectFromBrief(brief, owner, repo, options = {}) {
    const simulate = !this.github || options.simulate;
    let projectDoc = null;

    try {
      if (!this.isEnabled) {
        throw new Error("OpenAI API not configured");
      }

      // Create or find project record
      if (options.projectId) {
        projectDoc = await db.projects.findOne({
          _id: new ObjectId(options.projectId),
        });
      } else {
        projectDoc = {
          _id: new ObjectId(),
          name: repo,
          slug: repo.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          description: brief,
          ownerId: options.userId?.toString(),
          orgId: options.orgId?.toString(),
          createdAt: new Date(),
          updatedAt: new Date(),
          status: "generating",
        };
        await db.projects.insertOne(projectDoc);
      }

      const projectId = projectDoc._id.toString();
      const orgSlug = options.orgSlug || "default";

      // Build generation prompt
      const prompt = buildProjectGenerationPrompt(brief, projectId, orgSlug);

      // Create project generation agent
      const agent = this.createProjectGenerationAgent();

      // Generate files using Volt Agent
      const response = await agent.generateText(prompt);

      // Parse the response to extract files
      let functionArgs;
      try {
        // Try to parse JSON from response
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          functionArgs = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No valid JSON in response");
        }
      } catch (parseError) {
        console.error("Failed to parse generation response:", parseError);
        throw new Error("Failed to generate project files");
      }

      // Merge generated files with boilerplate
      const boilerplateFiles = generateBoilerplateFiles(
        projectId,
        repo,
        orgSlug
      );
      const allFiles = {
        ...functionArgs.files,
        ...boilerplateFiles,
      };

      // Sanitize and validate files
      const sanitizationResult = await sanitizeFiles(allFiles);

      if (sanitizationResult.issueCount > 0) {
        console.warn("File sanitization issues:", sanitizationResult.issues);
      }

      // Validate project structure
      const structureValidation = validateProjectStructure(
        sanitizationResult.files
      );
      if (!structureValidation.valid) {
        console.warn("Project structure issues:", structureValidation.issues);
      }

      const sanitizedFiles = sanitizationResult.files;

      if (simulate) {
        return {
          success: true,
          simulation: true,
          projectId,
          data: {
            projectType: functionArgs.projectType,
            description: functionArgs.description,
            techStack: functionArgs.techStack,
            features: functionArgs.features,
            fileCount: Object.keys(sanitizedFiles).length,
            files: Object.keys(sanitizedFiles),
          },
        };
      }

      // Create GitHub repository
      const commitMessage = `🚀 AI-Generated ${functionArgs.projectType}: ${functionArgs.description}

Generated with Repo.md AI from project brief.
Project ID: ${projectId}`;

      const githubResult = await this.github.createAndBootstrapRepo(
        owner,
        repo,
        sanitizedFiles,
        commitMessage,
        {
          private: options.private || false,
          description: functionArgs.description,
        }
      );

      if (!githubResult.success) {
        throw new Error(githubResult.error);
      }

      // Update project with GitHub info
      await db.projects.updateOne(
        { _id: projectDoc._id },
        {
          $set: {
            githubUrl: githubResult.repository.url,
            githubId: githubResult.repository.id,
            defaultBranch: githubResult.repository.defaultBranch,
            lastCommitSha: githubResult.commitSha,
          },
        }
      );

      return {
        success: true,
        projectId,
        data: {
          ...githubResult,
          projectType: functionArgs.projectType,
          description: functionArgs.description,
          techStack: functionArgs.techStack,
          features: functionArgs.features,
        },
      };
    } catch (error) {
      console.error("Error generating project from brief:", error);

      // Clean up project record if it was created
      if (!simulate && projectDoc?._id) {
        await db.projects.deleteOne({ _id: projectDoc._id });
      }

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Build comprehensive description from project brief
   */
  _buildProjectDescription(projectBrief) {
    let description = `# ${projectBrief.projectName}\n\n`;
    description += `${projectBrief.description}\n\n`;

    description += `## Project Type\n${projectBrief.projectType}\n\n`;

    description += `## Target Audience\n${projectBrief.targetAudience}\n\n`;

    description += `## Technology Stack\n`;
    if (projectBrief.techStack.frontend?.length) {
      description += `- Frontend: ${projectBrief.techStack.frontend.join(
        ", "
      )}\n`;
    }
    if (projectBrief.techStack.backend?.length) {
      description += `- Backend: ${projectBrief.techStack.backend.join(
        ", "
      )}\n`;
    }
    if (projectBrief.techStack.database?.length) {
      description += `- Database: ${projectBrief.techStack.database.join(
        ", "
      )}\n`;
    }
    if (projectBrief.techStack.infrastructure?.length) {
      description += `- Infrastructure: ${projectBrief.techStack.infrastructure.join(
        ", "
      )}\n`;
    }

    description += `\n## Features\n`;
    description += `### Core Features\n`;
    projectBrief.features.core.forEach((feature) => {
      description += `- ${feature}\n`;
    });

    if (projectBrief.features.optional?.length) {
      description += `\n### Optional Features\n`;
      projectBrief.features.optional.forEach((feature) => {
        description += `- ${feature}\n`;
      });
    }

    description += `\n## Complexity: ${projectBrief.complexity}\n`;
    description += `## Timeline: ${projectBrief.timeline}\n`;

    return description;
  }
}
