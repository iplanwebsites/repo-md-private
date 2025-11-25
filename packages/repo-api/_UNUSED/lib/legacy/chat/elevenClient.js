/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import OpenAI from "openai";

const ELEVEN_KEY = process.env.ELEVEN_KEY;

import { ElevenLabsClient } from "elevenlabs";

const client = new ElevenLabsClient({
  apiKey: ELEVEN_KEY,
});

export default llm;
