// Test script to verify content validation warnings
import buildAssets from "../src/process/buildAssets.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createTestRepo(hasContent = true, hasMedia = true, options = {}) {
  const tempDir = path.join(__dirname, "../temp-test-" + Date.now());
  await fs.mkdir(tempDir, { recursive: true });
  
  if (hasContent) {
    if (options.missingFrontmatter) {
      // Create a markdown file with missing frontmatter fields
      const content = `---
title: Test Post
---

# Test Content

This is a test post without date and description.`;
      
      await fs.writeFile(path.join(tempDir, "incomplete.md"), content);
    } else if (options.shortContent) {
      // Create a markdown file with very short content
      const content = `---
title: Short Post
date: 2025-06-29
description: A very short post
---

Too short.`;
      
      await fs.writeFile(path.join(tempDir, "short.md"), content);
    } else if (options.withMediaRef) {
      // Create a markdown file that references an image
      const content = `---
title: Post with Image
date: 2025-06-29
description: A post that uses an image
---

# Test Content

Here's an image: ![test](image.png)

This is a test post with media reference.`;
      
      await fs.writeFile(path.join(tempDir, "with-media.md"), content);
    } else {
      // Create a simple markdown file
      const content = `---
title: Test Post
date: 2025-06-29
description: A complete test post
---

# Test Content

This is a test post with sufficient content to not trigger the short content warning.`;
      
      await fs.writeFile(path.join(tempDir, "test.md"), content);
    }
  }
  
  if (hasMedia) {
    // Create a simple image placeholder
    await fs.writeFile(path.join(tempDir, "image.png"), Buffer.from([0x89, 0x50, 0x4E, 0x47]));
    
    if (options.extraMedia) {
      // Create an extra unreferenced image
      await fs.writeFile(path.join(tempDir, "unused.jpg"), Buffer.from([0xFF, 0xD8, 0xFF]));
    }
  }
  
  return tempDir;
}

async function runTest() {
  console.log("🧪 Testing content validation warnings...\n");
  
  // Test 1: No posts warning
  console.log("Test 1: Repository with no posts (media only)");
  const noPostsRepo = await createTestRepo(false, true);
  
  try {
    const result1 = await buildAssets({
      jobId: "test-no-posts",
      repoInfo: {
        path: noPostsRepo,
        distPath: path.join(noPostsRepo, "dist")
      }
    });
    
    console.log("✅ Content health warnings:", result1.contentHealth.warnings);
    console.log("📊 Metrics:", result1.contentHealth.metrics);
  } catch (error) {
    console.error("❌ Test 1 failed:", error.message);
  } finally {
    await fs.rm(noPostsRepo, { recursive: true, force: true });
  }
  
  console.log("\n" + "=".repeat(50) + "\n");
  
  // Test 2: No media warning
  console.log("Test 2: Repository with no media (posts only)");
  const noMediaRepo = await createTestRepo(true, false);
  
  try {
    const result2 = await buildAssets({
      jobId: "test-no-media",
      repoInfo: {
        path: noMediaRepo,
        distPath: path.join(noMediaRepo, "dist")
      }
    });
    
    console.log("✅ Content health warnings:", result2.contentHealth.warnings);
    console.log("📊 Metrics:", result2.contentHealth.metrics);
  } catch (error) {
    console.error("❌ Test 2 failed:", error.message);
  } finally {
    await fs.rm(noMediaRepo, { recursive: true, force: true });
  }
  
  console.log("\n" + "=".repeat(50) + "\n");
  
  // Test 3: Normal repo (should have no warnings)
  console.log("Test 3: Normal repository (posts and media)");
  const normalRepo = await createTestRepo(true, true);
  
  try {
    const result3 = await buildAssets({
      jobId: "test-normal",
      repoInfo: {
        path: normalRepo,
        distPath: path.join(normalRepo, "dist")
      }
    });
    
    console.log("✅ Content health warnings:", result3.contentHealth.warnings);
    console.log("📊 Metrics:", result3.contentHealth.metrics);
  } catch (error) {
    console.error("❌ Test 3 failed:", error.message);
  } finally {
    await fs.rm(normalRepo, { recursive: true, force: true });
  }
  
  console.log("\n" + "=".repeat(50) + "\n");
  
  // Test 4: Missing frontmatter warning
  console.log("Test 4: Repository with incomplete frontmatter");
  const incompleteFrontmatterRepo = await createTestRepo(true, true, { missingFrontmatter: true });
  
  try {
    const result4 = await buildAssets({
      jobId: "test-incomplete-frontmatter",
      repoInfo: {
        path: incompleteFrontmatterRepo,
        distPath: path.join(incompleteFrontmatterRepo, "dist")
      }
    });
    
    console.log("✅ Content health warnings:", result4.contentHealth.warnings);
    console.log("📊 Metrics:", result4.contentHealth.metrics);
  } catch (error) {
    console.error("❌ Test 4 failed:", error.message);
  } finally {
    await fs.rm(incompleteFrontmatterRepo, { recursive: true, force: true });
  }
  
  console.log("\n" + "=".repeat(50) + "\n");
  
  // Test 5: Short content warning
  console.log("Test 5: Repository with short content");
  const shortContentRepo = await createTestRepo(true, true, { shortContent: true });
  
  try {
    const result5 = await buildAssets({
      jobId: "test-short-content",
      repoInfo: {
        path: shortContentRepo,
        distPath: path.join(shortContentRepo, "dist")
      }
    });
    
    console.log("✅ Content health warnings:", result5.contentHealth.warnings);
    console.log("📊 Metrics:", result5.contentHealth.metrics);
  } catch (error) {
    console.error("❌ Test 5 failed:", error.message);
  } finally {
    await fs.rm(shortContentRepo, { recursive: true, force: true });
  }
  
  console.log("\n" + "=".repeat(50) + "\n");
  
  // Test 6: Orphaned media warning
  console.log("Test 6: Repository with orphaned media");
  const orphanedMediaRepo = await createTestRepo(true, true, { extraMedia: true });
  
  try {
    const result6 = await buildAssets({
      jobId: "test-orphaned-media",
      repoInfo: {
        path: orphanedMediaRepo,
        distPath: path.join(orphanedMediaRepo, "dist")
      }
    });
    
    console.log("✅ Content health warnings:", result6.contentHealth.warnings);
    console.log("📊 Metrics:", result6.contentHealth.metrics);
  } catch (error) {
    console.error("❌ Test 6 failed:", error.message);
  } finally {
    await fs.rm(orphanedMediaRepo, { recursive: true, force: true });
  }
  
  console.log("\n🎉 Content validation tests completed!");
}

runTest().catch(console.error);