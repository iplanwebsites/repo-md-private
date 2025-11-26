// clip-embedder.js
import { pipeline } from "@huggingface/transformers";
import crypto from "crypto";

// Use MobileCLIP-S0 for faster inference and smaller model size
// Original model: https://huggingface.co/apple/MobileCLIP-S0
// JS Version: https://huggingface.co/Xenova/mobileclip_s0

const MOBILECLIP = "Xenova/mobileclip_s0"; // Faster and smaller model
const VIT_MODEL = "Xenova/vit-base-patch16-224"; // Alternative vision model (requires tokenizer)

// Use MobileCLIP as the default model for best speed/compatibility
const CLIP = MOBILECLIP;

/**
 * Image Embedder that utilizes a vision model for image embeddings
 * Uses a fast and lightweight model for creating embeddings from images
 */
class ImageEmbedder {
  constructor(options = {}) {
    this.model = null;
    this.isInitializing = false;
    this.initPromise = null;
    this.debug = options.debug || false;
    // Use a lightweight vision model compatible with the transformers.js library
    this.modelName = CLIP;
    this.sampleSize = 768; // Default embedding size
  }

  /**
   * Enable or disable debug mode
   * @param {boolean} enabled - Whether to enable debug mode
   */
  setDebug(enabled) {
    this.debug = enabled;
    this.log(`Debug mode ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Log a message if debug mode is enabled
   * @param {string} message - The message to log
   * @param {any} data - Optional data to log
   * @param {string} emoji - Optional emoji prefix for log
   */
  log(message, data = null, emoji = "🔍") {
    if (!this.debug) return;

    const timestamp = new Date().toISOString();
    if (data !== null) {
      console.log(`${emoji} [IMAGE ${timestamp}] ${message}`);
      console.dir(data, { depth: null, colors: true });
    } else {
      console.log(`${emoji} [IMAGE ${timestamp}] ${message}`);
    }
  }

  /**
   * Initialize the model if it hasn't been initialized yet
   * @returns {Promise} A promise that resolves when the model is loaded
   */
  async initialize() {
    // If already initialized, return immediately
    if (this.model) {
      this.log("Model already initialized, reusing existing model");
      return this.model;
    }

    // If initialization is in progress, return the existing promise
    if (this.initPromise) {
      this.log(
        "Model initialization already in progress, waiting for completion"
      );
      return this.initPromise;
    }

    // Start initialization
    this.isInitializing = true;
    this.log("Starting model initialization");
    console.log(`Initializing image embedding model (${this.modelName})...`);

    console.log(`This can take a while, please wait...`);

    const startTime = Date.now();

    // Create and store the initialization promise
    // Using feature-extraction for image embeddings
    this.initPromise = pipeline("feature-extraction", this.modelName)
      .then((model) => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        this.log(`Model initialization completed in ${duration}s`, {
          modelType: this.modelName,
          initializationTime: duration,
        });
        console.log(`Image model initialized successfully in ${duration}s`);
        this.model = model;
        this.isInitializing = false;
        return model;
      })
      .catch((error) => {
        this.log("Model initialization failed", {
          error: error.message,
          stack: error.stack,
        });
        console.error("Failed to initialize image model:", error);
        this.isInitializing = false;
        this.initPromise = null;
        throw error;
      });

    return this.initPromise;
  }

  /**
   * Get embedding for an image
   * @param {string|Buffer} image - The image path or buffer
   * @returns {Promise<Array<number>|null>} - A promise resolving to the embedding or null if failed
   */
  async getImageEmbedding(image) {
    this.log(
      "Getting image embedding",
      {
        imageType: typeof image,
        isBuffer: Buffer.isBuffer(image),
        imageSize: Buffer.isBuffer(image) ? image.length : "unknown",
      },
      "🖼️"
    );

    // Ensure model is initialized
    if (!this.model) {
      this.log("Model not initialized, initializing now", null, "⚠️");
      await this.initialize();
    }

    console.log("🔄 Processing image for embedding generation");
    const startTime = Date.now();

    try {
      // Generate a hash for the image (useful for identifying/caching)
      let imageHash;
      if (Buffer.isBuffer(image)) {
        imageHash = crypto
          .createHash("sha256")
          .update(image)
          .digest("hex")
          .substring(0, 16);
        this.log(`Generated image hash: ${imageHash}`, null, "🏷️");
      }

      // Process the image using the model
      this.log("Starting embedding generation", null, "⚙️");
      console.log("⚙️ Generating embedding with model...");

      // Use feature extraction pipeline to get the embedding
      const result = await this.model(image, {
        pooling: "mean",
        normalize: true,
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(3);
      this.log(`Image embedding generated in ${duration}s`, null, "⏱️");
      console.log(`⏱️ Embedding generation took ${duration}s`);

      // Extract embedding data from the result
      let embeddingData;

      this.log(
        "Raw model result structure",
        {
          resultType: typeof result,
          hasData: result && result.data ? true : false,
          hasTolist: result && result.tolist ? true : false,
          isArray: Array.isArray(result),
          resultKeys: result ? Object.keys(result) : [],
        },
        "🔬"
      );

      if (result && result.data) {
        // If data property exists
        embeddingData = result.data;
        this.log("Found data property in result", null, "✅");
      } else if (result && result.tolist) {
        // If result is a tensor with tolist method
        this.log("Using tolist() method to extract embedding", null, "🔄");
        embeddingData = result.tolist();
        if (Array.isArray(embeddingData) && embeddingData.length === 1) {
          embeddingData = embeddingData[0];
          this.log("Unwrapped embedding from array", null, "📦");
        }
      } else if (Array.isArray(result)) {
        // If it's already an array
        embeddingData = result;
        this.log("Result is already an array", null, "✅");
      } else {
        this.log(
          "Unexpected result format",
          {
            resultType: typeof result,
            result: result
              ? JSON.stringify(result).substring(0, 100) + "..."
              : "null",
          },
          "❌"
        );
        console.warn("❌ Could not extract image embedding from model result");
        return null;
      }

      if (!embeddingData) {
        this.log("Embedding data is null or undefined", null, "❌");
        console.error("❌ Failed to extract embedding data from result");
        return null;
      }

      // Check embedding data dimensions
      this.log(
        "Embedding data before normalization",
        {
          type: typeof embeddingData,
          isArray: Array.isArray(embeddingData),
          length: Array.isArray(embeddingData)
            ? embeddingData.length
            : "not an array",
          sample: Array.isArray(embeddingData)
            ? `[${embeddingData
                .slice(0, 3)
                .map((v) => v.toFixed(4))
                .join(", ")}...]`
            : "not available",
        },
        "📊"
      );

      // Normalize the embedding to unit length
      const normalizedEmbedding = this.normalizeEmbedding(embeddingData);

      if (!normalizedEmbedding || normalizedEmbedding.length === 0) {
        this.log("Normalized embedding is empty or invalid", null, "❌");
        console.error("❌ Normalized embedding is empty or invalid");
        return null;
      }

      this.log(
        `Image embedding processed successfully`,
        {
          hash: imageHash,
          dimensions: normalizedEmbedding.length,
          processingTime: duration,
          sample: `[${normalizedEmbedding
            .slice(0, 3)
            .map((v) => v.toFixed(4))
            .join(", ")}...]`,
        },
        "✅"
      );

      console.log(
        `✅ Image embedding generated successfully: ${normalizedEmbedding.length} dimensions`
      );
      return normalizedEmbedding;
    } catch (error) {
      this.log(
        "Error generating image embedding",
        {
          error: error.message,
          stack: error.stack,
        },
        "❌"
      );
      console.error("❌ Failed to generate image embedding:", error);
      return null;
    }
  }

  /**
   * Normalize an embedding vector to unit length
   * @param {Array<number>} embedding - The embedding to normalize
   * @returns {Array<number>} Normalized embedding
   */
  normalizeEmbedding(embedding) {
    // Calculate magnitude
    let magnitude = 0;
    for (let i = 0; i < embedding.length; i++) {
      magnitude += embedding[i] * embedding[i];
    }
    magnitude = Math.sqrt(magnitude);

    // Normalize to unit length
    if (magnitude > 0) {
      return embedding.map((e) => e / magnitude);
    }
    return embedding;
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param {Array<number>} embA - First embedding
   * @param {Array<number>} embB - Second embedding
   * @returns {number} Cosine similarity score (-1 to 1)
   */
  cosineSimilarity(embA, embB) {
    this.log("Calculating cosine similarity", {
      dimensionsA: embA.length,
      dimensionsB: embB.length,
    });

    // If dimensions don't match, normalize sizes
    if (embA.length !== embB.length) {
      this.log("Dimension mismatch in embeddings - normalizing sizes", {
        dimensionsA: embA.length,
        dimensionsB: embB.length,
      });

      const targetSize = this.sampleSize;
      const normalizedA = this.normalizeEmbeddingSize(embA, targetSize);
      const normalizedB = this.normalizeEmbeddingSize(embB, targetSize);

      embA = normalizedA;
      embB = normalizedB;
    }

    const startTime = performance.now();

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < embA.length; i++) {
      dotProduct += embA[i] * embB[i];
      normA += embA[i] ** 2;
      normB += embB[i] ** 2;
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      this.log("Zero norm detected in similarity calculation", {
        normA,
        normB,
      });
      return 0;
    }

    const similarity = dotProduct / (normA * normB);
    const duration = (performance.now() - startTime).toFixed(2);

    this.log(`Similarity calculation completed in ${duration}ms`, {
      similarity,
      calculationTimeMs: duration,
    });

    return similarity;
  }

  /**
   * Normalize an embedding to a target size
   * @param {Array<number>} embedding - The embedding to normalize
   * @param {number} targetSize - The desired size
   * @returns {Array<number>} Normalized embedding
   */
  normalizeEmbeddingSize(embedding, targetSize) {
    if (embedding.length === targetSize) {
      return embedding;
    }

    // Simple approach: If embedding is smaller, pad with zeros
    // If larger, truncate to target size
    const result = new Array(targetSize).fill(0);

    const copyLength = Math.min(embedding.length, targetSize);
    for (let i = 0; i < copyLength; i++) {
      result[i] = embedding[i];
    }

    return result;
  }
}

// Create singleton instance with debug disabled by default
const imageEmbedder = new ImageEmbedder({
  debug: false,
  modelName: CLIP, // "Xenova/vit-base-patch16-224", // Lightweight vision model
});

// Export functions
export default {
  /**
   * Set debug mode
   * @param {boolean} enabled - Whether to enable debug mode
   */
  setDebug: (enabled) => {
    imageEmbedder.setDebug(enabled);
  },

  /**
   * Get embedding for an image
   * @param {string|Buffer} image - The image path or buffer
   * @returns {Promise<Array<number>|null>} The embedding or null if failed
   */
  getImageEmbedding: async (image) => {
    return imageEmbedder.getImageEmbedding(image);
  },

  /**
   * Calculate similarity between two image embeddings
   * @param {Array<number>} embA - First embedding
   * @param {Array<number>} embB - Second embedding
   * @returns {number} Similarity score (-1 to 1)
   */
  cosineSimilarity: (embA, embB) => {
    return imageEmbedder.cosineSimilarity(embA, embB);
  },
};
