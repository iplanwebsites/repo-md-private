// clip-embedder.js
import {
  AutoTokenizer,
  CLIPTextModelWithProjection,
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
  dot,
  softmax,
} from "@huggingface/transformers";
import crypto from "crypto";

// Use MobileCLIP model for good performance/quality trade-off
//  'Xenova/mobileclip_s2';// works!
const MODEL_ID = "Xenova/mobileclip_s0";

// Create singleton instances with lazy loading
let tokenizer = null;
let textModel = null;
let processor = null;
let visionModel = null;
let isInitializing = false;
let initPromise = null;
let debug = false;

/**
 * Log a message if debug mode is enabled
 * @param {string} message - The message to log
 * @param {any} data - Optional data to log
 * @param {string} emoji - Optional emoji prefix for log
 */
function log(message, data = null, emoji = "🔍") {
  if (!debug) return;

  const timestamp = new Date().toISOString();
  if (data !== null) {
    console.log(`${emoji} [CLIP ${timestamp}] ${message}`);
    console.dir(data, { depth: null, colors: true });
  } else {
    console.log(`${emoji} [CLIP ${timestamp}] ${message}`);
  }
}

/**
 * Initialize models if they haven't been initialized yet
 * @returns {Promise} A promise that resolves when the models are loaded
 */
async function initialize() {
  // If already initialized, return immediately
  if (tokenizer && textModel && processor && visionModel) {
    log("Models already initialized, reusing existing models");
    return { tokenizer, textModel, processor, visionModel };
  }

  // If initialization is in progress, return the existing promise
  if (initPromise) {
    log("Models initialization already in progress, waiting for completion");
    return initPromise;
  }

  // Start initialization
  isInitializing = true;
  log("Starting models initialization");
  console.log(`Initializing CLIP models (${MODEL_ID})...`);

  console.log(`This can take a while, please wait...`);

  const startTime = Date.now();

  // Create and store the initialization promise
  initPromise = Promise.all([
    AutoTokenizer.from_pretrained(MODEL_ID),
    CLIPTextModelWithProjection.from_pretrained(MODEL_ID),
    AutoProcessor.from_pretrained(MODEL_ID),
    CLIPVisionModelWithProjection.from_pretrained(MODEL_ID),
  ])
    .then(([_tokenizer, _textModel, _processor, _visionModel]) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      log(`Models initialization completed in ${duration}s`, {
        modelId: MODEL_ID,
        initializationTime: duration,
      });
      console.log(`CLIP models initialized successfully in ${duration}s`);

      // Store the models
      tokenizer = _tokenizer;
      textModel = _textModel;
      processor = _processor;
      visionModel = _visionModel;

      isInitializing = false;
      return { tokenizer, textModel, processor, visionModel };
    })
    .catch((error) => {
      log("Models initialization failed", {
        error: error.message,
        stack: error.stack,
      });
      console.error("Failed to initialize CLIP models:", error);
      isInitializing = false;
      initPromise = null;
      throw error;
    });

  return initPromise;
}

/**
 * Generate embedding for text
 * @param {string} text - The text to embed
 * @returns {Promise<Array<number>>} - A promise resolving to the embedding
 */
async function textEmbedding(text) {
  log(
    `Getting text embedding for: "${text.substring(0, 100)}${text.length > 100 ? "..." : ""}"`,
    null,
    "📝"
  );

  // Ensure models are initialized
  if (!tokenizer || !textModel) {
    log("Models not initialized, initializing now", null, "⚠️");
    await initialize();
  }

  const startTime = Date.now();

  try {
    // Run tokenization
    const inputs = tokenizer([text], {
      padding: "max_length",
      truncation: true,
    });

    // Compute text embeddings
    const { text_embeds } = await textModel(inputs);
    const normalized_text_embeds = text_embeds.normalize().tolist();

    const duration = ((Date.now() - startTime) / 1000).toFixed(3);
    log(`Text embedding generated in ${duration}s`, null, "⏱️");

    // Get the first embedding (since we only passed one text)
    const embedding = normalized_text_embeds[0];

    log(
      `Text embedding processed successfully`,
      {
        dimensions: embedding.length,
        processingTime: duration,
        sample: `[${embedding
          .slice(0, 3)
          .map((v) => v.toFixed(4))
          .join(", ")}...]`,
      },
      "✅"
    );

    return embedding;
  } catch (error) {
    log(
      "Error generating text embedding",
      {
        error: error.message,
        stack: error.stack,
      },
      "❌"
    );
    console.error("❌ Failed to generate text embedding:", error);
    throw error;
  }
}

/**
 * Generate embedding for an image by URL
 * @param {string} url - The URL of the image to embed
 * @returns {Promise<Array<number>>} - A promise resolving to the embedding
 */
