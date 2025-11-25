# EditorChat API Guide

## tRPC Endpoints

All endpoints are available under `trpc.editorChat.*`

### Create Chat

```typescript
trpc.editorChat.create.mutate({
  orgId: string, // Required - organization handle
  projectId: string, // Optional
  title: string, // Optional, defaults to "New Chat"
  model: string, // Default: "gpt-4.1"
  temperature: number, // Default: 0.7
});
// Returns: { id, title, createdAt, model, temperature, project }
```

### List Chats

```typescript
trpc.editorChat.list.query({
  orgId: string, // Required - organization handle
  projectId: string,
  status: "active" | "completed" | "archived",
  limit: number, // Default: 50
  skip: number, // Default: 0
});
// Returns: { chats[], total, hasMore }
```

### Get Chat

```typescript
trpc.editorChat.get.query({ chatId: string });
// Returns: Full chat object with messages[], tasks[], tokensUsed, etc.
```

### Send Message (Non-streaming)

```typescript
trpc.editorChat.sendMessage.mutate({
  chatId: string,
  content: string,
  attachments: [
    {
      type: "image" | "file",
      url: string,
      name: string,
      size: number,
      mimeType: string,
    },
  ],
});
// Returns: { success, message }
```

### Stream Message

```typescript
const { streamUrl, chatId } = await trpc.editorChat.streamMessage.mutate({
  chatId: string,
  content: string,
  attachments?: [...]
})

// Then connect to SSE:
const eventSource = new EventSource(streamUrl, {
  headers: { Authorization: `Bearer ${token}` }
})

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  // data.type: 'content' | 'tool_calls' | 'done' | 'error'
  // data.content: string (for content chunks)
}
```

### Update Status

```typescript
trpc.editorChat.updateStatus.mutate({
  chatId: string,
  status: "active" | "completed" | "archived",
});
```

### Delete Chat

```typescript
trpc.editorChat.delete.mutate({ chatId: string });
```

### Get Stats

```typescript
trpc.editorChat.stats.query({
  orgId: string, // Required - organization handle
  projectId: string,
});
// Returns: { totalChats, activeChats, completedChats, totalMessages, totalTasks, totalTokens }
```

## SSE Streaming Format

POST to `/api/editorChat/stream/:chatId` with:

```json
{
  "content": "user message",
  "attachments": []
}
```

Headers:

```
Authorization: Bearer <token>
Content-Type: application/json
```

Event stream returns:

- `{ type: 'content', content: 'text chunk' }` - Assistant response chunks
- `{ type: 'tool_calls', tool_calls: [...] }` - Tool execution info
- `{ type: 'done' }` - Stream complete
- `{ type: 'error', error: 'message' }` - Error occurred

## Notes

- All endpoints require authentication
- Organization ID (handle) is required for create, list, and stats operations
- Chats are scoped to user and organization
- Project association is optional
- Image attachments supported in messages
- Tool execution tracked as editorTasks
- Titles are auto-generated from first message if not provided
