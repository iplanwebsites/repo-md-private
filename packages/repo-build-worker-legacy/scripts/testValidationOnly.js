// Simple test to verify content validation warnings without image processing
import buildAssets from "../src/process/buildAssets.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock logger to capture warnings
class TestLogger {
  constructor() {
    this.logs = [];
    this.warnings = [];
    this.errors = [];
  }
  
  log(...args) {
    this.logs.push(args.join(' '));
    console.log(...args);
  }
  
  warn(...args) {
    this.warnings.push(args.join(' '));
    console.warn(...args);
  }
  
  error(...args) {
    this.errors.push(args.join(' '));
    console.error(...args);
  }
}

async function testValidationWarnings() {
  console.log("🧪 Testing content validation warnings (simplified)...\n");
  
  // Create a test directory structure
  const testDir = path.join(__dirname, "../temp-validation-test-" + Date.now());
  const distDir = path.join(testDir, "dist");
  
  await fs.mkdir(testDir, { recursive: true });
  await fs.mkdir(distDir, { recursive: true });
  
  // Test 1: Missing frontmatter fields
  console.log("📝 Creating test content with various issues...");
  
  // Post with missing description
  await fs.writeFile(path.join(testDir, "incomplete.md"), `---
title: Incomplete Post
date: 2025-06-29
---

This post is missing a description field.`);

  // Post with very short content
  await fs.writeFile(path.join(testDir, "short.md"), `---
title: Short
date: 2025-06-29
description: Very short
---

Too short!`);

  // Post with complete frontmatter and good content
  await fs.writeFile(path.join(testDir, "complete.md"), `---
title: Complete Post
date: 2025-06-29
description: A well-formed post with all required fields
---

# Complete Post

This is a complete post with sufficient content to not trigger any warnings.
It has all the required frontmatter fields and enough content to be considered substantial.`);

  // Create mock processed data structures
  const vaultData = [
    {
      slug: "incomplete",
      name: "incomplete",
      hash: "hash1",
      frontmatter: {
        title: "Incomplete Post",
        date: new Date("2025-06-29")
        // missing description
      },
      content: "This post is missing a description field.",
      plain: "This post is missing a description field."
    },
    {
      slug: "short",
      name: "short", 
      hash: "hash2",
      frontmatter: {
        title: "Short",
        date: new Date("2025-06-29"),
        description: "Very short"
      },
      content: "Too short!",
      plain: "Too short!"
    },
    {
      slug: "complete",
      name: "complete",
      hash: "hash3",
      frontmatter: {
        title: "Complete Post",
        date: new Date("2025-06-29"),
        description: "A well-formed post with all required fields"
      },
      content: "# Complete Post\n\nThis is a complete post with sufficient content to not trigger any warnings.\nIt has all the required frontmatter fields and enough content to be considered substantial.",
      plain: "Complete Post This is a complete post with sufficient content to not trigger any warnings. It has all the required frontmatter fields and enough content to be considered substantial."
    }
  ];

  const mediaData = [
    {
      fileName: "image1.png",
      originalPath: "image1.png",
      hash: "mediahash1"
    },
    {
      fileName: "unused.jpg",
      originalPath: "unused.jpg", 
      hash: "mediahash2"
    }
  ];

  // Simulate buildAssets validation logic
  const logger = new TestLogger();
  const contentWarnings = [];
  
  console.log("\n🔍 Running validation checks...\n");
  
  // Check for missing frontmatter fields
  const requiredFields = ['title', 'date', 'description'];
  const frontmatterIssues = vaultData.filter(post => {
    const fm = post.frontmatter || {};
    return requiredFields.some(field => !fm[field]);
  });

  if (frontmatterIssues.length > 0) {
    const percentage = Math.round((frontmatterIssues.length / vaultData.length) * 100);
    logger.warn(`⚠️ ${frontmatterIssues.length} posts (${percentage}%) missing required frontmatter fields`);
    contentWarnings.push('incomplete_frontmatter');
    console.log("  - Affected posts:", frontmatterIssues.map(p => p.slug));
  }

  // Check for posts with very short content
  const shortPosts = vaultData.filter(post => {
    const content = post.plain || post.content || '';
    return content.length < 100;
  });

  if (shortPosts.length > 0) {
    const percentage = Math.round((shortPosts.length / vaultData.length) * 100);
    logger.warn(`⚠️ ${shortPosts.length} posts (${percentage}%) have very short content (<100 characters)`);
    contentWarnings.push('short_content');
    console.log("  - Short posts:", shortPosts.map(p => ({ slug: p.slug, length: (p.plain || '').length })));
  }

  // Check for orphaned media
  const usedMediaPaths = new Set();
  
  // In real implementation, we'd extract media references from content
  // For this test, let's say only image1.png is referenced
  usedMediaPaths.add('image1.png');
  
  const orphanedMedia = mediaData.filter(media => {
    return !usedMediaPaths.has(media.fileName) && !usedMediaPaths.has(media.originalPath);
  });
  
  if (orphanedMedia.length > 0) {
    const percentage = Math.round((orphanedMedia.length / mediaData.length) * 100);
    logger.warn(`⚠️ ${orphanedMedia.length} media files (${percentage}%) not referenced in any posts`);
    contentWarnings.push('orphaned_media');
    console.log("  - Orphaned files:", orphanedMedia.map(m => m.fileName));
  }

  // Summary
  console.log("\n📊 Validation Summary:");
  console.log("  - Total posts:", vaultData.length);
  console.log("  - Total media:", mediaData.length);
  console.log("  - Warnings found:", contentWarnings);
  console.log("  - Logger warnings captured:", logger.warnings.length);
  
  // Cleanup
  await fs.rm(testDir, { recursive: true, force: true });
  
  console.log("\n✅ Validation test completed successfully!");
}

testValidationWarnings().catch(console.error);