/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseTool, ToolResult } from './tools.js';

interface MigrateMarkdownParams {
  source: string;
}

export class MigrateMarkdownTool extends BaseTool<MigrateMarkdownParams, ToolResult> {
  constructor() {
    super(
      'migrate_markdown',
      'Markdown Migration',
      'Migrate existing markdown files to Obsidian vault format',
      {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'Source markdown file or directory to migrate'
          }
        },
        required: ['source']
      },
      true, // isOutputMarkdown
      true, // canUpdateOutput
    );
  }

  validateToolParams(params: MigrateMarkdownParams): string | null {
    if (!params.source) {
      return 'Source is required';
    }
    return null;
  }

  getDescription(params: MigrateMarkdownParams): string {
    return `Migrate markdown files from ${params.source}`;
  }

  async shouldConfirmExecute(): Promise<false> {
    return false;
  }

  async execute(
    params: MigrateMarkdownParams,
    signal: AbortSignal,
    updateOutput?: (output: string) => void,
  ): Promise<ToolResult> {
    const { source } = params;

    if (updateOutput) {
      updateOutput(`📝 Starting markdown migration from ${source}...\n`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateOutput(`🔍 Scanning markdown files...\n`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      updateOutput(`🔗 Converting links to Obsidian format...\n`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      updateOutput(`📊 Adding frontmatter metadata...\n`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateOutput(`💾 Organizing in vault structure...\n`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateOutput(`✅ Migration complete!\n`);
    }

    const result = `# Markdown Migration Complete! 📝

Successfully migrated markdown files from **${source}**

## Migration Summary
- **Source**: ${source}
- **Files Processed**: 28 markdown files
- **Links Converted**: 156 internal links
- **Images Processed**: 34 images

## Transformations Applied
- ✅ Links converted from \`[text](file.md)\` to \`[[file]]\`
- ✅ Added YAML frontmatter with titles and metadata
- ✅ Organized files into logical folder structure
- ✅ Preserved existing content and formatting
- ✅ Updated image references to relative paths

## File Organization
\`\`\`
Migrated Markdown/
├── index.md (navigation overview)
├── Notes/
│   ├── concept-001.md
│   ├── concept-002.md
│   └── ...
├── Resources/
│   ├── reference-001.md
│   └── ...
└── Assets/
    ├── images/
    └── attachments/
\`\`\`

## Quality Assurance
- ✅ All internal links validated
- ✅ No broken references detected
- ✅ Frontmatter schema consistent
- ✅ File names sanitized for Obsidian

*Note: This is a mock migration for demonstration purposes.*`;

    return {
      llmContent: result,
      returnDisplay: result,
    };
  }
}