#!/usr/bin/env node

/**
 * Test script for REPO.json generation functionality
 * Tests the buildAssets process with our test portfolio
 */

import path from "path";
import fs from "fs/promises";
import buildAssets from "../src/process/buildAssets.js";

const TEST_REPO_PATH = path.join(process.cwd(), "test", "portfolio");
const TEST_DIST_PATH = path.join(process.cwd(), "test", "portfolio", "dist");

async function testRepoJsonGeneration() {
  console.log("🧪 Testing REPO.json generation functionality");
  console.log(`📁 Test repo path: ${TEST_REPO_PATH}`);
  console.log(`📁 Test dist path: ${TEST_DIST_PATH}`);

  try {
    // Create a simple logger for testing
    const logger = {
      log: (message, meta = {}) => {
        console.log(`[TEST] ${message}`, meta);
      },
      error: (message, meta = {}) => {
        console.error(`[TEST ERROR] ${message}`, meta);
      }
    };

    // Prepare test data structure similar to what buildAssets expects
    const testData = {
      jobId: "test-repo-json-" + Date.now(),
      repoInfo: {
        path: TEST_REPO_PATH,
        distPath: TEST_DIST_PATH
      },
      logger: logger,
      mediaPrefix: "/_repo/medias",
      notePrefix: "/_repo/notes",
      domain: "test.example.com"
    };

    // Verify test files exist
    console.log("\n📋 Checking test files...");
    try {
      const repoMdContent = await fs.readFile(path.join(TEST_REPO_PATH, "REPO.md"), "utf-8");
      console.log("✅ REPO.md found and readable");
      console.log(`📄 Content preview: ${repoMdContent.substring(0, 100)}...`);
    } catch (error) {
      console.error("❌ REPO.md not found or not readable:", error.message);
      return;
    }

    // Clean up any existing dist folder for fresh test
    try {
      await fs.rm(TEST_DIST_PATH, { recursive: true, force: true });
      console.log("🧹 Cleaned up existing dist folder");
    } catch (error) {
      // It's okay if the folder doesn't exist
    }

    console.log("\n🚀 Running buildAssets process...");
    
    // Run buildAssets which should now include REPO.json generation
    const result = await buildAssets(testData);
    
    console.log("\n✅ buildAssets completed successfully!");
    
    // Check if REPO.json was generated
    if (result.repoJson) {
      console.log("\n📊 REPO.json generation result:");
      console.log(JSON.stringify(result.repoJson, null, 2));
      
      if (result.repoJson.repoJsonGenerated) {
        console.log("✅ REPO.json was generated successfully!");
        console.log(`📁 Path: ${result.repoJson.repoJsonPath}`);
        
        // Try to read and display the generated JSON
        try {
          const generatedJson = await fs.readFile(result.repoJson.repoJsonPath, "utf-8");
          console.log("\n📄 Generated REPO.json content:");
          console.log(generatedJson);
        } catch (error) {
          console.error("❌ Could not read generated REPO.json:", error.message);
        }
      } else {
        console.log("⚠️ REPO.json generation was skipped or failed");
        if (result.repoJson.error) {
          console.error("Error:", result.repoJson.error);
        }
      }
    } else {
      console.log("❌ No REPO.json result found in buildAssets output");
    }

    // List generated files in dist folder
    console.log("\n📁 Files generated in dist folder:");
    try {
      const distFiles = await fs.readdir(TEST_DIST_PATH);
      distFiles.forEach(file => {
        console.log(`  - ${file}`);
      });
    } catch (error) {
      console.error("❌ Could not read dist folder:", error.message);
    }

    console.log("\n🎉 Test completed!");

  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

// Run the test
testRepoJsonGeneration();