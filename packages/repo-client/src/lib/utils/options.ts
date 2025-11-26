/**
 * Utility functions for options handling
 * Eliminates repeated option normalization patterns across integrations
 */

import type { BaseProxyOptions } from '../types/common.js';

/**
 * Normalize options that can be passed as string (projectId) or object
 * Replaces 8+ instances of: `typeof options === 'string' ? { projectId: options } : options`
 *
 * @param options - Options object or projectId string
 * @returns Normalized options object
 *
 * @example
 * // These are equivalent:
 * normalizeOptions('my-project')
 * normalizeOptions({ projectId: 'my-project' })
 */
export function normalizeOptions<T extends BaseProxyOptions>(
  options: T | string = {} as T
): T {
  if (typeof options === 'string') {
    return { projectId: options } as T;
  }
  return options;
}

/**
 * Get media URL prefix from route or explicit mediaUrlPrefix
 * Replaces 4+ instances of: `config.route ? \`/\${config.route}/medias\` : config.mediaUrlPrefix`
 *
 * @param route - Route prefix (e.g., '_repo')
 * @param mediaUrlPrefix - Explicit media URL prefix
 * @param defaultPrefix - Default prefix if neither is provided
 * @returns Computed media URL prefix
 *
 * @example
 * getMediaUrlPrefix('_repo')              // '/_repo/medias/'
 * getMediaUrlPrefix(undefined, '/media/') // '/media/'
 * getMediaUrlPrefix()                     // '/_repo/medias/'
 */
export function getMediaUrlPrefix(
  route?: string,
  mediaUrlPrefix?: string,
  defaultPrefix = '/_repo/medias/'
): string {
  if (route) {
    return `/${route}/medias/`;
  }
  return mediaUrlPrefix ?? defaultPrefix;
}

/**
 * Merge debug option with fallback chain
 * Commonly used pattern: `options.debug ?? instanceDebug ?? false`
 *
 * @param sources - Array of debug values to check in order
 * @returns First defined boolean value, or false
 */
export function resolveDebug(...sources: (boolean | undefined)[]): boolean {
  for (const source of sources) {
    if (source !== undefined) {
      return source;
    }
  }
  return false;
}
