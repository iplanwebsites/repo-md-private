#!/usr/bin/env node
/**
 * Model Preloading Script
 *
 * Downloads and caches transformer.js models locally.
 * Run this before building the Docker image or deploying to CF Containers.
 *
 * Usage: node scripts/preload-models.js
 */

import {
  AutoTokenizer,
  CLIPTextModelWithProjection,
  AutoProcessor,
  CLIPVisionModelWithProjection,
  pipeline
} from "@huggingface/transformers";

const CLIP_MODEL = "Xenova/mobileclip_s0";
const TEXT_MODEL = "Xenova/all-MiniLM-L6-v2";

async function preloadModels() {
  console.log("=".repeat(60));
  console.log("Transformer.js Model Preloader");
  console.log("=".repeat(60));
  console.log(`\nCache directory: ${process.env.TRANSFORMERS_CACHE || process.env.HF_HOME || "~/.cache/huggingface"}`);
  console.log(`\nModels to preload:`);
  console.log(`  - CLIP: ${CLIP_MODEL}`);
  console.log(`  - Text: ${TEXT_MODEL}`);
  console.log("");

  const start = Date.now();
  const results = {
    success: [],
    failed: []
  };

  // CLIP Models
  console.log("[1/5] Loading CLIP tokenizer...");
  try {
    const tokenizer = await AutoTokenizer.from_pretrained(CLIP_MODEL);
    console.log("      Done");
    results.success.push("CLIP tokenizer");
  } catch (error) {
    console.error(`      FAILED: ${error.message}`);
    results.failed.push("CLIP tokenizer");
  }

  console.log("[2/5] Loading CLIP text model...");
  try {
    const textModel = await CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL);
    console.log("      Done");
    results.success.push("CLIP text model");
  } catch (error) {
    console.error(`      FAILED: ${error.message}`);
    results.failed.push("CLIP text model");
  }

  console.log("[3/5] Loading CLIP processor...");
  try {
    const processor = await AutoProcessor.from_pretrained(CLIP_MODEL);
    console.log("      Done");
    results.success.push("CLIP processor");
  } catch (error) {
    console.error(`      FAILED: ${error.message}`);
    results.failed.push("CLIP processor");
  }

  console.log("[4/5] Loading CLIP vision model...");
  try {
    const visionModel = await CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL);
    console.log("      Done");
    results.success.push("CLIP vision model");
  } catch (error) {
    console.error(`      FAILED: ${error.message}`);
    results.failed.push("CLIP vision model");
  }

  // Text Embedding Model
  console.log("[5/5] Loading text embedding pipeline...");
  try {
    const embedder = await pipeline("feature-extraction", TEXT_MODEL);
    console.log("      Done");
    results.success.push("Text embedding pipeline");
  } catch (error) {
    console.error(`      FAILED: ${error.message}`);
    results.failed.push("Text embedding pipeline");
  }

  const duration = ((Date.now() - start) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(60));
  console.log("Results");
  console.log("=".repeat(60));
  console.log(`\nTime: ${duration}s`);
  console.log(`Success: ${results.success.length}/5`);

  if (results.success.length > 0) {
    console.log(`\nLoaded:`);
    results.success.forEach(m => console.log(`  - ${m}`));
  }

  if (results.failed.length > 0) {
    console.log(`\nFailed:`);
    results.failed.forEach(m => console.log(`  - ${m}`));
    process.exit(1);
  }

  console.log("\nAll models preloaded successfully!");
  console.log("You can now build the Docker image or deploy to CF Containers.");
}

preloadModels().catch(error => {
  console.error("\nFatal error:", error);
  process.exit(1);
});
