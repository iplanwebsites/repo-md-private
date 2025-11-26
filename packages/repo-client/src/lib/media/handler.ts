/**
 * Media Handling module for RepoMD
 * Provides functions for media asset retrieval and processing
 */

import { LOG_PREFIXES } from '../logger.js';
import { handleCloudflareRequest as handleMediaRequest } from '../mediaProxy.js';
import type { Media } from '../posts/search.js';

/** Media item type (alias for Media) */
export type MediaItem = Media;

const prefix = LOG_PREFIXES.REPO_MD;

/** Request-like type for Cloudflare (same as standard Request) */
export type CloudflareRequest = Request;

/** Media handler configuration */
export interface MediaHandlerConfig {
  fetchR2Json: <T>(path: string, options?: { defaultValue?: T; useCache?: boolean }) => Promise<T>;
  getProjectUrl: (path: string) => string;
  getRevisionUrl: (path: string) => Promise<string>;
  debug?: boolean;
}

/** Media handler service interface */
export interface MediaHandlerService {
  getMediaUrl: (path: string) => Promise<string>;
  getAllMedias: (useCache?: boolean) => Promise<Media[]>;
  getAllMedia: (useCache?: boolean) => Promise<Media[]>;
  getMediaItems: (useCache?: boolean) => Promise<Media[]>;
  handleCloudflareRequest: (request: CloudflareRequest) => Promise<Response>;
}

/**
 * Create a media handling service
 * @param config - Configuration object
 * @returns Media handling functions
 */
export function createMediaHandler(config: MediaHandlerConfig): MediaHandlerService {
  const {
    fetchR2Json,
    getProjectUrl,
    getRevisionUrl,
    debug = false
  } = config;

  /**
   * Get URL for a media asset
   * @param path - Media asset path
   * @returns Full URL to media asset
   */
  async function getMediaUrl(path: string): Promise<string> {
    const url = getProjectUrl(`/_shared/medias/${path}`);

    if (debug) {
      console.log(`${prefix} 🔗 Generated media URL: ${url}`);
    }
    return url;
  }

  /**
   * Get all media data
   * @param useCache - Whether to use cache
   * @returns Media data
   */
  async function getAllMedia(useCache = true): Promise<Media[]> {
    // No need to call ensureLatestRev - fetchR2Json will handle revision resolution
    const mediaData = await fetchR2Json<Media[]>('/medias.json', {
      defaultValue: [],
      useCache,
    });

    if (debug) {
      console.log(`${prefix} 📄 Fetched media data`);
    }

    return mediaData;
  }

  /**
   * Alias with plural naming (for backward compatibility)
   * @param useCache - Whether to use cache
   * @returns Media data
   */
  async function getAllMedias(useCache = true): Promise<Media[]> {
    return await getAllMedia(useCache);
  }

  /**
   * Get all media items with formatted URLs
   * @param useCache - Whether to use cache
   * @returns Media items
   */
  async function getMediaItems(useCache = true): Promise<Media[]> {
    return await getAllMedia(useCache);
  }

  /**
   * Handle a Cloudflare request for media assets
   * @param request - Cloudflare request object
   * @returns Response object
   */
  async function handleCloudflareRequest(request: CloudflareRequest): Promise<Response> {
    if (debug) {
      console.log(`${prefix} 🖼️ Handling Cloudflare request: ${request.url}`);
    }

    // Create a wrapper function that resolves the Promise from getMediaUrl
    const getResolvedMediaUrl = async (path: string): Promise<string> => {
      return await getMediaUrl(path);
    };

    const result = await handleMediaRequest(request, getResolvedMediaUrl);
    if (!result) {
      return new Response('Not found', { status: 404 });
    }
    return result;
  }

  return {
    getMediaUrl,
    getAllMedias,
    getAllMedia,
    getMediaItems,
    handleCloudflareRequest,
  };
}
