/**
 * SQLite Database Plugin
 *
 * Builds a SQLite database with full-text search and optional vector search
 * for processed content. Enables offline search and similarity queries.
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import type {
  DatabasePlugin,
  PluginContext,
  TextEmbeddingPlugin,
  ProcessedPost,
  ProcessedMedia,
} from '@repo-md/processor-core';

// ============================================================================
// Types
// ============================================================================

export interface SqlitePluginOptions {
  /** Database filename (default: 'repo.db') */
  readonly filename?: string;
  /** Enable full-text search (default: true) */
  readonly enableFts?: boolean;
  /** Enable vector search if textEmbedder is available (default: true) */
  readonly enableVector?: boolean;
  /** Number of similar posts to pre-compute (default: 5) */
  readonly similarPostsCount?: number;
}

export interface DatabaseBuildInput {
  readonly posts: readonly ProcessedPost[];
  readonly media: readonly ProcessedMedia[];
  readonly embeddings?: Readonly<Record<string, readonly number[]>>;
  readonly imageEmbeddings?: Readonly<Record<string, readonly number[]>>;
}

export interface DatabaseResult {
  readonly databasePath: string;
  readonly tables: readonly string[];
  readonly rowCounts: Readonly<Record<string, number>>;
  readonly hasVectorSearch: boolean;
  readonly hasFts: boolean;
}

// ============================================================================
// SQLite Database Plugin
// ============================================================================

/**
 * SQLite database plugin with FTS5 and optional vector search
 */
export class SqliteDatabasePlugin implements DatabasePlugin {
  readonly name = 'database' as const;
  readonly requires = ['textEmbedder'] as const;

  private ready = false;
  private context: PluginContext | null = null;
  private textEmbedder: TextEmbeddingPlugin | null = null;
  private options: Required<SqlitePluginOptions>;

  constructor(options: SqlitePluginOptions = {}) {
    this.options = {
      filename: options.filename ?? 'repo.db',
      enableFts: options.enableFts ?? true,
      enableVector: options.enableVector ?? true,
      similarPostsCount: options.similarPostsCount ?? 5,
    };
  }

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;

    // Get optional text embedder
    this.textEmbedder = context.getPlugin<TextEmbeddingPlugin>('textEmbedder') ?? null;

    if (!this.textEmbedder) {
      context.log('No textEmbedder plugin - vector search disabled', 'warn');
    }

    context.log('SqliteDatabasePlugin initialized', 'info');
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  async dispose(): Promise<void> {
    this.ready = false;
  }

  /**
   * Build the SQLite database from processed content
   */
  async build(data: DatabaseBuildInput): Promise<DatabaseResult> {
    if (!this.context) {
      throw new Error('SqliteDatabasePlugin not initialized');
    }

    const outputDir = this.context.outputDir;
    await mkdir(outputDir, { recursive: true });

    const dbPath = join(outputDir, this.options.filename);
    const db = new Database(dbPath);

    try {
      this.context.log(`Building database at ${dbPath}...`, 'info');

      // Create tables
      this.createTables(db);

      // Insert posts
      const postsCount = this.insertPosts(db, data.posts);

      // Insert media
      const mediaCount = this.insertMedia(db, data.media);

      // Create FTS index
      if (this.options.enableFts) {
        this.createFtsIndex(db);
      }

      // Insert embeddings and similarity data
      let embeddingsCount = 0;
      if (data.embeddings && this.options.enableVector) {
        embeddingsCount = this.insertEmbeddings(db, data.embeddings);
        this.computeAndInsertSimilarity(db, data.posts, data.embeddings);
      }

      // Optimize database
      db.pragma('optimize');

      const tables = this.getTableNames(db);
      const rowCounts: Record<string, number> = {
        posts: postsCount,
        media: mediaCount,
        embeddings: embeddingsCount,
      };

      this.context.log(
        `Database built: ${postsCount} posts, ${mediaCount} media, ${embeddingsCount} embeddings`,
        'info'
      );

      return {
        databasePath: dbPath,
        tables,
        rowCounts,
        hasVectorSearch: embeddingsCount > 0,
        hasFts: this.options.enableFts,
      };
    } finally {
      db.close();
    }
  }