async function imageEmbeddingByUrl(url) {
  log(`Getting image embedding for URL: ${url}`, null, "🖼️");

  // Ensure models are initialized
  if (!processor || !visionModel) {
    log("Models not initialized, initializing now", null, "⚠️");
    await initialize();
  }

  const startTime = Date.now();

  try {
    // Read image from URL
    const image = await RawImage.read(url);

    // Process the image
    const image_inputs = await processor(image);

    // Compute vision embeddings
    const { image_embeds } = await visionModel(image_inputs);
    const normalized_image_embeds = image_embeds.normalize().tolist();

    const duration = ((Date.now() - startTime) / 1000).toFixed(3);
    log(`Image embedding generated in ${duration}s`, null, "⏱️");

    // Get the first embedding (since we only passed one image)
    const embedding = normalized_image_embeds[0];

    log(
      `Image embedding processed successfully`,
      {
        url,
        dimensions: embedding.length,
        processingTime: duration,
        sample: `[${embedding
          .slice(0, 3)
          .map((v) => v.toFixed(4))
          .join(", ")}...]`,
      },
      "✅"
    );

    return embedding;
  } catch (error) {
    log(
      "Error generating image embedding",
      {
        error: error.message,
        stack: error.stack,
      },
      "❌"
    );
    console.error("❌ Failed to generate image embedding:", error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two embeddings
 * @param {Array<number>} embA - First embedding
 * @param {Array<number>} embB - Second embedding
 * @returns {number} Cosine similarity score (-1 to 1)
 */
function cosineSimilarity(embA, embB) {
  return dot(embA, embB);
}

/**
 * Calculate probability scores between an image and multiple text options
 * @param {Array<number>} imageEmbedding - The image embedding
 * @param {Array<Array<number>>} textEmbeddings - Array of text embeddings
 * @returns {Array<number>} Array of probability scores (sums to 1)
 */
function calculateProbabilities(imageEmbedding, textEmbeddings) {
  // Compute similarity scores between image and each text
  const similarities = textEmbeddings.map(
    (textEmb) => 100 * dot(imageEmbedding, textEmb)
  );

  // Apply softmax to get probabilities
  return softmax(similarities);
}

/**
 * Process an image directly using the RawImage object
 * @param {Object} image - RawImage object from @huggingface/transformers
 * @returns {Promise<Array<number>>} - A promise resolving to the embedding
 */
async function processImage(image) {
  log(`Processing image directly with RawImage object`, null, "🖼️");

  // Ensure models are initialized
  if (!processor || !visionModel) {
    log("Models not initialized, initializing now", null, "⚠️");
    await initialize();
  }

  const startTime = Date.now();

  try {
    // Process the image
    const image_inputs = await processor(image);

    // Compute vision embeddings
    const { image_embeds } = await visionModel(image_inputs);
    const normalized_image_embeds = image_embeds.normalize().tolist();

    const duration = ((Date.now() - startTime) / 1000).toFixed(3);
    log(`Image embedding generated in ${duration}s`, null, "⏱️");

    // Get the first embedding (since we only passed one image)
    const embedding = normalized_image_embeds[0];

    log(
      `Image embedding processed successfully`,
      {
        dimensions: embedding.length,
        processingTime: duration,
        sample: `[${embedding
          .slice(0, 3)
          .map((v) => v.toFixed(4))
          .join(", ")}...]`,
      },
      "✅"
    );

    return embedding;
  } catch (error) {
    log(
      "Error generating image embedding from RawImage",
      {
        error: error.message,
        stack: error.stack,
      },
      "❌"
    );
    console.error(
      "❌ Failed to generate image embedding from RawImage:",
      error
    );
    throw error;
  }
}

export {
  textEmbedding,
  imageEmbeddingByUrl,
  cosineSimilarity,
  calculateProbabilities,
  processImage,
  initialize,
};

// Also export a default object for backward compatibility
export default {
  /**
   * Set debug mode
   * @param {boolean} enabled - Whether to enable debug mode
   */
  setDebug: (enabled) => {
    debug = enabled;
  },

  /**
   * Get embedding for an image by URL
   * @param {string} url - The URL of the image
   * @returns {Promise<Array<number>>} The embedding
   */
  imageEmbeddingByUrl,

  /**
   * Get embedding for text
   * @param {string} text - The text to embed
   * @returns {Promise<Array<number>>} The embedding
   */
  textEmbedding,

  /**
   * Calculate similarity between two embeddings
   * @param {Array<number>} embA - First embedding
   * @param {Array<number>} embB - Second embedding
   * @returns {number} Similarity score (-1 to 1)
   */
  cosineSimilarity,

  /**
   * Calculate probability scores between an image and multiple text options
   * @param {Array<number>} imageEmbedding - The image embedding
   * @param {Array<Array<number>>} textEmbeddings - Array of text embeddings
   * @returns {Array<number>} Array of probability scores (sums to 1)
   */
  calculateProbabilities,

  /**
   * Process an image directly using the RawImage object
   * @param {Object} image - RawImage object from @huggingface/transformers
   * @returns {Promise<Array<number>>} The embedding
   */
  processImage,

  /**
   * Initialize models
   * @returns {Promise} A promise that resolves when models are loaded
   */
  initialize,
};
