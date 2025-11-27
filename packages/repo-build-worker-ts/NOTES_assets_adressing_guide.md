we'll need to implement assets publishing │
│ strategy that work with adressing.

They are all immutable assets (blog post + medias + json and db). we'll refference them properly by names.

HMMM let me clarify. This is getting messy to preview an old release on it's dedicated domain. How do we handle the link to assets.
Paths in use in the API clients, they'll consume this.
/workerstatic/org/proj/medias/:hash.jpg - use the key!
/workerstatic/org/proj/posts/:hash.json - use the key directly from the store
/workerstatic/org/proj/assets-map.json - don't use the key, check current project revisisons
/workerstatic/org/proj/content.db - dont use key

Based on the domain name, we will load the right assets name

Here's the REAL structure of assets on r2

```
/org/proj
- _shared
    posts
        hash.json
    medias
        hash.jpg
- version
    v4 (latest)
        assets.json
        content.json
    v3
        assets.json
        content.json
```

The md5 (or sha) need to happen in the image processor, very early on, so we can figure quickly which image we already have. We'll match the list of md5 of assets against what we have on R2 (we'll fetch that early). We'll still clone everything locally first. But there's no point re-rendering image file that are already compressed + hosted on r2. We always use the original filename for md5, not the multiple version for compression.

.
.
.
.

..
.
.

# R2 Content-Addressed Storage Implementation Guide

This guide provides detailed implementation instructions for a content-addressed storage system using Cloudflare R2. The system consists of two main components:

1. **Build Worker**: Processes new site builds, deduplicates assets, and uploads only new files
2. **Request Handler Worker**: Routes requests to the correct content-addressed locations

## Part 1: Build Worker Implementation

The Build Worker processes site builds and uploads assets to R2 in a content-addressed format.

### Configuration

```javascript
// config.js
export const CONFIG = {
  R2_BUCKET: "your-r2-bucket-name",
  SHARED_MEDIA_PREFIX: "_shared/media/",
  SITES_PREFIX: "sites/",
  HASH_ALGORITHM: "md5", // or 'sha256'
  HASH_PREFIX_LENGTH: 2, // Using first 2 chars for directory sharding
};
```

### Build Worker Core Functions

```javascript
// build-worker.js
import { CONFIG } from "./config.js";

// Main function to process a site build
export async function processSiteBuild(env, siteName, version, buildDirectory) {
  console.log(`Processing build for ${siteName} version ${version}`);

  // 1. Get the list of existing content hashes
  const existingHashes = await getExistingHashes(env.R2_BUCKET);

  // 2. Process all files in the build directory
  const fileResults = await processAllFiles(
    env.R2_BUCKET,
    buildDirectory,
    existingHashes
  );

  // 3. Create and upload the version manifest (for recovery purposes)
  await createVersionManifest(env.R2_BUCKET, siteName, version, fileResults);

  // 4. Update the site index to point to the new version
  await updateSiteIndex(env.R2_BUCKET, siteName, version);

  return {
    totalFiles: fileResults.length,
    newFiles: fileResults.filter((r) => r.isNew).length,
    reusedFiles: fileResults.filter((r) => !r.isNew).length,
    totalBytes: fileResults.reduce((sum, r) => sum + r.size, 0),
    newBytes: fileResults
      .filter((r) => r.isNew)
      .reduce((sum, r) => sum + r.size, 0),
  };
}

// Get list of all existing content-addressed files
async function getExistingHashes(bucket) {
  const existingHashes = new Set();
  let cursor = null;

  do {
    const options = {
      prefix: CONFIG.SHARED_MEDIA_PREFIX,
      delimiter: "/",
      cursor,
    };

    const listing = await bucket.list(options);
    cursor = listing.cursor;

    for (const object of listing.objects) {
      // Extract hash from the path
      const pathParts = object.key.split("/");
      const filename = pathParts[pathParts.length - 1];
      const hash = filename.split(".")[0]; // Remove extension
      existingHashes.add(hash);
    }
  } while (cursor);

  console.log(`Found ${existingHashes.size} existing content-addressed files`);
  return existingHashes;
}

// Process all files in the build directory
async function processAllFiles(bucket, buildDirectory, existingHashes) {
  const results = [];

  // Here you would implement a way to iterate through all files in the build directory
  // For example, recursively scan the directory or use a glob pattern
  const filesToProcess = await getAllFilesInBuild(buildDirectory);

  for (const file of filesToProcess) {
    const result = await processFile(bucket, file, existingHashes);
    results.push(result);
  }

  return results;
}

// Process a single file
async function processFile(bucket, fileInfo, existingHashes) {
  const { filePath, relativePath } = fileInfo;

  // 1. Calculate file hash
  const fileContent = await readFile(filePath);
  const contentHash = calculateHash(fileContent);

  // 2. Determine file extension and mime type
  const extension = getFileExtension(filePath);
  const mimeType = getMimeType(extension);

  // 3. Determine the shared storage path with hash prefix for sharding
  const hashPrefix = contentHash.substring(0, CONFIG.HASH_PREFIX_LENGTH);
  const sharedPath = `${CONFIG.SHARED_MEDIA_PREFIX}${hashPrefix}/${contentHash}.${extension}`;

  // 4. Check if file already exists in R2 by its hash
  let isNew = !existingHashes.has(contentHash);

  // 5. Upload file if it's new
  if (isNew) {
    await bucket.put(sharedPath, fileContent, {
      httpMetadata: {
        contentType: mimeType,
      },
    });
    console.log(`Uploaded new file: ${sharedPath}`);
  } else {
    console.log(`Reusing existing file: ${sharedPath}`);
  }

  // 6. Return result for manifest creation
  return {
    originalPath: relativePath,
    contentHash,
    extension,
    mimeType,
    sharedPath,
    size: fileContent.byteLength,
    isNew,
  };
}

// Create and upload the version manifest
async function createVersionManifest(bucket, siteName, version, fileResults) {
  // Create a manifest that maps original paths to content hashes
  const manifest = {
    site: siteName,
    version,
    createdAt: new Date().toISOString(),
    assets: fileResults.map((result) => ({
      originalPath: result.originalPath,
      contentHash: result.contentHash,
      extension: result.extension,
      size: result.size,
      mimeType: result.mimeType,
    })),
  };

  // Upload the manifest to R2
  const manifestPath = `${CONFIG.SITES_PREFIX}${siteName}/${version}/asset-manifest.json`;
  await bucket.put(manifestPath, JSON.stringify(manifest, null, 2), {
    httpMetadata: {
      contentType: "application/json",
    },
  });

  console.log(`Created version manifest: ${manifestPath}`);
}

// Update the site index to point to the new version
async function updateSiteIndex(bucket, siteName, version) {
  // Create/update the site index
  const siteIndex = {
    site: siteName,
    currentVersion: version,
    updatedAt: new Date().toISOString(),
  };

  // Upload the site index
  const indexPath = `${CONFIG.SITES_PREFIX}${siteName}/index.json`;
  await bucket.put(indexPath, JSON.stringify(siteIndex, null, 2), {
    httpMetadata: {
      contentType: "application/json",
    },
  });

  // Create a redirect HTML file pointing to the latest version
  const redirectHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0;url=/${CONFIG.SITES_PREFIX}${siteName}/${version}/index.html">
  <title>Redirecting...</title>
</head>
<body>
  Redirecting to the latest version...
</body>
</html>
`;

  const redirectPath = `${CONFIG.SITES_PREFIX}${siteName}/index.html`;
  await bucket.put(redirectPath, redirectHtml, {
    httpMetadata: {
      contentType: "text/html",
    },
  });

  console.log(`Updated site index for ${siteName} to point to ${version}`);
}

