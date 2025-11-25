# LLM Tools and Agents Architecture

## Overview

This document explains the architecture of the LLM system, including agents, tools, and their interactions. The system has evolved from a simple OpenAI integration to a sophisticated composable agent architecture using the Volt Agent SDK.

## Core Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│  (SharedChatService, Slack Integration, tRPC Routes)    │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│                     Agent Layer                          │
│  (EditorChatHandler, AgentComposer, Specialized Agents) │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│                     Tool Layer                           │
│  (Tool Catalogue, Tool Executor, Tool Definitions)      │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│                 Infrastructure Layer                     │
│  (Volt SDK, Database, File System, External APIs)       │
└─────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Agent System

#### Base Architecture (`agents/`)

- **BaseAgent.js**: Foundation class for all agents

  - Volt SDK integration
  - Tool management and conversion
  - Streaming support
  - Context management

- **AgentComposer.js**: Combines multiple agents
  - Dynamic agent composition
  - Tool aggregation
  - Routing strategies (auto, manual, toolBased)
  - Runtime agent management

#### Specialized Agents

- **EditorAgent.js**: Code editing and project management

  - File operations
  - GitHub integration
  - Deployment tools
  - Search and analysis

- **ContentAgent.js**: RepoMD content operations

  - Uses native RepoMD tools
  - Documentation navigation
  - Wiki operations

- **projectContentAgent.js**: Legacy subagent pattern
  - Being replaced by ContentAgent
  - Shows evolution of the architecture

#### Agent Registry (`agents/registry.js`)

```javascript
// Agent types definition
AGENT_TYPES = {
  EDITOR: "editor",
  PROJECT: "project",
  PUBLIC_PROJECT: "public_project",
};
```

### 2. Tool System

#### Tool Catalogue (`tools/catalogue.js`)

Central registry of all available tools, organized by category:

```javascript
TOOL_CATEGORIES = {
  FILE_MANAGEMENT: [
    "readFile",
    "writeFile",
    "createDirectory",
    "moveFile",
    "deleteFile",
    "searchFiles",
  ],
  CODE_ANALYSIS: [
    "analyzeCode",
    "findReferences",
    "getDefinition",
    "getDependencies",
    "getCallHierarchy",
  ],
  GITHUB: [
    "createPullRequest",
    "mergePullRequest",
    "createIssue",
    "getRepositoryInfo",
    "createBranch",
  ],
  DEPLOYMENT: [
    "deployProject",
    "getDeploymentStatus",
    "rollbackDeployment",
    "getDeploymentLogs",
  ],
  // ... more categories
};
```

#### Tool Executor (`toolExecutor.js`)

Executes tools with proper context and error handling:

```javascript
class ToolExecutor {
  async execute(toolName, args) {
    // 1. Validate permissions
    // 2. Prepare context
    // 3. Execute tool implementation
    // 4. Handle errors
    // 5. Return formatted result
  }
}
```

#### Tool Implementations (`tools/implementations/`)

Actual tool logic organized by category:

- `fileTools.js`: File system operations
- `githubTools.js`: GitHub API interactions
- `searchTools.js`: Code and content search
- `deploymentTools.js`: Deployment operations
- `analysisTools.js`: Code analysis tools

### 3. Chat Handlers

#### EditorChatHandler Evolution

1. **Legacy**: `editorChatOpenAI.js` (archived)

   - Direct OpenAI API integration
   - Simple tool execution

2. **Current**: `editorChatVoltBasic.js` + `editorChat.js`

   - Inheritance-based architecture
   - Volt SDK integration
   - Subagent support

3. **Future**: `editorChatComposable.js`
   - Composition-based architecture
   - Dynamic agent management
   - Better separation of concerns

#### SharedChatService (`sharedChatService.js`)

Bridges different chat interfaces:

- Web UI chat sessions
- Slack conversations
- Maintains unified chat history
- Handles cross-platform message formatting

### 4. Context Management

#### Project Context (`projectContext.js`)

```javascript
// Loads and manages project-specific context
async function loadProjectContext(projectId) {
  // 1. Load project configuration
  // 2. Analyze codebase structure
  // 3. Load documentation
  // 4. Generate system prompts
}
```

#### Context Builders (`agents/contextBuilders.js`)

Builds context for different agent types:

- User permissions
- Organization settings
- Project metadata
- Tool availability

### 5. Conversation Management

#### ConversationVolt (`conversationVolt.js`)

Handles SSE streaming for real-time responses:

```javascript
class ConversationVolt {
  async *streamResponse(prompt, options) {
    // 1. Initialize stream
    // 2. Process through agent
    // 3. Yield chunks
    // 4. Handle errors
  }
}
```

## Tool Execution Flow

```
User Message
    ↓
EditorChatHandler
    ↓
Tool Detection (via LLM)
    ↓
Tool Catalogue Lookup
    ↓
Permission Check
    ↓
Tool Executor
    ↓
Tool Implementation
    ↓
Result Formatting
    ↓
Response to User
```

## Agent Composition Example

