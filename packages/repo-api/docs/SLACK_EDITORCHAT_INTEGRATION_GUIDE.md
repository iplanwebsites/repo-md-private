# Slack-EditorChat Integration Guide

## Overview

This guide outlines how to integrate the editorChat LLM functionality into Slack, enabling seamless conversations that can be viewed and continued across both web and Slack interfaces.

## Current State

### EditorChat (Web)

- Full Volt Agent integration with streaming
- Project context awareness
- Tool execution with file tracking
- Conversation stored in MongoDB (`editorChats` collection)
- Session-based with chat IDs

### Slack Integration

- Command-based interaction (no real LLM yet)
- Thread-based conversations
- Stored in `slackConversations` collection
- Agent management through `slackAgents` collection

## Proposed Architecture

### 1. Unified Conversation Storage

Create a unified conversation model that both interfaces can use:

```javascript
// New unified conversation schema
const unifiedConversation = {
  _id: ObjectId,

  // Core fields
  messages: [
    {
      id: String,
      role: "user" | "assistant" | "system",
      content: String,
      timestamp: Date,

      // Source tracking
      source: {
        interface: "web" | "slack",
        userId: ObjectId,
        metadata: {
          // For Slack
          channelId: String,
          threadTs: String,
          messageTs: String,

          // For Web
          sessionId: String,
          clientIp: String,
        },
      },

      // Tool usage
      toolCalls: [
        {
          toolName: String,
          args: Object,
          result: Object,
          timestamp: Date,
        },
      ],
    },
  ],

  // Context
  project: ObjectId,
  org: ObjectId,
  user: ObjectId, // Primary user
  participants: [
    {
      // All users who have interacted
      userId: ObjectId,
      interface: String,
      lastActive: Date,
    },
  ],

  // State
  status: "active" | "archived",
  lastActivity: Date,

  // Interface-specific data
  webData: {
    chatId: String,
    sessionBranch: String,
  },
  slackData: {
    teamId: String,
    channelId: String,
    threadTs: String,
  },

  // Agent configuration
  agentConfig: {
    archetype: String,
    model: String,
    temperature: Number,
    customInstructions: String,
  },

  // Metadata
  createdAt: Date,
  updatedAt: Date,
};
```

### 2. Conversation Sync Service

Create a service to keep conversations synchronized:

```javascript
// lib/conversations/UnifiedConversationService.js
export class UnifiedConversationService {
  /**
   * Create or get a unified conversation
   */
  static async getOrCreateConversation({
    // Required
    orgId,
    userId,

    // Optional identifiers (at least one required)
    webChatId,
    slackThreadId,
    projectId,

    // Initial config
    agentArchetype = "GENERALIST",
    model = "gpt-4.1-mini",
  }) {
    // Check if conversation exists
    const query = {
      org: orgId,
      $or: [],
    };

    if (webChatId) query.$or.push({ "webData.chatId": webChatId });
    if (slackThreadId) query.$or.push({ "slackData.threadTs": slackThreadId });

    let conversation = await db.unifiedConversations.findOne(query);

    if (!conversation) {
      // Create new unified conversation
      conversation = await db.unifiedConversations.insertOne({
        messages: [],
        project: projectId,
        org: orgId,
        user: userId,
        participants: [
          {
            userId,
            interface: webChatId ? "web" : "slack",
            lastActive: new Date(),
          },
        ],
        status: "active",
        lastActivity: new Date(),
        webData: webChatId ? { chatId: webChatId } : null,
        slackData: slackThreadId ? { threadTs: slackThreadId } : null,
        agentConfig: {
          archetype: agentArchetype,
          model,
          temperature: 0.7,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return conversation;
  }

  /**
   * Add a message to the conversation
   */
  static async addMessage(conversationId, message) {
    const messageDoc = {
      id: uuidv4(),
      ...message,
      timestamp: new Date(),
    };

    await db.unifiedConversations.updateOne(
      { _id: conversationId },
      {
        $push: { messages: messageDoc },
        $set: {
          lastActivity: new Date(),
          updatedAt: new Date(),
        },
        $addToSet: {
          participants: {
            userId: message.source.userId,
            interface: message.source.interface,
            lastActive: new Date(),
          },
        },
      }
    );

    return messageDoc;
  }

  /**
   * Link a Slack thread to an existing web conversation
   */
  static async linkSlackThread(webChatId, slackData) {
    return await db.unifiedConversations.updateOne(
      { "webData.chatId": webChatId },
      {
        $set: {
          slackData,
          updatedAt: new Date(),
        },
      }
    );
  }
}
```

### 3. Unified Agent Execution

Create a wrapper that both interfaces can use:

