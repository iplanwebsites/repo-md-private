// Simple test script to verify .repoignore functionality
import { processFolder } from './src/process/processFolder.ts';
import fs from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';

console.log('Testing .repoignore functionality...');

// Create test directory structure
const testDir = './test/repoignore-test';
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true });
}
fs.mkdirSync(testDir, { recursive: true });

// Create test .repoignore file
fs.writeFileSync(path.join(testDir, '.repoignore'), `# Test patterns
README.md
*.tmp.md
TEST_*
`);

// Create test markdown files
const testFiles = [
  'index.md',
  'README.md', // Should be ignored
  'test.tmp.md', // Should be ignored  
  'TEST_EXAMPLE.md', // Should be ignored
  'normal-file.md'
];

for (const file of testFiles) {
  fs.writeFileSync(path.join(testDir, file), `---
public: true
---
# ${file}
Test content for ${file}
`);
}

console.log('Created test files:', testFiles);

// Test processing
try {
  const result = await processFolder(testDir, {
    debug: 2,
    processAllFiles: true
  });
  
  console.log('Processed files:', result.map(f => f.fileName));
  
  // Expected: only 'index' and 'normal-file' should be processed
  const expected = ['index', 'normal-file'];
  const actual = result.map(f => f.fileName).sort();
  
  if (JSON.stringify(expected.sort()) === JSON.stringify(actual)) {
    console.log('✅ SUCCESS: .repoignore correctly filtered files');
  } else {
    console.log('❌ FAILED: Expected', expected, 'but got', actual);
  }
  
} catch (error) {
  console.error('❌ ERROR:', error);
} finally {
  // Cleanup
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
}