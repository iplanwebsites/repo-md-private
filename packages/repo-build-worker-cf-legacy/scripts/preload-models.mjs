import { AutoTokenizer, CLIPTextModelWithProjection, AutoProcessor, CLIPVisionModelWithProjection, pipeline } from "@huggingface/transformers";

const CLIP_MODEL = "Xenova/mobileclip_s0";
const TEXT_MODEL = "Xenova/all-MiniLM-L6-v2";

console.log("Pre-loading transformer models...");
console.log(`CLIP Model: ${CLIP_MODEL}`);
console.log(`Text Model: ${TEXT_MODEL}`);

const start = Date.now();

try {
  console.log("Downloading CLIP tokenizer...");
  await AutoTokenizer.from_pretrained(CLIP_MODEL);

  console.log("Downloading CLIP text model...");
  await CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL);

  console.log("Downloading CLIP processor...");
  await AutoProcessor.from_pretrained(CLIP_MODEL);

  console.log("Downloading CLIP vision model...");
  await CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL);

  console.log("Downloading text embedding pipeline...");
  await pipeline("feature-extraction", TEXT_MODEL);

  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`All models pre-loaded in ${duration}s`);
} catch (error) {
  console.error("Model pre-loading failed:", error);
  process.exit(1);
}
