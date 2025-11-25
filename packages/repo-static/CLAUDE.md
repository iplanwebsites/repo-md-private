# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start Wrangler development server for local testing
- `npm run publish` - Deploy the worker to Cloudflare Workers production

### Testing & Quality
- `npm test` - Run Jest tests
- `npm run format` - Format code using Prettier

### Wrangler Configuration
- Primary config: `wrangler.jsonc` (JSONC format with comments)
- Templates available: `wranglerTEMPLATE.toml`, `wranglerAWFUL.toml`

## Architecture

This is a Cloudflare Worker that serves static assets from R2 storage with immutable caching and CORS support.

### Core Components
- **Main Handler**: `src/index.js` exports default worker with fetch handler
- **Request Processing**: Handles GET requests only, returns 405 for other methods
- **R2 Integration**: Uses `ASSETS_BUCKET` binding to fetch assets from R2 bucket `repomd1`
- **Caching Strategy**: Implements both Cloudflare cache and immutable HTTP headers (1 year max-age)
- **CORS**: Full CORS support with preflight handling for cross-origin requests

### Key Features
- **Security**: Validates object keys, prevents empty path access
- **Performance**: Cache-first strategy with automatic cache population
- **Content-Type Detection**: Automatic MIME type detection based on file extensions
- **Error Handling**: Proper HTTP status codes and CORS-compliant error responses

### Configuration
- **Domain**: Routes configured for `static.repo.md/*` pattern on `repo.md` zone
- **R2 Bucket**: `repomd1` for both production and preview
- **Cache Headers**: Uses both `Cache-Control` and `CDN-Cache-Control` for optimal caching

### Development Notes
- Worker serves from `static.repo.md` subdomain
- Cache debugging: Line 126 has preserved debug value (age = 333) that can be uncommented
- DEV.md contains development URLs and notes about R2 domain strategy