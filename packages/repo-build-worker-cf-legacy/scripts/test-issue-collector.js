#!/usr/bin/env node

/**
 * Test script for issue collector functionality
 * Tests both processor-issues.json (from repo-processor) and worker-issues.json
 */

import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'url';
import buildAssets from '../src/process/buildAssets.js';
import WorkerIssueCollector from '../src/services/issueCollector.js';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Simple logger for testing
const logger = {
  log: (msg, data = {}) => console.log(`[TEST] ${msg}`, data),
  error: (msg, data = {}) => console.error(`[ERROR] ${msg}`, data),
  warn: (msg, data = {}) => console.warn(`[WARN] ${msg}`, data)
};

/**
 * Test the issue collector directly
 */
async function testIssueCollector() {
  console.log('\n🧪 Testing WorkerIssueCollector directly...\n');
  
  const collector = new WorkerIssueCollector();
  
  // Add various types of issues
  collector.addEmbeddingError({
    type: 'image',
    filePath: '/test/image.jpg',
    error: new Error('Failed to load image'),
    operation: 'load'
  });
  
  collector.addDatabaseError({
    operation: 'create-table',
    error: new Error('Table already exists'),
    tableName: 'posts'
  });
  
  collector.addFileSystemError({
    operation: 'read',
    path: '/missing/file.txt',
    error: new Error('ENOENT: no such file or directory')
  });
  
  collector.addConfigWarning({
    setting: 'imageOptimization',
    message: 'Image optimization disabled, this may result in large file sizes',
    suggestion: 'Enable imageOptimization in config'
  });
  
  collector.addPerformanceWarning({
    operation: 'buildAssets',
    duration: 5500,
    threshold: 5000,
    details: {
      filesProcessed: 150,
      imagesProcessed: 45
    }
  });
  
  // Generate report
  const report = collector.generateReport();
  
  console.log('📊 Issue Summary:');
  console.log(`   Total issues: ${report.summary.totalIssues}`);
  console.log(`   Errors: ${report.summary.errorCount}`);
  console.log(`   Warnings: ${report.summary.warningCount}`);
  console.log(`   Info: ${report.summary.infoCount}`);
  console.log('\n📈 Category breakdown:');
  Object.entries(report.summary.categoryCounts).forEach(([category, count]) => {
    if (count > 0) {
      console.log(`   ${category}: ${count}`);
    }
  });
  
  console.log('\n' + collector.getSummaryString());
  
  return report;
}

/**
 * Test with a sample repository
 */
async function testWithSampleRepo() {
  console.log('\n🏗️  Testing with sample repository...\n');
  
  // Look for a test repository
  const testRepoPath = path.join(__dirname, '..', 'test', 'sample-repo');
  const testRepoExists = await fs.access(testRepoPath).then(() => true).catch(() => false);
  
  if (!testRepoExists) {
    console.log('⚠️  No test repository found at:', testRepoPath);
    console.log('Creating a minimal test repository...');
    
    // Create minimal test structure
    await fs.mkdir(testRepoPath, { recursive: true });
    await fs.mkdir(path.join(testRepoPath, 'posts'), { recursive: true });
    await fs.mkdir(path.join(testRepoPath, 'images'), { recursive: true });
    
    // Create test markdown file
    await fs.writeFile(path.join(testRepoPath, 'posts', 'test.md'), `---
title: Test Post
date: 2024-01-01
---

# Test Post

This is a test post with a [[broken-link]] and an image.

![Missing Image](../images/missing.jpg)

[[Another Missing Link]]
`);
    
    // Create test image (small 1x1 PNG)
    const smallPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    await fs.writeFile(path.join(testRepoPath, 'images', 'test.png'), smallPng);
  }
  
  // Prepare test data
  const testData = {
    jobId: 'test-issue-collector',
    repoInfo: {
      path: testRepoPath,
      distPath: path.join(testRepoPath, '..', 'dist-test')
    },
    logger: logger
  };
  
  try {
    console.log('📦 Running buildAssets...');
    const result = await buildAssets(testData);
    
    console.log('\n✅ Build completed!');
    console.log(`   Files processed: ${result.assets.filesCount}`);
    console.log(`   Media processed: ${result.assets.mediaCount}`);
    
    if (result.issues) {
      console.log('\n📋 Issue Reports:');
      if (result.issues.processorIssuesPath) {
        console.log(`   ✓ processor-issues.json: ${result.issues.processorIssuesPath}`);
        
        // Read and display processor issues
        try {
          const processorIssues = JSON.parse(await fs.readFile(result.issues.processorIssuesPath, 'utf-8'));
          console.log(`     - Total issues: ${processorIssues.issues.length}`);
          console.log(`     - Broken links: ${processorIssues.summary.categoryCounts['broken-link'] || 0}`);
          console.log(`     - Missing media: ${processorIssues.summary.categoryCounts['missing-media'] || 0}`);
        } catch (e) {
          console.log('     - Could not read processor issues');
        }
      } else {
        console.log('   ℹ️  No processor-issues.json found');
      }
      
      if (result.issues.workerIssuesPath) {
        console.log(`   ✓ worker-issues.json: ${result.issues.workerIssuesPath}`);
        console.log(`     - Errors: ${result.issues.workerIssuesSummary.errorCount}`);
        console.log(`     - Warnings: ${result.issues.workerIssuesSummary.warningCount}`);
        
        // Read and display some worker issues
        try {
          const workerIssues = JSON.parse(await fs.readFile(result.issues.workerIssuesPath, 'utf-8'));
          if (workerIssues.issues.length > 0) {
            console.log('\n   📌 Sample worker issues:');
            workerIssues.issues.slice(0, 3).forEach(issue => {
              console.log(`     - [${issue.severity}] ${issue.message}`);
            });
          }
        } catch (e) {
          console.log('     - Could not read worker issues');
        }
      }
    }
    
    // Cleanup - commented out to preserve files for inspection
    // await fs.rm(testData.repoInfo.distPath, { recursive: true, force: true });
    
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    
    // Check if worker-issues.json was created even on failure
    const distPath = path.join(testRepoPath, '..', 'dist-test');
    const workerIssuesPath = path.join(distPath, 'worker-issues.json');
    
    try {
      const workerIssues = JSON.parse(await fs.readFile(workerIssuesPath, 'utf-8'));
      console.log('\n📋 Worker issues saved despite failure:');
      console.log(`   Total issues: ${workerIssues.summary.totalIssues}`);
      console.log(`   Build error captured: ${workerIssues.issues.some(i => i.category === 'build-error') ? 'Yes' : 'No'}`);
    } catch (e) {
      console.log('\n⚠️  No worker-issues.json found after failure');
    }
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 Testing Issue Collection System');
  console.log('=' .repeat(50));
  
  try {
    // Test 1: Direct issue collector
    await testIssueCollector();
    
    // Test 2: Integration with buildAssets
    await testWithSampleRepo();
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
runTests();