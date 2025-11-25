import slugify from "@sindresorhus/slugify";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export function toSlug(s: string): string {
  return slugify(s, { decamelize: false });
}

export function getFileName(filePath: string): string {
  const { name } = path.parse(filePath);
  return name;
}

export function getFrontmatterAndMd(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf8");
  const { content, data } = matter(raw);
  return {
    md: content,
    frontmatter: data,
  };
}

export function jsonStringify(o: any): string {
  return JSON.stringify(o, null, 2);
}

export function writeToFileSync(filePath: string, content: string) {
  fs.writeFileSync(filePath, content, "utf8");
}

/**
 * Calculate SHA-256 hash of content string
 * @param content Content string to hash
 * @returns SHA-256 hash as a hexadecimal string
 */
export function calculateFileHash(content: string): string {
  const hashSum = crypto.createHash('sha256');
  hashSum.update(content);
  return hashSum.digest('hex');
}

/**
 * Calculate SHA-256 hash of a file
 * @param filePath Path to the file to hash
 * @returns SHA-256 hash as a hexadecimal string
 */
export function calculateFilePathHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}
