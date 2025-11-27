/**
 * RepoMD - A client for interacting with the repo.md API with modular architecture
 */

import { LOG_PREFIXES } from "./logger.js";
import { fetchJson, type FetchJsonOptions } from "./utils.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - envizion has no type definitions
import envizion from "envizion";
import { getVersionInfo } from "./version.js";

// Import modular components
import { createUrlGenerator, type UrlGenerator } from "./core/urls.js";
import { createApiClient, type ApiClient } from "./core/api.js";
import cache from "./core/cache.js";
import { createPostRetrieval, type PostRetrievalService, type Post } from "./posts/retrieval.js";
import { createPostSimilarity, type PostSimilarityService } from "./posts/similarity.js";
import { createPostSearch, type PostSearchService, type SearchResult } from "./posts/search.js";
import { createMediaHandler, type MediaHandlerService, type MediaItem } from "./media/handler.js";
import { createProjectConfig, type ProjectConfigService, type ReleaseInfo, type ProjectMetadata } from "./project/config.js";
import { createFileHandler, type FileHandlerService, type SourceFile, type DistFile, type GraphData } from "./files/index.js";
import { createMediaSimilarity, type MediaSimilarityService } from "./media/similarity.js";

// Import OpenAI utilities
import {
  createOpenAiToolHandler,
  handleOpenAiRequest,
  type OpenAiToolHandler,
  type OpenAiRequest,
  type OpenAiResponse,
} from "./openai/OpenAiToolHandler.js";

// Import exported logo and tool specs
import { createOpenAiSpecs, type OpenAiSpecs, type CreateOpenAiSpecsOptions } from "./openai/OpenAiToolSpec.js";

// Import alias mechanism, validation and logging
import { applyAliases } from "./aliases.js";
import {
  applyValidation,
  getMethodDescription,
  getAllMethodDescriptions,
  getMethodsByCategory,
  type MethodDescription,
} from "./schemas/index.js";
import { applyLogging } from "./core/logger-wrapper.js";

// Import Next.js middleware support
import { RepoNextMiddleware, createRepoMiddleware, type NextMiddlewareHandler } from "./middleware/RepoNextMiddleware.js";

// Import unified proxy configuration
import { UnifiedProxyConfig, type ViteProxyConfig, type NextConfig, type RemixLoader } from "./proxy/UnifiedProxyConfig.js";
import { getProjectIdFromEnv } from "./utils/env.js";

// Import framework integrations
import { nuxtRepoMdPlugin, type NuxtPlugin } from "./integrations/nuxt.js";
import { svelteKitRepoMdHandle, type SvelteKitHandle } from "./integrations/sveltekit.js";
import { expressRepoMdMiddleware, type ExpressMiddleware } from "./integrations/express.js";
import { fastifyRepoMdPlugin, type FastifyRepoMdOptions, type FastifyInstance, type FastifyDone } from "./integrations/fastify.js";
import { koaRepoMdMiddleware, type KoaMiddleware } from "./integrations/koa.js";
import { astroRepoMdMiddleware, type AstroMiddleware } from "./integrations/astro.js";

const prefix = LOG_PREFIXES.REPO_MD;

/** Statistics for post loading methods */
export interface PostMethodStats {
  memoryCache: number;
  directHashFile: number;
  directSlugFile: number;
  pathMap: number;
  directPath: number;
  allPosts: number;
}

/** Client post statistics tracking (different from PostStats in retrieval.ts) */
export interface ClientPostStats {
  totalLoaded: number;
  byMethod: PostMethodStats;
  individualLoads: number;
  allPostsLoaded: boolean;
  lastUpdated: number;
}

/** Client revision cache statistics (different from RevisionCacheStats in urls.ts) */
export interface ClientRevisionCacheStats {
  type: "latest" | "specific";
  expirySeconds: number;
  debugEnabled: boolean;
  currentRevision: string | null;
  lastUpdated: number;
  cacheValue?: string;
  cacheTimestamp?: number;
  isExpired?: boolean;
  msUntilExpiry?: number;
  expiryMs?: number;
  revisionType?: string;
}

/** Client statistics */
export interface ClientStats {
  posts: ClientPostStats;
  revisionCache: ClientRevisionCacheStats;
}

/** Strategy for data fetching */
export type RepoMDStrategy = "auto" | "browser" | "server";

/** RepoMD constructor options */
export interface RepoMDOptions {
  projectId?: string;
  projectSlug?: string;
  rev?: string;
  secret?: string | null;
  debug?: boolean;
  strategy?: RepoMDStrategy;
  revCacheExpirySeconds?: number;
  debug_rev_caching?: boolean;
}

/** Options for getOpenAiToolSpec */
export interface GetOpenAiToolSpecOptions extends CreateOpenAiSpecsOptions {
  blacklistedTools?: string[];
}

/** Options for unified proxy configuration */
export interface UnifiedProxyOptions {
  mediaUrlPrefix?: string;
  r2Url?: string;
  cacheMaxAge?: number;
  debug?: boolean;
}

/** Options for Next.js middleware */
export interface NextMiddlewareOptions {
  mediaUrlPrefix?: string;
  debug?: boolean;
}

