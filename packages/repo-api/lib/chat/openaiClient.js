/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import OpenAI from "openai";

import { getAiModelConfig } from "./aiModelConfigs.js";
import { generateAgentPrompt, systemMsg, userMsg } from "./aiPromptConfigs.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "nokey";

// https://us.helicone.ai/dashboard

const llm = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: "https://oai.helicone.ai/v1",
  defaultHeaders: {
    "Helicone-User-Id": "repo-md-app", // Add this header
    "Helicone-Auth": "Bearer sk-helicone-wetNEED_SETUP", // "Bearer sk-helicone-wetdwuy-gjnethy-vxstiti-me3vmxy",
  },
});

export { llm, getAiModelConfig, generateAgentPrompt, systemMsg, userMsg };
// import {  llm,  getAiModelConfig,  getAiPromptConfig } from
