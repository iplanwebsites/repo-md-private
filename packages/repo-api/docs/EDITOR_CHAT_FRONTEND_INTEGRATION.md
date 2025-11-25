# EditorChat Frontend Integration Guide

This guide explains how to integrate the EditorChat tool tracking and file modification features in your frontend application.

## Table of Contents
- [Overview](#overview)
- [Data Formats](#data-formats)
- [tRPC Integration](#trpc-integration)
- [SSE Integration](#sse-integration)
- [State Management](#state-management)
- [UI Components](#ui-components)
- [Example Implementation](#example-implementation)

## Overview

The EditorChat system provides two ways to receive tool execution data:
1. **tRPC** - For non-streaming requests and fetching chat history
2. **SSE (Server-Sent Events)** - For streaming responses with real-time updates

Both methods include:
- Tool usage information with raw results
- File modification tracking with diffs
- Comprehensive metadata about operations

## Data Formats

### Tool Usage Structure

```typescript
interface ToolUsage {
  toolName: string;
  toolCallId: string;
  args: Record<string, any>;
  result: ToolResult;
  timestamp: string;
}

interface ToolResult {
  success?: boolean;
  error?: string;
  
  // For file operations
  type?: 'created' | 'modified' | 'deleted' | 'no-changes';
  path?: string;
  content?: string;
  originalContent?: string;
  branch?: string;
  commitSha?: string;
  
  // File tracking metadata
  fileTracking?: {
    type: 'created' | 'modified' | 'deleted';
    stats?: {
      additions: number;
      deletions: number;
      totalChanges: number;
    };
    diff?: string; // Unified diff format
  };
  
  // Summary of all file modifications in session
  allFileModifications?: {
    total: number;
    created: number;
    modified: number;
    deleted: number;
    files: Array<{
      path: string;
      type: string;
      stats?: object;
    }>;
  };
  
  // For weather tool
  data?: {
    location: string;
    temperature: string;
    condition: string;
    // ... other weather fields
  };
}
```

### Message Structure

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  timestamp: string;
  
  // For assistant messages with tools
  toolsUsed?: ToolUsage[];
  
  // OpenAI tool calls (different from toolsUsed)
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}
```

## tRPC Integration

### Fetching Chat with Tool History

```typescript
// Get chat with all messages including toolsUsed
const { data: chat } = trpc.editorChat.get.useQuery({
  chatId: currentChatId
});

// Access messages with tool usage
chat?.messages.forEach(message => {
  if (message.toolsUsed && message.toolsUsed.length > 0) {
    console.log(`Message used ${message.toolsUsed.length} tools`);
    
    message.toolsUsed.forEach(tool => {
      console.log(`- ${tool.toolName}: ${tool.result.success ? 'Success' : 'Failed'}`);
      
      // Handle file modifications
      if (tool.result.fileTracking) {
        console.log(`  File ${tool.result.fileTracking.type}: ${tool.result.path}`);
      }
    });
  }
});
```

### Sending Non-Streaming Message

```typescript
const sendMessage = trpc.editorChat.sendMessage.useMutation({
  onSuccess: (response) => {
    // Response includes toolsUsed array
    if (response.toolsUsed && response.toolsUsed.length > 0) {
      // Update UI with tool usage
      setToolsInUse(response.toolsUsed);
      
      // Update file tree if files were modified
      const fileOps = response.toolsUsed.filter(t => 
        ['create_file', 'edit_file', 'delete_file'].includes(t.toolName)
      );
      if (fileOps.length > 0) {
        refetchFileTree();
      }
    }
  }
});

// Send message
sendMessage.mutate({
  chatId: currentChatId,
  content: userMessage,
  attachments: []
});
```

## SSE Integration

### Setting Up SSE Connection

```typescript
import { EventSourcePolyfill } from 'event-source-polyfill';

function streamMessage(chatId: string, content: string) {
  // First, initiate streaming via tRPC
  const { data } = await trpc.editorChat.streamMessage.mutate({
    chatId,
    content,
    attachments: []
  });
  
  // Connect to SSE endpoint
  const eventSource = new EventSourcePolyfill(data.streamUrl, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
  
  let accumulatedContent = '';
  let toolsUsed: ToolUsage[] = [];
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
      case 'content':
        // Accumulate content chunks
        accumulatedContent += data.content;
        updateMessageInUI(accumulatedContent);
        break;
        
      case 'toolsUsed':
        // Received tool usage data
        toolsUsed = data.tools;
        updateToolsInUI(toolsUsed);
        break;
        
      case 'tool_call':
        // Tool is being called (optional real-time updates)
        showToolLoading(data.toolName);
        break;
        
      case 'done':
        // Streaming complete
        finalizeMessage(accumulatedContent, toolsUsed);
        eventSource.close();
        break;
        
      case 'error':
        handleError(data.error);
        eventSource.close();
        break;
    }
  };
  
  return eventSource;
}
```

## State Management

### Recommended State Structure

```typescript
interface EditorChatState {
  // Current chat
  chatId: string | null;
  messages: ChatMessage[];
  
  // Tool tracking
  currentToolsInUse: string[]; // Tool names currently executing
  sessionFileModifications: Map<string, FileModification>;
  
  // UI state
  isStreaming: boolean;
  streamingContent: string;
  pendingToolCalls: number;
}

interface FileModification {
  path: string;
  type: 'created' | 'modified' | 'deleted';
  content?: string;
  originalContent?: string;
  diff?: string;
  stats?: {
    additions: number;
    deletions: number;
  };
  timestamp: string;
}
```

### State Management with Zustand

```typescript
import { create } from 'zustand';

const useEditorChatStore = create((set, get) => ({
  messages: [],
  sessionFileModifications: new Map(),
  currentToolsInUse: [],
  
  addMessage: (message: ChatMessage) => {
    set(state => ({
      messages: [...state.messages, message]
    }));
    
    // Update file modifications if message has tool usage
    if (message.toolsUsed) {
      message.toolsUsed.forEach(tool => {
        if (tool.result.fileTracking) {
          get().updateFileModification(tool.result);
        }
      });
    }
  },
  
  updateFileModification: (result: ToolResult) => {
    if (!result.path) return;
    
    set(state => {
      const mods = new Map(state.sessionFileModifications);
      
      mods.set(result.path, {
        path: result.path,
        type: result.type as any,
        content: result.content,
        originalContent: result.originalContent,
        diff: result.fileTracking?.diff,
        stats: result.fileTracking?.stats,
        timestamp: new Date().toISOString()
      });
      
      return { sessionFileModifications: mods };
    });
  },
  
  setToolsInUse: (tools: string[]) => {
    set({ currentToolsInUse: tools });
  },
  
  clearSession: () => {
    set({
      messages: [],
      sessionFileModifications: new Map(),
      currentToolsInUse: []
    });
  }
}));
```

## UI Components

### Tool Usage Display

```tsx
function ToolUsageDisplay({ toolsUsed }: { toolsUsed: ToolUsage[] }) {
  return (
    <div className="tools-used">
      <h4>Tools Used ({toolsUsed.length})</h4>
      
      {toolsUsed.map((tool, index) => (
        <div key={index} className="tool-item">
          <div className="tool-header">
            <Icon name={getToolIcon(tool.toolName)} />
            <span>{tool.toolName}</span>
            <time>{new Date(tool.timestamp).toLocaleTimeString()}</time>
          </div>
          
          {tool.result.fileTracking && (
            <FileOperationDisplay
              path={tool.result.path}
              type={tool.result.fileTracking.type}
              stats={tool.result.fileTracking.stats}
            />
          )}
          
          {tool.result.data && tool.toolName === 'getWeather' && (
            <WeatherDisplay data={tool.result.data} />
          )}
          
          {tool.result.error && (
            <div className="error">{tool.result.error}</div>
          )}
        </div>
      ))}
    </div>
  );
}
```

### File Diff Viewer

```tsx
function FileDiffViewer({ modification }: { modification: FileModification }) {
  return (
    <div className="file-diff">
      <div className="diff-header">
        <span className={`badge ${modification.type}`}>
          {modification.type}
        </span>
        <span className="file-path">{modification.path}</span>
        {modification.stats && (
          <span className="diff-stats">
            <span className="additions">+{modification.stats.additions}</span>
            <span className="deletions">-{modification.stats.deletions}</span>
          </span>
        )}
      </div>
      
      {modification.diff && (
        <pre className="diff-content">
          <code>{modification.diff}</code>
        </pre>
      )}
    </div>
  );
}
```

### Session File Summary

```tsx
function SessionFileSummary() {
  const { sessionFileModifications } = useEditorChatStore();
  
  const summary = useMemo(() => {
    const mods = Array.from(sessionFileModifications.values());
    return {
      total: mods.length,
      created: mods.filter(m => m.type === 'created').length,
      modified: mods.filter(m => m.type === 'modified').length,
      deleted: mods.filter(m => m.type === 'deleted').length
    };
  }, [sessionFileModifications]);
  
  if (summary.total === 0) return null;
  
  return (
    <div className="file-summary">
      <h4>Files Changed in This Session</h4>
      <div className="summary-stats">
        <span>Total: {summary.total}</span>
        <span className="created">Created: {summary.created}</span>
        <span className="modified">Modified: {summary.modified}</span>
        <span className="deleted">Deleted: {summary.deleted}</span>
      </div>
      
      <div className="file-list">
        {Array.from(sessionFileModifications.values()).map(mod => (
          <FileDiffViewer key={mod.path} modification={mod} />
        ))}
      </div>
    </div>
  );
}
```

## Example Implementation

### Complete Chat Component

```tsx
function EditorChat() {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const { chatId, messages, addMessage, setToolsInUse } = useEditorChatStore();
  
  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };
    addMessage(userMessage);
    setInput('');
    
    // Decide whether to stream or not
    const shouldStream = input.length > 50; // Example heuristic
    
    if (shouldStream) {
      setIsStreaming(true);
      
      // Initialize streaming
      const { data } = await trpc.editorChat.streamMessage.mutate({
        chatId,
        content: input
      });
      
      // Start SSE connection
      const eventSource = new EventSourcePolyfill(data.streamUrl, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      
      let accumulatedContent = '';
      let streamingMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString()
      };
      
      addMessage(streamingMessage);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'content':
            accumulatedContent += data.content;
            // Update the streaming message
            updateMessage(streamingMessage.id, {
              content: accumulatedContent
            });
            break;
            
          case 'toolsUsed':
            // Update message with tools
            updateMessage(streamingMessage.id, {
              toolsUsed: data.tools
            });
            setToolsInUse([]);
            break;
            
          case 'done':
            setIsStreaming(false);
            eventSource.close();
            break;
        }
      };
      
    } else {
      // Non-streaming request
      const response = await trpc.editorChat.sendMessage.mutate({
        chatId,
        content: input
      });
      
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
        toolsUsed: response.toolsUsed
      };
      
      addMessage(assistantMessage);
    }
  };
  
  return (
    <div className="editor-chat">
      <div className="messages">
        {messages.map(message => (
          <Message key={message.id} message={message} />
        ))}
      </div>
      
      <SessionFileSummary />
      
      <div className="input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask me to create, edit, or search files..."
          disabled={isStreaming}
        />
        <button onClick={sendMessage} disabled={isStreaming}>
          {isStreaming ? 'Streaming...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
```

### Message Component with Tool Display

```tsx
function Message({ message }: { message: ChatMessage }) {
  const [showTools, setShowTools] = useState(true);
  
  return (
    <div className={`message ${message.role}`}>
      <div className="message-header">
        <span className="role">{message.role}</span>
        <time>{new Date(message.timestamp).toLocaleTimeString()}</time>
      </div>
      
      <div className="message-content">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
      
      {message.toolsUsed && message.toolsUsed.length > 0 && (
        <div className="message-tools">
          <button 
            className="toggle-tools"
            onClick={() => setShowTools(!showTools)}
          >
            {showTools ? 'Hide' : 'Show'} Tools ({message.toolsUsed.length})
          </button>
          
          {showTools && (
            <ToolUsageDisplay toolsUsed={message.toolsUsed} />
          )}
        </div>
      )}
    </div>
  );
}
```

## Best Practices

1. **State Synchronization**
   - Always update local state when receiving tool usage data
   - Keep file modification state in sync with tool results
   - Clear session state when starting a new chat

2. **Error Handling**
   - Handle SSE connection failures with reconnection logic
   - Show clear error messages for failed tool executions
   - Provide fallback UI for when tools are unavailable

3. **Performance**
   - Debounce file tree updates when multiple files are modified
   - Use virtual scrolling for long chat histories
   - Cache file diffs to avoid recalculation

4. **User Experience**
   - Show loading indicators when tools are executing
   - Display progress for multi-step operations
   - Allow users to expand/collapse tool details
   - Provide syntax highlighting for code diffs

5. **Real-time Updates**
   - Show which tools are currently running
   - Update file tree immediately after modifications
   - Display partial results as they stream in

## Testing

Use the provided test scripts to verify integration:

```bash
# Test natural language requests
npm run test:nl

# Test specific tool integrations
npm run test:chat-tools

# Test file operations
npm run test:chat-file-tools
```

Monitor the network tab to see the exact format of responses and ensure your frontend handles all cases correctly.