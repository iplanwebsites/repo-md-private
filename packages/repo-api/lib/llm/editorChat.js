import { Agent, createTool, VoltOpsClient } from "@voltagent/core";
import { VercelAIProvider } from "@voltagent/vercel-ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { EditorChatHandler as EditorChatHandlerVoltBasic } from "./editorChatVoltBasic.js";
import { createProjectContentAgent } from "./agents/projectContentAgent.js";
import RepoMD from "repo-md";

import { voltOpsClient } from "../volt/voltAgentConfig.js";

/**
 * Enhanced EditorChatHandler that supports subagents
 * Automatically includes projectContentAgent when a project is available
 */
export class EditorChatHandler extends EditorChatHandlerVoltBasic {
  constructor(options) {
    super(options);
    this.subAgents = [];
    this.contentAgent = null;
  }

  async initialize() {
    // Call parent initialize first
    await super.initialize();

    // If we have a project, create the content subagent
    if (this.project) {
      await this.createContentSubagent();
    }
  }

  async createContentSubagent() {
    try {
      // Create native RepoMD instance for the project
      const repoMd = new RepoMD({
        projectId: this.project._id.toString(),
      });

      // Get OpenAI tool specifications from RepoMD
      const toolSpec = repoMd.getOpenAiToolSpec({
        blacklistedTools: [], // Add any tools you want to blacklist
      });

      // Convert RepoMD tools to Volt format
      const contentTools = toolSpec.functions.map((func) => {
        return createTool({
          name: func.name,
          description: func.description,
          parameters: this.parseParametersToZod(func.parameters),
          execute: async (args) => {
            try {
              // Execute through RepoMD's native handler
              const result = await repoMd.handleOpenAiRequest({
                function: func.name,
                arguments: args,
              });

              return {
                success: true,
                data: result,
                message: `Executed ${func.name} successfully`,
              };
            } catch (error) {
              console.error(`Error executing RepoMD tool ${func.name}:`, error);
              return {
                success: false,
                error: error.message,
              };
            }
          },
        });
      });

      // Create the content subagent
      this.contentAgent = new Agent({
        //   voltOpsClient,
        name: "Content Agent",
        purpose:
          "A specialized agent for searching and retrieving project content",
        instructions: `You are a content specialist for the ${
          this.project.name
        } project. 
        You have access to all project content through RepoMD tools.
        Use these tools to help answer questions about articles, posts, media, and project structure.
        
        Available tools:
        ${toolSpec.functions
          .map((f) => `- ${f.name}: ${f.description}`)
          .join("\n")}
        
        When asked about content, use the appropriate tools to find and retrieve information.`,
        llm: new VercelAIProvider({
          headers: {
            "Helicone-Auth": `Bearer ${
              process.env.HELICONE_AUTH ||
              "sk-helicone-wetdwuy-gjnethy-vxstiti-me3vmxy"
            }`,
            "Helicone-User-Id": "repo-md-content-agent",
          },
          providerOptions: {
            openai: {
              baseURL: "https://oai.helicone.ai/v1",
              apiKey: process.env.OPENAI_API_KEY,
            },
          },
        }),
        model: openai(this.model),
        tools: contentTools,
        markdown: true,
        memory: false,
      });

      // Add content agent as subagent
      this.subAgents.push(this.contentAgent);

      console.log(
        `Created content subagent with ${contentTools.length} RepoMD tools`
      );
    } catch (error) {
      console.error("Failed to create content subagent:", error);
      // Continue without content subagent
    }
  }