/** Result of RepoMD.createNextMiddleware */
export interface RepoNextMiddlewareResult {
  middleware: NextMiddlewareHandler;
  config: {
    matcher: string;
  };
}

/** Options for Cloudflare handler */
export interface CloudflareHandlerOptions {
  returnNull?: boolean;
}

/** Options for search operations */
export interface FindOptions {
  limit?: number;
  threshold?: number;
  useClip?: boolean;
  type?: "auto" | "clip";
}

/** Search result with content metadata */
export interface ContentSearchResult extends SearchResult {
  content: unknown;
  contentType?: "post" | "media";
}

/** Augment posts options */
export interface AugmentPostsOptions {
  useCache?: boolean;
  [key: string]: unknown;
}

class RepoMD {
  // Index signature for dynamic method access
  [key: string]: unknown;

  // Configuration properties
  projectId: string | null;
  projectSlug: string;
  rev: string;
  debug: boolean;
  secret: string | null;
  strategy: RepoMDStrategy;
  revCacheExpirySeconds: number;
  debug_rev_caching: boolean;
  activeRev: string | null;

  // Stats tracking
  stats: ClientStats;

  // Service instances
  urls: UrlGenerator | null;
  api: ApiClient | null;
  posts: PostRetrievalService | null;
  similarity: PostSimilarityService | null;
  search: PostSearchService | null;
  media: MediaHandlerService | null;
  project: ProjectConfigService | null;
  files: FileHandlerService | null;
  mediaSimilarity: MediaSimilarityService | null;

  // Private properties
  _instanceId: string;
  _abortController?: AbortController | null;
  _destroyed: boolean;

  // Bound methods - use 'any' for compatibility with service configs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchJson: (url: string, opts?: FetchJsonOptions) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchR2Json: (path: string, opts?: FetchJsonOptions) => Promise<any>;
  ensureLatestRev: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _fetchMapData: (mapPath: string, defaultValue?: any) => Promise<any>;

  constructor({
    projectId,
    projectSlug = "undefined-project-slug",
    rev = "latest", // Default to "latest"
    secret = null,
    debug = false,
    strategy = "auto", // auto, browser, server
    revCacheExpirySeconds = 300, // 5 minutes default
    debug_rev_caching = false,
  }: RepoMDOptions = {}) {
    // Try to get project ID from environment if not provided
    let resolvedProjectId: string | null | undefined = projectId;
    if (!resolvedProjectId) {
      resolvedProjectId = getProjectIdFromEnv(null, 'RepoMD constructor');
    }
    // Store configuration
    this.projectId = resolvedProjectId ?? null;
    this.projectSlug = projectSlug;
    this.rev = rev;
    this.debug = debug;
    this.secret = secret;
    this.strategy = strategy;
    this.revCacheExpirySeconds = revCacheExpirySeconds;
    this.debug_rev_caching = debug_rev_caching;
    this.activeRev = null; // Store resolved latest revision ID

    // Initialize service references as null (will be set in initializeServices)
    this.urls = null;
    this.api = null;
    this.posts = null;
    this.similarity = null;
    this.search = null;
    this.media = null;
    this.project = null;
    this.files = null;
    this.mediaSimilarity = null;
    this._destroyed = false;

    // Initialize stats tracking
    this.stats = {
      posts: {
        totalLoaded: 0,
        byMethod: {
          memoryCache: 0,
          directHashFile: 0,
          directSlugFile: 0,
          pathMap: 0,
          directPath: 0,
          allPosts: 0,
        },
        individualLoads: 0,
        allPostsLoaded: false,
        lastUpdated: Date.now(),
      },
      revisionCache: {
        type: this.rev === "latest" ? "latest" : "specific",
        expirySeconds: this.revCacheExpirySeconds,
        debugEnabled: this.debug_rev_caching,
        currentRevision: this.activeRev,
        lastUpdated: Date.now(),
      },
    };

    // Configure cache for this instance
    cache.configure("posts", { maxSize: 1000 }, debug);
    cache.configure("similarity", { maxSize: 500 }, debug);
    cache.configure("media", { maxSize: 200 }, debug);

    // Create resolver function for the URL generator
    const resolveLatestRev = async (): Promise<string> => {
      try {
        // Use getActiveProjectRev which has built-in promise caching
        const resolvedRev = await this.api!.getActiveProjectRev();

        // Update our cached activeRev
        this.activeRev = resolvedRev;

        if (this.debug) {
          console.log(
            `${prefix} ✅ Resolved latest revision: ${resolvedRev} via resolver function`
          );
        }

        return resolvedRev;
      } catch (error) {
        if (this.debug) {
          console.warn(
            `${prefix} ⚠️ Failed to resolve latest rev during URL generation: ${(error as Error).message}`
          );
        }
        throw error;
      }
    };

    // Initialize URL generator with the resolver function
    this.urls = createUrlGenerator({
      projectId: resolvedProjectId ?? '',
      activeRev: this.activeRev ?? undefined,
      rev,
      resolveLatestRev,
      debug,
      revCacheExpirySeconds: this.revCacheExpirySeconds,
      debug_rev_caching: this.debug_rev_caching,
    });

    // Initialize API client
    this.api = createApiClient({
      projectId: resolvedProjectId ?? '',
      projectSlug,
      debug,
    });

    // If we're using "latest" revision, try to eagerly resolve it to avoid issues with lazy loading
    if (rev === "latest" && !this.activeRev) {
      // This is non-blocking - we don't await it but start the process early
      this.api
        .getActiveProjectRev()
        .then((resolvedRevision) => {
          this.activeRev = resolvedRevision;

          // Update URL generator with the resolved activeRev
          this.urls = createUrlGenerator({
            projectId: this.projectId ?? '',
            activeRev: this.activeRev ?? undefined,
            rev: this.rev,
            resolveLatestRev,
            debug: this.debug,
            revCacheExpirySeconds: this.revCacheExpirySeconds,
            debug_rev_caching: this.debug_rev_caching,
          });

          if (this.debug) {
            console.log(
              `${prefix} 🚀 Eagerly resolved 'latest' to revision: ${this.activeRev}`
            );
          }
        })
        .catch((error) => {
          if (this.debug) {
            console.warn(
              `${prefix} ⚠️ Eager resolution failed, will resolve lazily: ${(error as Error).message}`
            );
          }
        });
    }

    // Create bind functions for passing to other modules
    this.fetchJson = this._fetchJson.bind(this);
    this.fetchR2Json = this._fetchR2Json.bind(this);
    this.ensureLatestRev = this._ensureLatestRev.bind(this);
    this._fetchMapData = this._fetchMapDataImpl.bind(this);

    // Initialize other services after bind functions are available
    this.initializeServices();

    // Generate instance ID
    this._instanceId = Math.random().toString(36).substring(2, 10);

    if (this.debug) {
      console.log(`${prefix} 🚀 Initialized RepoMD instance with:
        - projectId: ${resolvedProjectId}
        - rev: ${rev}
        - strategy: ${strategy}
        - instance: ${this._instanceId}
      `);
    }

    // Display version and build information using envizion (browser only)
    if (typeof window !== "undefined") {
      const { version, buildDate } = getVersionInfo();
      envizion({
        title: "Repo.md client",
        subtitle: "Build apps and websites using markdown",
        version,
        buildDate,
      });
    }
  }