```javascript
// Current approach (inheritance)
class EditorChatHandler extends EditorChatHandlerVoltBasic {
  // Enhanced with subagents
}

// New approach (composition)
const handler = new AgentComposer({
  name: "EditorChat",
  routingStrategy: "toolBased",
});

await handler.addAgent(new EditorAgent(), {
  id: "editor",
  priority: 10,
  capabilities: ["file", "code", "github"],
});

await handler.addAgent(new ContentAgent(), {
  id: "content",
  priority: 20,
  toolPrefix: "content",
  capabilities: ["documentation", "wiki"],
});
```

## Configuration and Archetypes

### Agent Archetypes (`../chat/aiPromptConfigs.js`)

Defines different agent personalities and capabilities:

```javascript
AGENT_ARCHETYPES = {
  GENERALIST: {
    description: "General-purpose assistant",
    systemPrompt: "...",
    temperature: 0.7,
  },
  PROJECT_NAVIGATOR: {
    description: "Specialized in project navigation",
    systemPrompt: "...",
    temperature: 0.5,
  },
  CODE_EXPERT: {
    description: "Expert in code analysis and generation",
    systemPrompt: "...",
    temperature: 0.3,
  },
};
```

### Model Configuration (`../chat/openaiClient.js`)

Maps archetypes to AI models:

```javascript
function getAiModelConfig(archetype) {
  return {
    modelId: "gpt-4.1-mini",
    temperature: ARCHETYPE_TEMPS[archetype],
    maxTokens: 4096,
  };
}
```

## Database Integration

### Chat Storage (`../db/editorChat.js`)

Manages chat persistence:

- Create/read/update chat sessions
- Store messages with metadata
- Track tool usage
- Maintain conversation history

## Security and Permissions

### Permission Layers

1. **System Role**: Admin, Editor, Viewer
2. **Organization Role**: Owner, Admin, Member
3. **Project Access**: Read, Write, Admin
4. **Tool Permissions**: Based on role combination

### Tool Permission Matrix

```
Tool Category    | System Admin | Org Admin | Project Owner | Member
-----------------|--------------|-----------|---------------|--------
File Write       |      ✓       |     ✓     |       ✓       |   ✗
Deploy           |      ✓       |     ✓     |       ✓       |   ✗
GitHub PR        |      ✓       |     ✓     |       ✓       |   ✓
Read Operations  |      ✓       |     ✓     |       ✓       |   ✓
```

## Integration Points

### 1. Web Interface

- tRPC routes: `/routes/trpc/editorChatRouter.js`
- WebSocket support for streaming
- Session management

### 2. Slack Integration

- Message handler: `../slack/messageHandlerIntegrated.js`
- Thread context awareness
- Cross-platform chat linking

### 3. API Endpoints

- REST API for webhooks
- GraphQL for complex queries (planned)
- SDK for external integrations

## Performance Considerations

### Tool Execution Optimization

- Parallel tool execution when possible
- Result caching for expensive operations
- File tracker to minimize redundant reads

### Streaming Architecture

- Server-sent events for real-time responses
- Chunked processing for large operations
- Backpressure handling

## Future Enhancements

### 1. Dynamic Tool Loading

```javascript
// Planned: Load tools from external sources
await toolCatalogue.registerDynamicTool({
  source: "npm:@company/custom-tools",
  permissions: ["admin"],
});
```

### 2. Agent Marketplace

- Third-party agent development
- Sandboxed execution
- Revenue sharing model

### 3. Advanced Routing

- ML-based agent selection
- Cost-optimized routing
- Capability matching

## Debugging and Monitoring

### Debug Flags

```javascript
// Enable detailed logging
const DEBUG = process.env.DEBUG_LLM === "true";

// Tool execution tracing
const TRACE_TOOLS = process.env.TRACE_TOOLS === "true";
```

### Metrics Collection

- Tool usage statistics
- Response time tracking
- Error rate monitoring
- Token usage optimization

## Best Practices

### 1. Tool Development

- Keep tools focused and single-purpose
- Implement proper error handling
- Return structured results
- Document parameters clearly

### 2. Agent Composition

- Use specialized agents for specific domains
- Avoid tool name conflicts with prefixes
- Set appropriate priorities
- Define clear capabilities

### 3. Context Management

- Minimize context size for efficiency
- Cache expensive context operations
- Update context incrementally
- Clear sensitive data

## Migration Notes

### From Legacy to Current

1. OpenAI API → Volt SDK
2. Monolithic → Modular tools
3. Static → Dynamic composition
4. Simple → Rich context

### Current to Composable

1. Inheritance → Composition
2. Static agents → Dynamic agents
3. Fixed tools → Pluggable tools
4. Single agent → Multi-agent

## Troubleshooting

### Common Issues

1. **Tool not found**: Check tool registration and permissions
2. **Streaming errors**: Verify Volt SDK configuration
3. **Context too large**: Implement context pruning
4. **Agent conflicts**: Use tool prefixes and priorities

### Debug Commands

```javascript
// List available tools
handler.getMetadata().tools;

// Check agent composition
handler.getAgentComposition();

// Trace tool execution
handler.on("toolExecuted", console.log);
```

This architecture provides a flexible, extensible foundation for AI-powered development assistance while maintaining security, performance, and reliability.
