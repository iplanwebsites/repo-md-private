# Process API Documentation

The repo-md package provides a set of functions for processing Obsidian vaults:

### Primary Processing Functions

1. `process`: The main entry point for programmatically processing an Obsidian vault. It handles both Markdown processing and media optimization in a single unified API.
2. `processFolder`: Processes Markdown files in an Obsidian vault directory.
3. `processMedia`: Processes media files in an Obsidian vault directory.

### Remark Plugins

1. `remarkObsidianMedia`: Transforms Obsidian-style media links to optimized HTML.
2. `remarkMdImages`: Transforms standard Markdown image syntax to optimized HTML.
3. `toLinkBuilder`: Builds a link transformer for Obsidian wiki links.

### Utility Functions

The package also exports various utility functions:

- `toSlug`: Converts a string to a URL-friendly slug
- `getFileName`: Extracts the file name from a path
- `getFrontmatterAndMd`: Extracts frontmatter and markdown content from a file
- `jsonStringify`: Safely stringifies JSON with circular reference handling
- `writeToFileSync`: Writes content to a file, creating directories if needed

This document focuses primarily on the `process` function and the other main processing functions, which are the recommended entry points for most use cases.

## Basic Usage

```javascript
import { process } from 'repo-md';

// Simple example with minimal configuration
const result = await process({
  inputPath: './my-obsidian-vault',
  buildDir: './build'
});

console.log(`Processed ${result.vaultData.length} files`);
console.log(`Processed ${result.mediaData.length} media files`);
```

The `process` function generates a complete build directory with the following structure:

```
build/                      # Main build directory
├── posts.json              # Main output with all processed posts
├── media-results.json      # Media processing results and mappings
├── _media/                 # Optimized media files (always within build directory)
│   ├── image1-sm.webp
│   ├── image1-md.webp
│   └── ...
└── _posts/                 # Individual post JSON files (if postsOutputFolder is set)
    ├── post-1.json
    ├── post-2.json
    └── index.json          # Index of all posts
```

## API Reference

### `process(config)`

Processes an Obsidian vault, optimizing media files and converting Markdown content to structured data. Generates a complete build directory with posts and media outputs.

#### Parameters

The `config` object accepts the following properties:

##### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `inputPath` | `string` | Path to the Obsidian vault directory |

##### Build Directory Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `buildDir` | `string` | `"./build"` | Main build directory where all outputs will be stored |
| `postsOutputFolder` | `string` | `undefined` | When provided, exports individual post JSON files to this folder within the build directory and creates an index.json with minimal data |
| `mediaFolder` | `string` | `"_media"` | Folder name for media files within the build directory |
| `outputFilename` | `string` | `"posts.json"` | Filename for the main output JSON file with all processed posts |
| `mediaResultsFilename` | `string` | `"media-results.json"` | Filename for the media processing results JSON file |

##### Path Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `notePathPrefix` | `string` | `"/notes"` | URL prefix for notes in generated links |
| `assetPathPrefix` | `string` | `"/assets"` | URL prefix for assets in generated links |
| `mediaPathPrefix` | `string` | `"/media"` | URL prefix for media files in generated links |
| `baseDir` | `string` | `process.cwd()` | Base directory for resolving relative paths |

##### Media Processing Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `optimizeImages` | `boolean` | `true` | Whether to optimize and convert images |
| `skipMedia` | `boolean` | `false` | Skip media processing entirely |
| `skipExisting` | `boolean` | `false` | Skip processing media files that already exist |
| `forceReprocessMedias` | `boolean` | `false` | Force reprocessing of media files even if they exist |
| `domain` | `string` | `undefined` | Domain for absolute public paths (e.g., "https://example.com") |
| `useAbsolutePaths` | `boolean` | `true` | Use absolute paths with domain for media replacements |
| `preferredSize` | `'sm'` \| `'md'` \| `'lg'` | `'md'` | Preferred size for media images in HTML output |
| `mediaPathPrefix` | `string` | `"/media"` | URL prefix for media files in generated links |

##### Advanced Image Processing

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `imageSizes` | `Array<{width: number\|null, height: number\|null, suffix: string}>` | See below | Custom image sizes for optimization |
| `imageFormats` | `Array<{format: string, options: any}>` | See below | Custom image formats for optimization |
| `useMediaHash` | `boolean` | `false` | Use hash-based media paths for content-addressable storage |
| `useMediaHashSharding` | `boolean` | `false` | Use sharding for hash-based media paths |
| `skipHashes` | `string[]` | `[]` | Skip processing for specified file hashes |

##### Debug Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `debugLevel` | `number` | `1` | Debug level (0-3): 0=errors only, 1=info, 2=verbose, 3=debug |
| `includeMediaData` | `boolean` | `false` | Include media data in the first page object |

#### Default Image Sizes

If not specified, the following default image sizes are used:

```javascript
[
  { width: 640, height: null, suffix: "sm" },  // Small
  { width: 1024, height: null, suffix: "md" }, // Medium
  { width: 1920, height: null, suffix: "lg" }, // Large
  { width: 3840, height: null, suffix: "xl" }  // Extra Large
]
```