  /**
   * Create database tables
   */
  private createTables(db: Database.Database): void {
    // Posts table
    db.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT UNIQUE NOT NULL,
        slug TEXT NOT NULL,
        title TEXT,
        file_name TEXT,
        original_path TEXT,
        html TEXT,
        markdown TEXT,
        plain_text TEXT,
        excerpt TEXT,
        word_count INTEGER DEFAULT 0,
        frontmatter TEXT,
        toc TEXT,
        links TEXT,
        backlinks TEXT,
        created_at TEXT,
        updated_at TEXT,
        published_at TEXT
      )
    `);

    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
      CREATE INDEX IF NOT EXISTS idx_posts_hash ON posts(hash);
    `);

    // Media table
    db.exec(`
      CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT UNIQUE NOT NULL,
        original_path TEXT,
        output_path TEXT,
        type TEXT,
        mime_type TEXT,
        file_size INTEGER,
        width INTEGER,
        height INTEGER,
        metadata TEXT,
        sizes TEXT
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_media_hash ON media(hash);
    `);

    // Embeddings table (for vector search)
    db.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_hash TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        vector BLOB NOT NULL,
        model TEXT,
        FOREIGN KEY (post_hash) REFERENCES posts(hash)
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_embeddings_post ON embeddings(post_hash);
    `);

    // Similarity table (pre-computed)
    db.exec(`
      CREATE TABLE IF NOT EXISTS similarity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_hash TEXT NOT NULL,
        similar_hash TEXT NOT NULL,
        score REAL NOT NULL,
        rank INTEGER NOT NULL,
        FOREIGN KEY (post_hash) REFERENCES posts(hash),
        FOREIGN KEY (similar_hash) REFERENCES posts(hash)
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_similarity_post ON similarity(post_hash);
    `);
  }

  /**
   * Create FTS5 full-text search index
   */
  private createFtsIndex(db: Database.Database): void {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
        title,
        plain_text,
        content=posts,
        content_rowid=id,
        tokenize='porter unicode61'
      )
    `);

    // Populate FTS index
    db.exec(`
      INSERT INTO posts_fts(posts_fts) VALUES('rebuild')
    `);
  }

  /**
   * Insert posts into database
   */
  private insertPosts(db: Database.Database, posts: readonly ProcessedPost[]): number {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO posts (
        hash, slug, title, file_name, original_path,
        html, markdown, plain_text, excerpt, word_count,
        frontmatter, toc, links, backlinks,
        created_at, updated_at, published_at
      ) VALUES (
        @hash, @slug, @title, @fileName, @originalPath,
        @html, @markdown, @plainText, @excerpt, @wordCount,
        @frontmatter, @toc, @links, @backlinks,
        @createdAt, @updatedAt, @publishedAt
      )
    `);

    const insertMany = db.transaction((posts: readonly ProcessedPost[]) => {
      for (const post of posts) {
        stmt.run({
          hash: post.hash,
          slug: post.slug,
          title: post.title ?? post.fileName,
          fileName: post.fileName,
          originalPath: post.originalPath ?? post.filePath,
          html: post.html,
          markdown: post.markdown ?? post.md,
          plainText: post.plainText ?? post.plain,
          excerpt: post.excerpt ?? post.firstParagraphText,
          wordCount: post.wordCount ?? 0,
          frontmatter: JSON.stringify(post.frontmatter ?? {}),
          toc: JSON.stringify(post.toc ?? []),
          links: JSON.stringify(post.links ?? []),
          backlinks: JSON.stringify(post.backlinks ?? []),
          createdAt: post.metadata?.createdAt ?? null,
          updatedAt: post.metadata?.updatedAt ?? null,
          publishedAt: post.frontmatter?.date ?? post.frontmatter?.published ?? null,
        });
      }
    });

    insertMany(posts);
    return posts.length;
  }

  /**
   * Insert media into database
   */
  private insertMedia(db: Database.Database, media: readonly ProcessedMedia[]): number {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO media (
        hash, original_path, output_path, type,
        mime_type, file_size, width, height, metadata, sizes
      ) VALUES (
        @hash, @originalPath, @outputPath, @type,
        @mimeType, @fileSize, @width, @height, @metadata, @sizes
      )
    `);

    const insertMany = db.transaction((mediaList: readonly ProcessedMedia[]) => {
      for (const item of mediaList) {
        stmt.run({
          hash: item.hash,
          originalPath: item.originalPath,
          outputPath: item.outputPath ?? item.url,
          type: item.type ?? 'image',
          mimeType: item.mimeType ?? item.metadata?.mimeType,
          fileSize: item.metadata?.size ?? item.metadata?.originalSize ?? 0,
          width: item.metadata?.width ?? 0,
          height: item.metadata?.height ?? 0,
          metadata: JSON.stringify(item.metadata ?? {}),
          sizes: JSON.stringify(item.sizes ?? {}),
        });
      }
    });

    insertMany(media);
    return media.length;
  }

  /**
   * Insert embeddings into database
   */
  private insertEmbeddings(
    db: Database.Database,
    embeddings: Readonly<Record<string, readonly number[]>>
  ): number {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO embeddings (post_hash, dimensions, vector, model)
      VALUES (@postHash, @dimensions, @vector, @model)
    `);

    const entries = Object.entries(embeddings);
    const model = this.textEmbedder?.model ?? 'unknown';

    const insertMany = db.transaction((entries: [string, readonly number[]][]) => {
      for (const [hash, vector] of entries) {
        // Store as Float32Array blob
        const buffer = Buffer.from(new Float32Array(vector).buffer);
        stmt.run({
          postHash: hash,
          dimensions: vector.length,
          vector: buffer,
          model,
        });
      }
    });

    insertMany(entries);
    return entries.length;
  }

  /**
   * Compute and insert similarity data
   */
  private computeAndInsertSimilarity(
    db: Database.Database,
    posts: readonly ProcessedPost[],
    embeddings: Readonly<Record<string, readonly number[]>>
  ): void {
    const stmt = db.prepare(`
      INSERT INTO similarity (post_hash, similar_hash, score, rank)
      VALUES (@postHash, @similarHash, @score, @rank)
    `);

    const insertMany = db.transaction((similarities: Array<{
      postHash: string;
      similarHash: string;
      score: number;
      rank: number;
    }>) => {
      for (const sim of similarities) {
        stmt.run(sim);
      }
    });

    const allSimilarities: Array<{
      postHash: string;
      similarHash: string;
      score: number;
      rank: number;
    }> = [];

    // Compute similarity for each post
    for (const post of posts) {
      const postEmbedding = embeddings[post.hash];
      if (!postEmbedding) continue;

      const similarities: Array<{ hash: string; score: number }> = [];

      for (const otherPost of posts) {
        if (otherPost.hash === post.hash) continue;

        const otherEmbedding = embeddings[otherPost.hash];
        if (!otherEmbedding) continue;

        const score = this.cosineSimilarity(postEmbedding, otherEmbedding);
        similarities.push({ hash: otherPost.hash, score });
      }

      // Sort by similarity and take top N
      similarities.sort((a, b) => b.score - a.score);
      const topN = similarities.slice(0, this.options.similarPostsCount);

      for (let i = 0; i < topN.length; i++) {
        const sim = topN[i];
        if (sim) {
          allSimilarities.push({
            postHash: post.hash,
            similarHash: sim.hash,
            score: sim.score,
            rank: i + 1,
          });
        }
      }
    }

    insertMany(allSimilarities);
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(a: readonly number[], b: readonly number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] ?? 0;
      const bVal = b[i] ?? 0;
      dot += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dot / magnitude;
  }

  /**
   * Get all table names in database
   */
  private getTableNames(db: Database.Database): readonly string[] {
    const rows = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as Array<{ name: string }>;

    return rows.map((r) => r.name);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a SQLite database plugin
 */
export const createSqlitePlugin = (
  options?: SqlitePluginOptions
): DatabasePlugin => {
  return new SqliteDatabasePlugin(options);
};

// Default export
export default SqliteDatabasePlugin;