// Helper function to calculate file hash
function calculateHash(content) {
  if (CONFIG.HASH_ALGORITHM === "md5") {
    return md5(content);
  } else if (CONFIG.HASH_ALGORITHM === "sha256") {
    return sha256(content);
  }
  // Implement appropriate hash function
}
```

### Additional Helper Functions

```javascript
// helpers.js

// Get all files in build directory recursively
export async function getAllFilesInBuild(directory) {
  // Implementation depends on your environment
  // In Node.js you would use fs.readdir recursively
  // In a Worker environment, you might receive this list from another source
}

// Read file contents
export async function readFile(path) {
  // Implementation depends on your environment
}

// Get file extension
export function getFileExtension(path) {
  return path.split(".").pop().toLowerCase();
}

// Get MIME type based on extension
export function getMimeType(extension) {
  const types = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    pdf: "application/pdf",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    html: "text/html",
    txt: "text/plain",
    xml: "application/xml",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    eot: "application/vnd.ms-fontobject",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
  };

  return types[extension.toLowerCase()] || "application/octet-stream";
}

// MD5 hash implementation
export function md5(content) {
  // Implementation depends on your environment
  // In Node.js: crypto.createHash('md5').update(content).digest('hex')
  // In a Worker: Use Web Crypto API
}
```

### Build Worker Entry Point (Cloudflare Worker)

```javascript
// index.js for Build Worker
import { processSiteBuild } from "./build-worker.js";

export default {
  async fetch(request, env) {
    // This would be triggered by your CI/CD pipeline
    try {
      const url = new URL(request.url);

      // Expecting a POST request with build info
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      // Parse the JSON body
      const buildInfo = await request.json();

      // Validate required fields
      if (
        !buildInfo.siteName ||
        !buildInfo.version ||
        !buildInfo.buildFilesZip
      ) {
        return new Response(
          "Missing required fields: siteName, version, buildFilesZip",
          {
            status: 400,
          }
        );
      }

      // In a real implementation, the build files would be uploaded as a ZIP
      // or accessed from another storage location
      const buildDirectory = await extractBuildFiles(buildInfo.buildFilesZip);

      // Process the build
      const result = await processSiteBuild(
        env,
        buildInfo.siteName,
        buildInfo.version,
        buildDirectory
      );

      // Return the result
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Build error:", error);
      return new Response(`Build error: ${error.message}`, { status: 500 });
    }
  },
};

