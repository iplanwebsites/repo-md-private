# Project Generation Frontend Implementation Guide

This guide explains how to integrate the AI-powered project generation system into your frontend application.

## Overview

The project generation system uses a conversational AI interface to gather requirements and generate complete codebases. It supports both standard request/response and real-time streaming for an optimal user experience.

## API Endpoints

### tRPC Procedures (Recommended)

All endpoints are available under the `projectGeneration` namespace:

```typescript
// Start a new conversation
const { conversationId, message } = await trpc.projectGeneration.startConversation.mutate({
  orgId: 'org-id',
  sessionId: 'optional-session-id'
});

// Continue conversation
const response = await trpc.projectGeneration.continueConversation.mutate({
  conversationId: 'conversation-id',
  message: 'I want to build a React app with TypeScript'
});

// Generate project from completed conversation
const project = await trpc.projectGeneration.generateProject.mutate({
  conversationId: 'conversation-id',
  owner: 'github-username',
  repo: 'new-repo-name',
  repoOptions: {
    private: false,
    description: 'AI-generated project'
  }
});

// Direct generation (skip conversation)
const project = await trpc.projectGeneration.generateFromBrief.mutate({
  brief: 'Create a React TODO app with TypeScript and Tailwind',
  owner: 'github-username',
  repo: 'todo-app',
  orgId: 'org-id',
  orgSlug: 'org-slug',
  simulate: false // Set to true for testing
});
```

### REST Streaming Endpoint

For real-time streaming responses:

```javascript
const response = await fetch('/api/project-generation/stream/continue', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    conversationId: 'conversation-id',
    message: 'User message here'
  })
});

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
      if (data === '[DONE]') break;
      
      const event = JSON.parse(data);
      handleStreamEvent(event);
    }
  }
}
```

## Frontend Implementation Example

### React Component with Streaming

```jsx
import { useState, useCallback } from 'react';
import { trpc } from './trpc-client';

function ProjectGenerationChat() {
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [projectBrief, setProjectBrief] = useState(null);

  // Start new conversation
  const startConversation = async () => {
    const result = await trpc.projectGeneration.startConversation.mutate({
      orgId: 'current-org-id'
    });
    
    setConversationId(result.conversationId);
    setMessages([{ role: 'assistant', content: result.message }]);
  };

  // Send message with streaming
  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;
    
    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsStreaming(true);
    
    // Add placeholder for assistant response
    const assistantMessageId = Date.now();
    setMessages(prev => [...prev, { 
      id: assistantMessageId,
      role: 'assistant', 
      content: '',
      streaming: true 
    }]);

    try {
      const response = await fetch('/api/project-generation/stream/continue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          conversationId,
          message: userMessage
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let currentContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            
            try {
              const event = JSON.parse(data);
              
              switch (event.type) {
                case 'content':
                  currentContent += event.content;
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, content: currentContent }
                      : msg
                  ));
                  break;
                  
                case 'tool_call':
                  if (event.toolCall.name === 'create_project_brief') {
                    // Show function call indicator
                    setMessages(prev => prev.map(msg => 
                      msg.id === assistantMessageId 
                        ? { ...msg, functionCall: true }
                        : msg
                    ));
                  }
                  break;
                  
                case 'complete':
                  if (event.result.projectBrief) {
                    setProjectBrief(event.result.projectBrief);
                  }
                  break;
              }
            } catch (e) {
              console.error('Failed to parse SSE event:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: 'Error: Failed to get response', error: true }
          : msg
      ));
    } finally {
      setIsStreaming(false);
      setMessages(prev => prev.map(msg => ({ ...msg, streaming: false })));
    }
  };

  // Generate project from brief
  const generateProject = async () => {
    if (!projectBrief) return;
    
    const result = await trpc.projectGeneration.generateProject.mutate({
      conversationId,
      owner: 'github-org-or-user',
      repo: projectBrief.projectName.toLowerCase().replace(/\s+/g, '-'),
      repoOptions: {
        private: false,
        description: projectBrief.description
      }
    });
    
    if (result.success) {
      window.location.href = result.data.repository.url;
    }
  };

  return (
    <div className="chat-container">
      {!conversationId ? (
        <button onClick={startConversation}>
          Start New Project Conversation
        </button>
      ) : (
        <>
          <div className="messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                {msg.role === 'assistant' && msg.streaming && (
                  <span className="streaming-indicator">●</span>
                )}
                <div className="content">{msg.content}</div>
                {msg.functionCall && (
                  <div className="function-call">
                    📋 Creating project brief...
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="input-area">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Describe your project..."
              disabled={isStreaming}
            />
            <button onClick={sendMessage} disabled={isStreaming}>
              Send
            </button>
          </div>
          
          {projectBrief && (
            <div className="project-brief">
              <h3>Project Brief Ready!</h3>
              <p>{projectBrief.projectName}</p>
              <button onClick={generateProject}>
                Generate Project on GitHub
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

## Conversation Flow

1. **Start Conversation**: User initiates a new project generation session
2. **Gather Requirements**: AI asks clarifying questions about the project
3. **User Provides Details**: User describes features, tech stack, and requirements
4. **AI Creates Brief**: When enough information is gathered, AI creates a structured project brief
5. **Generate Project**: User confirms and generates the actual GitHub repository

## Response Types

### Standard Response
```typescript
interface ConversationResponse {
  success: boolean;
  message: string;
  functionCalls?: Array<{
    name: string;
    arguments: any;
  }>;
  conversationComplete: boolean;
  projectBrief?: ProjectBrief;
}
```

### Streaming Events
```typescript
// Content chunk
{ type: 'content', content: 'chunk of text' }

// Tool call update
{ type: 'tool_call', toolCall: { name: 'function_name', argumentsChunk: '...' } }

// Completion
{ type: 'complete', result: { ... }, usage: { ... } }

// Error
{ type: 'error', error: 'error message' }
```

## Error Handling

```javascript
try {
  const response = await trpc.projectGeneration.continueConversation.mutate({
    conversationId,
    message
  });
} catch (error) {
  if (error.code === 'NOT_FOUND') {
    // Conversation not found or expired
  } else if (error.code === 'FORBIDDEN') {
    // User doesn't have access
  } else {
    // General error
  }
}
```

## Best Practices

1. **Session Management**: Store `conversationId` in component state or context
2. **Error Recovery**: Implement retry logic for network failures
3. **User Feedback**: Show typing indicators and progress during generation
4. **Validation**: Validate user inputs before sending to API
5. **Rate Limiting**: Implement client-side rate limiting to prevent spam

## Testing

Use the `simulate` flag for testing without creating actual GitHub repos:

```javascript
const result = await trpc.projectGeneration.generateFromBrief.mutate({
  brief: 'Test project',
  owner: 'test-owner',
  repo: 'test-repo',
  orgId: 'org-id',
  orgSlug: 'org-slug',
  simulate: true // No GitHub repo will be created
});
```

## Security Considerations

1. Always authenticate users before allowing project generation
2. Validate repository names to prevent injection attacks
3. Implement rate limiting to prevent abuse
4. Monitor usage and costs associated with AI generation
5. Review generated code before deploying to production