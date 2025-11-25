import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { processFolder } from '../src/process/processFolder';
import { processMedia } from '../src/process/processMedia';
import fs from 'fs';
import path from 'path';

describe('Mermaid iframe substitution defaults', () => {
  const testVaultPath = './test/mermaid-iframe-test-vault';
  
  beforeAll(() => {
    // Create test directory
    fs.mkdirSync(testVaultPath, { recursive: true });
    
    // Create test file with mermaid content
    const testContent = `---
title: Mermaid Default Test
public: true
---

# Mermaid Iframe Test

## Mermaid Diagram

\`\`\`mermaid
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Use Iframe]
  B -->|No| D[Regular Code Block]
\`\`\`

## Regular Code

\`\`\`javascript
console.log('This is regular code');
\`\`\`
`;
    fs.writeFileSync(path.join(testVaultPath, 'test.md'), testContent);
  });
  
  afterAll(() => {
    // Clean up
    fs.rmSync(testVaultPath, { recursive: true });
  });

  it('should convert mermaid blocks to iframes by default', async () => {
    // Process media first
    const mediaResults = await processMedia(testVaultPath, {
      outputFolder: './build/_media',
      copyMedia: false
    });

    // Process folder without any iframe options - should default to mermaid iframe
    const results = await processFolder(testVaultPath, {
      mediaData: mediaResults.mediaFiles,
      mediaPathMap: mediaResults.pathMap
      // No iframeEmbedOptions specified - should use defaults
    });

    expect(results.length).toBe(1);
    const post = results[0];
    
    // Should contain iframe for mermaid
    expect(post.html).toContain('<iframe');
    expect(post.html).toContain('iframe.repo.md/mermaid/');
    
    // Should NOT contain the old mermaid container
    expect(post.html).not.toContain('class="mermaid-container"');
    expect(post.html).not.toContain('class="mermaid"');
    
    // By default, only mermaid is converted to iframe, not regular code blocks
    expect(post.html).toContain('language-javascript');
    expect(post.html).not.toContain('iframe.repo.md/code/');
  });

  it('should allow disabling mermaid iframe substitution', async () => {
    // Process media first
    const mediaResults = await processMedia(testVaultPath, {
      outputFolder: './build/_media',
      copyMedia: false
    });

    // Process folder with mermaid disabled
    const results = await processFolder(testVaultPath, {
      mediaData: mediaResults.mediaFiles,
      mediaPathMap: mediaResults.pathMap,
      iframeEmbedOptions: {
        features: {
          mermaid: false, // Explicitly disable mermaid iframe substitution
          code: false     // Also disable code iframe substitution for this test
        }
      }
    });

    expect(results.length).toBe(1);
    const post = results[0];
    
    // Should NOT contain iframe
    expect(post.html).not.toContain('<iframe');
    expect(post.html).not.toContain('iframe.repo.md/mermaid/');
    
    // Mermaid should be rendered as regular code block (with hljs class from syntax highlighting)
    expect(post.html).toContain('language-mermaid');
    expect(post.html).toContain('graph TD');
    
    // Regular code should still be a code block
    expect(post.html).toContain('language-javascript');
  });

  it('should allow enabling code block iframe substitution', async () => {
    // Process media first
    const mediaResults = await processMedia(testVaultPath, {
      outputFolder: './build/_media',
      copyMedia: false
    });

    // Process folder with code iframe substitution explicitly enabled
    const results = await processFolder(testVaultPath, {
      mediaData: mediaResults.mediaFiles,
      mediaPathMap: mediaResults.pathMap,
      iframeEmbedOptions: {
        features: {
          code: true // Explicitly enable code iframe substitution
          // mermaid defaults to true
        }
      }
    });

    expect(results.length).toBe(1);
    const post = results[0];
    
    // Both mermaid and code should be iframes
    expect(post.html).toContain('iframe.repo.md/mermaid/');
    expect(post.html).toContain('iframe.repo.md/code/javascript/');
    expect(post.html).not.toContain('language-javascript');
  });

  it('should support custom iframe attributes for mermaid', async () => {
    // Process media first
    const mediaResults = await processMedia(testVaultPath, {
      outputFolder: './build/_media',
      copyMedia: false
    });

    // Process folder with custom attributes
    const results = await processFolder(testVaultPath, {
      mediaData: mediaResults.mediaFiles,
      mediaPathMap: mediaResults.pathMap,
      iframeEmbedOptions: {
        iframeAttributes: {
          width: '800px',
          height: '600px',
          loading: 'lazy'
        }
      }
    });

    expect(results.length).toBe(1);
    const post = results[0];
    
    // Should contain iframe with custom attributes
    expect(post.html).toContain('<iframe');
    expect(post.html).toContain('width="800px"');
    expect(post.html).toContain('height="600px"');
    expect(post.html).toContain('loading="lazy"');
  });
});