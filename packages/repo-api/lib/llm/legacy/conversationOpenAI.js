import OpenAI from "openai";
import { ObjectId } from "mongodb";
import { db } from "../../db.js";

// Use OpenAI's new Responses API when available, fallback to completions
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://oai.helicone.ai/v1",
  defaultHeaders: {
    "Helicone-User-Id": "repo-md-llm",
    "Helicone-Auth":
      process.env.HELICONE_AUTH ||
      "Bearer sk-helicone-wetdwuy-gjnethy-vxstiti-me3vmxy",
  },
});

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

  // Get system prompt based on agent type
  const systemPrompt = await getSystemPrompt(conversation);

  // Prepare messages for OpenAI
  const messages = [
    { role: "system", content: systemPrompt },
    ...conversation.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  // Call OpenAI
  const completion = await openai.chat.completions.create({
    model: conversation.agentConfig?.model || "gpt-4.1-mini",
    messages,
    tools: tools.length > 0 ? tools : undefined,
    temperature: conversation.agentConfig?.temperature || 0.7,
    max_tokens: conversation.agentConfig?.maxTokens || 4000,
  });

  const assistantMessage = completion.choices[0].message;

  // Handle tool calls if any
  if (assistantMessage.tool_calls) {
    for (const toolCall of assistantMessage.tool_calls) {
      const result = await executeToolCall(toolCall, conversationId);
      conversation.messages.push({
        role: "function",
        name: toolCall.function.name,
        content: JSON.stringify(result),
        timestamp: new Date(),
      });
    }
  }

  // Add assistant message
  conversation.messages.push({
    role: "assistant",
    content: assistantMessage.content,
    tool_calls: assistantMessage.tool_calls,
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
    content: assistantMessage.content,
    toolCalls: assistantMessage.tool_calls,
    usage: completion.usage,
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

  const systemPrompt = await getSystemPrompt(conversation);

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversation.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  // Stream from OpenAI
  const stream = await openai.chat.completions.create({
    model: conversation.agentConfig?.model || "gpt-4.1-mini",
    messages,
    tools: tools.length > 0 ? tools : undefined,
    temperature: conversation.agentConfig?.temperature || 0.7,
    max_tokens: conversation.agentConfig?.maxTokens || 4000,
    stream: true,
  });

  let fullContent = "";
  let toolCalls = [];

  for await (const chunk of stream) {
    const delta = chunk.choices[0].delta;

    if (delta.content) {
      fullContent += delta.content;
      yield { type: "content", content: delta.content };
    }

    if (delta.tool_calls) {
      // Handle streaming tool calls
      for (const toolCall of delta.tool_calls) {
        if (!toolCalls[toolCall.index]) {
          toolCalls[toolCall.index] = {
            id: toolCall.id,
            type: "function",
            function: { name: "", arguments: "" },
          };
        }

        if (toolCall.function?.name) {
          toolCalls[toolCall.index].function.name = toolCall.function.name;
        }

        if (toolCall.function?.arguments) {
          toolCalls[toolCall.index].function.arguments +=
            toolCall.function.arguments;
        }
      }
    }
  }

  // Execute tool calls if any
  if (toolCalls.length > 0) {
    for (const toolCall of toolCalls) {
      const result = await executeToolCall(toolCall, conversationId);
      yield {
        type: "tool_result",
        tool: toolCall.function.name,
        result,
      };

      conversation.messages.push({
        role: "function",
        name: toolCall.function.name,
        content: JSON.stringify(result),
        timestamp: new Date(),
      });
    }
  }

  // Save assistant message
  conversation.messages.push({
    role: "assistant",
    content: fullContent,
    tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
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
 * Get system prompt based on agent type
 */
async function getSystemPrompt(conversation) {
  const { getAgent } = await import("./agents/index.js");
  const agent = getAgent(conversation.agentType);
  return agent.getSystemPrompt(conversation.context);
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
