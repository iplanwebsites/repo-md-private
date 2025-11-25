# Slack Frontend Integration Guide

This guide provides the necessary information for implementing the Slack integration UI in the frontend application.

## Overview

The Slack integration allows organizations to connect their Slack workspace to receive notifications about deployments, errors, and other project events. Users can configure which Slack channels receive which types of notifications.

### Key Features

- **Thread Context Awareness**: When the bot is mentioned in an existing conversation, it automatically fetches and analyzes up to 100 messages from the thread to understand the context
- **Intelligent Responses**: The bot analyzes conversations for technical details and provides contextual responses
- **Conversation Tracking**: All interactions are stored for later reference
- **Slash Commands**: Use `/projects` to list organization projects

## tRPC API Endpoints

All Slack-related operations are available through the tRPC router at `trpc.slack.*`:

### 1. Get Installation Status

Check if an organization has Slack installed and get current configuration.

```typescript
// Request
const status = await trpc.slack.getInstallationStatus.query({
  orgHandle: "my-org" // Organization handle
});

// Response
{
  isInstalled: boolean,
  teamName: string | null,      // Slack workspace name
  installedAt: Date | null,     // When Slack was connected
  channels: [{                  // Configured channels
    id: string,
    name: string,
    types: ("deployments" | "errors" | "general")[]
  }]
}
```

### 2. Generate Installation URL

Get the URL to start the Slack OAuth flow. Only organization admins/owners can call this.

```typescript
// Request
const { installUrl, orgName } = await trpc.slack.generateInstallUrl.mutation({
  orgHandle: "my-org"
});

// Response
{
  installUrl: string,    // URL to redirect user to
  orgName: string       // Organization display name
}
```

### 3. Uninstall Slack Integration

Remove the Slack integration from an organization. Only admins/owners can call this.

```typescript
// Request
const result = await trpc.slack.uninstall.mutation({
  orgHandle: "my-org"
});

// Response
{
  success: boolean
}
```

### 4. Configure Notification Channels

Set which Slack channels receive which types of notifications.

```typescript
// Request
const result = await trpc.slack.configureChannels.mutation({
  orgHandle: "my-org",
  channels: [
    {
      id: "C1234567890",        // Slack channel ID
      name: "general",          // Channel name (for display)
      types: ["deployments", "general"]  // Notification types
    },
    {
      id: "C0987654321",
      name: "dev-alerts",
      types: ["errors"]
    }
  ]
});

// Response
{
  success: boolean
}
```

### 5. Get Available Channels

Fetch list of public Slack channels the bot can post to.

```typescript
// Request
const { channels } = await trpc.slack.getChannels.query({
  orgHandle: "my-org"
});

// Response
{
  channels: [{
    id: string,         // Slack channel ID
    name: string,       // Channel name
    isMember: boolean   // Whether bot is a member
  }]
}
```

### 6. Test Notification

Send a test message to verify the integration is working.

```typescript
// Request
const result = await trpc.slack.testNotification.mutation({
  orgHandle: "my-org",
  channelId: "C1234567890",  // Optional, uses first configured channel if not provided
  message: "Test notification from Repo.md!"  // Optional custom message
});

// Response
{
  success: boolean,
  channelId: string  // ID of channel message was sent to
}
```

### 7. Get Conversation History

Retrieve Slack conversations and mentions for the organization.

```typescript
// Request
const { conversations, total } = await trpc.slack.getConversations.query({
  orgHandle: "my-org",
  limit: 50,      // Optional, default 50
  skip: 0         // Optional, for pagination
});

// Response
{
  conversations: [{
    _id: string,
    teamId: string,
    channelId: string,
    userId: string,
    orgId: string,
    messageTs: string,
    threadTs: string,
    text: string,
    type: "mention" | "bot_message",
    createdAt: Date,
    processed: boolean,
    responseTs?: string,
    respondedAt?: Date
  }],
  total: number
}
```

### 8. Send Message to Slack

Send a message to a Slack channel or thread.

