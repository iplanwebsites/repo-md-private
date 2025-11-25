# Archived Dead Code

This directory contains files that were identified as dead code and archived on 2025-07-03T02:09:49.819Z.

## Archive Reason

These files were identified as unused by:
1. Running `npx unimported` to find unimported files
2. Manual analysis of import chains and usage patterns
3. Verification that active code paths don't use these files

## Files Archived

- lib/agents/PersonaAgentFactory.js
- lib/agents/UnifiedAgentFactory.js
- lib/slack/messageHandlerVolt.js
- lib/chat/openaiClientVolt.js
- lib/project-generation/projectGenerationService.js
- lib/project-generation/streamingService.js
- lib/webhooks/WebhookProcessor.js
- lib/sdk/ProjectReadOnlySDK.js
- lib/repo-generator-agent.js

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
3. Remove the file from the `filesToArchive` list in the archive script
