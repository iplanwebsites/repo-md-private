# CLAUDE.md

This file provides guidance for the @repo-md/plugin-image-sharp package.

## Overview

Sharp-based image processing plugin for @repo-md/processor-core. Provides high-performance image resizing, format conversion, and optimization.

## Commands

```bash
npm run build      # Build TypeScript
npm run dev        # Watch mode
npm run typecheck  # Type checking
```

## Usage

```typescript
import { Processor } from '@repo-md/processor-core';
import { SharpImageProcessor } from '@repo-md/plugin-image-sharp';

const processor = new Processor({
  dir: { input: './vault' },
  plugins: {
    imageProcessor: new SharpImageProcessor({
      // Optional configuration
      defaultQuality: 80,
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

## Features

- **Format conversion**: webp, avif, jpeg, png
- **Responsive sizes**: Multiple width variants with suffixes
- **Quality control**: Configurable compression quality
- **Metadata extraction**: Width, height, format
- **No upscaling**: Images are never enlarged beyond original size

## Supported Formats

| Input | Output |
|-------|--------|
| JPEG | webp, avif, jpeg, png |
| PNG | webp, avif, jpeg, png |
| WebP | webp, avif, jpeg, png |
| AVIF | webp, avif, jpeg, png |
| GIF | Copy only (no processing) |
| TIFF | webp, avif, jpeg, png |

## Dependencies

- `sharp` - High-performance image processing
- `@repo-md/processor-core` - Peer dependency for plugin types

## Architecture

```typescript
interface SharpImageProcessorOptions {
  defaultQuality?: number;  // Default: 80
}

class SharpImageProcessor implements ImageProcessorPlugin {
  readonly name = 'imageProcessor';

  canProcess(filePath: string): boolean;
  getMetadata(filePath: string): Promise<ImageMetadata>;
  process(input, output, options): Promise<ImageResult>;
  copy(input, output): Promise<void>;
}
```
