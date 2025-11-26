/**
 * Utility functions for RepoMD
 * Handles HTTP fetching with caching and error handling
 */

import QuickLRU from "quick-lru";
import { LOG_PREFIXES } from "./logger.js";

/** Extended QuickLRU interface with properties we use */
interface QuickLRUCache<K, V> extends Map<K, V> {
  maxSize: number;
  maxAge: number;
}

// Global cache instance that persists across requests
const lru = new QuickLRU({
  maxSize: 1000, // tweak depending on worker
  maxAge: 60000 * 60, // 1h
}) as unknown as QuickLRUCache<string, unknown>;

// Cache for active fetch promises to prevent duplicate requests
const promiseCache = new Map<string, Promise<unknown>>();

const prefix = LOG_PREFIXES.UTILS;

// Check if we're in a Node.js server environment
const isNodeEnv = typeof process !== 'undefined' && process.versions && process.versions.node;

// Trusted repo.md domains - these are first-party domains we control
const TRUSTED_REPOMD_DOMAINS = ['api.repo.md', 'static.repo.md', 'repo.md'];

/**
 * Check if URL is a trusted repo.md domain
 * @param url - URL to check
 * @returns Whether the URL is a trusted domain
 */
function isTrustedRepoMdDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return TRUSTED_REPOMD_DOMAINS.includes(urlObj.hostname);
  } catch {
    return false;
  }
}

/**
 * Enhanced fetch wrapper that handles SSL certificate issues gracefully
 * For trusted repo.md domains, uses environment variable override if available
 * @param url - URL to fetch
 * @param options - Fetch options
 * @returns Fetch response
 */
async function robustFetch(url: string, options?: RequestInit): Promise<Response> {
  try {
    // Use native fetch (available in Node 18+, all browsers)
    return await globalThis.fetch(url, options);
  } catch (error) {
    const err = error as Error;
    // Check if this is an SSL/network error
    const isSSLOrNetworkError = err.message && (
      err.message.includes('certificate') ||
      err.message.includes('SSL') ||
      err.message.includes('TLS') ||
      err.message.includes('self signed') ||
      err.message.includes('unable to verify') ||
      err.message.includes('fetch failed') ||
      err.message.includes('ECONNREFUSED') ||
      err.message.includes('ETIMEDOUT')
    );

    if (isSSLOrNetworkError && isNodeEnv) {
      const urlObj = new URL(url);
      const isTrustedDomain = isTrustedRepoMdDomain(url);

      // Log the error
      console.error(
        `${prefix} ⚠️  Network/SSL error accessing ${urlObj.hostname}:`,
        err.message
      );

      // Provide helpful guidance
      if (isTrustedDomain) {
        console.error(
          `${prefix} 💡 This is a trusted repo.md domain. ` +
          `If SSL validation is failing in your environment, set: ` +
          `NODE_TLS_REJECT_UNAUTHORIZED=0 (environment variable)`
        );
      } else if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `${prefix} 💡 Development tip: If this is a trusted domain with SSL issues, ` +
          `you can set NODE_TLS_REJECT_UNAUTHORIZED=0 in development (NOT recommended for production)`
        );
      }
    }

    // Re-throw the original error with added context
    throw error;
  }
}

/**
 * Clear a URL from both the data cache and promise cache
 * @param url - The URL to clear from caches
 * @param debug - Whether to log debug information
 * @returns Whether the URL was found in either cache
 */
export function clearUrlFromCache(url: string, debug = false): boolean {
  let found = false;

  if (lru && lru.has(url)) {
    lru.delete(url);
    found = true;
    if (debug) {
      console.log(`${prefix} 🗑️ Cleared URL from data cache: ${url}`);
    }
  }

  if (promiseCache.has(url)) {
    promiseCache.delete(url);
    found = true;
    if (debug) {
      console.log(`${prefix} 🗑️ Cleared URL from promise cache: ${url}`);
    }
  }

  return found;
}

/** Options for fetchJson function */
export interface FetchJsonOptions {
  /** Error message to display on failure */
  errorMessage?: string;
  /** Default value to return on error */
  defaultValue?: unknown;
  /** Whether to use LRU cache */
  useCache?: boolean;
  /** HTTP method */
  method?: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: string | null;
  /** Return error object instead of throwing */
  returnErrorObject?: boolean;
}

/** Error response object */
export interface FetchErrorResponse {
  success: false;
  error: string;
  data: unknown;
}

/**
 * Fetch JSON with error handling and duration measurement
 * @param url - URL to fetch
 * @param opts - Fetch options
 * @param debug - Whether to log debug information
 * @returns Parsed JSON data or default value on error
 */
