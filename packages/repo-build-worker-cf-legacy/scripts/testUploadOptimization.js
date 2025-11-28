#!/usr/bin/env node
// scripts/testUploadOptimization.js
import "dotenv/config";
import { createR2AssetManager } from "../src/services/r2AssetManager.js";
import { mergeOptimizationConfig } from "../src/config/uploadOptimization.js";
import publishR2 from "../src/process/publishR2.js";
import path from "path";
import fs from "fs/promises";

/**
 * Test script to verify R2 upload optimization is working
 * This simulates a deployment with existing assets and verifies skipping behavior
 */

async function testUploadOptimization() {
  console.log("🧪 Testing R2 Upload Optimization...\n");

  // Test configuration
  const testProjectId = process.env.TEST_PROJECT_ID || "test-project-optimization";
  const testOrgId = process.env.TEST_ORG_ID || "test-org";
  const testJobId = `test-job-${Date.now()}`;
  
  // Create a mock dist folder with some test files
  const testDistPath = path.join(process.cwd(), `temp-test-${Date.now()}`);
  const testMediaPath = path.join(testDistPath, "_medias");
  const testPostsPath = path.join(testDistPath, "posts");
  
  try {
    // Create test directory structure
    await fs.mkdir(testDistPath, { recursive: true });
    await fs.mkdir(testMediaPath, { recursive: true });
    await fs.mkdir(testPostsPath, { recursive: true });
    
    // Create some test files
    await fs.writeFile(
      path.join(testMediaPath, "test-image.jpg"),
      Buffer.from("fake image content")
    );
    await fs.writeFile(
      path.join(testPostsPath, "a1b2c3d4e5f6789012345678901234567890abcd.json"),
      JSON.stringify({ title: "Test Post", content: "Test content" })
    );
    await fs.writeFile(
      path.join(testDistPath, "index.html"),
      "<html><body>Test</body></html>"
    );
    
    console.log("📁 Created test files in:", testDistPath);
    
    // Step 1: Fetch existing assets
    console.log("\n🔍 Step 1: Fetching existing R2 assets...");
    const assetManager = await createR2AssetManager(testProjectId, console, {
      prefetch: true
    });
    
    const stats = assetManager.getOptimizationStats();
    console.log("📊 Existing assets found:", stats);
    
    // Step 2: Run first deployment (should upload all files)
    console.log("\n📤 Step 2: First deployment (should upload all files)...");
    const firstDeployData = {
      projectId: testProjectId,
      orgId: testOrgId,
      jobId: testJobId + "-first",
      assets: {
        distFolder: testDistPath
      },
      uploadOptimization: {
        fetchExistingAssets: false, // Disable for first run
        skipExistingFiles: false,
        skipIdenticalContent: false
      }
    };
    
    const firstResult = await publishR2(firstDeployData);
    console.log("✅ First deployment complete:", {
      total: firstResult.publishInfo.totalFiles,
      uploaded: firstResult.publishInfo.successfulUploads,
      skipped: firstResult.publishInfo.skippedUploads
    });
    
    // Step 3: Run second deployment with optimization (should skip files)
    console.log("\n📤 Step 3: Second deployment with optimization (should skip files)...");
    const secondDeployData = {
      projectId: testProjectId,
      orgId: testOrgId,
      jobId: testJobId + "-second",
      assets: {
        distFolder: testDistPath
      },
      uploadOptimization: {
        fetchExistingAssets: true,
        skipExistingFiles: true,
        skipIdenticalContent: true,
        debugOptimization: true
      }
    };
    
    const secondResult = await publishR2(secondDeployData);
    console.log("✅ Second deployment complete:", {
      total: secondResult.publishInfo.totalFiles,
      uploaded: secondResult.publishInfo.successfulUploads,
      skipped: secondResult.publishInfo.skippedUploads,
      skipReasons: secondResult.publishInfo.skipReasons
    });
    
    // Verify optimization worked
    if (secondResult.publishInfo.skippedUploads > 0) {
      console.log("\n✅ SUCCESS: Optimization is working! Files were skipped.");
    } else {
      console.log("\n⚠️ WARNING: No files were skipped. Optimization may not be working correctly.");
    }
    
    // Step 4: Test with pre-fetched assets
    console.log("\n📤 Step 4: Testing with pre-fetched assets...");
    const preFetchedAssetManager = await createR2AssetManager(testProjectId, console);
    
    const thirdDeployData = {
      projectId: testProjectId,
      orgId: testOrgId,
      jobId: testJobId + "-third",
      assets: {
        distFolder: testDistPath
      },
      existingAssets: {
        assetManager: preFetchedAssetManager,
        existingMediaHashes: preFetchedAssetManager.existingMediaHashes,
        existingPostHashes: preFetchedAssetManager.existingPostHashes
      },
      uploadOptimization: {
        fetchExistingAssets: true,
        skipExistingFiles: true,
        skipIdenticalContent: true
      }
    };
    
    const thirdResult = await publishR2(thirdDeployData);
    console.log("✅ Third deployment complete (with pre-fetched assets):", {
      total: thirdResult.publishInfo.totalFiles,
      uploaded: thirdResult.publishInfo.successfulUploads,
      skipped: thirdResult.publishInfo.skippedUploads,
      optimizationEnabled: thirdResult.publishInfo.optimizationEnabled
    });
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    // Cleanup
    try {
      await fs.rm(testDistPath, { recursive: true, force: true });
      console.log("\n🧹 Cleaned up test files");
    } catch (cleanupError) {
      console.error("Failed to cleanup:", cleanupError.message);
    }
  }
}

// Run the test
testUploadOptimization().catch(console.error);