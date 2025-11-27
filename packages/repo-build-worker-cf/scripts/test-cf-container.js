#!/usr/bin/env node

/**
 * CF Container Test Script
 *
 * Tests the Cloudflare Container worker by:
 * 1. Health check
 * 2. Triggering a sample job (clone repo, process content)
 * 3. Reporting build and processing times
 *
 * Usage:
 *   node scripts/test-cf-container.js                    # Test local docker (default)
 *   node scripts/test-cf-container.js --local            # Test local docker at localhost:8080
 *   node scripts/test-cf-container.js --wrangler         # Test wrangler dev at localhost:5522
 *   node scripts/test-cf-container.js --url=<url>        # Test custom URL
 *   node scripts/test-cf-container.js --deployed         # Test deployed CF worker
 */

import dotenv from 'dotenv';
import { createServer } from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  LOCAL_DOCKER_URL: 'http://localhost:8080',
  WRANGLER_DEV_URL: 'http://localhost:5522',
  DEPLOYED_URL: process.env.CF_WORKER_URL || 'https://repo-build-worker-cf.your-subdomain.workers.dev',
  CALLBACK_PORT: 9999,
  // Public test repository - use a small public repo for testing
  TEST_REPO: process.env.TEST_REPO_URL || 'https://github.com/repo-md/sample-blog',
  WORKER_SECRET: process.env.WORKER_SECRET || '',
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let targetUrl = CONFIG.LOCAL_DOCKER_URL;
  let mode = 'local-docker';

  for (const arg of args) {
    if (arg === '--local' || arg === '--docker') {
      targetUrl = CONFIG.LOCAL_DOCKER_URL;
      mode = 'local-docker';
    } else if (arg === '--wrangler' || arg === '--dev') {
      targetUrl = CONFIG.WRANGLER_DEV_URL;
      mode = 'wrangler-dev';
    } else if (arg === '--deployed' || arg === '--prod') {
      targetUrl = CONFIG.DEPLOYED_URL;
      mode = 'deployed';
    } else if (arg.startsWith('--url=')) {
      targetUrl = arg.split('=')[1];
      mode = 'custom';
    } else if (arg.startsWith('--repo=')) {
      CONFIG.TEST_REPO = arg.split('=')[1];
    }
  }

  return { targetUrl, mode };
}

// Timing utilities
class Timer {
  constructor(name) {
    this.name = name;
    this.start = Date.now();
    this.marks = {};
  }

  mark(label) {
    this.marks[label] = Date.now() - this.start;
    return this.marks[label];
  }

  elapsed() {
    return Date.now() - this.start;
  }

  report() {
    const total = this.elapsed();
    console.log(`\n⏱️  Timing Report: ${this.name}`);
    console.log('─'.repeat(40));
    for (const [label, ms] of Object.entries(this.marks)) {
      console.log(`  ${label}: ${ms}ms`);
    }
    console.log(`  Total: ${total}ms`);
    return { total, marks: this.marks };
  }
}

// Simple callback server to receive job results
function startCallbackServer(port) {
  return new Promise((resolve, reject) => {
    let resultCallback = null;

    const server = createServer((req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const result = JSON.parse(body);
            console.log('\n📥 Received callback:', result.status);
            if (resultCallback) {
              resultCallback(result);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ received: true }));
          } catch (e) {
            res.writeHead(400);
            res.end('Invalid JSON');
          }
        });
      } else {
        res.writeHead(200);
        res.end('Callback server ready');
      }
    });

    server.listen(port, () => {
      console.log(`📡 Callback server listening on port ${port}`);
      resolve({
        server,
        waitForResult: () => new Promise(r => { resultCallback = r; }),
        close: () => server.close()
      });
    });

    server.on('error', reject);
  });
}

