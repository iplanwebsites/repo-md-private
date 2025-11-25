# Simple Slack-EditorChat Integration Guide

## Overview

Use the existing `editorChats` collection to store all conversations, just add Slack references when messages come from Slack.

## Proposed Simple Schema Updates

### 1. Update EditorChat Messages

Just add optional Slack metadata to existing message structure:

```javascript
// Existing editorChat document - just add slackMetadata to messages
{
  _id: ObjectId,
  user: ObjectId,
  org: ObjectId,
  project: ObjectId,
  messages: [
    {
      role: "user",
      content: "How do I deploy this?",

      // NEW: Optional Slack metadata
      slackMetadata: {
        channelId: "C1234567890",
        threadTs: "1234567890.123456",
        messageTs: "1234567890.123457",
        userId: "U1234567890",
      }
    },
    {
      role: "assistant",
      content: "To deploy your project...",

      // Track if this was sent to Slack
      slackMetadata: {
        channelId: "C1234567890",
        threadTs: "1234567890.123456",
        messageTs: "1234567890.123458",
      }
    }
  ],

  // NEW: Track Slack associations at chat level
  slackThreads: [
    {
      channelId: "C1234567890",
      threadTs: "1234567890.123456",
      teamId: "T1234567890",
      lastSynced: Date,
    }
  ],

  // Existing fields remain unchanged
  model: String,
  temperature: Number,
  metadata: Object,
  createdAt: Date,
  updatedAt: Date,
}
```

## Implementation

### 1. Shared Message Handler

Create a simple service that both web and Slack can use:

```javascript
// lib/llm/sharedChatService.js
import { EditorChatHandlerVolt } from "./editorChatVolt.js";
import editorChatDb from "../db/editorChat.js";

export class SharedChatService {
  /**
   * Get or create a chat, optionally linking to Slack thread
   */
  static async getOrCreateChat({
    user,
    org,
    project,
    slackThread, // Optional: { channelId, threadTs, teamId }
  }) {
    // Check if we already have a chat for this Slack thread
    if (slackThread) {
      const existingChat = await editorChatDb.findOne({
        "slackThreads.threadTs": slackThread.threadTs,
        "slackThreads.channelId": slackThread.channelId,
      });

      if (existingChat) {
        return existingChat;
      }
    }

    // Create new chat
    const chat = await editorChatDb.create({
      user: user._id,
      org: org._id,
      project: project?._id,
      slackThreads: slackThread ? [slackThread] : [],
    });

    return chat;
  }

  /**
   * Add a message to chat (from either web or Slack)
   */
  static async addMessage(chatId, message, slackMetadata = null) {
    const messageDoc = {
      ...message,
      timestamp: new Date(),
    };

    if (slackMetadata) {
      messageDoc.slackMetadata = slackMetadata;
    }

    await editorChatDb.updateOne(
      { _id: chatId },
      {
        $push: { messages: messageDoc },
        $set: { updatedAt: new Date() },
      }
    );

    return messageDoc;
  }

  /**
   * Link an existing chat to a Slack thread
   */
  static async linkToSlackThread(chatId, slackThread) {
    await editorChatDb.updateOne(
      { _id: chatId },
      {
        $addToSet: { slackThreads: slackThread },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Process a message using the EditorChat handler
   */
  static async processMessage(chat, userMessage, options = {}) {
    // Create handler
    const handler = new EditorChatHandlerVolt({
      user: { _id: chat.user },
      org: { _id: chat.org },
      project: chat.project ? { _id: chat.project } : null,
      chatId: chat._id,
      model: chat.model || "gpt-4.1-mini",
      temperature: chat.temperature || 0.7,
      stream: false, // For simplicity
    });

    await handler.initialize();

    // Add user message
    await this.addMessage(
      chat._id,
      {
        role: "user",
        content: userMessage,
      },
      options.slackMetadata
    );

    // Get AI response
    const response = await handler.handleMessage(userMessage);

    // Add assistant message
    await this.addMessage(chat._id, {
      role: "assistant",
      content: response.content,
      toolCalls: response.toolCalls,
    });

    return response;
  }
}
```

### 2. Updated Slack Handler

Modify Slack handler to use shared service:

