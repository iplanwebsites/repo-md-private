/**
 * Framework Integration Snippets for RepoMD
 *
 * For framework integrations, use:
 * import { viteRepoMdProxy, nextRepoMdMiddleware, remixRepoMdLoader } from 'repo-md'
 */

/** Path prefix for media requests that should be proxied */
export const MEDIA_PATH = "/_repo/medias" as const;

/** Base URL for R2 static asset storage */
export const R2_URL = "https://static.repo.md" as const;
