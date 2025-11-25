# LLM Conversation Implementation Guide

A functional, library-agnostic guide for implementing AI conversations with tool displays in JavaScript and Vue.

## Core Concepts

1. **Conversations** - Stateful chat sessions with context
2. **Agents** - Different AI personalities with specific tools
3. **Tools** - Functions the AI can call (file operations, searches, etc.)
4. **Streaming** - Real-time responses via Server-Sent Events (SSE)

## JavaScript Implementation (Vanilla)

### 1. Basic API Client

```javascript
// api/llm.js - Core API functions
const API_BASE = '/api/llm';

// Start a new conversation
export async function createConversation({ 
  agentType = 'editor',
  projectId = null,
  metadata = {} 
}) {
  const res = await fetch(`${API_BASE}/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ agentType, projectId, metadata })
  });
  
  if (!res.ok) throw new Error('Failed to create conversation');
  return res.json();
}

// Send a message (non-streaming)
export async function sendMessage(conversationId, message) {
  const res = await fetch(`${API_BASE}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      conversationId,
      input: message,
      stream: false
    })
  });
  
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}

// List conversations with filters
export async function listConversations(filters = {}) {
  const params = new URLSearchParams(filters);
  const res = await fetch(`${API_BASE}/conversations?${params}`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });
  
  if (!res.ok) throw new Error('Failed to list conversations');
  return res.json();
}
```

### 2. Streaming Support with SSE

```javascript
// api/streaming.js - SSE streaming handler
export function streamMessage(conversationId, message, handlers = {}) {
  const {
    onStart = () => {},
    onContent = () => {},
    onTool = () => {},
    onComplete = () => {},
    onError = () => {}
  } = handlers;
  
  // Create abort controller for cleanup
  const controller = new AbortController();
  
  // Start the stream
  fetch(`${API_BASE}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      conversationId,
      input: message,
      stream: true
    }),
    signal: controller.signal
  })
  .then(response => {
    if (!response.ok) throw new Error('Stream failed');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    // Process stream chunks
    async function processStream() {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('event:')) {
            const event = line.slice(6).trim();
            continue;
          }
          
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              handleStreamEvent(parsed);
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    }
    
    function handleStreamEvent(data) {
      switch (data.type) {
        case 'response':
          onStart(data);
          break;
          
        case 'content':
          onContent(data.delta?.content || data.content);
          break;
          
        case 'tool_call':
          onTool({
            tool: data.tool,
            arguments: data.arguments,
            result: data.result
          });
          break;
          
        case 'done':
          onComplete();
          break;
          
        case 'error':
          onError(new Error(data.error));
          break;
      }
    }
    
    return processStream();
  })
  .catch(error => {
    if (error.name !== 'AbortError') {
      onError(error);
    }
  });
  
  // Return abort function
  return () => controller.abort();
}
```

### 3. Conversation State Manager

```javascript
// state/conversation.js - Simple state management
export function createConversationStore() {
  let state = {
    conversations: [],
    activeConversation: null,
    messages: [],
    isLoading: false,
    error: null
  };
  
  const listeners = new Set();
  
  function notify() {
    listeners.forEach(fn => fn(state));
  }
  
  function setState(updates) {
    state = { ...state, ...updates };
    notify();
  }
  
  return {
    getState: () => state,
    
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    
    // Actions
    async loadConversations(filters = {}) {
      setState({ isLoading: true });
      try {
        const { data } = await listConversations(filters);
        setState({ conversations: data, isLoading: false });
      } catch (error) {
        setState({ error: error.message, isLoading: false });
      }
    },
    
    async startConversation(agentType, projectId = null) {
      setState({ isLoading: true });
      try {
        const { conversationId } = await createConversation({ 
          agentType, 
          projectId 
        });
        setState({ 
          activeConversation: conversationId,
          messages: [],
          isLoading: false 
        });
        return conversationId;
      } catch (error) {
        setState({ error: error.message, isLoading: false });
        throw error;
      }
    },
    
    addMessage(message) {
      setState({ 
        messages: [...state.messages, message] 
      });
    },
    
    updateLastMessage(updates) {
      const messages = [...state.messages];
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        messages[messages.length - 1] = { ...lastMsg, ...updates };
        setState({ messages });
      }
    }
  };
}
```

### 4. Tool Display Handler

```javascript
// ui/toolDisplay.js - Format and display tool calls
export function formatToolCall(tool) {
  const formatters = {
    create_file: ({ path, content }) => ({
      icon: '📄',
      title: 'Created file',
      subtitle: path,
      details: `${content.split('\n').length} lines`
    }),
    
    update_file: ({ path, changes }) => ({
      icon: '✏️',
      title: 'Updated file',
      subtitle: path,
      details: changes
    }),
    
    delete_file: ({ path, reason }) => ({
      icon: '🗑️',
      title: 'Deleted file',
      subtitle: path,
      details: reason
    }),
    
    search_project_files: ({ query, resultsCount }) => ({
      icon: '🔍',
      title: 'Searched files',
      subtitle: `Query: "${query}"`,
      details: `Found ${resultsCount} results`
    }),
    
    create_github_repo: ({ name, url }) => ({
      icon: '🐙',
      title: 'Created GitHub repo',
      subtitle: name,
      details: url,
      link: url
    })
  };
  
  const formatter = formatters[tool.tool] || (() => ({
    icon: '⚙️',
    title: tool.tool,
    subtitle: 'Tool executed',
    details: JSON.stringify(tool.arguments)
  }));
  
  return formatter(tool.arguments || {});
}

