import { Agent, createTool } from "@voltagent/core";
import { VercelAIProvider } from "@voltagent/vercel-ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { Transform } from "stream";
import { ObjectId } from "mongodb";
import { db } from "../../db.js";
import {
  NEW_PROJECT_SYSTEM_PROMPT,
  projectBriefTools,
  getConversationContext,
} from "./newProjectSystem.js";
import { MESSAGE_ROLES, addMessageToConvo } from "./convoSchema.js";
import { createHeliconeProvider } from "../volt/voltAgentConfig.js";

/**
 * Service for handling streaming AI responses in project generation
 */
export class StreamingProjectGenerationService {
  constructor(openaiApiKey) {
    this.openaiApiKey = openaiApiKey;
    this.isEnabled = openaiApiKey && openaiApiKey !== "fake-key";

    if (!this.isEnabled) {
      console.log("⚠️ OpenAI API key not provided - streaming disabled");
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
          zodSchema.title = z.string().describe("Project title");
          zodSchema.description = z.string().describe("Project description");
          zodSchema.category = z.string().describe("Project category");
          zodSchema.technologies = z
            .array(z.string())
            .describe("Technologies to use");
          zodSchema.features = z.array(z.string()).describe("Key features");
          zodSchema.userTypes = z
            .array(z.string())
            .describe("Target user types");
          zodSchema.complexity = z
            .enum(["simple", "moderate", "complex"])
            .describe("Project complexity");
          zodSchema.timeline = z.string().describe("Estimated timeline");
          zodSchema.specialRequirements = z
            .array(z.string())
            .optional()
            .describe("Special requirements");
        } else {
          // Generic parameter parsing
          for (const [key, prop] of Object.entries(
            toolDef.parameters.properties
          )) {
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
                schema = z.array(z.any());
                break;
              case "object":
                schema = z.object({});
                break;
              default:
                schema = z.any();
            }

            if (prop.description) {
              schema = schema.describe(prop.description);
            }

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
          return args;
        },
      });
    });
  }

  /**
   * Create a Volt Agent for project generation
   */
  createProjectGenerationAgent(convo) {
    // Prepare system prompt with context
    const systemPrompt =
      NEW_PROJECT_SYSTEM_PROMPT +
      "\n\n" +
      getConversationContext(convo.messages);

    const agent = new Agent({
      name: "ProjectGenerator",
      instructions: systemPrompt,
      llm: createHeliconeProvider(),
      model: openai(convo.settings.model || "gpt-4.1-mini"),
      tools: this.convertProjectBriefTools(),
      markdown: true,
      memory: false, // Disable SQLite memory
    });

    return agent;
  }

  /**
   * Continue conversation with streaming response
   */
  async streamConversation(conversationId, userMessage) {
    if (!this.isEnabled) {
      throw new Error("OpenAI client not initialized");
    }

    // Fetch conversation
    const convo = await db.convos.findOne({
      _id: new ObjectId(conversationId),
      status: "active",
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

    // Save the updated conversation with user message
    await db.convos.updateOne(
      { _id: convo._id },
      { $set: { messages: convo.messages } }
    );

    // Create agent for this conversation
    const agent = this.createProjectGenerationAgent(convo);

    // Build conversation text from messages
    const conversationText = convo.messages
      .map((msg) => {
        if (msg.role === MESSAGE_ROLES.USER) {
          return `User: ${msg.content}`;
        } else if (msg.role === MESSAGE_ROLES.ASSISTANT) {
          return `Assistant: ${msg.content}`;
        } else if (msg.role === MESSAGE_ROLES.FUNCTION) {
          return `Function ${msg.name}: ${JSON.stringify(
            msg.functionCall?.arguments || {}
          )}`;
        }
        return "";
      })
      .filter((text) => text)
      .join("\n");

    // Get streaming response from Volt Agent
    const response = await agent.streamText(conversationText, {
      provider: {
        temperature: convo.settings.temperature,
        maxTokens: convo.settings.maxTokens,
      },
    });

    // Create transform stream for SSE format
    const sseTransform = new StreamingSSETransform(convo._id);

    return {
      response,
      sseTransform,
      convoId: convo._id,
    };
  }

  /**
   * Process streaming response and update conversation
   */
  async processStreamingResponse(convoId, fullContent, toolCalls, tokens) {
    try {
      const convo = await db.convos.findOne({ _id: convoId });
      if (!convo) return;

      // Add assistant message
      const assistantMsg = {
        role: MESSAGE_ROLES.ASSISTANT,
        content: fullContent,
        tokens,
      };

      // Handle tool calls
      if (toolCalls && toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          assistantMsg.functionCall = {
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments),
          };

          // Handle create_project_brief specifically
          if (toolCall.function.name === "create_project_brief") {
            const functionArgs = JSON.parse(toolCall.function.arguments);
            convo.projectBrief = functionArgs;
            convo.status = "completed";
            convo.completedAt = new Date();
          }
        }
      }

      addMessageToConvo(convo, assistantMsg);

      // Update conversation duration
      const duration = (new Date() - new Date(convo.createdAt)) / 1000;
      convo.metrics.duration = duration;

      // Save updated conversation
      await db.convos.updateOne({ _id: convo._id }, { $set: convo });

      return {
        success: true,
        conversationComplete: convo.status === "completed",
        projectBrief: convo.projectBrief,
      };
    } catch (error) {
      console.error("Error processing streaming response:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

/**
 * Transform stream to Server-Sent Events format for Volt Agent
 */
export class StreamingSSETransform extends Transform {
  constructor(convoId) {
    super({ objectMode: false }); // Change to false for string output
    this.convoId = convoId;
    this.fullContent = "";
    this.toolCalls = [];
    this.currentToolCall = null;
    this.usage = null;
  }

  async processVoltStream(response) {
    try {
      // Check if we have fullStream support
      if (response.fullStream) {
        for await (const chunk of response.fullStream) {
          switch (chunk.type) {
            case "text-delta":
              this.fullContent += chunk.textDelta;
              this.push(
                `data: ${JSON.stringify({
                  type: "content",
                  content: chunk.textDelta,
                })}\n\n`
              );
              break;

            case "tool-call":
              this.push(
                `data: ${JSON.stringify({
                  type: "tool_call",
                  toolCall: {
                    name: chunk.toolName,
                    arguments: "",
                  },
                })}\n\n`
              );
              break;

            case "tool-result":
              // Store tool call result
              this.toolCalls.push({
                function: {
                  name: chunk.toolName,
                  arguments: JSON.stringify(chunk.result || chunk.output || {}),
                },
              });

              this.push(
                `data: ${JSON.stringify({
                  type: "tool_result",
                  toolCall: {
                    name: chunk.toolName,
                    result: chunk.result || chunk.output,
                  },
                })}\n\n`
              );
              break;

            case "finish":
              this.usage = chunk.usage;
              this.push(
                `data: ${JSON.stringify({
                  type: "finish",
                  finish_reason: "stop",
                  usage: chunk.usage,
                })}\n\n`
              );
              break;
          }
        }
      } else {
        // Fallback to textStream
        for await (const textChunk of response.textStream) {
          this.fullContent += textChunk;
          this.push(
            `data: ${JSON.stringify({
              type: "content",
              content: textChunk,
            })}\n\n`
          );
        }

        // Send finish event
        this.push(
          `data: ${JSON.stringify({
            type: "finish",
            finish_reason: "stop",
          })}\n\n`
        );
      }

      // Send complete event
      this.push(
        `data: ${JSON.stringify({
          type: "complete",
          fullContent: this.fullContent,
          toolCalls: this.toolCalls,
          convoId: this.convoId.toString(),
        })}\n\n`
      );

      // Send SSE termination
      this.push("data: [DONE]\n\n");
    } catch (error) {
      this.push(
        `data: ${JSON.stringify({
          type: "error",
          error: error.message,
        })}\n\n`
      );
      this.push("data: [DONE]\n\n");
    }
  }
}

/**
 * Helper to create SSE response headers
 */
export function getSSEHeaders() {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Disable Nginx buffering
  };
}

/**
 * Helper to create initial SSE message
 */
export function createSSEMessage(data) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Error handler for streaming
 */
export function handleStreamError(error, res) {
  console.error("Stream error:", error);

  if (!res.headersSent) {
    res.status(500).json({ error: error.message });
  } else {
    // If headers already sent, send error as SSE
    res.write(
      createSSEMessage({
        type: "error",
        error: error.message,
      })
    );
    res.write("data: [DONE]\n\n");
    res.end();
  }
}
