// Quick test for cleanup functionality
import fs from "fs/promises";
import path from "path";

const jobId = `cleanup-test-${Date.now()}`;
const tempDir = path.join("/tmp", `test-${jobId}`);

console.log("🧪 Testing cleanup functionality\n");

// Test 1: Create temp directory and verify cleanup with default settings
console.log("1. Creating test temp directory:", tempDir);
await fs.mkdir(tempDir, { recursive: true });
await fs.writeFile(path.join(tempDir, "test.txt"), "test content");

// Import and test cleanup function directly
const { cleanupTempFolder } = await import("../src/worker.js");

// Mock logger
const mockLogger = {
  log: console.log,
  error: console.error
};

console.log("\n2. Testing cleanup with default settings (PURGE_TMP_DIR not set)");
delete process.env.PURGE_TMP_DIR;
delete process.env.KEEP_TMP_FILES;

await cleanupTempFolder(tempDir, jobId, mockLogger);

try {
  await fs.access(tempDir);
  console.log("❌ Directory still exists (should have been cleaned)");
} catch {
  console.log("✅ Directory cleaned successfully");
}

// Test 2: Create temp directory and test with PURGE_TMP_DIR=false
const tempDir2 = path.join("/tmp", `test2-${jobId}`);
console.log("\n3. Creating another test directory:", tempDir2);
await fs.mkdir(tempDir2, { recursive: true });
await fs.writeFile(path.join(tempDir2, "test.txt"), "test content");

console.log("\n4. Testing cleanup with PURGE_TMP_DIR=false");
process.env.PURGE_TMP_DIR = "false";

await cleanupTempFolder(tempDir2, jobId, mockLogger);

try {
  await fs.access(tempDir2);
  console.log("✅ Directory still exists (correct - cleanup was skipped)");
  // Clean it up manually
  await fs.rm(tempDir2, { recursive: true, force: true });
} catch {
  console.log("❌ Directory was cleaned (should have been skipped)");
}

// Test 3: Test with KEEP_TMP_FILES=true
const tempDir3 = path.join("/tmp", `test3-${jobId}`);
console.log("\n5. Creating another test directory:", tempDir3);
await fs.mkdir(tempDir3, { recursive: true });
await fs.writeFile(path.join(tempDir3, "test.txt"), "test content");

console.log("\n6. Testing cleanup with KEEP_TMP_FILES=true");
delete process.env.PURGE_TMP_DIR;
process.env.KEEP_TMP_FILES = "true";

await cleanupTempFolder(tempDir3, jobId, mockLogger);

try {
  await fs.access(tempDir3);
  console.log("✅ Directory still exists (correct - cleanup was skipped)");
  // Clean it up manually
  await fs.rm(tempDir3, { recursive: true, force: true });
} catch {
  console.log("❌ Directory was cleaned (should have been skipped)");
}

console.log("\n✅ All tests completed!");

// Clean up environment
delete process.env.PURGE_TMP_DIR;
delete process.env.KEEP_TMP_FILES;