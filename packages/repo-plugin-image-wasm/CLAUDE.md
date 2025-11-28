# CLAUDE.md

This file provides guidance for the @repo-md/plugin-image-wasm package.

## Overview

WASM-based image processing plugin for @repo-md/processor-core. Provides portable image resizing, format conversion, and optimization using WebAssembly. Alternative to Sharp for environments where native bindings aren't available (Cloudflare Workers, Deno, etc.).

## Commands

```bash
npm run build      # Build TypeScript
npm run dev        # Watch mode
npm run typecheck  # Type checking
```

## Usage

```typescript
import { Processor } from '@repo-md/processor-core';
import { WasmImageProcessor } from '@repo-md/plugin-image-wasm';

const processor = new Processor({
  dir: { input: './vault' },
  plugins: {
    imageProcessor: new WasmImageProcessor({
      // Optional configuration
      defaultQuality: 80,
      speed: 6, // 0-10, slower to faster
    }),
  },
  imageSizes: [
    { width: 320, suffix: 'xs' },
    { width: 640, suffix: 'sm' },
    { width: 1024, suffix: 'md' },
    { width: 1920, suffix: 'lg' },
  ],
  imageFormat: 'webp',
});
```

## When to Use

- **Cloudflare Workers**: No native bindings support
- **Deno Deploy**: WebAssembly-compatible environment
- **Containers without native deps**: Lightweight environments
- **Browser/Edge**: Where WASM is available but native isn't

For Node.js with full native support, prefer `@repo-md/plugin-image-sharp` for better performance.

## Features

- **Format conversion**: webp, avif, jpeg, png
- **Responsive sizes**: Multiple width variants with suffixes
- **Quality control**: Configurable compression quality
- **Speed control**: Trade-off between encoding speed and quality
- **Metadata extraction**: Width, height, format
- **EXIF orientation**: Automatic rotation handling

## Supported Formats

| Input | Output |
|-------|--------|
| JPEG | webp, avif, jpeg, png |
| PNG | webp, avif, jpeg, png |
| WebP | webp, avif, jpeg, png |
| AVIF | webp, avif, jpeg, png |
| SVG | Copy only (no processing) |
| GIF | Copy only (not supported by WASM lib) |
| TIFF | Copy only (not supported by WASM lib) |

## Dependencies

- `wasm-image-optimization` - WebAssembly image processing
- `@repo-md/processor-core` - Peer dependency for plugin types

## Architecture

```typescript
interface WasmImageProcessorOptions {
  defaultQuality?: number;  // Default: 80
  speed?: number;           // Default: 6 (0-10)
  filter?: boolean;         // Default: true (resize filtering)
}

class WasmImageProcessor implements ImageProcessorPlugin {
  readonly name = 'imageProcessor';

  canProcess(filePath: string): boolean;
  getMetadata(filePath: string): Promise<ImageMetadata>;
  process(input, output, options): Promise<ImageResult>;
  copy(input, output): Promise<void>;
}
```

## Comparison with Sharp Plugin

| Feature | Sharp | WASM |
|---------|-------|------|
| Performance | Fastest (libvips) | Good (WASM overhead) |
| Native deps | Required | None |
| CF Workers | No | Yes |
| GIF support | Yes | Copy only |
| TIFF support | Yes | Copy only |
| Bundle size | Large (native) | Medium (WASM) |