#### Default Image Formats

If not specified, the following default image formats are used:

```javascript
[
  { format: "webp", options: { quality: 80 } },
  { format: "jpeg", options: { quality: 85, mozjpeg: true } }
]
```

#### Return Value

The `process` function returns a Promise that resolves to an object with the following properties:

```typescript
{
  vaultData: FileData[];        // Processed Markdown files
  mediaData: MediaFileData[];   // Processed media files
  mediaPathMap: MediaPathMap;   // Mapping of original paths to optimized paths
  buildDir: string;             // The build directory path used for this processing
  outputFiles: {                // Paths to the generated output files
    postsJson: string;          // Path to the main posts JSON file
    mediaResults: string;       // Path to the media results JSON file
    postsDir?: string;          // Path to the posts directory (if postsOutputFolder is set)
  }
}
```

## Examples

### Basic Usage

```javascript
import { process } from 'repo-md';

const result = await process({
  inputPath: './my-obsidian-vault',
  buildDir: './build'
});
```

### Custom Media Processing

```javascript
const result = await process({
  inputPath: './my-obsidian-vault',
  buildDir: './build',
  
  // Media processing options
  mediaFolder: 'assets',         // Media will be stored in build/assets/
  mediaPathPrefix: '/assets',    // URLs will start with /assets/
  domain: 'https://example.com', // URLs will be https://example.com/assets/...
  skipExisting: true,
  
  // Custom image sizes
  imageSizes: [
    { width: 400, height: null, suffix: "sm" },
    { width: 800, height: null, suffix: "md" },
    { width: 1600, height: null, suffix: "lg" }
  ],
  
  // Custom image formats
  imageFormats: [
    { format: "webp", options: { quality: 85 } },
    { format: "jpeg", options: { quality: 80 } }
  ]
});
```

### Hash-Based Media Storage

```javascript
const result = await process({
  inputPath: './my-obsidian-vault',
  buildDir: './build',
  
  // Use content-addressable storage
  useMediaHash: true,
  useMediaHashSharding: true,  // Organize into subfolders based on hash
  
  // Skip specific file hashes (useful for caching)
  skipHashes: [
    'a1b2c3d4e5f6...',  // Skip files with these hashes
    '123456789abcdef...'
  ]
});
```

### Export Individual Posts

```javascript
const result = await process({
  inputPath: './my-obsidian-vault',
  buildDir: './build',
  postsOutputFolder: '_posts'  // Export individual posts to this folder within buildDir
});
```

## Type Definitions

The main process function uses the following TypeScript interfaces:

```typescript
interface ProcessConfig {
  inputPath: string;
  
  // Build directory configuration
  buildDir?: string;                  // Main build directory (default: './build')
  postsOutputFolder?: string;         // Folder for individual post JSON files within buildDir
  mediaFolder?: string;               // Folder for media files within buildDir (default: '_media')
  outputFilename?: string;            // Filename for the main output JSON (default: 'posts.json')
  mediaResultsFilename?: string;      // Filename for media results (default: 'media-results.json')
  
  // Path configuration
  notePathPrefix?: string;            // URL prefix for notes in generated links
  assetPathPrefix?: string;           // URL prefix for assets in generated links
  mediaPathPrefix?: string;           // URL prefix for media files in generated links
  baseDir?: string;                   // Base directory for resolving relative paths
  
  // Media processing options
  optimizeImages?: boolean;           // Whether to optimize and convert images
  skipMedia?: boolean;                // Skip media processing entirely
  skipExisting?: boolean;             // Skip processing existing media files
  forceReprocessMedias?: boolean;     // Force reprocessing of media files
  domain?: string;                    // Domain for absolute public paths
  useAbsolutePaths?: boolean;         // Use absolute paths with domain for media
  imageSizes?: Array<{width: number|null, height: number|null, suffix: string}>;
  imageFormats?: Array<{format: string, options: any}>;
  useMediaHash?: boolean;             // Use hash-based media paths
  useMediaHashSharding?: boolean;     // Use sharding for hash-based paths
  skipHashes?: string[];              // Skip processing for these file hashes
  
  // Additional options
  includeMediaData?: boolean;         // Include media data in the first page object
  preferredSize?: 'sm' | 'md' | 'lg'; // Preferred size for media images
  debugLevel?: number;                // Debug level (0-3)
  
  // Legacy options (maintained for backward compatibility)
  outputPath?: string;                // Legacy: Output JSON file path 
  mediaResultsPath?: string;          // Legacy: Media results JSON path
  exportPosts?: boolean;              // Legacy: Whether to export individual posts
}
```

## Advanced Usage: Custom File Selection

By default, the processor will only convert Markdown files with `public: true` in their frontmatter. To customize file selection, create your own function to build a set of allowed files:

