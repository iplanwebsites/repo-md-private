# Chat Backend Implementation Guide

## Overview
This document provides a comprehensive guide to the chat backend implementation in the Repo.md platform. The system uses a hybrid architecture combining Express REST APIs, tRPC procedures, and Server-Sent Events (SSE) for real-time streaming, all powered by the Volt Agent framework.

## Architecture Components

### 1. Core Chat Systems

#### EditorChat System
The main chat system for authenticated users with project-aware capabilities.

**Key Files:**
- `/lib/llm/editorChat.js` - Enhanced chat handler with Volt Agent integration and subagents
- `/lib/llm/editorChatVoltBasic.js` - Base implementation with streaming and tool execution
- `/lib/db/editorChat.js` - MongoDB model and database operations
- `/routes/express/editorChatStreamRoutes.js` - SSE streaming endpoints
- `/routes/trpc/editorChatRouter.js` - tRPC procedures for CRUD operations

#### Conversation System
General-purpose conversation handler with multi-agent support.

**Key Files:**
- `/lib/llm/conversationVolt.js` - Volt Agent-based conversation handler
- `/lib/llm/conversationHelpers.js` - Helper functions for conversation management
- `/routes/llm.js` - Express routes for OpenAI-compatible API

### 2. Database Schema

#### EditorChat Collection
```javascript
{
  _id: ObjectId,
  user: ObjectId,         // User who created the chat
  org: ObjectId,          // Organization context
  project: ObjectId,      // Optional project context
  title: String,          // Auto-generated or user-provided
  summary: String,        // AI-generated summary
  model: String,          // e.g., "gpt-4.1-mini"
  temperature: Number,    // 0-2, default 0.7
  messages: [{
    id: String,           // UUID
    role: String,         // "user", "assistant", "system", "tool"
    content: String,      // Message text
    attachments: Array,   // Images, files, etc.
    tool_calls: Array,    // Tool invocations
    timestamp: Date
  }],
  tasks: Array,           // Related tasks
  tokensUsed: {
    prompt: Number,
    completion: Number,
    total: Number
  },
  metadata: {
    agentArchetype: String,  // e.g., "GENERALIST", "PROJECT_NAVIGATOR"
    lastActivity: Date,
    branch: String,          // Git branch for changes
    slackThread: Object      // Slack integration data
  },
  createdAt: Date,
  updatedAt: Date
}
```

## SSE (Server-Sent Events) Implementation

### Streaming Endpoint: `/api/editorChat/stream/:chatId`

The SSE implementation provides real-time streaming of AI responses with proper buffering control and error handling.

#### Key Implementation Details

```javascript
// 1. Set SSE Headers
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering

// 2. Establish connection
res.write(':ok\n\n');

// 3. Stream data format
data: {"type":"content","content":"Hello "}
data: {"type":"content","content":"world!"}
data: {"type":"tool_call_start","tool_name":"search_files"}
data: {"type":"tool_result","tool_name":"search_files","result":{...}}
data: {"type":"done","tokensUsed":{"prompt":100,"completion":50}}
data: [DONE]
```

#### SSE Event Types

1. **content** - Streaming text chunks
2. **tool_call_start** - Tool execution beginning
3. **tool_result** - Tool execution result
4. **error** - Error messages
5. **done** - Completion with token usage
6. **[DONE]** - Final termination signal

### Client-Side SSE Integration

```javascript
// Frontend SSE consumption example
const eventSource = new EventSource(`/api/editorChat/stream/${chatId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

eventSource.onmessage = (event) => {
  if (event.data === '[DONE]') {
    eventSource.close();
    return;
  }
  
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'content':
      // Append to message display
      appendContent(data.content);
      break;
    case 'tool_call_start':
      // Show tool execution indicator
      showToolExecution(data.tool_name);
      break;
    case 'tool_result':
      // Display tool result
      showToolResult(data.tool_name, data.result);
      break;
    case 'error':
      // Handle error
      handleError(data.error);
      break;
    case 'done':
      // Update token usage
      updateTokenUsage(data.tokensUsed);
      break;
  }
};

eventSource.onerror = (error) => {
  console.error('SSE Error:', error);
  eventSource.close();
};
```

## Volt Agent Integration

### Agent Creation Flow

```javascript
// 1. Initialize EditorChatHandler
const handler = new EditorChatHandler({
  user,
  org,
  project,
  chatId,
  model: 'gpt-4.1-mini',
  temperature: 0.7,
  stream: true,
  enableStreaming: true,
  agentArchetype: 'GENERALIST'
});

// 2. Initialize (creates tools and agent)
await handler.initialize();

