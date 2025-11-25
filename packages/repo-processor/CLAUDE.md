# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **repo-processor** (formerly "Obsidian Parser"), a TypeScript library that converts Obsidian vaults into structured JSON data for publishing. It processes markdown files with Obsidian-specific features like wiki links (`[[Link]]`), media embeds, and frontmatter into web-ready HTML and JSON.

### Core Architecture

The project uses a functional-first approach with these key components:

- **Processing Pipeline**: Built on unified.js ecosystem (remark/rehype) for markdown processing
- **Media Handling**: Hash-based storage system with optional sharding for efficient asset management  
- **Link Resolution**: Converts wiki-style links to web-friendly URLs with slug generation
- **Export Formats**: Supports both single JSON output and individual post files

### Main Entry Points

- `src/process/process.ts` - Main programmatic API with `RepoProcessor` class
- `command/cli.js` - CLI interface for command-line usage
- `src/index.ts` - Library exports and legacy compatibility layer

## Development Commands

### Building
```bash
npm run build          # Build TypeScript to dist/ (ESM + CJS)
npm run dev            # Build with watch mode
```

### Testing  
```bash
npm test               # Run vitest tests
```

### Linting & Formatting
```bash
npm run format         # Format code with Prettier
# Use Biome for linting (biome.jsonc config)
```

### CLI Usage Examples
```bash
# Basic conversion
npm run convert -- -i test/testVault1 -o test/output.json

# Example vault processing  
npm run convert:example

# Development mode with debug output
npm run convert:dev -- -i /path/to/vault
```

### Portfolio Testing
```bash
npm run pf             # Build and run portfolio test
npm run preview        # Start preview server
npm run previewpf      # Auto-open preview in browser
```

## Key Architecture Patterns

### Plugin System
The library extends remark/rehype with custom plugins:
- `remarkObsidianMedia` - Processes `![[image.jpg]]` syntax
- `remarkMdImages` - Handles standard markdown images with optimization
- `remarkLinkResolver` - Converts wiki links to web URLs

### Media Processing
Uses Sharp for image optimization with:
- Hash-based file naming (SHA-256)
- Directory sharding for performance (`ab/ab123456...`)
- Multiple format/size generation
- Skip existing files optimization

### Configuration Approach
The main `ProcessConfig` interface supports:
- Directory structure configuration
- Media processing options (hashing, sharding, optimization)
- Export options (individual posts, custom paths)
- URL generation settings

## Important Implementation Details

### Link Resolution Strategy
Wiki links are resolved through a two-phase process:
1. Build slug map from all markdown files
2. Replace `[[links]]` with resolved slugs or show warnings for broken links

### Output Structure
```
build/
├── posts.json              # All posts data
├── _media/                 # Processed media files
│   └── ab/ab123456...      # Hash-sharded structure
└── _posts/                 # Individual post files (optional)
    ├── hash/               # Access by content hash
    └── slug/               # Access by URL slug
```

### Type System
Core types are in `src/types/`:
- `core.ts` - Main processing interfaces
- `media.ts` - Media handling types  
- `obsidian.ts` - Obsidian-specific types

## Testing Strategy

Tests use Vitest and are located in:
- `src/lib/utility.test.ts` - Utility function tests
- `test/toLinkBuilder.test.ts` - Link building tests
- Various integration tests in `test/` directory

## Known Issues & TODOs

See TODOS.md for current development priorities, including:
- API restructuring towards more object-oriented approach
- Media service refactoring to eliminate duplication
- Better error handling and configuration validation
- Performance optimizations for large vaults

## Legacy Support

The library maintains backward compatibility through:
- Default export with nested structure
- Utility namespace for common functions
- Both ESM and CJS builds via tsup