```javascript
// lib/agents/UnifiedAgentExecutor.js
import { UnifiedAgentFactory } from "./UnifiedAgentFactory.js";
import { UnifiedConversationService } from "../conversations/UnifiedConversationService.js";

export class UnifiedAgentExecutor {
  constructor(conversation, interface) {
    this.conversation = conversation;
    this.interface = interface; // "web" or "slack"
    this.agent = null;
  }

  async initialize() {
    // Create agent based on conversation config
    this.agent = await UnifiedAgentFactory.createAgent({
      name: `${this.conversation.agentConfig.archetype} Agent`,
      archetype: this.conversation.agentConfig.archetype,
      model: this.conversation.agentConfig.model,

      user: { _id: this.conversation.user },
      org: { _id: this.conversation.org },
      project: this.conversation.project
        ? await db.projects.findOne({ _id: this.conversation.project })
        : null,

      interface: this.interface,
      sessionId: this.conversation._id.toString(),

      // Include conversation history in context
      conversationHistory: this.conversation.messages,
    });
  }

  async processMessage(userMessage, options = {}) {
    // Add user message to conversation
    await UnifiedConversationService.addMessage(this.conversation._id, {
      role: "user",
      content: userMessage,
      source: {
        interface: this.interface,
        userId: options.userId,
        metadata: options.sourceMetadata,
      },
    });

    // Generate response
    const response = await this.agent.generateText(userMessage, {
      provider: {
        temperature: this.conversation.agentConfig.temperature,
        maxTokens: options.maxTokens || 2000,
      },
    });

    // Add assistant response to conversation
    await UnifiedConversationService.addMessage(this.conversation._id, {
      role: "assistant",
      content: response.text,
      source: {
        interface: this.interface,
        userId: "assistant",
      },
      toolCalls: response.toolCalls,
    });

    return response;
  }

  async streamMessage(userMessage, options = {}) {
    // Similar to processMessage but with streaming
    // Returns a stream that both web and Slack can consume
  }
}
```

### 4. Updated Slack Message Handler

Enhance the Slack handler to use the unified system:

```javascript
// lib/slack/messageHandlerUnified.js
import { UnifiedConversationService } from "../conversations/UnifiedConversationService.js";
import { UnifiedAgentExecutor } from "../agents/UnifiedAgentExecutor.js";

export class SlackMessageHandlerUnified extends SlackMessageHandler {
  async handleAppMention(event, teamId) {
    await this.initialize(teamId);

    // Get or create unified conversation
    const conversation =
      await UnifiedConversationService.getOrCreateConversation({
        orgId: this.org._id,
        userId: event.user,
        slackThreadId: event.thread_ts || event.ts,
        projectId: await this.detectProjectFromContext(event),
      });

    // Create executor
    const executor = new UnifiedAgentExecutor(conversation, "slack");
    await executor.initialize();

    // Process message
    const response = await executor.processMessage(event.text, {
      userId: event.user,
      sourceMetadata: {
        channelId: event.channel,
        threadTs: event.thread_ts || event.ts,
        messageTs: event.ts,
      },
    });

    // Send response to Slack
    await this.sendResponse(event, response);

    // If this conversation has a web chat, notify web clients
    if (conversation.webData?.chatId) {
      await this.notifyWebClients(conversation.webData.chatId, response);
    }
  }

  async sendResponse(event, response) {
    // Format response for Slack
    const blocks = this.formatResponseBlocks(response);

    await this.client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts || event.ts,
      text: response.text.substring(0, 200) + "...",
      blocks,
      metadata: {
        event_type: "assistant_response",
        conversation_id: response.conversationId,
      },
    });
  }
}
```

### 5. Web EditorChat Updates

Update the web editor to use the unified system:

```javascript
// lib/llm/editorChatUnified.js
export class EditorChatHandlerUnified extends EditorChatHandlerVolt {
  async initialize() {
    // Create unified conversation
    this.unifiedConversation =
      await UnifiedConversationService.getOrCreateConversation({
        orgId: this.org._id,
        userId: this.user._id,
        webChatId: this.chatId,
        projectId: this.project?._id,
        agentArchetype: this.agentArchetype,
      });

    // Create executor
    this.executor = new UnifiedAgentExecutor(this.unifiedConversation, "web");
    await this.executor.initialize();

    // Original initialization
    await super.initialize();
  }

  async handleMessage(message, res) {
    if (this.enableStreaming) {
      // Stream response
      const stream = await this.executor.streamMessage(message, {
        userId: this.user._id,
        sourceMetadata: {
          sessionId: this.chatId,
          clientIp: res.req.ip,
        },
      });

      // Pipe to SSE
      await this.streamToSSE(stream, res);
    } else {
      // Non-streaming response
      const response = await this.executor.processMessage(message, {
        userId: this.user._id,
      });

      res.json(response);
    }

    // If linked to Slack, notify
    if (this.unifiedConversation.slackData?.threadTs) {
      await this.notifySlackThread(this.unifiedConversation.slackData);
    }
  }
}
```

