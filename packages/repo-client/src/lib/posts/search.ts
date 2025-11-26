/**
 * Post search functionality with both memory-based and vector-based search
 */

import MiniSearch from "minisearch";
import { cosineSimilarity } from "../vector.js";
import { computeTextEmbedding, computeClipTextEmbedding, computeClipImageEmbedding } from "../inference.js";
import type { Post } from './retrieval.js';

/** Media item type */
export interface Media {
  hash: string;
  slug?: string;
  title?: string;
  path?: string;
  [key: string]: unknown;
}

/** Search result type */
export interface SearchResult {
  id: string;
  hash?: string;
  score: number;
  similarity?: number;
  searchMode: string;
  post?: Post | null;
  media?: Media | null;
  type?: 'post' | 'media';
  terms?: string[];
  [key: string]: unknown;
}

/** Search options */
export interface SearchOptions {
  limit?: number;
  fuzzy?: number;
  prefix?: boolean;
  boost?: Record<string, number>;
  threshold?: number;
}

/** Search parameters */
export interface SearchParams {
  text?: string;
  image?: string;
  props?: SearchOptions;
  mode?: 'memory' | 'vector' | 'vector-text' | 'vector-clip-text' | 'vector-clip-image';
}

/** Post search configuration */
export interface PostSearchConfig {
  getAllPosts: (useCache?: boolean, forceRefresh?: boolean) => Promise<Post[]>;
  getPostsEmbeddings?: () => Promise<Record<string, number[]>>;
  getAllMedia?: () => Promise<Media[]>;
  getMediaEmbeddings?: () => Promise<Record<string, number[]>>;
  debug?: boolean;
  getActiveRev?: (() => string | undefined) | null;
}

/** Post search service interface */
export interface PostSearchService {
  searchPosts: (params: SearchParams) => Promise<SearchResult[]>;
  searchAutocomplete: (term: string, limit?: number) => Promise<string[]>;
  refreshMemoryIndex: () => Promise<MiniSearch | null>;
  performMemorySearch: (text: string, props: SearchOptions) => Promise<SearchResult[]>;
  performVectorSearch: (params: { text?: string; image?: string; mode: string; props: SearchOptions }) => Promise<SearchResult[]>;
  clearSearchIndex: () => void;
}

/** MiniSearch document type */
interface SearchDocument {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  tags: string;
  plain: string;
  slug: string;
  date?: string;
  hash: string;
  path?: string;
}

