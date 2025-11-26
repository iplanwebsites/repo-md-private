# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**repo.md** is a Git-based headless CMS platform. Users push markdown files to Git and get instant edge deployment with no database required.

## Monorepo Structure

Turborepo monorepo using npm workspaces. All packages live in `packages/`:

| Package             | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `repo-client`       | @repo-md/client - JavaScript SDK for consuming content           |
| `repo-processor`    | @repo-md/processor - Markdown processor (Obsidian to JSON)       |
| `repo-api`          | @repo-md/api - Express API server with tRPC                      |
| `repo-app`          | @repo-md/app - Vue.js frontend                                   |
| `repo-build-worker` | @repo-md/worker - Async build worker (Cloud Run / CF Containers) |
| `repo-cli`          | @repo-md/cli - CLI tool - not in use - placeholder for future    |
| `repo-mcp-server`   | @repo-md/mcp-server - MCP Cloudflare Worker                      |
| `repo-mcp-npm`      | @repo-md/mcp - MCP npm package                                   |
| `repo-npm-server`   | @repo-md/npm-server - Dynamic npm server                         |
| `repo-sites-server` | @repo-md/sites-server - Multi-tenant sites                       |
| `repo-cname`        | @repo-md/cname - Custom domain worker                            |
| `repo-static`       | @repo-md/static - Static asset CDN worker                        |

## Commands

```bash
# Install all dependencies
npm install

# Run all dev servers
npm run dev

# Run specific package
npm run dev:app           # Vue frontend
npm run dev:api           # API server
npm run dev:processor     # Processor watch
npm run dev:client        # Client SDK watch
npm run dev:worker        # Build worker
npm run dev:mcp-server    # MCP server
npm run dev:sites-server  # Sites server

# Build
npm run build             # Build all packages
npm run build:app         # Build specific package
npm run build:client
npm run build:processor

# Quality
npm run lint
npm run test
npm run typecheck
npm run format

# Utilities
npm run clean             # Clean all build artifacts and node_modules
```

## Architecture

```
User pushes markdown to Git
        │
        ▼
  GitHub Webhook ──▶ @repo-md/api (Express + tRPC + MongoDB)
        │
        ▼
  @repo-md/worker (processes with @repo-md/processor)
        │
        ▼
  Cloudflare R2 Storage
        │
        ▼
  @repo-md/static (CDN) ──▶ User's website
```

**Key flows:**

- **API** receives webhooks, creates jobs, dispatches to worker
- **Worker** clones repos, processes markdown, generates embeddings, deploys to R2
- **Processor** converts Obsidian-style markdown to structured JSON with media handling
- **Client SDK** consumed by end users to fetch processed content

## Code Philosophy

### Functional First

Prefer pure functions, composition, and immutability. Use `map`/`filter`/`reduce` over imperative loops.

### DRY with Workspace Dependencies

```json
{
  "dependencies": {
    "@repo-md/processor": "workspace:*"
  }
}
```

### Compatibility

- Node.js 22.x (ES modules)
- Browser + Node compatibility where possible
- Cloudflare Worker compatibility for edge packages

### TypeScript

- Strict typing; avoid `any`, prefer `unknown`
- Interfaces for object shapes, types for unions

### Error Handling

Use try/catch only at boundaries. Let errors bubble unless you can meaningfully handle them.

## Package-Specific Notes

Each package has its own `CLAUDE.md` with detailed guidance:

- **@repo-md/processor**: unified.js pipeline, Sharp for images, wiki-link resolution
- **@repo-md/client**: Browser-compatible SDK, don't run demos (user tests manually)
- **@repo-md/api**: Express + tRPC, MongoDB, GitHub webhooks, job queue pattern
- **@repo-md/app**: Vue 3 Composition API, Pinia, Tailwind, Supabase Auth
- **@repo-md/worker**: Cloud Run / CF Containers, embeddings, SQLite vector search
- **@repo-md/mcp-server**: MCP protocol, Cloudflare Workers, Zod validation

## Testing

- Vitest for unit tests, co-located with source (`*.test.ts`)
- Worker uses integration test scripts: `npm run testFullWorkflow`
- No formal test suite in some packages - use dedicated scripts

## Common Issues

1. **Workspace dependency not found**: Run `npm install` from root
2. **Type errors after changes**: Run `npm run build` to rebuild dependent packages
3. **Stale cache**: Run `npm run clean` then `npm install`
