# repo.md Monorepo

A Git-based headless CMS platform. Push markdown to Git, get instant edge deployment.

## Structure

This monorepo contains all packages for the repo.md platform:

| Package                 | Description                                     |
| ----------------------- | ----------------------------------------------- |
| `@repo-md/client`       | JavaScript SDK for consuming repo.md content    |
| `@repo-md/processor`    | Markdown processor (Obsidian vault to JSON)     |
| `@repo-md/api`          | Express API server                              |
| `@repo-md/app`          | Vue.js frontend application (`repo-app`)        |
| `@repo-md/worker`       | Async build worker (GCP Cloud Run / Cloudflare) |
| `@repo-md/cli`          | Command-line interface                          |
| `@repo-md/mcp-server`   | MCP server (Cloudflare Worker)                  |
| `@repo-md/mcp`          | MCP npm package                                 |
| `@repo-md/npm-server`   | Dynamic npm package server                      |
| `@repo-md/sites-server` | Multi-tenant sites server                       |
| `@repo-md/cname`        | Custom domain worker                            |
| `@repo-md/static`       | Static asset CDN worker                         |

## Quick Start

```bash
# Install dependencies
npm install

# Run all dev servers
npm run dev

# Build all packages
npm run build

# Run specific package
npm run dev:app        # Frontend
npm run dev:api        # API server
npm run dev:processor  # Processor watch mode
```

## Development Commands

```bash
# Development
npm run dev                    # Start all packages in dev mode
npm run dev:<package>          # Start specific package (client, processor, api, app, worker, etc.)

# Building
npm run build                  # Build all packages
npm run build:<package>        # Build specific package

# Quality
npm run lint                   # Lint all packages
npm run test                   # Test all packages
npm run typecheck              # Type check all packages

# Utilities
npm run clean                  # Clean all build artifacts
npm run format                 # Format all code
```

## Workspace Dependencies

Packages can reference each other using workspace protocol:

```json
{
  "dependencies": {
    "@repo-md/processor": "workspace:*",
    "@repo-md/client": "workspace:*"
  }
}
```

## Key URLs

- **Production**: https://repo.md
- **API**: https://api.repo.md
- **Static Assets**: https://static.repo.md
- **npm Package**: `repo-md`

## Deployment

### API Server (Dokku)

Deploy `@repo-md/api` to Dokku from the monorepo:

```bash
# On Dokku server: create app and set app.json path for monorepo
dokku apps:create repo-md-api
dokku app-json:set repo-md-api appjson-path packages/repo-api/app.json

# Set the build directory to the API package
dokku builder:set repo-md-api build-dir packages/repo-api

# Add Dokku remote and deploy
git remote add dokku dokku@your-server:repo-md-api
git push dokku main
```

The `app.json` in `packages/repo-api/` configures:

- Predeploy scripts (build step)
- Health checks
- Process formation

### Frontend App (Vercel)

Deploy `@repo-md/app` to Vercel:

1. Import repo in Vercel dashboard
2. Set **Root Directory**: `packages/repo-app`
3. Framework will auto-detect as Vite
4. Deploy

## Architecture

```
User pushes markdown to Git
        |
        v
  GitHub Webhook --> @repo-md/api
        |
        v
  @repo-md/worker (processes with @repo-md/processor)
        |
        v
  Cloudflare R2 Storage
        |
        v
  @repo-md/static (CDN) --> User's website
```

## License

MIT
