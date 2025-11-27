/**
 * File Utilities
 *
 * Functions for file system operations.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Get file name without extension
 */
export const getFileName = (filePath: string): string => {
  const { name } = path.parse(filePath);
  return name;
};

/**
 * Get file extension without dot
 */
export const getExtension = (filePath: string): string => {
  const { ext } = path.parse(filePath);
  return ext.slice(1).toLowerCase();
};

/**
 * Check if a file exists
 */
export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Ensure a directory exists
 */
export const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

/**
 * Write JSON to a file
 */
export const writeJson = async (filePath: string, data: unknown): Promise<void> => {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
};

/**
 * Read JSON from a file
 */
export const readJson = async <T = unknown>(filePath: string): Promise<T> => {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content) as T;
};

/**
 * Write text to a file
 */
export const writeText = async (filePath: string, content: string): Promise<void> => {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf8');
};

/**
 * Read text from a file
 */
export const readText = async (filePath: string): Promise<string> => {
  return fs.readFile(filePath, 'utf8');
};

/**
 * Copy a file
 */
export const copyFile = async (src: string, dest: string): Promise<void> => {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
};

/**
 * Get file stats
 */
export const getStats = async (filePath: string): Promise<{
  size: number;
  created: Date;
  modified: Date;
}> => {
  const stats = await fs.stat(filePath);
  return {
    size: stats.size,
    created: stats.birthtime,
    modified: stats.mtime,
  };
};

/**
 * Find files matching a pattern in a directory
 */
export const findFiles = async (
  dir: string,
  predicate: (name: string) => boolean,
  recursive = true
): Promise<readonly string[]> => {
  const results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && recursive) {
      const nested = await findFiles(fullPath, predicate, recursive);
      results.push(...nested);
    } else if (entry.isFile() && predicate(entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
};

/**
 * Find markdown files in a directory
 */
export const findMarkdownFiles = (dir: string, recursive = true): Promise<readonly string[]> =>
  findFiles(dir, (name) => name.endsWith('.md'), recursive);

/**
 * Get relative path from a base directory
 */
export const relativePath = (from: string, to: string): string =>
  path.relative(from, to);

/**
 * Normalize a path to use forward slashes
 */
export const normalizePath = (p: string): string =>
  p.split(path.sep).join('/');