```javascript
import { process } from 'repo-md';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// Custom file selection function
function customFilePathAllowSetBuilder(dirPath) {
  const allowedFiles = new Set();
  
  function scanDirectory(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        scanDirectory(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const raw = fs.readFileSync(entryPath, "utf8");
          const { data: frontmatter } = matter(raw);
          
          // Custom selection logic - include files tagged "blog"
          if (frontmatter?.tags?.includes('blog')) {
            allowedFiles.add(entryPath);
          }
        } catch (error) {
          console.error(`Error reading ${entryPath}: ${error}`);
        }
      }
    }
  }
  
  scanDirectory(dirPath);
  return allowedFiles;
}

// Use the custom file selection function
const result = await process({
  inputPath: './my-obsidian-vault',
  outputPath: './output.json',
  filePathAllowSetBuilder: customFilePathAllowSetBuilder
});
```

## Additional Exported Functions

### processFolder(dirPath, opts)

Processes Markdown files in an Obsidian vault directory and returns file data for public files.

> **Note:** This function is used internally by the main `process` function. For most use cases, it's recommended to use the `process` function instead.

#### Parameters

- `dirPath` (string): Path to the Obsidian vault directory
- `opts` (ProcessOptions): Optional processing options

#### Options

The `ProcessOptions` includes:

```typescript
interface ProcessOptions {
  debug?: number;                              // Debug level (0-3)
  notePathPrefix?: string;                     // Prefix for note links (default: "/content")
  assetPathPrefix?: string;                    // Prefix for assets
  mediaData?: MediaFileData[];                 // Media data from processMedia
  mediaPathMap?: MediaPathMap;                 // Media path map from processMedia
  useAbsolutePaths?: boolean;                  // Use absolute paths with domain (default: false)
  includeMediaData?: boolean;                  // Include media data in first page object (default: false)
  postsOutputFolder?: string;                  // Folder for individual post JSON files
  preferredSize?: 'sm' | 'md' | 'lg';          // Preferred size for media images
  filePathAllowSetBuilder?: (dirPath: string) => Set<string>; // Custom function to determine which files to process
  toLinkBuilderOpts?: object;                  // Options for the toLinkBuilder function
  mediaOptions?: {
    domain?: string;                           // Domain for absolute URLs
  };
}
```

#### Return Value

Returns a Promise that resolves to an array of `FileData` objects:

```typescript
interface FileData {
  fileName: string;                // Original filename without extension
  slug: string;                    // URL-friendly slug
  frontmatter: Record<string, any>; // Frontmatter data from the markdown file
  firstParagraphText: string;      // Text from first paragraph
  plain: string;                   // Plain text content
  html: string;                    // HTML content
  toc: TocItem[];                  // Table of contents
  originalFilePath: string;        // Original file path relative to vault root
}
```

#### Example

```javascript
import { processFolder } from 'repo-md';

const result = await processFolder('./my-obsidian-vault', {
  debug: 1,
  notePathPrefix: '/notes',
  postsOutputFolder: '_posts'
});

console.log(`Processed ${result.length} files`);
```

### processMedia(dirPath, opts)

Processes media files in an Obsidian vault directory, optimizing images and organizing files.

> **Note:** This function is used internally by the main `process` function. For most use cases, it's recommended to use the `process` function instead.

#### Parameters

- `dirPath` (string): Path to the Obsidian vault directory
- `opts` (ProcessMediaOptions): Optional processing options

#### Options

The `ProcessMediaOptions` includes:

```typescript
interface ProcessMediaOptions {
  mediaOutputFolder?: string;       // Output directory for processed media files
  mediaPathPrefix?: string;         // URL prefix for media files
  optimizeImages?: boolean;         // Whether to optimize images (default: true)
  imageSizes?: Array<{width: number|null, height: number|null, suffix: string}>;
  imageFormats?: Array<{format: string, options: any}>;
  skipExisting?: boolean;           // Skip processing existing files (default: false)
  forceReprocessMedias?: boolean;   // Force reprocessing of media files (default: false)
  domain?: string;                  // Domain for absolute URLs
  useMediaHash?: boolean;           // Use hash-based media paths (default: false)
  useMediaHashSharding?: boolean;   // Use sharding for hash paths (default: false)
  skipHashes?: string[];            // Skip processing files with these hashes
  debug?: number;                   // Debug level (0-3)
}
```

#### Return Value

Returns a Promise that resolves to an object with the following properties:

```typescript
{
  mediaData: MediaFileData[];       // Processed media file data
  pathMap: MediaPathMap;            // Mapping of original paths to optimized paths
}
```

Where `MediaFileData` contains information about processed media files, including optimized versions in different formats and sizes.

#### Example

```javascript
import { processMedia } from 'repo-md';

const result = await processMedia('./my-obsidian-vault', {
  mediaOutputFolder: './build/_media',
  mediaPathPrefix: '/media',
  optimizeImages: true,
  skipExisting: true,
  domain: 'https://example.com'
});

console.log(`Processed ${result.mediaData.length} media files`);
```

## Remark Plugins

The package also exports several Remark plugins that are used internally by the processing functions:

### remarkObsidianMedia

A Remark plugin that transforms Obsidian-style media links to optimized HTML.

### remarkMdImages

A Remark plugin that transforms standard Markdown image syntax to optimized HTML using processed media data.

### toLinkBuilder

A utility function that builds a link transformer for Obsidian wiki links.

This documentation covers the main features and options of the processing functions. For more specific use cases, refer to the TypeScript definitions and source code.