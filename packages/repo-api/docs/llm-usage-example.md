# LLM System Usage Examples

## Starting a Project Generation Conversation

```javascript
// 1. Start a conversation
const response = await fetch("/api/llm/conversations", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer YOUR_TOKEN",
  },
  body: JSON.stringify({
    type: "project_generation",
    context: {
      model: "gpt-4.1-mini",
    },
  }),
});

const { conversationId } = await response.json();

// 2. Send a message to generate project
const eventSource = new EventSource(
  `/api/llm/conversations/${conversationId}/messages`,
  {
    method: "POST",
    headers: {
      Authorization: "Bearer YOUR_TOKEN",
    },
    body: JSON.stringify({
      message: "Create a React TypeScript todo app with Tailwind CSS",
    }),
  }
);

// 3. Handle streaming response
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "content":
      // Streaming text from AI
      console.log(data.content);
      break;

    case "tool_result":
      // File was created/updated
      console.log(`Tool ${data.tool}:`, data.result);
      break;

    case "done":
      // Response complete
      eventSource.close();
      break;

    case "error":
      console.error("Error:", data.error);
      eventSource.close();
      break;
  }
};

// 4. Push to GitHub when ready
const pushResponse = await fetch(
  `/api/llm/conversations/${conversationId}/github`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer YOUR_TOKEN",
    },
    body: JSON.stringify({
      repo: "my-todo-app",
      commitMessage: "Initial commit - Generated with AI",
    }),
  }
);

const pushResult = await pushResponse.json();
console.log("GitHub URL:", pushResult.url);
```

## Simple CLI Usage

```bash
# Start conversation
curl -X POST http://localhost:3001/api/llm/conversations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "project_generation"}'

# Send message (returns streaming response)
curl -X POST http://localhost:3001/api/llm/conversations/$CONV_ID/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Create a simple Express API with TypeScript"}'

# Push to GitHub
curl -X POST http://localhost:3001/api/llm/conversations/$CONV_ID/github \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"repo": "my-express-api"}'
```

## Architecture Benefits

1. **Simple** - No complex abstractions, just conversations with tools
2. **Flexible** - Easy to add new conversation types and tools
3. **Direct** - Projects go straight to GitHub, no intermediate storage
4. **Clean** - ~300 lines of core code vs thousands before

## Adding New Conversation Types

1. Create a new pattern file in `lib/llm/patterns/`:

```javascript
// lib/llm/patterns/codeReview.js
export function getSystemPrompt(context) {
  return `You are a code reviewer...`;
}

export function getTools() {
  return [...searchTools, ...analysisTools];
}
```

2. Use it:

```javascript
const { conversationId } = await fetch("/api/llm/conversations", {
  method: "POST",
  body: JSON.stringify({ type: "code_review" }),
});
```

That's it! No plugins, no frameworks, just simple composed behavior.