```javascript
// lib/slack/messageHandlerIntegrated.js
import { SharedChatService } from "../llm/sharedChatService.js";

export class SlackMessageHandlerIntegrated extends SlackMessageHandler {
  async handleAppMention(event, teamId) {
    await this.initialize(teamId);

    // Get or create chat linked to this thread
    const chat = await SharedChatService.getOrCreateChat({
      user: { _id: event.user }, // Assumes Slack user ID maps to DB user
      org: this.org,
      project: await this.detectProjectFromMessage(event.text),
      slackThread: {
        channelId: event.channel,
        threadTs: event.thread_ts || event.ts,
        teamId,
      },
    });

    // Process message
    const response = await SharedChatService.processMessage(chat, event.text, {
      slackMetadata: {
        channelId: event.channel,
        threadTs: event.thread_ts || event.ts,
        messageTs: event.ts,
        userId: event.user,
      },
    });

    // Send response to Slack
    const slackResponse = await this.client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts || event.ts,
      text: response.content,
      blocks: this.formatResponseBlocks(response),
    });

    // Update the assistant message with Slack metadata
    await SharedChatService.updateLastMessage(chat._id, {
      slackMetadata: {
        channelId: event.channel,
        threadTs: event.thread_ts || event.ts,
        messageTs: slackResponse.ts,
      },
    });
  }

  /**
   * Detect project from message content or channel context
   */
  async detectProjectFromMessage(text) {
    // Check if message mentions a project
    const projectMatch = text.match(/project[:\s]+(\w+)/i);
    if (projectMatch) {
      const project = await db.projects.findOne({
        slug: projectMatch[1],
        orgId: this.org._id,
      });
      return project;
    }

    // Check channel default project
    const channelSettings = await agentManager.getChannelSettings(
      event.channel,
      this.installation.teamId
    );

    if (channelSettings?.defaultProjectId) {
      return await db.projects.findOne({
        _id: new ObjectId(channelSettings.defaultProjectId),
      });
    }

    return null;
  }
}
```

### 3. Web Interface Updates

Minimal changes to show Slack messages:

```javascript
// In editorChat UI component
function renderMessage(message) {
  const isFromSlack = !!message.slackMetadata;

  return (
    <div className={`message ${message.role}`}>
      <div className="content">{message.content}</div>
      {isFromSlack && (
        <div className="source-badge">
          <SlackIcon /> From Slack
        </div>
      )}
    </div>
  );
}

// Add link to view in Slack
function renderSlackLink(chat) {
  if (!chat.slackThreads?.length) return null;

  const thread = chat.slackThreads[0];
  const slackUrl = `slack://channel?team=${thread.teamId}&id=${thread.channelId}&thread_ts=${thread.threadTs}`;

  return (
    <a href={slackUrl} className="view-in-slack">
      View in Slack
    </a>
  );
}
```

### 4. Simple Slash Command

Link existing web chat to Slack:

```javascript
// /continue [chat-id] - Continue a web conversation in Slack
async function handleContinueCommand(command) {
  const chatId = command.text.trim();

  // Get the chat
  const chat = await editorChatDb.findById(chatId);
  if (!chat) {
    return "Chat not found";
  }

  // Link to current thread
  await SharedChatService.linkToSlackThread(chatId, {
    channelId: command.channel_id,
    threadTs: Date.now().toString(),
    teamId: command.team_id,
  });

  // Send summary to Slack
  const recentMessages = chat.messages.slice(-5);
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Continuing conversation from web*\nChat ID: ${chatId}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: recentMessages
          .map((m) => `*${m.role}*: ${m.content.substring(0, 100)}...`)
          .join("\n\n"),
      },
    },
  ];

  return { blocks };
}
```

## Benefits of This Approach

1. **No new collections** - Uses existing `editorChats`
2. **Minimal schema changes** - Just adds optional fields
3. **Backward compatible** - Old chats work unchanged
4. **Simple implementation** - Reuses existing handlers
5. **Clear data ownership** - One source of truth

## Implementation Steps

### Week 1: Core Integration

1. [ ] Add `slackMetadata` field to message schema
2. [ ] Add `slackThreads` array to chat schema
3. [ ] Create `SharedChatService`
4. [ ] Update Slack handler to use shared service

### Week 2: UI Updates

1. [ ] Add Slack badges to messages in web UI
2. [ ] Add "Continue in Slack" button
3. [ ] Add "View in Slack" links
4. [ ] Show which messages were sent to Slack

### Week 3: Polish

1. [ ] Handle user identity mapping
2. [ ] Format code blocks for Slack
3. [ ] Sync reactions (optional)
4. [ ] Add conversation search

## Limitations (Acceptable for Simplicity)

1. **User mapping** - Assumes Slack user IDs match DB users (can map by email later)
2. **No real-time sync** - Users need to refresh to see messages from other interface
3. **Formatting differences** - Some formatting may look different in each interface
4. **One-way threading** - Slack threads map to chats, but not vice versa

## Future Enhancements (If Needed)

1. Add WebSocket for real-time updates
2. Create user mapping table
3. Add message formatting converter
4. Support multiple Slack threads per chat

This approach keeps things simple while delivering the core value of unified conversations across web and Slack.