  // Helper function to fetch JSON with error handling and caching
  private async _fetchJson(url: string, opts: FetchJsonOptions = {}): Promise<unknown> {
    return await fetchJson(url, opts, this.debug);
  }

  // Ensure latest revision is resolved before making R2 calls
  private async _ensureLatestRev(): Promise<void> {
    try {
      if (this.rev === "latest" && !this.activeRev) {
        if (this.debug) {
          console.log(
            `${prefix} 🔄 Resolving latest revision for project ${
              this.projectId || this.projectSlug
            }`
          );
        }

        // Use the API's ensureLatestRev helper which handles cached revisions
        // and will use the faster /rev endpoint through fetchProjectActiveRev
        const latestId = await this.api!.ensureLatestRev(
          this.rev,
          this.activeRev ?? undefined
        );

        if (!latestId) {
          throw new Error(
            `Could not determine latest revision ID for project ${
              this.projectId || this.projectSlug
            }`
          );
        }

        this.activeRev = latestId;

        // Recreate the resolver function
        const resolveLatestRev = async (): Promise<string> => {
          try {
            // Try to use the faster /rev endpoint directly
            const resolvedRev = await this.api!.fetchProjectActiveRev();

            // Update our cached activeRev
            this.activeRev = resolvedRev;

            return resolvedRev;
          } catch (error) {
            if (this.debug) {
              console.warn(
                `${prefix} ⚠️ Failed to resolve latest rev during URL generation: ${(error as Error).message}`
              );
            }
            throw error;
          }
        };

        // Update URL generator with the resolved activeRev
        this.urls = createUrlGenerator({
          projectId: this.projectId ?? '',
          activeRev: this.activeRev ?? undefined,
          rev: this.rev,
          resolveLatestRev,
          debug: this.debug,
          revCacheExpirySeconds: this.revCacheExpirySeconds,
          debug_rev_caching: this.debug_rev_caching,
        });

        if (this.debug) {
          console.log(
            `${prefix} ✅ Resolved 'latest' to revision: ${this.activeRev}`
          );
        }
      }
    } catch (error) {
      const errorMessage = `Failed to resolve latest revision: ${(error as Error).message}`;
      if (this.debug) {
        console.error(`${prefix} ❌ ${errorMessage}`);
      }
      throw new Error(errorMessage);
    }
  }

  // Fetch a JSON file from R2 storage
  private async _fetchR2Json(path: string, opts: FetchJsonOptions = {}): Promise<unknown> {
    // Get the URL, which will resolve revision if needed
    const url = await this.urls!.getRevisionUrl(path);
    return await this.fetchJson(url, opts);
  }

  // Helper function to safely fetch map data
  private async _fetchMapDataImpl<T = unknown>(mapPath: string, defaultValue: T = {} as T): Promise<T> {
    try {
      return await this.fetchR2Json(mapPath, {
        defaultValue,
        useCache: true,
      }) as T;
    } catch (error) {
      if (this.debug) {
        console.error(
          `${prefix} ❌ Error fetching map data ${mapPath}:`,
          error
        );
      }
      return defaultValue;
    }
  }

