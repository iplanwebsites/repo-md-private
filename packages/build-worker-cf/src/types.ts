/**
 * Build Worker Types
 * @module @repo-md/build-worker-cf
 */

/**
 * Git authentication options
 * (Duplicated from @repo-md/git-cache to avoid build-time dependency)
 */
export interface GitAuth {
  /** Authentication type */
  type: "token" | "ssh" | "basic";
  /** Personal access token (for "token" type) */
  token?: string;
  /** SSH private key (for "ssh" type) */
  sshKey?: string;
  /** Username (for "basic" type) */
  username?: string;
  /** Password (for "basic" type) */
  password?: string;
}

/**
 * Worker environment bindings
 */
export interface Env {
  /** Durable Object namespace for containers */
  BUILD_CONTAINER: DurableObjectNamespace;
  /** R2 bucket for git cache */
  GIT_CACHE_BUCKET: R2Bucket;
  /** R2 bucket for output files */
  OUTPUT_BUCKET: R2Bucket;
  /** Queue for build jobs */
  BUILD_QUEUE: Queue;
  /** API secret for authentication */
  API_SECRET: string;
}

/**
 * Build job message
 */
export interface BuildJob {
  /** Unique job ID */
  jobId: string;
  /** Consumer ID */
  consumerId: string;
  /** Repository URL */
  repoUrl: string;
  /** Branch to build */
  branch: string;
  /** Specific commit (optional) */
  commit?: string;
  /** Paths containing content */
  contentPaths: string[];
  /** Output prefix in R2 */
  outputPrefix: string;
  /** Git authentication */
  auth?: GitAuth;
  /** Build configuration */
  config: BuildConfig;
  /** Callback URL for status updates */
  callbackUrl?: string;
}

/**
 * Build configuration
 */
export interface BuildConfig {
  /** Enable image optimization */
  imageOptimization: boolean;
  /** Maximum image width */
  imageMaxWidth: number;
  /** Image quality (1-100) */
  imageQuality: number;
  /** Output image format */
  outputFormat: "webp" | "avif" | "jpeg" | "png";
  /** Generate search index */
  generateSearchIndex: boolean;
  /** Minify HTML output */
  minifyHtml: boolean;
  /** Enable debug mode */
  debug?: boolean;
}

/**
 * Build result
 */
export interface BuildResult {
  /** Whether build succeeded */
  success: boolean;
  /** Job ID */
  jobId: string;
  /** URL to the bundle */
  bundleUrl: string;
  /** Bundle manifest */
  manifest: BundleManifest;
  /** Build statistics */
  stats: BuildStats;
  /** Error message if failed */
  error?: string;
}

/**
 * Build statistics
 */
export interface BuildStats {
  /** Total duration in ms */
  duration: number;
  /** Whether git cache was hit */
  cacheHit: boolean;
  /** Commits since last cache */
  staleCommits: number;
  /** Number of files processed */
  filesProcessed: number;
  /** Number of images optimized */
  imagesOptimized: number;
  /** Total bundle size in bytes */
  bundleSizeBytes: number;
}

/**
 * Bundle manifest
 */
export interface BundleManifest {
  /** Manifest version */
  version: "1.0";
  /** Generation timestamp */
  generatedAt: string;
  /** Git commit hash */
  commit: string;
  /** Consumer ID */
  consumerId: string;
  /** List of files */
  files: ManifestFile[];
  /** Navigation structure */
  navigation?: NavItem[];
  /** Path to search index */
  searchIndex?: string;
  /** Build statistics */
  stats: BuildStats;
}

/**
 * Manifest file entry
 */
export interface ManifestFile {
  /** File path relative to bundle root */
  path: string;
  /** File type */
  type: "html" | "image" | "asset" | "json";
  /** File size in bytes */
  size: number;
  /** Content hash */
  hash: string;
  /** File metadata */
  metadata?: FileMetadata;
}

/**
 * File metadata
 */
export interface FileMetadata {
  /** Page title */
  title?: string;
  /** Page description */
  description?: string;
  /** Frontmatter data */
  frontmatter?: Record<string, unknown>;
  /** Source markdown path */
  sourcePath?: string;
}

/**
 * Navigation item
 */
export interface NavItem {
  /** Display title */
  title: string;
  /** URL path */
  path: string;
  /** Child items */
  children?: NavItem[];
  /** Sort order */
  order?: number;
}

/**
 * Latest deploy pointer
 */
export interface LatestDeploy {
  /** Deploy ID */
  deployId: string;
  /** Commit hash */
  commit: string;
  /** Timestamp */
  timestamp: string;
}

/**
 * Default build config
 */
export const DEFAULT_BUILD_CONFIG: BuildConfig = {
  imageOptimization: true,
  imageMaxWidth: 1200,
  imageQuality: 80,
  outputFormat: "webp",
  generateSearchIndex: true,
  minifyHtml: true,
};
