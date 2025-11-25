import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { remarkIframeEmbed } from '../src/remark/remarkIframeEmbed';

describe('remarkIframeEmbed - Default Settings', () => {
  it('should transform mermaid, video, midi, and model3d URLs by default, but not markdown or code', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkIframeEmbed) // Using defaults only
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true });

    const input = `
# Testing Default Settings

## Mermaid (should transform)
\`\`\`mermaid
graph TD
  A[Start] --> B[End]
\`\`\`

## Video URL (should transform)
https://example.com/video.mp4

## MIDI URL (should transform)
https://example.com/song.midi

## 3D Model URL (should transform)
https://example.com/model.glb

## Markdown (should NOT transform)
\`\`\`markdown
# This is markdown
It should not be transformed to an iframe
\`\`\`

## Regular Code (should NOT transform)
\`\`\`javascript
console.log('Hello');
\`\`\`
`;

    const result = await processor.process(input);
    const html = result.toString();

    // Check transformations that SHOULD happen
    expect(html).toContain('iframe.repo.md/mermaid/');
    expect(html).toContain('iframe.repo.md/video/url/');
    expect(html).toContain('iframe.repo.md/midi/url/');
    expect(html).toContain('iframe.repo.md/model3d/url/glb/');

    // Check that markdown and code blocks are NOT transformed
    expect(html).not.toContain('iframe.repo.md/markdown/');
    expect(html).not.toContain('iframe.repo.md/code/');
    
    // Verify the markdown and JS code blocks remain as regular code blocks
    expect(html).toContain('<code class="language-markdown">');
    expect(html).toContain('<code class="language-javascript">');
  });

  it('should allow overriding defaults', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkIframeEmbed, {
        features: {
          mermaid: false,  // Override default true
          video: false,    // Override default true
          code: true,      // Override default false
        }
      })
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true });

    const input = `
\`\`\`mermaid
graph TD
  A[Start] --> B[End]
\`\`\`

https://example.com/video.mp4

\`\`\`javascript
console.log('Hello');
\`\`\`
`;

    const result = await processor.process(input);
    const html = result.toString();

    // Mermaid and video should NOT be transformed (overridden to false)
    expect(html).not.toContain('iframe.repo.md/mermaid/');
    expect(html).not.toContain('iframe.repo.md/video/');

    // Code should be transformed (overridden to true)
    expect(html).toContain('iframe.repo.md/code/');
  });
});