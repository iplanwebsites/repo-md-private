# Project Webhook Implementation Plan

## Overview

This plan implements two distinct webhook systems for projects:

1. **Incoming Webhooks** - Unique URLs that external services can call to trigger actions in your project
2. **Outgoing Webhooks** - URLs that we call when certain events happen in your project (like deployments)

## Architecture

### Database Schema

#### 1. `projectIncomingWebhooks` Collection

```javascript
{
  _id: ObjectId,
  projectId: ObjectId,          // Reference to projects collection
  name: String,                 // User-defined webhook name
  description: String,          // Optional description
  token: String,                // Unique token for the webhook URL
  webhookUrl: String,           // Generated URL: /api/webhooks/incoming/:token
  isActive: Boolean,            // Enable/disable webhook
  allowedIps: [String],         // Optional IP whitelist
  createdAt: Date,
  updatedAt: Date,
  createdBy: ObjectId,          // User who created the webhook
  lastUsedAt: Date,            // Last time webhook was called
  callCount: Number            // Number of times webhook was called
}
```

#### 2. `projectOutgoingWebhooks` Collection

```javascript
{
  _id: ObjectId,
  projectId: ObjectId,          // Reference to projects collection
  name: String,                 // User-defined webhook name
  url: String,                  // Target webhook URL to call
  events: [String],             // Array of event types to trigger on
  headers: Object,              // Custom headers to send
  secret: String,               // Optional webhook secret for signature
  isActive: Boolean,            // Enable/disable webhook
  retryPolicy: {
    maxRetries: Number,         // Default: 3
    backoffMultiplier: Number   // Default: 2
  },
  createdAt: Date,
  updatedAt: Date,
  createdBy: ObjectId          // User who created the webhook
}
```

#### 3. `incomingWebhookExecutions` Collection

```javascript
{
  _id: ObjectId,
  webhookId: ObjectId,         // Reference to projectIncomingWebhooks
  projectId: ObjectId,         // Denormalized for efficient queries
  request: {
    method: String,
    headers: Object,
    body: Object,
    query: Object,
    ip: String,
    userAgent: String,
    timestamp: Date
  },
  response: {
    statusCode: Number,
    body: Object,
    duration: Number           // Processing time in ms
  },
  status: String,              // 'success', 'failed', 'rejected'
  error: String,               // Error message if failed
  logs: [String],              // Execution trace logs
  triggeredActions: [{
    type: String,              // 'deployment', 'update', etc.
    jobId: ObjectId,          // Reference to job if created
    status: String
  }],
  createdAt: Date
}
```

#### 4. `outgoingWebhookExecutions` Collection

```javascript
{
  _id: ObjectId,
  webhookId: ObjectId,         // Reference to projectOutgoingWebhooks
  projectId: ObjectId,         // Denormalized for efficient queries
  eventType: String,           // Type of event that triggered
  eventData: Object,           // Event payload data
  request: {
    url: String,
    method: String,
    headers: Object,
    body: String,
    timestamp: Date
  },
  response: {
    statusCode: Number,
    headers: Object,
    body: String,
    duration: Number,          // Response time in ms
    timestamp: Date
  },
  status: String,              // 'pending', 'success', 'failed', 'retrying'
  attempt: Number,             // Current retry attempt
  error: String,               // Error message if failed
  logs: [String],              // Execution trace logs
  createdAt: Date
}
```

### Event Types for Outgoing Webhooks

- `deployment.started` - Deployment job started
- `deployment.completed` - Deployment completed successfully
- `deployment.failed` - Deployment failed
- `content.updated` - Project content updated
- `project.updated` - Project settings updated
- `user.invited` - User invited to project
- `user.removed` - User removed from project

## API Endpoints

### tRPC Procedures

#### Incoming Webhook Management

```typescript
// Create a new incoming webhook
webhooks.incoming.create: protectedProcedure
  .input(z.object({
    projectId: z.string(),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    allowedIps: z.array(z.string().ip()).optional()
  }))
  // Returns: { webhook, webhookUrl: 'https://api.repo.md/webhooks/incoming/:token' }

// List incoming webhooks for a project
webhooks.incoming.list: protectedProcedure
  .input(z.object({
    projectId: z.string(),
    includeInactive: z.boolean().default(false)
  }))

// Update incoming webhook
webhooks.incoming.update: protectedProcedure
  .input(z.object({
    webhookId: z.string(),
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
    allowedIps: z.array(z.string().ip()).optional()
  }))

// Delete incoming webhook
webhooks.incoming.delete: protectedProcedure
  .input(z.object({
    webhookId: z.string()
  }))

// Regenerate webhook token (new URL)
webhooks.incoming.regenerateToken: protectedProcedure
  .input(z.object({
    webhookId: z.string()
  }))

// Get incoming webhook executions
webhooks.incoming.listExecutions: protectedProcedure
  .input(z.object({
    webhookId: z.string().optional(),
    projectId: z.string().optional(),
    status: z.enum(['success', 'failed', 'rejected']).optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
    startDate: z.date().optional(),
    endDate: z.date().optional()
  }))
```

