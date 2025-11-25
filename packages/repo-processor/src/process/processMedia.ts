//  processMedia.ts

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp"; 
import ora from "ora";  // Import for the spinner

// Import types from the unified types structure
import type { MediaFileData, MediaPathMap, ProcessMediaOptions } from '../types';
import { calculateFilePathHash } from '../lib/utility';
import { IssueCollector } from '../services/issueCollector';

/**
 * Helper function to create properly typed options with defaults
 */
function createProcessMediaOptions(opts?: ProcessMediaOptions) {
  return {
    mediaOutputFolder: opts?.mediaOutputFolder || path.join(process.cwd(), "public/media"),
    mediaPathPrefix: opts?.mediaPathPrefix || "/media",
    optimizeImages: opts?.optimizeImages !== false,
    imageSizes: opts?.imageSizes || DEFAULT_IMAGE_SIZES,
    imageFormats: opts?.imageFormats || DEFAULT_IMAGE_FORMATS,
    skipExisting: opts?.skipExisting || false, // Default is false
    forceReprocessMedias: opts?.forceReprocessMedias || false, // New option (default false)
    domain: opts?.domain, // This can be undefined
    useMediaHash: opts?.useMediaHash || false, // Default is false
    useMediaHashSharding: opts?.useMediaHashSharding || false, // Default is false
    skipHashes: opts?.skipHashes || [], // Default is empty array
    debug: opts?.debug || 0,
    issueCollector: opts?.issueCollector // Pass through the issue collector
  };
}

/**
 * Default image sizes for optimization
 */
const DEFAULT_IMAGE_SIZES = [
  { width: 320, height: null, suffix: "xs" },
  { width: 640, height: null, suffix: "sm" },
  { width: 1024, height: null, suffix: "md" },
  { width: 1920, height: null, suffix: "lg" },
  { width: 3840, height: null, suffix: "xl" },
  // { width: null, height: null, suffix: "ori" } // Original size
];

/**
 * Default image formats for optimization
 */
const DEFAULT_IMAGE_FORMATS = [
    { format: "webp", options: { quality: 80 } },
  // { format: "avif", options: { quality: 65 } },
  { format: "jpeg", options: { quality: 85, mozjpeg: true } }
];

/**
 * Process media files in an Obsidian vault directory
 * @param dirPath Path to the Obsidian vault directory
 * @param opts Processing options
 * @returns Object containing media data and various path mappings
 */
