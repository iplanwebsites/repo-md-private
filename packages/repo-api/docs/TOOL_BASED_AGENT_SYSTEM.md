# Tool-Based Agent System Documentation

## Overview

The Tool-Based Agent System provides a unified, flexible architecture for AI agents across multiple interfaces (Editor Chat, Slack, and Public API). It features composable tools, context-aware execution, and support for multi-agent workflows.

### Recent Improvements

- **Reduced Code Repetition**: Introduced factory functions and base classes following DRY principles
- **Enhanced Error Handling**: Centralized error management with custom error types and recovery strategies
- **Simplified Tool Creation**: New `BaseTool` class and `createTool` factory for consistent tool implementation
- **Optimized Performance**: Parallel tool execution and efficient context management
- **Better Type Safety**: Added JSDoc annotations for improved IDE support

## Architecture

### Core Components

1. **Agent Archetypes** (`lib/chat/aiPromptConfigs.js`)

   - Pre-defined agent personalities with specific behaviors and capabilities
   - Archetypes: GENERALIST, CODE_GENERATOR, CODE_REVIEWER, DEPLOYMENT_MANAGER, PUBLIC_ASSISTANT

2. **Tool Catalogue** (`lib/llm/tools/catalogue.js`)

   - Centralized registry of all available tools
   - Categories: file_management, code_analysis, search, github, deployment, communication, agent_spawning

3. **Tool Executor** (`lib/llm/toolExecutor.js`)

   - Handles tool execution with context management
   - Supports parallel, sequential, conditional, and iterative execution strategies
   - Manages sub-agent spawning and workflows

4. **Integration Interfaces**
   - Editor Chat: Full-featured IDE integration
   - Slack: Conversational interface with thread awareness
   - Public API: Rate-limited, read-only access

## Agent Archetypes

### GENERALIST

- **Purpose**: Clarifies requirements and delegates to specialists
- **Behaviors**: CLARIFIER, SCHEDULER
- **Capabilities**: Search, Communication, Agent Spawning
- **Use Cases**: Complex tasks requiring planning, unclear requirements

### CODE_GENERATOR

- **Purpose**: Creates high-quality code implementations
- **Behaviors**: EXECUTOR
- **Capabilities**: File Management, Code Analysis, Search
- **Use Cases**: Feature implementation, code generation

### CODE_REVIEWER

- **Purpose**: Analyzes code for quality and improvements
- **Behaviors**: ANALYZER
- **Capabilities**: Code Analysis, Search
- **Use Cases**: Code reviews, security audits, performance analysis

### DEPLOYMENT_MANAGER

- **Purpose**: Manages deployments and releases
- **Behaviors**: EXECUTOR
- **Capabilities**: Deployment, GitHub, Communication
- **Use Cases**: Production deployments, rollbacks, environment management

### PUBLIC_ASSISTANT

- **Purpose**: Provides read-only project information
- **Behaviors**: ANALYZER
- **Capabilities**: Search (read-only)
- **Use Cases**: Public documentation, project exploration

## Tool Categories

### File Management Tools

```javascript
- createFile: Create new files
- editFile: Modify existing files
- deleteFile: Remove files
- moveFile: Relocate files
- listFiles: Browse directory contents
- readFile: Read file contents
```

### Code Analysis Tools

```javascript
- analyzeCodeStructure: Examine architecture
- findDependencies: Map dependencies
- detectPatterns: Identify code patterns
- suggestImprovements: Recommend enhancements
```

### Search Tools

```javascript
- searchProjectFiles: Full-text search
- searchDocumentation: Documentation search
- semanticSearch: AI-powered search
- searchProjectReadOnly: Public search
- getProjectStructure: Project overview
```

### GitHub Tools

```javascript
- createRepository: Initialize repos
- pushToGitHub: Push changes
- createPullRequest: Open PRs
- manageBranches: Branch operations
```

### Deployment Tools

```javascript
- deployProject: Deploy to production
- checkDeploymentStatus: Monitor deployments
- rollbackDeployment: Revert changes
- updateEnvironment: Manage env vars
```

### Communication Tools

```javascript
- sendSlackMessage: Post to Slack
- createNotification: In-app alerts
- scheduleMessage: Delayed messages
```

### Agent Tools

```javascript
- spawnSpecialistAgent: Create sub-agents
- delegateTask: Smart delegation
- coordinateAgents: Multi-agent workflows
- getAgentStatus: Monitor agents
```

## Usage Examples

### Editor Chat Integration

```javascript
import { EditorChatHandler } from "./lib/llm/editorChat.js";

// Create handler with specific archetype
const handler = new EditorChatHandler({
  user,
  org,
  project,
  agentArchetype: "CODE_GENERATOR", // or 'GENERALIST', etc.
});

await handler.initialize();
const response = await handler.sendMessage(
  "Create a user authentication system"
);
```

### Slack Integration