  // Initialize all service modules
  private initializeServices(): void {
    // Initialize post retrieval service
    this.posts = createPostRetrieval({
      getRevisionUrl: this.urls!.getRevisionUrl,
      getProjectUrl: this.urls!.getProjectUrl,
      getSharedFolderUrl: this.urls!.getSharedFolderUrl,
      fetchR2Json: this.fetchR2Json,
      fetchJson: this.fetchJson,
      _fetchMapData: this._fetchMapData,
      stats: this.stats,
      debug: this.debug,
      getActiveRev: this.urls!.getActiveRevState, // Pass revision getter for cache invalidation
    });

    // Initialize post similarity service
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.similarity = createPostSimilarity({
      fetchR2Json: this.fetchR2Json.bind(this),
      _fetchMapData: this._fetchMapData.bind(this),
      getRecentPosts: this.getRecentPosts.bind(this),
      getPostBySlug: this.getPostBySlug.bind(this),
      augmentPostsByProperty: this._augmentPostsByProperty.bind(this) as any,
      debug: this.debug,
      getActiveRev: this.urls!.getActiveRevState, // Pass revision getter for cache invalidation
    });

    // Initialize post search service
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.search = createPostSearch({
      getAllPosts: this.getAllPosts.bind(this),
      getPostsEmbeddings: this.getPostsEmbeddings.bind(this) as any,
      getAllMedia: this.getAllMedia.bind(this),
      getMediaEmbeddings: this.getMediaEmbeddings.bind(this) as any,
      debug: this.debug,
      getActiveRev: this.urls!.getActiveRevState, // Pass revision getter for cache invalidation
    });

    // Initialize media handling service
    this.media = createMediaHandler({
      fetchR2Json: this.fetchR2Json,
      getProjectUrl: this.urls!.getProjectUrl,
      getRevisionUrl: this.urls!.getRevisionUrl,
      debug: this.debug,
    });

    // Initialize project configuration service
    this.project = createProjectConfig({
      fetchProjectDetails: this.api!.fetchProjectDetails,
      debug: this.debug,
    });

    // Initialize file handling service
    this.files = createFileHandler({
      fetchR2Json: this.fetchR2Json,
      debug: this.debug,
    });

    // Initialize media similarity service
    this.mediaSimilarity = createMediaSimilarity({
      fetchR2Json: this.fetchR2Json.bind(this),
      _fetchMapData: this._fetchMapData.bind(this),
      getAllMedia: this.getAllMedia.bind(this),
      debug: this.debug,
      getActiveRev: this.urls!.getActiveRevState, // Pass revision getter for cache invalidation
    });

    // Apply any configured method aliases to this instance
    applyAliases(this, this.debug);

    // Apply parameter validation to methods
    applyValidation(this);

    // Apply method logging
    applyLogging(this, this.debug);

    if (this.debug) {
      console.log(`${prefix} ✓ Applied parameter validation to methods`);
      console.log(`${prefix} ✓ Applied method logging to API methods`);
    }
  }

  // URL generation methods (proxy to URL module)
  async getR2Url(path = ""): Promise<string> {
    return await this.urls!.getRevisionUrl(path);
  }

  getR2ProjectUrl(path = ""): string {
    return this.urls!.getProjectUrl(path);
  }

  getR2SharedFolderUrl(path = ""): string {
    return this.urls!.getSharedFolderUrl(path);
  }

  async getR2RevUrl(path = ""): Promise<string> {
    return await this.urls!.getRevisionUrl(path);
  }

  createViteProxy(folder = "_repo"): ViteProxyConfig {
    // For backward compatibility, still support the folder parameter
    const config = this.getUnifiedProxyConfig({
      mediaUrlPrefix: `/${folder}/medias/`,
    });
    return config.toViteConfig();
  }

  /**
   * Create a Remix loader function for this RepoMD instance
   * @param options - Loader configuration options
   * @returns Remix loader function
   */
  createRemixLoader(options: UnifiedProxyOptions = {}): RemixLoader {
    const config = this.getUnifiedProxyConfig(options);
    return config.toRemixLoader();
  }

  /**
   * Create a Cloudflare Workers handler for this RepoMD instance
   * @param options - Handler configuration options
   * @returns Cloudflare Workers request handler
   */
  createCloudflareHandler(options: CloudflareHandlerOptions = {}): (request: Request) => Promise<Response | null> {
    const { returnNull = false } = options;

    return async (request: Request): Promise<Response | null> => {
      const response = await this.handleCloudflareRequest(request);
      if (response) {
        return response;
      }
      // If not a media request
      if (returnNull) {
        return null; // Let other handlers process it
      }
      return new Response('Not Found', { status: 404 });
    };
  }

  // API methods (proxy to API module)
  async fetchPublicApi(path = "/"): Promise<unknown> {
    return await this.api!.fetchPublicApi(path);
  }

  async fetchProjectDetails(): Promise<unknown> {
    return await this.api!.fetchProjectDetails();
  }

  async fetchProjectActiveRev(): Promise<string> {
    return await this.api!.fetchProjectActiveRev();
  }

  async getActiveProjectRev(): Promise<string> {
    return await this.api!.getActiveProjectRev();
  }

  // SQLite URL method
  async getSqliteUrl(): Promise<string> {
    return await this.urls!.getSqliteUrl();
  }

