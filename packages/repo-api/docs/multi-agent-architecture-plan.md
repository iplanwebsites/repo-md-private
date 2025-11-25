# Multi-Agent Conversation Architecture Plan

## Overview

We need to support multiple types of conversational agents with different:
- **Contexts** (org-level, project-level, public)
- **Auth requirements** (authenticated users vs public)
- **Tool sets** (editor tools vs read-only tools)
- **System prompts** (hardcoded vs user-defined)

## Agent Types

### 1. EditorAgent (Current Implementation)
- **Context**: Org/User level
- **Auth**: Required (authenticated users)
- **Tools**: File operations, GitHub, search
- **Prompts**: Hardcoded professional prompts
- **Use Cases**: 
  - Project generation
  - Code editing
  - General org assistance

### 2. ProjectAgent (New)
- **Context**: Project-specific
- **Auth**: Required (project members)
- **Tools**: Project-specific file operations, search
- **Prompts**: Hardcoded + project context
- **Use Cases**:
  - Edit existing project code
  - Answer questions about the project
  - Refactor/improve code

### 3. PublicProjectAgent (New)
- **Context**: Project-specific (read-only)
- **Auth**: None (public access)
- **Tools**: Read-only search, documentation lookup
- **Prompts**: User-defined by project owner
- **Use Cases**:
  - Public Q&A about the project
  - Documentation assistant
  - Code explanation

## Database Schema Updates

### Conversations Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,           // null for public conversations
  orgId: ObjectId,           // optional
  projectId: ObjectId,       // optional
  
  // Agent configuration
  agentType: 'editor' | 'project' | 'public_project',
  agentConfig: {
    systemPrompt: String,    // custom for public agents
    allowedTools: [String],  // tool restrictions
    model: String,
    temperature: Number
  },
  
  // Conversation data
  messages: [...],
  context: {
    files: {},              // for editor agent
    projectContext: {},     // for project agents
    ...
  },
  
  // Metadata
  isPublic: Boolean,
  sessionId: String,        // for anonymous users
  createdAt: Date,
  updatedAt: Date
}
```

## Implementation Plan

### Step 1: Agent Registry System
```javascript
// lib/llm/agents/registry.js
const agentRegistry = {
  editor: {
    auth: 'required',
    defaultPrompt: 'You are an expert developer...',
    tools: ['fileTools', 'githubTools', 'searchTools'],
    contextBuilder: editorContextBuilder
  },
  project: {
    auth: 'project_member',
    defaultPrompt: 'You are a project assistant...',
    tools: ['projectFileTools', 'searchTools'],
    contextBuilder: projectContextBuilder
  },
  public_project: {
    auth: 'none',
    defaultPrompt: null, // User-defined
    tools: ['readOnlySearchTools', 'docTools'],
    contextBuilder: publicProjectContextBuilder
  }
};
```

### Step 2: Context Builders
```javascript
// lib/llm/agents/contextBuilders.js
- editorContextBuilder(userId, orgId)
- projectContextBuilder(projectId, userId)
- publicProjectContextBuilder(projectId)
```

### Step 3: Tool Access Control
```javascript
// lib/llm/tools/toolRegistry.js
- Tool permission system
- Read-only tool variants
- Project-scoped tool execution
```

### Step 4: Conversation Helpers
```javascript
// lib/llm/conversationHelpers.js
- getOrgConversations(orgId, agentType?)
- getProjectConversations(projectId, agentType?)
- getUserConversations(userId, filters)
- getPublicProjectConversations(projectId)
```

### Step 5: Route Updates
```javascript
// Authenticated routes
POST   /api/llm/conversations                    // Org-level editor
POST   /api/llm/projects/:id/conversations      // Project-specific
GET    /api/llm/projects/:id/conversations      // List project convos
GET    /api/llm/org/conversations               // List org convos

// Public routes  
POST   /api/llm/public/projects/:id/chat        // Public project chat
GET    /api/llm/public/projects/:id/conversations // Public chat history
```

### Step 6: Project Agent Configuration
```javascript
// New project settings
{
  publicAgentEnabled: Boolean,
  publicAgentConfig: {
    systemPrompt: String,
    welcomeMessage: String,
    suggestedQuestions: [String],
    rateLimits: {
      messagesPerHour: Number,
      tokensPerHour: Number
    }
  }
}
```

## Key Design Decisions

1. **Agent Registry**: Central place to define agent behavior
2. **Context Builders**: Modular context injection per agent type
3. **Tool Permissions**: Granular control over what each agent can do
4. **Session Management**: Support for anonymous users via sessionId
5. **Rate Limiting**: Essential for public agents
6. **Audit Trail**: All conversations linked to projects/orgs

## Migration Path

1. Current conversations become `agentType: 'editor'`
2. Add `projectId` field to existing project-related conversations
3. Default `isPublic: false` for all existing conversations

## Security Considerations

1. Public agents can only use read-only tools
2. Project agents verify membership before allowing edits
3. Rate limiting on public endpoints
4. Sanitize user-defined prompts
5. Audit logging for all tool executions