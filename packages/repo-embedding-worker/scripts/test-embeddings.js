/**
 * Test script for embedding generation
 * Run locally or in container to verify models work
 */

import { clipEmbedder } from "../src/clip-embedder.js";
import { sentenceEmbedder } from "../src/sentence-embedder.js";

async function runTests() {
  console.log("=".repeat(60));
  console.log("Embedding Worker Test Suite");
  console.log("=".repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  // Test 1: CLIP text embedding
  try {
    console.log("\n[Test 1] CLIP Text Embedding...");
    const startTime = Date.now();
    const embedding = await clipEmbedder.textEmbedding("A photo of a cat");
    const duration = Date.now() - startTime;

    if (embedding && embedding.length > 0) {
      console.log(`  PASS - Generated ${embedding.length}-dim embedding in ${duration}ms`);
      results.passed++;
      results.tests.push({ name: "CLIP Text", status: "pass", duration });
    } else {
      throw new Error("Empty embedding returned");
    }
  } catch (error) {
    console.log(`  FAIL - ${error.message}`);
    results.failed++;
    results.tests.push({ name: "CLIP Text", status: "fail", error: error.message });
  }

  // Test 2: CLIP image embedding (using a public test image)
  try {
    console.log("\n[Test 2] CLIP Image Embedding...");
    const testImageUrl = "https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/transformers-logo-light.png";
    const startTime = Date.now();
    const embedding = await clipEmbedder.imageEmbeddingByUrl(testImageUrl);
    const duration = Date.now() - startTime;

    if (embedding && embedding.length > 0) {
      console.log(`  PASS - Generated ${embedding.length}-dim embedding in ${duration}ms`);
      results.passed++;
      results.tests.push({ name: "CLIP Image", status: "pass", duration });
    } else {
      throw new Error("Empty embedding returned");
    }
  } catch (error) {
    console.log(`  FAIL - ${error.message}`);
    results.failed++;
    results.tests.push({ name: "CLIP Image", status: "fail", error: error.message });
  }

  // Test 3: Sentence embedding
  try {
    console.log("\n[Test 3] Sentence Embedding...");
    const startTime = Date.now();
    const embedding = await sentenceEmbedder.getEmbedding(
      "Represent the sentence:",
      "This is a test sentence for embedding generation."
    );
    const duration = Date.now() - startTime;

    if (embedding && embedding.length > 0) {
      console.log(`  PASS - Generated ${embedding.length}-dim embedding in ${duration}ms`);
      results.passed++;
      results.tests.push({ name: "Sentence", status: "pass", duration });
    } else {
      throw new Error("Empty embedding returned");
    }
  } catch (error) {
    console.log(`  FAIL - ${error.message}`);
    results.failed++;
    results.tests.push({ name: "Sentence", status: "fail", error: error.message });
  }

  // Test 4: Batch sentence embeddings
  try {
    console.log("\n[Test 4] Batch Sentence Embeddings...");
    const texts = [
      "First test sentence.",
      "Second test sentence.",
      "Third test sentence.",
    ];
    const startTime = Date.now();
    const pairs = texts.map(t => ["Represent the sentence:", t]);
    const embeddings = await sentenceEmbedder.batchGetEmbeddings(pairs);
    const duration = Date.now() - startTime;

    if (embeddings && embeddings.length === 3) {
      console.log(`  PASS - Generated ${embeddings.length} embeddings in ${duration}ms`);
      results.passed++;
      results.tests.push({ name: "Batch Sentence", status: "pass", duration });
    } else {
      throw new Error(`Expected 3 embeddings, got ${embeddings?.length}`);
    }
  } catch (error) {
    console.log(`  FAIL - ${error.message}`);
    results.failed++;
    results.tests.push({ name: "Batch Sentence", status: "fail", error: error.message });
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Test Results");
  console.log("=".repeat(60));
  console.log(`Passed: ${results.passed}/${results.passed + results.failed}`);
  console.log(`Failed: ${results.failed}/${results.passed + results.failed}`);

  if (results.failed > 0) {
    console.log("\nFailed tests:");
    results.tests
      .filter(t => t.status === "fail")
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
    process.exit(1);
  }

  console.log("\nAll tests passed!");
  process.exit(0);
}

runTests().catch((error) => {
  console.error("Test suite failed:", error);
  process.exit(1);
});
