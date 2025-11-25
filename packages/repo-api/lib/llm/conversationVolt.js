import { Agent, createTool } from "@voltagent/core";
import { VercelAIProvider } from "@voltagent/vercel-ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { db } from "../../db.js";
import { createHeliconeProvider } from "../volt/voltAgentConfig.js";

// Check if Responses API is available
const useResponsesAPI = process.env.USE_OPENAI_RESPONSES_API === "true";

/**
 * Start a new conversation
 */
export async function startConversation({
  userId = null,
  agentType,
  projectId = null,
  orgId = null,
  sessionId = null,
  initialContext = {},
}) {
  // Import agent modules
  const { getAgent, buildAgentContext } = await import("./agents/index.js");

  // Get agent configuration
  const agent = getAgent(agentType);

  // Build context based on agent type
  const context = await buildAgentContext(agentType, {
    userId,
    projectId,
    orgId,
    sessionId,
    ...initialContext,
  });

  const conversation = {
    userId: userId ? new ObjectId(userId) : null,
    orgId: orgId ? new ObjectId(orgId) : null,
    projectId: projectId ? new ObjectId(projectId) : null,
    sessionId,
    agentType,
    agentConfig: {
      model: agent.modelConfig.model,
      temperature: agent.modelConfig.temperature,
      maxTokens: agent.modelConfig.maxTokens,
    },
    isPublic: agent.auth === "none",
    context,
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.convos.insertOne(conversation);
  return result.insertedId.toString();
}

/**
 * Create Volt Agent for conversation
 */
async function createConversationAgent(conversation, tools = []) {
  const { getAgent } = await import("./agents/index.js");
  const agentConfig = getAgent(conversation.agentType);

  // Get system prompt
  const systemPrompt = agentConfig.getSystemPrompt(conversation.context);

  // Convert tools to Volt format
  const voltTools = await convertToolsToVolt(
    tools,
    conversation._id.toString()
  );

  // Create agent with conversation config
  const agent = new Agent({
    name: `Conversation-${conversation.agentType}`,
    instructions: systemPrompt,
    llm: createHeliconeProvider(),
    model: openai(conversation.agentConfig?.model || "gpt-4.1-mini"),
    tools: voltTools,
    markdown: true,
    memory: false, // Disable SQLite memory
  });

  return agent;
}

/**
 * Convert OpenAI-style tools to Volt Agent tools
 */
async function convertToolsToVolt(tools, conversationId) {
  if (!tools || tools.length === 0) return [];

  const voltTools = [];

  for (const tool of tools) {
    const toolDef = tool.function || tool;

    // Parse parameters to Zod schema
    let parameters = z.object({});
    if (toolDef.parameters && toolDef.parameters.properties) {
      const zodSchema = {};
      for (const [key, prop] of Object.entries(toolDef.parameters.properties)) {
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
      parameters = z.object(zodSchema);
    }

    // Create Volt tool with execution
    const voltTool = createTool({
      name: toolDef.name,
      description: toolDef.description,
      parameters,
      execute: async (args) => {
        return await executeToolCall(
          {
            function: {
              name: toolDef.name,
              arguments: JSON.stringify(args),
            },
          },
          conversationId
        );
      },
    });

    voltTools.push(voltTool);
  }

  return voltTools;
}

/**
 * Send a message and get response (non-streaming)
 */
export async function sendMessage(conversationId, message, tools = []) {
  const conversation = await db.convos.findOne({
    _id: new ObjectId(conversationId),
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Add user message
  conversation.messages.push({
    role: "user",
    content: message,
    timestamp: new Date(),
  });

  // Create agent for this conversation
  const agent = await createConversationAgent(conversation, tools);

  // Build conversation text from messages
  const conversationText = conversation.messages
    .map((m) => {
      if (m.role === "user") {
        return `User: ${m.content}`;
      } else if (m.role === "assistant") {
        return `Assistant: ${m.content}`;
      } else if (m.role === "function") {
        return `Tool ${m.name}: ${m.content}`;
      }
      return "";
    })
    .join("\n");

  // Get response from Volt Agent
  const response = await agent.generateText(conversationText, {
    provider: {
      temperature: conversation.agentConfig?.temperature || 0.7,
      maxTokens: conversation.agentConfig?.maxTokens || 4000,
    },
  });

  // Add assistant message
  conversation.messages.push({
    role: "assistant",
    content: response.text,
    timestamp: new Date(),
  });

  // Update conversation in DB
  await db.convos.updateOne(
    { _id: new ObjectId(conversationId) },
    {
      $set: {
        messages: conversation.messages,
        updatedAt: new Date(),
      },
    }
  );

  return {
    content: response.text,
    usage: response.usage
      ? {
          prompt_tokens: response.usage.promptTokens,
          completion_tokens: response.usage.completionTokens,
          total_tokens: response.usage.totalTokens,
        }
      : undefined,
  };
}

/**
 * Stream a response using SSE
 */
export async function* streamResponse(conversationId, message, tools = []) {
  const conversation = await db.convos.findOne({
    _id: new ObjectId(conversationId),
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Add user message
  conversation.messages.push({
    role: "user",
    content: message,
    timestamp: new Date(),
  });

  // Create agent for this conversation
  const agent = await createConversationAgent(conversation, tools);

  // Build conversation text from messages
  const conversationText = conversation.messages
    .map((m) => {
      if (m.role === "user") {
        return `User: ${m.content}`;
      } else if (m.role === "assistant") {
        return `Assistant: ${m.content}`;
      } else if (m.role === "function") {
        return `Tool ${m.name}: ${m.content}`;
      }
      return "";
    })
    .join("\n");

  // Stream from Volt Agent
  const response = await agent.streamText(conversationText, {
    provider: {
      temperature: conversation.agentConfig?.temperature || 0.7,
      maxTokens: conversation.agentConfig?.maxTokens || 4000,
    },
  });

  let fullContent = "";
  let toolResults = [];

  // Check if we have fullStream support
  if (response.fullStream) {
    for await (const chunk of response.fullStream) {
      switch (chunk.type) {
        case "text-delta":
          fullContent += chunk.textDelta;
          yield { type: "content", content: chunk.textDelta };
          break;

        case "tool-call":
          yield {
            type: "tool_call",
            tool: chunk.toolName,
          };
          break;

        case "tool-result":
          const result = chunk.result || chunk.output;
          toolResults.push({
            name: chunk.toolName,
            result: result,
          });
          yield {
            type: "tool_result",
            tool: chunk.toolName,
            result,
          };

          // Add tool result to messages
          conversation.messages.push({
            role: "function",
            name: chunk.toolName,
            content: JSON.stringify(result),
            timestamp: new Date(),
          });
          break;
      }
    }
  } else {
    // Fallback to textStream
    for await (const textChunk of response.textStream) {
      fullContent += textChunk;
      yield { type: "content", content: textChunk };
    }
  }

  // Save assistant message
  conversation.messages.push({
    role: "assistant",
    content: fullContent,
    timestamp: new Date(),
  });

  // Update conversation
  await db.convos.updateOne(
    { _id: new ObjectId(conversationId) },
    {
      $set: {
        messages: conversation.messages,
        updatedAt: new Date(),
      },
    }
  );

  yield { type: "done" };
}

/**
 * Get conversation
 */
export async function getConversation(conversationId, userId) {
  return await db.convos.findOne({
    _id: new ObjectId(conversationId),
    userId: new ObjectId(userId),
  });
}

/**
 * Delete conversation
 */
export async function deleteConversation(conversationId, userId) {
  const result = await db.convos.deleteOne({
    _id: new ObjectId(conversationId),
    userId: new ObjectId(userId),
  });

  return result.deletedCount > 0;
}

/**
 * List conversations
 */
export async function listConversations(userId, type = null) {
  const query = { userId: new ObjectId(userId) };
  if (type) query.type = type;

  return await db.convos
    .find(query)
    .sort({ updatedAt: -1 })
    .limit(50)
    .toArray();
}

/**
 * Execute a tool call
 */
async function executeToolCall(toolCall, conversationId) {
  const functionName = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments);

  // Load tool modules dynamically
  const toolModules = {
    // File operations
    create_file: "./tools/fileTools.js",
    update_file: "./tools/fileTools.js",
    delete_file: "./tools/fileTools.js",
    read_file: "./tools/fileTools.js",

    // GitHub operations
    create_github_repo: "./tools/githubTools.js",
    commit_to_github: "./tools/githubTools.js",

    // Search operations
    search_codebase: "./tools/searchTools.js",
    search_documentation: "./tools/searchTools.js",
  };

  const modulePath = toolModules[functionName];
  if (!modulePath) {
    throw new Error(`Unknown tool: ${functionName}`);
  }

  const module = await import(modulePath);
  const tool = module[functionName];

  if (!tool) {
    throw new Error(`Tool not found: ${functionName}`);
  }

  // Execute with conversation context
  return await tool(args, { conversationId });
}