```javascript
// In SlackMessageHandler
const archetype = this.determineArchetype(parsedCommand, threadContext);
const agentConfig = createAgentConfig({
  interface: "slack",
  archetype,
  context,
  availableTools,
});
```

### Public API Usage

```bash
# Get project information
GET /api/public/agent/projects/:projectId

# Chat about a project
POST /api/public/agent/chat
{
  "projectId": "project123",
  "message": "What technologies does this project use?",
  "sessionId": "optional-session-id"
}

# Search public projects
POST /api/public/agent/search
{
  "query": "react typescript",
  "limit": 10
}
```

## Tool Development Guide

### Creating a New Tool (Simplified with BaseTool)

1. **Using the createTool factory**:

```javascript
import { createTool, validators, responses } from "./baseTool.js";

const myNewTool = createTool({
  definition: {
    name: "myNewTool",
    description: "What this tool does",
    parameters: {
      type: "object",
      properties: {
        param1: { type: "string", description: "Parameter description" },
      },
      required: ["param1"],
    },
  },
  implementation: async (args, context) => {
    // Validation is handled automatically
    const { param1 } = args;

    // Use built-in validators if needed
    const validation = validators.validateString(
      param1,
      {
        minLength: 3,
        maxLength: 100,
      },
      "param1"
    );

    if (!validation.valid) {
      return responses.error(validation.error);
    }

    // Tool logic here
    const result = await doSomething(param1);

    // Use standard response builders
    return responses.success(result, "Operation completed successfully");
  },
  category: "file_management",
  requiredPermissions: ["read", "write"],
  requiredContext: ["project", "user"],
  rateLimit: { requests: 10, window: "1h" },
  costEstimate: "low",
});
```

2. **Creating multiple tools with shared configuration**:

```javascript
import { createToolBatch } from "./baseTool.js";

const fileTools = createToolBatch(
  [
    {
      definition: { name: "readFile" /* ... */ },
      implementation: async (args, context) => {
        /* ... */
      },
    },
    {
      definition: { name: "writeFile" /* ... */ },
      implementation: async (args, context) => {
        /* ... */
      },
    },
  ],
  {
    // Shared configuration for all tools
    category: "file_management",
    requiredContext: ["project", "user"],
    costEstimate: "low",
  }
);
```

2. **Add to appropriate tool module**:

```javascript
// In lib/llm/tools/myToolCategory.js
module.exports = {
  myNewTool,
  // other tools...
};
```

3. **Register in catalogue**:

```javascript
// In lib/llm/tools/catalogue.js
const MY_CATEGORY_TOOLS = [
  enrichTool(myToolCategory.myNewTool, "my_category"),
].filter(Boolean);
```

## Multi-Agent Workflows

### Predefined Workflows

1. **Clarify Then Execute**:

   - GENERALIST clarifies requirements
   - Hands off to CODE_GENERATOR for implementation

2. **Review and Improve**:

   - CODE_GENERATOR creates initial implementation
   - CODE_REVIEWER analyzes and suggests improvements
   - CODE_GENERATOR implements improvements

3. **Deploy with Validation**:
   - CODE_REVIEWER validates deployment readiness
   - DEPLOYMENT_MANAGER executes deployment

### Custom Workflows

```javascript
const customWorkflow = await toolExecutor.coordinateAgents({
  workflow: "custom",
  tasks: [
    { agent: "CODE_GENERATOR", task: "Generate API endpoints" },
    {
      agent: "CODE_REVIEWER",
      task: "Review security",
      dependsOn: "CODE_GENERATOR",
    },
    {
      agent: "DEPLOYMENT_MANAGER",
      task: "Deploy to staging",
      dependsOn: "CODE_REVIEWER",
    },
  ],
  context: { project, environment: "staging" },
});
```

## Context Management

### Context Structure

```javascript
{
  user: { _id, name, permissions },
  org: { _id, name, settings },
  project: { _id, name, techStack, members },
  auth: boolean,
  permissions: ['read', 'write', 'admin', 'deploy'],
  conversation: { threadId, messageCount, topics },
  session: { id, type }
}
```

### Permission Levels

- **read**: View project files and information
- **write**: Modify project files
- **admin**: Project administration
- **deploy**: Deployment operations

## Security Considerations

1. **Authentication**:

   - Editor Chat: JWT token validation
   - Slack: OAuth integration
   - Public API: No auth, read-only access

2. **Rate Limiting**:

   - Public endpoints: 50 requests/15 minutes
   - Conversation endpoints: 20 requests/5 minutes
   - Per-session message limits

3. **Tool Permissions**:
   - Tools validate required permissions
   - Context-based access control
   - Sensitive operations require elevated permissions

## Configuration

### Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1

# Helicone Analytics (optional)
HELICONE_AUTH=your-helicone-key

# Model Settings
DEFAULT_MODEL=gpt-4.1-mini
DEFAULT_TEMPERATURE=0.7

