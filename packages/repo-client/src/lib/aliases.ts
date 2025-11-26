/**
 * Alias mechanism for backwards compatibility
 * Provides a way to create function aliases with deprecation warnings
 */

import { LOG_PREFIXES } from "./logger.js";

const prefix = LOG_PREFIXES.REPO_MD || "[RepoMD]";

/** Alias mapping type - maps alias names to target method names */
export type AliasMap = Record<string, string>;

/** Instance type that can have aliases applied */
export interface AliasableInstance {
  [key: string]: unknown;
}

/**
 * Simple mapping of method aliases to their target methods
 * Each key is the alias name, and the value is the target method name
 */
export const aliases: AliasMap = {
  // Posts related aliases
  'getPostsBySlug': 'getPostBySlug',

  // Files related aliases
  'getSourceFiles': 'getSourceFilesList',

  // URL related aliases
  'getSqliteURL': 'getSqliteUrl'
  // Add more aliases here as needed
};

/**
 * Creates a wrapper function that calls the target function
 * but logs a deprecation warning
 *
 * @param instance - The object instance that contains the target function
 * @param aliasName - The name of the alias function
 * @param targetName - The name of the target function to call
 * @returns Wrapper function that logs and calls the target
 */
export function createAliasFunction<T extends AliasableInstance>(
  instance: T,
  aliasName: string,
  targetName: string
): (...args: unknown[]) => unknown {
  // Pre-generate the deprecation message using the template
  const message = `'${aliasName}' is an alias of '${targetName}', it might be removed in a future version.`;

  return function (this: T, ...args: unknown[]): unknown {
    console.warn(`${prefix} ⚠️ Deprecated: ${message}`);

    // Call the target function with the same context and arguments
    const targetFn = instance[targetName];
    if (typeof targetFn === 'function') {
      return targetFn.apply(instance, args);
    }
    return undefined;
  };
}

/**
 * Applies all configured aliases to an instance
 *
 * @param instance - The object to apply aliases to
 * @param debug - Whether to log debug messages
 */
export function applyAliases<T extends AliasableInstance>(instance: T | null | undefined, debug = false): void {
  if (!instance) return;

  Object.entries(aliases).forEach(([aliasName, targetName]) => {
    // Skip if the target method doesn't exist
    if (typeof instance[targetName] !== "function") {
      if (debug) {
        console.warn(
          `${prefix} ⚠️ Cannot create alias '${aliasName}': target method '${targetName}' not found.`
        );
      }
      return;
    }

    // Skip if the alias would override an existing method
    if (aliasName in instance && aliasName !== targetName) {
      if (debug) {
        console.warn(
          `${prefix} ⚠️ Cannot create alias '${aliasName}': method already exists.`
        );
      }
      return;
    }

    // Create the alias function
    (instance as Record<string, unknown>)[aliasName] = createAliasFunction(instance, aliasName, targetName);

    if (debug) {
      console.log(`${prefix} ℹ️ Created alias '${aliasName}' → '${targetName}'`);
    }
  });
}
