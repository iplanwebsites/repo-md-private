import { SlackMessageHandler } from "./messageHandler.js";
import { UnifiedAgentFactory } from "../agents/UnifiedAgentFactory.js";
import { getTemplate } from "./responseTemplates.js";
import agentManager from "./agentManager.js";
import { formatJsonBlock } from "./formatHelpers.js";

/**
 * Enhanced Slack Message Handler with real LLM integration using Volt
 */
export class SlackMessageHandlerVolt extends SlackMessageHandler {
  constructor() {
    super();
    this.activeAgents = new Map(); // Cache active Volt agents
  }

  /**
   * Execute agent with real LLM and tool support
   */
  async executeAgentWithTools(agent, agentConfig, toolExecutor) {
    try {
      // Update agent status
      await agentManager.updateAgentStatus(agent._id, "running");

      // Create or get cached Volt agent
      const voltAgent = await this.getOrCreateVoltAgent(agent, agentConfig);

      // Send initial thinking message
      await this.client.chat.postMessage({
        channel: agent.channelId,
        text: "🤔 Processing your request...",
        thread_ts: agent.threadTs,
      });

      // Execute with streaming updates to Slack
      const startTime = Date.now();
      let toolsUsed = [];
      let streamBuffer = "";
      let lastUpdateTime = 0;

      // Stream the response
      const response = await voltAgent.streamText(agent.prompt, {
        provider: {
          temperature: 0.7,
          maxTokens: 2000,
        },
        // Hook into streaming events
        onChunk: async (chunk) => {
          streamBuffer += chunk;

          // Update Slack every 1 second to avoid rate limits
          const now = Date.now();
          if (now - lastUpdateTime > 1000 && streamBuffer.length > 50) {
            await this.sendStreamUpdate(agent, streamBuffer);
            lastUpdateTime = now;
          }
        },
        onToolCall: async (toolCall) => {
          toolsUsed.push(toolCall.toolName);

          // Notify about tool usage
          await this.client.chat.postMessage({
            channel: agent.channelId,
            text: `🔧 Using tool: ${toolCall.toolName}`,
            thread_ts: agent.threadTs,
          });
        },
      });

      // Process the full stream
      let fullResponse = "";
      for await (const chunk of response.textStream) {
        fullResponse += chunk;
      }

      // Update agent with results
      await agentManager.updateAgentStatus(agent._id, "completed", {
        executionTime: Date.now() - startTime,
        toolsUsed: toolsUsed,
        response: fullResponse,
      });

      // Send final formatted response
      const formattedResponse = this.formatAgentResponse(
        agent,
        fullResponse,
        toolsUsed
      );
      await this.client.chat.postMessage({
        channel: agent.channelId,
        text: formattedResponse.text,
        thread_ts: agent.threadTs,
        blocks: formattedResponse.blocks,
      });

      return response;
    } catch (error) {
      console.error("Agent execution error:", error);

      await agentManager.updateAgentStatus(agent._id, "failed", {
        error: error.message,
      });

      // Send error message
      const errorResponse = getTemplate("agentError", {
        agent,
        error: error.message,
      });

      await this.client.chat.postMessage({
        channel: agent.channelId,
        text: errorResponse.text,
        thread_ts: agent.threadTs,
        blocks: errorResponse.blocks,
      });

      throw error;
    }
  }

  /**
   * Get or create a Volt agent for the Slack context
   */
  async getOrCreateVoltAgent(agent, agentConfig) {
    const cacheKey = `${agent._id}_${agent.archetype}`;

    if (this.activeAgents.has(cacheKey)) {
      return this.activeAgents.get(cacheKey);
    }

    // Find project if specified
    let project = null;
    if (agent.projectId) {
      project = await db.projects.findOne({
        _id: new ObjectId(agent.projectId),
      });
    }

    // Create Volt agent with Slack-specific configuration
    const voltAgent = await UnifiedAgentFactory.createAgent({
      name: agent.name || `Slack ${agent.archetype} Agent`,
      archetype: agent.archetype,
      model: agent.model || "gpt-4.1-mini",
      user: { _id: agent.userId }, // Minimal user object for Slack
      org: this.org,
      project,
      interface: "slack",
      sessionId: agent._id.toString(),
      metadata: {
        slackThreadTs: agent.threadTs,
        slackChannelId: agent.channelId,
        slackTeamId: this.installation.teamId,
      },
      hooks: {
        onToolStart: ({ tool }) => {
          console.log(
            `[Slack] Tool ${tool.name} started for agent ${agent._id}`
          );
        },
        onToolEnd: ({ tool, result }) => {
          console.log(
            `[Slack] Tool ${tool.name} completed for agent ${agent._id}`
          );
        },
      },
    });

    // Cache for reuse
    this.activeAgents.set(cacheKey, voltAgent);

    // Clean up cache after 30 minutes
    setTimeout(() => {
      this.activeAgents.delete(cacheKey);
    }, 30 * 60 * 1000);

    return voltAgent;
  }

