// generate-blog-embeddings.js
import { getBlogs, getBlog } from "../lib/blog.js";
import instructorEmbedder from "./instructor-embedder.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Enable debug mode if needed
const DEBUG_MODE = true;
instructorEmbedder.setDebug(DEBUG_MODE);

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Split text into manageable chunks for embedding
 * Since the model has a token limit, we need to split longer texts
 * @param {string} text - The text to split
 * @param {number} maxLength - Maximum character length per chunk
 * @returns {Array<string>} Array of text chunks
 */
function splitTextIntoChunks(text, maxLength = 256) {
  // Simple sentence-based split
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    // If adding this sentence exceeds the max length, start a new chunk
    if (
      currentChunk.length + sentence.length > maxLength &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
    }
  }

  // Add the last chunk if not empty
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Generate a mean embedding from multiple chunk embeddings
 * @param {Array<Array<number>>} embeddings - Array of embeddings
 * @returns {Array<number>} Mean embedding
 */
function calculateMeanEmbedding(embeddings) {
  if (embeddings.length === 0) return [];
  if (embeddings.length === 1) return embeddings[0];

  // Make sure all embeddings have the same dimension
  const dimension = embeddings[0].length;

  // Calculate the mean for each dimension
  const meanEmbedding = new Array(dimension).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < dimension; i++) {
      meanEmbedding[i] += embedding[i] / embeddings.length;
    }
  }

  return meanEmbedding;
}

/**
 * Normalize an embedding vector to unit length
 * @param {Array<number>} embedding - The embedding to normalize
 * @returns {Array<number>} Normalized embedding
 */
function normalizeEmbedding(embedding) {
  // Calculate magnitude
  let magnitude = 0;
  for (let i = 0; i < embedding.length; i++) {
    magnitude += embedding[i] * embedding[i];
  }
  magnitude = Math.sqrt(magnitude);

  // Normalize
  if (magnitude > 0) {
    return embedding.map((e) => e / magnitude);
  }
  return embedding;
}

/**
 * Generate embeddings for a blog post
 * @param {Object} blog - Blog post object
 * @returns {Promise<{id: string, slug: string, embedding: Array<number>}>} Blog with embedding
 */
async function generateBlogEmbedding(blog) {
  console.log(`Processing blog: ${blog.fileName}`);

  // Get the full blog content if needed
  const fullBlog = getBlog(blog.slug);

  // Extract text from blog
  let textToEmbed = "";

  // Combine title, summary, and content for better embedding
  if (blog.title) textToEmbed += blog.title + ". ";
  if (blog.frontmatter?.description)
    textToEmbed += blog.frontmatter.description + " ";
  if (fullBlog && fullBlog.html) {
    // Remove HTML tags to get plain text
    const textContent = fullBlog.html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    textToEmbed += textContent;
  }

  // If text is empty, skip this blog
  if (!textToEmbed.trim()) {
    console.warn(`No content found for blog: ${blog.fileName}`);
    return null;
  }

  // Split content into chunks
  const chunks = splitTextIntoChunks(textToEmbed);
  console.log(`Split blog into ${chunks.length} chunks`);

  // Generate embeddings for each chunk
  const instruction = "Represent the blog article for semantic search:";
  const chunkEmbeddings = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Generating embedding for chunk ${i + 1}/${chunks.length}`);
    const embedding = await instructorEmbedder.getEmbedding(
      instruction,
      chunks[i]
    );
    chunkEmbeddings.push(embedding);
  }

  // Calculate the mean embedding
  const meanEmbedding = calculateMeanEmbedding(chunkEmbeddings);

  // Normalize the embedding
  const normalizedEmbedding = normalizeEmbedding(meanEmbedding);

  return {
    id: blog.slug,
    slug: blog.slug,
    title: blog.title,
    embedding: normalizedEmbedding,
  };
}

/**
 * Main function to generate all blog embeddings
 */
async function generateAllBlogEmbeddings() {
  try {
    console.log("Starting blog embeddings generation...");

    // Get all blogs
    const blogs = getBlogs();
    console.log(`Found ${blogs.length} blogs to process`);

    // Generate embeddings
    const embeddingsPromises = blogs.map(generateBlogEmbedding);
    const embeddings = await Promise.all(embeddingsPromises);

    // Filter out null results
    const validEmbeddings = embeddings.filter((e) => e !== null);
    console.log(`Generated embeddings for ${validEmbeddings.length} blogs`);

    // Create output object
    const outputData = {
      model: "Xenova/all-MiniLM-L6-v2",
      dimension: validEmbeddings[0]?.embedding.length || 0,
      items: validEmbeddings,
    };

    // Save to file
    const outputPath = path.join(__dirname, "../data/blog-embeddings.json");
    await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2));

    console.log(`Embeddings saved to ${outputPath}`);
  } catch (error) {
    console.error("Error generating blog embeddings:", error);
  }
}

// Run the script
generateAllBlogEmbeddings();
