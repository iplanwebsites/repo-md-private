/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import { llm } from "./chat/openaiClient.js";

/**
 * Generate an image using DALL-E AI model
 * @param {Object} params - Parameters for image generation
 * @param {string} params.prompt - The prompt to generate the image from
 * @param {string} [params.model="dall-e-3"] - The model to use (default: dall-e-3)
 * @param {string} [params.size="1024x1024"] - Image size (default: 1024x1024)
 * @param {string} [params.quality="standard"] - Image quality (standard or hd)
 * @param {number} [params.n=1] - Number of images to generate
 * @param {string} [params.style="vivid"] - Image style (vivid or natural)
 * @returns {Promise<Object>} - The generated image data
 */
export const dalle = async (params = {}) => {
  const {
    prompt,
    model = "dall-e-3",
    size = "1024x1024",
    quality = "standard",
    n = 1,
    style = "vivid",
  } = params;

  if (!prompt) {
    throw new Error("Prompt is required for image generation");
  }

  try {
    const response = await llm.images.generate({
      model,
      prompt,
      n,
      size,
      quality,
      style,
    });

    return {
      data: response.data,
      created: response.created,
      metadata: {
        model,
        prompt,
      }
    };
  } catch (error) {
    console.error("DALL-E image generation error:", error.message);
    throw new Error(`Failed to generate image: ${error.message}`);
  }
};

export default { dalle };