#!/usr/bin/env node

/**
 * Test script specifically for raccook.md file
 * Helps debug issues with this specific AI agent specification
 */

import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs/promises";
import { processMarkdownWithLLM } from "../src/lib/specParser.js";

// Models to test
const MODELS_TO_TEST = [
  // "gpt-4.1-mini",
  "gpt-4.1",
  // "gpt-4.1-nano",
];

// Load environment variables with explicit path
const envPath = path.join(process.cwd(), ".env");
console.log(`🔧 Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

// Debug environment variable loading
console.log("🔧 Environment check:");
console.log(`📍 Working directory: ${process.cwd()}`);
console.log(
  `🔑 OPENAI_API_KEY present: ${process.env.OPENAI_API_KEY ? "YES" : "NO"}`
);
if (process.env.OPENAI_API_KEY) {
  console.log(`🔑 API Key length: ${process.env.OPENAI_API_KEY.length}`);
  console.log(
    `🔑 API Key starts with: ${process.env.OPENAI_API_KEY.substring(0, 10)}...`
  );
}

const RACCOOK_FILE = path.join(
  process.cwd(),
  "test",
  "sample-specs",
  "raccook.md"
);
const OUTPUT_DIR = path.join(
  process.cwd(),
  "test",
  "sample-specs",
  "generated"
);

/**
 * Simple logger for test output
 */
const logger = {
  log: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] ${message}`,
      meta ? JSON.stringify(meta, null, 2) : ""
    );
  },
  error: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    console.error(
      `[${timestamp}] ERROR: ${message}`,
      meta ? JSON.stringify(meta, null, 2) : ""
    );
  },
};

/**
 * Test raccook.md processing with detailed debugging for all models
 */
