import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { remarkIframeEmbed } from '../src/remark/remarkIframeEmbed';

describe('remarkIframeEmbed', () => {
  const processor = (options?: any) =>
    unified()
      .use(remarkParse)
      .use(remarkIframeEmbed, options)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true });

  it('should transform mermaid code blocks to iframes', async () => {
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
    
    expect(html).toContain('<iframe');
    expect(html).toContain('src="https://iframe.repo.md/mermaid/');
    expect(html).toContain('width="100%"');
    expect(html).toContain('height="400px"');
    expect(html).not.toContain('```mermaid');
  });

  it('should not transform code blocks when feature is disabled', async () => {
    const markdown = `
\`\`\`mermaid
graph TD
  A --> B
\`\`\`

\`\`\`javascript
console.log('Hello');
\`\`\`
`;

    const result = await processor({ 
      features: { 
        mermaid: false,
        code: false 
      } 
    }).process(markdown);
    const html = result.toString();
    
    expect(html).not.toContain('<iframe');
    expect(html).toContain('<code class="language-mermaid">');
    expect(html).toContain('<code class="language-javascript">');
  });

  it('should transform HTML code blocks when enabled', async () => {
    const markdown = `
\`\`\`html
<h1>Hello World</h1>
<p>This is HTML content</p>
\`\`\`
`;

    const result = await processor({ 
      features: { html: true } 
    }).process(markdown);
    const html = result.toString();
    
    expect(html).toContain('<iframe');
    expect(html).toContain('src="https://iframe.repo.md/html/');
  });

  it('should handle code blocks with language mappings', async () => {
    const markdown = `
\`\`\`js
console.log('JavaScript');
\`\`\`

\`\`\`py
print("Python")
\`\`\`

\`\`\`mmd
graph LR
  A --> B
\`\`\`
`;

    const result = await processor({ 
      features: { 
        code: true,
        mermaid: true 
      } 
    }).process(markdown);
    const html = result.toString();
    
    // JS should be mapped to code
    expect(html).toContain('src="https://iframe.repo.md/code/js/');
    // Python should be mapped to code
    expect(html).toContain('src="https://iframe.repo.md/code/py/');
    // mmd should be mapped to mermaid
    expect(html).toContain('src="https://iframe.repo.md/mermaid/');
  });

  it('should use custom iframe attributes', async () => {
    const markdown = `
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
`;

    const result = await processor({
      iframeAttributes: {
        width: '800px',
        height: '600px',
        class: 'custom-iframe',
        loading: 'lazy'
      }
    }).process(markdown);
    const html = result.toString();
    
    expect(html).toContain('width="800px"');
    expect(html).toContain('height="600px"');
    expect(html).toContain('class="custom-iframe"');
    expect(html).toContain('loading="lazy"');
  });

  it('should use custom base URL', async () => {
    const markdown = `
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
`;

    const result = await processor({
      baseUrl: 'https://custom-iframe-service.com'
    }).process(markdown);
    const html = result.toString();
    
    expect(html).toContain('src="https://custom-iframe-service.com/mermaid/');
  });

  it('should respect advanced feature configuration', async () => {
    const markdown = `
\`\`\`javascript
// Short code
console.log('Hi');
\`\`\`

\`\`\`javascript
// Longer code
function example() {
  const a = 1;
  const b = 2;
  return a + b;
}
console.log(example());
\`\`\`

\`\`\`python
print("This should not be transformed")
\`\`\`
`;

    const result = await processor({
      features: {
        code: true // Need to enable code since default is now false
      },
      advancedFeatures: {
        code: {
          enabled: true,
          languages: ['javascript'],
          minLines: 5,
          attributes: { height: '300px' }
        }
      }
    }).process(markdown);
    const html = result.toString();
    
    // Short JS code should not be transformed (less than 5 lines)
    expect(html).toMatch(/<code class="language-javascript"[^>]*>[\s\S]*Short code/);
    
    // Longer JS code should be transformed
    expect(html).toContain('src="https://iframe.repo.md/code/javascript/');
    expect(html).toContain('height="300px"');
    
    // Python should not be transformed (not in languages list)
    expect(html).toContain('<code class="language-python">');
  });

  it('should handle custom transformers', async () => {
    const markdown = `
\`\`\`plantuml
@startuml
Alice -> Bob: Hello
@enduml
\`\`\`
`;

    const result = await processor({
      customTransformers: {
        plantuml: (content, baseUrl, encoding) => {
          return `${baseUrl}/plantuml/${Buffer.from(content).toString('base64')}`;
        }
      },
      advancedFeatures: {
        plantuml: { enabled: true }
      }
    }).process(markdown);
    const html = result.toString();
    
    expect(html).toContain('<iframe');
    expect(html).toContain('src="https://iframe.repo.md/plantuml/');
  });

  it('should properly encode content', async () => {
    const markdown = `
\`\`\`mermaid
graph TD
  A["Node with <special> chars & symbols"] --> B[End]
\`\`\`
`;

    const result = await processor().process(markdown);
    const html = result.toString();
    
    // Should contain base64 encoded content
    expect(html).toContain('<iframe');
    expect(html).toContain('src="https://iframe.repo.md/mermaid/');
    // Should not contain raw special characters
    expect(html).not.toContain('<special>');
    expect(html).not.toContain('&');
  });

  it('should handle multiple code blocks in one document', async () => {
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

# Some Code

\`\`\`javascript
console.log('test');
\`\`\`
`;

    const result = await processor({
      features: {
        mermaid: true,
        code: true
      }
    }).process(markdown);
    const html = result.toString();
    
    // Count iframe occurrences
    const iframeMatches = html.match(/<iframe/g);
    expect(iframeMatches).toHaveLength(3);
    
    // Check for different iframe types
    expect(html.match(/iframe\.repo\.md\/mermaid\//g)).toHaveLength(2);
    expect(html.match(/iframe\.repo\.md\/code\/javascript\//g)).toHaveLength(1);
  });
});