export async function processMedia(
  dirPath: string,
  opts?: ProcessMediaOptions
): Promise<{
  mediaData: MediaFileData[];
  pathMap: MediaPathMap;
  pathHashMap: Record<string, string>;
  pathUrlMap: Record<string, string>;
}> {
  // Normalize the input path
  dirPath = path.normalize(dirPath);

  // Set default options
  const options = createProcessMediaOptions(opts);

  // Create logging function based on debug level
  const log = createLogger(options.debug);

  log(1, "🔍 Scanning media files in: " + dirPath);
  if (options.skipExisting) {
    log(1, "⏭️ Skip existing files: Enabled");
  }
  if (options.forceReprocessMedias) {
    log(1, "🔄 Force reprocessing: Enabled");
  }
  if (options.useMediaHash) {
    log(1, "🔐 Media hash paths: Enabled" + (options.useMediaHashSharding ? " (with sharding)" : ""));
  }
  
  if (options.skipHashes && options.skipHashes.length > 0) {
    log(1, `⏭️ Skip processing for ${options.skipHashes.length} specified file hash${options.skipHashes.length > 1 ? 'es' : ''}`);
  }

  // Create output directory if it doesn't exist
  if (!fs.existsSync(options.mediaOutputFolder)) {
    fs.mkdirSync(options.mediaOutputFolder, { recursive: true });
    log(1, "📁 Created output directory: " + options.mediaOutputFolder);
  }

  // Get all media files
  const mediaFiles = findMediaFiles(dirPath, log);
  log(1, `🖼️ Found ${mediaFiles.length} media files to process`);

  const mediaData: MediaFileData[] = [];
  const pathMap: MediaPathMap = {};
  
  // Create a progress spinner for better visual feedback
  const spinner = ora('Processing media files...').start();
  let lastUpdateTime = Date.now();
  let processedCount = 0;
  let skippedCount = 0;
  let forcedReprocessCount = 0;
  let hashedCount = 0; // Counter for hashed files
  let hashSkippedCount = 0; // Counter for files skipped due to hash match
  const totalCount = mediaFiles.length;

  // Process each media file
  for (const [index, filePath] of mediaFiles.entries()) {
    try {
      processedCount = index + 1;
      
      // Update the spinner text approximately every second
      const currentTime = Date.now();
      if (currentTime - lastUpdateTime > 1000 || processedCount === totalCount) {
        spinner.text = `Processing media files: ${processedCount}/${totalCount} (${Math.round(processedCount/totalCount*100)}%) - Skipped: ${skippedCount}${options.forceReprocessMedias ? ` - Forced: ${forcedReprocessCount}` : ''}${options.useMediaHash ? ` - Hashed: ${hashedCount}` : ''}${hashSkippedCount > 0 ? ` - Hash-skipped: ${hashSkippedCount}` : ''}`;
        lastUpdateTime = currentTime;
      }
      
      log(2, `⚙️ Processing media file (${index+1}/${mediaFiles.length}): ${filePath}`);
      // Increment hash count if this file will use hashing
      if (options.useMediaHash) {
        hashedCount++;
      }
      const mediaFile = await processMediaFile(filePath, dirPath, options, log, (wasSkipped, wasForced, wasHashSkipped) => {
        if (wasSkipped) skippedCount++;
        if (wasForced) forcedReprocessCount++;
        if (wasHashSkipped) hashSkippedCount++;
      });
      
      mediaData.push(mediaFile);

      // Add to path map, preferring webp format and medium size if available
      // We always want to map from the original relative path (what's in the markdown)
      const relativePath = path.relative(dirPath, filePath).replace(/\\/g, '/');
      const bestPath = findBestOptimizedPath(mediaFile);
      if (bestPath) {
        // Map the original path to the best optimized path
        pathMap[relativePath] = bestPath;
        
        // If we're using hash-based storage, also add a mapping from effective path to best path
        if (options.useMediaHash && mediaFile.hashPath && mediaFile.effectivePath) {
          // Map the hash path to the best optimized path as well
          pathMap[mediaFile.effectivePath] = bestPath;
          log(2, `🔄 Mapped ${relativePath} → ${bestPath} (hash path: ${mediaFile.effectivePath})`);
        } else {
          log(2, `🔄 Mapped ${relativePath} → ${bestPath}`);
        }
      }
    } catch (error) {
      log(0, `❌ Error processing media file ${filePath}: ${error}`);
      
      // Add to issue collector if available
      if (options.issueCollector) {
        options.issueCollector.addMediaProcessingError({
          filePath,
          mediaPath: path.relative(dirPath, filePath).replace(/\\/g, '/'),
          operation: 'read',
          errorMessage: error instanceof Error ? error.message : String(error),
          errorCode: error instanceof Error && 'code' in error ? String(error.code) : undefined
        });
      }
    }
  }

  // Complete the progress spinner
  let successMessage = `✅ Processed ${mediaData.length} media files successfully (${skippedCount} skipped`;
  if (options.forceReprocessMedias) {
    successMessage += `, ${forcedReprocessCount} forced`;
  }
  if (options.useMediaHash) {
    successMessage += `, ${hashedCount} hashed`;
  }
  if (hashSkippedCount > 0) {
    successMessage += `, ${hashSkippedCount} hash-skipped`;
  }
  successMessage += ")";
  spinner.succeed(successMessage);

  // Generate path-to-hash mapping
  const pathHashMap: Record<string, string> = {};
  for (const mediaFile of mediaData) {
    // Get the file hash from metadata or use originalPath for calculation
    let fileHash = mediaFile.metadata?.hash;
    if (!fileHash && mediaFile.originalPath) {
      try {
        const fullPath = path.join(dirPath, mediaFile.originalPath);
        if (fs.existsSync(fullPath)) {
          fileHash = calculateFilePathHash(fullPath);
        }
      } catch (error) {
        // Ignore errors, just don't include this file in the map
        continue;
      }
    }
    
    if (fileHash && mediaFile.originalPath) {
      pathHashMap[mediaFile.originalPath] = fileHash;
    }
  }
  
  // Generate path-to-url mapping
  const pathUrlMap: Record<string, string> = {};
  for (const mediaFile of mediaData) {
    if (mediaFile.originalPath) {
      // Find the best URL for this media file
      const bestUrl = findBestOptimizedPath(mediaFile);
      if (bestUrl) {
        pathUrlMap[mediaFile.originalPath] = bestUrl;
      }
    }
  }
  
  return { mediaData, pathMap, pathHashMap, pathUrlMap };
}