### 6. Cross-Platform Features

#### A. Conversation Linking

Allow users to link their web and Slack conversations:

```javascript
// Slash command: /link-conversation [web-chat-id]
async function handleLinkConversation(slashCommand) {
  const { text, channel_id, user_id } = slashCommand;
  const webChatId = text.trim();

  // Verify ownership
  const webChat = await db.editorChats.findOne({
    _id: new ObjectId(webChatId),
    user: user_id,
  });

  if (!webChat) {
    return "Chat not found or you don't have access.";
  }

  // Link conversations
  await UnifiedConversationService.linkSlackThread(webChatId, {
    teamId: slashCommand.team_id,
    channelId: channel_id,
    threadTs: Date.now().toString(), // New thread
  });

  return `Linked! Continue your conversation here or on the web.`;
}
```

#### B. Conversation Viewing

Create endpoints to view conversations from either interface:

```javascript
// API endpoint for web to get Slack messages
router.get("/api/conversations/:id/messages", async (req, res) => {
  const conversation = await db.unifiedConversations.findOne({
    _id: new ObjectId(req.params.id),
    $or: [{ user: req.user._id }, { "participants.userId": req.user._id }],
  });

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  res.json({
    messages: conversation.messages,
    sources: {
      web: !!conversation.webData,
      slack: !!conversation.slackData,
    },
  });
});
```

#### C. Real-time Sync

Use WebSockets or SSE to sync conversations in real-time:

```javascript
// Notify web clients when Slack messages arrive
async function notifyWebClients(chatId, message) {
  const connections = getActiveConnections(chatId);

  for (const conn of connections) {
    conn.send(
      JSON.stringify({
        type: "new_message",
        source: "slack",
        message,
      })
    );
  }
}
```

## Implementation Steps

### Phase 1: Foundation (Week 1)

1. [ ] Create `unifiedConversations` collection and schema
2. [ ] Implement `UnifiedConversationService`
3. [ ] Create migration script for existing conversations
4. [ ] Set up basic CRUD operations

### Phase 2: Agent Integration (Week 2)

1. [ ] Create `UnifiedAgentExecutor`
2. [ ] Update `SlackMessageHandler` to use unified system
3. [ ] Update `EditorChatHandler` to use unified system
4. [ ] Test basic message flow

### Phase 3: Cross-Platform Features (Week 3)

1. [ ] Implement conversation linking
2. [ ] Add cross-platform notifications
3. [ ] Create conversation viewing endpoints
4. [ ] Add real-time sync

### Phase 4: UI/UX (Week 4)

1. [ ] Update web UI to show Slack messages
2. [ ] Add Slack source indicators
3. [ ] Create conversation switcher
4. [ ] Add link/unlink controls

### Phase 5: Advanced Features (Ongoing)

1. [ ] Message threading
2. [ ] File attachment sync
3. [ ] Reaction sync
4. [ ] Presence indicators

## Benefits

1. **Seamless Experience**: Start on Slack, continue on web (or vice versa)
2. **Context Preservation**: Full conversation history available everywhere
3. **Team Collaboration**: Multiple users can participate from different interfaces
4. **Flexibility**: Use the interface that suits the moment
5. **Unified Analytics**: Track usage across all platforms

## Challenges & Solutions

### Challenge 1: Message Formatting

- **Issue**: Slack uses blocks, web uses Markdown
- **Solution**: Store raw content, render based on interface

### Challenge 2: User Identity

- **Issue**: Different user IDs in Slack vs web
- **Solution**: Map Slack users to web users via email/OAuth

### Challenge 3: Rate Limits

- **Issue**: Slack has strict rate limits
- **Solution**: Queue and batch updates, use webhooks efficiently

### Challenge 4: Permissions

- **Issue**: Project access differs between interfaces
- **Solution**: Unified permission checking in conversation service

## Migration Strategy

1. **Dual Write**: New conversations write to both old and new schemas
2. **Background Migration**: Migrate existing conversations gradually
3. **Feature Flag**: Enable unified mode per organization
4. **Fallback**: Keep old handlers as fallback during transition

## Success Metrics

- Conversations continued across platforms: Target 20%
- Reduced context switching: Measure time saved
- User satisfaction: Survey on unified experience
- Technical: Query performance, sync latency

## Future Enhancements

1. **Mobile App Integration**: Extend to mobile platforms
2. **Voice Integration**: Add voice messages from Slack
3. **Rich Media**: Sync images, files, and code blocks
4. **AI Summaries**: Summarize long cross-platform conversations
5. **Export**: Export unified conversations in various formats
