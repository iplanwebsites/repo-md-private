# Comprehensive Plan for Vector Embedding Cache and KNN Search Worker

we'll refine and execute this complete plan for developing a Cloudflare Worker that handles both embedding caching and KNN search functionality for blog posts.

## 1. Worker Architecture Overview

The worker will serve multiple functions:

- Managing the embedding cache (reading/writing to R2)
- Generating new embeddings for posts
- Performing KNN searches
- Filtering embeddings for specific project revisions

### Path Structure

- `r2Bucket/projects/:id/_shared/vectors/posts-embeddings.json` - Master embedding cache
- `r2Bucket/projects/:id/:revId/posts.json` - Active posts for a specific revision
- `r2Bucket/projects/:id/:revId/post-embeddings2.json` - Filtered embeddings for active posts

## 2. API Endpoints

```
POST /api/embeddings/update-cache
GET /api/search/similar/:postHash
POST /api/search/text
POST /api/compile-active-embeddings
```

## 3. Implementation Plan

### A. Worker Setup

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route requests to appropriate handlers
    if (path.startsWith("/api/embeddings/update-cache")) {
      return handleUpdateCache(request, env);
    } else if (path.startsWith("/api/search/similar/")) {
      return handleSimilarSearch(request, env);
    } else if (path.startsWith("/api/search/text")) {
      return handleTextSearch(request, env);
    } else if (path.startsWith("/api/compile-active-embeddings")) {
      return handleCompileActiveEmbeddings(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};
```

### B. Embedding Cache Management

```javascript
async function handleUpdateCache(request, env) {
  try {
    // Parse request for project ID and new posts
    const { projectId, posts } = await request.json();

    // Path to the master embedding cache
    const cachePath = `projects/${projectId}/_shared/vectors/posts-embeddings.json`;

    // Fetch existing cache
    const cacheObject = await env.R2_BUCKET.get(cachePath);
    let cache = cacheObject ? await cacheObject.json() : {};

    // Track which posts need new embeddings
    const newPosts = posts.filter((post) => !cache[post.hash]);
    const updatedHashes = [];

    // Generate embeddings for new posts
    for (const post of newPosts) {
      // Call embedding model API (implementation details below)
      const vector = await generateEmbedding(post.content);

      cache[post.hash] = {
        vector,
        title: post.title,
        contentHash: post.contentHash,
        lastUpdated: Date.now(),
        modelVersion: "text-embedding-ada-002", // or your model version
      };

      updatedHashes.push(post.hash);
    }

    // Save updated cache back to R2
    await env.R2_BUCKET.put(cachePath, JSON.stringify(cache));

    return new Response(
      JSON.stringify({
        success: true,
        updatedPosts: updatedHashes.length,
        totalCachedPosts: Object.keys(cache).length,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
```

### C. KNN Search Implementation

```javascript
async function handleSimilarSearch(request, env) {
  try {
    // Extract parameters
    const url = new URL(request.url);
    const postHash = url.pathname.split("/").pop();
    const {
      projectId,
      revId,
      limit = 5,
    } = Object.fromEntries(url.searchParams);

    // First, try to use the revision-specific embeddings if available
    const revisionEmbeddingsPath = `projects/${projectId}/${revId}/post-embeddings2.json`;
    let embeddingsObject = await env.R2_BUCKET.get(revisionEmbeddingsPath);

    // Fall back to master cache if revision-specific file doesn't exist
    if (!embeddingsObject) {
      const masterCachePath = `projects/${projectId}/_shared/vectors/posts-embeddings.json`;
      embeddingsObject = await env.R2_BUCKET.get(masterCachePath);
    }

    if (!embeddingsObject) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Embedding cache not found",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const embeddings = await embeddingsObject.json();

    // Get the source embedding
    const sourceEmbedding = embeddings[postHash]?.vector;
    if (!sourceEmbedding) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Source post embedding not found",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Perform KNN search
    const results = performKnnSearch(
      embeddings,
      sourceEmbedding,
      postHash,
      limit
    );

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function handleTextSearch(request, env) {
  try {
    // Parse request
    const { projectId, revId, query, limit = 5 } = await request.json();

    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query);

    // Use revision-specific embeddings if available
    const revisionEmbeddingsPath = `projects/${projectId}/${revId}/post-embeddings2.json`;
    let embeddingsObject = await env.R2_BUCKET.get(revisionEmbeddingsPath);

    // Fall back to master cache if needed
    if (!embeddingsObject) {
      const masterCachePath = `projects/${projectId}/_shared/vectors/posts-embeddings.json`;
      embeddingsObject = await env.R2_BUCKET.get(masterCachePath);
    }

    if (!embeddingsObject) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Embedding cache not found",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const embeddings = await embeddingsObject.json();

    // Perform KNN search against query embedding
    const results = performKnnSearch(embeddings, queryEmbedding, null, limit);

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
```

### D. Compile Active Embeddings for a Revision

```javascript
async function handleCompileActiveEmbeddings(request, env) {
  try {
    // Parse request
    const { projectId, revId } = await request.json();

    // Path to active posts for this revision
    const postsPath = `projects/${projectId}/${revId}/posts.json`;

    // Path to master embedding cache
    const cachePath = `projects/${projectId}/_shared/vectors/posts-embeddings.json`;

    // Fetch active posts
    const postsObject = await env.R2_BUCKET.get(postsPath);
    if (!postsObject) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Active posts not found",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Fetch master embedding cache
    const cacheObject = await env.R2_BUCKET.get(cachePath);
    if (!cacheObject) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Embedding cache not found",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const posts = await postsObject.json();
    const allEmbeddings = await cacheObject.json();

    // Extract list of active post hashes
    const activePostHashes = posts.map((post) => post.hash);

    // Filter embeddings to include only active posts
    const activeEmbeddings = {};
    let missingEmbeddings = [];

    for (const postHash of activePostHashes) {
      if (allEmbeddings[postHash]) {
        activeEmbeddings[postHash] = allEmbeddings[postHash];
      } else {
        missingEmbeddings.push(postHash);
      }
    }

    // Save filtered embeddings
    const outputPath = `projects/${projectId}/${revId}/post-embeddings2.json`;
    await env.R2_BUCKET.put(outputPath, JSON.stringify(activeEmbeddings));

    return new Response(
      JSON.stringify({
        success: true,
        activeEmbeddings: Object.keys(activeEmbeddings).length,
        missingEmbeddings,
        totalPosts: activePostHashes.length,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
```

### E. Helper Functions

```javascript
// KNN search implementation
function performKnnSearch(
  embeddings,
  queryVector,
  excludeHash = null,
  limit = 5
) {
  // Calculate cosine similarity between query vector and all embeddings
  const similarities = [];

  for (const [hash, data] of Object.entries(embeddings)) {
    // Skip the source document itself if specified
    if (hash === excludeHash) continue;

    const similarity = cosineSimilarity(queryVector, data.vector);
    similarities.push({
      hash,
      title: data.title,
      similarity,
    });
  }

  // Sort by similarity (descending)
  similarities.sort((a, b) => b.similarity - a.similarity);

  // Return top results
  return similarities.slice(0, limit);
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same dimensions");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Generate embedding for text (using an external API)
async function generateEmbedding(text) {
  // Configuration for your embedding model API (e.g., OpenAI)
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + API_KEY,
    },
    body: JSON.stringify({
      input: text,
      model: "text-embedding-ada-002",
    }),
  });

  const result = await response.json();
  return result.data[0].embedding;
}
```

## 4. Deployment and Configuration

### Wrangler Configuration

```toml
name = "vector-embedding-worker"
main = "src/index.js"
compatibility_date = "2024-05-15"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "your-bucket-name"

[vars]
API_KEY = "your-openai-api-key" # Or use wrangler secrets
```

### Environment Variables

- `API_KEY`: Your OpenAI API key (or other embedding model provider)

## 5. Workflow Integration

### Build Process Integration

1. **During content builds**:

   - Call `/api/embeddings/update-cache` with all posts to ensure embeddings are generated
   - After posts are finalized, call `/api/compile-active-embeddings` to create the revision-specific embeddings file

2. **Runtime search**:
   - Use `/api/search/similar/{postHash}` for "similar posts" features
   - Use `/api/search/text` for text-based semantic search

## 6. Optimization Considerations

1. **Caching**:

   - Add caching headers to search responses where appropriate
   - Consider using Cloudflare's cache API for frequent searches

2. **Vector Computation**:

   - Implement batching for embedding generation to minimize API calls
   - Consider using Workers AI if available for local embedding generation

3. **Cost Optimization**:

   - Schedule periodic cleanup of the master cache to remove very old unused embeddings
   - Monitor R2 operation usage and adjust batch sizes accordingly

4. **Performance**:
   - For large embedding collections, consider implementing approximate nearest neighbor algorithms
   - Use WebAssembly for compute-intensive vector operations if necessary

## 7. Testing Strategy

1. **Unit tests** for vector operations (cosine similarity, etc.)
2. **Integration tests** for API endpoints
3. **Performance tests** with realistic data volumes
4. **Cost analysis** to ensure R2 operations remain within budget

This plan provides a complete framework for implementing your vector embedding cache and KNN search functionality while optimizing for R2's pricing model. The worker handles both the maintenance aspects (caching embeddings) and the runtime search functionality, with appropriate fallbacks and optimizations throughout.

# At the end of the cache update process for a given job,

we'll callback the server to tell that embedings are ready for posts. It's like a step2 after we build the project and uploaded all files to r2.
