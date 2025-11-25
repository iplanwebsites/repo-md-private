import { RepoProcessor } from './dist/index.js'
import fs from 'fs'
import path from 'path'

// Create a test directory
const testDir = './test-mermaid-direct-output'
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true })
}

// Test content with mermaid
const testContent = `---
title: Test Mermaid Direct
---

# Test Mermaid

\`\`\`mermaid
graph LR
    A[Remark] --> B[Rehype]
    B --> C[Output]
\`\`\`
`

// Write test file
const testVault = path.join(testDir, 'vault')
if (!fs.existsSync(testVault)) {
  fs.mkdirSync(testVault, { recursive: true })
}
fs.writeFileSync(path.join(testVault, 'test.md'), testContent)

// Test 1: Default behavior (should use rehype-mermaid)
console.log('\n=== Test 1: Default behavior (iframe disabled, rehype-mermaid enabled) ===')
const processor1 = new RepoProcessor({
  dir: {
    input: testVault,
    build: path.join(testDir, 'build1')
  },
  ignoreFiles: []
})

const result1 = await processor1.process()
console.log('Processed files:', result1.pages.length)
if (result1.pages.length > 0) {
  const html = result1.pages[0].html
  console.log('Contains iframe?', html.includes('iframe'))
  console.log('Contains mermaid class?', html.includes('mermaid'))
  console.log('HTML preview:', html.substring(0, 500) + '...')
}

// Test 2: Force iframe mode
console.log('\n=== Test 2: Force iframe mode ===')
const processor2 = new RepoProcessor({
  dir: {
    input: testVault,
    build: path.join(testDir, 'build2')
  },
  ignoreFiles: [],
  iframeEmbedOptions: {
    features: {
      mermaid: true
    }
  },
  rehypeMermaidOptions: {
    enabled: false
  }
})

const result2 = await processor2.process()
if (result2.pages.length > 0) {
  const html = result2.pages[0].html
  console.log('Contains iframe?', html.includes('iframe'))
  console.log('Contains iframe.repo.md?', html.includes('iframe.repo.md'))
}

// Clean up
fs.rmSync(testDir, { recursive: true, force: true })
console.log('\nTest complete!')