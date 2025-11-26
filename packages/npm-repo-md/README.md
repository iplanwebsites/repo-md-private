# repo-md

[![npm](https://img.shields.io/npm/v/repo-md)](https://www.npmjs.com/package/repo-md)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/repo-md)](https://bundlephobia.com/package/repo-md)
[![Documentation](https://img.shields.io/badge/docs-repo.md-blue)](https://repo.md/docs)

JavaScript SDK for [repo.md](https://repo.md) - the Git-based headless CMS.

Push markdown to Git, get instant edge deployment. No database required.

## Installation

```bash
npm install repo-md
```

## Quick Start

```javascript
import { RepoMD } from 'repo-md';

const repo = new RepoMD({
  projectId: 'your-project-id'
});

// Fetch all posts
const posts = await repo.getAllPosts();

// Get a specific post by slug
const post = await repo.getPostBySlug('hello-world');

// Search posts
const results = await repo.searchPosts('query');

// Get similar posts
const similar = await repo.getSimilarPostsBySlug('hello-world', 5);
```

## CDN Usage

```html
<script src="https://unpkg.com/repo-md"></script>
<script>
  const repo = new RepoMD.RepoMD({ projectId: 'your-project-id' });
  repo.getAllPosts().then(posts => console.log(posts));
</script>
```

## Framework Integrations

### Vite / Vue

```javascript
// vite.config.js
import { viteRepoMdProxy } from 'repo-md';

export default {
  server: {
    proxy: viteRepoMdProxy('your-project-id')
  }
};
```

### Next.js

```typescript
// middleware.ts
import { nextRepoMdMiddleware } from 'repo-md';

export const { middleware, config } = nextRepoMdMiddleware('your-project-id');
```

### Remix

```typescript
// app/routes/$.tsx
import { remixRepoMdLoader } from 'repo-md';

export const loader = remixRepoMdLoader('your-project-id');
```

### Cloudflare Workers

```javascript
import { cloudflareRepoMdHandler } from 'repo-md';

const handler = cloudflareRepoMdHandler('your-project-id');

export default {
  async fetch(request) {
    return handler(request);
  }
};
```

## API Reference

### Core Methods

| Method | Description |
|--------|-------------|
| `getAllPosts()` | Fetch all posts |
| `getPostBySlug(slug)` | Get post by URL slug |
| `getPostByHash(hash)` | Get post by content hash |
| `getRecentPosts(count)` | Get most recent posts |
| `searchPosts(query)` | Full-text search |
| `getSimilarPostsBySlug(slug, count)` | Get similar posts |

### Media Methods

| Method | Description |
|--------|-------------|
| `getAllMedia()` | Fetch all media items |
| `getMediaItems()` | Get media with metadata |
| `getSimilarMediaByHash(hash, count)` | Find similar images |

### Project Methods

| Method | Description |
|--------|-------------|
| `getProjectMetadata()` | Get project configuration |
| `getReleaseInfo()` | Get current release info |
| `getGraph()` | Get content link graph |

## Documentation

Full documentation: [repo.md/docs](https://repo.md/docs)

API Playground: [playground.repo.md](https://playground.repo.md)

## License

MIT