  // Client stats method
  getClientStats(): ClientStats {
    // Update timestamp
    this.stats.posts.lastUpdated = Date.now();
    this.stats.revisionCache.lastUpdated = Date.now();

    // Update current revision info
    this.stats.revisionCache.currentRevision = this.activeRev;

    // Get detailed revision cache state from URL generator if available
    if (this.urls && typeof this.urls.getRevisionCacheStats === "function") {
      const cacheStats = this.urls.getRevisionCacheStats();
      this.stats.revisionCache = {
        ...this.stats.revisionCache,
        currentRevision: cacheStats.activeRevState || this.activeRev,
        cacheValue: cacheStats.cacheValue,
        cacheTimestamp: cacheStats.cacheTimestamp ?? undefined,
        isExpired: cacheStats.isExpired,
        msUntilExpiry: cacheStats.msUntilExpiry ?? undefined,
        expiryMs: cacheStats.expiryMs,
        revisionType: cacheStats.revisionType,
      };
    }

    // Return a copy of the stats object to prevent direct modification
    return JSON.parse(JSON.stringify(this.stats)) as ClientStats;
  }

  // Media methods (proxy to Media module)
  async getR2MediaUrl(path: string): Promise<string> {
    return await this.media!.getMediaUrl(path);
  }

  async getAllMedia(useCache = true): Promise<MediaItem[]> {
    return await this.media!.getAllMedia(useCache);
  }

  async getAllMedias(useCache = true): Promise<MediaItem[]> {
    if (this.debug) {
      console.warn(
        `${prefix} ⚠️ Deprecated: 'getAllMedias' is an alias of 'getAllMedia', it might be removed in a future version.`
      );
    }
    return await this.media!.getAllMedias(useCache);
  }

  async getMediaItems(useCache = true): Promise<MediaItem[]> {
    return await this.media!.getMediaItems(useCache);
  }

  async handleCloudflareRequest(request: Request): Promise<Response | null> {
    return await this.media!.handleCloudflareRequest(request);
  }

  // Post retrieval methods (proxy to Posts module)
  async getAllPosts(useCache = true, forceRefresh = false): Promise<Post[]> {
    return await this.posts!.getAllPosts(useCache, forceRefresh);
  }

  async getPostBySlug(slug: string): Promise<Post | null> {
    return await this.posts!.getPostBySlug(slug);
  }

  async getPostByHash(hash: string): Promise<Post | null> {
    return await this.posts!.getPostByHash(hash);
  }

  async getPostByPath(path: string): Promise<Post | null> {
    return await this.posts!.getPostByPath(path);
  }

  async _augmentPostsByProperty(keys: string[], property: string, options: AugmentPostsOptions = {}): Promise<Post[]> {
    return await this.posts!.augmentPostsByProperty(keys, property, options);
  }

  sortPostsByDate(posts: Post[]): Post[] {
    return this.posts!.sortPostsByDate(posts);
  }

  async getRecentPosts(count = 3): Promise<Post[]> {
    return await this.posts!.getRecentPosts(count);
  }

  _findPostByProperty(posts: Post[], property: string, value: string): Post | null {
    return this.posts!._findPostByProperty(posts, property, value);
  }

  // Post similarity methods (proxy to Similarity module)
  async getPostsEmbeddings(): Promise<unknown> {
    return await this.similarity!.getPostsEmbeddings();
  }

  async getPostsSimilarity(): Promise<unknown> {
    return await this.similarity!.getPostsSimilarity();
  }

  async getPostsSimilarityByHashes(hash1: string, hash2: string): Promise<number | null> {
    return await this.similarity!.getPostsSimilarityByHashes(hash1, hash2);
  }

  async getTopSimilarPostsHashes(): Promise<unknown> {
    return await this.similarity!.getTopSimilarPostsHashes();
  }

  async getSimilarPostsHashByHash(hash: string, limit = 10): Promise<unknown> {
    return await this.similarity!.getSimilarPostsHashByHash(hash, limit);
  }

  async getSimilarPostsByHash(hash: string, count = 5, options: AugmentPostsOptions = {}): Promise<Post[]> {
    return await this.similarity!.getSimilarPostsByHash(hash, count, options);
  }

  async getSimilarPostsSlugBySlug(slug: string, limit = 10): Promise<unknown> {
    return await this.similarity!.getSimilarPostsSlugBySlug(slug, limit);
  }

  async getSimilarPostsBySlug(slug: string, count = 5, options: AugmentPostsOptions = {}): Promise<Post[]> {
    return await this.similarity!.getSimilarPostsBySlug(slug, count, options);
  }

  // Post search methods (proxy to Search module)
  async searchPosts(text: string, props: Record<string, unknown> = {}, mode: 'memory' | 'vector' | 'vector-text' | 'vector-clip-text' | 'vector-clip-image' = "memory"): Promise<SearchResult[]> {
    return await this.search!.searchPosts({ text, props, mode });
  }

  async searchAutocomplete(term: string, limit = 10): Promise<string[]> {
    return await this.search!.searchAutocomplete(term, limit);
  }

  async refreshSearchIndex(): Promise<unknown> {
    return await this.search!.refreshMemoryIndex();
  }

