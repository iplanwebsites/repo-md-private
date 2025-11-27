/**
 * Sharp Image Processor Plugin
 *
 * High-performance image processing using libvips via Sharp.
 * Supports resizing, format conversion, and optimization.
 */

import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  ImageProcessorPlugin,
  ImageMetadata,
  ImageProcessOptions,
  ImageProcessResult,
  PluginContext,
} from '@repo-md/processor-core';

// ============================================================================
// Types
// ============================================================================

export interface SharpImageProcessorOptions {
  /** Default quality for lossy formats (default: 80) */
  readonly defaultQuality?: number;
  /** Enable metadata stripping (default: true) */
  readonly stripMetadata?: boolean;
  /** Enable progressive rendering for JPEG (default: true) */
  readonly progressive?: boolean;
  /** Cache directory for Sharp (optional) */
  readonly cacheDir?: string;
}

// ============================================================================
// Supported Formats
// ============================================================================

const SUPPORTED_FORMATS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.avif',
  '.tiff',
  '.tif',
]);

const SVG_FORMATS = new Set(['.svg']);

// ============================================================================
// Sharp Image Processor Plugin
// ============================================================================

/**
 * Image processor using Sharp for high-performance image operations
 */
export class SharpImageProcessor implements ImageProcessorPlugin {
  readonly name = 'imageProcessor' as const;
  private ready = false;
  private context: PluginContext | null = null;
  private options: Required<SharpImageProcessorOptions>;

  constructor(options: SharpImageProcessorOptions = {}) {
    this.options = {
      defaultQuality: options.defaultQuality ?? 80,
      stripMetadata: options.stripMetadata ?? true,
      progressive: options.progressive ?? true,
      cacheDir: options.cacheDir ?? '',
    };
  }

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;

    // Configure Sharp cache if specified
    if (this.options.cacheDir) {
      sharp.cache({ files: 50, memory: 100, items: 100 });
    }

    // Verify Sharp is working
    try {
      const versions = sharp.versions;
      context.log(
        `SharpImageProcessor initialized (Sharp ${versions.sharp}, libvips ${versions.vips})`,
        'debug'
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      context.log(`Sharp initialization warning: ${msg}`, 'warn');
    }

    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  canProcess(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return SUPPORTED_FORMATS.has(ext);
  }

  async getMetadata(filePath: string): Promise<ImageMetadata> {
    const ext = path.extname(filePath).toLowerCase();

    // SVG files need special handling
    if (SVG_FORMATS.has(ext)) {
      return {
        width: 0,
        height: 0,
        format: 'svg',
      };
    }

    const metadata = await sharp(filePath).metadata();

    return {
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
      format: metadata.format ?? 'unknown',
    };
  }

  async process(
    inputPath: string,
    outputPath: string,
    options: ImageProcessOptions
  ): Promise<ImageProcessResult> {
    const ext = path.extname(inputPath).toLowerCase();

    // SVG files are just copied, not processed
    if (SVG_FORMATS.has(ext)) {
      await this.copy(inputPath, outputPath);
      const stats = await fs.stat(outputPath);
      return {
        outputPath,
        width: 0,
        height: 0,
        format: 'svg',
        size: stats.size,
      };
    }

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Start with Sharp pipeline
    let pipeline = sharp(inputPath);

    // Resize if dimensions specified
    if (options.width || options.height) {
      pipeline = pipeline.resize({
        width: options.width,
        height: options.height,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Strip metadata if enabled
    if (this.options.stripMetadata) {
      pipeline = pipeline.rotate(); // Auto-rotate based on EXIF, then strip
    }

    // Apply format conversion
    const quality = options.quality ?? this.options.defaultQuality;
    const targetPath = this.getOutputPath(outputPath, options.format);

    switch (options.format) {
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
      case 'avif':
        pipeline = pipeline.avif({ quality });
        break;
      case 'jpeg':
        pipeline = pipeline.jpeg({
          quality,
          progressive: this.options.progressive,
        });
        break;
      case 'png':
        pipeline = pipeline.png({
          compressionLevel: 9,
          progressive: this.options.progressive,
        });
        break;
    }

    // Process and save
    const info = await pipeline.toFile(targetPath);

    return {
      outputPath: targetPath,
      width: info.width,
      height: info.height,
      format: info.format,
      size: info.size,
    };
  }

  async copy(inputPath: string, outputPath: string): Promise<void> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.copyFile(inputPath, outputPath);
  }

  /**
   * Get output path with correct extension
   */
  private getOutputPath(basePath: string, format: ImageProcessOptions['format']): string {
    const ext = path.extname(basePath);
    const base = basePath.slice(0, -ext.length);

    const formatExtensions: Record<string, string> = {
      webp: '.webp',
      avif: '.avif',
      jpeg: '.jpg',
      png: '.png',
    };

    return base + (formatExtensions[format] ?? ext);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Sharp image processor plugin
 */
export const createSharpImageProcessor = (
  options?: SharpImageProcessorOptions
): ImageProcessorPlugin => {
  return new SharpImageProcessor(options);
};

// Default export
export default SharpImageProcessor;
