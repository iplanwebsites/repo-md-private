import { count } from '@wordpress/wordcount';

/**
 * Count words in a text string
 * @param text Text to count words in
 * @returns Number of words in the text
 */
export const countWords = (text: string): number => {
  return count(text, 'words', {});
};