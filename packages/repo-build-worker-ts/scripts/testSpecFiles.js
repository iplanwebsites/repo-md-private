#!/usr/bin/env node

/**
 * Test script for processing all sample spec files
 * Processes all .md files in test/sample-specs/ and generates corresponding .json files
 */

import dotenv from "dotenv";
import path from "node:path";

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

import fs from "node:fs/promises";
import { processMarkdownWithLLM } from "../src/lib/specParser.js";

// Models to test
const MODELS_TO_TEST = [
  "gpt-4.1-nano",
  // "gpt-4.1",
  // "gpt-4.1-mini",

  //
  //"gpt-4o-mini",
  //"gpt-4o",
  // "gpt-4-turbo"
];

const SAMPLE_SPECS_DIR = path.join(process.cwd(), "test", "sample-specs");
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
    console.log(`[${timestamp}] ${message}`, meta ? JSON.stringify(meta) : "");
  },
  error: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    console.error(
      `[${timestamp}] ERROR: ${message}`,
      meta ? JSON.stringify(meta) : ""
    );
  },
};

/**
 * Process a single markdown file with a specific model
 * @param {string} filePath - Path to the markdown file
 * @param {string} outputDir - Directory to save the JSON file
 * @param {string} model - Model to use for processing
 * @returns {Promise<Object>} - Processing result
 */
async function processSpecFileWithModel(filePath, outputDir, model) {
  const filename = path.basename(filePath, ".md");
  const modelSuffix = model.replace(/[^a-zA-Z0-9]/g, "-");
  const outputPath = path.join(outputDir, `${filename}-${modelSuffix}.json`);

  try {
    logger.log(`📄 Processing ${filename}.md with ${model}...`);

    // Read the markdown file
    const markdownContent = await fs.readFile(filePath, "utf-8");
    logger.log(
      `📋 Read ${markdownContent.length} characters from ${filename}.md`
    );

    // Process with LLM
    const startTime = Date.now();
    const result = await processMarkdownWithLLM(
      markdownContent,
      filePath,
      logger,
      model
    );
    const processingTime = Date.now() - startTime;

    // Save the JSON result
    await fs.writeFile(outputPath, JSON.stringify(result, null, 2));

    logger.log(`✅ Generated ${filename}-${modelSuffix}.json`, {
      processingTimeMs: processingTime,
      outputPath: outputPath,
      model: model,
      resultFields: Object.keys(result).filter((key) => key !== "_metadata"),
    });

    return {
      success: true,
      inputFile: filePath,
      outputFile: outputPath,
      model: model,
      processingTime: processingTime,
      resultFields: Object.keys(result).filter((key) => key !== "_metadata"),
    };
  } catch (error) {
    logger.error(
      `❌ Failed to process ${filename}.md with ${model}: ${error.message}`
    );
    return {
      success: false,
      inputFile: filePath,
      model: model,
      error: error.message,
    };
  }
}

/**
 * Main function to process all spec files
 */
async function processAllSpecFiles() {
  console.log("🧪 Testing spec file processing with LLM");
  console.log(`📁 Sample specs directory: ${SAMPLE_SPECS_DIR}`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);

  try {
    // Create output directory if it doesn't exist
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    logger.log("📁 Created output directory");

    // Read all .md files from the sample specs directory
    const files = await fs.readdir(SAMPLE_SPECS_DIR);
    const markdownFiles = files.filter((file) => file.endsWith(".md"));

    if (markdownFiles.length === 0) {
      logger.error("No markdown files found in sample specs directory");
      return;
    }

    logger.log(
      `🔍 Found ${markdownFiles.length} markdown files to process with ${MODELS_TO_TEST.length} models:`,
      {
        files: markdownFiles,
        models: MODELS_TO_TEST,
      }
    );

    // Process each file with each model in parallel
    const results = [];
    const startTime = Date.now();

    // Create all processing tasks
    const processingTasks = [];
    for (const file of markdownFiles) {
      const filePath = path.join(SAMPLE_SPECS_DIR, file);
      for (const model of MODELS_TO_TEST) {
        processingTasks.push(
          processSpecFileWithModel(filePath, OUTPUT_DIR, model)
        );
      }
    }

    logger.log(
      `🚀 Starting ${processingTasks.length} processing tasks in parallel...`
    );

    // Run all tasks in parallel
    const allResults = await Promise.allSettled(processingTasks);

    // Extract results from Promise.allSettled
    for (const result of allResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({
          success: false,
          error: result.reason.message || "Unknown error",
          inputFile: "unknown",
          model: "unknown",
        });
      }
    }

    const totalTime = Date.now() - startTime;

    // Generate summary
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log("\n📊 PROCESSING SUMMARY");
    console.log("=".repeat(50));
    console.log(
      `Total tasks: ${results.length} (${markdownFiles.length} files × ${MODELS_TO_TEST.length} models)`
    );
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`⏱️ Total time: ${totalTime}ms`);
    console.log(
      `⏱️ Average time per task: ${Math.round(totalTime / results.length)}ms`
    );

    // Group results by model for better reporting
    const resultsByModel = {};
    for (const model of MODELS_TO_TEST) {
      resultsByModel[model] = {
        successful: results.filter((r) => r.success && r.model === model),
        failed: results.filter((r) => !r.success && r.model === model),
      };
    }

    for (const model of MODELS_TO_TEST) {
      const modelResults = resultsByModel[model];
      console.log(`\n🤖 ${model.toUpperCase()} RESULTS:`);
      console.log(
        `  ✅ Successful: ${modelResults.successful.length}/${markdownFiles.length}`
      );
      console.log(
        `  ❌ Failed: ${modelResults.failed.length}/${markdownFiles.length}`
      );

      if (modelResults.successful.length > 0) {
        console.log(`  📄 Generated files:`);
        for (const result of modelResults.successful) {
          const filename = path.basename(result.inputFile, ".md");
          const modelSuffix = model.replace(/[^a-zA-Z0-9]/g, "-");
          console.log(
            `    - ${filename}-${modelSuffix}.json (${result.processingTime}ms)`
          );
        }
      }

      if (modelResults.failed.length > 0) {
        console.log(`  ❌ Failed files:`);
        for (const result of modelResults.failed) {
          const filename = path.basename(result.inputFile, ".md");
          console.log(`    - ${filename}.md: ${result.error}`);
        }
      }
    }

    // List generated files
    console.log("\n📁 GENERATED FILES:");
    try {
      const generatedFiles = await fs.readdir(OUTPUT_DIR);
      const jsonFiles = generatedFiles.filter((file) => file.endsWith(".json"));
      for (const file of jsonFiles) {
        const filePath = path.join(OUTPUT_DIR, file);
        const stats = await fs.stat(filePath);
        console.log(`  - ${file} (${stats.size} bytes)`);
      }
    } catch (error) {
      logger.error("Could not list generated files:", error.message);
    }

    console.log("\n🎉 Spec file processing test completed!");

    // Exit with appropriate code
    process.exit(failed.length > 0 ? 1 : 0);
  } catch (error) {
    logger.error("Test failed:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

// Run the test
processAllSpecFiles();