  async createAgent() {
    // Call parent createAgent first
    await super.createAgent();

    console.log("\n🔍 DEBUG: Main agent tools before subagent integration:");
    console.log(`  - Total tools: ${this.agent.tools?.length || 0}`);
    this.agent.tools?.forEach((tool) => {
      console.log(`    • ${tool.name}`);
    });

    // If we have subagents, recreate the main agent with subagents
    if (this.subAgents.length > 0) {
      const existingConfig = {
        voltOpsClient,
        name: this.agent.name,
        instructions: this.agent.instructions,
        llm: this.agent.llm,
        model: this.agent.model,
        tools: this.voltTools || [], // Use voltTools from parent
        markdown: this.agent.markdown,
        memory: this.agent.memory,
      };

      // Add instructions about subagents
      const subagentInstructions = `

## Available Subagents

You have specialized subagents available to help with specific tasks:

${this.subAgents
  .map((sa) => `- **${sa.name}**: ${sa.purpose || "Specialized assistant"}`)
  .join("\n")}

IMPORTANT: When a user asks about project content, articles, posts, or needs to search for information within the project, you MUST delegate to the Content Agent using the delegate_task tool. DO NOT use search_project_files or other search tools directly.

Example delegations:
- "Find articles about authentication" → delegate to Content Agent
- "Search for posts mentioning pizza" → delegate to Content Agent  
- "What content do we have about GraphQL?" → delegate to Content Agent
- "List all blog posts in the tutorials category" → delegate to Content Agent
- "Show me documentation about X" → delegate to Content Agent`;

      console.log("\n📋 System prompt with subagents:");
      console.log(existingConfig.instructions + subagentInstructions);

      // Recreate agent with subagents
      this.agent = new Agent({
        ...existingConfig,
        instructions: existingConfig.instructions + subagentInstructions,
        subAgents: this.subAgents,
      });

      console.log(
        `\n✅ Main agent created with ${this.subAgents.length} subagent(s)`
      );
      console.log("🔍 DEBUG: Main agent tools after subagent integration:");
      console.log(`  - Total Volt tools passed: ${this.voltTools?.length || 0}`);
      console.log(`  - Total agent tools: ${this.agent.tools?.length || 0}`);
      if (this.voltTools?.length > 0) {
        console.log("  - Volt tool names:");
        this.voltTools.forEach((tool) => {
          console.log(`    • ${tool.name}`);
        });
      }
    }
  }

  /**
   * Helper method to check if a message should be delegated to content agent
   */
  shouldDelegateToContent(message) {
    const contentKeywords = [
      "article",
      "post",
      "content",
      "blog",
      "search",
      "find",
      "about",
      "documentation",
      "media",
      "navigation",
    ];

    const lowerMessage = message.toLowerCase();
    return contentKeywords.some((keyword) => lowerMessage.includes(keyword));
  }

  /**
   * Process a chat message with subagent support
   */
  async processMessage(message, conversationId = null) {
    // Store initial message
    const messageEntry = await this.storeMessage(message, "user");

    try {
      // Check if we should suggest using the content subagent
      if (this.contentAgent && this.shouldDelegateToContent(message)) {
        console.log(
          "Message appears to be content-related, main agent will decide whether to delegate"
        );
      }

      // Process with main agent (it will decide whether to delegate)
      const result = await this.agent.streamText(message, {
        conversationId,
        userContext: new Map([
          ["chatId", this.chatId],
          ["projectId", this.project?._id?.toString()],
          ["userId", this.user._id.toString()],
          ["orgId", this.org._id.toString()],
        ]),
      });

      // Process the stream and track responses
      const chunks = [];
      for await (const chunk of result.textStream) {
        chunks.push(chunk);
        if (this.stream) {
          // Stream to client if needed
          process.stdout.write(chunk);
        }
      }

      const fullResponse = chunks.join("");

      // Store assistant response
      await this.storeMessage(fullResponse, "assistant");

      return {
        response: fullResponse,
        toolsUsed: this.toolsUsed,
        conversationId: result.conversationId,
      };
    } catch (error) {
      console.error("Error processing message with subagents:", error);
      throw error;
    }
  }
}

/**
 * Factory function to create an editor chat handler with content subagent
 */
export async function createEditorChatWithContent(options) {
  const handler = new EditorChatHandler(options);
  await handler.initialize();
  return handler;
}
