# Volt Agent SDK Migration Guide

This guide documents the migration from direct OpenAI library usage to the Volt Agent SDK across the codebase.

## Overview

The migration replaces direct OpenAI API calls with the Volt Agent SDK, which provides:

- Better abstraction for AI agent creation
- Unified tool handling with Zod schemas
- Enhanced streaming support
- Consistent error handling
- Built-in Helicone integration

## Migration Status

### ✅ Completed Migrations

1. **EditorChat Service** (`lib/llm/editorChat.js` → `lib/llm/editorChatVolt.js`)

   - Converted tool definitions to Volt format with Zod schemas
   - Migrated streaming responses to use Volt's fullStream API
   - Maintained all existing functionality including file tracking

2. **Conversation Service** (`lib/llm/conversation.js` → `lib/llm/conversationVolt.js`)

   - Migrated message handling to Volt Agent format
   - Converted dynamic tool loading to Volt tools
   - Preserved streaming SSE support

3. **Streaming Service** (`lib/project-generation/streamingService.js` → `lib/project-generation/streamingServiceVolt.js`)

   - Migrated project generation streaming
   - Converted project brief tools to Volt format
   - Enhanced SSE transform for Volt streaming events

4. **Webhook Processor** (`lib/webhooks/WebhookProcessor.js` → `lib/webhooks/WebhookProcessorVolt.js`)
   - Migrated AI command extraction to Volt Agent
   - Simplified webhook agent creation
   - Maintained all webhook processing logic

### ❌ Services Not Requiring Migration

- **Slack Integration** - Uses agent systems and tool executors, no direct OpenAI usage
- **OpenAI Proxy** - Middleware for client-side access, architectural component

## Key Changes

### 1. Agent Creation

**Before (OpenAI):**

```javascript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://oai.helicone.ai/v1",
  defaultHeaders: {
    "Helicone-Auth": `Bearer ${process.env.HELICONE_AUTH}`,
  },
});
```

**After (Volt):**

```javascript
import { createVoltAgent } from "../volt/voltAgentConfig.js";

const agent = createVoltAgent({
  name: "MyAgent",
  instructions: "System prompt here",
  model: "gpt-4.1-mini",
  tools: voltTools,
});
```

### 2. Tool Definition

**Before (OpenAI):**

```javascript
const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get weather",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string" },
        },
        required: ["location"],
      },
    },
  },
];
```

**After (Volt):**

```javascript
import { createTool, z } from "@voltagent/core";

const weatherTool = createTool({
  name: "get_weather",
  description: "Get weather",
  parameters: z.object({
    location: z.string().describe("City name"),
  }),
  execute: async ({ location }) => {
    // Implementation
    return { temperature: 72 };
  },
});
```

### 3. Streaming Responses

**Before (OpenAI):**

```javascript
const stream = await openai.chat.completions.create({
  model: "gpt-4.1",
  messages,
  stream: true,
});

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta;
  if (delta?.content) {
    // Handle content
  }
}
```

**After (Volt):**

```javascript
const response = await agent.streamText(input);

if (response.fullStream) {
  for await (const chunk of response.fullStream) {
    switch (chunk.type) {
      case "text-delta":
        // Handle text
        break;
      case "tool-call":
        // Handle tool call
        break;
    }
  }
}
```

## Migration Steps

To use the Volt versions of the services:

1. **Update imports in your code:**

   ```javascript
   // Old
   import { EditorChatHandler } from "./lib/llm/editorChat.js";

   // New
   import { EditorChatHandler } from "./lib/llm/editorChatVolt.js";
   ```

2. **Environment variables remain the same:**

   - `OPENAI_API_KEY`
   - `HELICONE_AUTH`
   - All other existing env vars

3. **API interfaces are preserved** - No changes needed in calling code

## Benefits

1. **Simplified Tool Management** - Zod schemas provide better type safety
2. **Enhanced Streaming** - fullStream API provides richer event types
3. **Better Error Handling** - Consistent error propagation
4. **Cleaner Code** - Less boilerplate for agent creation
5. **Future-Ready** - Easy to add sub-agents, hooks, and other Volt features

## Testing

Before switching to production:

1. Test each migrated service individually
2. Verify streaming responses work correctly
3. Ensure tool execution maintains compatibility
4. Check error handling paths
5. Monitor Helicone for proper tracking

## Rollback Plan

If issues arise, the original files are preserved:

- Simply revert the import changes
- No database or API changes required
- Full backward compatibility maintained
