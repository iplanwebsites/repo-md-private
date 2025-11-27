/**
 * Test WebLLM Blog Processing
 *
 * Processes the webllm blog directory using the new plugin architecture.
 * Output goes to test/webllm/{datetime}
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildAssets } from '../dist/process/buildAssets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SOURCE_DIR = '/Users/felix/web/git/webllm/webllm/packages/blog';
const TEST_BASE_DIR = path.join(__dirname, '..', 'test', 'webllm');

// Create logger
const createLogger = (jobId) => ({
  log: (msg, ctx) => console.log(`[${jobId}] INFO: ${msg}`, ctx ?? ''),
  warn: (msg, ctx) => console.warn(`[${jobId}] WARN: ${msg}`, ctx ?? ''),
  error: (msg, ctx) => console.error(`[${jobId}] ERROR: ${msg}`, ctx ?? ''),
});

async function testWebllmBlog() {
  // Generate timestamp for output folder
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);

  const distDir = path.join(TEST_BASE_DIR, timestamp);
  const jobId = `webllm-blog-${timestamp}`;
  const logger = createLogger(jobId);

  console.log(`
=====================================
  WebLLM Blog Test
=====================================
  Source:  ${SOURCE_DIR}
  Output:  ${distDir}
  Job ID:  ${jobId}
=====================================
`);

  try {
    // Verify source directory exists
    await fs.access(SOURCE_DIR);
    logger.log('Source directory exists');

    // Create output directory
    await fs.mkdir(distDir, { recursive: true });
    logger.log('Created output directory');

    // Create job data
    const jobData = {
      jobId,
      repoInfo: {
        path: SOURCE_DIR,
        distPath: distDir,
      },
      logger,
      skipEmbeddings: false, // Enable embeddings
    };

    // Run build
    logger.log('Starting build pipeline...');
    const startTime = Date.now();

    const result = await buildAssets(jobData);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Report results
    console.log(`
=====================================
  Build Complete!
=====================================
  Duration:    ${duration}s
  Posts:       ${result.assets?.filesCount ?? 0}
  Media:       ${result.assets?.mediaCount ?? 0}
  Output:      ${distDir}
=====================================
`);

    // List output files
    console.log('Output files:');
    const files = await fs.readdir(distDir);
    for (const file of files.sort()) {
      const stats = await fs.stat(path.join(distDir, file));
      const size = stats.isDirectory()
        ? 'DIR'
        : `${(stats.size / 1024).toFixed(1)} KB`;
      console.log(`  ${file.padEnd(40)} ${size}`);
    }

    // Check for embeddings
    if (result.postEmbeddings) {
      console.log(`\nPost Embeddings:`);
      console.log(`  Files processed: ${result.postEmbeddings.filesProcessed}`);
      console.log(`  Dimension: ${result.postEmbeddings.dimension}`);
      console.log(`  Model: ${result.postEmbeddings.model}`);
    }

    if (result.mediaEmbeddings) {
      console.log(`\nMedia Embeddings:`);
      console.log(`  Files processed: ${result.mediaEmbeddings.filesProcessed}`);
      console.log(`  Dimension: ${result.mediaEmbeddings.dimension}`);
    }

    if (result.database) {
      console.log(`\nDatabase:`);
      console.log(`  Path: ${result.database.path}`);
      console.log(`  Tables: ${result.database.tables.join(', ')}`);
    }

    console.log(`\n✅ Test completed successfully!`);
    console.log(`   Output at: ${distDir}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testWebllmBlog().catch(console.error);
