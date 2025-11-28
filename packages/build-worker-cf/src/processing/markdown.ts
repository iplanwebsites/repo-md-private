/**
 * Markdown Processing
 * @module @repo-md/build-worker-cf
 */

import * as fs from "fs/promises";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeSanitize from "rehype-sanitize";

/**
 * Markdown processing options
 */
export interface MarkdownOptions {
  /** Minify HTML output */
  minify?: boolean;
}

/**
 * Markdown processing result
 */
export interface MarkdownResult {
  /** Rendered HTML */
  html: string;
  /** Page title from frontmatter or first heading */
  title?: string;
  /** Page description from frontmatter */
  description?: string;
  /** Extracted frontmatter */
  frontmatter?: Record<string, unknown>;
  /** Plain text content for search */
  plainText: string;
}

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterStr = match[1] ?? "";
  const body = content.slice(match[0].length);

  // Simple YAML-like parsing (key: value format)
  const frontmatter: Record<string, unknown> = {};
  const lines = frontmatterStr.split("\n");

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value: unknown = line.slice(colonIndex + 1).trim();

    // Remove quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Parse booleans and numbers
    if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (!isNaN(Number(value)) && value !== "") value = Number(value);

    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

/**
 * Extract first heading from markdown
 */
function extractFirstHeading(content: string): string | undefined {
  const headingRegex = /^#+\s+(.+)$/m;
  const match = content.match(headingRegex);
  return match?.[1]?.trim();
}

/**
 * Strip markdown syntax for plain text
 */
function stripMarkdown(content: string): string {
  return content
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    // Remove headings
    .replace(/^#+\s+/gm, "")
    // Remove emphasis
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    // Remove blockquotes
    .replace(/^>\s+/gm, "")
    // Remove lists
    .replace(/^[\s-*+]+/gm, "")
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, "")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Process a markdown file
 */
export async function processMarkdownFile(
  filePath: string,
  options: MarkdownOptions = {}
): Promise<MarkdownResult> {
  const content = await fs.readFile(filePath, "utf-8");
  return processMarkdown(content, options);
}

/**
 * Process markdown content
 */
export async function processMarkdown(
  content: string,
  options: MarkdownOptions = {}
): Promise<MarkdownResult> {
  // Parse frontmatter
  const { frontmatter, body } = parseFrontmatter(content);

  // Get title from frontmatter or first heading
  const title =
    (frontmatter.title as string) ?? extractFirstHeading(body);

  // Get description from frontmatter
  const description = frontmatter.description as string | undefined;

  // Create processor pipeline
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSanitize)
    .use(rehypeStringify);

  // Process markdown
  const file = await processor.process(body);
  let html = String(file);

  // Simple minification if requested
  if (options.minify) {
    html = html
      .replace(/\s+/g, " ")
      .replace(/>\s+</g, "><")
      .trim();
  }

  // Create wrapper HTML
  const wrappedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${title ? `<title>${escapeHtml(title)}</title>` : ""}
  ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ""}
</head>
<body>
  <article>${html}</article>
</body>
</html>`;

  // Generate plain text for search
  const plainText = stripMarkdown(body);

  return {
    html: wrappedHtml,
    title,
    description,
    frontmatter,
    plainText,
  };
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