```typescript
// Request
const result = await trpc.slack.sendMessage.mutation({
  orgHandle: "my-org",
  channelId: "C1234567890",
  message: "Hello from Repo.md!",
  threadTs: "1234567890.123456"  // Optional, to reply in a thread
});

// Response
{
  success: boolean,
  messageTs: string,    // Timestamp of the sent message
  channelId: string     // Channel where message was sent
}
```

### 9. Get User Agents

Retrieve Background Agents for the current user.

```typescript
// Request
const { agents } = await trpc.slack.getUserAgents.query({
  orgHandle: "my-org",
  includeCompleted: false  // Optional, default false
});

// Response
{
  agents: [{
    _id: string,
    orgId: string,
    channelId: string,
    threadTs: string,
    userId: string,
    userName: string,
    status: "pending" | "running" | "completed" | "failed" | "archived",
    command: string,
    options: {
      branch?: string,
      model?: string,
      repo?: string,
      autopr?: boolean
    },
    projectId?: string,
    prUrl?: string,
    requestId: string,
    createdAt: Date,
    updatedAt: Date,
    completedAt?: Date,
    error?: string
  }]
}
```

### 10. Get Agent Details

Get detailed information about a specific agent.

```typescript
// Request
const { agent } = await trpc.slack.getAgent.query({
  orgHandle: "my-org",
  agentId: "507f1f77bcf86cd799439011"
});

// Response
{
  agent: {
    // Same structure as agents in getUserAgents
  }
}
```

### 11. Get Channel Settings

Retrieve default settings for a specific channel.

```typescript
// Request
const { settings } = await trpc.slack.getChannelSettings.query({
  orgHandle: "my-org",
  channelId: "C1234567890"
});

// Response
{
  settings: {
    repository?: string,
    branch?: string,
    model?: string,
    autopr?: boolean
  }
}
```

## Frontend Implementation Guide

### 1. Slack Settings Page Component

Create a settings page for managing Slack integration:

```tsx
import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';

export function SlackSettings({ orgHandle }: { orgHandle: string }) {
  const [isInstalling, setIsInstalling] = useState(false);
  
  // Fetch current status
  const { data: status, refetch } = trpc.slack.getInstallationStatus.useQuery({
    orgHandle
  });
  
  // Mutations
  const generateInstallUrl = trpc.slack.generateInstallUrl.useMutation();
  const uninstall = trpc.slack.uninstall.useMutation();
  const testNotification = trpc.slack.testNotification.useMutation();
  
  // Handle installation
  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      const { installUrl } = await generateInstallUrl.mutateAsync({ orgHandle });
      
      // Open in popup window
      const popup = window.open(
        installUrl,
        'slack-oauth',
        'width=600,height=700'
      );
      
      // Listen for completion message
      const messageHandler = (event: MessageEvent) => {
        if (event.data.type === 'slack-connected') {
          popup?.close();
          window.removeEventListener('message', messageHandler);
          refetch(); // Refresh status
          setIsInstalling(false);
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Fallback: Check if popup was closed
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageHandler);
          refetch();
          setIsInstalling(false);
        }
      }, 1000);
      
    } catch (error) {
      console.error('Failed to start Slack installation:', error);
      setIsInstalling(false);
    }
  };
  
  // Handle uninstall
  const handleUninstall = async () => {
    if (!confirm('Are you sure you want to disconnect Slack?')) return;
    
    try {
      await uninstall.mutateAsync({ orgHandle });
      refetch();
    } catch (error) {
      console.error('Failed to uninstall Slack:', error);
    }
  };
  
  // Handle test notification
  const handleTest = async () => {
    try {
      await testNotification.mutateAsync({ orgHandle });
      alert('Test notification sent!');
    } catch (error) {
      console.error('Failed to send test notification:', error);
      alert('Failed to send test notification');
    }
  };
  
  if (!status) return <div>Loading...</div>;
  
  return (
    <div className="slack-settings">
      <h2>Slack Integration</h2>
      
      {!status.isInstalled ? (
        <div className="not-connected">
          <p>Connect Slack to receive notifications about deployments and errors.</p>
          <button 
            onClick={handleInstall} 
            disabled={isInstalling}
          >
            {isInstalling ? 'Connecting...' : 'Connect Slack'}
          </button>
        </div>
      ) : (
        <div className="connected">
          <div className="connection-info">
            <h3>Connected to {status.teamName}</h3>
            <p>Connected on {new Date(status.installedAt!).toLocaleDateString()}</p>
            <button onClick={handleTest}>Send Test Notification</button>
            <button onClick={handleUninstall} className="danger">
              Disconnect Slack
            </button>
          </div>
          
          <ChannelConfiguration orgHandle={orgHandle} />
        </div>
      )}
    </div>
  );
}
```

