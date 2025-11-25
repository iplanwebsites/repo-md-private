// Test the ignore library directly to verify patterns work
import ignore from 'ignore';

console.log('Testing ignore library patterns...');

const ig = ignore().add([
  'README.md',
  '*.tmp.md', 
  'internal/*',
  'private/*',
  'TEST_*'
]);

const testPaths = [
  'index.md',           // Should NOT be ignored
  'README.md',          // Should be ignored
  'test.tmp.md',        // Should be ignored
  'internal/secret.md', // Should be ignored
  'internal/docs/private.md', // Should be ignored  
  'private/notes.md',   // Should be ignored
  'TEST_EXAMPLE.md',    // Should be ignored
  'normal-file.md'      // Should NOT be ignored
];

console.log('\nTesting paths:');
for (const testPath of testPaths) {
  const isIgnored = ig.ignores(testPath);
  console.log(`${testPath}: ${isIgnored ? '❌ IGNORED' : '✅ ALLOWED'}`);
}

console.log('\nFiltered allowed paths:');
const allowedPaths = ig.filter(testPaths);
console.log(allowedPaths);