#### Outgoing Webhook Management

```typescript
// Create a new outgoing webhook
webhooks.outgoing.create: protectedProcedure
  .input(z.object({
    projectId: z.string(),
    name: z.string().min(1).max(100),
    url: z.string().url(),
    events: z.array(z.enum(['deployment.started', 'deployment.completed', ...])),
    headers: z.record(z.string()).optional(),
    secret: z.string().optional(),
    retryPolicy: z.object({
      maxRetries: z.number().min(0).max(10).default(3),
      backoffMultiplier: z.number().min(1).max(5).default(2)
    }).optional()
  }))

// Update existing outgoing webhook
webhooks.outgoing.update: protectedProcedure
  .input(z.object({
    webhookId: z.string(),
    name: z.string().min(1).max(100).optional(),
    url: z.string().url().optional(),
    events: z.array(z.enum([...])).optional(),
    headers: z.record(z.string()).optional(),
    secret: z.string().optional(),
    isActive: z.boolean().optional(),
    retryPolicy: z.object({...}).optional()
  }))

// List outgoing webhooks for a project
webhooks.outgoing.list: protectedProcedure
  .input(z.object({
    projectId: z.string(),
    includeInactive: z.boolean().default(false)
  }))

// Delete outgoing webhook
webhooks.outgoing.delete: protectedProcedure
  .input(z.object({
    webhookId: z.string()
  }))

// Test outgoing webhook (send test payload)
webhooks.outgoing.test: protectedProcedure
  .input(z.object({
    webhookId: z.string(),
    eventType: z.enum([...])
  }))

// Get outgoing webhook executions
webhooks.outgoing.listExecutions: protectedProcedure
  .input(z.object({
    webhookId: z.string().optional(),
    projectId: z.string().optional(),
    status: z.enum(['pending', 'success', 'failed', 'retrying']).optional(),
    eventType: z.string().optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
    startDate: z.date().optional(),
    endDate: z.date().optional()
  }))

// Retry failed outgoing webhook execution
webhooks.outgoing.retryExecution: protectedProcedure
  .input(z.object({
    executionId: z.string()
  }))
```

#### Statistics and Analytics

```typescript
// Get webhook statistics
webhooks.getStats: protectedProcedure
  .input(z.object({
    projectId: z.string(),
    type: z.enum(['incoming', 'outgoing']),
    period: z.enum(['24h', '7d', '30d']).default('7d')
  }))
  // Returns success rates, execution counts, popular events, etc.
```

### REST API Endpoints

#### Incoming Webhook Endpoints

```
POST /api/webhooks/incoming/:token
  - Public endpoint that external services call
  - Accepts any HTTP method (GET, POST, PUT, etc.)
  - Validates token and processes webhook
  - Can trigger deployments or other actions

GET /api/webhooks/incoming/:token/health
  - Health check for incoming webhook
  - Returns webhook status and last execution
```

#### Internal Endpoints

```
POST /api/webhooks/outgoing/deliver/:executionId
  - Internal endpoint for webhook delivery worker
  - Accepts execution ID and delivers webhook
  - Updates execution status and logs
```

## Implementation Details

### Incoming Webhook Processing

```javascript
// routes/express/incomingWebhookRoutes.js
router.all('/api/webhooks/incoming/:token', async (req, res) => {
  // 1. Validate token and find webhook
  const webhook = await db.collection('projectIncomingWebhooks').findOne({ 
    token: req.params.token,
    isActive: true
  });
  
  if (!webhook) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  
  // 2. IP validation if configured
  if (webhook.allowedIps?.length > 0) {
    const clientIp = req.ip;
    if (!webhook.allowedIps.includes(clientIp)) {
      await logExecution(webhook, req, 'rejected', 'IP not allowed');
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  
  // 3. Create execution record
  const execution = await createIncomingExecution(webhook, req);
  
  // 4. Process webhook based on project configuration
  try {
    const result = await processIncomingWebhook(webhook, req);
    await updateExecution(execution._id, 'success', result);
    res.json({ success: true, executionId: execution._id });
  } catch (error) {
    await updateExecution(execution._id, 'failed', error.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});
```

### Outgoing Webhook Dispatcher