### 2. Channel Configuration Component

Component for configuring which channels receive notifications:

```tsx
function ChannelConfiguration({ orgHandle }: { orgHandle: string }) {
  const [selectedChannels, setSelectedChannels] = useState<any[]>([]);
  
  // Fetch available channels
  const { data: channelsData } = trpc.slack.getChannels.useQuery({ orgHandle });
  const { data: status } = trpc.slack.getInstallationStatus.useQuery({ orgHandle });
  
  const configureChannels = trpc.slack.configureChannels.useMutation();
  
  useEffect(() => {
    if (status?.channels) {
      setSelectedChannels(status.channels);
    }
  }, [status]);
  
  const handleSave = async () => {
    try {
      await configureChannels.mutateAsync({
        orgHandle,
        channels: selectedChannels
      });
      alert('Channel configuration saved!');
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  };
  
  const toggleChannelType = (channelId: string, type: string) => {
    setSelectedChannels(prev => {
      const existing = prev.find(ch => ch.id === channelId);
      if (!existing) {
        // Add new channel configuration
        return [...prev, {
          id: channelId,
          name: channelsData?.channels.find(ch => ch.id === channelId)?.name || '',
          types: [type]
        }];
      } else {
        // Toggle type in existing channel
        const types = existing.types.includes(type)
          ? existing.types.filter(t => t !== type)
          : [...existing.types, type];
        
        // Remove channel if no types selected
        if (types.length === 0) {
          return prev.filter(ch => ch.id !== channelId);
        }
        
        return prev.map(ch => 
          ch.id === channelId ? { ...ch, types } : ch
        );
      }
    });
  };
  
  const isTypeSelected = (channelId: string, type: string) => {
    const channel = selectedChannels.find(ch => ch.id === channelId);
    return channel?.types.includes(type) || false;
  };
  
  if (!channelsData) return <div>Loading channels...</div>;
  
  return (
    <div className="channel-configuration">
      <h3>Notification Channels</h3>
      <p>Select which channels should receive which types of notifications:</p>
      
      <table>
        <thead>
          <tr>
            <th>Channel</th>
            <th>Deployments</th>
            <th>Errors</th>
            <th>General</th>
          </tr>
        </thead>
        <tbody>
          {channelsData.channels.map(channel => (
            <tr key={channel.id}>
              <td>#{channel.name}</td>
              <td>
                <input
                  type="checkbox"
                  checked={isTypeSelected(channel.id, 'deployments')}
                  onChange={() => toggleChannelType(channel.id, 'deployments')}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={isTypeSelected(channel.id, 'errors')}
                  onChange={() => toggleChannelType(channel.id, 'errors')}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={isTypeSelected(channel.id, 'general')}
                  onChange={() => toggleChannelType(channel.id, 'general')}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <button 
        onClick={handleSave}
        disabled={configureChannels.isLoading}
      >
        {configureChannels.isLoading ? 'Saving...' : 'Save Configuration'}
      </button>
    </div>
  );
}
```

### 3. Integration Status Badge

A small component to show Slack connection status:

