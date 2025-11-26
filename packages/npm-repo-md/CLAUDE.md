# CLAUDE.md

This is the clean npm distribution package for repo.md. It bundles and re-exports `@repo-md/client`.

## Commands

```bash
npm run build       # Build the package
npm run publish-npm # Build and publish to npm
```

## Architecture

This package:
1. Re-exports everything from `@repo-md/client`
2. Bundles all dependencies into the output (no runtime deps)
3. Copies type declarations from repo-client

The `dist/` folder contains the publishable npm package.

## Publishing

```bash
npm run version-bump-patch  # Bump version
npm run publish-npm         # Build and publish
```
