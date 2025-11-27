#!/usr/bin/env node
/**
 * A simple script to upload a random text file to Cloudflare R2 storage
 *
 * Usage:
 *   node uploadTextToR2.js <file-path> [object-key]
 *
 * Example:
 *   node uploadTextToR2.js ./example.txt my-folder/example.txt
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { uploadFile, getPublicUrl } from "../src/services/r2.js";

// Load environment variables from .env file
dotenv.config();

// Validate arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Error: Missing file path argument");
  console.error("Usage: node uploadTextToR2.js <file-path> [object-key]");
  process.exit(1);
}

// Get file path and object key from command line arguments
const filePath = args[0];
let objectKey = args[1];

// If object key is not provided, use the filename
if (!objectKey) {
  objectKey = path.basename(filePath);
}

// Validate that the file exists and is a text file
if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}

// Check if file is a text file by reading a few bytes
try {
  const fileHandle = fs.openSync(filePath, "r");
  const buffer = Buffer.alloc(1024);
  fs.readSync(fileHandle, buffer, 0, 1024, 0);
  fs.closeSync(fileHandle);

  // Check if buffer contains non-printable characters (crude text check)
  // This is not a perfect test but good enough for a simple script
  const isTextFile = !buffer
    .slice(0, buffer.indexOf(0) === -1 ? 1024 : buffer.indexOf(0))
    .some((b) => (b < 9 || (b > 13 && b < 32)) && b !== 0);

  if (!isTextFile) {
    console.warn(
      "Warning: File does not appear to be a text file. Continuing anyway."
    );
  }
} catch (error) {
  console.error(`Error checking file type: ${error.message}`);
  process.exit(1);
}

// Upload the file
async function run() {
  try {
    console.log(`Uploading ${filePath} to R2 as ${objectKey}...`);

    // Upload file with text/plain content type for text files
    const result = await uploadFile(filePath, objectKey, {
      contentType: "text/plain",
    });

    console.log("Upload successful!");
    console.log(`File URL: ${result.publicUrl}`);

    // Also show the public URL using the getPublicUrl helper
    const publicUrl = getPublicUrl(objectKey);
    console.log(`Public URL: ${publicUrl}`);
  } catch (error) {
    console.error(`Upload failed: ${error.message}`);

    // Check if error is related to missing environment variables
    if (error.message.includes("Missing required environment variables")) {
      console.error("\nMake sure the following environment variables are set:");
      console.error("- R2_ACCOUNT_ID");
      console.error("- R2_ACCESS_KEY_ID");
      console.error("- R2_SECRET_ACCESS_KEY");
      console.error("- R2_BUCKET_NAME");
    }

    process.exit(1);
  }
}

run();