```tsx
export function SlackStatusBadge({ orgHandle }: { orgHandle: string }) {
  const { data: status } = trpc.slack.getInstallationStatus.useQuery({
    orgHandle
  });
  
  if (!status) return null;
  
  return (
    <div className={`slack-badge ${status.isInstalled ? 'connected' : 'disconnected'}`}>
      <SlackIcon />
      {status.isInstalled ? `Connected to ${status.teamName}` : 'Not connected'}
    </div>
  );
}
```

### 4. Slack Conversations Viewer

Component to view and reply to Slack conversations:

```tsx
export function SlackConversations({ orgHandle }: { orgHandle: string }) {
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  
  // Fetch conversations
  const { data, refetch } = trpc.slack.getConversations.useQuery({
    orgHandle,
    limit: 50
  });
  
  const sendMessage = trpc.slack.sendMessage.useMutation();
  
  const handleReply = async (channelId: string, threadTs?: string) => {
    if (!replyMessage.trim()) return;
    
    try {
      await sendMessage.mutateAsync({
        orgHandle,
        channelId,
        message: replyMessage,
        threadTs
      });
      
      setReplyMessage('');
      refetch(); // Refresh conversations
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };
  
  const groupedByThread = data?.conversations.reduce((acc, conv) => {
    const key = conv.threadTs;
    if (!acc[key]) acc[key] = [];
    acc[key].push(conv);
    return acc;
  }, {} as Record<string, typeof data.conversations>);
  
  return (
    <div className="slack-conversations">
      <h3>Slack Conversations</h3>
      
      {Object.entries(groupedByThread || {}).map(([threadTs, messages]) => (
        <div key={threadTs} className="conversation-thread">
          {messages.map((msg) => (
            <div key={msg._id} className={`message ${msg.type}`}>
              <div className="message-header">
                <span className="user">{msg.userId === 'bot' ? '🤖 Repo.md Bot' : `👤 ${msg.userId}`}</span>
                <span className="time">{new Date(msg.createdAt).toLocaleString()}</span>
              </div>
              <div className="message-text">{msg.text}</div>
            </div>
          ))}
          
          <div className="reply-box">
            <input
              type="text"
              placeholder="Type a reply..."
              value={selectedThread === threadTs ? replyMessage : ''}
              onChange={(e) => {
                setSelectedThread(threadTs);
                setReplyMessage(e.target.value);
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleReply(messages[0].channelId, threadTs);
                }
              }}
            />
            <button
              onClick={() => handleReply(messages[0].channelId, threadTs)}
              disabled={sendMessage.isLoading}
            >
              {sendMessage.isLoading ? 'Sending...' : 'Reply'}
            </button>
          </div>
        </div>
      ))}
      
      {(!data || data.conversations.length === 0) && (
        <p>No conversations yet. Mention your bot in Slack to start!</p>
      )}
    </div>
  );
}
```

## Notification Types

The following notification types are supported:

- **`deployments`**: Notifications about deployment successes and failures
- **`errors`**: Error notifications and alerts
- **`general`**: General notifications and updates

## Authentication Flow

1. User clicks "Connect Slack" button
2. Frontend calls `generateInstallUrl` mutation
3. User is redirected to Slack OAuth page (preferably in popup)
4. User authorizes the app in Slack
5. Slack redirects to `/api/slack/callback` with auth code
6. Backend exchanges code for access token and stores installation
7. Backend associates Slack team with the organization
8. Success page sends `postMessage` to close popup
9. Frontend refreshes status to show connected state

## Error Handling

Common errors and how to handle them:

```typescript
try {
  const result = await trpc.slack.someMethod.mutateAsync(params);
} catch (error) {
  if (error.code === 'FORBIDDEN') {
    // User doesn't have permission
    alert('You need to be an organization admin to manage Slack integration');
  } else if (error.code === 'NOT_FOUND') {
    // Organization or installation not found
    alert('Slack integration not found');
  } else {
    // Generic error
    alert('An error occurred. Please try again.');
  }
}
```

## Required Slack App Configuration

