/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import OpenAI from "openai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

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

// Create OpenAI client only if API key is available
// This allows the server to start without OpenAI for testing
let openai = null;
let llm = null;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: "https://oai.helicone.ai/v1",
    defaultHeaders: {
      "Helicone-User-Id": "repo-md-app",
      "Helicone-Auth": "Bearer sk-helicone-wetNEED_SETUP",
    },
  });
  llm = openai;
} else {
  console.warn('[openaiClient.js] WARNING: OPENAI_API_KEY not set. AI features will be disabled.');
  // Create a mock client that throws helpful errors
  const mockHandler = {
    get(target, prop) {
      if (prop === 'chat') {
        return new Proxy({}, {
          get(target, method) {
            return () => {
              throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY environment variable.');
            };
          }
        });
      }
      return undefined;
    }
  };
  openai = new Proxy({}, mockHandler);
  llm = openai;
}

export { openai, llm };
