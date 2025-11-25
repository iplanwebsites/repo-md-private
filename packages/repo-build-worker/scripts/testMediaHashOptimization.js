#!/usr/bin/env node
// scripts/testMediaHashOptimization.js
import "dotenv/config";
import { R2AssetManager } from "../src/services/r2AssetManager.js";
import path from "path";

/**
 * Test script to verify media hash extraction and matching
 */

async function testMediaHashOptimization() {
  console.log("🧪 Testing Media Hash Optimization...\n");

  const testProjectId = process.env.TEST_PROJECT_ID || "6848af1cacdf98346841d302";
  
  try {
    // Create asset manager and fetch existing assets
    console.log("🔍 Creating R2 Asset Manager for project:", testProjectId);
    const assetManager = new R2AssetManager(testProjectId, console);
    
    // Manually test hash extraction patterns
    console.log("\n📝 Testing hash extraction patterns:");
    
    const testFilenames = [
      "01f67db3d6856d888c90b13bcf14b0aafb1dda162265a9982857b218c73d20f6-lg.webp",
      "01f67db3d6856d888c90b13bcf14b0aafb1dda162265a9982857b218c73d20f6-md.jpeg",
      "01f67db3d6856d888c90b13bcf14b0aafb1dda162265a9982857b218c73d20f6.jpg",
      "some-other-file.jpg",
      "a1b2c3d4e5f6789012345678901234567890abcd.json"
    ];
    
    testFilenames.forEach(filename => {
      const hashMatch = filename.match(/^([a-f0-9]{32,64})(?:-\w+)?\./i);
      if (hashMatch) {
        console.log(`✅ ${filename} -> Hash: ${hashMatch[1].substring(0, 16)}...`);
      } else {
        console.log(`❌ ${filename} -> No hash found`);
      }
    });
    
    // Fetch real assets
    console.log("\n🔍 Fetching existing R2 assets...");
    await assetManager.fetchExistingAssets({ maxKeys: 100 });
    
    const stats = assetManager.getOptimizationStats();
    console.log("\n📊 Asset Statistics:", stats);
    
    // Test some hash lookups
    if (assetManager.existingMediaHashes.size > 0) {
      console.log("\n🔍 Testing hash lookups:");
      const sampleHashes = Array.from(assetManager.existingMediaHashes).slice(0, 5);
      
      sampleHashes.forEach(hash => {
        const exists = assetManager.mediaHashExists(hash);
        console.log(`  Hash ${hash.substring(0, 16)}... exists: ${exists}`);
      });
    }
    
    // Show asset breakdown
    console.log("\n📋 Asset Breakdown:");
    let mediaCount = 0;
    let postCount = 0;
    let otherCount = 0;
    
    for (const [key, info] of assetManager.existingAssets) {
      if (info.type === 'media') mediaCount++;
      else if (info.type === 'post') postCount++;
      else otherCount++;
    }
    
    console.log(`  Media files: ${mediaCount}`);
    console.log(`  Post files: ${postCount}`);
    console.log(`  Other files: ${otherCount}`);
    console.log(`  Total: ${assetManager.existingAssets.size}`);
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testMediaHashOptimization().catch(console.error);