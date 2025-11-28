/**
 * Git Cache - R2-backed git repository caching
 * @module @repo-md/git-cache
 */

import { exec as execCallback } from "child_process";
import { promisify } from "util";
import { createReadStream, createWriteStream } from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import { pipeline } from "stream/promises";
import { createGzip, createGunzip } from "zlib";
import * as tar from "tar";

import type {
  GitCacheConfig,
  CacheEntry,
  RestoreResult,
  RestoreOptions,
  SaveOptions,
  PruneOptions,
  GitAuth,
} from "./types.js";

import {
  prepareForCache,
  getCurrentCommit,
  countCommitsBetween,
  getRepoSize,
  cleanupTempFiles,
} from "./optimizations.js";

const exec = promisify(execCallback);

/**
 * GitCache class for caching git repositories in R2
 */
export class GitCache {
  private r2Bucket: R2Bucket;
  private prefix: string;
  private verbose: boolean;

  constructor(config: GitCacheConfig) {
    this.r2Bucket = config.r2Bucket;
    this.prefix = config.prefix ?? "git-cache";
    this.verbose = config.verbose ?? false;
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`[GitCache] ${message}`);
    }
  }

  private getCacheKey(consumerId: string): string {
    return `${this.prefix}/${consumerId}`;
  }

  private getRepoTarKey(consumerId: string): string {
    return `${this.getCacheKey(consumerId)}/repo.tar.gz`;
  }

  private getMetaKey(consumerId: string): string {
    return `${this.getCacheKey(consumerId)}/meta.json`;
  }

  /**
   * Build authenticated git URL
   */
  private buildAuthUrl(repoUrl: string, auth?: GitAuth): string {
    if (!auth) return repoUrl;

    const url = new URL(repoUrl);

    switch (auth.type) {
      case "token":
        if (auth.token) {
          // GitHub style: https://x-access-token:TOKEN@github.com/user/repo
          url.username = "x-access-token";
          url.password = auth.token;
        }
        break;
      case "basic":
        if (auth.username && auth.password) {
          url.username = auth.username;
          url.password = auth.password;
        }
        break;
      // SSH handled separately
    }

    return url.toString();
  }

  /**
   * Restore repository from cache or clone fresh
   */
  async restore(opts: RestoreOptions): Promise<RestoreResult> {
    const startTime = Date.now();
    const { consumerId, repoUrl, branch = "main", targetPath, auth, commit } = opts;

    this.log(`Restoring repo for consumer: ${consumerId}`);

    // Ensure target directory exists
    await fs.mkdir(targetPath, { recursive: true });

    // Try to get cache
    const cacheEntry = await this.stats(consumerId);
    let hit = false;
    let staleCommits = 0;
    let currentCommit = "";

    if (cacheEntry && cacheEntry.repoUrl === repoUrl) {
      this.log(`Cache hit for ${consumerId}`);
      hit = true;

      try {
        // Download and extract cache
        await this.downloadAndExtract(consumerId, targetPath);

        // Clean up any stale files
        await cleanupTempFiles(targetPath);

        // Pull latest changes
        const authUrl = this.buildAuthUrl(repoUrl, auth);
        await exec(`git remote set-url origin "${authUrl}"`, { cwd: targetPath });
        await exec(`git fetch origin ${branch}`, { cwd: targetPath });

        // Count stale commits
        const beforeCommit = await getCurrentCommit(targetPath);
        staleCommits = await countCommitsBetween(targetPath, beforeCommit, `origin/${branch}`);

        // Reset to latest
        await exec(`git checkout ${branch}`, { cwd: targetPath });
        await exec(`git reset --hard origin/${branch}`, { cwd: targetPath });

        currentCommit = await getCurrentCommit(targetPath);
        this.log(`Updated from ${beforeCommit.slice(0, 7)} to ${currentCommit.slice(0, 7)} (${staleCommits} commits)`);
      } catch (error) {
        // Cache restore failed, fall back to fresh clone
        this.log(`Cache restore failed: ${error}`);
        hit = false;
        await fs.rm(targetPath, { recursive: true, force: true });
        await fs.mkdir(targetPath, { recursive: true });
      }
    }

    if (!hit) {
      // Fresh clone
      this.log(`Cache miss, cloning fresh for ${consumerId}`);
      const authUrl = this.buildAuthUrl(repoUrl, auth);

      await exec(`git clone --branch ${branch} --single-branch "${authUrl}" .`, {
        cwd: targetPath,
      });

      currentCommit = await getCurrentCommit(targetPath);
      this.log(`Cloned at ${currentCommit.slice(0, 7)}`);
    }

    // Checkout specific commit if requested
    if (commit) {
      await exec(`git checkout ${commit}`, { cwd: targetPath });
      currentCommit = commit;
    }

    const duration = Date.now() - startTime;
    this.log(`Restore completed in ${duration}ms (hit: ${hit})`);

    return {
      hit,
      localPath: targetPath,
      staleCommits,
      currentCommit,
      duration,
    };
  }

  /**
   * Save repository to cache
   */
  async save(opts: SaveOptions): Promise<void> {
    const { consumerId, repoPath } = opts;

    this.log(`Saving cache for consumer: ${consumerId}`);

    // Prepare repo for caching
    await prepareForCache(repoPath);

    // Get metadata
    const currentCommit = await getCurrentCommit(repoPath);
    const repoUrl = await this.getRemoteUrl(repoPath);
    const branch = await this.getCurrentBranch(repoPath);
    const sizeBytes = await getRepoSize(repoPath);

    // Create tarball
    const tarPath = `/tmp/cache-${consumerId}-${Date.now()}.tar.gz`;
    await this.createTarball(repoPath, tarPath);

    // Upload to R2
    const tarContent = await fs.readFile(tarPath);
    await this.r2Bucket.put(this.getRepoTarKey(consumerId), tarContent);

    // Save metadata
    const meta: CacheEntry = {
      consumerId,
      repoUrl,
      lastCommit: currentCommit,
      lastUpdated: new Date(),
      sizeBytes,
      branch,
    };
    await this.r2Bucket.put(this.getMetaKey(consumerId), JSON.stringify(meta, null, 2));

    // Cleanup temp file
    await fs.rm(tarPath, { force: true });

    this.log(`Cache saved: ${sizeBytes} bytes, commit ${currentCommit.slice(0, 7)}`);
  }

  /**
   * Invalidate cache for a consumer
   */
  async invalidate(consumerId: string): Promise<void> {
    this.log(`Invalidating cache for: ${consumerId}`);

    await Promise.all([
      this.r2Bucket.delete(this.getRepoTarKey(consumerId)),
      this.r2Bucket.delete(this.getMetaKey(consumerId)),
    ]);
  }

  /**
   * Get cache stats for a consumer
   */
  async stats(consumerId: string): Promise<CacheEntry | null> {
    try {
      const metaObject = await this.r2Bucket.get(this.getMetaKey(consumerId));
      if (!metaObject) return null;

      const metaText = await metaObject.text();
      const meta = JSON.parse(metaText) as CacheEntry;
      meta.lastUpdated = new Date(meta.lastUpdated);
      return meta;
    } catch {
      return null;
    }
  }

  /**
   * Prune old caches
   */
  async prune(opts: PruneOptions): Promise<string[]> {
    const { olderThanDays, dryRun = false } = opts;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    this.log(`Pruning caches older than ${olderThanDays} days`);

    const pruned: string[] = [];

    // List all cache entries
    const list = await this.r2Bucket.list({ prefix: `${this.prefix}/` });

    for (const obj of list.objects) {
      if (!obj.key.endsWith("/meta.json")) continue;

      try {
        const metaObject = await this.r2Bucket.get(obj.key);
        if (!metaObject) continue;

        const meta = JSON.parse(await metaObject.text()) as CacheEntry;
        const lastUpdated = new Date(meta.lastUpdated);

        if (lastUpdated < cutoffDate) {
          this.log(`Pruning cache for ${meta.consumerId} (last updated: ${lastUpdated.toISOString()})`);
          pruned.push(meta.consumerId);

          if (!dryRun) {
            await this.invalidate(meta.consumerId);
          }
        }
      } catch (error) {
        this.log(`Error checking cache: ${obj.key}: ${error}`);
      }
    }

    this.log(`Pruned ${pruned.length} caches${dryRun ? " (dry run)" : ""}`);
    return pruned;
  }

  /**
   * Download and extract tarball from R2
   */
  private async downloadAndExtract(consumerId: string, targetPath: string): Promise<void> {
    const tarObject = await this.r2Bucket.get(this.getRepoTarKey(consumerId));
    if (!tarObject) {
      throw new Error(`Cache tarball not found for ${consumerId}`);
    }

    // Write to temp file
    const tarPath = `/tmp/restore-${consumerId}-${Date.now()}.tar.gz`;
    const tarContent = await tarObject.arrayBuffer();
    await fs.writeFile(tarPath, Buffer.from(tarContent));

    // Extract
    await tar.x({
      file: tarPath,
      cwd: targetPath,
      strip: 1, // Remove the top-level directory
    });

    // Cleanup
    await fs.rm(tarPath, { force: true });
  }

  /**
   * Create tarball from repository
   */
  private async createTarball(repoPath: string, tarPath: string): Promise<void> {
    await tar.c(
      {
        gzip: true,
        file: tarPath,
        cwd: path.dirname(repoPath),
      },
      [path.basename(repoPath)]
    );
  }

  /**
   * Get remote URL from repo
   */
  private async getRemoteUrl(repoPath: string): Promise<string> {
    const { stdout } = await exec("git remote get-url origin", { cwd: repoPath });
    return stdout.trim();
  }

  /**
   * Get current branch
   */
  private async getCurrentBranch(repoPath: string): Promise<string> {
    const { stdout } = await exec("git rev-parse --abbrev-ref HEAD", { cwd: repoPath });
    return stdout.trim();
  }
}
