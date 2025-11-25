/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import OpenAI from "openai";
import { Agent } from "@voltagent/core";
import { VercelAIProvider } from "@voltagent/vercel-ai";
import { openai } from "@ai-sdk/openai";

import { getAiModelConfig } from "./aiModelConfigs.js";
import { generateAgentPrompt, systemMsg, userMsg } from "./aiPromptConfigs.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "nokey";
const HELICONE_AUTH =
  process.env.HELICONE_AUTH || "Bearer sk-helicone-wetNEED_SETUP";

// Legacy OpenAI client for backward compatibility
const llm = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: "https://oai.helicone.ai/v1",
  defaultHeaders: {
    "Helicone-User-Id": "repo-md-app",
    "Helicone-Auth": HELICONE_AUTH,
  },
});

// Create a Helicone-configured Vercel AI Provider
function createHeliconeProvider() {
  return new VercelAIProvider({
    headers: {
      "Helicone-Auth": HELICONE_AUTH,
      "Helicone-User-Id": "repo-md-app",
      "HTTP-Referer": process.env.API_BASE_URL || "https://api.repo.md",
      "X-Title": "Repo.md API",
    },
    providerOptions: {
      openai: {
        baseURL: "https://oai.helicone.ai/v1",
        apiKey: OPENAI_API_KEY,
        organization: process.env.OPENAI_ORG,
        project: process.env.OPENAI_PROJECT,
      },
    },
  });
}

// Create a simple Volt agent with default configuration
function createVoltAgent(options = {}) {
  const {
    name = "DefaultAgent",
    instructions = "You are a helpful AI assistant.",
    model = "gpt-4.1-mini",
    tools = [],
    ...restOptions
  } = options;

  const modelConfig = getAiModelConfig(model);

  return new Agent({
    name,
    instructions,
    llm: createHeliconeProvider(),
    model: openai(modelConfig.model),
    tools,
    markdown: true,
    memory: false,
    ...restOptions,
  });
}

// Wrapper to make Volt agent compatible with OpenAI-style calls
class VoltCompatibleClient {
  constructor() {
    this.chat = {
      completions: {
        create: async (params) => {
          const {
            model = "gpt-4.1-mini",
            messages = [],
            temperature = 0.7,
            max_tokens,
            tools,
            tool_choice,
            stream = false,
            ...otherParams
          } = params;

          // Extract system message if present
          const systemMessages = messages.filter((m) => m.role === "system");
          const instructions =
            systemMessages.length > 0
              ? systemMessages.map((m) => m.content).join("\n\n")
              : "You are a helpful AI assistant.";

          // Create agent with tools if provided
          const agent = createVoltAgent({
            name: "CompatibilityAgent",
            instructions,
            model,
            tools: tools ? this._convertOpenAITools(tools) : [],
            memory: false, // Disable SQLite memory
          });

          // Build conversation from messages
          const conversation = messages
            .filter((m) => m.role !== "system")
            .map((m) => {
              if (m.role === "user") return `User: ${m.content}`;
              if (m.role === "assistant") return `Assistant: ${m.content}`;
              if (m.role === "function" || m.role === "tool") {
                return `Tool ${m.name || "result"}: ${m.content}`;
              }
              return "";
            })
            .filter((text) => text)
            .join("\n");

          // Handle streaming
          if (stream) {
            return this._createStreamResponse(agent, conversation, {
              temperature,
              maxTokens: max_tokens,
            });
          } else {
            return this._createNonStreamResponse(agent, conversation, {
              temperature,
              maxTokens: max_tokens,
            });
          }
        },
      },
      // Add other OpenAI endpoints as needed
    };

    // Audio endpoints (passthrough to original client for now)
    this.audio = llm.audio;
  }

  _convertOpenAITools(openAITools) {
    // This would need proper implementation to convert OpenAI tool format to Volt format
    // For now, return empty array
    console.warn("Tool conversion not yet implemented in VoltCompatibleClient");
    return [];
  }

  async _createNonStreamResponse(agent, conversation, options) {
    const response = await agent.generateText(conversation, {
      provider: options,
    });

    // Format response to match OpenAI structure
    return {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: agent.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: response.text,
          },
          finish_reason: "stop",
        },
      ],
      usage: response.usage
        ? {
            prompt_tokens: response.usage.promptTokens,
            completion_tokens: response.usage.completionTokens,
            total_tokens: response.usage.totalTokens,
          }
        : undefined,
    };
  }

  async *_createStreamResponse(agent, conversation, options) {
    const response = await agent.streamText(conversation, {
      provider: options,
    });

    // Convert Volt stream to OpenAI stream format
    for await (const chunk of response.textStream) {
      yield {
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: agent.model,
        choices: [
          {
            index: 0,
            delta: {
              content: chunk,
            },
            finish_reason: null,
          },
        ],
      };
    }

    // Final chunk
    yield {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: agent.model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "stop",
        },
      ],
    };
  }
}

// Create a Volt-compatible client that mimics OpenAI interface
const voltLLM = new VoltCompatibleClient();

// Export everything - both legacy and new
export {
  llm, // Legacy OpenAI client
  voltLLM, // Volt-compatible client
  createVoltAgent, // Direct Volt agent creation
  createHeliconeProvider, // Provider creation
  getAiModelConfig,
  generateAgentPrompt,
  systemMsg,
  userMsg,
};