// 3. Send message with streaming
const stream = await handler.sendMessage(content, attachments, res);
```

### Tool System Architecture

#### Tool Loading Pipeline

1. **Tool Discovery** - Based on agent archetype and capabilities
2. **Tool Conversion** - Convert to Volt Agent format with Zod schemas
3. **Tool Execution** - Execute through ToolExecutor with proper context

```javascript
// Tool definition format
{
  name: "search_project_files",
  description: "Search for files in the project",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      fileTypes: { type: "array", items: { type: "string" } }
    },
    required: ["query"]
  },
  execute: async (args, context) => {
    // Tool implementation
    return result;
  }
}

// Converted to Volt format
createTool({
  name: "search_project_files",
  description: "Search for files in the project",
  parameters: z.object({
    query: z.string().describe("Search query"),
    fileTypes: z.array(z.string()).optional()
  }),
  execute: async (args) => {
    // Execution wrapper
    return { success: true, data: result };
  }
})
```

### Subagent System

For complex tasks, the system supports delegating to specialized subagents:

```javascript
// Content subagent for RepoMD integration
this.contentAgent = new Agent({
  name: "Content Agent",
  purpose: "Specialized agent for searching and retrieving project content",
  instructions: systemPrompt,
  llm: vercelAIProvider,
  model: openai(model),
  tools: repoMdTools,
  markdown: true,
  memory: false
});

