/**
 * Vector math utilities for embeddings and similarity calculations
 */

/** Embedding vector type - array of floating point numbers */
export type Embedding = number[];

/**
 * Calculate cosine similarity between two embedding vectors
 * @param embA - First embedding vector
 * @param embB - Second embedding vector
 * @returns Cosine similarity score (-1 to 1), or 0 if vectors are invalid
 */
export function cosineSimilarity(embA: Embedding | null | undefined, embB: Embedding | null | undefined): number {
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