export function createPostSearch(config: PostSearchConfig): PostSearchService {
  const { getAllPosts, getPostsEmbeddings, getAllMedia, getMediaEmbeddings, debug = false, getActiveRev = null } = config;

  let miniSearchInstance: MiniSearch<SearchDocument> | null = null;
  let indexedData: Post[] | null = null;
  let indexRevision: string | null = null; // Track which revision the index is for

  /**
   * Clear search index (called when revision changes)
   */
  function clearSearchIndex(): void {
    if (debug && (miniSearchInstance || indexedData)) {
      console.log("🔍 Clearing search index (revision changed)");
    }
    miniSearchInstance = null;
    indexedData = null;
    indexRevision = null;
  }

  /**
   * Check and invalidate index if revision changed
   */
  function checkRevisionAndInvalidate(): void {
    if (getActiveRev && indexRevision) {
      const currentRev = getActiveRev();
      if (currentRev && currentRev !== indexRevision) {
        if (debug) {
          console.log(`🔍 Revision changed from ${indexRevision} to ${currentRev}, invalidating search index`);
        }
        clearSearchIndex();
      }
    }
  }

  const initializeMemoryIndex = async (posts: Post[]): Promise<MiniSearch<SearchDocument> | null> => {
    if (!posts || posts.length === 0) {
      if (debug) {
        console.log("🔍 No posts available for search indexing");
      }
      return null;
    }

    const searchableFields = [
      "title",
      "content",
      "excerpt",
      "tags",
      "plain",
      //    "hash",
    ];
    const storableFields = ["slug", "title", "excerpt", "date", "hash", "path"];

    miniSearchInstance = new MiniSearch<SearchDocument>({
      fields: searchableFields,
      storeFields: storableFields,
      searchOptions: {
        boost: { slug: 3, title: 3, excerpt: 2, plain: 2 }, // Weight title more heavily, plain text highly
        fuzzy: 0.2,
        prefix: true,
      },
    });

    const documentsToIndex: SearchDocument[] = posts.map((post) => ({
      id: post.hash || post.slug,
      title: post.title || "",
      content: (post.content as string) || "",
      excerpt: (post.excerpt as string) || "",
      tags: Array.isArray(post.tags) ? (post.tags as string[]).join(" ") : (post.tags as string) || "",
      plain: (post.plain as string) || "",
      slug: post.slug,
      date: post.date,
      hash: post.hash,
      path: post.path,
    }));

    miniSearchInstance.addAll(documentsToIndex);
    indexedData = posts;
    // Track the revision this index is for
    if (getActiveRev) {
      indexRevision = getActiveRev() || null;
    }

    if (debug) {
      console.log(`🔍 Indexed ${documentsToIndex.length} posts for memory search (revision: ${indexRevision})`);
    }

    return miniSearchInstance;
  };

  const searchPosts = async (params: SearchParams): Promise<SearchResult[]> => {
    const { text, image, props = {}, mode = "memory" } = params;

    if (!text && !image) {
      throw new Error(
        "Either text or image parameter is required for search"
      );
    }

    if (text && (typeof text !== "string" || text.trim().length === 0)) {
      throw new Error("Text parameter must be a non-empty string when provided");
    }

    if (image && (typeof image !== "string" || image.trim().length === 0)) {
      throw new Error("Image parameter must be a non-empty string when provided");
    }

    if (!['memory', 'vector', 'vector-text', 'vector-clip-text', 'vector-clip-image'].includes(mode)) {
      throw new Error(
        `Search mode '${mode}' is not supported. Available modes: memory, vector, vector-text, vector-clip-text, vector-clip-image`
      );
    }

    try {
      if (mode === "memory") {
        return await performMemorySearch(text || '', props);
      }
      return await performVectorSearch({ text, image, mode, props });
    } catch (error) {
      if (debug) {
        console.error("🔍 Search error:", error);
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Search failed: ${errorMessage}`);
    }
  };

  const performMemorySearch = async (text: string, props: SearchOptions): Promise<SearchResult[]> => {
    // Check if revision changed and invalidate index if needed
    checkRevisionAndInvalidate();

    // Get all posts if we haven't indexed them yet or if forced refresh
    if (!miniSearchInstance || !indexedData) {
      const posts = await getAllPosts(true);
      await initializeMemoryIndex(posts);
    }

    if (!miniSearchInstance) {
      if (debug) {
        console.warn("🔍 Memory search index could not be initialized");
      }
      return [];
    }

    // Merge default options with provided props
    const searchOptions = {
      limit: 20,
      fuzzy: 0.2,
      prefix: true,
      boost: { title: 3, excerpt: 2 },
      ...props,
    };

    const results = miniSearchInstance.search(text, searchOptions);

    if (debug) {
      console.log(`🔍 Found ${results.length} memory search results for query: "${text}"`);
    }

    // Return enhanced results with original post data
    return results.map((result) => ({
      ...result,
      searchMode: 'memory',
      post: indexedData?.find(
        (post) =>
          (post.hash && post.hash === result.id) ||
          (post.slug && post.slug === result.id)
      ) || null,
    }));
  };

  const performVectorSearch = async (params: { text?: string; image?: string; mode: string; props: SearchOptions }): Promise<SearchResult[]> => {
    const { text, image, mode, props } = params;
    const { limit = 20, threshold = 0.1 } = props;
    let queryEmbedding: number[] | undefined;
    let searchType: 'text' | 'clip';

    try {
      // Compute query embedding based on mode
      if (mode === "vector" || mode === "vector-text") {
        if (!text) {
          throw new Error("Text is required for text-based vector search");
        }
        const embeddingResult = await computeTextEmbedding(text, null, debug);
        queryEmbedding = embeddingResult.embedding;
        searchType = 'text';
        if (debug) {
          console.log(`🔍 Computed text embedding for query: "${text}"`);
        }
      } else if (mode === "vector-clip-text") {
        if (!text) {
          throw new Error("Text is required for CLIP text-based vector search");
        }
        const embeddingResult = await computeClipTextEmbedding(text, debug);
        queryEmbedding = embeddingResult.embedding;
        searchType = 'clip';
        if (debug) {
          console.log(`🔍 Computed CLIP text embedding for query: "${text}"`);
        }
      } else if (mode === "vector-clip-image") {
        if (!image) {
          throw new Error("Image is required for CLIP image-based vector search");
        }
        const embeddingResult = await computeClipImageEmbedding(image, debug);
        queryEmbedding = embeddingResult.embedding;
        searchType = 'clip';
        if (debug) {
          console.log("🔍 Computed CLIP image embedding for search");
        }
      } else {
        throw new Error(`Unknown search mode: ${mode}`);
      }

      if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
        throw new Error("Failed to compute valid query embedding");
      }

      // Get appropriate embeddings based on search type - IMPORTANT: Only compare compatible embeddings
      let embeddingsMap: Record<string, number[]>;
      let candidateData: Array<(Post | Media) & { type: 'post' | 'media' }>;

      if (searchType === 'clip') {
        // For CLIP searches, only use CLIP embeddings (from media)
        // CLIP embeddings are only available for media items, not posts
        const [mediaEmbeddings, media] = await Promise.all([
          getMediaEmbeddings ? getMediaEmbeddings() : {},
          getAllMedia ? getAllMedia() : []
        ]);

        embeddingsMap = mediaEmbeddings;
        candidateData = media.map(m => ({ ...m, type: 'media' as const }));
      } else {
        // For text searches, only use text embeddings (from posts)
        // Text embeddings are available for posts
        const [postsEmbeddings, posts] = await Promise.all([
          getPostsEmbeddings ? getPostsEmbeddings() : {},
          getAllPosts ? getAllPosts(true) : []
        ]);

        embeddingsMap = postsEmbeddings;
        candidateData = posts.map(p => ({ ...p, type: 'post' as const }));
      }

      if (!embeddingsMap || Object.keys(embeddingsMap).length === 0) {
        if (debug) {
          console.warn("🔍 No embeddings available for vector search");
        }
        return [];
      }

      // Calculate similarities
      const similarities: SearchResult[] = [];

      for (const [hash, embedding] of Object.entries(embeddingsMap)) {
        if (!embedding || !Array.isArray(embedding)) continue;

        const similarity = cosineSimilarity(queryEmbedding, embedding);

        if (similarity >= threshold) {
          const candidateItem = candidateData.find(item => item.hash === hash);
          if (candidateItem) {
            similarities.push({
              id: hash,
              hash,
              similarity,
              score: similarity,
              searchMode: mode,
              post: candidateItem.type === 'post' ? candidateItem as Post : null,
              media: candidateItem.type === 'media' ? candidateItem as Media : null,
              type: candidateItem.type
            });
          }
        }
      }

      // Sort by similarity (highest first) and limit results
      const results = similarities
        .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
        .slice(0, limit);

      if (debug) {
        console.log(`🔍 Found ${results.length} vector search results using ${mode} (threshold: ${threshold})`);
      }

      return results;

    } catch (error) {
      if (debug) {
        console.error(`🔍 Vector search error (${mode}):`, error);
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Vector search failed: ${errorMessage}`);
    }
  };

  const searchAutocomplete = async (term: string, limit = 10): Promise<string[]> => {
    if (!term || typeof term !== 'string') {
      return [];
    }

    if (term.trim().length === 0) {
      return [];
    }

    try {
      // Check if revision changed and invalidate index if needed
      checkRevisionAndInvalidate();

      // Get all posts if we haven't indexed them yet
      if (!miniSearchInstance || !indexedData) {
        const posts = await getAllPosts(true);
        await initializeMemoryIndex(posts);
      }

      if (!miniSearchInstance) {
        return [];
      }

      // Perform a search to get terms
      const searchOptions = {
        limit: Math.min(limit, 20), // Limit results to reduce processing
        fuzzy: 0.1, // Less fuzzy for autocomplete
        prefix: true,
        boost: { slug: 3, title: 3, excerpt: 2, plain: 2 },
      };

      const results = miniSearchInstance.search(term, searchOptions);

      // Extract all unique terms that start with the input term
      const allTerms = new Set<string>();

      for (const result of results) {
        if (result.terms && Array.isArray(result.terms)) {
          for (const resultTerm of result.terms) {
            // Only include terms that start with the input term (case insensitive)
            if (resultTerm.toLowerCase().startsWith(term.toLowerCase())) {
              allTerms.add(resultTerm);
            }
          }
        }
      }

      // Convert to array, sort by length (shorter first), and limit results
      const termsList = Array.from(allTerms)
        .sort((a, b) => {
          // Prioritize exact matches and shorter terms
          if (a.toLowerCase() === term.toLowerCase()) return -1;
          if (b.toLowerCase() === term.toLowerCase()) return 1;
          return a.length - b.length;
        })
        .slice(0, limit);

      if (debug) {
        console.log(`🔍 Found ${termsList.length} autocomplete suggestions for "${term}"`);
      }

      return termsList;

    } catch (error) {
      if (debug) {
        console.error('🔍 Autocomplete error:', error);
      }
      return [];
    }
  };

  const refreshMemoryIndex = async (): Promise<MiniSearch<SearchDocument> | null> => {
    const posts = await getAllPosts(true, true); // Force refresh
    return await initializeMemoryIndex(posts);
  };

  return {
    searchPosts,
    searchAutocomplete,
    refreshMemoryIndex,
    performMemorySearch,
    performVectorSearch,
    clearSearchIndex,
  };
}