// Test health endpoint
async function testHealth(baseUrl, timer) {
  console.log('\n🏥 Testing health endpoint...');
  timer.mark('health-start');

  try {
    const response = await fetch(`${baseUrl}/health`);
    const data = await response.json();
    timer.mark('health-end');

    if (response.ok && data.status === 'healthy') {
      console.log('✅ Health check passed:', data);
      return { success: true, data };
    } else {
      console.log('❌ Health check failed:', data);
      return { success: false, data };
    }
  } catch (error) {
    timer.mark('health-error');
    console.log('❌ Health check error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test process endpoint with synthetic content
async function testProcessSynthetic(baseUrl, timer, callbackUrl) {
  console.log('\n🧪 Testing /process with synthetic content...');
  timer.mark('process-synthetic-start');

  const jobId = `test-synthetic-${Date.now()}`;

  // Create synthetic test job that doesn't require external repos
  const jobPayload = {
    jobId,
    task: 'process-all',
    callbackUrl,
    data: {
      // Use synthetic content instead of cloning a repo
      synthetic: true,
      content: [
        {
          path: 'posts/hello-world.md',
          content: `---
title: Hello World
date: 2024-01-15
tags: [test, demo]
---

# Hello World

This is a test post for **CF container testing**.

- Item 1
- Item 2
- Item 3
`
        },
        {
          path: 'posts/second-post.md',
          content: `---
title: Second Post
date: 2024-01-16
draft: false
---

# Second Post

Another test post with [[hello-world|a wiki link]].
`
        }
      ]
    }
  };

  const headers = {
    'Content-Type': 'application/json'
  };

  if (CONFIG.WORKER_SECRET) {
    headers['Authorization'] = `Bearer ${CONFIG.WORKER_SECRET}`;
  }

  try {
    const response = await fetch(`${baseUrl}/process`, {
      method: 'POST',
      headers,
      body: JSON.stringify(jobPayload)
    });

    timer.mark('process-synthetic-accepted');
    const data = await response.json();

    if (response.ok && data.status === 'accepted') {
      console.log('✅ Job accepted:', data);
      return { success: true, jobId, data };
    } else {
      console.log('❌ Job rejected:', data);
      return { success: false, jobId, data };
    }
  } catch (error) {
    timer.mark('process-synthetic-error');
    console.log('❌ Process error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test process endpoint with real repo
async function testProcessRepo(baseUrl, timer, callbackUrl, repoUrl) {
  console.log(`\n🔄 Testing /process with repo: ${repoUrl}`);
  timer.mark('process-repo-start');

  const jobId = `test-repo-${Date.now()}`;

  const jobPayload = {
    jobId,
    task: 'deploy-repo',
    callbackUrl,
    data: {
      repoUrl,
      gitToken: process.env.GITHUB_TOKEN,
      r2: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        accountId: process.env.R2_ACCOUNT_ID,
        bucketName: process.env.R2_BUCKET_NAME || 'test-bucket'
      }
    }
  };

  const headers = {
    'Content-Type': 'application/json'
  };

  if (CONFIG.WORKER_SECRET) {
    headers['Authorization'] = `Bearer ${CONFIG.WORKER_SECRET}`;
  }

  try {
    const response = await fetch(`${baseUrl}/process`, {
      method: 'POST',
      headers,
      body: JSON.stringify(jobPayload)
    });

    timer.mark('process-repo-accepted');
    const data = await response.json();

    if (response.ok && data.status === 'accepted') {
      console.log('✅ Job accepted:', data);
      return { success: true, jobId, data };
    } else {
      console.log('❌ Job rejected:', data);
      return { success: false, jobId, data };
    }
  } catch (error) {
    timer.mark('process-repo-error');
    console.log('❌ Process error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test the build pipeline directly (for local testing without callback server)
async function testBuildPipelineLocal(timer) {
  console.log('\n🔧 Testing build pipeline locally (no HTTP)...');
  timer.mark('local-build-start');

  try {
    // Dynamic import to avoid issues when running against remote
    const { default: buildAssets } = await import('../src/process/buildAssets.js');

    const tempDir = path.join(__dirname, '..', `temp-cf-test-${Date.now()}`);
    const sourceDir = path.join(tempDir, 'source');
    const distDir = path.join(tempDir, 'dist');

    // Create test structure
    await fs.mkdir(path.join(sourceDir, 'posts'), { recursive: true });
    await fs.mkdir(distDir, { recursive: true });

    // Create test markdown
    await fs.writeFile(path.join(sourceDir, 'posts', 'test.md'), `---
title: CF Test Post
date: 2024-01-15
tags: [cloudflare, test]
---

# CF Container Test

Testing the build pipeline for **Cloudflare Containers**.
`);

    timer.mark('local-build-setup');

    // Run build
    const testData = {
      jobId: `local-test-${Date.now()}`,
      tempDir,
      repoInfo: { path: sourceDir, distPath: distDir },
      assets: { distFolder: distDir },
      config: { embeddings: false, mediaOptimization: false }
    };

    const result = await buildAssets(testData);
    timer.mark('local-build-complete');

    // Report
    console.log('✅ Local build completed');
    console.log(`   Job ID: ${result.jobId}`);
    console.log(`   Content: ${result.assets?.contentPath || 'N/A'}`);

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });

    return { success: true, result };
  } catch (error) {
    timer.mark('local-build-error');
    console.log('❌ Local build failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Main test runner
async function runTests() {
  const { targetUrl, mode } = parseArgs();

  console.log('═'.repeat(60));
  console.log('🚀 CF Container Test Suite');
  console.log('═'.repeat(60));
  console.log(`Target: ${targetUrl}`);
  console.log(`Mode: ${mode}`);
  console.log(`Test Repo: ${CONFIG.TEST_REPO}`);
  console.log('═'.repeat(60));

  const timer = new Timer('CF Container Tests');
  const results = {
    health: null,
    localBuild: null,
    processSynthetic: null,
    processRepo: null,
    timing: null
  };

  // Test 1: Health check
  results.health = await testHealth(targetUrl, timer);

  if (!results.health.success) {
    console.log('\n⚠️  Health check failed. Is the worker running?');
    console.log(`   For local docker: npm run docker:run`);
    console.log(`   For wrangler dev: npm run cf:dev`);

    // Fall back to local build test
    console.log('\n📦 Falling back to local build test...');
    results.localBuild = await testBuildPipelineLocal(timer);

    results.timing = timer.report();
    return results;
  }

  // Test 2: Local build pipeline (optional)
  if (mode === 'local-docker' || mode === 'wrangler-dev') {
    results.localBuild = await testBuildPipelineLocal(timer);
  }

  // Test 3: Process endpoint (requires callback server)
  let callbackServer = null;
  try {
    // Get local IP for callback (works for docker)
    const callbackHost = mode === 'local-docker'
      ? 'host.docker.internal'  // Docker-specific host
      : 'localhost';
    const callbackUrl = `http://${callbackHost}:${CONFIG.CALLBACK_PORT}/callback`;

    callbackServer = await startCallbackServer(CONFIG.CALLBACK_PORT);

    // Test with synthetic content (no external deps)
    results.processSynthetic = await testProcessSynthetic(targetUrl, timer, callbackUrl);

    if (results.processSynthetic.success) {
      console.log('\n⏳ Waiting for job completion (30s timeout)...');
      const resultPromise = callbackServer.waitForResult();
      const timeoutPromise = new Promise(r => setTimeout(() => r({ timeout: true }), 30000));

      const jobResult = await Promise.race([resultPromise, timeoutPromise]);
      timer.mark('process-synthetic-complete');

      if (jobResult.timeout) {
        console.log('⚠️  Job timed out waiting for callback');
      } else {
        console.log('✅ Job completed:', jobResult.status);
        if (jobResult.duration) {
          console.log(`   Processing time: ${jobResult.duration}ms`);
        }
      }
    }

    // Test with real repo (if GITHUB_TOKEN is set)
    if (process.env.GITHUB_TOKEN && CONFIG.TEST_REPO) {
      results.processRepo = await testProcessRepo(targetUrl, timer, callbackUrl, CONFIG.TEST_REPO);

      if (results.processRepo.success) {
        console.log('\n⏳ Waiting for repo job completion (120s timeout)...');
        const resultPromise = callbackServer.waitForResult();
        const timeoutPromise = new Promise(r => setTimeout(() => r({ timeout: true }), 120000));

        const jobResult = await Promise.race([resultPromise, timeoutPromise]);
        timer.mark('process-repo-complete');

        if (jobResult.timeout) {
          console.log('⚠️  Repo job timed out');
        } else {
          console.log('✅ Repo job completed:', jobResult.status);
          if (jobResult.duration) {
            console.log(`   Processing time: ${jobResult.duration}ms`);
          }
        }
      }
    } else {
      console.log('\nℹ️  Skipping repo test (no GITHUB_TOKEN)');
    }

  } finally {
    if (callbackServer) {
      callbackServer.close();
    }
  }

  // Final report
  results.timing = timer.report();

  console.log('\n═'.repeat(60));
  console.log('📊 Test Summary');
  console.log('═'.repeat(60));
  console.log(`Health Check: ${results.health?.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Local Build:  ${results.localBuild?.success ? '✅ PASS' : results.localBuild ? '❌ FAIL' : '⏭️  SKIP'}`);
  console.log(`Synthetic Job: ${results.processSynthetic?.success ? '✅ PASS' : results.processSynthetic ? '❌ FAIL' : '⏭️  SKIP'}`);
  console.log(`Repo Job:     ${results.processRepo?.success ? '✅ PASS' : results.processRepo ? '❌ FAIL' : '⏭️  SKIP'}`);
  console.log('═'.repeat(60));

  return results;
}

// Run if called directly
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});

export { runTests, testHealth, testProcessSynthetic, testProcessRepo };
