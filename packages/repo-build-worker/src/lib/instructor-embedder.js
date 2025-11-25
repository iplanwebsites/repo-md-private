// instructor-embedder.js
import { pipeline } from "@huggingface/transformers";

// Global debug flag - set to true to enable verbose logging
const DEBUG = false;

/**
 * An adapter to provide instructor-like behavior using available embedding models
 * with lazy initialization to avoid increasing startup time.
 *
 * Note: Since Instructor models aren't directly available in Xenova,
 * we use a sentence transformer model and adapt the interface to match
 * instruction-based embeddings.
 */
class InstructorEmbedder {
  constructor(options = {}) {
    this.model = null;
    this.isInitializing = false;
    this.initPromise = null;
    this.debug = options.debug || false;
    this.modelName = options.modelName || "Xenova/all-MiniLM-L6-v2";
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
   * @param {boolean} isImportant - Whether this is an important message to always log regardless of debug setting
   */
  log(message, data = null, isImportant = false) {
    // Skip logging if debug is disabled and this is not an important message
    if (!this.debug && !DEBUG && !isImportant) return;

    const timestamp = new Date().toISOString();
    if (data !== null) {
      console.log(`[INSTRUCTOR ${timestamp}] ${message}`);
      console.dir(data, { depth: null, colors: true });
    } else {
      console.log(`[INSTRUCTOR ${timestamp}] ${message}`);
    }
  }

  /**
   * Initialize the model if it hasn't been initialized yet
   * @returns {Promise} A promise that resolves when the model is loaded
   */
  async initialize() {
    // If already initialized, return immediately
    if (this.model) {
      this.log("Model already initialized, reusing existing model", null, true);
      return this.model;
    }

    // If initialization is in progress, return the existing promise
    if (this.initPromise) {
      this.log(
        "Model initialization already in progress, waiting for completion",
        null,
        true
      );
      return this.initPromise;
    }

    // Start initialization
    this.isInitializing = true;
    this.log("Starting model initialization", null, true);
    console.log(`Initializing embedding model (${this.modelName})...`);

    const startTime = Date.now();

    // Create and store the initialization promise
    // Use a widely available model from Xenova that's suitable for embeddings
    this.initPromise = pipeline("feature-extraction", this.modelName)
      .then((model) => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        this.log(`Model initialization completed in ${duration}s`, {
          modelType: this.modelName,
          initializationTime: duration,
        }, true);
        console.log(`Embedding model initialized successfully in ${duration}s`);
        this.model = model;
        this.isInitializing = false;

        // Calculate size of sample embedding for later reference
        this.sampleSize = 384; // Default size for MiniLM-L6-v2

        return model;
      })
      .catch((error) => {
        this.log("Model initialization failed", {
          error: error.message,
          stack: error.stack,
        }, true);
        console.error("Failed to initialize embedding model:", error);
        this.isInitializing = false;
        this.initPromise = null;
        throw error;
      });

    return this.initPromise;
  }

