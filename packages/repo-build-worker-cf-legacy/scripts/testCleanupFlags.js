// Test cleanup flags by monitoring the /tmp directory
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";

const TEMP_BASE = process.env.TEMP_DIR || "/tmp";
const WORKER_CACHE = path.join(TEMP_BASE, "repo.md/worker-cache");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function listTempDirs() {
  try {
    await ensureDir(WORKER_CACHE);
    const entries = await fs.readdir(WORKER_CACHE);
    return entries.filter(e => e.startsWith("deploy-"));
  } catch (error) {
    return [];
  }
}

async function runWorkerWithEnv(env, duration = 60000) {
  console.log(`\n🚀 Starting worker with env:`, env);
  
  // Start worker process
  const worker = spawn("node", ["src/worker.js"], {
    env: { ...process.env, ...env },
    cwd: process.cwd()
  });

  let output = "";
  worker.stdout.on("data", (data) => {
    output += data.toString();
    if (data.toString().includes("Worker service listening")) {
      console.log("✅ Worker started successfully");
    }
  });

  worker.stderr.on("data", (data) => {
    console.error("Worker error:", data.toString());
  });

  // Wait a bit for startup
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Submit a test job
  const jobId = `test-${Date.now()}`;
  console.log(`📝 Submitting job: ${jobId}`);
  
  const response = await fetch("http://localhost:5522/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId,
      task: "deploy-repo",
      data: {
        repoUrl: "https://github.com/public/hello-world",
        branch: "main"
      },
      callbackUrl: "http://localhost:5522/health" // Use health endpoint as dummy callback
    })
  });

  const result = await response.json();
  console.log("📨 Job response:", result);

  // Monitor temp directories
  console.log("📁 Monitoring temp directories...");
  const initialDirs = await listTempDirs();
  console.log(`  Initial dirs: ${initialDirs.length}`);
  
  // Wait for job to create temp dir
  await new Promise(resolve => setTimeout(resolve, 5000));
  const duringDirs = await listTempDirs();
  console.log(`  During processing: ${duringDirs.length} dirs`);
  
  // Find new directories
  const newDirs = duringDirs.filter(d => !initialDirs.includes(d) && d.includes(jobId));
  if (newDirs.length > 0) {
    console.log(`  ✅ Job created temp dir: ${newDirs[0]}`);
  }

  // Wait for job completion
  console.log("⏳ Waiting for job completion...");
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  const finalDirs = await listTempDirs();
  console.log(`  After completion: ${finalDirs.length} dirs`);
  
  // Check if our job's directory was cleaned
  const stillExists = finalDirs.some(d => d.includes(jobId));
  
  if (stillExists) {
    console.log("  ❌ Temp directory NOT cleaned (still exists)");
    // Clean it up manually
    const dirToClean = finalDirs.find(d => d.includes(jobId));
    if (dirToClean) {
      await fs.rm(path.join(WORKER_CACHE, dirToClean), { recursive: true, force: true });
      console.log("  🧹 Manually cleaned up test directory");
    }
  } else {
    console.log("  ✅ Temp directory was cleaned successfully!");
  }

  // Kill worker
  worker.kill();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return !stillExists; // Return true if cleaned
}

async function runTests() {
  console.log("🧪 Testing temp directory cleanup with different flags\n");
  
  // Test 1: Default behavior
  console.log("=" * 60);
  console.log("TEST 1: Default behavior (no flags set)");
  console.log("Expected: Directory should be cleaned up");
  const test1 = await runWorkerWithEnv({});
  console.log(`Result: ${test1 ? "✅ PASS" : "❌ FAIL"}`);
  
  // Test 2: PURGE_TMP_DIR=false
  console.log("\n" + "=" * 60);
  console.log("TEST 2: PURGE_TMP_DIR=false");
  console.log("Expected: Directory should NOT be cleaned up");
  const test2 = await runWorkerWithEnv({ PURGE_TMP_DIR: "false" });
  console.log(`Result: ${!test2 ? "✅ PASS" : "❌ FAIL"} (inverse check)`);
  
  // Test 3: PURGE_TMP_DIR=true
  console.log("\n" + "=" * 60);
  console.log("TEST 3: PURGE_TMP_DIR=true");
  console.log("Expected: Directory should be cleaned up");
  const test3 = await runWorkerWithEnv({ PURGE_TMP_DIR: "true" });
  console.log(`Result: ${test3 ? "✅ PASS" : "❌ FAIL"}`);
  
  // Test 4: KEEP_TMP_FILES=true (legacy flag)
  console.log("\n" + "=" * 60);
  console.log("TEST 4: KEEP_TMP_FILES=true (legacy flag)");
  console.log("Expected: Directory should NOT be cleaned up");
  const test4 = await runWorkerWithEnv({ KEEP_TMP_FILES: "true" });
  console.log(`Result: ${!test4 ? "✅ PASS" : "❌ FAIL"} (inverse check)`);
  
  // Summary
  console.log("\n" + "=" * 60);
  console.log("SUMMARY:");
  console.log(`Test 1 (default): ${test1 ? "✅" : "❌"}`);
  console.log(`Test 2 (PURGE_TMP_DIR=false): ${!test2 ? "✅" : "❌"}`);
  console.log(`Test 3 (PURGE_TMP_DIR=true): ${test3 ? "✅" : "❌"}`);
  console.log(`Test 4 (KEEP_TMP_FILES=true): ${!test4 ? "✅" : "❌"}`);
}

// Run tests
runTests().catch(console.error).finally(() => process.exit(0));