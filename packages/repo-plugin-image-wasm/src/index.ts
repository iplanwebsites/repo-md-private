/**
 * WASM Image Processor Plugin
 *
 * Portable image processing using WebAssembly.
 * Compatible with Cloudflare Workers, Deno, and other constrained environments.
 * Alternative to Sharp for environments where native bindings aren't available.
 */

import { optimizeImageExt } from 'wasm-image-optimization';
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

export interface WasmImageProcessorOptions {
  /** Default quality for lossy formats (default: 80) */
  readonly defaultQuality?: number;
  /** Encoding speed 0-10, slower to faster (default: 6) */
  readonly speed?: number;
  /** Enable resize filtering for better quality (default: true) */
  readonly filter?: boolean;
}

// ============================================================================
// Supported Formats
// ============================================================================

const SUPPORTED_FORMATS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
]);

const SVG_FORMATS = new Set(['.svg']);

// GIF and TIFF are not supported by wasm-image-optimization
const COPY_ONLY_FORMATS = new Set(['.gif', '.tiff', '.tif']);

// ============================================================================
// WASM Image Processor Plugin
// ============================================================================

/**
 * Image processor using WebAssembly for portable image operations.
 * Works in Cloudflare Workers and other WASM-capable environments.
 */
export class WasmImageProcessor implements ImageProcessorPlugin {
  readonly name = 'imageProcessor' as const;
  private ready = false;
  private context: PluginContext | null = null;
  private options: Required<WasmImageProcessorOptions>;

  constructor(options: WasmImageProcessorOptions = {}) {
    this.options = {
      defaultQuality: options.defaultQuality ?? 80,
      speed: options.speed ?? 6,
      filter: options.filter ?? true,
    };
  }

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    context.log('WasmImageProcessor initialized (wasm-image-optimization)', 'debug');
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

    // For copy-only formats, we can't get dimensions easily without additional libraries
    if (COPY_ONLY_FORMATS.has(ext)) {
      return {
        width: 0,
        height: 0,
        format: ext.slice(1),
      };
    }

    // Use wasm-image-optimization to get metadata by processing with format: 'none'
    const imageBuffer = await fs.readFile(filePath);
    const result = await optimizeImageExt({
      image: imageBuffer,
      format: 'none', // Don't convert, just get dimensions
    });

    if (!result) {
      throw new Error(`Failed to read image metadata: ${filePath}`);
    }

    return {
      width: result.originalWidth,
      height: result.originalHeight,
      format: this.detectFormat(ext),
    };
  }

  async process(
    inputPath: string,
    outputPath: string,
    options: ImageProcessOptions
  ): Promise<ImageProcessResult> {
    const ext = path.extname(inputPath).toLowerCase();

    // SVG and copy-only formats are just copied
    if (SVG_FORMATS.has(ext) || COPY_ONLY_FORMATS.has(ext)) {
      await this.copy(inputPath, outputPath);
      const stats = await fs.stat(outputPath);
      return {
        outputPath,
        width: 0,
        height: 0,
        format: ext.slice(1),
        size: stats.size,
      };
    }

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Read input image
    const imageBuffer = await fs.readFile(inputPath);

    // Map our format to wasm-image-optimization format
    const wasmFormat = this.mapFormat(options.format);
    const quality = options.quality ?? this.options.defaultQuality;

    // Process the image
    const result = await optimizeImageExt({
      image: imageBuffer,
      width: options.width,
      height: options.height,
      format: wasmFormat,
      quality,
      speed: this.options.speed,
      filter: this.options.filter,
    });

    if (!result) {
      throw new Error(`Failed to process image: ${inputPath}`);
    }

    // Get output path with correct extension
    const targetPath = this.getOutputPath(outputPath, options.format);

    // Write output
    await fs.writeFile(targetPath, result.data);

    return {
      outputPath: targetPath,
      width: result.width,
      height: result.height,
      format: options.format,
      size: result.data.length,
    };
  }

  async copy(inputPath: string, outputPath: string): Promise<void> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.copyFile(inputPath, outputPath);
  }

  /**
   * Map our format enum to wasm-image-optimization format
   */
  private mapFormat(
    format: ImageProcessOptions['format']
  ): 'webp' | 'avif' | 'jpeg' | 'png' {
    // Direct mapping - both use the same format names
    return format;
  }

  /**
   * Detect format from file extension
   */
  private detectFormat(ext: string): string {
    const formatMap: Record<string, string> = {
      '.jpg': 'jpeg',
      '.jpeg': 'jpeg',
      '.png': 'png',
      '.webp': 'webp',
      '.avif': 'avif',
    };
    return formatMap[ext] ?? ext.slice(1);
  }

  /**
   * Get output path with correct extension
   */
  private getOutputPath(
    basePath: string,
    format: ImageProcessOptions['format']
  ): string {
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
 * Create a WASM image processor plugin
 */
export const createWasmImageProcessor = (
  options?: WasmImageProcessorOptions
): ImageProcessorPlugin => {
  return new WasmImageProcessor(options);
};

// Default export
export default WasmImageProcessor;
