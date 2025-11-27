/**
 * Markdown Pipeline Tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseFrontmatter,
  createBasePipeline,
  parseToMdast,
  processMarkdown,
  mdastToText,
  extractFirstParagraph,
  extractHeadings,
  buildToc,
} from './pipeline.js';

describe('parseFrontmatter', () => {
  it('should parse YAML frontmatter', () => {
    const content = `---
title: Hello World
tags:
  - test
  - example
---

# Content here`;

    const result = parseFrontmatter(content);
    expect(result.data.title).toBe('Hello World');
    expect(result.data.tags).toEqual(['test', 'example']);
    expect(result.content.trim()).toBe('# Content here');
  });

  it('should handle content without frontmatter', () => {
    const content = '# Just a heading\n\nSome content';
    const result = parseFrontmatter(content);

    expect(result.data).toEqual({});
    expect(result.content).toBe(content);
  });

  it('should handle empty content', () => {
    const result = parseFrontmatter('');
    expect(result.data).toEqual({});
    expect(result.content).toBe('');
  });

  it('should handle boolean frontmatter values', () => {
    const content = `---
public: true
draft: false
---

Content`;

    const result = parseFrontmatter(content);
    expect(result.data.public).toBe(true);
    expect(result.data.draft).toBe(false);
  });
});

describe('createBasePipeline', () => {
  it('should create a working pipeline', async () => {
    const pipeline = createBasePipeline();
    const result = await pipeline.process('# Hello\n\nWorld');
    // With autolinkHeadings enabled, headings get id and anchor wrapper
    expect(String(result)).toContain('<h1 id="hello">');
    expect(String(result)).toContain('<a href="#hello">Hello</a>');
    expect(String(result)).toContain('<p>World</p>');
  });

  it('should support GFM features', async () => {
    const pipeline = createBasePipeline({ gfm: true });
    const result = await pipeline.process('~~strikethrough~~');
    expect(String(result)).toContain('<del>strikethrough</del>');
  });

  it('should handle tables', async () => {
    const pipeline = createBasePipeline({ gfm: true });
    const md = `| Col 1 | Col 2 |
| --- | --- |
| A | B |`;
    const result = await pipeline.process(md);
    expect(String(result)).toContain('<table>');
    expect(String(result)).toContain('<th>Col 1</th>');
  });

  it('should allow raw HTML when enabled', async () => {
    const pipeline = createBasePipeline({ allowRawHtml: true });
    const result = await pipeline.process('<div class="custom">Content</div>');
    expect(String(result)).toContain('<div class="custom">Content</div>');
  });
});

describe('parseToMdast', () => {
  it('should parse markdown to MDAST', () => {
    const mdast = parseToMdast('# Hello\n\nParagraph');
    expect(mdast.type).toBe('root');
    expect(mdast.children).toHaveLength(2);
    expect(mdast.children[0]?.type).toBe('heading');
    expect(mdast.children[1]?.type).toBe('paragraph');
  });

  it('should handle lists', () => {
    const mdast = parseToMdast('- Item 1\n- Item 2');
    expect(mdast.children[0]?.type).toBe('list');
  });

  it('should handle code blocks', () => {
    const mdast = parseToMdast('```js\nconst x = 1;\n```');
    expect(mdast.children[0]?.type).toBe('code');
  });
});

describe('processMarkdown', () => {
  it('should process complete markdown with frontmatter', async () => {
    const content = `---
title: Test Post
---

# Hello

This is a test.`;

    const result = await processMarkdown(content);

    expect(result.frontmatter.title).toBe('Test Post');
    // With autolinkHeadings enabled, headings get id and anchor wrapper
    expect(result.html).toContain('<h1 id="hello">');
    expect(result.html).toContain('<a href="#hello">Hello</a>');
    expect(result.html).toContain('<p>This is a test.</p>');
    expect(result.markdown).not.toContain('---');
    expect(result.mdast.type).toBe('root');
    expect(result.hast.type).toBe('root');
  });

  it('should handle markdown without frontmatter', async () => {
    const content = '# Just Content\n\nSome text here.';
    const result = await processMarkdown(content);

    expect(result.frontmatter).toEqual({});
    // With autolinkHeadings enabled, headings get id and anchor wrapper
    expect(result.html).toContain('<h1 id="just-content">');
    expect(result.html).toContain('<a href="#just-content">Just Content</a>');
  });
});

describe('mdastToText', () => {
  it('should extract text from MDAST', () => {
    const mdast = parseToMdast('# Hello World\n\nSome **bold** text');
    const text = mdastToText(mdast);

    expect(text).toContain('Hello World');
    expect(text).toContain('bold');
    expect(text).not.toContain('**');
  });

  it('should include inline code', () => {
    const mdast = parseToMdast('Use `const` for variables');
    const text = mdastToText(mdast);
    expect(text).toContain('const');
  });
});

describe('extractFirstParagraph', () => {
  it('should extract first paragraph text', () => {
    const mdast = parseToMdast('# Heading\n\nFirst paragraph.\n\nSecond paragraph.');
    const first = extractFirstParagraph(mdast);
    expect(first).toBe('First paragraph.');
  });

  it('should return empty string if no paragraph', () => {
    const mdast = parseToMdast('# Only Heading');
    const first = extractFirstParagraph(mdast);
    expect(first).toBe('');
  });
});

describe('extractHeadings', () => {
  it('should extract all headings with depths', () => {
    const mdast = parseToMdast('# H1\n\n## H2\n\n### H3');
    const headings = extractHeadings(mdast);

    expect(headings).toHaveLength(3);
    expect(headings[0]).toEqual({ depth: 1, text: 'H1' });
    expect(headings[1]).toEqual({ depth: 2, text: 'H2' });
    expect(headings[2]).toEqual({ depth: 3, text: 'H3' });
  });

  it('should handle headings with special characters', () => {
    const mdast = parseToMdast('# Hello & Goodbye');
    const headings = extractHeadings(mdast);
    expect(headings[0]?.text).toBe('Hello & Goodbye');
  });
});

describe('buildToc', () => {
  it('should build table of contents with slugs', () => {
    const headings = [
      { depth: 1, text: 'Hello World' },
      { depth: 2, text: 'Getting Started' },
    ];

    const toc = buildToc(headings);

    expect(toc[0]).toEqual({ depth: 1, text: 'Hello World', slug: 'hello-world' });
    expect(toc[1]).toEqual({ depth: 2, text: 'Getting Started', slug: 'getting-started' });
  });

  it('should handle special characters in headings', () => {
    const headings = [{ depth: 1, text: "What's New?" }];
    const toc = buildToc(headings);
    expect(toc[0]?.slug).toBe('whats-new');
  });
});

// ============================================================================
// New Obsidian Features Tests
// ============================================================================

describe('Obsidian features', () => {
  it('should render callouts', async () => {
    const content = `> [!NOTE]
> This is a note callout`;
    const result = await processMarkdown(content, { callouts: true });
    // remark-callouts transforms callouts to aside elements
    expect(result.html).toContain('callout');
  });

  it('should handle wiki-links', async () => {
    const content = 'Check out [[my-page]] for more info.';
    const result = await processMarkdown(content, { wikiLinks: true });
    // Wiki-links should be converted to anchor tags
    expect(result.html).toContain('<a');
    expect(result.html).toContain('my-page');
  });

  it('should add syntax highlighting to code blocks', async () => {
    const content = '```javascript\nconst x = 1;\n```';
    const result = await processMarkdown(content, { syntaxHighlighting: true });
    // rehype-highlight adds hljs classes
    expect(result.html).toContain('hljs');
  });

  it('should render math when parseFormulas is enabled', async () => {
    const content = 'The formula $E = mc^2$ is famous.';
    const result = await processMarkdown(content, { parseFormulas: true });
    // remark-math + rehype-mathjax converts to MathJax elements
    expect(result.html).toContain('mjx');
  });

  it('should add target="_blank" to external links', async () => {
    const content = 'Visit [Google](https://google.com) for more.';
    const result = await processMarkdown(content, { externalLinks: true });
    expect(result.html).toContain('target="_blank"');
    expect(result.html).toContain('rel="noopener noreferrer"');
  });

  it('should embed YouTube videos', async () => {
    const content = 'Watch this: https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const result = await processMarkdown(content, { youtubeEmbeds: true });
    // remark-youtube converts YouTube links to iframes
    expect(result.html).toContain('iframe');
  });
});

describe('Pipeline options', () => {
  it('should disable features when explicitly set to false', async () => {
    const content = '# Hello\n\n~~strike~~';
    const result = await processMarkdown(content, {
      autolinkHeadings: false,
      gfm: false,
    });
    // Without autolinkHeadings, headings should not have anchor wrapper
    expect(result.html).not.toContain('<a href="#');
    // Without GFM, strikethrough should not work
    expect(result.html).not.toContain('<del>');
  });
});
