SSE Streaming Implementation Documentation

  Overview

  The codebase implements Server-Sent Events (SSE) for
  real-time AI response streaming across three main
  features: editor chats, project generation, and LLM
  conversations.

  Core SSE Setup

  Required Headers:
  - Content-Type: text/event-stream
  - Cache-Control: no-cache
  - Connection: keep-alive
  - X-Accel-Buffering: no (for Nginx)

  Message Format:
  - Standard: data: ${JSON.stringify(payload)}\n\n
  - With event type: event: eventName\ndata: 
  ${payload}\n\n
  - Stream end: data: [DONE]\n\n

  Message Types

  1. Content: { type: 'content', content: '...' }
  2. Tool Calls: { type: 'tool_call', toolCall: {...} }
  3. Errors: { type: 'error', error: '...' }
  4. Completion: { type: 'done' } or { type: 'complete' }
  5. Status: { type: 'finish', finish_reason: '...', 
  usage: {...} }

  Implementation Pattern

  1. Authentication: Verify user/resource access
  2. Headers: Set SSE headers before streaming
  3. Stream Creation: Use Node.js PassThrough or
  Transform streams
  4. OpenAI Integration: Enable streaming in API calls
  5. Error Handling: Send errors as SSE messages if
  headers sent
  6. Cleanup: Handle client disconnects, destroy streams

  Key Endpoints

  - Editor Chat: /api/editorChat/stream/:chatId
  - Project Generation:
  /api/project-generation/stream/continue
  - LLM Conversations: /api/llm/responses

  Stream Management

  - Use req.on('close') for disconnect handling
  - Destroy OpenAI streams on client disconnect
  - Track token usage and update database
  - Implement heartbeat/ping for connection monitoring
