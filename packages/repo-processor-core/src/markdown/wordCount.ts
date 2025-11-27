/**
 * Word Count Utilities
 *
 * Functions for counting words in text content.
 */

/**
 * Count words in a text string
 * Handles multiple languages and common edge cases
 */
export const countWords = (text: string): number => {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  // Remove extra whitespace and trim
  const normalized = text.trim().replace(/\s+/g, ' ');

  if (normalized.length === 0) {
    return 0;
  }

  // Split on whitespace and filter empty strings
  const words = normalized.split(' ').filter((word) => word.length > 0);

  return words.length;
};

/**
 * Estimate reading time in minutes
 * Uses average reading speed of 200 words per minute
 */
export const estimateReadingTime = (
  wordCount: number,
  wordsPerMinute = 200
): number => {
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
};

/**
 * Get word count and reading time for content
 */
export const getContentStats = (
  text: string
): {
  readonly wordCount: number;
  readonly readingTimeMinutes: number;
} => {
  const wordCount = countWords(text);
  return {
    wordCount,
    readingTimeMinutes: estimateReadingTime(wordCount),
  };
};
