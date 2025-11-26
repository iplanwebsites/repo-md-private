/**
 * CLIP Embedder for Cloudflare Containers
 *
 * Uses MobileCLIP model for text and image embeddings.
 * Models are pre-downloaded during Docker build.
 */

import {
  AutoTokenizer,
  CLIPTextModelWithProjection,
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
} from "@huggingface/transformers";

const MODEL_ID = "Xenova/mobileclip_s0";

let tokenizer = null;
let textModel = null;
let processor = null;
let visionModel = null;
let initPromise = null;

/**
 * Check if models are initialized
 */
function isInitialized() {
  return !!(tokenizer && textModel && processor && visionModel);
}

/**
 * Initialize CLIP models (lazy loading with singleton pattern)
 */
async function initialize() {
  if (isInitialized()) {
    return { tokenizer, textModel, processor, visionModel };
  }

  if (initPromise) {
    return initPromise;
  }

  console.log(`Initializing CLIP models (${MODEL_ID})...`);
  const startTime = Date.now();

  initPromise = Promise.all([
    AutoTokenizer.from_pretrained(MODEL_ID),
    CLIPTextModelWithProjection.from_pretrained(MODEL_ID),
    AutoProcessor.from_pretrained(MODEL_ID),
    CLIPVisionModelWithProjection.from_pretrained(MODEL_ID),
  ])
    .then(([_tokenizer, _textModel, _processor, _visionModel]) => {
      tokenizer = _tokenizer;
      textModel = _textModel;
      processor = _processor;
      visionModel = _visionModel;

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`CLIP models initialized in ${duration}s`);

      return { tokenizer, textModel, processor, visionModel };
    })
    .catch((error) => {
      console.error("Failed to initialize CLIP models:", error);
      initPromise = null;
      throw error;
    });

  return initPromise;
}

/**
 * Generate text embedding
 */
async function textEmbedding(text) {
  if (!tokenizer || !textModel) {
    await initialize();
  }

  const inputs = tokenizer([text], {
    padding: "max_length",
    truncation: true,
  });

  const { text_embeds } = await textModel(inputs);
  const normalized = text_embeds.normalize().tolist();

  return normalized[0];
}

/**
 * Generate image embedding from URL
 */
async function imageEmbeddingByUrl(url) {
  if (!processor || !visionModel) {
    await initialize();
  }

  const image = await RawImage.read(url);
  const inputs = await processor(image);

  const { image_embeds } = await visionModel(inputs);
  const normalized = image_embeds.normalize().tolist();

  return normalized[0];
}

/**
 * Generate image embedding from base64 data
 */
async function imageEmbeddingFromBase64(base64Data) {
  if (!processor || !visionModel) {
    await initialize();
  }

  // Remove data URL prefix if present
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");

  // Create image from buffer
  const image = await RawImage.fromBlob(new Blob([buffer]));
  const inputs = await processor(image);

  const { image_embeds } = await visionModel(inputs);
  const normalized = image_embeds.normalize().tolist();

  return normalized[0];
}

export const clipEmbedder = {
  initialize,
  isInitialized,
  textEmbedding,
  imageEmbeddingByUrl,
  imageEmbeddingFromBase64,
};