  // Vector search methods - new public API
  async findPostsByText(text: string, options: FindOptions = {}): Promise<ContentSearchResult[]> {
    const { limit = 20, threshold = 0.1, useClip = false } = options;
    const mode = useClip ? "vector-clip-text" : "vector-text";

    const results = await this.search!.searchPosts({
      text,
      props: { limit, threshold },
      mode,
    });

    // Return only posts, filter out media results
    return results
      .filter((result) => result.type === "post" || result.post)
      .map((result) => ({
        ...result,
        content: result.post || result.content,
      }));
  }

  async findImagesByText(text: string, options: FindOptions = {}): Promise<ContentSearchResult[]> {
    const { limit = 20, threshold = 0.1 } = options;

    const results = await this.search!.searchPosts({
      text,
      props: { limit, threshold },
      mode: "vector-clip-text",
    });

    // Return only media results
    return results
      .filter((result) => result.type === "media" || result.media)
      .map((result) => ({
        ...result,
        content: result.media || result.content,
      }));
  }

  async findImagesByImage(image: string, options: FindOptions = {}): Promise<ContentSearchResult[]> {
    const { limit = 20, threshold = 0.1 } = options;

    const results = await this.search!.searchPosts({
      image,
      props: { limit, threshold },
      mode: "vector-clip-image",
    });

    // Return only media results
    return results
      .filter((result) => result.type === "media" || result.media)
      .map((result) => ({
        ...result,
        content: result.media || result.content,
      }));
  }

  async findSimilarContent(query: string, options: FindOptions = {}): Promise<ContentSearchResult[]> {
    const { limit = 20, threshold = 0.1, type = "auto" } = options;

    // Determine search mode and params based on query type and options
    type SearchMode = 'memory' | 'vector' | 'vector-text' | 'vector-clip-text' | 'vector-clip-image';
    let mode: SearchMode;
    const searchParams: { props: { limit: number; threshold: number }; text?: string; image?: string; mode?: SearchMode } = { props: { limit, threshold } };

    if (typeof query === "string") {
      if (query.startsWith("http") || query.startsWith("data:")) {
        // Looks like an image URL or data URI
        mode = "vector-clip-image";
        searchParams.image = query;
      } else {
        // Text query
        mode = type === "clip" ? "vector-clip-text" : "vector-text";
        searchParams.text = query;
      }
    } else {
      throw new Error("Query must be a string (text or image URL/data)");
    }

    searchParams.mode = mode;

    const results = await this.search!.searchPosts(searchParams);

    // Return all results with enhanced metadata
    return results.map((result) => ({
      ...result,
      content: result.post || result.media || result.content,
      contentType: (result.type || (result.post ? "post" : "media")) as "post" | "media",
    }));
  }

  // Project configuration methods (proxy to Project module)
  async getReleaseInfo(): Promise<ReleaseInfo | null> {
    return await this.project!.getReleaseInfo(this.projectId ?? '');
  }

  async getProjectMetadata(): Promise<ProjectMetadata | null> {
    return await this.project!.getProjectMetadata();
  }

  // File handling methods (proxy to Files module)
  async getSourceFilesList(useCache = true): Promise<SourceFile[]> {
    return await this.files!.getSourceFilesList(useCache);
  }

  async getDistFilesList(useCache = true): Promise<DistFile[]> {
    return await this.files!.getDistFilesList(useCache);
  }

  async getGraph(useCache = true): Promise<GraphData | null> {
    return await this.files!.getGraph(useCache);
  }

  async getFileContent(path: string, useCache = true): Promise<import("./files/index.js").FileContent | null> {
    return await this.files!.getFileContent(path, useCache);
  }

  // OpenAI integrations
  createOpenAiToolHandler(): OpenAiToolHandler {
    return createOpenAiToolHandler(this as unknown as import("./openai/OpenAiToolHandler.js").RepoMDInstance);
  }

  handleOpenAiRequest(request: OpenAiRequest): Promise<OpenAiResponse> {
    return handleOpenAiRequest(request, this as unknown as import("./openai/OpenAiToolHandler.js").RepoMDInstance);
  }

  getOpenAiToolSpec(options: GetOpenAiToolSpecOptions = {}): OpenAiSpecs {
    const { blacklistedTools = [], ...otherOptions } = options;

    // Generate the base spec
    const baseSpec = createOpenAiSpecs(otherOptions);

    // Apply project-specific configurations
    if (blacklistedTools.length > 0) {
      const filteredFunctions = baseSpec.functions.filter(
        (func) => !blacklistedTools.includes(func.name)
      );

      if (
        this.debug &&
        filteredFunctions.length !== baseSpec.functions.length
      ) {
        console.log(
          `${prefix} 🚫 Filtered out ${
            baseSpec.functions.length - filteredFunctions.length
          } blacklisted tools: ${blacklistedTools.join(", ")}`
        );
      }

      return {
        ...baseSpec,
        functions: filteredFunctions,
      };
    }

    return baseSpec;
  }

  // Media similarity methods (proxy to MediaSimilarity module)
  async getMediaEmbeddings(): Promise<unknown> {
    return await this.mediaSimilarity!.getMediaEmbeddings();
  }

  async getMediaSimilarity(): Promise<unknown> {
    return await this.mediaSimilarity!.getMediaSimilarity();
  }

