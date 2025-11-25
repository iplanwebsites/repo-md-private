import { Agent, createTool, VoltOpsClient } from "@voltagent/core";
import { VercelAIProvider } from "@voltagent/vercel-ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { getAiModelConfig } from "../chat/openaiClient.js";

// Create a custom Vercel AI provider with Helicone configuration
export function createHeliconeProvider() {
  return new VercelAIProvider({
    // Configure OpenAI with Helicone proxy
    headers: {
      "Helicone-Auth": `Bearer ${process.env.HELICONE_AUTH}`,
      "HTTP-Referer": process.env.API_BASE_URL || "https://api.repo.md",
      "X-Title": "Repo.md API",
    },
    // Override base URL to use Helicone proxy
    providerOptions: {
      openai: {
        baseURL: "https://oai.helicone.ai/v1",
        apiKey: process.env.OPENAI_API_KEY,
        organization: process.env.OPENAI_ORG,
        project: process.env.OPENAI_PROJECT,
      },
    },
  });
}

// Helper to create an agent with default configuration
export function createVoltAgent({
  name,
  instructions,
  model = "gpt-4.1-mini",
  tools = [],
  markdown = true,

  ...options
}) {
  const modelConfig = getAiModelConfig(model);

  return new Agent({
    name,
    instructions,
    llm: createHeliconeProvider(),
    model: openai(modelConfig.model),
    tools,
    markdown,
    memory: false, // Disable SQLite memory
    ...options,
  });
}

export const voltOpsClient = new VoltOpsClient({
  publicKey: process.env.VOLT_PUBLIC_KEY || "pk_test_dummy",
  secretKey: process.env.VOLT_SECRET_KEY || "sk_test_dummy",
});

// Export common system message helpers
export { systemMsg, userMsg } from "../chat/openaiClient.js";
