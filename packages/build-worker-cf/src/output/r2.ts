/**
 * R2 Output Utilities
 * @module @repo-md/build-worker-cf
 */

import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";
import mime from "mime-types";

/**
 * Upload a single file to R2
 */
export async function uploadFile(
  bucket: R2Bucket,
  key: string,
  content: string | Uint8Array | ArrayBuffer,
  contentType?: string
): Promise<void> {
  const mimeType = contentType ?? "application/octet-stream";

  await bucket.put(key, content, {
    httpMetadata: {
      contentType: mimeType,
    },
  });
}

/**
 * Upload a directory to R2
 */
export async function uploadDirectory(
  bucket: R2Bucket,
  localPath: string,
  prefix: string
): Promise<number> {
  // Find all files in directory
  const files = await glob("**/*", {
    cwd: localPath,
    nodir: true,
  });

  let uploadedCount = 0;

  // Upload files in parallel batches
  const batchSize = 10;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (file) => {
        const localFilePath = path.join(localPath, file);
        const r2Key = `${prefix}/${file}`;
        const contentType = mime.lookup(file) || "application/octet-stream";

        try {
          const content = await fs.readFile(localFilePath);
          await bucket.put(r2Key, content, {
            httpMetadata: {
              contentType,
            },
          });
          uploadedCount++;
        } catch (error) {
          console.error(`Failed to upload ${file}:`, error);
          throw error;
        }
      })
    );
  }

  return uploadedCount;
}

/**
 * Check if a file exists in R2
 */
export async function fileExists(
  bucket: R2Bucket,
  key: string
): Promise<boolean> {
  const object = await bucket.head(key);
  return object !== null;
}

/**
 * Get file from R2
 */
export async function getFile(
  bucket: R2Bucket,
  key: string
): Promise<ArrayBuffer | null> {
  const object = await bucket.get(key);
  if (!object) return null;
  return object.arrayBuffer();
}

/**
 * Delete a file from R2
 */
export async function deleteFile(
  bucket: R2Bucket,
  key: string
): Promise<void> {
  await bucket.delete(key);
}

/**
 * List files in R2 with a prefix
 */
export async function listFiles(
  bucket: R2Bucket,
  prefix: string
): Promise<string[]> {
  const listed = await bucket.list({ prefix });
  return listed.objects.map((obj) => obj.key);
}

/**
 * Delete all files with a prefix
 */
export async function deletePrefix(
  bucket: R2Bucket,
  prefix: string
): Promise<number> {
  const files = await listFiles(bucket, prefix);

  // Delete in batches
  const batchSize = 10;
  let deletedCount = 0;

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await Promise.all(batch.map((key) => bucket.delete(key)));
    deletedCount += batch.length;
  }

  return deletedCount;
}
