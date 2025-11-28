/**
 * WASM Image Processor
 * @module @repo-md/build-worker-cf
 *
 * WASM-based image processor for Cloudflare Workers/Containers.
 * Uses wasm-image-optimization for portable image processing.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { optimizeImageExt } from "wasm-image-optimization";

/**
 * Image processing options
 */
export interface ImageOptions {
  /** Maximum width (will maintain aspect ratio) */
  maxWidth: number;
  /** Quality 1-100 */
  quality: number;
  /** Output format */
  format: "webp" | "avif" | "jpeg" | "png";
}

/**
 * Image processing result
 */
export interface ImageResult {
  /** Output width */
  width: number;
  /** Output height */
  height: number;
  /** Size in bytes */
  size: number;
  /** Format */
  format: string;
}

/**
 * Supported input formats
 */
const SUPPORTED_FORMATS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
]);

/**
 * Formats that should be copied without processing
 */
const COPY_ONLY_FORMATS = new Set([".gif", ".svg", ".ico"]);

/**
 * Image processor using WebAssembly
 */
export class ImageProcessor {
  private initialized = false;

  /**
   * Check if a file format is supported
   */
  canProcess(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return SUPPORTED_FORMATS.has(ext);
  }

  /**
   * Check if a file should be copied without processing
   */
  shouldCopy(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return COPY_ONLY_FORMATS.has(ext);
  }

  /**
   * Optimize an image buffer
   */
  async optimize(
    inputBuffer: Buffer | Uint8Array,
    options: ImageOptions
  ): Promise<{ data: Uint8Array; width: number; height: number }> {
    const result = await optimizeImageExt({
      image: inputBuffer,
      width: options.maxWidth,
      format: options.format,
      quality: options.quality,
      speed: 6, // Balanced speed/quality
      filter: true, // Better resize quality
    });

    if (!result) {
      throw new Error("Failed to process image");
    }

    return {
      data: result.data,
      width: result.width,
      height: result.height,
    };
  }

  /**
   * Optimize an image file
   */
  async optimizeFile(
    inputPath: string,
    outputPath: string,
    options: ImageOptions
  ): Promise<ImageResult> {
    // Check if we should just copy
    if (this.shouldCopy(inputPath)) {
      await this.copyFile(inputPath, outputPath);
      const stats = await fs.stat(outputPath);
      return {
        width: 0,
        height: 0,
        size: stats.size,
        format: path.extname(inputPath).slice(1),
      };
    }

    // Check if format is supported
    if (!this.canProcess(inputPath)) {
      throw new Error(`Unsupported image format: ${inputPath}`);
    }

    // Read input
    const inputBuffer = await fs.readFile(inputPath);

    // Process
    const result = await this.optimize(inputBuffer, options);

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Get correct output path with format extension
    const finalPath = this.getOutputPath(outputPath, options.format);

    // Write output
    await fs.writeFile(finalPath, result.data);

    return {
      width: result.width,
      height: result.height,
      size: result.data.length,
      format: options.format,
    };
  }

  /**
   * Copy a file without processing
   */
  private async copyFile(inputPath: string, outputPath: string): Promise<void> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.copyFile(inputPath, outputPath);
  }

  /**
   * Get output path with correct extension
   */
  private getOutputPath(basePath: string, format: string): string {
    const ext = path.extname(basePath);
    const base = basePath.slice(0, -ext.length || undefined);

    const formatExtensions: Record<string, string> = {
      webp: ".webp",
      avif: ".avif",
      jpeg: ".jpg",
      png: ".png",
    };

    return base + (formatExtensions[format] ?? `.${format}`);
  }
}

/**
 * Create a new image processor instance
 */
export function createImageProcessor(): ImageProcessor {
  return new ImageProcessor();
}

export default ImageProcessor;