// Create tool display element
export function createToolDisplay(toolCall) {
  const formatted = formatToolCall(toolCall);
  
  return `
    <div class="tool-call">
      <div class="tool-header">
        <span class="tool-icon">${formatted.icon}</span>
        <span class="tool-title">${formatted.title}</span>
      </div>
      <div class="tool-subtitle">${formatted.subtitle}</div>
      ${formatted.details ? `<div class="tool-details">${formatted.details}</div>` : ''}
      ${formatted.link ? `<a href="${formatted.link}" target="_blank" class="tool-link">Open →</a>` : ''}
    </div>
  `;
}
```

## Vue 3 Implementation

### 1. Composable for Conversations

```javascript
// composables/useConversation.js
import { ref, computed, shallowRef } from 'vue';
import { streamMessage } from '../api/streaming';

export function useConversation() {
  const conversations = ref([]);
  const activeConversationId = ref(null);
  const messages = ref([]);
  const isLoading = ref(false);
  const isStreaming = ref(false);
  const error = ref(null);
  
  // Abort controller for streaming
  let abortStream = null;
  
  // Computed
  const activeConversation = computed(() => 
    conversations.value.find(c => c.id === activeConversationId.value)
  );
  
  // Load conversations
  async function loadConversations(filters = {}) {
    isLoading.value = true;
    try {
      const response = await fetch('/api/llm/conversations?' + new URLSearchParams(filters), {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      const data = await response.json();
      conversations.value = data.data;
    } catch (err) {
      error.value = err.message;
    } finally {
      isLoading.value = false;
    }
  }
  
  // Start new conversation
  async function startConversation(agentType = 'editor', projectId = null) {
    isLoading.value = true;
    try {
      const response = await fetch('/api/llm/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ agentType, projectId })
      });
      
      const data = await response.json();
      activeConversationId.value = data.conversationId;
      messages.value = [];
      
      // Add to conversations list
      conversations.value.unshift({
        id: data.conversationId,
        agentType,
        createdAt: new Date(),
        messages: []
      });
      
      return data.conversationId;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  }
  
  // Send message with streaming
  async function sendMessage(text) {
    if (!activeConversationId.value) {
      throw new Error('No active conversation');
    }
    
    // Add user message
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };
    messages.value.push(userMessage);
    
    // Add placeholder for assistant message
    const assistantMessage = {
      id: Date.now() + 1,
      role: 'assistant',
      content: '',
      tools: [],
      isStreaming: true,
      timestamp: new Date()
    };
    messages.value.push(assistantMessage);
    
    // Start streaming
    isStreaming.value = true;
    error.value = null;
    
    abortStream = streamMessage(
      activeConversationId.value,
      text,
      {
        onContent: (chunk) => {
          assistantMessage.content += chunk;
        },
        
        onTool: (toolCall) => {
          assistantMessage.tools.push(toolCall);
        },
        
        onComplete: () => {
          assistantMessage.isStreaming = false;
          isStreaming.value = false;
        },
        
        onError: (err) => {
          error.value = err.message;
          assistantMessage.isStreaming = false;
          isStreaming.value = false;
        }
      }
    );
  }
  
  // Stop streaming
  function stopStreaming() {
    if (abortStream) {
      abortStream();
      abortStream = null;
      isStreaming.value = false;
    }
  }
  
  return {
    // State
    conversations,
    activeConversation,
    activeConversationId,
    messages,
    isLoading,
    isStreaming,
    error,
    
    // Actions
    loadConversations,
    startConversation,
    sendMessage,
    stopStreaming
  };
}
```

### 2. Message Component with Tool Display

```vue
<!-- components/ChatMessage.vue -->
<template>
  <div class="message" :class="`message--${message.role}`">
    <div class="message-header">
      <span class="message-role">{{ roleLabel }}</span>
      <span class="message-time">{{ formatTime(message.timestamp) }}</span>
    </div>
    
    <div class="message-content">
      <!-- Render markdown content -->
      <div v-if="message.content" class="message-text" v-html="renderMarkdown(message.content)" />
      
      <!-- Show typing indicator while streaming -->
      <div v-if="message.isStreaming && !message.content" class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
      
      <!-- Render tool calls -->
      <div v-if="message.tools?.length" class="tool-calls">
        <ToolCall 
          v-for="(tool, index) in message.tools" 
          :key="index"
          :tool="tool"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { marked } from 'marked';
import ToolCall from './ToolCall.vue';

const props = defineProps({
  message: {
    type: Object,
    required: true
  }
});

const roleLabel = computed(() => ({
  user: 'You',
  assistant: 'AI Assistant',
  system: 'System'
}[props.message.role] || props.message.role));

function renderMarkdown(content) {
  return marked(content, { sanitize: true });
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString();
}
</script>

<style scoped>
.message {
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 8px;
}

.message--user {
  background: #f0f2f5;
  margin-left: 20%;
}

.message--assistant {
  background: white;
  border: 1px solid #e0e0e0;
  margin-right: 20%;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: #666;
}

.message-role {
  font-weight: 600;
}

.message-text {
  line-height: 1.5;
}

.typing-indicator {
  display: flex;
  gap: 4px;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #666;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    opacity: 0.3;
  }
  30% {
    opacity: 1;
  }
}

