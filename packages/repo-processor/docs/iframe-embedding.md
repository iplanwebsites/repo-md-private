# Iframe Embedding Documentation

The `remarkIframeEmbed` plugin transforms code blocks and naked URLs into iframe embeds for better rendering and isolation.

## Default Settings

By default, the following content types are enabled for iframe transformation:

- **mermaid**: `true` - Mermaid diagram code blocks
- **video**: `true` - Video URLs (`.mp4`, `.webm`, `.ogv`, `.mov`)
- **midi**: `true` - MIDI URLs (`.mid`, `.midi`)
- **model3d**: `true` - 3D model URLs (`.gltf`, `.glb`, `.obj`, `.stl`, `.fbx`, `.dae`, `.3ds`, `.ply`)
- **markdown**: `false` - Markdown code blocks
- **code**: `false` - Programming language code blocks
- **html**: `false` - HTML code blocks

## Iframe Attributes

All iframes include these attributes for security and functionality:

```html
<iframe 
  width="100%"
  frameborder="0"
  sandbox="allow-scripts allow-same-origin"
  allow="fullscreen"
  allowfullscreen="true"
  class="repo-iframe repo-iframe-{type}"
>
</iframe>
```

## Default Heights

Each content type has a configured default height:

- **mermaid**: 600px (diagrams often need vertical space)
- **video**: 480px (maintains 16:9 aspect ratio at common widths)
- **midi**: 120px (minimal player controls)
- **model3d**: 600px (3D viewers need space for controls)
- **code**: 400px (reasonable for code viewing)
- **html**: 400px (flexible preview height)
- **markdown**: 300px (compact text preview)

## CSS Classes

The plugin adds semantic CSS classes to all iframes:

- Base class: `repo-iframe`
- Type-specific class: `repo-iframe-{contentType}`

For video content, a special responsive wrapper is used:
- Wrapper class: `repo-iframe repo-iframe-video-wrapper`
- Maintains 16:9 aspect ratio using padding-bottom technique

## Usage Examples

### Mermaid Diagrams

```markdown
\`\`\`mermaid
graph TD
  A[Start] --> B[Process]
  B --> C[End]
\`\`\`
```

Transforms to:
```html
<iframe 
  src="https://iframe.repo.md/mermaid/..." 
  class="repo-iframe repo-iframe-mermaid"
  height="600px"
  ...
></iframe>
```

### Video URLs

```markdown
https://example.com/video.mp4
```

Transforms to:
```html
<div class="repo-iframe repo-iframe-video-wrapper" style="...">
  <iframe 
    src="https://iframe.repo.md/video/url/..." 
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
    ...
  ></iframe>
</div>
```

### 3D Models

```markdown
https://example.com/model.glb
```

Transforms to:
```html
<iframe 
  src="https://iframe.repo.md/model3d/url/glb/..." 
  class="repo-iframe repo-iframe-model3d"
  height="600px"
  ...
></iframe>
```

## Configuration

Override defaults in `ProcessOptions`:

```javascript
{
  iframeEmbedOptions: {
    features: {
      mermaid: true,  // Override: enable/disable specific types
      code: true,     // Enable code block transformation
      video: false    // Disable video transformation
    },
    heights: {
      mermaid: '800px',  // Custom height for mermaid
      video: '720px'     // Custom height for video
    },
    iframeAttributes: {
      loading: 'lazy',   // Add lazy loading
      width: '854px'     // Fixed width instead of 100%
    }
  }
}
```

## Recommended CSS

See `examples/iframe-styles.css` for recommended styles including:
- Responsive adjustments
- Dark mode support
- Loading states
- Mobile optimizations
- Aspect ratio preservation