export async function fetchJson<T = unknown>(
  url: string,
  opts: FetchJsonOptions = {},
  debug = false
): Promise<T | FetchErrorResponse | null> {
  // Deconstruct options with sensible defaults
  const {
    errorMessage = "Error fetching data",
    defaultValue = null,
    useCache = true,
    method = "GET",
    headers = {},
    body = null,
    returnErrorObject = false,
  } = opts;

  // Create fetch options
  const fetchOptions: RequestInit = {
    method,
    headers: {
      ...headers,
    },
  };

  // Add body for POST requests
  if (body && method !== "GET") {
    fetchOptions.body = body;
  }

  // For POST requests, don't use cache by default
  const shouldUseCache = useCache && method === "GET";

  // Track start time for duration calculation
  const startTime = performance.now();

  try {
    if (debug) {
      console.log(`${prefix} 🌐 Fetching JSON from: ${url} (${method})`);
      if (method !== "GET" && body) {
        console.log(`${prefix} 📤 Request body:`, body.substring(0, 200) + (body.length > 200 ? '...' : ''));
      }
    }

    // Check cache first if provided (only for GET requests)
    if (shouldUseCache && lru && lru.has(url)) {
      const cachedData = lru.get(url) as T;
      const duration = (performance.now() - startTime).toFixed(2);
      if (debug) {
        console.log(`${prefix} ✨ Cache hit for: ${url} (${duration}ms)`);
      }
      return cachedData;
    }

    // Check if there's already an in-flight request for this URL (only for GET requests)
    if (shouldUseCache && promiseCache.has(url)) {
      if (debug) {
        console.log(`${prefix} 🔄 Reusing in-flight request for: ${url}`);
      }
      return promiseCache.get(url) as Promise<T>;
    }

    // Create and store the promise for this request
    const fetchPromise = (async (): Promise<T> => {
      try {
        const response = await robustFetch(url, fetchOptions);

        // Log the full response for debugging
        if (debug) {
          console.log(`${prefix} 📡 Response status: ${response.status} ${response.statusText}`);
          console.log(`${prefix} 🔍 Response URL: ${response.url}`);

          // Log response headers
          const headersObj: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            headersObj[key] = value;
          });
          console.log(`${prefix} 📝 Response headers:`, headersObj);
        }

        // Handle different HTTP error status codes with specific messages
        if (!response.ok) {
          let userMessage: string;

          switch (response.status) {
            case 404:
              userMessage = `Resource not found (404): ${url.split('/').slice(-2).join('/')}`;
              break;
            case 401:
              userMessage = "Authentication required: Please check your credentials";
              break;
            case 403:
              userMessage = "Access forbidden: You don't have permission to access this resource";
              break;
            case 429:
              userMessage = "Too many requests: Please try again later";
              break;
            case 500:
            case 502:
            case 503:
            case 504:
              userMessage = `Server error (${response.status}): The server encountered an issue`;
              break;
            default:
              userMessage = `${errorMessage}: ${response.statusText} (${response.status})`;
          }

          if (debug) {
            console.error(`${prefix} ❌ ${userMessage}`);
          }

          throw new Error(userMessage);
        }

        // First clone the response since we might need to read the body twice
        const clonedResponse = response.clone();

        // Parse JSON safely
        let data: T;
        try {
          data = await response.json() as T;

          // Log the parsed response data when in debug mode
          if (debug) {
            const jsonStr = JSON.stringify(data, null, 2);
            console.log(`${prefix} 📦 Response data:`, jsonStr.substring(0, 500) + (jsonStr.length > 500 ? '...' : ''));
          }
        } catch (jsonError) {
          // In case of a JSON parsing error, try to get the raw text to help with debugging
          try {
            const responseText = await clonedResponse.text();
            if (debug) {
              console.error(`${prefix} ❌ Failed to parse JSON response:`, jsonError);
              console.error(`${prefix} 📃 Raw response text (first 500 chars):`, responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));
            }
          } catch (textError) {
            if (debug) {
              console.error(`${prefix} ❌ Failed to parse JSON response:`, jsonError);
              console.error(`${prefix} ❌ Also failed to read raw response text:`, textError);
            }
          }

          throw new Error(`Invalid JSON response from ${url}: ${(jsonError as Error).message}`);
        }

        const duration = (performance.now() - startTime).toFixed(2);

        // Log the fetch duration
        if (debug) {
          console.log(`${prefix} ⏱️ Fetched data in ${duration}ms: ${url}`);
        }

        // Store in cache if provided (only for GET requests)
        if (shouldUseCache && lru) {
          lru.set(url, data);
          if (debug) {
            console.log(
              `${prefix} 💽 Cached data for: ${url} (cache size: ${lru.size})`
            );
          }
        }

        return data;
      } finally {
        // Remove this URL from the promise cache when done
        if (shouldUseCache) {
          promiseCache.delete(url);
          if (debug) {
            console.log(`${prefix} 🧹 Removed promise from cache: ${url}`);
          }
        }
      }
    })();

    // Store the promise in the cache
    if (shouldUseCache) {
      promiseCache.set(url, fetchPromise);
      if (debug) {
        console.log(`${prefix} 📥 Cached promise for: ${url}`);
      }
    }

    return fetchPromise;
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    if (debug) {
      console.error(`${prefix} ⚠️ Error fetching: ${url} (${duration}ms)`);
      console.error(`${prefix} ⚠️ ${errorMessage}:`, error);
    }

    // Clean up the promise cache if there was an error outside of the fetch operation
    if (shouldUseCache && promiseCache.has(url)) {
      promiseCache.delete(url);
      if (debug) {
        console.log(`${prefix} 🧹 Removed failed promise from cache: ${url}`);
      }
    }

    // Return a more structured error object that can be checked
    if (returnErrorObject) {
      return {
        success: false,
        error: (error as Error).message || "Unknown error",
        data: defaultValue
      };
    }

    return defaultValue as T | null;
  }
}
