/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

/**
 * r2.js - A simplified interface for Cloudflare R2 storage
 * Exports individual utility functions for working with Cloudflare R2
 * Auto-initializes on first use with environment variables
 */

import { R2 as CloudflareR2 } from "node-cloudflare-r2";
import fs from "fs";
import path from "path";
import mime from "mime-types";

// Public URL for the R2 bucket
export const PUBLIC_URL = "r2.repo.md";

// R2 client and bucket instances
let client = null;
let bucket = null;
let isInitialized = false;

/**
 * Initialize the R2 client with account credentials from environment variables
 * Called automatically on first use of any function
 *
 * Required environment variables:
 * - R2_ACCOUNT_ID
 * - R2_ACCESS_KEY_ID
 * - R2_SECRET_ACCESS_KEY
 * - R2_BUCKET_NAME
 *
 * @returns {void}
 */
function initFromEnv() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      "Missing required environment variables for R2 initialization"
    );
  }

  client = new CloudflareR2({
    accountId,
    accessKeyId,
    secretAccessKey,
  });

  bucket = client.bucket(bucketName);

  // Set the public URL
  bucket.provideBucketPublicUrl(`https://${PUBLIC_URL}`);
  isInitialized = true;
}

/**
 * Ensures the R2 client is initialized before use
 * @private
 */
function ensureInitialized() {
  if (!isInitialized) {
    initFromEnv();
  }
}

/**
 * Checks if the bucket exists
 *
 * @returns {Promise<boolean>} - True if the bucket exists
 */
export async function bucketExists() {
  ensureInitialized();
  try {
    return await bucket.exists();
  } catch (error) {
    throw new Error(`Failed to check bucket existence: ${error.message}`);
  }
}

/**
 * Lists all objects in the bucket
 *
 * @param {Object} options - List options
 * @param {string} [options.prefix] - Filter objects by prefix
 * @param {number} [options.maxKeys] - Maximum number of keys to return
 * @returns {Promise<Array>} - Array of objects
 */
export async function listObjects(options = {}) {
  ensureInitialized();
  try {
    const listResult = await bucket.list(options);
    return listResult.objects || [];
  } catch (error) {
    throw new Error(`Failed to list objects: ${error.message}`);
  }
}

/**
 * Uploads a file to the bucket
 *
 * @param {string} filePath - Path to the local file
 * @param {string} [objectKey] - Key to use for the object (defaults to filename)
 * @param {Object} [options] - Upload options
 * @param {Object} [options.metadata] - Custom metadata
 * @param {string} [options.contentType] - Content type
 * @returns {Promise<Object>} - Upload result with publicUrl
 */
export async function uploadFile(filePath, objectKey, options = {}) {
  ensureInitialized();
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Use the filename if objectKey is not provided
    if (!objectKey) {
      objectKey = path.basename(filePath);
    }

    // Auto-detect content type if not specified
    let uploadOptions = { ...options };
    if (!uploadOptions.contentType) {
      uploadOptions.contentType =
        mime.lookup(filePath) || "application/octet-stream";
    }

    const result = await bucket.uploadFile(filePath, objectKey, uploadOptions);
    return {
      ...result,
      publicUrl: `https://${PUBLIC_URL}/${objectKey}`,
    };
  } catch (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Uploads content to the bucket
 *
 * @param {string|Buffer|ReadableStream} content - Content to upload
 * @param {string} objectKey - Key to use for the object
 * @param {Object} [options] - Upload options
 * @param {Object} [options.metadata] - Custom metadata
 * @param {string} [options.contentType] - Content type
 * @returns {Promise<Object>} - Upload result with publicUrl
 */
export async function upload(content, objectKey, options = {}) {
  ensureInitialized();
  try {
    if (!objectKey) {
      throw new Error("Object key is required");
    }

    const result = await bucket.upload(content, objectKey, options);
    return {
      ...result,
      publicUrl: `https://${PUBLIC_URL}/${objectKey}`,
    };
  } catch (error) {
    throw new Error(`Failed to upload content: ${error.message}`);
  }
}

/**
 * Uploads a stream to the bucket
 *
 * @param {ReadableStream} stream - Stream to upload
 * @param {string} objectKey - Key to use for the object
 * @param {Object} [options] - Upload options
 * @returns {Promise<Object>} - Upload result with publicUrl
 */
export async function uploadStream(stream, objectKey, options = {}) {
  ensureInitialized();
  try {
    if (!objectKey) {
      throw new Error("Object key is required");
    }

    const result = await bucket.uploadStream(stream, objectKey, options);
    return {
      ...result,
      publicUrl: `https://${PUBLIC_URL}/${objectKey}`,
    };
  } catch (error) {
    throw new Error(`Failed to upload stream: ${error.message}`);
  }
}

/**
 * Downloads an object from the bucket
 *
 * @param {string} objectKey - Key of the object to download
 * @param {string} [localFilePath] - Path to save the downloaded file (optional)
 * @returns {Promise<Buffer|void>} - Object data as Buffer if localFilePath is not provided
 */
export async function download(objectKey, localFilePath = null) {
  ensureInitialized();
  try {
    const object = await bucket.get(objectKey);

    if (!object) {
      throw new Error(`Object not found: ${objectKey}`);
    }

    // If localFilePath is provided, save the file locally
    if (localFilePath) {
      await fs.promises.writeFile(localFilePath, object.body);
      return;
    }

    // Otherwise, return the object data
    return object.body;
  } catch (error) {
    throw new Error(`Failed to download object: ${error.message}`);
  }
}

/**
 * Deletes an object from the bucket
 *
 * @param {string} objectKey - Key of the object to delete
 * @returns {Promise<boolean>} - True if the object was deleted
 */
export async function deleteObject(objectKey) {
  ensureInitialized();
  try {
    await bucket.delete(objectKey);
    return true;
  } catch (error) {
    throw new Error(`Failed to delete object: ${error.message}`);
  }
}

/**
 * Gets a signed URL for an object
 *
 * @param {string} objectKey - Key of the object
 * @param {number} [expiresIn=3600] - Expiration time in seconds
 * @returns {Promise<string>} - Signed URL
 */
export async function getSignedUrl(objectKey, expiresIn = 3600) {
  ensureInitialized();
  try {
    return await bucket.getObjectSignedUrl(objectKey, expiresIn);
  } catch (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
}

/**
 * Gets metadata for an object
 *
 * @param {string} objectKey - Key of the object
 * @returns {Promise<Object>} - Object metadata
 */
export async function getMetadata(objectKey) {
  ensureInitialized();
  try {
    const headObject = await bucket.head(objectKey);
    return headObject;
  } catch (error) {
    throw new Error(`Failed to get object metadata: ${error.message}`);
  }
}

/**
 * Checks if an object exists in the bucket
 *
 * @param {string} objectKey - Key of the object
 * @returns {Promise<boolean>} - True if the object exists
 */
export async function objectExists(objectKey) {
  ensureInitialized();
  try {
    const headObject = await bucket.head(objectKey);
    return !!headObject;
  } catch (error) {
    if (error.name === "NoSuchKey" || error.code === "NoSuchKey") {
      return false;
    }
    throw new Error(`Failed to check if object exists: ${error.message}`);
  }
}

/**
 * Gets the public URL for an object
 *
 * @param {string} objectKey - Key of the object
 * @returns {string} - Public URL
 */
export function getPublicUrl(objectKey) {
  return `https://${PUBLIC_URL}/${objectKey}`;
}
