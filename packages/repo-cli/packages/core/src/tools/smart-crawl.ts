/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseTool, ToolResult } from './tools.js';

interface SmartCrawlParams {
  url: string;
  autoDetect?: boolean;
  extractImages?: boolean;
  followLinks?: boolean;
  maxDepth?: number;
}

export class SmartCrawlTool extends BaseTool<SmartCrawlParams, ToolResult> {
  constructor() {
    super(
      'smart_crawl',
      'Smart Website Crawler',
      'Intelligently crawl and extract content from websites',
      {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'Website URL to crawl',
            format: 'uri'
          },
          autoDetect: {
            type: 'boolean',
            description: 'Automatically detect content patterns',
            default: true
          },
          extractImages: {
            type: 'boolean',
            description: 'Download and extract images',
            default: true
          },
          followLinks: {
            type: 'boolean',
            description: 'Follow internal links',
            default: true
          },
          maxDepth: {
            type: 'number',
            description: 'Maximum crawling depth',
            default: 3,
            minimum: 1,
            maximum: 10
          }
        },
        required: ['url']
      },
      true, // isOutputMarkdown
      true, // canUpdateOutput
    );
  }

  validateToolParams(params: SmartCrawlParams): string | null {
    if (!params.url) {
      return 'URL is required';
    }
    
    try {
      new URL(params.url);
    } catch {
      return 'Invalid URL format';
    }
    
    if (params.maxDepth && (params.maxDepth < 1 || params.maxDepth > 10)) {
      return 'Max depth must be between 1 and 10';
    }
    
    return null;
  }

  getDescription(params: SmartCrawlParams): string {
    return `Crawl website ${params.url} with depth ${params.maxDepth || 3}`;
  }

  async shouldConfirmExecute(): Promise<false> {
    return false; // No confirmation needed for mock crawl
  }

  async execute(
    params: SmartCrawlParams,
    signal: AbortSignal,
    updateOutput?: (output: string) => void,
  ): Promise<ToolResult> {
    const { url, autoDetect, extractImages, followLinks, maxDepth } = params;

    if (updateOutput) {
      updateOutput(`🕷️ Starting smart crawl of ${url}...\n`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateOutput(`🔍 Analyzing website structure...\n`);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      updateOutput(`📄 Extracting content from pages...\n`);
      
      if (extractImages) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        updateOutput(`🖼️ Downloading images...\n`);
      }
      
      if (followLinks) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        updateOutput(`🔗 Following internal links...\n`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateOutput(`📝 Converting to Markdown...\n`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateOutput(`✅ Crawl complete!\n`);
    }

    const result = `# MOCK**/ Website Crawl Complete! 🕷️

Successfully crawled **${url}**

## Crawl Results
- **URL**: ${url}
- **Pages Crawled**: 23 pages
- **Max Depth**: ${maxDepth || 3}
- **Auto-Detection**: ${autoDetect ? '✅ Enabled' : '❌ Disabled'}
- **Images Extracted**: ${extractImages ? '✅ 45 images' : '❌ Disabled'}
- **Links Followed**: ${followLinks ? '✅ Internal links' : '❌ Single page only'}

## Content Structure Detected
- **Type**: Documentation Site
- **Navigation**: Hierarchical with sidebar
- **Sections**: Getting Started, API Reference, Tutorials, FAQ

## Files Created
- \`Website Crawl - ${new URL(url).hostname}/\`
  - \`index.md\` - Site overview and navigation
  - \`getting-started/\` - Tutorial content
  - \`api-reference/\` - API documentation
  - \`tutorials/\` - Step-by-step guides
  - \`_assets/\` - Downloaded images and media

## Features Applied
- ✅ Preserved original navigation structure
- ✅ Internal links converted to Obsidian format
- ✅ Code blocks properly formatted
- ✅ Images downloaded and referenced locally
- ✅ Metadata extracted (titles, descriptions, dates)

*Note: This is a mock crawl for demonstration purposes.*`;

    return {
      llmContent: result,
      returnDisplay: result,
    };
  }
}