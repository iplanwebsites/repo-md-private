/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import {
  generateToken,
  generateInviteToken,
  verifyInviteToken,
} from "../../utils/jwt.js";

import _ from "lodash";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const NB_SIMILAR_BLOGS = 6;
// Cache for storing blog posts indexed by slug for faster retrieval
let blogCache = null;
// Cache for storing blog embeddings
let blogEmbeddingsCache = null;
// Cache for storing similar blog recommendations
let similarBlogsCache = {};

function readJsonDataFile(filePath) {
  const data = readFileSync(join(__dirname, "../data/" + filePath), "utf8");
  return JSON.parse(data);
}

function initBlog() {
  // if (blogJSON.length > 0) return blogJSON;
  const raw = readJsonDataFile("blog.json");

  const withMore = raw.map((a) => {
    const author = a.frontmatter?.author || "PushMD";
    const defaultCover =
      "https://picsum.photos/1200/628?random=1" +
      Math.floor(Math.random() * 1000);
    a.testing = "hello4";
    a.title = a.fileName;
    a.tags = a.frontmatter?.tags || [];
    a.secret = a.frontmatter?.secret || false;
    a.author = author;
    a.authorAvatar =
      author === "PushMD"
        ? "/img/repo-md.png"
        : "/img/blog/author/" + author + ".png";
    a.date = a.frontmatter?.date || new Date("2025-01-01");
    a.cover = a.frontmatter?.cover || defaultCover;
    a.category = a.frontmatter?.category || "random";
    return a;
  });
  return withMore;
}
const blogJSON = initBlog();

/**
 * Load blog embeddings from JSON file
 * @returns {Object} Blog embeddings data
 */
function loadBlogEmbeddings() {
  if (blogEmbeddingsCache) {
    return blogEmbeddingsCache;
  }

  try {
    const embeddings = readJsonDataFile("blog-embeddings.json");
    blogEmbeddingsCache = embeddings;
    return embeddings;
  } catch (error) {
    console.error("Error loading blog embeddings:", error);
    return { items: [] };
  }
}

/**
 * Calculate cosine similarity between two embeddings
 * @param {Array<number>} embA - First embedding
 * @param {Array<number>} embB - Second embedding
 * @returns {number} Cosine similarity score (-1 to 1)
 */
function cosineSimilarity(embA, embB) {
  if (!embA || !embB || embA.length !== embB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < embA.length; i++) {
    dotProduct += embA[i] * embB[i];
    normA += embA[i] * embA[i];
    normB += embB[i] * embB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

// Initialize blog data and create cache
function initializeBlogCache() {
  if (!blogCache) {
    const blogs = initBlog();
    // Create a dictionary indexed by slug for O(1) lookups
    blogCache = _.keyBy(blogs, "slug");
  }
  return blogCache;
}

/**
 * Get blog by slug without augmentation to avoid recursive calls
 * @param {string} slug - Blog slug
 * @returns {Object|null} Blog post or null if not found
 */
function getBlogBasic(slug) {
  const cache = initializeBlogCache();
  return cache[slug] || null;
}

/**
 * Find similar blogs for a given blog post
 * @param {string} slug - The slug of the blog post
 * @param {number} count - Number of similar blogs to return
 * @returns {Array<Object>} Array of similar blog posts
 */
function findSimilarBlogs(slug, count = 3) {
  // Check cache first
  if (similarBlogsCache[slug]) {
    return similarBlogsCache[slug].slice(0, count);
  }

  // Load embeddings
  const embeddings = loadBlogEmbeddings();
  if (!embeddings || !embeddings.items || embeddings.items.length === 0) {
    return [];
  }

  // Find current blog's embedding
  const currentBlogEmbedding = embeddings.items.find(
    (item) => item.slug === slug
  );
  if (!currentBlogEmbedding) {
    return [];
  }

  // Calculate similarity with all other blogs
  const similarities = embeddings.items
    .filter((item) => item.slug !== slug) // Exclude the current blog
    .map((item) => ({
      slug: item.slug,
      similarity: cosineSimilarity(
        currentBlogEmbedding.embedding,
        item.embedding
      ),
    }))
    .sort((a, b) => b.similarity - a.similarity) // Sort by similarity (descending)
    .slice(0, count); // Take the top 'count' results

  // Get the basic blog objects for the similar blogs (WITHOUT calling augmentBlog)
  const similarBlogs = similarities
    .map((sim) => {
      const blog = getBlogBasic(sim.slug);
      if (!blog) return null;

      // Return minimal blog info with similarity score
      return {
        slug: blog.slug,
        title: blog.title,
        cover: blog.cover,
        author: blog.author,
        category: blog.category,
        similarity: sim.similarity,
        authorAvatar: blog.authorAvatar,
      };
    })
    .filter(Boolean);

  // Cache the results
  similarBlogsCache[slug] = similarBlogs;

  return similarBlogs;
}

/**
 * Compute and cache similar blogs for all blog posts
 * This can be called at server startup to precompute all similarities
 */
export function precomputeAllSimilarBlogs() {
  console.log("Precomputing similar blogs for all articles...");
  const blogs = getBlogs();
  blogs.forEach((blog) => {
    findSimilarBlogs(blog.slug);
  });
  console.log(`Similar blogs precomputed for ${blogs.length} articles`);
}

export function getBlog(slug) {
  // Get the basic blog post
  const blog = getBlogBasic(slug);
  if (!blog) {
    return null;
  }

  // Return augmented version of the blog
  return augmentBlog(blog);
}

export function augmentBlog(blog) {
  // Create a shallow copy of the blog object
  const sanitizedBlog = { ...blog };

  // Remove sensitive fields
  delete sanitizedBlog.secret;
  delete sanitizedBlog.public;

  // Add similar blogs if they aren't already included
  if (!sanitizedBlog.similarBlogs) {
    sanitizedBlog.similarBlogs = findSimilarBlogs(blog.slug, NB_SIMILAR_BLOGS);
  }

  return sanitizedBlog;
}

export function getBlogs() {
  const filtered = blogJSON.filter((b) => !b.secret);

  // we omit html prop
  const cleanner = filtered.map((b) => {
    return _.omit(b, ["html", "toc"]);
  });
  return cleanner;
}

// Load embeddings on module initialization
loadBlogEmbeddings();