.tool-calls {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
```

### 3. Tool Call Component

```vue
<!-- components/ToolCall.vue -->
<template>
  <div class="tool-call" :class="{ 'tool-call--success': tool.result?.success }">
    <div class="tool-header" @click="expanded = !expanded">
      <div class="tool-info">
        <span class="tool-icon">{{ formatted.icon }}</span>
        <span class="tool-title">{{ formatted.title }}</span>
      </div>
      <button class="tool-expand">
        {{ expanded ? '−' : '+' }}
      </button>
    </div>
    
    <div class="tool-subtitle">{{ formatted.subtitle }}</div>
    
    <Transition name="expand">
      <div v-if="expanded" class="tool-details">
        <div v-if="formatted.details" class="tool-description">
          {{ formatted.details }}
        </div>
        
        <div v-if="tool.result" class="tool-result">
          <pre>{{ JSON.stringify(tool.result, null, 2) }}</pre>
        </div>
        
        <a v-if="formatted.link" 
           :href="formatted.link" 
           target="_blank" 
           class="tool-link">
          Open {{ formatted.linkText || 'Link' }} →
        </a>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  tool: {
    type: Object,
    required: true
  }
});

const expanded = ref(false);

// Tool formatters
const toolFormatters = {
  create_file: (args) => ({
    icon: '📄',
    title: 'Created file',
    subtitle: args.path,
    details: `Created ${args.content?.split('\n').length || 0} lines`
  }),
  
  update_file: (args) => ({
    icon: '✏️',
    title: 'Updated file',
    subtitle: args.path,
    details: args.changes
  }),
  
  delete_file: (args) => ({
    icon: '🗑️',
    title: 'Deleted file',
    subtitle: args.path,
    details: args.reason
  }),
  
  search_project_files: (args, result) => ({
    icon: '🔍',
    title: 'Searched files',
    subtitle: `Query: "${args.query}"`,
    details: `Found ${result?.resultsCount || 0} results`
  }),
  
  create_github_repo: (args, result) => ({
    icon: '🐙',
    title: 'Created GitHub repository',
    subtitle: args.name,
    details: args.description,
    link: result?.url,
    linkText: 'GitHub'
  }),
  
  push_to_github: (args, result) => ({
    icon: '⬆️',
    title: 'Pushed to GitHub',
    subtitle: args.repo,
    details: result?.message,
    link: result?.url,
    linkText: 'View on GitHub'
  })
};

