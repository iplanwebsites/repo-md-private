/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseTool, ToolResult } from './tools.js';

interface MigrateGenericParams {
  type: string;
  source: string;
}

export class MigrateGenericTool extends BaseTool<MigrateGenericParams, ToolResult> {
  constructor() {
    super(
      'migrate_generic',
      'Generic Migration',
      'Generic migration tool for various data formats',
      {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'Type of migration (generic, json, markdown, etc.)',
            default: 'generic'
          },
          source: {
            type: 'string',
            description: 'Source file path or data to migrate'
          }
        },
        required: ['source']
      },
      true, // isOutputMarkdown
      true, // canUpdateOutput
    );
  }

  validateToolParams(params: MigrateGenericParams): string | null {
    if (!params.source) {
      return 'Source is required';
    }
    return null;
  }

  getDescription(params: MigrateGenericParams): string {
    return `Migrate ${params.type || 'generic'} data from ${params.source}`;
  }

  async shouldConfirmExecute(): Promise<false> {
    return false;
  }

  async execute(
    params: MigrateGenericParams,
    signal: AbortSignal,
    updateOutput?: (output: string) => void,
  ): Promise<ToolResult> {
    const { type, source } = params;

    if (updateOutput) {
      updateOutput(`🔄 Starting ${type || 'generic'} migration from ${source}...\n`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateOutput(`📊 Analyzing data structure...\n`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      updateOutput(`🔧 Converting to Obsidian format...\n`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      updateOutput(`💾 Saving to vault...\n`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateOutput(`✅ Migration complete!\n`);
    }

    const result = `# Generic Migration Complete! 🔄

Successfully migrated **${type || 'generic'}** data from **${source}**

## Migration Summary
- **Source**: ${source}
- **Type**: ${type || 'generic'}
- **Records Processed**: 42 items
- **Files Created**: 15 markdown files

## Output Structure
\`\`\`
Migrations/${type || 'Generic'}/
├── index.md (overview)
├── data/
│   ├── item-001.md
│   ├── item-002.md
│   └── ...
└── assets/ (if applicable)
\`\`\`

## Features Applied
- ✅ Structured data converted to frontmatter
- ✅ Content formatted as Markdown
- ✅ Relationships preserved as internal links
- ✅ Metadata properly categorized

*Note: This is a mock migration for demonstration purposes.*`;

    return {
      llmContent: result,
      returnDisplay: result,
    };
  }
}