#!/usr/bin/env node

/**
 * Script to archive dead code identified by unimported and code analysis
 * This script moves unused files to an archive directory while preserving structure
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Files to archive based on our analysis
const filesToArchive = [
  // Agent factories that are only used in unused experimental code
  'lib/agents/PersonaAgentFactory.js',
  'lib/agents/UnifiedAgentFactory.js',
  
  // Unused Slack handler that uses UnifiedAgentFactory
  'lib/slack/messageHandlerVolt.js',
  
  // Legacy LLM files already in legacy folder (no action needed)
  // lib/llm/legacy/* - already organized
  
  // Unused chat file
  'lib/chat/openaiClientVolt.js',
  
  // Old project generation files replaced by Volt versions
  'lib/project-generation/projectGenerationService.js',
  'lib/project-generation/streamingService.js',
  
  // Unused webhook processor (replaced by Volt version)
  'lib/webhooks/WebhookProcessor.js',
  
  // Unused SDK file
  'lib/sdk/ProjectReadOnlySDK.js',
  
  // Unused repo generator
  'lib/repo-generator-agent.js'
];

// Archive directory with timestamp
const archiveDir = path.join(projectRoot, '_ARCHIVE', new Date().toISOString().split('T')[0]);

async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function archiveFile(relativePath) {
  const sourcePath = path.join(projectRoot, relativePath);
  const targetPath = path.join(archiveDir, relativePath);
  const targetDir = path.dirname(targetPath);
  
  // Check if source exists
  if (!await fileExists(sourcePath)) {
    console.log(`⚠️  Skipping ${relativePath} - file not found`);
    return false;
  }
  
  // Ensure target directory exists
  await ensureDir(targetDir);
  
  try {
    // Move the file
    await fs.rename(sourcePath, targetPath);
    console.log(`✅ Archived: ${relativePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error archiving ${relativePath}:`, error.message);
    return false;
  }
}

async function createArchiveReadme() {
  const readmePath = path.join(archiveDir, 'README.md');
  const content = `# Archived Dead Code

This directory contains files that were identified as dead code and archived on ${new Date().toISOString()}.

## Archive Reason

These files were identified as unused by:
1. Running \`npx unimported\` to find unimported files
2. Manual analysis of import chains and usage patterns
3. Verification that active code paths don't use these files

## Files Archived

${filesToArchive.map(f => `- ${f}`).join('\n')}

## Analysis Summary

### Agent System
- **PersonaAgentFactory.js** and **UnifiedAgentFactory.js** were part of an experimental agent architecture
- Only used by **messageHandlerVolt.js**, which itself is not used in production
- Production uses the EditorChat system with Volt Agent SDK

### Project Generation
- **projectGenerationService.js** and **streamingService.js** were replaced by Volt versions
- Active code uses the *Volt.js versions exclusively

### Other Files
- **WebhookProcessor.js** replaced by WebhookProcessorVolt.js
- **openaiClientVolt.js** - no imports found
- **ProjectReadOnlySDK.js** - no imports found
- **repo-generator-agent.js** - no imports found

## Restoration

If any of these files need to be restored:
1. Copy the file from this archive back to its original location
2. Update any necessary imports
3. Remove the file from the \`filesToArchive\` list in the archive script
`;

  await fs.writeFile(readmePath, content);
  console.log('📝 Created archive README.md');
}

async function main() {
  console.log('🗄️  Starting dead code archival process...\n');
  
  // Create archive directory
  await ensureDir(archiveDir);
  
  // Archive each file
  let archivedCount = 0;
  for (const file of filesToArchive) {
    if (await archiveFile(file)) {
      archivedCount++;
    }
  }
  
  // Create README in archive
  if (archivedCount > 0) {
    await createArchiveReadme();
    console.log(`\n✨ Archived ${archivedCount} files to ${archiveDir}`);
  } else {
    console.log('\n⚠️  No files were archived');
  }
  
  // Suggest next steps
  console.log('\n📋 Next steps:');
  console.log('1. Run tests to ensure nothing is broken');
  console.log('2. Run `npm run dev` to verify the application starts correctly');
  console.log('3. Commit the changes if everything works');
  console.log('4. Consider adding the _ARCHIVE directory to .gitignore if not already done');
}

// Run the script
main().catch(console.error);