When setting up your Slack app, ensure you have the following Bot Token Scopes:
- `chat:write` - Post messages to channels
- `chat:write.public` - Post messages to channels the bot isn't a member of
- `commands` - Handle slash commands
- `users:read` - Access user information
- `users:read.email` - Access user email addresses
- `channels:read` - List and read public channels
- `groups:read` - List and read private channels
- `app_mentions:read` - Receive events when the bot is mentioned

### Event Subscriptions

Enable Event Subscriptions in your Slack app settings:
1. Request URL: `https://your-ngrok-url.ngrok-free.app/api/slack/events`
2. Subscribe to bot events:
   - `app_mention` - When someone mentions your bot
   - `message.channels` - To receive channel messages (for thread replies)
   - `message.groups` - To receive private channel messages
   - `message.im` - To receive direct messages
   - `message.mpim` - To receive multi-person DM messages

### Required Additional Scopes for Thread Conversations
- `channels:history` - Read messages in public channels
- `groups:history` - Read messages in private channels
- `im:history` - Read messages in DMs
- `mpim:history` - Read messages in group DMs

## Security Considerations

1. Only organization admins/owners can install or configure Slack
2. The backend validates user permissions on all endpoints
3. Slack webhooks are verified using signing secrets
4. OAuth state parameter includes organization and user IDs
5. Access tokens are stored securely in the database

## Testing

To test the Slack integration:

1. Set up ngrok tunnel: `npm run t`
2. Configure Slack app with ngrok URLs
3. Add test Slack workspace
4. Use the test notification endpoint to verify messages are sent
5. Test the /projects slash command in Slack

## Troubleshooting

### "Installation not found" error
- Check that the Slack workspace is properly connected
- Verify the organization has `slackIntegration` field populated

### Messages not being sent
- Ensure the bot has been invited to the target channels
- Check that channels are properly configured in settings
- Verify environment variables are set correctly

### OAuth errors
- Ensure redirect URLs match in Slack app settings
- Check that all required scopes are configured
- Verify client ID and secret are correct

### Bot not understanding conversation context
- Ensure the bot has `channels:history` and related scopes
- Check that the bot is a member of the channel (for private channels)
- Verify the thread history permissions are enabled in Slack app settings

## Example Use Cases

### Team Discusses Issue, Bot Implements Fix

```
Sarah: Hey team, users can't log in after the latest deploy
Mike: I checked the logs - auth token validation failing on line 247 of auth.js
Alex: The regex expects old format but we changed the token format
Sarah: We need to update it to handle both formats for backwards compatibility
You: @repo-bot fix this

Repo Bot: ⏳ Creating Background Agent...
📡 Request ID: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
🔧 Command: `fix this`

[Open in Repo.md]

Agent created by John • Using full thread context

... (5 minutes later) ...

Repo Bot: ✅ Background Agent completed successfully!
Successfully implemented the requested changes.

[View PR] [View in Repo.md]

Request ID: `a1b2c3d4-e5f6-7890-abcd-ef1234567890` • Completed in 5m 23s
```

In this example:
1. The bot fetched the entire thread history when mentioned
2. Created a Background Agent with full context
3. Implemented the fix based on the team's discussion
4. Created a PR with the changes

### Using Options and Commands

```
You: @repo-bot [repo=myorg/api, branch=fix/auth] update the token validation

Repo Bot: ⏳ Creating Background Agent...
📡 Request ID: `xyz123`
🔧 Command: `update the token validation`

Options:
• repo: myorg/api
• branch: fix/auth
```

### Managing Agents

```
You: @repo-bot list my agents

Repo Bot: Your active Background Agents (2)

🚀 fix the login bug
📍 Channel: #dev-team
🕑 Started: 1/7/2025, 3:45 PM
[View]

⏳ implement dark mode
📍 Channel: #frontend
🕑 Started: 1/7/2025, 2:30 PM
[View]
```

### Channel Settings

```
You: @repo-bot settings

Repo Bot: ⚙️ Channel Settings
Configure default settings for Background Agents in this channel.

Current Settings:
• Repository: myorg/frontend
• Branch: main
• Model: gpt-4
• Autopr: true

[Open Settings]
```