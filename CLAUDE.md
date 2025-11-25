# CLAUDE.md

This file provides guidance to Claude Code when working with this monorepo.

## Project Overview

**repo.md** is a Git-based headless CMS platform. Users push markdown files to Git and get instant edge deployment with no database required.

## Monorepo Structure

This is a Turborepo monorepo using npm workspaces. All packages live in `packages/`:

```
packages/
├── repo-client/      # @repo-md/client - JS SDK
├── repo-processor/   # @repo-md/processor - Markdown processor
├── repo-api/         # @repo-md/api - Express API server
├── repo-app/         # @repo-md/app - Vue.js frontend
├── repo-build-worker/# @repo-md/worker - Async build worker
├── repo-cli/         # @repo-md/cli - CLI tool
├── repo-mcp-server/  # @repo-md/mcp-server - MCP Cloudflare Worker
├── repo-mcp-npm/     # @repo-md/mcp - MCP npm package
├── repo-npm-server/  # @repo-md/npm-server - Dynamic npm server
├── repo-sites-server/# @repo-md/sites-server - Multi-tenant sites
├── repo-cname/       # @repo-md/cname - Custom domain worker
└── repo-static/      # @repo-md/static - Static CDN worker
```

## Commands

```bash
# Install all dependencies
npm install

# Run all dev servers
npm run dev

# Run specific package
npm run dev:app         # Vue frontend
npm run dev:api         # API server
npm run dev:processor   # Processor watch
npm run dev:client      # Client SDK watch

# Build
npm run build           # Build all
npm run build:app       # Build specific

# Quality
npm run lint
npm run test
npm run typecheck
```

## Code Philosophy

### 1. Functional Programming First

- Prefer pure functions over classes
- Use composition over inheritance
- Avoid mutations; create new objects/arrays instead
- Use `map`, `filter`, `reduce` over imperative loops

```javascript
// Preferred
const processed = items.map(transform).filter(isValid)

// Avoid
const processed = []
for (const item of items) {
  const result = transform(item)
  if (isValid(result)) processed.push(result)
}
```

### 2. DRY (Don't Repeat Yourself)

- Extract shared logic into utility functions
- Use workspace dependencies for cross-package code sharing
- Consolidate types and interfaces in shared locations
- If you write similar code twice, consider abstracting it

```json
// Reference workspace packages
{
  "dependencies": {
    "@repo-md/processor": "workspace:*"
  }
}
```

### 3. Compatibility & Portability

- Target Node.js 18+ (ES modules)
- Write code that works in browser and Node when possible
- Use standard APIs over platform-specific ones
- Ensure Cloudflare Worker compatibility for edge packages

### 4. TypeScript Guidelines

- Use strict typing; avoid `any`
- Prefer `unknown` over `any` when type is uncertain
- Use interfaces for object shapes, types for unions/aliases
- Export types alongside implementations

```typescript
// Preferred
function process(data: unknown): Result {
  if (isValidInput(data)) {
    return transform(data)
  }
  throw new Error('Invalid input')
}

// Avoid
function process(data: any): any {
  return transform(data)
}
```

### 5. Error Handling

- Use try/catch only when necessary (at boundaries)
- Let errors bubble up unless you can meaningfully handle them
- Provide clear, actionable error messages
- Don't catch errors just to log and rethrow

### 6. Simplicity Over Cleverness

- Write readable code over "smart" code
- Avoid premature optimization
- Don't add abstractions until you need them
- Three similar lines is better than a premature abstraction

### 7. Module Design

- Use ES modules (`import`/`export`)
- Export only public API; unexported = private
- Keep modules focused and single-purpose
- Avoid circular dependencies

## Package-Specific Notes

Each package has its own `CLAUDE.md` with specific guidance. Key packages:

- **@repo-md/processor**: Core markdown processing pipeline using unified.js
- **@repo-md/client**: SDK consumed by users, must be browser-compatible
- **@repo-md/api**: Express server with tRPC, MongoDB
- **@repo-md/app**: Vue 3 with Composition API, Pinia, Tailwind
- **@repo-md/worker**: Heavy processing, runs on Cloud Run / CF Containers

## Testing

- Use Vitest for unit tests
- Co-locate test files with source (`*.test.ts`)
- Test public APIs, not implementation details
- Mock external services, not internal modules

## Git Workflow

- Main branch: `main`
- Feature branches for new work
- Run `npm run lint && npm run typecheck` before committing
- Keep commits focused and atomic

## Dependencies Between Packages

```
@repo-md/client ──────────────────────────────────┐
                                                  │
@repo-md/processor ───────────────────────────────┼──> @repo-md/worker
                                                  │
@repo-md/api ─────────────────────────────────────┘
     │
     └──> @repo-md/app (via tRPC)
```

## Environment Variables

Each package has its own `.env` requirements. See individual package READMEs for specifics. Never commit secrets.

## Common Issues

1. **Workspace dependency not found**: Run `npm install` from root
2. **Type errors after changes**: Run `npm run build` to rebuild dependent packages
3. **Stale cache**: Run `npm run clean` then `npm install`
