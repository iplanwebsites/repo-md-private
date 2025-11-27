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

// ============================================================================
// Project Settings Types (from webapp)
// ============================================================================

/**
 * Image size configuration
 * Maps to UI checkboxes: xs, sm, md, lg, xl, 2xl
 */
export interface ImageSizeSettings {
  readonly xs?: boolean;
  readonly sm?: boolean;
  readonly md?: boolean;
  readonly lg?: boolean;
  readonly xl?: boolean;
  readonly '2xl'?: boolean;
}

/**
 * Image format configuration
 * Maps to UI checkboxes: jpg, webp
 */
export interface ImageFormatSettings {
  readonly jpg?: boolean;
  readonly webp?: boolean;
}

/**
 * Media settings from project.media
 */
export interface MediaSettings {
  readonly imageSizes?: ImageSizeSettings;
  readonly imageFormats?: ImageFormatSettings;
  readonly imageQuality?: number;
  readonly enableYoutubeEmbeds?: boolean;
  readonly enableAudioPlayer?: boolean;
  readonly codeBlockRender?: 'css' | 'iframe';
  readonly codeBlockTheme?: 'light' | 'dark';
  readonly mermaidRender?: 'svg' | 'iframe' | 'keep-as-code';
  readonly mermaidTheme?: 'light' | 'dark';
}

/**
 * Formatting settings from project.formatting
 */
export interface FormattingSettings {
  readonly parseFormulas?: boolean;
  readonly removeDeadLinks?: boolean;
  readonly syntaxHighlighting?: boolean;
  readonly pageLinkPrefix?: string;
  readonly mediaPrefix?: string;
}

/**
 * Build settings from project.settings.build
 */
export interface BuildSettings {
  readonly repositoryFolder?: string;
  readonly ignoreFiles?: string;
  readonly enableAutoDeployment?: boolean;
  readonly productionBranch?: string;
}

/**
 * Frontmatter settings from project.frontmatter
 */
export interface FrontmatterSettings {
  readonly defaultVisibility?: 'public' | 'private' | 'hidden';
}

/**
 * Combined project settings passed from API
 */
export interface ProjectSettings {
  readonly media?: MediaSettings;
  readonly formatting?: FormattingSettings;
  readonly build?: BuildSettings;
  readonly frontmatter?: FrontmatterSettings;
}

// ============================================================================
// Job Data
// ============================================================================

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

  // Project settings from webapp
  readonly projectSettings?: ProjectSettings;
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