  async getMediaSimilarityByHashes(hash1: string, hash2: string): Promise<number | null> {
    return await this.mediaSimilarity!.getMediaSimilarityByHashes(hash1, hash2);
  }

  async getTopSimilarMediaHashes(): Promise<unknown> {
    return await this.mediaSimilarity!.getTopSimilarMediaHashes();
  }

  async getSimilarMediaHashByHash(hash: string, limit = 10): Promise<unknown> {
    return await this.mediaSimilarity!.getSimilarMediaHashByHash(hash, limit);
  }

  async getSimilarMediaByHash(hash: string, count = 5): Promise<MediaItem[]> {
    return await this.mediaSimilarity!.getSimilarMediaByHash(hash, count);
  }

  // Embedding-based similarity search methods
  /**
   * Search posts by providing an embedding vector directly.
   * This is a "crude" similarity search that computes cosine similarity
   * between the provided embedding and all stored post embeddings.
   *
   * @param embedding - The query embedding vector (should match dimension of stored embeddings, typically 384)
   * @param limit - Maximum number of results to return (default: 10)
   * @param threshold - Minimum similarity threshold (default: 0.0)
   * @param maxCandidates - Maximum embeddings to compare against for performance (default: 200, 0 = unlimited)
   * @returns Array of posts with similarity scores, sorted by similarity descending
   */
  async searchPostsByEmbedding(
    embedding: number[],
    limit = 10,
    threshold = 0.0,
    maxCandidates = 200
  ): Promise<import("./posts/similarity.js").SimilaritySearchResult[]> {
    return await this.similarity!.searchPostsByEmbedding(embedding, limit, threshold, maxCandidates);
  }

  /**
   * Search media/images by providing an embedding vector directly.
   * This is a "crude" similarity search that computes cosine similarity
   * between the provided embedding and all stored media embeddings (CLIP embeddings).
   *
   * @param embedding - The query embedding vector (should match dimension of stored embeddings, typically 512 for CLIP)
   * @param limit - Maximum number of results to return (default: 10)
   * @param threshold - Minimum similarity threshold (default: 0.0)
   * @param maxCandidates - Maximum embeddings to compare against for performance (default: 200, 0 = unlimited)
   * @returns Array of media items with similarity scores, sorted by similarity descending
   */
  async searchMediaByEmbedding(
    embedding: number[],
    limit = 10,
    threshold = 0.0,
    maxCandidates = 200
  ): Promise<import("./media/similarity.js").MediaSimilaritySearchResult[]> {
    return await this.mediaSimilarity!.searchMediaByEmbedding(embedding, limit, threshold, maxCandidates);
  }

  // AI Inference methods (using inference module)
  async computeTextEmbedding(text: string, instruction: string | null = null): Promise<import("./inference.js").EmbeddingData> {
    const { computeTextEmbedding } = await import("./inference.js");
    return await computeTextEmbedding(text, instruction, this.debug);
  }

  async computeClipTextEmbedding(text: string): Promise<import("./inference.js").EmbeddingData> {
    const { computeClipTextEmbedding } = await import("./inference.js");
    return await computeClipTextEmbedding(text, this.debug);
  }

  async computeClipImageEmbedding(image: string): Promise<import("./inference.js").EmbeddingData> {
    const { computeClipImageEmbedding } = await import("./inference.js");
    return await computeClipImageEmbedding(image, this.debug);
  }

  // Unified proxy configuration
  /**
   * Get a unified proxy configuration for any framework
   * @param options - Configuration options
   * @returns Unified proxy configuration instance
   */
  getUnifiedProxyConfig(options: UnifiedProxyOptions = {}): UnifiedProxyConfig {
    return new UnifiedProxyConfig({
      projectId: this.projectId ?? '',
      mediaUrlPrefix: options.mediaUrlPrefix,
      r2Url: options.r2Url,
      cacheMaxAge: options.cacheMaxAge,
      debug: options.debug ?? this.debug,
    });
  }

  // Next.js middleware integration
  /**
   * Create a Next.js middleware handler for this RepoMD instance
   * @param options - Middleware configuration options
   * @returns Object containing middleware function and config
   */
  createNextMiddleware(options: NextMiddlewareOptions = {}): RepoNextMiddlewareResult {
    // Use the unified proxy configuration
    const config = this.getUnifiedProxyConfig(options);
    const middleware = createRepoMiddleware({
      projectId: this.projectId ?? '',
      mediaUrlPrefix: config.mediaUrlPrefix,
      r2Url: config.r2Url,
      debug: config.debug,
    });

    return {
      middleware,
      config: {
        matcher: `${config.mediaUrlPrefix}:path*`
      }
    };
  }

  /**
   * Create a Next.js configuration object for this RepoMD instance
   * @param options - Configuration options
   * @returns Next.js configuration object with rewrites
   */
  createNextConfig(options: UnifiedProxyOptions = {}): NextConfig {
    const config = this.getUnifiedProxyConfig(options);
    return config.toNextConfig();
  }

  /**
   * Get the Next.js middleware configuration
   * @param matcher - Custom matcher pattern
   * @returns Next.js middleware config object
   */
  static getNextMiddlewareConfig(matcher?: string): { matcher: string | string[] } {
    return {
      matcher: RepoNextMiddleware.getMatcher(matcher),
    };
  }

