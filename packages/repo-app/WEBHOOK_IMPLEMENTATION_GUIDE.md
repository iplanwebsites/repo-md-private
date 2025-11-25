# Incoming Webhook Implementation Guide

## Overview
The frontend now supports multiple incoming webhook URLs, each with custom permissions and AI-powered command interpretation. This guide outlines the backend implementation requirements.

## API Endpoints Required

### 1. Webhook Endpoints
```
POST /webhooks/{projectId}/incoming/{webhookId}
```
- Each webhook has a unique ID and URL
- Validates webhook exists and is active
- Processes payload through AI agent with custom instructions

### 2. Project Settings Updates
The existing project settings endpoint should store:
```javascript
{
  incomingWebhooks: [
    {
      id: "unique-webhook-id",
      name: "Slack Content Team",
      description: "Webhook for content automation",
      provider: "slack", // slack, github, discord, email, calendar, api, custom
      active: true,
      agentInstructions: "Extract the command from a Slack message. The 'text' field contains the user's request...",
      permissions: {
        content_management: {
          create_content: true,
          update_content: false,
          delete_content: false
        },
        media_management: {
          upload_media: false,
          generate_images: false,
          optimize_media: false
        },
        deployment: {
          trigger_build: false,
          deploy_preview: false,
          rollback: false
        },
        external_services: {
          call_apis: false,
          send_emails: false,
          trigger_webhooks: false
        },
        data_access: {
          read_analytics: true,
          access_database: false,
          modify_settings: false
        },
        ai_agents: {
          execute_agents: false,
          train_models: false
        }
      }
    }
  ]
}
```

## Processing Flow

### 1. Webhook Receipt
```javascript
// Example webhook processing
async function processIncomingWebhook(projectId, webhookId, payload) {
  // 1. Validate webhook exists and is active
  const webhook = await getWebhookConfig(projectId, webhookId);
  if (!webhook || !webhook.active) {
    return { status: 404, error: "Webhook not found or inactive" };
  }

  // 2. Pass to AI agent with instructions
  const command = await aiAgent.extractCommand({
    payload: payload,
    instructions: webhook.agentInstructions,
    provider: webhook.provider
  });

  // 3. Validate permissions
  const requiredPermission = determineRequiredPermission(command);
  if (!hasPermission(webhook.permissions, requiredPermission)) {
    return { status: 403, error: "Insufficient permissions" };
  }

  // 4. Execute command
  const result = await executeCommand(command, projectId, webhook.permissions);
  
  return { status: 200, result };
}
```

### 2. AI Command Extraction
The AI agent should:
- Use the `agentInstructions` to understand how to parse the payload
- Extract a clear, actionable command
- Never execute raw payload data directly
- Return structured command object

Example:
```javascript
// Input from Slack webhook
{
  text: "create blog post about new features",
  user_name: "john.doe",
  channel_name: "content-team"
}

// AI extracts (using agentInstructions)
{
  action: "create_content",
  type: "blog_post",
  title: "New Features",
  requestedBy: "john.doe",
  context: "slack_channel:content-team"
}
```

### 3. Permission Enforcement
Check permissions before executing any command:
```javascript
function hasPermission(webhookPermissions, requiredAction) {
  // Map action to permission category and capability
  const [category, capability] = mapActionToPermission(requiredAction);
  return webhookPermissions[category]?.[capability] === true;
}
```

## Security Requirements

1. **No Direct Execution**: Never execute payload fields directly as commands
2. **AI Interpretation**: All commands must go through AI interpretation using the provided instructions
3. **Permission Validation**: Check permissions for every action
4. **Rate Limiting**: Implement per-webhook rate limits
5. **Audit Logging**: Log all webhook activities with full context
6. **Payload Validation**: Validate payload size and structure
7. **Error Handling**: Return appropriate error codes without exposing internal details

## Response Format

### Success Response
```json
{
  "success": true,
  "command_id": "cmd_1234567890",
  "status": "completed",
  "result": {
    "action": "content_created",
    "details": {
      "file": "blog/2024-01-15-new-features.md",
      "url": "https://example.repo.md/blog/new-features"
    }
  },
  "execution_time": 1234
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Insufficient permissions to delete content",
    "details": {
      "required_permission": "content_management.delete_content",
      "webhook_permissions": ["content_management.create_content"]
    }
  }
}
```

## Provider-Specific Considerations

### Slack
- Payload typically has `text`, `user_name`, `channel_name`
- May include slash command data

### GitHub Actions
- Look for `inputs.command` in the payload
- Include repository and actor information

### Discord
- Message content in `content` field
- Include user and channel context

### Email
- Parse both subject and body
- Consider HTML vs plain text

### Calendar
- Event-triggered webhooks
- Parse event title and description

### API/Custom
- Flexible structure
- Follow the agentInstructions closely

## Testing Recommendations

1. Create test webhooks with minimal permissions
2. Test permission denial scenarios
3. Verify AI instruction interpretation
4. Test rate limiting
5. Validate audit logs
6. Test with malformed payloads
7. Verify timeout handling

## Migration Notes

- The `webhookPermissions` field in project settings is legacy (single webhook)
- New system uses `incomingWebhooks` array
- Each webhook has its own permissions and instructions
- Webhook IDs should be generated on creation (frontend uses timestamps)