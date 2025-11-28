#!/usr/bin/env node
/**
 * Test script for WASM Image Processor Plugin
 *
 * Tests:
 * 1. Plugin initialization
 * 2. Metadata extraction
 * 3. Image resizing
 * 4. Format conversion (JPEG -> WebP)
 * 5. File copy for unsupported formats
 */

import { WasmImageProcessor } from '../dist/index.js';
import { mkdir, rm, stat, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = join(__dirname, '../temp-test');
const TEST_IMAGE = join(__dirname, '../../repo-build-worker-cf/scripts/test-images/test1.jpeg');

// Mock plugin context
const mockContext = {
  outputDir: TEMP_DIR,
  issues: {
    add: () => {},
    getAll: () => [],
  },
  log: (message, level = 'info') => {
    console.log(`[${level.toUpperCase()}] ${message}`);
  },
  getPlugin: () => undefined,
  config: {},
};

async function runTests() {
  console.log('🧪 Testing WASM Image Processor Plugin\n');
  console.log('═'.repeat(50));

  let passed = 0;
  let failed = 0;

  try {
    // Setup temp directory
    await mkdir(TEMP_DIR, { recursive: true });

    // Create test image if it doesn't exist (fallback)
    let testImagePath = TEST_IMAGE;
    try {
      await stat(TEST_IMAGE);
    } catch {
      // Create a simple test image using another source
      const altImage = join(__dirname, '../../repo-app/public/img/bg/bg1.jpg');
      try {
        await stat(altImage);
        testImagePath = altImage;
      } catch {
        console.error('❌ No test image found. Please provide a test image.');
        process.exit(1);
      }
    }

    console.log(`📷 Using test image: ${testImagePath}\n`);

    // Test 1: Initialize plugin
    console.log('Test 1: Plugin Initialization');
    console.log('-'.repeat(30));
    const plugin = new WasmImageProcessor({
      defaultQuality: 80,
      speed: 6,
    });

    await plugin.initialize(mockContext);

    if (plugin.isReady()) {
      console.log('✅ Plugin initialized successfully\n');
      passed++;
    } else {
      console.log('❌ Plugin failed to initialize\n');
      failed++;
    }

    // Test 2: canProcess
    console.log('Test 2: Format Detection');
    console.log('-'.repeat(30));
    const canProcessJpeg = plugin.canProcess('test.jpeg');
    const canProcessPng = plugin.canProcess('test.png');
    const canProcessWebp = plugin.canProcess('test.webp');
    const canProcessGif = plugin.canProcess('test.gif'); // Should be false
    const canProcessSvg = plugin.canProcess('test.svg'); // Should be false

    console.log(`  JPEG: ${canProcessJpeg ? '✓' : '✗'}`);
    console.log(`  PNG:  ${canProcessPng ? '✓' : '✗'}`);
    console.log(`  WebP: ${canProcessWebp ? '✓' : '✗'}`);
    console.log(`  GIF:  ${!canProcessGif ? '✓ (correctly excluded)' : '✗'}`);
    console.log(`  SVG:  ${!canProcessSvg ? '✓ (correctly excluded)' : '✗'}`);

    if (canProcessJpeg && canProcessPng && canProcessWebp && !canProcessGif && !canProcessSvg) {
      console.log('✅ Format detection working correctly\n');
      passed++;
    } else {
      console.log('❌ Format detection issues\n');
      failed++;
    }

    // Test 3: Get metadata
    console.log('Test 3: Metadata Extraction');
    console.log('-'.repeat(30));
    const metadata = await plugin.getMetadata(testImagePath);
    console.log(`  Width:  ${metadata.width}px`);
    console.log(`  Height: ${metadata.height}px`);
    console.log(`  Format: ${metadata.format}`);

    if (metadata.width > 0 && metadata.height > 0) {
      console.log('✅ Metadata extracted successfully\n');
      passed++;
    } else {
      console.log('❌ Failed to extract metadata\n');
      failed++;
    }

    // Test 4: Process image (resize + format conversion)
    console.log('Test 4: Image Processing (Resize + WebP conversion)');
    console.log('-'.repeat(30));
    const outputPath = join(TEMP_DIR, 'resized.webp');
    const result = await plugin.process(testImagePath, outputPath, {
      width: 300,
      format: 'webp',
      quality: 80,
    });

    console.log(`  Output: ${result.outputPath}`);
    console.log(`  Width:  ${result.width}px`);
    console.log(`  Height: ${result.height}px`);
    console.log(`  Format: ${result.format}`);
    console.log(`  Size:   ${(result.size / 1024).toFixed(2)} KB`);

    // Verify file exists
    const outputStats = await stat(result.outputPath);

    if (result.width <= 300 && result.format === 'webp' && outputStats.size > 0) {
      console.log('✅ Image processed successfully\n');
      passed++;
    } else {
      console.log('❌ Image processing issues\n');
      failed++;
    }

    // Test 5: Process with different format (AVIF)
    console.log('Test 5: AVIF Format Conversion');
    console.log('-'.repeat(30));
    const avifOutput = join(TEMP_DIR, 'output.avif');
    const avifResult = await plugin.process(testImagePath, avifOutput, {
      width: 200,
      format: 'avif',
      quality: 70,
    });

    console.log(`  Output: ${avifResult.outputPath}`);
    console.log(`  Width:  ${avifResult.width}px`);
    console.log(`  Format: ${avifResult.format}`);
    console.log(`  Size:   ${(avifResult.size / 1024).toFixed(2)} KB`);

    const avifStats = await stat(avifResult.outputPath);
    if (avifResult.format === 'avif' && avifStats.size > 0) {
      console.log('✅ AVIF conversion successful\n');
      passed++;
    } else {
      console.log('❌ AVIF conversion issues\n');
      failed++;
    }

    // Test 6: Copy function
    console.log('Test 6: File Copy');
    console.log('-'.repeat(30));
    const copyDest = join(TEMP_DIR, 'copied.jpeg');
    await plugin.copy(testImagePath, copyDest);
    const copyStats = await stat(copyDest);
    const origStats = await stat(testImagePath);

    console.log(`  Original size: ${origStats.size} bytes`);
    console.log(`  Copy size:     ${copyStats.size} bytes`);

    if (copyStats.size === origStats.size) {
      console.log('✅ File copied successfully\n');
      passed++;
    } else {
      console.log('❌ Copy size mismatch\n');
      failed++;
    }

    // Cleanup
    console.log('Cleaning up...');
    await rm(TEMP_DIR, { recursive: true, force: true });

  } catch (error) {
    console.error('\n❌ Test error:', error);
    failed++;

    // Cleanup on error
    try {
      await rm(TEMP_DIR, { recursive: true, force: true });
    } catch {}
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(50));
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📈 Total:  ${passed + failed}`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed');
    process.exit(1);
  }
}

runTests();