  /**
   * Create a Nuxt plugin for this RepoMD instance
   * @param options - Plugin configuration options
   * @returns Nuxt/Nitro plugin function
   */
  createNuxtPlugin(options: { debug?: boolean; [key: string]: unknown } = {}): NuxtPlugin {
    return nuxtRepoMdPlugin(this.projectId ?? '', {
      ...options,
      debug: options.debug ?? this.debug,
    });
  }

  /**
   * Create a SvelteKit handle function for this RepoMD instance
   * @param options - Handle configuration options
   * @returns SvelteKit handle function
   */
  createSvelteKitHandle(options: { debug?: boolean; [key: string]: unknown } = {}): SvelteKitHandle {
    return svelteKitRepoMdHandle(this.projectId ?? '', {
      ...options,
      debug: options.debug ?? this.debug,
    });
  }

  /**
   * Create an Express middleware for this RepoMD instance
   * @param options - Middleware configuration options
   * @returns Express middleware function
   */
  createExpressMiddleware(options: { debug?: boolean; [key: string]: unknown } = {}): ExpressMiddleware {
    return expressRepoMdMiddleware(this.projectId ?? '', {
      ...options,
      debug: options.debug ?? this.debug,
    });
  }

  /**
   * Create a Fastify plugin for this RepoMD instance
   * @param options - Plugin configuration options
   * @returns Fastify plugin function
   */
  createFastifyPlugin(options: { debug?: boolean; [key: string]: unknown } = {}): (fastify: FastifyInstance, opts: FastifyRepoMdOptions, done: FastifyDone) => Promise<void> {
    // Return a wrapped function that includes the projectId
    return async (fastify: FastifyInstance, opts: FastifyRepoMdOptions, done: FastifyDone): Promise<void> => {
      // Spread options and opts first, then override with specific values
      const { projectId: _optsProjectId, debug: optsDebug, ...restOpts } = opts;
      return fastifyRepoMdPlugin(fastify, {
        ...options,
        ...restOpts,
        projectId: this.projectId ?? '',
        debug: options.debug ?? optsDebug ?? this.debug,
      }, done);
    };
  }

  /**
   * Create a Koa middleware for this RepoMD instance
   * @param options - Middleware configuration options
   * @returns Koa middleware function
   */
  createKoaMiddleware(options: { debug?: boolean; [key: string]: unknown } = {}): KoaMiddleware {
    return koaRepoMdMiddleware(this.projectId ?? '', {
      ...options,
      debug: options.debug ?? this.debug,
    });
  }

  /**
   * Create an Astro middleware for this RepoMD instance
   * @param options - Middleware configuration options
   * @returns Astro middleware function
   */
  createAstroMiddleware(options: { debug?: boolean; [key: string]: unknown } = {}): AstroMiddleware {
    return astroRepoMdMiddleware(this.projectId ?? '', {
      ...options,
      debug: options.debug ?? this.debug,
    });
  }

  // Method documentation methods
  static getMethodDescription(methodName: string): MethodDescription | null {
    return getMethodDescription(methodName);
  }

  static getAllMethodDescriptions(): import("./schemas/types.js").MethodDescriptions {
    return getAllMethodDescriptions();
  }

  static getMethodsByCategory(category: string): import("./schemas/schemas.js").SchemasDict {
    return getMethodsByCategory(category);
  }

  static getAllMethodCategories(): string[] {
    const allMethods = getAllMethodDescriptions();
    return [...new Set(Object.values(allMethods).filter((m): m is MethodDescription => m !== null).map((m) => m.category))];
  }

  getMethodDescription(methodName: string): MethodDescription | null {
    return (this.constructor as typeof RepoMD).getMethodDescription(methodName);
  }


  destroy(): void {
    if (this.debug) {
      console.log(
        `${prefix} 🧹 Cleaning up RepoMD instance resources (instance: ${
          this._instanceId || "unknown"
        })`
      );
    }

    // Clear all cache for this instance
    cache.clear("posts");
    cache.clear("similarity");
    cache.clear("media");

    // Clear any references to services
    this.posts = null;
    this.similarity = null;
    this.search = null;
    this.media = null;
    this.project = null;
    this.files = null;

    // Clean up API client timers and resources
    if (this.api && typeof this.api.cleanup === "function") {
      this.api.cleanup();
    }

    // Clear URL generator and API client
    this.urls = null;
    this.api = null;

    // Clear any pending fetch operations if supported by platform
    if (typeof AbortController !== "undefined" && this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }

    // Flag as destroyed to prevent further use
    this._destroyed = true;
  }
}

// Export the logo
export const logo = `
▄▖            ▌
▙▘█▌▛▌▛▌  ▛▛▌▛▌
▌▌▙▖▙▌▙▌▗ ▌▌▌▙▌
    ▌          `;

// Export RepoMD class and OpenAI related tools
export { RepoMD, createOpenAiSpecs };

// Also export proxy configuration for direct use
export { UnifiedProxyConfig };

// Re-export types for consumers
export type {
  OpenAiSpecs,
  CreateOpenAiSpecsOptions,
  OpenAiToolHandler,
  OpenAiRequest,
  OpenAiResponse,
};
