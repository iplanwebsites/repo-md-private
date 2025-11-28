#!/usr/bin/env node
/**
 * Embeddings Test Script
 *
 * Tests that transformer.js embeddings work correctly.
 * Run this inside the Docker container to verify the setup.
 *
 * Usage: node scripts/test-embeddings.js
 */

import clipEmbedder from "../src/lib/clip-embedder.js";
import instructorEmbedder from "../src/lib/instructor-embedder.js";

async function testEmbeddings() {
  console.log("=".repeat(60));
  console.log("Embedding Test Suite");
  console.log("=".repeat(60));
  console.log(`\nEnvironment:`);
  console.log(`  SKIP_EMBEDDINGS: ${process.env.SKIP_EMBEDDINGS}`);
  console.log(`  TRANSFORMERS_CACHE: ${process.env.TRANSFORMERS_CACHE}`);
  console.log(`  HF_HOME: ${process.env.HF_HOME}`);
  console.log(`  TRANSFORMERS_OFFLINE: ${process.env.TRANSFORMERS_OFFLINE}`);
  console.log("");

  const results = {
    passed: [],
    failed: []
  };

  // Test 1: CLIP Text Embedding
  console.log("[Test 1] CLIP Text Embedding");
  try {
    const start = Date.now();
    const embedding = await clipEmbedder.textEmbedding("A photo of a cat");
    const duration = ((Date.now() - start) / 1000).toFixed(2);

    if (embedding && embedding.length > 0) {
      console.log(`  PASSED: Generated ${embedding.length}-dim embedding in ${duration}s`);
      console.log(`  Sample: [${embedding.slice(0, 3).map(v => v.toFixed(4)).join(", ")}...]`);
      results.passed.push("CLIP Text Embedding");
    } else {
      throw new Error("Empty embedding returned");
    }
  } catch (error) {
    console.log(`  FAILED: ${error.message}`);
    results.failed.push("CLIP Text Embedding");
  }

  // Test 2: Instructor Text Embedding
  console.log("\n[Test 2] Instructor Text Embedding");
  try {
    const start = Date.now();
    const embedding = await instructorEmbedder.getEmbedding(
      "Represent the sentence for retrieval:",
      "The quick brown fox jumps over the lazy dog"
    );
    const duration = ((Date.now() - start) / 1000).toFixed(2);

    if (embedding && embedding.length > 0) {
      console.log(`  PASSED: Generated ${embedding.length}-dim embedding in ${duration}s`);
      console.log(`  Sample: [${embedding.slice(0, 3).map(v => v.toFixed(4)).join(", ")}...]`);
      results.passed.push("Instructor Text Embedding");
    } else {
      throw new Error("Empty embedding returned");
    }
  } catch (error) {
    console.log(`  FAILED: ${error.message}`);
    results.failed.push("Instructor Text Embedding");
  }

  // Test 3: Cosine Similarity
  console.log("\n[Test 3] Cosine Similarity Calculation");
  try {
    const emb1 = await clipEmbedder.textEmbedding("cat");
    const emb2 = await clipEmbedder.textEmbedding("kitten");
    const emb3 = await clipEmbedder.textEmbedding("car");

    const simCatKitten = clipEmbedder.cosineSimilarity(emb1, emb2);
    const simCatCar = clipEmbedder.cosineSimilarity(emb1, emb3);

    if (simCatKitten > simCatCar) {
      console.log(`  PASSED: cat-kitten similarity (${simCatKitten.toFixed(4)}) > cat-car (${simCatCar.toFixed(4)})`);
      results.passed.push("Cosine Similarity");
    } else {
      throw new Error(`Unexpected similarity: cat-kitten=${simCatKitten}, cat-car=${simCatCar}`);
    }
  } catch (error) {
    console.log(`  FAILED: ${error.message}`);
    results.failed.push("Cosine Similarity");
  }

  // Test 4: Batch Embeddings
  console.log("\n[Test 4] Batch Text Embeddings");
  try {
    const start = Date.now();
    const pairs = [
      ["Represent the sentence:", "First sentence"],
      ["Represent the sentence:", "Second sentence"],
      ["Represent the sentence:", "Third sentence"]
    ];
    const embeddings = await instructorEmbedder.batchGetEmbeddings(pairs);
    const duration = ((Date.now() - start) / 1000).toFixed(2);

    if (embeddings && embeddings.length === 3) {
      console.log(`  PASSED: Generated ${embeddings.length} embeddings in ${duration}s`);
      console.log(`  Dimensions: ${embeddings.map(e => e.length).join(", ")}`);
      results.passed.push("Batch Text Embeddings");
    } else {
      throw new Error(`Expected 3 embeddings, got ${embeddings?.length}`);
    }
  } catch (error) {
    console.log(`  FAILED: ${error.message}`);
    results.failed.push("Batch Text Embeddings");
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Summary");
  console.log("=".repeat(60));
  console.log(`\nPassed: ${results.passed.length}/${results.passed.length + results.failed.length}`);

  if (results.passed.length > 0) {
    console.log(`\nPassed tests:`);
    results.passed.forEach(t => console.log(`  [PASS] ${t}`));
  }

  if (results.failed.length > 0) {
    console.log(`\nFailed tests:`);
    results.failed.forEach(t => console.log(`  [FAIL] ${t}`));
    process.exit(1);
  }

  console.log("\nAll tests passed! Embeddings are working correctly.");
}

testEmbeddings().catch(error => {
  console.error("\nFatal error:", error);
  process.exit(1);
});