/**
 * Find the best optimized path for a media file
 * Prefers: webp > avif > jpeg > original
 * Uses absolutePublicPath if available (when domain is set)
 */
function findBestOptimizedPath(mediaFile: MediaFileData): string | null {
  // Preferred size order: md, sm, lg, xl, xs, original
  const sizePreference = ['md', 'sm', 'lg', 'xl', 'xs', 'original'];
  
  // Preferred format order: webp, avif, jpeg/jpg, original
  const formatPreference = ['webp', 'avif', 'jpeg', 'jpg', mediaFile.fileExt];
  
  // Check if any size has skippedOptimization flag
  const hasSkippedOptimization = Object.values(mediaFile.sizes).some(
    sizeArray => sizeArray.some(size => size.skippedOptimization)
  );
  
  // If optimization was skipped, prioritize the original format
  if (hasSkippedOptimization) {
    // Find any size with skippedOptimization flag
    for (const sizeName in mediaFile.sizes) {
      const sizeArray = mediaFile.sizes[sizeName];
      const skippedItem = sizeArray.find(item => item.skippedOptimization);
      
      if (skippedItem) {
        // Return the public path of the skipped item
        return skippedItem.absolutePublicPath || skippedItem.publicPath;
      }
    }
  }
  
  // Otherwise, find the best available option based on preferences
  for (const size of sizePreference) {
    if (mediaFile.sizes[size]) {
      for (const format of formatPreference) {
        const formatOption = mediaFile.sizes[size]?.find(option => option.format === format);
        if (formatOption) {
          // Use absolutePublicPath if available (domain was set), otherwise fall back to publicPath
          return formatOption.absolutePublicPath || formatOption.publicPath;
        }
      }
    }
  }
  
  // If no optimized version found, use the original
  if (mediaFile.sizes.original && mediaFile.sizes.original.length > 0) {
    // Same here - use absolutePublicPath if available
    return mediaFile.sizes.original[0].absolutePublicPath || mediaFile.sizes.original[0].publicPath;
  }
  
  return null;
}

/**
 * Find all media files in a directory
 * @param dirPath Directory path
 * @param log Logging function
 * @returns Array of file paths
 */
function findMediaFiles(dirPath: string, log: (level: number, message: string) => void): string[] {
  const mediaFiles: string[] = [];
  const mediaExtensions = new Set([
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg", ".mp4", ".webm"
  ]);

  function scanDirectory(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    log(3, `📂 Scanning directory: ${currentPath}`);

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories and node_modules
        if (entry.name.startsWith(".") || entry.name === "node_modules") {
          log(3, `⏭️ Skipping directory: ${entry.name}`);
          continue;
        }
        // Recursively scan subdirectories
        scanDirectory(entryPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (mediaExtensions.has(ext)) {
          mediaFiles.push(entryPath);
          log(3, `📄 Found media file: ${entry.name}`);
        }
      }
    }
  }

  scanDirectory(dirPath);
  return mediaFiles;
}

