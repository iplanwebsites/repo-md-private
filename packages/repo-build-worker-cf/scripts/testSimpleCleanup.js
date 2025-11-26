// Simple test to verify temp directory cleanup
import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";

const API_URL = "http://localhost:5522";

async function testCleanup() {
  console.log("🧪 Testing temp directory cleanup...\n");

  // Test 1: With PURGE_TMP_DIR=true (default behavior)
  console.log("Test 1: Normal cleanup (PURGE_TMP_DIR not set)");
  
  const jobId1 = `test-cleanup-${Date.now()}`;
  const response1 = await fetch(`${API_URL}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: jobId1,
      task: "deploy-repo",
      data: {
        repoUrl: "https://github.com/public/hello-world",
        branch: "main"
      },
      callbackUrl: "http://localhost:5522/test"
    })
  });

  const result1 = await response1.json();
  console.log("Response:", result1);
  
  if (result1.jobId) {
    console.log(`✅ Job created with ID: ${result1.jobId}`);
    console.log("Wait 30 seconds for job to complete and check cleanup...");
    
    // Wait for job completion
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Check if temp directory exists
    const tmpBase = process.env.TEMP_DIR || "/tmp";
    const searchPath = path.join(tmpBase, "repo.md/worker-cache");
    
    try {
      const entries = await fs.readdir(searchPath);
      const matching = entries.filter(entry => entry.includes(result1.jobId));
      
      if (matching.length === 0) {
        console.log("✅ Temp directory was cleaned up successfully!");
      } else {
        console.log("❌ Temp directory still exists:", matching);
      }
    } catch (error) {
      console.log("ℹ️ Worker cache directory not found (may be expected)");
    }
  }
  
  console.log("\n---\n");
  
  // Test 2: With PURGE_TMP_DIR=false
  console.log("Test 2: Cleanup disabled (setting PURGE_TMP_DIR=false via API)");
  
  const jobId2 = `test-no-cleanup-${Date.now()}`;
  const response2 = await fetch(`${API_URL}/process`, {
    method: "POST", 
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: jobId2,
      task: "deploy-repo",
      data: {
        repoUrl: "https://github.com/public/hello-world",
        branch: "main",
        PURGE_TMP_DIR: "false" // Try to pass via data
      },
      callbackUrl: "http://localhost:5522/test"
    })
  });

  const result2 = await response2.json();
  console.log("Response:", result2);
  
  if (result2.jobId) {
    console.log(`✅ Job created with ID: ${result2.jobId}`);
  }
}

// Run test
testCleanup().catch(console.error);