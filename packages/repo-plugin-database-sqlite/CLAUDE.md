# CLAUDE.md

This file provides guidance for the @repo-md/plugin-database-sqlite package.

## Overview

SQLite database plugin for @repo-md/processor-core. Generates a SQLite database with full-text search (FTS5) and pre-computed similarity scores.

## Commands

```bash
npm run build      # Build TypeScript
npm run dev        # Watch mode
npm run typecheck  # Type checking
```

## Usage

```typescript
import { Processor } from '@repo-md/processor-core';
import { SqliteDatabasePlugin } from '@repo-md/plugin-database-sqlite';
import { TransformersTextEmbedder } from '@repo-md/plugin-embed-transformers';

const processor = new Processor({
  dir: { input: './vault' },
  plugins: {
    // Optional: textEmbedder enables similarity computation
    textEmbedder: new TransformersTextEmbedder(),
    database: new SqliteDatabasePlugin({
      filename: 'repo.db',
      similarityThreshold: 0.5,
      maxSimilarPosts: 10,
    }),
  },
});
```

## Features

- **Full-text search**: FTS5 index on title, content, tags
- **Pre-computed similarity**: No runtime embedding computation
- **Rich metadata**: All frontmatter fields searchable
- **Portable**: Single-file SQLite database

## Configuration

```typescript
interface SqlitePluginOptions {
  filename?: string;           // Default: 'repo.db'
  similarityThreshold?: number; // Default: 0.5 (0-1)
  maxSimilarPosts?: number;    // Default: 10
}
```

## Database Schema

### Tables

```sql
-- Main posts table
CREATE TABLE posts (
  hash TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT,
  path TEXT,
  plain TEXT,
  html TEXT,
  frontmatter TEXT,  -- JSON
  created_at TEXT,
  updated_at TEXT
);

-- Media files
CREATE TABLE media (
  hash TEXT PRIMARY KEY,
  path TEXT,
  filename TEXT,
  mime_type TEXT,
  sizes TEXT,  -- JSON
  created_at TEXT
);

-- Text embeddings (if textEmbedder provided)
CREATE TABLE embeddings (
  hash TEXT PRIMARY KEY,
  embedding BLOB,  -- Float32Array as BLOB
  model TEXT,
  dimensions INTEGER,
  FOREIGN KEY (hash) REFERENCES posts(hash)
);

-- Pre-computed similarity
CREATE TABLE similarity (
  source_hash TEXT,
  target_hash TEXT,
  score REAL,
  PRIMARY KEY (source_hash, target_hash),
  FOREIGN KEY (source_hash) REFERENCES posts(hash),
  FOREIGN KEY (target_hash) REFERENCES posts(hash)
);

-- Full-text search
CREATE VIRTUAL TABLE posts_fts USING fts5(
  hash,
  title,
  content,
  tags,
  content='posts',
  content_rowid='rowid'
);
```

## Output

Generates `repo.db` in the output directory:

```
dist/
└── repo.db   # ~100KB - ~10MB depending on content
```

## Dependencies

- `better-sqlite3` - SQLite with Node.js bindings
- `@repo-md/processor-core` - Peer dependency

## Plugin Dependencies

```typescript
readonly requires = ['textEmbedder'] as const;  // Optional but recommended
```

If `textEmbedder` is not provided:
- Similarity computation is disabled
- Embeddings table is empty
- FTS5 search still works

## Query Examples

```sql
-- Full-text search
SELECT * FROM posts_fts WHERE posts_fts MATCH 'typescript plugin';

-- Get similar posts
SELECT p.*, s.score
FROM similarity s
JOIN posts p ON s.target_hash = p.hash
WHERE s.source_hash = 'abc123'
ORDER BY s.score DESC
LIMIT 5;

-- Search with ranking
SELECT hash, title, bm25(posts_fts) as rank
FROM posts_fts
WHERE posts_fts MATCH 'api design'
ORDER BY rank;
```