  /**
   * Get an embedding for a given instruction and text pair
   * @param {string} instruction - The instruction (e.g., "Represent the sentence:")
   * @param {string} text - The text to embed
   * @returns {Promise<Float32Array>} A promise that resolves to the embedding
   */
  async getEmbedding(instruction, text) {
    this.log("Getting embedding", {
      instruction,
      text: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
    });

    // Ensure model is initialized
    if (!this.model) {
      this.log("Model not initialized, initializing now");
      await this.initialize();
    }

    // Format the input - for non-instructor models, combine instruction and text
    // This is a simplification but allows us to maintain the same interface
    const input = `${instruction} ${text}`;

    const startTime = Date.now();

    try {
      // Get the embedding
      this.log("Generating embedding for input", { inputLength: input.length });

      // Use the sentence-transformers embedding model with specified pooling
      const result = await this.model(input, {
        pooling: "mean",
        normalize: true,
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(3);

      // Extract the embedding - for MiniLM models, we need to get the data from the tensor
      let embeddingData;

      if (result && result.tolist) {
        // If result is a tensor with tolist method (as per docs)
        embeddingData = result.tolist();
        if (Array.isArray(embeddingData) && embeddingData.length === 1) {
          // If it's a batch of one, get the first item
          embeddingData = embeddingData[0];
        }
      } else if (result && result.data) {
        // If data property exists
        embeddingData = result.data;
      } else if (Array.isArray(result)) {
        // If it's already an array
        embeddingData = result;
      } else {
        this.log("Unexpected result format", { resultType: typeof result });
        // Create a fallback embedding
        embeddingData = new Array(384).fill(0);
      }

      this.log(`Embedding generated in ${duration}s`, {
        embeddingDimensions: embeddingData.length,
        processingTime: duration,
      });

      return embeddingData;
    } catch (error) {
      this.log("Error generating embedding", {
        error: error.message,
        stack: error.stack,
      }, true);
      console.error("Failed to generate embedding:", error);
      throw error;
    }
  }

  /**
   * Get embeddings for multiple instruction-text pairs
   * @param {Array<Array<string>>} pairs - Array of [instruction, text] pairs
   * @returns {Promise<Array<Float32Array>>} A promise that resolves to an array of embeddings
   */
  async batchGetEmbeddings(pairs) {
    this.log("Batch embedding requested", {
      batchSize: pairs.length,
      pairs: pairs.map(([instruction, text]) => ({
        instruction,
        textPreview: text.substring(0, 50) + (text.length > 50 ? "..." : ""),
      })),
    });

    // Ensure model is initialized
    if (!this.model) {
      this.log("Model not initialized, initializing now");
      await this.initialize();
    }

    // Format the inputs
    const inputs = pairs.map(([instruction, text]) => `${instruction} ${text}`);
    this.log("Formatted inputs for batch processing", {
      count: inputs.length,
      averageLength:
        inputs.reduce((sum, input) => sum + input.length, 0) / inputs.length,
    });

    const startTime = Date.now();

    try {
      // Process each input sequentially for better reliability
      this.log("Starting sequential embedding generation");
      const results = [];

      for (let i = 0; i < inputs.length; i++) {
        this.log(`Processing batch item ${i + 1}/${inputs.length}`);
        const result = await this.model(inputs[i], {
          pooling: "mean",
          normalize: true,
        });

        // Extract embedding from result
        let embeddingData;

        if (result && result.tolist) {
          // If result is a tensor with tolist method
          embeddingData = result.tolist();
          if (Array.isArray(embeddingData) && embeddingData.length === 1) {
            embeddingData = embeddingData[0];
          }
        } else if (result && result.data) {
          embeddingData = result.data;
        } else if (Array.isArray(result)) {
          embeddingData = result;
        } else {
          this.log("Unexpected result format", { resultType: typeof result });
          embeddingData = new Array(384).fill(0);
        }

        results.push(embeddingData);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.log(`Batch embeddings completed in ${duration}s`, {
        averageTimePerEmbedding: (duration / pairs.length).toFixed(3),
        totalTime: duration,
        dimensions: results.map((r) => r.length),
      });

      return results;
    } catch (error) {
      this.log("Error in batch embedding generation", {
        error: error.message,
        stack: error.stack,
      }, true);
      console.error("Batch embedding failed:", error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param {Float32Array|Array} embA - First embedding
   * @param {Float32Array|Array} embB - Second embedding
   * @returns {number} Cosine similarity score (-1 to 1)
   */
  cosineSimilarity(embA, embB) {
    this.log("Calculating cosine similarity", {
      dimensionsA: embA.length,
      dimensionsB: embB.length,
    });

    // If dimensions don't match, we need to handle this situation
    // For MiniLM-L6-v2, we know it should always return 384 dimensions with pooling
    if (embA.length !== embB.length) {
      this.log("Dimension mismatch in embeddings - attempting normalization", {
        dimensionsA: embA.length,
        dimensionsB: embB.length,
      });

      // Normalize both to a fixed size (384 for MiniLM)
      // This is a simplification that handles dimension mismatches
      const targetSize = this.sampleSize || 384;
      const normalizedA = this.normalizeEmbeddingSize(embA, targetSize);
      const normalizedB = this.normalizeEmbeddingSize(embB, targetSize);

      embA = normalizedA;
      embB = normalizedB;

      this.log("Normalized embedding dimensions", {
        normalizedDimensions: targetSize,
      });
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
   * @param {Array|Float32Array} embedding - The embedding to normalize
   * @param {number} targetSize - The desired size
   * @returns {Array} Normalized embedding
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

  /**
   * Find the most similar documents to a query
   * @param {string} queryInstruction - Instruction for the query
   * @param {string} queryText - The query text
   * @param {Array<string>} docInstruction - Instruction for the documents
   * @param {Array<string>} docs - Array of document texts
   * @param {number} topK - Number of top results to return
   * @returns {Promise<Array<{index: number, document: string, score: number}>>} Top matching documents with scores
   */
  async findSimilarDocuments(
    queryInstruction,
    queryText,
    docInstruction,
    docs,
    topK = 3
  ) {
    this.log("Finding similar documents", {
      query: queryText,
      queryInstruction,
      docInstruction,
      documentCount: docs.length,
      topK,
    });

    const startTime = Date.now();

    // Get query embedding
    this.log("Getting query embedding");
    const queryEmbedding = await this.getEmbedding(queryInstruction, queryText);

    // Get document embeddings
    this.log("Getting document embeddings", { documentCount: docs.length });
    const docPairs = docs.map((doc) => [docInstruction, doc]);
    const docEmbeddings = await this.batchGetEmbeddings(docPairs);

    // Calculate similarities
    this.log("Calculating similarities");
    const similarities = docEmbeddings.map((docEmb, i) => {
      const score = this.cosineSimilarity(queryEmbedding, docEmb);
      return {
        index: i,
        document: docs[i],
        score,
      };
    });

    // Sort by score (descending) and take top K
    const results = similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    this.log(`Document retrieval completed in ${duration}s`, {
      topResults: results.map((r) => ({
        index: r.index,
        score: r.score,
        documentPreview: r.document.substring(0, 50) + "...",
      })),
      totalTimeSeconds: duration,
    });

    return results;
  }
}

// Create singleton instance with debug set by the global DEBUG flag
const instructorEmbedder = new InstructorEmbedder({
  debug: DEBUG,
  modelName: "Xenova/all-MiniLM-L6-v2", // A suitable sentence embedding model
});

// Export functions
export default {
  /**
   * Set debug mode
   * @param {boolean} enabled - Whether to enable debug mode
   */
  setDebug: (enabled) => {
    instructorEmbedder.setDebug(enabled);
  },

  /**
   * Get embedding for a text with an instruction
   * @param {string} instruction - The instruction for the embedding
   * @param {string} text - The text to embed
   * @returns {Promise<Float32Array>} The embedding
   */
  getEmbedding: async (instruction, text) => {
    return instructorEmbedder.getEmbedding(instruction, text);
  },

  /**
   * Get embeddings for multiple instruction-text pairs
   * @param {Array<Array<string>>} pairs - Array of [instruction, text] pairs
   * @returns {Promise<Array<Float32Array>>} Array of embeddings
   */
  batchGetEmbeddings: async (pairs) => {
    return instructorEmbedder.batchGetEmbeddings(pairs);
  },

  /**
   * Calculate similarity between two texts
   * @param {string} instruction1 - Instruction for first text
   * @param {string} text1 - First text
   * @param {string} instruction2 - Instruction for second text
   * @param {string} text2 - Second text
   * @returns {Promise<number>} Similarity score (-1 to 1)
   */
  calculateSimilarity: async (instruction1, text1, instruction2, text2) => {
    instructorEmbedder.log("Calculating similarity between texts", {
      text1: text1.substring(0, 50) + (text1.length > 50 ? "..." : ""),
      text2: text2.substring(0, 50) + (text2.length > 50 ? "..." : ""),
      instruction1,
      instruction2,
    });

    const emb1 = await instructorEmbedder.getEmbedding(instruction1, text1);
    const emb2 = await instructorEmbedder.getEmbedding(instruction2, text2);
    return instructorEmbedder.cosineSimilarity(emb1, emb2);
  },

  /**
   * Find similar documents to a query
   * @param {string} queryInstruction - Instruction for the query
   * @param {string} queryText - The query text
   * @param {string} docInstruction - Instruction for the documents
   * @param {Array<string>} docs - Array of document texts
   * @param {number} topK - Number of top results to return
   * @returns {Promise<Array<{index: number, document: string, score: number}>>} Top matching documents with scores
   */
  findSimilarDocuments: async (
    queryInstruction,
    queryText,
    docInstruction,
    docs,
    topK = 3
  ) => {
    return instructorEmbedder.findSimilarDocuments(
      queryInstruction,
      queryText,
      docInstruction,
      docs,
      topK
    );
  },

  /**
   * Cosine similarity between two embeddings
   * @param {Float32Array} embA - First embedding
   * @param {Float32Array} embB - Second embedding
   * @returns {number} Similarity score (-1 to 1)
   */
  cosineSimilarity: (embA, embB) => {
    return instructorEmbedder.cosineSimilarity(embA, embB);
  },
};
