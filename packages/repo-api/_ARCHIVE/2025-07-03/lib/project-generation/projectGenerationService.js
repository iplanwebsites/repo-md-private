import OpenAI from "openai";
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

export class ProjectGenerationService {
  constructor(openaiApiKey, githubToken) {
    this.openaiApiKey = openaiApiKey;
    this.githubToken = githubToken;

    if (openaiApiKey && openaiApiKey !== "fake-key") {
      this.openai = new OpenAI({
        apiKey: openaiApiKey,
        baseURL: "https://oai.helicone.ai/v1",
        defaultHeaders: {
          "Helicone-User-Id": "repo-md-project-gen",
          "Helicone-Auth": "Bearer sk-helicone-wetdwuy-gjnethy-vxstiti-me3vmxy",
        },
      });
    } else {
      this.openai = null;
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
        message: greetingMessage.content,
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
   * Continue an existing conversation
   */
  async continueConversation(conversationId, userMessage) {
    try {
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

      // Prepare messages for OpenAI
      const messages = convo.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        ...(msg.name && { name: msg.name }),
        ...(msg.functionCall && { function_call: msg.functionCall }),
      }));

      // Add conversation context
      messages.push({
        role: MESSAGE_ROLES.SYSTEM,
        content: getConversationContext(convo.messages),
      });

      // Call OpenAI
      const completion = await this.openai.chat.completions.create({
        model: convo.settings.model,
        messages,
        tools: projectBriefTools,
        temperature: convo.settings.temperature,
        max_tokens: convo.settings.maxTokens,
      });

      const assistantMessage = completion.choices[0].message;

      // Track tokens
      const tokens = {
        prompt: completion.usage?.prompt_tokens || 0,
        completion: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0,
      };

      // Handle tool calls
      if (assistantMessage.tool_calls) {
        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          // Add assistant message with function call
          const assistantMsg = {
            role: MESSAGE_ROLES.ASSISTANT,
            content: assistantMessage.content || "",
            functionCall: {
              name: functionName,
              arguments: functionArgs,
            },
            tokens,
          };
          addMessageToConvo(convo, assistantMsg);

          // Handle specific function calls
          if (functionName === "create_project_brief") {
            // Store the project brief
            convo.projectBrief = functionArgs;
            convo.status = CONVO_STATUS.COMPLETED;
            convo.completedAt = new Date();

            // Generate success message
            const functionResponse = {
              role: MESSAGE_ROLES.FUNCTION,
              name: functionName,
              content: JSON.stringify({
                success: true,
                message:
                  "Project brief created successfully. Ready to generate project.",
              }),
            };
            addMessageToConvo(convo, functionResponse);
          }
        }
      } else {
        // Regular assistant message
        const assistantMsg = {
          role: MESSAGE_ROLES.ASSISTANT,
          content: assistantMessage.content,
          tokens,
        };
        addMessageToConvo(convo, assistantMsg);
      }

      // Update conversation duration
      const duration = (new Date() - new Date(convo.createdAt)) / 1000;
      convo.metrics.duration = duration;

      // Save updated conversation
      await db.convos.updateOne({ _id: convo._id }, { $set: convo });

      return {
        success: true,
        message: assistantMessage.content,
        functionCalls: assistantMessage.tool_calls?.map((tc) => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        })),
        conversationComplete: convo.status === CONVO_STATUS.COMPLETED,
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
        {
          $set: {
            status: CONVO_STATUS.FAILED,
            "generationResult.error": error.message,
            "generationResult.generatedAt": new Date(),
          },
        }
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate project from a brief
   */
  async generateProjectFromBrief(brief, owner, repo, options = {}) {
    const { projectBrief, orgId, userId, simulate = false } = options;

    try {
      // Create project record in database first
      const projectDoc = {
        _id: new ObjectId(),
        name: repo,
        orgId: orgId || null,
        userId: userId || null,
        githubOwner: owner,
        githubRepo: repo,
        createdAt: new Date(),
        updatedAt: new Date(),
        generatedFromAI: true,
        projectBrief: projectBrief || null,
      };

      if (!simulate) {
        await db.projects.insertOne(projectDoc);
      }

      const projectId = projectDoc._id.toString();
      const orgSlug = options.orgSlug || "default";

      // Build generation prompt
      const prompt = buildProjectGenerationPrompt(brief, projectId, orgSlug);

      // Generate files using OpenAI
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: PROJECT_GENERATION_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        tools: [buildFileGenerationTool()],
        tool_choice: {
          type: "function",
          function: { name: "generate_project_files" },
        },
      });

      const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.function.name !== "generate_project_files") {
        throw new Error("Failed to generate project files");
      }

      const functionArgs = JSON.parse(toolCall.function.arguments);

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
    projectBrief.features.forEach((feature) => {
      description += `- **${feature.name}** (${feature.priority}): ${feature.description}\n`;
    });

    if (projectBrief.integrations?.length) {
      description += `\n## Integrations\n`;
      projectBrief.integrations.forEach((integration) => {
        description += `- ${integration.service}: ${integration.purpose}${
          integration.required ? " (Required)" : ""
        }\n`;
      });
    }

    if (projectBrief.designPreferences) {
      description += `\n## Design Preferences\n`;
      description += `- Style: ${projectBrief.designPreferences.style}\n`;
      if (projectBrief.designPreferences.colors?.length) {
        description += `- Colors: ${projectBrief.designPreferences.colors.join(
          ", "
        )}\n`;
      }
    }

    if (projectBrief.additionalNotes) {
      description += `\n## Additional Notes\n${projectBrief.additionalNotes}\n`;
    }

    return description;
  }
}