# Rate Limiting
PUBLIC_API_RATE_LIMIT=50
PUBLIC_API_WINDOW_MS=900000
```

### Model Configuration

- Authenticated users: GPT-4 Turbo
- Public users: GPT-3.5 Turbo
- Temperature varies by archetype (0.3 for analyzers, 0.7 for generators)

## Monitoring and Debugging

### Execution History

```javascript
const history = toolExecutor.getExecutionHistory({
  tool: "createFile",
  status: "failed",
  since: Date.now() - 3600000, // Last hour
});
```

### Active Agents

```javascript
const activeAgents = toolExecutor.getActiveSubAgents();
const agentStatus = await toolExecutor.getAgentStatus(agentId);
```

### Debug Mode

```javascript
const handler = new EditorChatHandler({
  debug: true, // Enable debug logging
  // other options...
});
```

## Best Practices

1. **Agent Selection**:

   - Use GENERALIST for unclear requirements
   - Use specialists for specific tasks
   - Let agents delegate when appropriate

2. **Tool Design**:

   - Keep tools focused and single-purpose
   - Validate inputs thoroughly
   - Return structured, consistent responses
   - Handle errors gracefully

3. **Context Passing**:

   - Include only necessary context
   - Sanitize sensitive information
   - Preserve context across tool calls

4. **Performance**:
   - Use parallel execution when possible
   - Cache frequently accessed data
   - Implement appropriate rate limits

## Troubleshooting

### Common Issues

1. **Tool not available**:

   - Check agent archetype capabilities
   - Verify required permissions
   - Ensure context requirements are met

2. **Execution failures**:

   - Check tool implementation errors
   - Verify context structure
   - Review permission requirements

3. **Performance issues**:
   - Enable debug logging
   - Check execution history
   - Monitor active sub-agents

### Debug Commands

```javascript
// Check available tools for an archetype
const tools = getToolsForArchetype("CODE_GENERATOR", archetype.capabilities);

// Validate tool execution
const validation = validateToolExecution(tool, args, context);

// Search for tools
const searchResults = searchTools("deploy", {
  category: "deployment",
  permissions: ["deploy"],
});
```

## Future Enhancements

1. **Planned Features**:

   - Real-time collaboration between agents
   - Advanced workflow templates
   - Custom agent training
   - Tool versioning and rollback

2. **Integration Points**:
   - VS Code extension
   - GitHub Actions
   - CI/CD pipelines
   - Third-party tool integrations

## Error Handling

### Custom Error Types

```javascript
import {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ToolExecutionError,
} from "./lib/llm/errorHandler.js";

// Throw specific errors
throw new ValidationError("Invalid input", { field: "projectId" });
throw new AuthorizationError("Admin access required");
throw new NotFoundError("Project");
throw new RateLimitError(60); // Retry after 60 seconds
```

### Error Recovery Strategies

```javascript
import { recovery } from "./lib/llm/errorHandler.js";

// Retry with exponential backoff
const result = await recovery.retry(async () => await riskyOperation(), {
  maxAttempts: 3,
  initialDelay: 1000,
  onRetry: (error, attempt, delay) => {
    console.log(`Retry ${attempt} after ${delay}ms`);
  },
});

// Circuit breaker pattern
const data = await recovery.circuitBreaker(
  "external-api",
  async () => await callExternalAPI(),
  {
    threshold: 5,
    timeout: 30000,
    resetTimeout: 60000,
  }
);
```

## Performance Optimizations

### Parallel Tool Execution

Tools are executed in parallel when possible, significantly improving response times:

```javascript
// Old sequential approach (avoided)
for (const tool of tools) {
  await executeTool(tool);
}

// New parallel approach (preferred)
const results = await Promise.all(tools.map((tool) => executeTool(tool)));
```

### Efficient Context Management

- Context is built once and reused across tool executions
- Permissions are cached per session
- Tool selection uses Map for O(1) lookups

## API Reference

### Core Modules

- **[Agent Configuration](../lib/chat/aiPromptConfigs.js)** - Agent archetypes and prompt management
- **[Tool Catalogue](../lib/llm/tools/catalogue.js)** - Tool registry and selection
- **[Tool Executor](../lib/llm/toolExecutor.js)** - Tool execution and workflow orchestration
- **[Base Tool](../lib/llm/tools/baseTool.js)** - Base class and utilities for tools
- **[Error Handler](../lib/llm/errorHandler.js)** - Centralized error management

### Route Handlers

- **[Public API Routes](../routes/express/publicAgentRoutes.js)** - Public-facing agent endpoints
- **[Editor Chat Routes](../routes/express/editorChatStreamRoutes.js)** - IDE integration endpoints

### Enhanced Implementations

- **[Editor Chat Enhanced](../lib/llm/editorChatEnhanced.js)** - Optimized chat handler