const formatted = computed(() => {
  const formatter = toolFormatters[props.tool.tool];
  if (formatter) {
    return formatter(props.tool.arguments || {}, props.tool.result);
  }
  
  // Default formatter
  return {
    icon: '⚙️',
    title: props.tool.tool,
    subtitle: 'Tool executed',
    details: null
  };
});
</script>

<style scoped>
.tool-call {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 0.75rem;
  transition: all 0.2s;
}

.tool-call--success {
  border-color: #28a745;
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.tool-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tool-icon {
  font-size: 1.25rem;
}

.tool-title {
  font-weight: 600;
  color: #333;
}

.tool-subtitle {
  color: #666;
  font-size: 0.875rem;
  margin-top: 0.25rem;
  margin-left: 2rem;
}

.tool-expand {
  background: none;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 1rem;
  color: #666;
}

.tool-details {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e0e0e0;
}

.tool-description {
  color: #555;
  margin-bottom: 0.5rem;
}

.tool-result {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0.5rem;
  margin: 0.5rem 0;
  font-size: 0.75rem;
  overflow-x: auto;
}

.tool-result pre {
  margin: 0;
  white-space: pre-wrap;
}

.tool-link {
  display: inline-block;
  margin-top: 0.5rem;
  color: #007bff;
  text-decoration: none;
  font-size: 0.875rem;
}

.tool-link:hover {
  text-decoration: underline;
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
```

### 4. Main Chat Component

```vue
<!-- components/ChatInterface.vue -->
<template>
  <div class="chat-interface">
    <!-- Header -->
    <div class="chat-header">
      <select v-model="selectedAgent" @change="handleAgentChange">
        <option value="editor">Editor Assistant</option>
        <option value="project">Project Assistant</option>
      </select>
      
      <button 
        v-if="activeConversation"
        @click="startNewConversation"
        class="btn-new"
      >
        New Chat
      </button>
    </div>
    
    <!-- Messages -->
    <div class="chat-messages" ref="messagesContainer">
      <div v-if="!activeConversation" class="chat-empty">
        <h3>Start a new conversation</h3>
        <p>Choose an assistant type and start chatting</p>
        <button @click="startNewConversation" class="btn-primary">
          Start Conversation
        </button>
      </div>
      
      <ChatMessage 
        v-for="message in messages" 
        :key="message.id"
        :message="message"
      />
      
      <div v-if="error" class="chat-error">
        {{ error }}
      </div>
    </div>
    
    <!-- Input -->
    <form @submit.prevent="handleSend" class="chat-input">
      <textarea
        v-model="input"
        @keydown.enter.prevent="handleEnterKey"
        placeholder="Type your message..."
        :disabled="!activeConversation || isStreaming"
        rows="3"
      />
      
      <div class="chat-actions">
        <button 
          v-if="isStreaming"
          @click="stopStreaming"
          type="button"
          class="btn-stop"
        >
          Stop
        </button>
        
        <button 
          v-else
          type="submit"
          :disabled="!input.trim() || !activeConversation"
          class="btn-send"
        >
          Send
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue';
import { useConversation } from '../composables/useConversation';
import ChatMessage from './ChatMessage.vue';

const props = defineProps({
  projectId: String
});

const {
  activeConversation,
  messages,
  isStreaming,
  error,
  startConversation,
  sendMessage,
  stopStreaming,
  loadConversations
} = useConversation();

const selectedAgent = ref('editor');
const input = ref('');
const messagesContainer = ref(null);

// Load conversations on mount
onMounted(() => {
  loadConversations({
    projectId: props.projectId,
    limit: 10
  });
});

// Auto-scroll to bottom
watch(messages, async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}, { deep: true });

async function startNewConversation() {
  await startConversation(selectedAgent.value, props.projectId);
}

async function handleSend() {
  if (!input.value.trim() || isStreaming.value) return;
  
  const message = input.value;
  input.value = '';
  
  try {
    await sendMessage(message);
  } catch (err) {
    console.error('Failed to send message:', err);
  }
}

function handleEnterKey(event) {
  if (!event.shiftKey) {
    handleSend();
  }
}

function handleAgentChange() {
  if (activeConversation.value) {
    if (confirm('Changing agent type will start a new conversation. Continue?')) {
      startNewConversation();
    } else {
      // Reset selection
      selectedAgent.value = activeConversation.value.agentType;
    }
  }
}
</script>

<style scoped>
.chat-interface {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  scroll-behavior: smooth;
}

.chat-empty {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.chat-error {
  background: #fee;
  color: #c33;
  padding: 0.75rem;
  border-radius: 4px;
  margin: 1rem 0;
}

.chat-input {
  border-top: 1px solid #e0e0e0;
  padding: 1rem;
}

.chat-input textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  resize: none;
  font-family: inherit;
  font-size: 14px;
}

.chat-input textarea:focus {
  outline: none;
  border-color: #007bff;
}

.chat-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

/* Buttons */
.btn-primary,
.btn-send,
.btn-stop,
.btn-new {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary,
.btn-send {
  background: #007bff;
  color: white;
}

.btn-primary:hover,
.btn-send:hover {
  background: #0056b3;
}

.btn-primary:disabled,
.btn-send:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-stop {
  background: #dc3545;
  color: white;
}

.btn-stop:hover {
  background: #c82333;
}

.btn-new {
  background: white;
  border: 1px solid #ddd;
  color: #333;
}

.btn-new:hover {
  background: #f8f9fa;
}

/* Responsive */
@media (max-width: 768px) {
  .chat-interface {
    border-radius: 0;
  }
  
  .message--user {
    margin-left: 10%;
  }
  
  .message--assistant {
    margin-right: 10%;
  }
}
</style>
```

## Usage Example

```javascript
// main.js - Initialize the chat
import { createApp } from 'vue';
import ChatInterface from './components/ChatInterface.vue';

// For project-specific chat
const app = createApp(ChatInterface, {
  projectId: 'project-123'
});

app.mount('#chat-container');
```

## Styling Guide

```css
/* styles/chat.css - Minimal styling */
:root {
  --chat-primary: #007bff;
  --chat-danger: #dc3545;
  --chat-success: #28a745;
  --chat-bg: #f8f9fa;
  --chat-border: #dee2e6;
  --chat-text: #333;
  --chat-text-muted: #666;
}

/* Tool call status indicators */
.tool-call[data-status="running"] {
  border-color: var(--chat-primary);
  background: #e7f3ff;
}

.tool-call[data-status="success"] {
  border-color: var(--chat-success);
  background: #e7f7e7;
}

.tool-call[data-status="error"] {
  border-color: var(--chat-danger);
  background: #fee;
}

/* Code highlighting in messages */
.message-text pre {
  background: #f4f4f4;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
}

.message-text code {
  background: #f4f4f4;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-size: 0.875em;
}
```

## Advanced Features

### 1. Conversation Context Switching

```javascript
// When creating a project in conversation, switch context
async function switchToProjectContext(conversationId, projectId) {
  const response = await fetch(`/api/llm/conversations/${conversationId}/switch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      newAgentType: 'project',
      projectId
    })
  });
  
  if (!response.ok) throw new Error('Failed to switch context');
  return response.json();
}
```

### 2. File Preview in Tool Calls

```javascript
// Enhanced tool formatter with file preview
const filePreviewFormatter = {
  create_file: ({ path, content }) => ({
    icon: '📄',
    title: 'Created file',
    subtitle: path,
    details: `${content.split('\n').length} lines`,
    preview: content.substring(0, 500),
    language: path.split('.').pop()
  })
};
```

### 3. Real-time Collaboration

```javascript
// WebSocket for real-time updates
function connectToConversation(conversationId) {
  const ws = new WebSocket(`wss://api.example.com/conversations/${conversationId}`);
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'message' && data.userId !== currentUserId) {
      // Add message from other user
      addMessageToConversation(data.message);
    }
  };
  
  return ws;
}
```

This implementation provides a clean, functional approach to building AI chat interfaces with tool visualization, suitable for integration into any JavaScript or Vue application.