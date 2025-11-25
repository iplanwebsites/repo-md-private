/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

// lib/text2audio.js

import {
  llm,
  getAiModelConfig,
  getAiPromptConfig,
} from "./chat/openaiClient.js";
// Initialize OpenAI client
const openai = llm;

/**
 * Generates audio from text using OpenAI's TTS API
 *
 * @param {Object} options - Configuration options
 * @param {string} options.text - The text to convert to speech (max 4096 chars)
 * @param {string} options.voice - Voice to use (alloy, ash, coral, etc.)
 * @param {number} options.speed - Speed of speech (0.25 to 4.0)
 * @param {string} options.format - Audio format (mp3, opus, aac, flac, wav, pcm)
 * @returns {Promise<string>} - Base64 encoded audio data
 */
export const generateText2Audio = async ({
  text,
  voice = "Ash",
  speed = 1.0,
  format = "mp3",
}) => {
  try {
    // Validate input
    if (!text || text.trim() === "") {
      throw new Error("Text input is required");
    }

    if (text.length > 4096) {
      text = text.substring(0, 4096);
      console.warn("Text truncated to 4096 characters");
    }

    // Call OpenAI API to generate speech
    // https://platform.openai.com/docs/guides/text-to-speech
    const response = await openai.audio.speech.create({
      // mo "tts-1", //tts-1-hd model = better quality, slower
      ...getAiModelConfig("tts"),
      voice: voice,
      input: text,
      response_format: format,
      speed: speed,
    });

    // Convert the response to an ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();

    // Convert the ArrayBuffer to a base64 string for sending over the wire
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    return base64Audio;
  } catch (error) {
    console.error("Error generating audio:", error);
    throw error;
  }
};

/**
 * Utility function to create a data URL from base64 audio data
 *
 * @param {string} base64Audio - Base64 encoded audio data
 * @param {string} format - Audio format
 * @returns {string} - Data URL for the audio
 */
export const createAudioDataUrl = (base64Audio, format = "mp3") => {
  return `data:audio/${format};base64,${base64Audio}`;
};
