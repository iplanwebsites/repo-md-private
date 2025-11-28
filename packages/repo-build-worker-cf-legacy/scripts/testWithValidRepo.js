// Test cleanup with a valid public repository
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

const TEMP_BASE = process.env.TEMP_DIR || "/tmp";
const WORKER_CACHE = path.join(TEMP_BASE, "repo.md/worker-cache");

// Use a real public repository that exists
const TEST_REPO = "https://github.com/octocat/Hello-World";

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function listJobDirs(jobId) {
  try {
    await ensureDir(WORKER_CACHE);
    const entries = await fs.readdir(WORKER_CACHE);
    return entries.filter(e => e.includes(jobId));
  } catch (error) {
    return [];
  }
}

async function runTest(envVars = {}) {
  // Kill any existing worker
  try {
    await new Promise(resolve => {
      const kill = spawn("pkill", ["-f", "node src/worker.js"]);
      kill.on("exit", resolve);
    });
  } catch {}
  
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log("🚀 Starting worker with env:", envVars);
  
  // Start worker with specific environment
  const workerEnv = { ...process.env, ...envVars };
  const worker = spawn("node", ["src/worker.js"], {
    env: workerEnv,
    cwd: process.cwd()
  });

  let workerReady = false;
  worker.stdout.on("data", (data) => {
    const output = data.toString();
    if (output.includes("Worker service listening") && !workerReady) {
      workerReady = true;
      console.log("✅ Worker started");
    }
  });

  worker.stderr.on("data", (data) => {
    // Ignore the objc warnings
    const error = data.toString();
    if (!error.includes("GNotificationCenterDelegate")) {
      console.error("Worker error:", error);
    }
  });

  // Wait for worker to start
  let waitTime = 0;
  while (!workerReady && waitTime < 10000) {
    await new Promise(resolve => setTimeout(resolve, 100));
    waitTime += 100;
  }

  if (!workerReady) {
    console.error("❌ Worker failed to start");
    worker.kill();
    return false;
  }

  // Create a test job
  const jobId = `test-${Date.now()}`;
  console.log(`📝 Creating job: ${jobId}`);
  
  const response = await fetch("http://localhost:5522/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId,
      task: "deploy-repo",
      data: {
        repoUrl: TEST_REPO,
        branch: "master",
        buildCommands: [],
        gitToken: process.env.GITHUB_TOKEN
      },
      callbackUrl: "http://localhost:5522/health"
    })
  });

  const result = await response.json();
  if (result.status !== "accepted") {
    console.error("❌ Job not accepted:", result);
    worker.kill();
    return false;
  }

  console.log("✅ Job accepted");

  // Wait a bit for directory creation
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const duringDirs = await listJobDirs(jobId);
  if (duringDirs.length > 0) {
    console.log(`✅ Temp directory created: ${duringDirs[0]}`);
  } else {
    console.log("⚠️ No temp directory found during processing");
  }

  // Wait for job completion (max 60 seconds)
  console.log("⏳ Waiting for job completion...");
  let elapsed = 0;
  let cleaned = false;
  
  while (elapsed < 60000) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    elapsed += 2000;
    
    const currentDirs = await listJobDirs(jobId);
    if (currentDirs.length === 0 && duringDirs.length > 0) {
      cleaned = true;
      break;
    }
  }

  const finalDirs = await listJobDirs(jobId);
  
  // Clean up any remaining directories
  for (const dir of finalDirs) {
    try {
      await fs.rm(path.join(WORKER_CACHE, dir), { recursive: true, force: true });
      console.log(`🧹 Manually cleaned: ${dir}`);
    } catch {}
  }

  // Kill worker
  worker.kill();
  await new Promise(resolve => setTimeout(resolve, 1000));

  return { cleaned, stillExists: finalDirs.length > 0 };
}

async function main() {
  console.log("🧪 Testing temp directory cleanup with valid repository\n");
  console.log(`Using test repository: ${TEST_REPO}\n`);

  // Test 1: Default behavior
  console.log("=" .repeat(60));
  console.log("TEST 1: Default behavior (no flags)");
  console.log("Expected: Directory should be cleaned");
  const test1 = await runTest({});
  console.log(`Result: ${test1.cleaned ? "✅ CLEANED" : "❌ NOT CLEANED"}`);
  console.log();

  // Test 2: PURGE_TMP_DIR=false
  console.log("=" .repeat(60));
  console.log("TEST 2: PURGE_TMP_DIR=false");
  console.log("Expected: Directory should NOT be cleaned");
  const test2 = await runTest({ PURGE_TMP_DIR: "false" });
  console.log(`Result: ${test2.stillExists ? "✅ NOT CLEANED (correct)" : "❌ CLEANED (incorrect)"}`);
  console.log();

  // Test 3: KEEP_TMP_FILES=true
  console.log("=" .repeat(60));
  console.log("TEST 3: KEEP_TMP_FILES=true");
  console.log("Expected: Directory should NOT be cleaned");
  const test3 = await runTest({ KEEP_TMP_FILES: "true" });
  console.log(`Result: ${test3.stillExists ? "✅ NOT CLEANED (correct)" : "❌ CLEANED (incorrect)"}`);
  console.log();

  // Summary
  console.log("=" .repeat(60));
  console.log("SUMMARY:");
  console.log(`Default cleanup: ${test1.cleaned ? "✅ Working" : "❌ Not working"}`);
  console.log(`PURGE_TMP_DIR=false: ${test2.stillExists ? "✅ Working" : "❌ Not working"}`);
  console.log(`KEEP_TMP_FILES=true: ${test3.stillExists ? "✅ Working" : "❌ Not working"}`);
}

main().catch(console.error).finally(() => process.exit(0));