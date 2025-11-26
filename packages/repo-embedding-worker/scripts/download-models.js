/**
 * Pre-download Transformer.js models for embedding generation.
 * Run this during Docker build to bake models into the image.
 *
 * Models downloaded:
 * - Xenova/mobileclip_s0: CLIP model for text + image embeddings (~300MB)
 * - Xenova/all-MiniLM-L6-v2: Sentence embeddings (~90MB)
 */

import {
  AutoTokenizer,
  CLIPTextModelWithProjection,
  AutoProcessor,
  CLIPVisionModelWithProjection,
  pipeline,
} from "@huggingface/transformers";

const CLIP_MODEL = "Xenova/mobileclip_s0";
const SENTENCE_MODEL = "Xenova/all-MiniLM-L6-v2";

async function downloadModels() {
  console.log("=".repeat(60));
  console.log("Pre-downloading Transformer.js models for CF Containers");
  console.log("=".repeat(60));
  console.log(`\nCache directory: ${process.env.TRANSFORMERS_CACHE || "~/.cache/huggingface"}`);

  const startTime = Date.now();

  // Download CLIP model components
  console.log(`\n[1/5] Downloading CLIP tokenizer (${CLIP_MODEL})...`);
  const clipStart = Date.now();
  await AutoTokenizer.from_pretrained(CLIP_MODEL);
  console.log(`      Done in ${((Date.now() - clipStart) / 1000).toFixed(1)}s`);

  console.log(`[2/5] Downloading CLIP text model (${CLIP_MODEL})...`);
  const textStart = Date.now();
  await CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL);
  console.log(`      Done in ${((Date.now() - textStart) / 1000).toFixed(1)}s`);

  console.log(`[3/5] Downloading CLIP processor (${CLIP_MODEL})...`);
  const procStart = Date.now();
  await AutoProcessor.from_pretrained(CLIP_MODEL);
  console.log(`      Done in ${((Date.now() - procStart) / 1000).toFixed(1)}s`);

  console.log(`[4/5] Downloading CLIP vision model (${CLIP_MODEL})...`);
  const visionStart = Date.now();
  await CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL);
  console.log(`      Done in ${((Date.now() - visionStart) / 1000).toFixed(1)}s`);

  // Download sentence embedding model
  console.log(`[5/5] Downloading sentence model (${SENTENCE_MODEL})...`);
  const sentenceStart = Date.now();
  await pipeline("feature-extraction", SENTENCE_MODEL);
  console.log(`      Done in ${((Date.now() - sentenceStart) / 1000).toFixed(1)}s`);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`All models downloaded successfully in ${totalTime}s`);
  console.log("=".repeat(60));
}

downloadModels().catch((error) => {
  console.error("Failed to download models:", error);
  process.exit(1);
});
