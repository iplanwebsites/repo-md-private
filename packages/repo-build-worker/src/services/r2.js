/**
 * r2.js - R2 storage interface using AWS SDK v3
 */

import {
  S3Client,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as generateSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import mime from "mime-types";
import { Readable } from "stream";

// Public URLs
export const R2_URL = "r2.repo.md";
export const PUBLIC_URL = "static.repo.md";

// Client instance
let client = null;
let bucketName = null;
let isInitialized = false;

// Initialize client from env vars
function initFromEnv() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      "Missing required environment variables for R2 initialization"
    );
  }

  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // Add this to prevent checksum issues with R2
    forcePathStyle: true,
  });

  isInitialized = true;
}

// Ensure client is initialized
function ensureInitialized() {
  if (!isInitialized) {
    initFromEnv();
  }
}

// Check if bucket exists
export async function bucketExists() {
  ensureInitialized();
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return true;
  } catch (error) {
    throw new Error(`Failed to check bucket existence: ${error.message}`);
  }
}

// List objects in the bucket
export async function listObjects(options = {}) {
  ensureInitialized();
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: options.prefix,
      MaxKeys: options.maxKeys,
    });

    const response = await client.send(command);
    return response.Contents || [];
  } catch (error) {
    throw new Error(`Failed to list objects: ${error.message}`);
  }
}

// Upload file to the bucket
export async function uploadFile(filePath, objectKey, options = {}) {
  ensureInitialized();
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Use filename if objectKey not provided
    if (!objectKey) {
      objectKey = path.basename(filePath);
    }

    // Prepare content-type
    const contentType =
      options.contentType ||
      mime.lookup(filePath) ||
      "application/octet-stream";

    // Sanitize metadata
    const metadata = sanitizeMetadata(options.metadata);

    try {
      const fileContent = await fs.promises.readFile(filePath);

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: fileContent,
        ContentType: contentType,
        Metadata: metadata,
      });

      const result = await client.send(command);

      return {
        objectKey,
        etag: result.ETag,
        publicUrl: `https://${R2_URL}/${objectKey}`,
      };
    } catch (error) {
      // If metadata is causing issues, retry without it
      if (
        error.message.includes("trim is not a function") ||
        error.name === "InvalidArgument"
      ) {
        console.log(`🔄 Retrying ${objectKey} without metadata`);

        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          Body: await fs.promises.readFile(filePath),
          ContentType: contentType,
        });

        const result = await client.send(command);

        return {
          objectKey,
          etag: result.ETag,
          publicUrl: `https://${R2_URL}/${objectKey}`,
          metadataApplied: false,
        };
      }

      throw error;
    }
  } catch (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

// Upload content to the bucket
export async function upload(content, objectKey, options = {}) {
  ensureInitialized();
  try {
    if (!objectKey) {
      throw new Error("Object key is required");
    }

    // Prepare content
    let body = content;
    if (typeof content === "string") {
      body = Buffer.from(content);
    }

    // Prepare content-type
    const contentType = options.contentType || "application/octet-stream";

    // Sanitize metadata
    const metadata = sanitizeMetadata(options.metadata);

    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      });

      const result = await client.send(command);

      return {
        objectKey,
        etag: result.ETag,
        publicUrl: `https://${R2_URL}/${objectKey}`,
      };
    } catch (error) {
      // If metadata is causing issues, retry without it
      if (
        error.message.includes("trim is not a function") ||
        error.name === "InvalidArgument"
      ) {
        console.log(`🔄 Retrying ${objectKey} without metadata`);

        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          Body: body,
          ContentType: contentType,
        });

        const result = await client.send(command);

        return {
          objectKey,
          etag: result.ETag,
          publicUrl: `https://${R2_URL}/${objectKey}`,
          metadataApplied: false,
        };
      }

      throw error;
    }
  } catch (error) {
    throw new Error(`Failed to upload content: ${error.message}`);
  }
}

// Upload stream to the bucket
export async function uploadStream(stream, objectKey, options = {}) {
  ensureInitialized();
  try {
    if (!objectKey) {
      throw new Error("Object key is required");
    }

    // Validate stream
    if (!(stream instanceof Readable)) {
      throw new Error("Stream must be a readable stream");
    }

    // Convert stream to buffer (AWS SDK v3 doesn't have direct stream upload)
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Use upload function with buffer
    return await upload(buffer, objectKey, options);
  } catch (error) {
    throw new Error(`Failed to upload stream: ${error.message}`);
  }
}

// Download object from the bucket
export async function download(objectKey, localFilePath = null) {
  ensureInitialized();
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });

    const response = await client.send(command);

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Save to file if path provided
    if (localFilePath) {
      await fs.promises.writeFile(localFilePath, buffer);
      return;
    }

    // Return buffer otherwise
    return buffer;
  } catch (error) {
    throw new Error(`Failed to download object: ${error.message}`);
  }
}

// Delete object from the bucket
export async function deleteObject(objectKey) {
  ensureInitialized();
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });

    await client.send(command);
    return true;
  } catch (error) {
    throw new Error(`Failed to delete object: ${error.message}`);
  }
}

// Get signed URL for object
export async function getSignedUrl(objectKey, expiresIn = 3600) {
  ensureInitialized();
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });

    return await generateSignedUrl(client, command, { expiresIn });
  } catch (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
}

// Get object metadata
export async function getMetadata(objectKey) {
  ensureInitialized();
  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });

    return await client.send(command);
  } catch (error) {
    throw new Error(`Failed to get object metadata: ${error.message}`);
  }
}

// Check if object exists
export async function objectExists(objectKey) {
  ensureInitialized();
  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });

    await client.send(command);
    return true;
  } catch (error) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw new Error(`Failed to check if object exists: ${error.message}`);
  }
}

// Get public URL for object
export function getPublicUrl(objectKey) {
  return `https://${R2_URL}/${objectKey}`;
}

// Helper to sanitize metadata
function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  const sanitized = {};

  Object.keys(metadata).forEach((key) => {
    if (typeof key !== "string") return;

    const value = metadata[key];
    if (value === undefined || value === null) return;

    // Convert all values to strings
    sanitized[key] = String(value);
  });

  return sanitized;
}