  /**
   * Handle natural language commands with LLM
   */
  async handleNaturalLanguage(event, threadContext) {
    try {
      // Create a lightweight agent for command parsing
      const commandAgent = await UnifiedAgentFactory.createTaskAgent({
        task: "command_parser",
        user: { _id: event.user },
        org: this.org,
        interface: "slack",
      });

      // Build context-aware prompt
      const parsePrompt = this.buildCommandParsePrompt(event, threadContext);

      // Get LLM interpretation
      const parseResult = await commandAgent.generateText(parsePrompt, {
        provider: {
          temperature: 0.3, // Lower temperature for more consistent parsing
          maxTokens: 500,
        },
      });

      // Extract structured intent from response
      const intent = this.extractIntent(parseResult.text);

      // Route based on intent
      return await this.routeBasedOnIntent(intent, event, threadContext);
    } catch (error) {
      console.error("Natural language processing error:", error);

      // Fallback to template-based response
      const response = getTemplate("error", {
        error: "I had trouble understanding your request. Please try again.",
        messageNumber: threadContext.messageCount + 1,
      });

      return await this.client.chat.postMessage({
        channel: event.channel,
        text: response.text,
        thread_ts: event.thread_ts || event.ts,
        blocks: response.blocks,
      });
    }
  }

  /**
   * Build prompt for command parsing
   */
  buildCommandParsePrompt(event, threadContext) {
    const recentMessages = threadContext.messages
      .slice(-5)
      .map((m) => `${m.user}: ${m.text}`)
      .join("\n");

    return `Parse this Slack message and determine the user's intent.

Message: "${event.text}"

Context:
- Workspace: ${this.org.name}
- Channel: ${event.channel}
- Thread has ${threadContext.messageCount} messages
- Recent conversation:
${recentMessages}

Identify the intent as one of:
1. DEPLOY - User wants to deploy a project (extract project name)
2. TASK - User wants to execute a specific task
3. PROJECT_INFO - User asking about projects or status
4. IMPLEMENTATION - User wants something built/fixed
5. QUESTION - General question or help request
6. CONVERSATION - Casual chat or unclear intent

Also extract:
- Project name (if mentioned)
- Specific commands or keywords
- Urgency level (normal/urgent)
- Any specific requirements

Respond in JSON format:
{
  "intent": "INTENT_TYPE",
  "projectName": "project if mentioned",
  "details": "specific requirements",
  "confidence": 0.0-1.0
}`;
  }

  /**
   * Extract structured intent from LLM response
   */
  extractIntent(llmResponse) {
    try {
      // Try to parse JSON from response
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error("Failed to parse intent JSON:", error);
    }

    // Fallback intent extraction
    const intent = {
      intent: "CONVERSATION",
      confidence: 0.5,
    };

    // Simple keyword matching as fallback
    const lowerResponse = llmResponse.toLowerCase();
    if (lowerResponse.includes("deploy")) {
      intent.intent = "DEPLOY";
      intent.confidence = 0.7;
    } else if (
      lowerResponse.includes("implement") ||
      lowerResponse.includes("build")
    ) {
      intent.intent = "IMPLEMENTATION";
      intent.confidence = 0.7;
    }

    return intent;
  }

  /**
   * Route based on parsed intent
   */
  async routeBasedOnIntent(intent, event, threadContext) {
    console.log("Routing based on intent:", intent);

    switch (intent.intent) {
      case "DEPLOY":
        return await this.handleDeployCommand(event, threadContext, {
          type: "deploy",
          projectName: intent.projectName,
          details: intent.details,
        });

      case "IMPLEMENTATION":
        return await this.createNewAgent(event, threadContext, {
          type: "agent",
          prompt: event.text,
          archetype: "CODE_GENERATOR",
        });

      case "PROJECT_INFO":
        return await this.sendProjectsListResponse(event, threadContext);

      case "TASK":
        return await this.handleTaskCommand(event, threadContext, {
          type: "task",
          details: intent.details,
        });

      case "QUESTION":
        // Use a general assistant agent
        return await this.createNewAgent(event, threadContext, {
          type: "agent",
          prompt: event.text,
          archetype: "GENERALIST",
        });

      default:
        // Regular conversational response
        const response = await this.generateResponse(event, threadContext);
        return await this.client.chat.postMessage({
          channel: event.channel,
          text: response.text,
          thread_ts: event.thread_ts || event.ts,
          blocks: response.blocks,
        });
    }
  }

  /**
   * Send streaming updates to Slack
   */
  async sendStreamUpdate(agent, content) {
    try {
      // Update the message with current progress
      await this.client.chat.update({
        channel: agent.channelId,
        ts: agent.lastMessageTs,
        text: content.substring(0, 3000), // Slack message limit
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: content.substring(0, 3000),
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "🔄 _Still processing..._",
              },
            ],
          },
        ],
      });
    } catch (error) {
      // If update fails, send new message
      const response = await this.client.chat.postMessage({
        channel: agent.channelId,
        text: "Continuing response...",
        thread_ts: agent.threadTs,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: content.substring(0, 3000),
            },
          },
        ],
      });

      // Update last message timestamp
      agent.lastMessageTs = response.ts;
    }
  }

  /**
   * Format agent response for Slack
   */
  formatAgentResponse(agent, response, toolsUsed) {
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: response,
        },
      },
    ];

    // Add tool usage info if any
    if (toolsUsed.length > 0) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `🔧 Tools used: ${toolsUsed.join(", ")}`,
          },
        ],
      });
    }

    // Add completion status
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `✅ Completed by ${agent.name} (${agent.archetype})`,
        },
      ],
    });

    return {
      text: response.substring(0, 200) + "...", // Fallback text
      blocks,
    };
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    // Clear agent cache
    this.activeAgents.clear();
  }
}
