/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

/**
 * Utility function to get an ephemeral OpenAI token for real-time sessions
 * @param {Object} options Configuration options
 * @param {string} options.systemPrompt Custom system prompt for the AI
 * @param {boolean} options.enableTurns Enable turn-based conversation (default: true)
 * @param {boolean} options.enableAudio Enable audio modality (default: true)
 * @param {string} options.voice Voice to use (default: 'coral')
 * @param {Object} options.turnDetection Custom turn detection settings
 * @param {Array} options.tools Array of tool objects for the AI to use
 * @returns {Promise<string|null>} The client secret value or null if error
 */

import { getAiModelConfig } from "../chat/openaiClient.js";

export async function getEphemeralOpenAiToken({
  systemPrompt = "I'm a helpful AI assistant.",
  enableTurns = true,
  enableAudio = true,
  voice = "coral",
  turnDetection = null,
  tools = [],
  tool_choice = "auto", //not auto
} = {}) {
  // Default turn detection settings
  const DEFAULT_TURN_DETECTION = {
    type: "server_vad",
    threshold: 0.5,
    prefix_padding_ms: 600,
    silence_duration_ms: 1000,
    create_response: true,
  };

  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY || "nokey"}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // odel: "gpt-4.1-realtime-preview", //will defer to latest. // "gpt-4.1-realtime-preview-2024-12-17",
          ...getAiModelConfig("realtimeActivity"),
          voice,
          modalities: enableAudio ? ["audio", "text"] : ["text"],
          instructions: systemPrompt,
          input_audio_transcription: {
            ...getAiModelConfig("realtimeActivityTranscribe"),
            //model: "whisper-1",
            //language: "fr",
          },
          tool_choice: tools.length > 0 ? tool_choice : undefined,
          tools: tools.length > 0 ? tools : undefined,
          turn_detection: enableTurns
            ? turnDetection || DEFAULT_TURN_DETECTION
            : null,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data?.client_secret?.value || null;
  } catch (error) {
    console.error("Error getting OpenAI token:", error);
    return null;
  }
}

// Usage examples:
/*
  // 1. Basic usage with defaults
  const token1 = await getEphemeralOpenAiToken();
  
  // 2. Custom system prompt only
  const token2 = await getEphemeralOpenAiToken({
    systemPrompt: "I'm a French-speaking AI assistant with a Quebec accent."
  });
  
  // 3. Full configuration
  const token3 = await getEphemeralOpenAiToken({
    systemPrompt: "I'm a movie expert AI assistant.",
    enableTurns: true,
    enableAudio: true,
    voice: "coral",
    tools: [
      {
        name: "get_movie_info",
        type: "function",
        description: "Get information about a movie",
        parameters: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Movie title"
            }
          },
          required: ["title"]
        }
      }
    ],
    turnDetection: {
      type: "server_vad",
      threshold: 0.6,
      prefix_padding_ms: 800,
      silence_duration_ms: 1200,
      create_response: true
    }
  });
  
  // 4. Text-only mode
  const token4 = await getEphemeralOpenAiToken({
    systemPrompt: "I'm a coding assistant.",
    enableAudio: false,
    enableTurns: false
  });
  
  */
