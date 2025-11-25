# Composable Agents Migration Guide

## Overview

This guide explains the new composable agent architecture and how to migrate from the previous inheritance-based system.

## Architecture Changes

### Previous Architecture
```
EditorChatHandler (editorChat.js)
    ↓ extends
EditorChatHandlerVoltBasic (editorChatVoltBasic.js)
```

### New Architecture
```
AgentComposer
    ↓ composes
    ├── EditorAgent (file ops, code, GitHub, etc.)
    └── ContentAgent (RepoMD content operations)
```

## Key Benefits

1. **Modular Design**: Each agent focuses on specific capabilities
2. **Dynamic Composition**: Add/remove agents at runtime
3. **Better Separation**: Clear boundaries between different functionalities
4. **Easier Testing**: Test individual agents in isolation
5. **Future Extensibility**: Add new agents without modifying existing code

## New Components

### 1. BaseAgent (`lib/llm/agents/BaseAgent.js`)
- Foundation class for all agents
- Handles Volt SDK integration
- Provides tool management and streaming

### 2. AgentComposer (`lib/llm/agents/AgentComposer.js`)
- Combines multiple agents
- Manages tool aggregation
- Provides routing strategies

### 3. EditorAgent (`lib/llm/agents/EditorAgent.js`)
- Specialized for code editing operations
- Handles file operations, GitHub, deployment
- Uses the existing tool catalogue

### 4. ContentAgent (`lib/llm/agents/ContentAgent.js`)
- Specialized for RepoMD content
- Uses native RepoMD tools
- Handles documentation and wiki operations

### 5. EditorChatComposable (`lib/llm/editorChatComposable.js`)
- New implementation using AgentComposer
- Maintains backward compatibility
- Composes EditorAgent and ContentAgent

## Migration Steps

### 1. Update Imports

**Before:**
```javascript
import { EditorChatHandler } from "./lib/llm/editorChat.js";
```

**After:**
```javascript
import { EditorChatHandler } from "./lib/llm/editorChatComposable.js";
```

### 2. No API Changes Required

The new implementation maintains the same API:
- `new EditorChatHandler(options)`
- `handler.sendMessage(content, options)`
- `handler.streamResponse(prompt, options)`
- `handler.generateTitle()`

### 3. New Capabilities

You can now add custom agents at runtime:

```javascript
// Create a custom agent
class CustomAgent extends BaseAgent {
  async loadTools() {
    // Add custom tools
  }
}

// Add to existing chat handler
const customAgent = new CustomAgent({ /* options */ });
await handler.addDynamicAgent(customAgent, {
  id: "custom",
  priority: 15,
  capabilities: ["custom-feature"]
});
```

## Testing Strategy

1. **Unit Tests**: Test individual agents (EditorAgent, ContentAgent)
2. **Integration Tests**: Test AgentComposer with multiple agents
3. **Compatibility Tests**: Ensure existing code works with new implementation

## Rollback Plan

If issues arise, you can rollback by:
1. Changing imports back to the original `editorChat.js`
2. The old files remain unchanged and functional

## Future Enhancements

The composable architecture enables:

1. **Specialized Agents**:
   - SecurityAgent for security analysis
   - PerformanceAgent for optimization
   - TestingAgent for test generation

2. **Dynamic Loading**:
   - Load agents based on user permissions
   - Enable/disable features dynamically

3. **Agent Marketplace**:
   - Third-party agent development
   - Plugin-style agent system

## Example: Creating a New Agent

```javascript
import { BaseAgent } from "./BaseAgent.js";
import { createTool } from "@voltagent/core";
import { z } from "zod";

export class SecurityAgent extends BaseAgent {
  constructor(options) {
    super({
      name: "SecurityAgent",
      description: "Analyzes code for security vulnerabilities",
      ...options
    });
  }

  async loadTools() {
    this.tools = [
      createTool({
        name: "scan_vulnerabilities",
        description: "Scan code for security vulnerabilities",
        parameters: z.object({
          filePath: z.string().describe("Path to file to scan"),
          scanType: z.enum(["basic", "deep"]).optional()
        }),
        execute: async ({ filePath, scanType = "basic" }) => {
          // Implementation here
          return { vulnerabilities: [] };
        }
      })
    ];
  }
}

// Add to EditorChat
await handler.addDynamicAgent(new SecurityAgent(), {
  id: "security",
  priority: 25,
  capabilities: ["security", "vulnerability", "scan"]
});
```

## Monitoring and Metrics

The new architecture provides better visibility:

```javascript
// Get current agent composition
const composition = handler.getAgentComposition();
console.log(composition.composedAgents);

// Monitor tool usage
handler.on('toolExecuted', (event) => {
  console.log(`Tool ${event.toolName} executed by ${event.agentId}`);
});
```

## Support

For questions or issues with the migration:
1. Check the test files for usage examples
2. Review the component documentation
3. File an issue with the `composable-agents` tag