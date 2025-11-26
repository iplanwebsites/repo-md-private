/**
 * Logger - Module-specific logging utilities
 * Maintains line numbers by avoiding centralized logging functions
 *
 * Developer Reference:
 *
 * RepoMD Module:
 * - 🚀 Initialization
 * - 🔗 URL generation
 * - 📡 Fetching/network operations
 * - 💾 Cache hit
 * - 🔍 Cache miss
 * - 📄 Posts operations
 * - ✅ Post found
 * - ❓ Post not found
 * - 👯 Similar posts
 * - ❌ Error
 * - 🏷️ Revision info
 *
 * Utils Module:
 * - 🌐 Fetching/network
 * - ✨ Cache hit
 * - 🔄 Cache miss
 * - ⚠️ Error
 * - 💽 Store in cache
 *
 * Media Module:
 * - 🖼️ Media request
 * - 🔀 Proxy operation
 * - 📦 Response handling
 * - 🚫 Error
 * - 📎 MIME type handling
 */

/** Log prefix identifiers for each module */
export interface LogPrefixes {
  readonly REPO_MD: string;
  readonly UTILS: string;
  readonly MEDIA: string;
}

/** Module prefixes for consistent log sources */
export const LOG_PREFIXES: LogPrefixes = {
  REPO_MD: '[RepoMD]',
  UTILS: '[Utils]',
  MEDIA: '[Media]'
} as const;

/** Debug flag for enabling verbose logging */
export const DEBUG = true;
