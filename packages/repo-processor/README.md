# Obsidian Parser

Turn Obsidian into your CMS.

Obsidian Parser is a powerful markdown utility to publish your Obsidian vault content.

Obsidian Parser can:

- Render all your Obsidian notes as HTML
- Compile all data (filename, properties, slug) in a big JSON file
- Let you publish your notes in a custom front-end (not provided, this is a data utility)

## Features

- [x] Single-line conversion to JSON for efficient data transformation
- [x] Comprehensive CLI utilities and npm scripts for easy automation
- [x] Customizable link prefix to match your frontend routing requirements
- [x] Provide original note path as prop
- [x] Hide all private notes (set a `public: true` property to publish)
- [x] automatic, Url-friendly, slug generation
- [x] Rewrite links to replace regular links with generated auto slugs. Log errors to the console. Possible Throw error to prevent issues.
- [ ] Set custom slugs on notes (via `slug` property)
- [x] Advanced image and resource parsing for assets's unnique wiki `![[filename]]` syntax
- [x] Configurable assets URL prefix (just dump your vault images and assets in a public folder or CDN)
- [x] Optional image resizing & pre-processing scripts
- [ ] Bug with media path handling when medias are in the the root folder (extra /. in publicPath)
- [x] Skip existing image files flag
- [x] Force recompute image (to disable skipping, once it'll work)
- [x] Hash-based media storage for better deduplication and organization
- [x] Optional hash sharding for efficient file storage
- [x] Skip processing specific media files by hash
- [ ] Improve global Object structure (less nested objects if possible)
- [ ] Improve logic and write test-cases for remarkObsidianMedia (video works?)
- [ ] Cleanup-output-dir option (default false), clean, but can create erronous links if images are referenced elsewhere
- [ ] Compute embeddings for articles + images (similarity + search)
- [ ] Prettier console feedback
- [ ] Generate images src-set for different device resolution based on sizes specs
- [ ] Backlink computation (enabled by extracting internal-links on all notes first)
- [ ] Note graph extraction (including backlinks for files and resources)
- [ ] Youtube embeds (just paste a youtube link)
- [x] Export individual articles slug.json for simple static API hosting and a lightweight list.json.
- [x] Support for hash-based post storage similar to how media is stored
- [ ] Parametric config to enable/disable different modules, and pass options to processing module.
- [ ] Good documentaiton
  - [x] Basi feature roadmap
  - [ ] Github actions examples
  - [ ] CLI usage examples
- [ ] Sample front-end examples (react, express, vue)
- [ ] Support for multi-level paths in output html (not just slugs). The origianl folder path remain available so you can still display hierarchy (a breadcrumb) easily in your front-end.

## CLI Usage

### Basic Conversion with Custom Arguments

Convert your Obsidian vault to JSON with specific input and output paths:

```bash
npm run convert -- -i test/testVault1 -o test/cliTestOutput.json
```

### Run the Example Configuration

Execute the conversion using predefined example settings:

```bash
npm run convert:example
```

### Debug Mode

Run the conversion with additional debugging information:

```bash
npm run convert:dev -- -i /path/to/vault
```

### Advanced Media Processing

Process media files with hash-based storage and sharding:

```typescript
import { process } from "repo-parser";

// Process with advanced options
const result = await process({
  inputPath: "/path/to/vault",
  buildDir: "./build",

  // Media processing options
  mediaFolder: "_media",
  useMediaHash: true, // Store files using their SHA-256 hash
  useMediaHashSharding: true, // Create sharded directories based on first 2 hash chars
  skipHashes: [
    // Skip processing these specific file hashes
    "1b3e367843fabb14ca8ed45ff424e01abf01b1642db48e7d53b0eb728e2aa4e1",
  ],
  optimizeImages: true, // Enable image optimization
  skipExisting: true, // Skip existing files

  // Posts output options
  exportPosts: true, // Enable individual post JSON files export
  postsOutputFolder: "_posts", // Base directory for post exports (hash and slug subdirectories will be created)
});
```

When using hash-based storage, images will be stored in a predictable structure:

```
public/media/_medias/ab/ab123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd.webp
```

Each media file in the JSON output includes:

- `originalPath`: The original path in the vault
- `effectivePath`: The path used in rendered HTML (hash-based when enabled)
- `hashPath`: The hash-based path when using hashing
- `metadata.hash`: The SHA-256 hash of the file

When using `skipHashes`, files with matching hashes will have:

- `skippedOptimization: true` in their size entries
- All other data available for reference
- No actual file processing or resizing performed

### Post Export Structure

When using `exportPosts: true`, posts will be exported to both hash-based and slug-based directories:

```
_posts/
  ├── hash/
  │   ├── index.json                 # Index of all posts with minimal metadata
  │   ├── <sha256-hash-1>.json       # Full post data with content, accessible by hash
  │   └── <sha256-hash-2>.json
  └── slug/
      ├── index.json                 # Same index (mirrored)
      ├── <post-slug-1>.json         # Same post data, but accessible by slug
      └── <post-slug-2>.json
```

This structure allows for flexible access patterns while maintaining data integrity:

- **Hash-based access**: Ensures content integrity and efficient caching
- **Slug-based access**: Provides user-friendly, memorable URLs
- **Consistent indexing**: Both directories share the same index file for quick catalog access
- **Optimized for static hosting**: Works well with JAMstack architectures and CDNs

# Dev

Don't forget to build the lib to rebuild the dist before testing.

# Similar projects & ressources

https://unifiedjs.com/learn/guide/using-unified/

- Main Framework used to parse and transform text. [intro guide](https://unifiedjs.com/learn/guide/introduction-to-unified/)

https://github.com/aegatlin/metamark/tree/main/test

- original inspiration + source of this repo.

https://github.com/flowershow/remark-wiki-link-plus

- One of the few libs to parse wiki-style Assets, seems buggy with current version of Unified processor.

https://github.com/flowershow/flowershow

- All-in-one repo that takes an obsidian vault and publish it in a pre-made front-end.

---

# Metamark Documentation (forked) - we took inspiration from this module, but it changed A LOT ⬇️

### Overview

Metamark serves as the foundation for processing Obsidian vaults, particularly useful when you want to share vault content through custom platforms rather than using solutions like Obsidian Publish.

### Basic Usage

Here's a simple example of processing an Obsidian vault:

```typescript
import metamark from "metamark";

// Process the vault and generate structured data
const vaultData = metamark.obsidian.vault.process("../path/to/vault/");

// Convert the data to a JSON string
const jsonString = metamark.utility.jsonStringify(vaultData);

// Write the result to a file
metamark.utility.writeToFileSync("./content.json", jsonString);
```

### Understanding Wiki Links

The primary challenge in processing an Obsidian vault lies in handling wiki links (`[[Wiki Link]]`). These links need to be transformed from vault-relative paths (`vaultDir/wiki-link`) to URL-friendly paths (`/content/wiki-link`).

When processing a vault, two fundamental considerations arise:

1. Content Access Control

   - Which files should be publicly accessible?
   - What content should remain private?

2. Wiki Link Transformation
   - How should links be displayed for public vs. private content?
   - What URL structure should be used for public content?
   - How should private content references be handled?

For detailed configuration options, please refer to the `Metamark.Obsidian.Vault.ProcessOpts` documentation in [types.ts](./src/types.ts).

## Publishing Guide

To publish new versions of the package:

1. Version Bump:

   ```bash
   npm version patch
   ```

   This command:

   - Updates the version in `package.json`
   - Creates a new git commit
   - Adds a version tag

2. Push Changes:

   ```bash
   git push
   git push --tags
   ```

3. Release Process:
   - Create a new release through the GitHub UI using the new tag
   - Run `npm publish` to publish to the npm registry

This process ensures proper version control and distribution of your package updates.