// Main agent with subagents
this.agent = new Agent({
  name: "Main Agent",
  instructions: mainSystemPrompt,
  subAgents: [this.contentAgent],
  tools: mainTools
});
```

## API Endpoints

### REST API Endpoints

#### Streaming Endpoints
- `POST /api/editorChat/stream/:chatId` - Stream chat response (SSE)
- `GET /api/editorChat/test-sse` - Test SSE connection

#### Action Endpoints
- `POST /api/editorChat/:chatId/create-pr` - Create pull request from chat
- `POST /api/editorChat/:chatId/get-diff` - Get file changes diff

#### Conversation Endpoints
- `POST /api/llm/responses` - OpenAI-compatible streaming endpoint
- `POST /api/llm/conversations` - Start new conversation
- `POST /api/llm/conversations/:id/messages` - Send message

### tRPC Procedures

All tRPC procedures are available at `/trpc/*`:

```typescript
// EditorChat procedures
trpc.editorChat.create({ orgId, projectId?, title?, model?, temperature? })
trpc.editorChat.list({ orgId, projectId?, status?, limit?, skip? })
trpc.editorChat.get({ chatId })
trpc.editorChat.sendMessage({ chatId, content, attachments?, stream? })
trpc.editorChat.updateTitle({ chatId, title })
trpc.editorChat.delete({ chatId })
trpc.editorChat.fork({ chatId, messageId })
trpc.editorChat.regenerate({ chatId, messageId })
```

## Authentication & Authorization

### Authentication Flow
1. JWT token validation via `requireAuth` middleware
2. User context extraction from token
3. Organization membership verification
4. Project access validation (if applicable)

### Permission Levels
```javascript
getUserPermissions() {
  const permissions = ["read", "write"];
  
  if (project) {
    const member = project.members.find(m => m.userId === user._id);
    if (member.role === "owner" || member.role === "admin") {
      permissions.push("admin", "deploy");
    } else if (member.role === "editor") {
      permissions.push("deploy");
    }
  }
  
  return permissions;
}
```

## Frontend Integration Guide

### Basic Chat Implementation

```javascript
// 1. Create new chat
const { id: chatId } = await trpc.editorChat.create.mutate({
  orgId: currentOrg.id,
  projectId: currentProject?.id,
  model: 'gpt-4.1-mini',
  temperature: 0.7
});

// 2. Send message with streaming
const sendMessage = async (content, attachments = []) => {
  const response = await fetch(`/api/editorChat/stream/${chatId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      content,
      attachments,
      enableStreaming: true
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to send message');
  }
  
  // Handle SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          // Stream complete
          break;
        }
        
        try {
          const parsed = JSON.parse(data);
          handleStreamData(parsed);
        } catch (e) {
          console.error('Failed to parse SSE data:', e);
        }
      }
    }
  }
};

// 3. Handle different stream event types
const handleStreamData = (data) => {
  switch(data.type) {
    case 'content':
      // Append text to current message
      currentMessage.content += data.content;
      updateUI();
      break;
      
    case 'tool_call_start':
      // Show tool execution indicator
      showToolIndicator(data.tool_name);
      break;
      
    case 'tool_result':
      // Display tool result in UI
      displayToolResult(data);
      break;
      
    case 'error':
      // Show error to user
      showError(data.error);
      break;
      
    case 'done':
      // Finalize message and update token count
      finalizeMessage(data.tokensUsed);
      break;
  }
};
```

### Advanced Features

#### File Attachments
```javascript
// Upload image/file and attach to message
const attachments = [
  {
    type: 'image',
    url: 'https://cdn.example.com/image.png',
    name: 'screenshot.png'
  },
  {
    type: 'file',
    content: 'file content here',
    name: 'code.js'
  }
];

await sendMessage('Analyze this screenshot', attachments);
```

#### Tool Execution Monitoring
```javascript
// Monitor tool executions in real-time
eventSource.addEventListener('tool_call_start', (event) => {
  const data = JSON.parse(event.data);
  console.log(`Executing tool: ${data.tool_name}`);
  
  // Update UI to show tool is running
  updateToolStatus(data.tool_name, 'running');
});

eventSource.addEventListener('tool_result', (event) => {
  const data = JSON.parse(event.data);
  console.log(`Tool completed: ${data.tool_name}`, data.result);
  
  // Update UI with tool result
  updateToolStatus(data.tool_name, 'completed', data.result);
});
```

## Token Usage & Rate Limiting

### Token Tracking
```javascript
// Token usage is tracked per message and aggregated per chat
{
  tokensUsed: {
    prompt: 1234,      // Input tokens
    completion: 567,   // Output tokens
    total: 1801        // Total tokens
  }
}
```

### Rate Limiting Considerations
- Implement client-side throttling for message sending
- Queue messages if rate limit is reached
- Display token usage to users for transparency

## Error Handling

### SSE Error Recovery
```javascript
let retryCount = 0;
const maxRetries = 3;

const connectSSE = () => {
  const eventSource = new EventSource(url);
  
  eventSource.onerror = (error) => {
    eventSource.close();
    
    if (retryCount < maxRetries) {
      retryCount++;
      setTimeout(() => {
        console.log(`Retrying SSE connection (${retryCount}/${maxRetries})`);
        connectSSE();
      }, 1000 * retryCount); // Exponential backoff
    } else {
      console.error('Max retries reached, giving up');
      handleConnectionFailure();
    }
  };
  
  eventSource.onopen = () => {
    retryCount = 0; // Reset on successful connection
  };
  
  return eventSource;
};
```

### Tool Execution Errors
```javascript
// Tool errors are captured and sent to client
if (toolResult.error) {
  res.write(`data: ${JSON.stringify({
    type: 'tool_error',
    tool_name: toolName,
    error: toolResult.error
  })}\n\n`);
}
```

## Best Practices

### 1. Connection Management
- Always close SSE connections when component unmounts
- Implement reconnection logic with exponential backoff
- Handle browser tab visibility changes

### 2. Message Buffering
- Buffer incoming SSE chunks before parsing
- Handle partial JSON in stream chunks
- Implement message queuing for offline scenarios

### 3. Security
- Validate all inputs server-side
- Sanitize AI responses before rendering
- Implement proper CORS headers for SSE
- Use JWT tokens with appropriate expiration

### 4. Performance
- Implement virtual scrolling for long chat histories
- Lazy load chat messages
- Cache frequently accessed data
- Use debouncing for real-time features

## Debugging

### Enable Debug Mode
```bash
DEBUG_OPENAI=true npm run dev
```

### SSE Testing Endpoint
Test SSE connectivity:
```bash
curl -N http://localhost:3001/api/editorChat/test-sse
```

### Common Issues

1. **SSE Not Streaming**
   - Check `X-Accel-Buffering` header is set to 'no'
   - Ensure no proxy is buffering responses
   - Verify `res.flush()` is called after each write

2. **Authentication Failures**
   - Verify JWT token is valid and not expired
   - Check organization/project permissions
   - Ensure user has access to the resource

3. **Tool Execution Failures**
   - Check tool permissions in context
   - Verify tool parameters match schema
   - Review tool execution logs

## Migration to New Express Server

When migrating this chat implementation to a new Express server, ensure you:

1. **Copy Core Files:**
   - `/lib/llm/editorChat*.js` - Chat handlers
   - `/lib/db/editorChat.js` - Database models
   - `/routes/express/editorChatStreamRoutes.js` - SSE routes
   - `/lib/llm/tools/*` - Tool implementations

2. **Install Dependencies:**
   ```json
   {
     "@voltagent/core": "^latest",
     "@voltagent/vercel-ai": "^latest",
     "@ai-sdk/openai": "^latest",
     "zod": "^latest",
     "uuid": "^latest"
   }
   ```

3. **Configure Environment:**
   ```env
   OPENAI_API_KEY=your_key
   HELICONE_AUTH=your_helicone_key
   JWT_SECRET=your_jwt_secret
   MONGODB_URI=your_mongodb_uri
   ```

4. **Setup Middleware:**
   - JWT authentication middleware
   - CORS configuration for SSE
   - Error handling middleware

5. **Initialize Routes:**
   ```javascript
   app.use('/api/editorChat', editorChatStreamRoutes);
   app.use('/trpc', trpcMiddleware);
   ```

This implementation provides a robust, scalable chat backend with real-time streaming capabilities, perfect for AI-powered applications requiring interactive conversations with tool execution support.