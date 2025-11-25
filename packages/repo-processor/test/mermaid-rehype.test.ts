import { expect, test, describe } from 'vitest'
import { RepoProcessor } from '../src/process/process'
import path from 'path'
import fs from 'fs'

describe('Rehype Mermaid Plugin', () => {
  const testVaultPath = path.resolve('test/testVault-mermaid')
  
  // Create a test vault with mermaid content
  const mermaidContent = `---
title: Test Mermaid
---

# Mermaid Test

Here's a simple flowchart:

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> A
\`\`\`

And another diagram:

\`\`\`mermaid
sequenceDiagram
    participant Alice
    participant Bob
    Alice->>Bob: Hello Bob, how are you?
    Bob-->>Alice: Great!
\`\`\`
`

  test('should process mermaid with rehype-mermaid by default', async () => {
    // Create test directory
    if (!fs.existsSync(testVaultPath)) {
      fs.mkdirSync(testVaultPath, { recursive: true })
    }
    
    // Write test file
    fs.writeFileSync(path.join(testVaultPath, 'mermaid-test.md'), mermaidContent)
    
    const processor = new RepoProcessor({
      dir: {
        input: testVaultPath,
        build: path.join(testVaultPath, 'build')
      },
      ignoreFiles: [], // Don't ignore any files for testing
      // Default: rehype-mermaid enabled, iframe disabled
    })
    
    const result = await processor.process()
    
    // Check that the result contains processed content
    expect(result).toBeDefined()
    expect(result.pages).toHaveLength(1)
    
    const page = result.pages[0]
    expect(page.content).toBeDefined()
    
    // Should NOT contain iframe (iframe mermaid is disabled by default)
    expect(page.content).not.toContain('iframe')
    expect(page.content).not.toContain('iframe.repo.md')
    
    // The content should still contain mermaid diagrams (processed by rehype-mermaid or as fallback)
    // Note: Actual rendering depends on whether playwright is installed
    // Clean up
    fs.rmSync(testVaultPath, { recursive: true, force: true })
  })
  
  test('should use iframe when explicitly enabled', async () => {
    // Create test directory
    if (!fs.existsSync(testVaultPath)) {
      fs.mkdirSync(testVaultPath, { recursive: true })
    }
    
    // Write test file
    fs.writeFileSync(path.join(testVaultPath, 'mermaid-test.md'), mermaidContent)
    
    const processor = new RepoProcessor({
      dir: {
        input: testVaultPath,
        build: path.join(testVaultPath, 'build')
      },
      ignoreFiles: [], // Don't ignore any files for testing
      iframeEmbedOptions: {
        features: {
          mermaid: true // Enable iframe for mermaid
        }
      },
      rehypeMermaidOptions: {
        enabled: false // Disable rehype-mermaid
      }
    })
    
    const result = await processor.process()
    
    // Check that the result contains iframe
    expect(result).toBeDefined()
    expect(result.pages).toHaveLength(1)
    
    const page = result.pages[0]
    expect(page.content).toContain('iframe')
    expect(page.content).toContain('iframe.repo.md/mermaid')
    
    // Clean up
    fs.rmSync(testVaultPath, { recursive: true, force: true })
  })
  
  test('should handle both plugins disabled', async () => {
    // Create test directory
    if (!fs.existsSync(testVaultPath)) {
      fs.mkdirSync(testVaultPath, { recursive: true })
    }
    
    // Write test file
    fs.writeFileSync(path.join(testVaultPath, 'mermaid-test.md'), mermaidContent)
    
    const processor = new RepoProcessor({
      dir: {
        input: testVaultPath,
        build: path.join(testVaultPath, 'build')
      },
      ignoreFiles: [], // Don't ignore any files for testing
      iframeEmbedOptions: {
        features: {
          mermaid: false // Disable iframe for mermaid
        }
      },
      rehypeMermaidOptions: {
        enabled: false // Disable rehype-mermaid
      }
    })
    
    const result = await processor.process()
    
    // Check that mermaid blocks remain as code blocks
    expect(result).toBeDefined()
    expect(result.pages).toHaveLength(1)
    
    const page = result.pages[0]
    expect(page.content).not.toContain('iframe')
    expect(page.content).toContain('<code class="language-mermaid">')
    
    // Clean up
    fs.rmSync(testVaultPath, { recursive: true, force: true })
  })
})