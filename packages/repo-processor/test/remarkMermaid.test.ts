import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { remarkMermaid } from '../src/remark/remarkMermaid';

describe('remarkMermaid (deprecated - use remarkIframeEmbed instead)', () => {
  const processor = (options?: any) =>
    unified()
      .use(remarkParse)
      .use(remarkMermaid, options)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true });

  it('should transform mermaid code blocks to HTML', async () => {
    const markdown = `
# Test Document

\`\`\`mermaid
graph TD
  A[Start] --> B[Process]
  B --> C[End]
\`\`\`

Regular paragraph.
`;

    const result = await processor().process(markdown);
    const html = result.toString();
    
    expect(html).toContain('<div class="mermaid-container">');
    expect(html).toContain('<pre class="mermaid">');
    expect(html).toContain('graph TD');
    expect(html).toContain('A[Start] --&gt; B[Process]');
  });

  it('should not transform non-mermaid code blocks', async () => {
    const markdown = `
\`\`\`javascript
console.log('Hello');
\`\`\`

\`\`\`python
print("World")
\`\`\`
`;

    const result = await processor().process(markdown);
    const html = result.toString();
    
    expect(html).not.toContain('mermaid');
    expect(html).toContain('<code class="language-javascript">');
    expect(html).toContain('<code class="language-python">');
  });

  it('should escape HTML in mermaid content', async () => {
    const markdown = `
\`\`\`mermaid
graph TD
  A["<script>alert('xss')</script>"] --> B[End]
\`\`\`
`;

    const result = await processor().process(markdown);
    const html = result.toString();
    
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&#039;xss&#039;'); // Single quotes are escaped differently
  });

  it('should respect wrapInContainer option', async () => {
    const markdown = `
\`\`\`mermaid
graph LR
  A --> B
\`\`\`
`;

    const result = await processor({ wrapInContainer: false }).process(markdown);
    const html = result.toString();
    
    expect(html).not.toContain('<div class="mermaid-container">');
    expect(html).toContain('<pre class="mermaid">');
  });

  it('should use custom container and mermaid classes', async () => {
    const markdown = `
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
`;

    const result = await processor({
      containerClass: 'custom-container',
      mermaidClass: 'custom-mermaid'
    }).process(markdown);
    const html = result.toString();
    
    expect(html).toContain('<div class="custom-container">');
    expect(html).toContain('<pre class="custom-mermaid">');
  });

  it('should add loading indicator when enabled', async () => {
    const markdown = `
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
`;

    const result = await processor({ addLoadingIndicator: true }).process(markdown);
    const html = result.toString();
    
    expect(html).toContain('<div class="mermaid-loading">Loading diagram...</div>');
  });

  it('should add theme data attribute when specified', async () => {
    const markdown = `
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
`;

    const result = await processor({ theme: 'dark' }).process(markdown);
    const html = result.toString();
    
    expect(html).toContain('data-theme="dark"');
  });

  it('should handle complex mermaid diagrams', async () => {
    const markdown = `
\`\`\`mermaid
sequenceDiagram
    participant Alice
    participant Bob
    Alice->>John: Hello John, how are you?
    loop Healthcheck
        John->>John: Fight against hypochondria
    end
    Note right of John: Rational thoughts <br/>prevail!
    John-->>Alice: Great!
    John->>Bob: How about you?
    Bob-->>John: Jolly good!
\`\`\`
`;

    const result = await processor().process(markdown);
    const html = result.toString();
    
    expect(html).toContain('sequenceDiagram');
    expect(html).toContain('participant Alice');
    expect(html).toContain('&lt;br/&gt;'); // <br/> should be escaped
  });

  it('should handle multiple mermaid blocks in one document', async () => {
    const markdown = `
# First Diagram

\`\`\`mermaid
graph TD
  A --> B
\`\`\`

# Second Diagram

\`\`\`mermaid
pie title Pets
  "Dogs" : 386
  "Cats" : 85
\`\`\`
`;

    const result = await processor().process(markdown);
    const html = result.toString();
    
    // Count occurrences of mermaid container
    const containerMatches = html.match(/mermaid-container/g);
    expect(containerMatches).toHaveLength(2);
    
    expect(html).toContain('graph TD');
    expect(html).toContain('pie title Pets');
  });
});