# Mermaid Diagram Rendering

repo-processor supports two methods for rendering Mermaid diagrams in your markdown files:

## 1. Rehype-Mermaid (Default)

By default, repo-processor uses [rehype-mermaid](https://github.com/remcohaszing/rehype-mermaid) to render Mermaid diagrams locally. This provides several rendering strategies:

- **inline-svg** (default): Renders diagrams as inline SVG elements
- **img-svg**: Renders as `<img>` elements with inline SVG data
- **img-png**: Renders as `<img>` elements with base64 PNG data  
- **pre-mermaid**: Leaves as `<pre class="mermaid">` for client-side rendering

### Configuration

```javascript
const processor = new RepoProcessor({
  rehypeMermaidOptions: {
    enabled: true,              // Default: true
    strategy: 'inline-svg',     // Default: 'inline-svg'
    dark: true,                 // Enable dark mode (img-png/img-svg only)
    prefix: 'mermaid',         // ID prefix (default: 'mermaid')
    mermaidConfig: {           // Custom Mermaid configuration
      theme: 'default'
    }
  }
})
```

### Requirements

For server-side rendering outside browsers, rehype-mermaid requires Playwright:

```bash
npm install playwright
npx playwright install --with-deps chromium
```

If Playwright is not available, the plugin will gracefully fallback to rendering Mermaid blocks as code blocks with appropriate warnings.

## 2. Iframe Embedding (Legacy)

The legacy iframe method renders Mermaid diagrams using the external `iframe.repo.md` service:

```javascript
const processor = new RepoProcessor({
  iframeEmbedOptions: {
    features: {
      mermaid: true    // Enable iframe rendering
    }
  },
  rehypeMermaidOptions: {
    enabled: false     // Disable rehype-mermaid
  }
})
```

## Comparison

| Feature | Rehype-Mermaid | Iframe Embedding |
|---------|----------------|------------------|
| External Dependencies | Playwright (optional) | None |
| Network Requests | None | Yes (iframe.repo.md) |
| Security | Local rendering | Sandboxed iframe |
| Dark Mode | Yes (img strategies) | No |
| Performance | Faster (local) | Slower (network) |
| Offline Support | Yes | No |

## Migration from Iframe to Rehype-Mermaid

The default behavior has changed:
- **Previously**: Mermaid diagrams rendered via iframe by default
- **Now**: Mermaid diagrams rendered locally via rehype-mermaid by default

To restore the previous behavior:

```javascript
const processor = new RepoProcessor({
  iframeEmbedOptions: {
    features: { mermaid: true }
  },
  rehypeMermaidOptions: {
    enabled: false
  }
})
```

## Example

Input markdown:
```markdown
\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do this]
    B -->|No| D[Do that]
\`\`\`
```

Output with rehype-mermaid (inline-svg):
```html
<svg id="mermaid-0" ...>
  <!-- SVG content -->
</svg>
```

Output with iframe embedding:
```html
<iframe 
  src="https://iframe.repo.md/mermaid/..." 
  class="repo-iframe repo-iframe-mermaid"
  width="100%" 
  height="600px">
</iframe>
```