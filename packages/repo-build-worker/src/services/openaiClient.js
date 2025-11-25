/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import OpenAI from "openai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

//import { getAiModelConfig } from "./aiModelConfigs.js";
//import { getAiPromptConfig, wrapInSystemUserMsg } from "./aiPromptConfigs.js";

// Debug: Log API key status
console.log(
  `[openaiClient.js] OPENAI_API_KEY loaded: ${process.env.OPENAI_API_KEY ? "YES" : "NO"}`
);
if (process.env.OPENAI_API_KEY) {
  console.log(
    `[openaiClient.js] API Key length: ${process.env.OPENAI_API_KEY.length}`
  );
}

// https://us.helicone.ai/dashboard

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://oai.helicone.ai/v1",
  defaultHeaders: {
    "Helicone-User-Id": "repo-md-app", // Add this header
    "Helicone-Auth": "Bearer sk-helicone-wetNEED_SETUP", // "Bearer sk-helicone-wetdwuy-gjnethy-vxstiti-me3vmxy",
  },
});

const llm = openai;

export { openai, llm };
// import {  llm,  getAiModelConfig,  getAiPromptConfig } from
