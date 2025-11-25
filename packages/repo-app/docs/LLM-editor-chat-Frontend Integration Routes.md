Frontend Integration Routes

  Chat Management

  // tRPC routes (via tRPC client)
  trpc.editorChat.create({ title, projectId })
  trpc.editorChat.list({ projectId })
  trpc.editorChat.getById({ id: chatId })
  trpc.editorChat.delete({ id: chatId })

  Messaging

  // SSE streaming endpoint
  POST /api/editorChat/stream/:chatId
  Body: {
    content: "user message",
    attachments: [] // optional
  }
  Response: Server-Sent Events stream

  Actions

  // Get diff/changes
  GET /api/editorChat/actions/diff/:chatId

  // Create PR
  POST /api/editorChat/actions/create-pr/:chatId
  Body: { title, body, base: "main" }

  // Direct commit
  POST /api/editorChat/actions/commit/:chatId
  Body: { message: "commit message" }

  SSE Event Types

  // Streaming events you'll receive:
  { type: 'content', content: 'chunk of text' }
  { type: 'tool_calls', tool_calls: [...] }
  { type: 'error', error: 'message' }
  { type: 'done' }

  Frontend State Structure

  {
    messages: [
      {
        id, role, content, timestamp,
        toolCalls: [{ id, name, args, status }],
        fileChanges: [{ type, path, branch }]
      }
    ],
    sessionBranch: 'editorChat-xxx',
    hasChanges: true
  }
