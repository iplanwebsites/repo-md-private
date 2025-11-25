# Webhook Feature Specification

## Database Collections

### 1. `projectWebhooks` Collection
Stores incoming webhook configurations for projects.

```javascript
{
  _id: ObjectId,
  projectId: ObjectId,
  name: String,
  description: String,
  token: String,                // Unique token for webhook URL
  webhookUrl: String,           // Full URL: https://api.repo.md/api/webhooks/project/:token
  isActive: Boolean,
  allowedIps: [String],         // Optional IP whitelist
  allowedMethods: [String],     // GET, POST, PUT, DELETE, etc.
  createdAt: Date,
  updatedAt: Date,
  createdBy: ObjectId,
  lastUsedAt: Date,
  totalCalls: Number
}
```

### 2. `projectWebhookEvents` Collection
Stores execution logs for incoming webhooks.

```javascript
{
  _id: ObjectId,
  webhookId: ObjectId,          // Reference to projectWebhooks
  projectId: ObjectId,          // Denormalized for queries
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
    headers: Object,
    duration: Number            // Processing time in ms
  },
  status: String,               // 'success', 'failed', 'rejected'
  error: String,
  logs: [{
    level: String,              // 'info', 'warn', 'error'
    message: String,
    timestamp: Date
  }],
  triggeredJobs: [{
    jobId: ObjectId,
    type: String,
    status: String
  }],
  createdAt: Date
}
```

### 3. `projectOutgoingWebhooks` Collection
Stores outgoing webhook configurations.

```javascript
{
  _id: ObjectId,
  projectId: ObjectId,
  name: String,
  targetUrl: String,
  events: [String],             // Event types to trigger on
  headers: Object,              // Custom headers
  secret: String,               // For HMAC signatures
  isActive: Boolean,
  retryPolicy: {
    enabled: Boolean,
    maxAttempts: Number,        // Default: 3
    backoffRate: Number,        // Default: 2
    timeoutMs: Number           // Default: 30000
  },
  createdAt: Date,
  updatedAt: Date,
  createdBy: ObjectId
}
```

### 4. `projectOutgoingWebhookEvents` Collection
Stores outgoing webhook execution logs.

```javascript
{
  _id: ObjectId,
  webhookId: ObjectId,          // Reference to projectOutgoingWebhooks
  projectId: ObjectId,
  triggerEvent: String,         // Event type that triggered this
  triggerData: Object,          // Event data
  request: {
    url: String,
    method: String,
    headers: Object,
    body: Object,
    signature: String,          // HMAC signature if configured
    sentAt: Date
  },
  response: {
    statusCode: Number,
    headers: Object,
    body: String,
    receivedAt: Date,
    responseTime: Number        // ms
  },
  attempts: [{
    attemptNumber: Number,
    sentAt: Date,
    statusCode: Number,
    error: String,
    responseTime: Number
  }],
  status: String,               // 'pending', 'success', 'failed', 'retrying'
  finalStatus: String,          // 'delivered', 'failed_permanently'
  nextRetryAt: Date,
  createdAt: Date,
  completedAt: Date
}
```

## MongoDB Indexes

```javascript
// db.js additions
await db.collection('projectWebhooks').createIndexes([
  { projectId: 1, isActive: 1 },
  { token: 1 },
  { createdBy: 1 }
]);

await db.collection('projectWebhookEvents').createIndexes([
  { webhookId: 1, createdAt: -1 },
  { projectId: 1, createdAt: -1 },
  { status: 1, createdAt: -1 }
]);

await db.collection('projectOutgoingWebhooks').createIndexes([
  { projectId: 1, isActive: 1 },
  { projectId: 1, events: 1, isActive: 1 }
]);

await db.collection('projectOutgoingWebhookEvents').createIndexes([
  { webhookId: 1, createdAt: -1 },
  { projectId: 1, createdAt: -1 },
  { status: 1, nextRetryAt: 1 },
  { finalStatus: 1, createdAt: -1 }
]);
```

## API Routes

### tRPC Procedures

```typescript
// routes/projectWebhookRoutes.js

// Incoming webhooks
projectWebhooks.create
projectWebhooks.list
projectWebhooks.get
projectWebhooks.update
projectWebhooks.delete
projectWebhooks.regenerateToken
projectWebhooks.getEvents
projectWebhooks.getEventDetails

// Outgoing webhooks
projectWebhooks.outgoing.create
projectWebhooks.outgoing.list
projectWebhooks.outgoing.get
projectWebhooks.outgoing.update
projectWebhooks.outgoing.delete
projectWebhooks.outgoing.test
projectWebhooks.outgoing.getEvents
projectWebhooks.outgoing.retryEvent

// Analytics
projectWebhooks.getStats
projectWebhooks.getUsageReport
```

### REST Endpoints

```
# Incoming webhook endpoint
ALL /api/webhooks/project/:token

# Internal worker endpoints
POST /api/webhooks/outgoing/process/:eventId
POST /api/webhooks/outgoing/retry/:eventId
```

## Event Types

