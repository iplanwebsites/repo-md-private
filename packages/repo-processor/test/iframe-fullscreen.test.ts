import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { remarkIframeEmbed } from '../src/remark/remarkIframeEmbed';

describe('remarkIframeEmbed - Fullscreen and CSS Classes', () => {
  it('should add fullscreen attributes to iframes', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkIframeEmbed)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true });

    const input = `
\`\`\`mermaid
graph TD
  A[Start] --> B[End]
\`\`\`
`;

    const result = await processor.process(input);
    const html = result.toString();

    // Check for fullscreen attributes
    expect(html).toContain('allow="fullscreen"');
    expect(html).toContain('allowfullscreen="true"');
  });

  it('should add content-specific CSS classes', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkIframeEmbed)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true });

    const input = `
\`\`\`mermaid
graph TD
  A[Start] --> B[End]
\`\`\`

https://example.com/video.mp4

https://example.com/model.glb
`;

    const result = await processor.process(input);
    const html = result.toString();

    // Check for CSS classes
    expect(html).toContain('class="repo-iframe repo-iframe-mermaid"');
    expect(html).toContain('class="repo-iframe repo-iframe-video-wrapper"');
    expect(html).toContain('class="repo-iframe repo-iframe-model3d"');
  });

  it('should use responsive wrapper for video content', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkIframeEmbed)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true });

    const input = `https://example.com/video.mp4`;

    const result = await processor.process(input);
    const html = result.toString();

    // Check for responsive video wrapper
    expect(html).toContain('<div class="repo-iframe repo-iframe-video-wrapper"');
    expect(html).toContain('style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;"');
    expect(html).toContain('style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"');
  });

  it('should use configured heights for different content types', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkIframeEmbed)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true });

    const input = `
\`\`\`mermaid
graph TD
  A[Start] --> B[End]
\`\`\`

https://example.com/song.midi

https://example.com/model.glb
`;

    const result = await processor.process(input);
    const html = result.toString();

    // Check for configured heights
    expect(html).toContain('height="600px"'); // mermaid
    expect(html).toContain('height="120px"'); // midi
    expect(html).toContain('height="600px"'); // model3d (same as mermaid)
  });
});