```javascript
// lib/outgoingWebhookDispatcher.js
class OutgoingWebhookDispatcher {
  async dispatchEvent(projectId, eventType, eventData) {
    // Find all active webhooks for this event
    const webhooks = await db.collection('projectOutgoingWebhooks').find({
      projectId: ObjectId(projectId),
      events: eventType,
      isActive: true
    }).toArray();
    
    // Create executions for each webhook
    for (const webhook of webhooks) {
      await this.createAndQueueExecution(webhook, eventType, eventData);
    }
  }
  
  async createAndQueueExecution(webhook, eventType, eventData) {
    // Create execution record
    const execution = await db.collection('outgoingWebhookExecutions').insertOne({
      webhookId: webhook._id,
      projectId: webhook.projectId,
      eventType,
      eventData,
      status: 'pending',
      attempt: 0,
      createdAt: new Date()
    });
    
    // Queue for delivery (using existing job system)
    await createJob('deliver-webhook', {
      executionId: execution.insertedId,
      webhookId: webhook._id
    });
  }
}
```

### Integration Points

```javascript
// In deployment completion handler
await outgoingWebhookDispatcher.dispatchEvent(
  project._id, 
  'deployment.completed',
  {
    projectId: project._id,
    projectName: project.name,
    deploymentId: deployment._id,
    status: 'success',
    duration: deployment.duration,
    timestamp: new Date()
  }
);

// In project update handler
await outgoingWebhookDispatcher.dispatchEvent(
  project._id,
  'project.updated',
  {
    projectId: project._id,
    changes: updatedFields,
    updatedBy: user._id,
    timestamp: new Date()
  }
);
```

## Frontend Integration

### UI Components

```typescript
// Incoming Webhooks Management
/projects/[id]/webhooks/incoming
  - IncomingWebhookList
  - CreateIncomingWebhookModal
  - WebhookUrlDisplay (with copy button)
  - ExecutionLogViewer
  - RegenerateTokenDialog

// Outgoing Webhooks Management  
/projects/[id]/webhooks/outgoing
  - OutgoingWebhookList
  - CreateOutgoingWebhookModal
  - EventTypeSelector
  - WebhookTestButton
  - ExecutionStatusList

// Unified webhook dashboard
/projects/[id]/webhooks
  - WebhookDashboard (tabs for incoming/outgoing)
  - WebhookStats
  - RecentExecutions
```

### Example Frontend Usage

```typescript
// Create incoming webhook
const { mutate: createIncoming } = trpc.webhooks.incoming.create.useMutation({
  onSuccess: (data) => {
    // Show webhook URL to user
    copyToClipboard(data.webhookUrl);
    toast.success('Webhook created! URL copied to clipboard');
  }
});

// Create outgoing webhook
const { mutate: createOutgoing } = trpc.webhooks.outgoing.create.useMutation();

createOutgoing({
  projectId: project.id,
  name: 'Slack Notifications',
  url: 'https://hooks.slack.com/...',
  events: ['deployment.completed', 'deployment.failed'],
  headers: { 'Content-Type': 'application/json' }
});

// List executions with real-time updates
const { data: executions } = trpc.webhooks.outgoing.listExecutions.useQuery({
  projectId: project.id,
  status: 'failed',
  limit: 50
}, {
  refetchInterval: 5000 // Poll for updates
});

// Get statistics
const { data: stats } = trpc.webhooks.getStats.useQuery({
  projectId: project.id,
  type: 'outgoing',
  period: '7d'
});
```

## Security Considerations

### Incoming Webhooks
- Unique, unguessable tokens (crypto.randomBytes)
- Optional IP allowlisting
- Rate limiting per webhook
- Request size limits
- Execution logging for audit trail

### Outgoing Webhooks
- HTTPS-only URLs required
- Optional HMAC-SHA256 signatures
- Timeout configuration (30s default)
- Retry limits to prevent abuse
- URL validation against SSRF

## Testing Strategy

### Development Testing

```javascript
// Incoming webhook testing
curl -X POST http://localhost:3001/api/webhooks/incoming/test-token-123 \
  -H "Content-Type: application/json" \
  -d '{"action": "deploy", "branch": "main"}'

// Outgoing webhook simulation
await trpc.webhooks.outgoing.test.mutate({
  webhookId: 'webhook-id',
  eventType: 'deployment.completed'
});
```

### Webhook Echo Server

Create a simple echo server for testing outgoing webhooks:

```javascript
// test/webhook-echo-server.js
app.post('/webhook-test', (req, res) => {
  console.log('Received webhook:', req.body);
  res.json({ received: true, timestamp: new Date() });
});
```

This implementation provides a complete separation between incoming webhooks (external services calling your projects) and outgoing webhooks (your projects calling external services), with comprehensive tracing and management capabilities for both.