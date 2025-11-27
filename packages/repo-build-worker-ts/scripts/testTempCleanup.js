// Test script for temporary directory cleanup functionality
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_API_URL = process.env.TEST_API_URL || "http://localhost:5522";
const TEST_CALLBACK_URL = process.env.TEST_CALLBACK_URL || "http://localhost:5522/test-callback";

// Helper to create a test job
async function createTestJob(taskType = "deploy-repo", purgeFlag = null) {
  const jobData = {
    task: taskType,
    data: {
      repoUrl: "https://github.com/public/hello-world",
      branch: "main",
      buildCommands: [],
      gitToken: process.env.GITHUB_TOKEN
    },
    callbackUrl: TEST_CALLBACK_URL
  };

  // Set environment variable if specified
  if (purgeFlag !== null) {
    process.env.PURGE_TMP_DIR = purgeFlag;
  }

  const response = await fetch(`${TEST_API_URL}/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(jobData),
  });

  const result = await response.json();
  console.log(`  API Response:`, result);
  return result.jobId;
}

// Helper to check if temp directory exists
async function checkTempDirectory(pattern) {
  const tmpBase = process.env.TEMP_DIR || "/tmp";
  const searchPath = path.join(tmpBase, "repo.md/worker-cache");
  
  try {
    const entries = await fs.readdir(searchPath);
    const matching = entries.filter(entry => entry.includes(pattern));
    
    for (const dir of matching) {
      const fullPath = path.join(searchPath, dir);
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        console.log(`✅ Found temp directory: ${fullPath}`);
        return fullPath;
      }
    }
  } catch (error) {
    console.log(`❌ No temp directories found matching pattern: ${pattern}`);
  }
  
  return null;
}

// Helper to wait for job completion
async function waitForJobCompletion(jobId, maxWaitTime = 60000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if temp directory still exists
    const tempDir = await checkTempDirectory(jobId);
    if (!tempDir) {
      console.log(`✅ Temp directory cleaned up for job ${jobId}`);
      return true;
    }
  }
  
  console.log(`⏱️ Timeout waiting for cleanup of job ${jobId}`);
  return false;
}

// Test scenarios
async function runTests() {
  console.log("🧪 Starting temp directory cleanup tests...\n");

  // Test 1: Default behavior (PURGE_TMP_DIR not set - should clean up)
  console.log("📋 Test 1: Default behavior (should clean up)");
  delete process.env.PURGE_TMP_DIR;
  delete process.env.KEEP_TMP_FILES;
  
  const jobId1 = await createTestJob("deploy-repo");
  console.log(`  Created job: ${jobId1}`);
  
  // Wait a bit for job to create temp directory
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const tempDir1 = await checkTempDirectory(jobId1);
  if (tempDir1) {
    console.log(`  Temp directory created: ${tempDir1}`);
  }
  
  // Wait for cleanup
  const cleaned1 = await waitForJobCompletion(jobId1, 30000);
  console.log(`  Cleanup result: ${cleaned1 ? "✅ SUCCESS" : "❌ FAILED"}\n`);

  // Test 2: PURGE_TMP_DIR=false (should NOT clean up)
  console.log("📋 Test 2: PURGE_TMP_DIR=false (should NOT clean up)");
  process.env.PURGE_TMP_DIR = "false";
  
  const jobId2 = await createTestJob("deploy-repo");
  console.log(`  Created job: ${jobId2}`);
  
  // Wait a bit for job to create temp directory
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const tempDir2 = await checkTempDirectory(jobId2);
  if (tempDir2) {
    console.log(`  Temp directory created: ${tempDir2}`);
  }
  
  // Wait and check - directory should still exist
  await new Promise(resolve => setTimeout(resolve, 30000));
  const stillExists2 = await checkTempDirectory(jobId2);
  console.log(`  Directory after wait: ${stillExists2 ? "✅ Still exists (correct)" : "❌ Was cleaned (incorrect)"}`);
  
  // Manual cleanup for test 2
  if (stillExists2) {
    await fs.rm(stillExists2, { recursive: true, force: true });
    console.log(`  Manually cleaned up test directory\n`);
  }

  // Test 3: PURGE_TMP_DIR=true (should clean up)
  console.log("📋 Test 3: PURGE_TMP_DIR=true (should clean up)");
  process.env.PURGE_TMP_DIR = "true";
  
  const jobId3 = await createTestJob("deploy-repo");
  console.log(`  Created job: ${jobId3}`);
  
  // Wait a bit for job to create temp directory
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const tempDir3 = await checkTempDirectory(jobId3);
  if (tempDir3) {
    console.log(`  Temp directory created: ${tempDir3}`);
  }
  
  // Wait for cleanup
  const cleaned3 = await waitForJobCompletion(jobId3, 30000);
  console.log(`  Cleanup result: ${cleaned3 ? "✅ SUCCESS" : "❌ FAILED"}\n`);

  // Test 4: KEEP_TMP_FILES=true (legacy flag - should NOT clean up)
  console.log("📋 Test 4: KEEP_TMP_FILES=true (legacy flag - should NOT clean up)");
  delete process.env.PURGE_TMP_DIR;
  process.env.KEEP_TMP_FILES = "true";
  
  const jobId4 = await createTestJob("deploy-repo");
  console.log(`  Created job: ${jobId4}`);
  
  // Wait a bit for job to create temp directory
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const tempDir4 = await checkTempDirectory(jobId4);
  if (tempDir4) {
    console.log(`  Temp directory created: ${tempDir4}`);
  }
  
  // Wait and check - directory should still exist
  await new Promise(resolve => setTimeout(resolve, 30000));
  const stillExists4 = await checkTempDirectory(jobId4);
  console.log(`  Directory after wait: ${stillExists4 ? "✅ Still exists (correct)" : "❌ Was cleaned (incorrect)"}`);
  
  // Manual cleanup for test 4
  if (stillExists4) {
    await fs.rm(stillExists4, { recursive: true, force: true });
    console.log(`  Manually cleaned up test directory\n`);
  }

  console.log("✅ All tests completed!");
  
  // Reset environment
  delete process.env.PURGE_TMP_DIR;
  delete process.env.KEEP_TMP_FILES;
}

// Create a simple test callback endpoint
import express from "express";
const app = express();
app.use(express.json());

app.post("/test-callback", (req, res) => {
  console.log(`📥 Received callback for job ${req.body.jobId}: ${req.body.status}`);
  res.json({ received: true });
});

// Start test server and run tests
const server = app.listen(5523, async () => {
  console.log("🚀 Test callback server listening on port 5523");
  console.log("   Make sure the worker is running on port 5522\n");
  
  try {
    await runTests();
  } catch (error) {
    console.error("❌ Test error:", error);
  } finally {
    server.close();
    process.exit(0);
  }
});