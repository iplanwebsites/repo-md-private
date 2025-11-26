/**
 * Sentence Embedder for Cloudflare Containers
 *
 * Uses all-MiniLM-L6-v2 model for sentence embeddings.
 * Models are pre-downloaded during Docker build.
 */

import { pipeline } from "@huggingface/transformers";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

let model = null;
let initPromise = null;

/**
 * Check if model is initialized
 */
function isInitialized() {
  return !!model;
}

/**
 * Initialize sentence embedding model
 */
async function initialize() {
  if (model) {
    return model;
  }

  if (initPromise) {
    return initPromise;
  }

  console.log(`Initializing sentence model (${MODEL_ID})...`);
  const startTime = Date.now();

  initPromise = pipeline("feature-extraction", MODEL_ID)
    .then((_model) => {
      model = _model;
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`Sentence model initialized in ${duration}s`);
      return model;
    })
    .catch((error) => {
      console.error("Failed to initialize sentence model:", error);
      initPromise = null;
      throw error;
    });

  return initPromise;
}

/**
 * Get embedding for instruction + text pair
 */
async function getEmbedding(instruction, text) {
  if (!model) {
    await initialize();
  }

  const input = `${instruction} ${text}`;

  const result = await model(input, {
    pooling: "mean",
    normalize: true,
  });

  // Extract embedding from result
  if (result && result.tolist) {
    const data = result.tolist();
    return Array.isArray(data) && data.length === 1 ? data[0] : data;
  }

  if (result && result.data) {
    return Array.from(result.data);
  }

  return result;
}

/**
 * Get embeddings for multiple instruction-text pairs
 */
async function batchGetEmbeddings(pairs) {
  if (!model) {
    await initialize();
  }

  const results = [];

  for (const [instruction, text] of pairs) {
    const embedding = await getEmbedding(instruction, text);
    results.push(embedding);
  }

  return results;
}

export const sentenceEmbedder = {
  initialize,
  isInitialized,
  getEmbedding,
  batchGetEmbeddings,
};
