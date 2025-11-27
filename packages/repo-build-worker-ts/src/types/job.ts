/**
 * Job Types
 *
 * Type definitions for worker job processing.
 */

export interface RepoInfo {
  readonly path: string;
  readonly distPath?: string;
  readonly owner?: string;
  readonly repo?: string;
  readonly branch?: string;
  readonly commit?: string;
}

export interface JobData {
  readonly jobId: string;
  readonly repoInfo: RepoInfo;
  readonly repositoryFolder?: string;
  readonly mediaPrefix?: string;
  readonly notePrefix?: string;
  readonly domain?: string;
  readonly previousRev?: string;
  readonly existingMediaHashes?: Set<string>;
  readonly existingPostHashes?: Set<string>;
  readonly skipEmbeddings?: boolean;
  readonly tempDir?: string;
  readonly tempFolderPath?: string;
  readonly logger?: Logger;
}

export interface Logger {
  log(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface AssetResult {
  readonly processed: boolean;
  readonly distFolder: string;
  readonly contentPath: string;
  readonly filesCount: number;
  readonly mediaCount: number;
  readonly timestamp: string;
}

export interface EmbeddingsMetadata {
  readonly filesProcessed: number;
  readonly filesReused: number;
  readonly dimension: number;
  readonly model: string;
}

export interface ContentHealth {
  readonly warnings: readonly string[];
  readonly metrics: {
    readonly postCount: number;
    readonly mediaCount: number;
    readonly contentRatio: number;
  };
}

export interface BuildResult extends JobData {
  readonly assets: AssetResult;
  readonly contentHealth: ContentHealth;
  readonly postEmbeddings?: {
    readonly slugMapPath: string;
    readonly hashMapPath: string;
    readonly similarityMapPath: string;
    readonly similarPostsMapPath: string;
    readonly similarityPairsCount: number;
  } & EmbeddingsMetadata;
  readonly mediaEmbeddings?: {
    readonly hashMapPath: string;
  } & EmbeddingsMetadata;
  readonly database?: {
    readonly path: string;
    readonly tables: readonly string[];
    readonly rowCounts: Record<string, number>;
  };
  readonly fileSummaries?: {
    readonly sourceFileSummaryPath: string;
    readonly distFileSummaryPath: string;
    readonly sourceFileCount: number;
    readonly distFileCount: number;
  };
}