async function testRaccookProcessing() {
  console.log("🦝 Testing Raccook AI Agent Specification Processing");
  console.log(`📁 Input file: ${RACCOOK_FILE}`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log(`🤖 Testing with models: ${MODELS_TO_TEST.join(", ")}`);

  try {
    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Check if raccook.md exists
    try {
      const stats = await fs.stat(RACCOOK_FILE);
      logger.log(`📄 raccook.md found (${stats.size} bytes)`);
    } catch (error) {
      logger.error("raccook.md file not found", { path: RACCOOK_FILE });
      return;
    }

    // Read the file
    logger.log("📋 Reading raccook.md content...");
    const markdownContent = await fs.readFile(RACCOOK_FILE, "utf-8");

    // Log content analysis
    const lines = markdownContent.split("\n").length;
    const chars = markdownContent.length;
    const words = markdownContent.split(/\s+/).length;

    logger.log("📊 Content analysis:", {
      lines: lines,
      characters: chars,
      words: words,
      sections: (markdownContent.match(/^##/gm) || []).length,
    });

    // Show first 200 characters for verification
    logger.log("📝 Content preview:", {
      preview: markdownContent.substring(0, 200) + "...",
    });

    // Process with all models in parallel
    logger.log(
      `🤖 Starting LLM processing with ${MODELS_TO_TEST.length} models in parallel...`
    );
    const startTime = Date.now();

    // Create processing tasks for all models
    const processingTasks = MODELS_TO_TEST.map((model) =>
      processMarkdownWithLLM(markdownContent, RACCOOK_FILE, logger, model)
        .then((result) => ({
          success: true,
          model,
          result,
          processingTime: Date.now() - startTime,
        }))
        .catch((error) => ({ success: false, model, error: error.message }))
    );

    // Run all models in parallel
    const allResults = await Promise.allSettled(processingTasks);
    const totalTime = Date.now() - startTime;

    // Process results
    const results = allResults.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : { success: false, error: r.reason?.message || "Unknown error" }
    );
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    logger.log("✅ All LLM processing completed", {
      totalTimeMs: totalTime,
      successful: successful.length,
      failed: failed.length,
      models: MODELS_TO_TEST,
    });

    // Save and analyze each successful result
    for (const { model, result } of successful) {
      const modelSuffix = model.replace(/[^a-zA-Z0-9]/g, "-");
      const outputFile = path.join(
        OUTPUT_DIR,
        `raccook-debug-${modelSuffix}.json`
      );

      // Analyze the result structure
      const structureAnalysis = {
        topLevelKeys: Object.keys(result).filter((k) => k !== "_metadata"),
        metadataKeys: result._metadata ? Object.keys(result._metadata) : [],
        estimatedTokens: JSON.stringify(result).length / 4, // rough estimate
      };

      logger.log(
        `📊 Result structure analysis for ${model}:`,
        structureAnalysis
      );

      // Save the result
      await fs.writeFile(outputFile, JSON.stringify(result, null, 2));
      const outputStats = await fs.stat(outputFile);

      logger.log(`💾 Output saved for ${model}`, {
        path: outputFile,
        sizeBytes: outputStats.size,
        sizeKB: Math.round(outputStats.size / 1024),
      });

      // Check for specific AI agent fields
      const expectedFields = [
        "metadata",
        "summary",
        "content_strategy",
        "actions",
        "tools",
        "automation",
        "public_persona",
        "validation",
        "feedback",
      ];

      const foundFields = expectedFields.filter((field) => result[field]);
      const missingFields = expectedFields.filter((field) => !result[field]);

      console.log(`\n📋 AI Agent Specification Analysis for ${model}:`);
      console.log(
        `✅ Found fields (${foundFields.length}/${expectedFields.length}):`,
        foundFields.join(", ")
      );
      if (missingFields.length > 0) {
        console.log(
          `❌ Missing fields (${missingFields.length}):`,
          missingFields.join(", ")
        );
      }

      // Quality scores analysis if present
      if (result.validation?.section_scores) {
        console.log(`\n📊 Quality Scores for ${model}:`);
        for (const [section, score] of Object.entries(
          result.validation.section_scores
        )) {
          const emoji =
            score >= 8 ? "🟢" : score >= 6 ? "🟡" : score >= 4 ? "🟠" : "🔴";
          console.log(`  ${emoji} ${section}: ${score}/10`);
        }

        if (result.validation.overall_quality) {
          console.log(
            `\n🎯 Overall Quality for ${model}: ${result.validation.overall_quality}/10`
          );
        }
      }

      // Show any recommendations
      if (result.feedback?.recommendations?.length > 0) {
        console.log(`\n💡 Recommendations for ${model}:`);
        for (const [i, rec] of result.feedback.recommendations
          .slice(0, 3)
          .entries()) {
          console.log(`  ${i + 1}. [${rec.section}] ${rec.suggestion}`);
        }
        if (result.feedback.recommendations.length > 3) {
          console.log(
            `  ... and ${result.feedback.recommendations.length - 3} more recommendations`
          );
        }
      }
    }

    // Show failed models
    if (failed.length > 0) {
      console.log("\n❌ FAILED MODELS:");
      for (const { model, error } of failed) {
        console.log(`  🤖 ${model}: ${error}`);

        // Try to identify the specific issue
        if (error.includes("responses")) {
          console.log(
            "    💡 Hint: This might be a responses API issue. Check if the API endpoint is correct."
          );
        } else if (error.includes("API key")) {
          console.log(
            "    💡 Hint: This looks like an API key issue. Check your OPENAI_API_KEY."
          );
        } else if (error.includes("parse")) {
          console.log(
            "    💡 Hint: The LLM returned invalid JSON. This might be a prompt or model issue."
          );
        }
      }
    }

    console.log(
      `\n🎉 Raccook processing test completed! ${successful.length}/${MODELS_TO_TEST.length} models succeeded.`
    );
  } catch (error) {
    logger.error("Raccook test failed", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Run the test
testRaccookProcessing();
