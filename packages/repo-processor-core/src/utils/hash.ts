/**
 * Hash Utilities
 *
 * Functions for generating content hashes.
 */

import crypto from 'node:crypto';

/**
 * Calculate SHA-256 hash of a content string
 */
export const hashContent = (content: string): string => {
  const hashSum = crypto.createHash('sha256');
  hashSum.update(content);
  return hashSum.digest('hex');
};

/**
 * Calculate SHA-256 hash of a buffer
 */
export const hashBuffer = (buffer: Buffer): string => {
  const hashSum = crypto.createHash('sha256');
  hashSum.update(new Uint8Array(buffer));
  return hashSum.digest('hex');
};

/**
 * Calculate a short hash (first N characters)
 */
export const shortHash = (content: string, length = 8): string =>
  hashContent(content).substring(0, length);

/**
 * Create a deterministic hash from multiple values
 */
export const combineHashes = (...values: readonly string[]): string =>
  hashContent(values.join(':'));
