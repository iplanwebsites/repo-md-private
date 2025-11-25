/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseTool, ToolResult } from './tools.js';

interface ImportRssParams {
  feedUrl: string;
}

export class ImportRssTool extends BaseTool<ImportRssParams, ToolResult> {
  constructor() {
    super(
      'import_rss',
      'Import RSS Feed',
      'Import RSS/Atom feed into Obsidian vault as markdown notes',
      {
        type: 'object',
        properties: {
          feedUrl: {
            type: 'string',
            description: 'URL of the RSS or Atom feed to import',
            format: 'uri'
          }
        },
        required: ['feedUrl']
      },
      true, // isOutputMarkdown
      true, // canUpdateOutput
    );
  }

  validateToolParams(params: ImportRssParams): string | null {
    if (!params.feedUrl) {
      return 'Feed URL is required';
    }
    
    try {
      new URL(params.feedUrl);
    } catch {
      return 'Invalid URL format';
    }
    
    return null;
  }

  getDescription(params: ImportRssParams): string {
    return `Import RSS feed from ${params.feedUrl}`;
  }

  async shouldConfirmExecute(): Promise<false> {
    return false; // No confirmation needed for mock import
  }

  async execute(
    params: ImportRssParams,
    signal: AbortSignal,
    updateOutput?: (output: string) => void,
  ): Promise<ToolResult> {
    const { feedUrl } = params;

    if (updateOutput) {
      updateOutput(`📡 Fetching RSS feed from ${feedUrl}...\n`);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      updateOutput(`🔍 Parsing feed content...\n`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateOutput(`📝 Converting articles to Markdown...\n`);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      updateOutput(`💾 Saving to vault...\n`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateOutput(`✅ Import complete!\n`);
    }

    const result = `# RSS Import Complete! 📡

Successfully imported RSS feed from **${feedUrl}**

## Import Summary
- **Feed URL**: ${feedUrl}
- **Articles Imported**: 15 posts
- **Date Range**: Last 30 days
- **Location**: \`RSS Imports/\${new Date().toISOString().split('T')[0]}\`

## Files Created
- \`index.md\` - Feed overview and navigation
- \`article-001.md\` through \`article-015.md\` - Individual posts
- \`_assets/\` - Downloaded images and media

## Features Applied
- ✅ Frontmatter with metadata (title, author, date, tags)
- ✅ Internal links for navigation
- ✅ Tag hierarchy from RSS categories
- ✅ Media assets downloaded locally
- ✅ Obsidian-compatible formatting

*Note: This is a mock import for demonstration purposes.*`;

    return {
      llmContent: result,
      returnDisplay: result,
    };
  }
}