/**
 * Check if a file should be skipped based on existing outputs
 * @param filePath Original file path
 * @param outputPath Output file path
 * @param options Processing options
 * @returns Boolean indicating if file should be skipped
 */
function shouldSkipFile(
  filePath: string,
  outputPath: string,
  options: ReturnType<typeof createProcessMediaOptions>
): boolean {
  // If force reprocessing is enabled, never skip
  if (options.forceReprocessMedias) {
    return false;
  }
  
  // If skip existing is disabled, never skip
  if (!options.skipExisting) {
    return false;
  }
  
  // Check if output file exists
  if (!fs.existsSync(outputPath)) {
    return false;
  }
  
  // Check if source file is newer than output file
  const sourceStats = fs.statSync(filePath);
  const outputStats = fs.statSync(outputPath);
  
  // If source is newer, we shouldn't skip
  if (sourceStats.mtimeMs > outputStats.mtimeMs) {
    return false;
  }
  
  return true;
}

/**
 * Process a single media file
 * @param filePath Path to the media file
 * @param rootDir Root directory path
 * @param options Processing options
 * @param log Logging function
 * @param onSkip Callback when a file is skipped or forced
 * @returns Media file data
 */
async function processMediaFile(
  filePath: string,
  rootDir: string,
  options: ReturnType<typeof createProcessMediaOptions>,
  log: (level: number, message: string) => void,
  onSkip?: (skipped: boolean, forced: boolean, hashSkipped?: boolean) => void
): Promise<MediaFileData> {
  const { base: fileName, ext: fileExt } = path.parse(filePath);
  const relativePath = path.relative(rootDir, filePath);
  const isImage = /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(fileExt);
  
  // Calculate hash if using hash-based paths or if we have a skipHashes list
  let fileHash: string | null = null;
  const isUsingHash = options.useMediaHash;
  const hasSkipHashes = options.skipHashes.length > 0;
  
  if (isUsingHash || hasSkipHashes) {
    fileHash = calculateFilePathHash(filePath);
    log(3, `📊 File hash for ${fileName}: ${fileHash}`);
    
    // Check if this file should be skipped based on its hash
    if (hasSkipHashes && fileHash && options.skipHashes.includes(fileHash)) {
      log(2, `⏭️ Skipping file with hash match: ${fileName} (${fileHash})`);
      if (onSkip) {
        onSkip(false, false, true); // Signal that this file was skipped due to hash match
      }
    }
    
    if (isUsingHash) {
      // This file is using hashing (tracking is now done in the outer function)
      log(3, `📊 Using hash-based path for: ${fileName}`);
    }
  }
  
  // Determine the hash path that will be used if hash-based storage is enabled
  let hashPath: string | undefined;
  if (isUsingHash && fileHash) {
    if (options.useMediaHashSharding) {
      // Create sharded path
      const shardDir = fileHash.substring(0, 2);
      hashPath = path.join(shardDir, fileHash + fileExt).replace(/\\/g, '/');
    } else {
      // Store directly in media directory
      hashPath = path.join(fileHash + fileExt).replace(/\\/g, '/');
    }
  }

  // Determine the effective path (the one that will be used in rendered HTML)
  const effectivePath = isUsingHash && hashPath ? hashPath : relativePath;
  
  // Create media file data structure
  const mediaFile: MediaFileData = {
    originalPath: relativePath,
    fileName,
    fileExt: fileExt.slice(1), // Remove the dot
    mimeType: getMimeType(fileExt),
    effectivePath,
    hashPath,
    sizes: {},
    metadata: {
      format: fileExt.slice(1).toLowerCase() // Store the original format
    }
  };

  // Add hash to metadata if using hash paths
  if (fileHash && isUsingHash && mediaFile.metadata) {
    mediaFile.metadata.hash = fileHash;
  }

  // Get file stats but don't store in metadata
  const stats = fs.statSync(filePath);

  // Process image if optimization is enabled and it's an image file
  // Skip actual processing if the hash is in the skipHashes list
  const shouldSkipProcessing = hasSkipHashes && fileHash && options.skipHashes.includes(fileHash);
  
  if (options.optimizeImages && isImage) {
    try {
      // Get image metadata and store essential details but not exif
      const imageMetadata = await sharp(filePath).metadata();
      
      // Update metadata with essential properties but skip exif
      mediaFile.metadata = {
        ...mediaFile.metadata,
        width: imageMetadata.width,
        height: imageMetadata.height,
        format: mediaFile.fileExt,
        size: fs.statSync(filePath).size
      };
      
      log(2, `📊 Image: ${fileName} (${imageMetadata.width}x${imageMetadata.height}, ${fileExt})`);
      
      if (shouldSkipProcessing) {
        log(2, `🔍 Using hash-based skip for ${fileName}. Will reference only, no processing.`);
      }

      // Process each image size and format (unless we should skip processing)
      for (const size of options.imageSizes) {
        const sizeName = size.suffix;
        mediaFile.sizes[sizeName] = [];

        for (const format of options.imageFormats) {
          // Skip avif for SVG files
          if (fileExt.toLowerCase() === '.svg' && format.format === 'avif') {
            log(3, `⏭️ Skipping AVIF conversion for SVG: ${fileName}`);
            continue;
          }

          // Determine output directory based on options
          let dirStructure: string;
          let outputDir: string;
          
          if (options.useMediaHash && fileHash) {
            // If using hash-based paths
            if (options.useMediaHashSharding) {
              // Create sharded directory using first 2 characters of hash
              const shardDir = fileHash.substring(0, 2);
              dirStructure = path.join(shardDir);
              outputDir = path.join(options.mediaOutputFolder, shardDir);
            } else {
              // Store directly in media root directory
              dirStructure = '';
              outputDir = options.mediaOutputFolder;
            }
            
            log(3, `📊 Using hash-based path for: ${fileName} (${fileHash})`);
          } else {
            // Use original path structure
            dirStructure = path.dirname(relativePath);
            outputDir = path.join(options.mediaOutputFolder, dirStructure);
          }
          
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            log(3, `📁 Created directory: ${outputDir}`);
          }

          // Generate output filename
          let outputFileName: string;
          
          if (options.useMediaHash && fileHash) {
            // Use file hash for the filename when hash option is enabled
            outputFileName = `${fileHash}${size.suffix !== 'original' ? `-${size.suffix}` : ''}.${format.format}`;
          } else {
            // Use original filename
            outputFileName = `${path.parse(fileName).name}${size.suffix !== 'original' ? `-${size.suffix}` : ''}.${format.format}`;
          }
          
          const outputPath = path.join(outputDir, outputFileName);
          const publicPath = dirStructure 
            ? `${options.mediaPathPrefix}/${dirStructure}/${outputFileName}`.replace(/\\/g, '/')
            : `${options.mediaPathPrefix}/${outputFileName}`.replace(/\\/g, '/');
          
          // Create absolute public path if domain is specified
          const absolutePublicPath = options.domain 
            ? `${options.domain.replace(/\/+$/, '')}${publicPath}`
            : undefined;

          // Skip original size for non-original format
          if (size.suffix === 'original' && format.format !== mediaFile.metadata?.format) {
            log(3, `⏭️ Skipping conversion for original size: ${fileName}`);
            continue;
          }

          // Determine if we should skip processing 
          // Three cases: 
          // 1. Hash is in the skipHashes list
          // 2. File exists and skipExisting is true
          // 3. Force reprocessing is enabled for existing files
          
          const normalSkip = shouldSkipFile(filePath, outputPath, options);
          const isForced = options.forceReprocessMedias && fs.existsSync(outputPath);
          
          // Handle hash-based skipping
          if (shouldSkipProcessing) {
            // We're skipping based on hash, but still need to create references
            // Create directory structure if needed but don't process the file
            
            // Generate mock data based on original image
            mediaFile.sizes[sizeName].push({
              width: imageMetadata.width || 0,
              height: imageMetadata.height || 0,
              format: format.format,
              outputPath: filePath, // Reference original file path
              publicPath, // Still use correct public path
              absolutePublicPath, // Still use correct absolute path if available
              size: stats.size,
              skippedOptimization: true // Mark as skipped
            });
            
            log(3, `⏭️ Hash-skipped processing: ${outputFileName} (added reference only)`);
            continue;
          }
          
          // Handle normal skipping for existing files
          if (normalSkip) {
            log(2, `⏭️ Skipping existing file: ${outputFileName}`);
            if (onSkip) onSkip(true, false);
            
            // Get stats of the existing file
            const existingStats = fs.statSync(outputPath);
            const existingMetadata = await sharp(outputPath).metadata();
            
            // Add to sizes array
            mediaFile.sizes[sizeName].push({
              width: existingMetadata.width || 0,
              height: existingMetadata.height || 0,
              format: format.format,
              outputPath,
              publicPath,
              absolutePublicPath, // Add absolute public path
              size: existingStats.size
            });
            
            continue;
          }
          
          if (isForced) {
            log(2, `🔄 Force reprocessing: ${outputFileName}`);
            if (onSkip) onSkip(false, true);
          }

          // Process image with sharp
          let sharpInstance = sharp(filePath);
          
          // Resize if not original
          if (size.suffix !== 'original') {
            sharpInstance = sharpInstance.resize({
              width: size.width || undefined,
              height: size.height || undefined,
              withoutEnlargement: true,
              fit: 'inside'
            });
          }

          // Convert to format
          if (format.format === 'webp') {
            sharpInstance = sharpInstance.webp(format.options);
          } else if (format.format === 'avif') {
            sharpInstance = sharpInstance.avif(format.options);
          } else if (format.format === 'jpeg' || format.format === 'jpg') {
            sharpInstance = sharpInstance.jpeg(format.options);
          } else if (format.format === 'png') {
            sharpInstance = sharpInstance.png(format.options);
          }

          // Process and save the image
          const actionType = isForced ? "Reprocessing" : "Converting";
          log(3, `🔄 ${actionType} ${fileName} to ${format.format} (${size.suffix})`);
          await sharpInstance.toFile(outputPath);

          // Get stats of the processed file
          const processedStats = fs.statSync(outputPath);
          const processedMetadata = await sharp(outputPath).metadata();

          // Add to sizes array
          mediaFile.sizes[sizeName].push({
            width: processedMetadata.width || 0,
            height: processedMetadata.height || 0,
            format: format.format,
            outputPath,
            publicPath,
            absolutePublicPath, // Add absolute public path
            size: processedStats.size
          });

          const compressionRatio = stats.size > 0 ? 
            ((stats.size - processedStats.size) / stats.size * 100).toFixed(1) : 0;
          
          log(2, `💾 Saved: ${publicPath} (${formatBytes(processedStats.size)}, ${compressionRatio}% smaller)`);
          if (absolutePublicPath) {
            log(3, `🌐 Absolute URL: ${absolutePublicPath}`);
          }
        }
      }
    } catch (error) {
      log(0, `❌ Error optimizing image ${filePath}: ${error}`);
      
      // Add to issue collector if available
      if (options.issueCollector) {
        options.issueCollector.addMediaProcessingError({
          filePath,
          mediaPath: relativePath,
          operation: 'optimize',
          errorMessage: error instanceof Error ? error.message : String(error),
          errorCode: error instanceof Error && 'code' in error ? String(error.code) : undefined
        });
      }
      
      // For failed image optimization, still include the original file
      const dirStructure = path.dirname(relativePath);
      const publicPath = `${options.mediaPathPrefix}/${dirStructure}/${fileName}`.replace(/\\/g, '/');
      const absolutePublicPath = options.domain 
        ? `${options.domain.replace(/\/+$/, '')}${publicPath}`
        : undefined;
      
      mediaFile.sizes.original = [{
        width: mediaFile.metadata?.width || 0,
        height: mediaFile.metadata?.height || 0,
        format: mediaFile.fileExt,
        outputPath: filePath,
        publicPath,
        absolutePublicPath, // Add absolute public path
        size: stats.size
      }];
    }
  } else {
    // For non-images or when optimization is disabled, just copy the file
    let dirStructure: string;
    let outputDir: string;
    let outputFileName: string;
    
    if (options.useMediaHash && fileHash) {
      // If using hash-based paths
      if (options.useMediaHashSharding) {
        // Create sharded directory using first 2 characters of hash
        const shardDir = fileHash.substring(0, 2);
        dirStructure = path.join(shardDir);
        outputDir = path.join(options.mediaOutputFolder, shardDir);
      } else {
        // Store directly in media root directory
        dirStructure = '';
        outputDir = options.mediaOutputFolder;
      }
      
      // Use hash for filename
      outputFileName = `${fileHash}${path.extname(fileName)}`;
      log(3, `📊 Using hash-based path for: ${fileName} (${fileHash})`);
    } else {
      // Use original path structure and filename
      dirStructure = path.dirname(relativePath);
      outputDir = path.join(options.mediaOutputFolder, dirStructure);
      outputFileName = fileName;
    }
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      log(3, `📁 Created directory: ${outputDir}`);
    }

    const outputPath = path.join(outputDir, outputFileName);
    const publicPath = dirStructure 
      ? `${options.mediaPathPrefix}/${dirStructure}/${outputFileName}`.replace(/\\/g, '/')
      : `${options.mediaPathPrefix}/${outputFileName}`.replace(/\\/g, '/');
    const absolutePublicPath = options.domain 
      ? `${options.domain.replace(/\/+$/, '')}${publicPath}`
      : undefined;
      
    const shouldSkip = shouldSkipFile(filePath, outputPath, options);
    const isForced = options.forceReprocessMedias && fs.existsSync(outputPath);
    
    // Check if we should skip processing based on hash
    if (shouldSkipProcessing) {
      log(2, `⏭️ Hash-skipped copying: ${fileName} (hash match)`);
      
      // Add to sizes array with skippedOptimization flag
      mediaFile.sizes.original = [{
        width: 0,
        height: 0,
        format: mediaFile.fileExt,
        outputPath: filePath, // Reference original file
        publicPath,
        absolutePublicPath,
        size: stats.size,
        skippedOptimization: true // Mark as skipped
      }];
    }
    // Check if we should skip copying based on existing file
    else if (shouldSkip) {
      log(2, `⏭️ Skipping existing file: ${fileName}`);
      if (onSkip) onSkip(true, false);
      
      // Add to sizes array
      mediaFile.sizes.original = [{
        width: 0,
        height: 0,
        format: mediaFile.fileExt,
        outputPath,
        publicPath,
        absolutePublicPath,
        size: stats.size
      }];
    } 
    // Process normally
    else {
      if (isForced) {
        log(2, `🔄 Force reprocessing: ${fileName}`);
        if (onSkip) onSkip(false, true);
      }
      fs.copyFileSync(filePath, outputPath);
      log(2, `📋 Copied: ${outputPath} (${formatBytes(stats.size)})`);
      
      // Add to sizes array
      mediaFile.sizes.original = [{
        width: 0,
        height: 0,
        format: mediaFile.fileExt,
        outputPath,
        publicPath,
        absolutePublicPath,
        size: stats.size
      }];
    }
  }

  return mediaFile;
}

/**
 * Get MIME type from file extension
 * @param ext File extension
 * @returns MIME type
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm'
  };

  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * Create a logger function based on debug level
 * @param level Debug level (0-3)
 * @returns Logging function
 */
function createLogger(level: number) {
  return function log(messageLevel: number, message: string) {
    if (messageLevel <= level) {
      console.log(message);
    }
  };
}

/**
 * Format bytes to human readable format
 * @param bytes Number of bytes
 * @returns Formatted string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Using calculateFilePathHash from utilities