// Helper to extract build files from uploaded ZIP
async function extractBuildFiles(zipFileData) {
  // Implementation depends on your environment
  // This could unzip files to a temporary location or process them in memory
}
```

## Part 2: Request Handler Worker Implementation

The Request Handler Worker routes incoming requests to the correct content-addressed locations.

### Request Handler Core Functions

```javascript
// request-handler.js
import { CONFIG } from "./config.js";

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Check if this is a request for a versioned asset with a content hash in the path
    // Format: /sites/{site}/{version}/assets/{contentHash}.{ext}
    const assetPattern = new RegExp(
      `^/${CONFIG.SITES_PREFIX}([^/]+)/([^/]+)/assets/([a-f0-9]+)\\.([a-z0-9]+)$`,
      "i"
    );

    const match = path.match(assetPattern);

    if (match) {
      // Extract parts from the URL
      const [, siteName, version, contentHash, extension] = match;

      // Calculate the shared storage path
      const hashPrefix = contentHash.substring(0, CONFIG.HASH_PREFIX_LENGTH);
      const sharedPath = `${CONFIG.SHARED_MEDIA_PREFIX}${hashPrefix}/${contentHash}.${extension}`;

      // Get the object from R2
      const object = await env.R2_BUCKET.get(sharedPath);

      if (!object) {
        return new Response("Asset not found", { status: 404 });
      }

      // Determine content type
      const contentType =
        object.httpMetadata?.contentType || getMimeType(extension);

      // Return the object with appropriate headers
      return new Response(object.body, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable", // Cache for 1 year
          ETag: object.etag || `"${contentHash}"`,
        },
      });
    }

    // For non-asset files, serve directly from their path
    // For example, HTML files, site index, etc.
    const object = await env.R2_BUCKET.get(path.substring(1)); // Remove leading slash

    if (!object) {
      return new Response("Not found", { status: 404 });
    }

    // Determine appropriate caching based on file type
    let cacheControl = "public, max-age=3600"; // Default 1 hour cache

    // Adjust cache time based on file type
    if (path.endsWith(".html")) {
      cacheControl = "public, max-age=600"; // 10 minutes for HTML
    } else if (path.endsWith(".css") || path.endsWith(".js")) {
      cacheControl = "public, max-age=86400"; // 1 day for CSS/JS
    }

    return new Response(object.body, {
      headers: {
        "Content-Type":
          object.httpMetadata?.contentType || "application/octet-stream",
        "Cache-Control": cacheControl,
        ETag: object.etag,
      },
    });
  } catch (error) {
    console.error("Request error:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

// Import the MIME type helper from the helpers.js file
import { getMimeType } from "./helpers.js";
```

### Request Handler Entry Point (Cloudflare Worker)

```javascript
// index.js for Request Handler Worker
import { handleRequest } from "./request-handler.js";

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};
```

### Configuring the Request Handler Worker

Create a `wrangler.toml` file for the Request Handler Worker:

```toml
name = "r2-asset-handler"
main = "src/index.js"
compatibility_date = "2023-05-18"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "your-r2-bucket"
```

## Deployment and Usage

### Setting Up the Build Worker

1. Set up an API endpoint that triggers your build process
2. Configure your CI/CD pipeline to send build artifacts to this endpoint
3. Deploy the Build Worker to Cloudflare

### Setting Up the Request Handler Worker

1. Deploy the Request Handler Worker to Cloudflare
2. Configure your domain to route through this Worker
3. Set up any additional security or caching rules as needed

### Usage Flow

1. **Development/Build Process**:

   - Build your site locally or in CI/CD
   - Deploy to R2 via the Build Worker API
   - Worker automatically deduplicates assets and tracks versions

2. **Serving Content**:

   - User requests come to the Request Handler Worker
   - Worker rewrites paths to content-addressed locations
   - Assets are served with appropriate caching headers

3. **Version Management**:
   - Update the site index manually or via the Build Worker
   - Old versions remain accessible at their specific URLs
   - Assets are shared across versions to save storage

## Maintenance Operations

### Purging Old Versions

To purge an old version, you would:

1. Identify all assets uniquely used by that version (via the manifest)
2. Remove the version directory and its manifest
3. Optionally clean up orphaned assets in the shared directory

This requires a separate utility function not included in this guide.

### Storage Analysis

To analyze storage usage, you can:

1. List all objects in the R2 bucket
2. Parse the manifests to identify which assets are used by which versions
3. Calculate storage usage and savings from deduplication

## Security Considerations

1. **Access Control**: Ensure the Build Worker API is properly secured
2. **Content Validation**: Validate uploaded files to prevent malicious content
3. **Request Rate Limiting**: Implement rate limiting on the Request Handler Worker
4. **Path Traversal Protection**: Validate paths to prevent directory traversal attacks

## Troubleshooting

### Common Issues

1. **Missing Assets**: Check if the content hash calculation is consistent
2. **Incorrect MIME Types**: Verify the MIME type mapping in the helper functions
3. **Cache Issues**: Use different URLs for updated content (the content hash ensures this)

### Debugging

1. Log the before/after paths in the Request Handler Worker
2. Verify that assets exist in R2 at the expected content-addressed locations
3. Check the version manifests to ensure paths are correctly mapped