```javascript
const WEBHOOK_EVENT_TYPES = {
  // Deployment events
  DEPLOYMENT_CREATED: 'deployment.created',
  DEPLOYMENT_STARTED: 'deployment.started',
  DEPLOYMENT_COMPLETED: 'deployment.completed',
  DEPLOYMENT_FAILED: 'deployment.failed',
  
  // Project events
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DELETED: 'project.deleted',
  CONTENT_UPDATED: 'project.content.updated',
  SETTINGS_CHANGED: 'project.settings.changed',
  
  // Collaboration events
  MEMBER_ADDED: 'project.member.added',
  MEMBER_REMOVED: 'project.member.removed',
  MEMBER_ROLE_CHANGED: 'project.member.role_changed',
  
  // Job events
  JOB_CREATED: 'job.created',
  JOB_COMPLETED: 'job.completed',
  JOB_FAILED: 'job.failed'
};
```

## Implementation Files

### Core Services

```javascript
// lib/webhooks/WebhookTokenGenerator.js
class WebhookTokenGenerator {
  static generate() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  static generateUrl(token) {
    const baseUrl = process.env.API_BASE_URL || 'https://api.repo.md';
    return `${baseUrl}/api/webhooks/project/${token}`;
  }
}

// lib/webhooks/WebhookProcessor.js
class WebhookProcessor {
  async processIncomingWebhook(token, request) {
    // Find webhook, validate, log event, trigger actions
  }
  
  async validateRequest(webhook, request) {
    // IP validation, method validation
  }
  
  async triggerActions(webhook, eventData) {
    // Create jobs based on webhook config
  }
}

// lib/webhooks/OutgoingWebhookDispatcher.js
class OutgoingWebhookDispatcher {
  async dispatch(projectId, eventType, eventData) {
    // Find matching webhooks and create events
  }
  
  async deliverWebhook(eventId) {
    // Actually send the HTTP request
  }
  
  async retryFailedWebhook(eventId) {
    // Retry logic with exponential backoff
  }
}

// lib/webhooks/WebhookSigner.js
class WebhookSigner {
  static sign(payload, secret) {
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }
  
  static verify(payload, signature, secret) {
    const expected = this.sign(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }
}
```

### Route Handlers

```javascript
// routes/express/projectWebhookRoutes.js
router.all('/api/webhooks/project/:token', async (req, res) => {
  try {
    const result = await webhookProcessor.processIncomingWebhook(
      req.params.token,
      {
        method: req.method,
        headers: req.headers,
        body: req.body,
        query: req.query,
        ip: req.ip
      }
    );
    
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Integration Points

```javascript
// In job completion handlers
await outgoingWebhookDispatcher.dispatch(
  project._id,
  WEBHOOK_EVENT_TYPES.DEPLOYMENT_COMPLETED,
  {
    projectId: project._id,
    projectName: project.name,
    deploymentId: deployment._id,
    jobId: job._id,
    duration: job.duration,
    status: 'success',
    timestamp: new Date(),
    metadata: {
      branch: deployment.branch,
      commit: deployment.commitId,
      user: deployment.triggeredBy
    }
  }
);
```

## Frontend API Usage

```typescript
// Create incoming webhook
const webhook = await trpc.projectWebhooks.create.mutate({
  projectId: 'project-id',
  name: 'GitHub Integration',
  description: 'Trigger deployments from GitHub',
  allowedIps: ['192.30.252.0/22', '185.199.108.0/22'] // GitHub IPs
});
console.log('Webhook URL:', webhook.webhookUrl);

// List incoming webhooks
const webhooks = await trpc.projectWebhooks.list.query({
  projectId: 'project-id'
});

// Get webhook events
const events = await trpc.projectWebhooks.getEvents.query({
  webhookId: 'webhook-id',
  limit: 50,
  status: 'success'
});

// Create outgoing webhook
await trpc.projectWebhooks.outgoing.create.mutate({
  projectId: 'project-id',
  name: 'Slack Notifications',
  targetUrl: 'https://hooks.slack.com/services/...',
  events: ['deployment.completed', 'deployment.failed'],
  headers: {
    'Content-Type': 'application/json'
  }
});

// Test outgoing webhook
await trpc.projectWebhooks.outgoing.test.mutate({
  webhookId: 'webhook-id',
  eventType: 'deployment.completed'
});

// Get webhook statistics
const stats = await trpc.projectWebhooks.getStats.query({
  projectId: 'project-id',
  period: '7d'
});
```

## Security Measures

1. **Token Security**
   - 256-bit random tokens
   - One-way hashed storage
   - Regeneration capability

2. **Request Validation**
   - IP allowlisting
   - Method restrictions
   - Request size limits (10MB)
   - Rate limiting (100 req/min per webhook)

3. **Outgoing Security**
   - HTTPS-only URLs
   - HMAC-SHA256 signatures
   - Timeout enforcement (30s)
   - SSRF protection

4. **Access Control**
   - Project-level permissions
   - Webhook management requires Admin role
   - Event viewing requires Viewer role

## Monitoring & Observability

1. **Metrics**
   - Webhook call rates
   - Success/failure ratios
   - Response times
   - Queue depths

2. **Logging**
   - All webhook calls logged
   - Request/response bodies stored
   - Error traces captured
   - Audit trail maintained

3. **Alerting**
   - High failure rates
   - Webhook queue backlog
   - Security violations
   - Performance degradation