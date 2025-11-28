/**
 * Cache optimization utilities
 * @module @repo-md/git-cache
 */

import { exec as execCallback } from "child_process";
import { promisify } from "util";

const exec = promisify(execCallback);

/**
 * Prepare a repository for caching by cleaning up unnecessary files
 * and compressing git objects
 */
export async function prepareForCache(repoPath: string): Promise<void> {
  // Run aggressive garbage collection
  await exec("git gc --aggressive --prune=now", { cwd: repoPath });

  // Expire reflog
  await exec("git reflog expire --expire=now --all", { cwd: repoPath });

  // Remove git hooks (not needed in cache)
  await exec("rm -rf .git/hooks", { cwd: repoPath }).catch(() => {});

  // Remove logs (not needed in cache)
  await exec("rm -rf .git/logs", { cwd: repoPath }).catch(() => {});
}

/**
 * Determine shallow clone depth based on estimated repo size
 */
export function getShallowCloneDepth(repoSizeMB: number): number {
  if (repoSizeMB > 500) return 1;
  if (repoSizeMB > 200) return 10;
  if (repoSizeMB > 100) return 50;
  return 100;
}

/**
 * Generate sparse checkout config for content-focused repos
 */
export function generateSparseCheckoutConfig(contentPaths: string[]): string {
  return [
    "/*",           // Root files (package.json, etc)
    "!/*/",         // Exclude all top-level dirs by default
    ...contentPaths.map(p => `/${p.replace(/^\//, "")}/`),
  ].join("\n");
}

/**
 * Count commits between two refs
 */
export async function countCommitsBetween(
  repoPath: string,
  fromRef: string,
  toRef: string
): Promise<number> {
  try {
    const { stdout } = await exec(
      `git rev-list --count ${fromRef}..${toRef}`,
      { cwd: repoPath }
    );
    return parseInt(stdout.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Get current commit hash
 */
export async function getCurrentCommit(repoPath: string): Promise<string> {
  const { stdout } = await exec("git rev-parse HEAD", { cwd: repoPath });
  return stdout.trim();
}

/**
 * Get remote URL
 */
export async function getRemoteUrl(repoPath: string): Promise<string> {
  const { stdout } = await exec("git remote get-url origin", { cwd: repoPath });
  return stdout.trim();
}

/**
 * Check if repo has uncommitted changes
 */
export async function hasUncommittedChanges(repoPath: string): Promise<boolean> {
  try {
    const { stdout } = await exec("git status --porcelain", { cwd: repoPath });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get repo size in bytes
 */
export async function getRepoSize(repoPath: string): Promise<number> {
  try {
    const { stdout } = await exec(`du -sb "${repoPath}"`, { cwd: repoPath });
    const sizeStr = stdout.split("\t")[0];
    return parseInt(sizeStr ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Clean up temp files that may have been left behind
 */
export async function cleanupTempFiles(repoPath: string): Promise<void> {
  // Remove any lock files
  await exec("rm -f .git/index.lock", { cwd: repoPath }).catch(() => {});

  // Remove any partial pack files
  await exec("rm -f .git/objects/pack/*.tmp", { cwd: repoPath }).catch(() => {});
}
