/**
 * Build Pipeline - Main build orchestration
 * @module @repo-md/build-worker-cf
 */

import { exec as execCallback } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";
import crypto from "crypto";

import { GitCache } from "@repo-md/git-cache";

import type {
  BuildJob,
  BuildResult,
  BuildStats,
  BundleManifest,
  ManifestFile,
  LatestDeploy,
} from "../types.js";
import { processMarkdownFile } from "./markdown.js";
import { ImageProcessor } from "../image/processor.js";
import { uploadDirectory, uploadFile } from "../output/r2.js";

const exec = promisify(execCallback);

/**
 * Run the complete build pipeline
 */
export async function runBuild(
  job: BuildJob,
  env: { GIT_CACHE_BUCKET: R2Bucket; OUTPUT_BUCKET: R2Bucket }
): Promise<BuildResult> {
  const startTime = Date.now();
  const workDir = `/tmp/build-${job.jobId}`;
  const repoDir = `${workDir}/repo`;
  const outputDir = `${workDir}/output`;

  const stats: BuildStats = {
    duration: 0,
    cacheHit: false,
    staleCommits: 0,
    filesProcessed: 0,
    imagesOptimized: 0,
    bundleSizeBytes: 0,
  };

  try {
    console.log(`Starting build for job: ${job.jobId}`);

    // Create work directories
    await fs.mkdir(workDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(`${outputDir}/content`, { recursive: true });
    await fs.mkdir(`${outputDir}/assets`, { recursive: true });

    // 1. Restore repo from cache or clone
    const gitCache = new GitCache({
      r2Bucket: env.GIT_CACHE_BUCKET,
      verbose: job.config.debug,
    });

    console.log(`Restoring repo for consumer: ${job.consumerId}`);
    const restoreResult = await gitCache.restore({
      consumerId: job.consumerId,
      repoUrl: job.repoUrl,
      branch: job.branch,
      targetPath: repoDir,
      auth: job.auth,
      commit: job.commit,
    });

    stats.cacheHit = restoreResult.hit;
    stats.staleCommits = restoreResult.staleCommits;
    const currentCommit = restoreResult.currentCommit;

    console.log(`Repo restored: cache=${stats.cacheHit}, stale=${stats.staleCommits}`);

    // 2. Find markdown files
    const contentGlobs = job.contentPaths.length > 0
      ? job.contentPaths.map((p) => `${repoDir}/${p}/**/*.md`)
      : [`${repoDir}/**/*.md`];

    const mdFiles: string[] = [];
    for (const pattern of contentGlobs) {
      const matches = await glob(pattern, {
        ignore: ["**/node_modules/**", "**/.git/**"],
      });
      mdFiles.push(...matches);
    }

    console.log(`Found ${mdFiles.length} markdown files`);

    // 3. Process markdown files
    const manifestFiles: ManifestFile[] = [];
    const searchIndexEntries: Array<{
      path: string;
      title: string;
      content: string;
    }> = [];

    for (const mdFile of mdFiles) {
      const relativePath = path.relative(repoDir, mdFile);
      const outputPath = relativePath.replace(/\.md$/, ".html");
      const outputFullPath = `${outputDir}/content/${outputPath}`;

      // Ensure directory exists
      await fs.mkdir(path.dirname(outputFullPath), { recursive: true });

      // Process markdown
      const result = await processMarkdownFile(mdFile, {
        minify: job.config.minifyHtml,
      });

      await fs.writeFile(outputFullPath, result.html);

      // Add to manifest
      const fileStats = await fs.stat(outputFullPath);
      const hash = crypto
        .createHash("md5")
        .update(result.html)
        .digest("hex")
        .slice(0, 8);

      manifestFiles.push({
        path: `content/${outputPath}`,
        type: "html",
        size: fileStats.size,
        hash,
        metadata: {
          title: result.title,
          description: result.description,
          frontmatter: result.frontmatter,
          sourcePath: relativePath,
        },
      });

      // Add to search index
      if (job.config.generateSearchIndex) {
        searchIndexEntries.push({
          path: `content/${outputPath}`,
          title: result.title ?? path.basename(mdFile, ".md"),
          content: result.plainText,
        });
      }

      stats.filesProcessed++;
    }

    console.log(`Processed ${stats.filesProcessed} markdown files`);

    // 4. Process images
    if (job.config.imageOptimization) {
      const imageProcessor = new ImageProcessor();

      // Find images in content directories
      const imageGlobs = job.contentPaths.length > 0
        ? job.contentPaths.flatMap((p) => [
            `${repoDir}/${p}/**/*.{jpg,jpeg,png,gif,webp}`,
            `${repoDir}/${p}/**/*.{JPG,JPEG,PNG,GIF,WEBP}`,
          ])
        : [
            `${repoDir}/**/*.{jpg,jpeg,png,gif,webp}`,
            `${repoDir}/**/*.{JPG,JPEG,PNG,GIF,WEBP}`,
          ];

      const imageFiles: string[] = [];
      for (const pattern of imageGlobs) {
        const matches = await glob(pattern, {
          ignore: ["**/node_modules/**", "**/.git/**"],
        });
        imageFiles.push(...matches);
      }

      console.log(`Found ${imageFiles.length} images to process`);

      for (const imgFile of imageFiles) {
        try {
          const relativePath = path.relative(repoDir, imgFile);
          const outputName = path.basename(relativePath, path.extname(relativePath));
          const outputPath = `assets/${outputName}.${job.config.outputFormat}`;
          const outputFullPath = `${outputDir}/${outputPath}`;

          await imageProcessor.optimizeFile(imgFile, outputFullPath, {
            maxWidth: job.config.imageMaxWidth,
            quality: job.config.imageQuality,
            format: job.config.outputFormat,
          });

          const fileStats = await fs.stat(outputFullPath);
          const content = await fs.readFile(outputFullPath);
          const hash = crypto
            .createHash("md5")
            .update(content)
            .digest("hex")
            .slice(0, 8);

          manifestFiles.push({
            path: outputPath,
            type: "image",
            size: fileStats.size,
            hash,
            metadata: { sourcePath: relativePath },
          });

          stats.imagesOptimized++;
        } catch (error) {
          console.warn(`Failed to process image ${imgFile}:`, error);
        }
      }

      console.log(`Optimized ${stats.imagesOptimized} images`);
    }

    // 5. Generate search index
    if (job.config.generateSearchIndex && searchIndexEntries.length > 0) {
      const searchIndex = JSON.stringify(searchIndexEntries);
      const searchIndexPath = `${outputDir}/search-index.json`;
      await fs.writeFile(searchIndexPath, searchIndex);

      const searchStats = await fs.stat(searchIndexPath);
      manifestFiles.push({
        path: "search-index.json",
        type: "json",
        size: searchStats.size,
        hash: crypto
          .createHash("md5")
          .update(searchIndex)
          .digest("hex")
          .slice(0, 8),
      });
    }

    // 6. Calculate bundle size
    const bundleSize = manifestFiles.reduce((sum, f) => sum + f.size, 0);
    stats.bundleSizeBytes = bundleSize;

    // 7. Create manifest
    stats.duration = Date.now() - startTime;

    const manifest: BundleManifest = {
      version: "1.0",
      generatedAt: new Date().toISOString(),
      commit: currentCommit,
      consumerId: job.consumerId,
      files: manifestFiles,
      searchIndex: job.config.generateSearchIndex ? "search-index.json" : undefined,
      stats,
    };

    const manifestJson = JSON.stringify(manifest, null, 2);
    await fs.writeFile(`${outputDir}/manifest.json`, manifestJson);

    // 8. Upload to R2
    const deployId = `${Date.now()}-${currentCommit.slice(0, 7)}`;
    const bundlePrefix = `${job.consumerId}/${deployId}`;

    console.log(`Uploading to R2: ${bundlePrefix}`);
    await uploadDirectory(env.OUTPUT_BUCKET, outputDir, bundlePrefix);

    // 9. Update latest pointer
    const latestDeploy: LatestDeploy = {
      deployId,
      commit: currentCommit,
      timestamp: new Date().toISOString(),
    };
    await uploadFile(
      env.OUTPUT_BUCKET,
      `${job.consumerId}/latest.json`,
      JSON.stringify(latestDeploy, null, 2),
      "application/json"
    );

    // 10. Save git cache (fire and forget)
    gitCache
      .save({
        consumerId: job.consumerId,
        repoPath: repoDir,
      })
      .catch((err: unknown) => console.warn("Failed to save git cache:", err));

    // 11. Cleanup
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});

    console.log(`Build completed in ${stats.duration}ms`);

    return {
      success: true,
      jobId: job.jobId,
      bundleUrl: `https://outputs.repo-md.com/${bundlePrefix}`,
      manifest,
      stats,
    };
  } catch (error) {
    console.error("Build failed:", error);

    // Cleanup on error
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});

    return {
      success: false,
      jobId: job.jobId,
      bundleUrl: "",
      manifest: {
        version: "1.0",
        generatedAt: new Date().toISOString(),
        commit: "",
        consumerId: job.consumerId,
        files: [],
        stats: { ...stats, duration: Date.now() - startTime },
      },
      stats: { ...stats, duration: Date.now() - startTime },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
