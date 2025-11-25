# Frontend Webhook Integration Guide

## Quick Reference - API Endpoints

### Incoming Webhooks (External services → Your project)

```typescript
// Create incoming webhook - returns unique URL
trpc.webhooks.incoming.create
  Input: { projectId, name, description?, allowedIps? }
  Returns: { webhook, webhookUrl: 'https://api.repo.md/webhooks/incoming/:token' }

// List project's incoming webhooks  
trpc.webhooks.incoming.list
  Input: { projectId, includeInactive? }
  Returns: WebhookConfig[]

// Update incoming webhook
trpc.webhooks.incoming.update
  Input: { webhookId, name?, description?, isActive?, allowedIps? }

// Delete incoming webhook
trpc.webhooks.incoming.delete
  Input: { webhookId }

// Regenerate webhook URL
trpc.webhooks.incoming.regenerateToken
  Input: { webhookId }
  Returns: { webhookUrl: 'new-url' }

// Get execution history
trpc.webhooks.incoming.listExecutions
  Input: { webhookId?, projectId?, status?, limit?, offset?, startDate?, endDate? }
  Returns: { executions: Execution[], total: number }
```

### Outgoing Webhooks (Your project → External services)

```typescript
// Create outgoing webhook
trpc.webhooks.outgoing.create
  Input: { projectId, name, url, events[], headers?, secret?, retryPolicy? }
  
// List project's outgoing webhooks
trpc.webhooks.outgoing.list
  Input: { projectId, includeInactive? }
  Returns: WebhookConfig[]

// Update outgoing webhook  
trpc.webhooks.outgoing.update
  Input: { webhookId, name?, url?, events?, headers?, secret?, isActive?, retryPolicy? }

// Delete outgoing webhook
trpc.webhooks.outgoing.delete
  Input: { webhookId }

// Test webhook with sample payload
trpc.webhooks.outgoing.test
  Input: { webhookId, eventType }

// Get execution history
trpc.webhooks.outgoing.listExecutions
  Input: { webhookId?, projectId?, status?, eventType?, limit?, offset?, startDate?, endDate? }
  Returns: { executions: Execution[], total: number }

// Retry failed execution
trpc.webhooks.outgoing.retryExecution
  Input: { executionId }
```

### Analytics & Statistics

```typescript
// Get webhook statistics
trpc.webhooks.getStats
  Input: { projectId, type: 'incoming' | 'outgoing', period: '24h' | '7d' | '30d' }
  Returns: { 
    totalExecutions, 
    successRate, 
    averageResponseTime,
    eventTypeBreakdown,
    timeSeriesData 
  }
```

## Event Types for Outgoing Webhooks

- `deployment.started`
- `deployment.completed` 
- `deployment.failed`
- `content.updated`
- `project.updated`
- `user.invited`
- `user.removed`

## Example React Components

### Incoming Webhook Creation

```tsx
function CreateIncomingWebhook({ projectId }) {
  const { mutate: create } = trpc.webhooks.incoming.create.useMutation({
    onSuccess: (data) => {
      // Copy webhook URL to clipboard
      navigator.clipboard.writeText(data.webhookUrl);
      toast.success('Webhook created! URL copied to clipboard');
    }
  });

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      create({
        projectId,
        name: e.target.name.value,
        description: e.target.description.value
      });
    }}>
      <input name="name" placeholder="Webhook name" required />
      <textarea name="description" placeholder="Description (optional)" />
      <button type="submit">Create Webhook</button>
    </form>
  );
}
```

### Outgoing Webhook Management

```tsx
function OutgoingWebhooks({ projectId }) {
  const { data: webhooks } = trpc.webhooks.outgoing.list.useQuery({ projectId });
  const { mutate: testWebhook } = trpc.webhooks.outgoing.test.useMutation();
  
  return (
    <div>
      {webhooks?.map(webhook => (
        <WebhookCard 
          key={webhook._id}
          webhook={webhook}
          onTest={() => testWebhook({ 
            webhookId: webhook._id, 
            eventType: 'deployment.completed' 
          })}
        />
      ))}
    </div>
  );
}
```

### Execution Monitoring

```tsx
function WebhookExecutions({ projectId }) {
  const [filter, setFilter] = useState({ status: 'failed' });
  
  const { data } = trpc.webhooks.outgoing.listExecutions.useQuery({
    projectId,
    ...filter,
    limit: 50
  }, {
    refetchInterval: 5000 // Auto-refresh every 5s
  });

  const { mutate: retry } = trpc.webhooks.outgoing.retryExecution.useMutation();

  return (
    <div>
      <FilterBar onFilterChange={setFilter} />
      {data?.executions.map(execution => (
        <ExecutionRow 
          key={execution._id}
          execution={execution}
          onRetry={() => retry({ executionId: execution._id })}
        />
      ))}
    </div>
  );
}
```

### Webhook Statistics Dashboard

```tsx
function WebhookStats({ projectId }) {
  const { data: incomingStats } = trpc.webhooks.getStats.useQuery({
    projectId,
    type: 'incoming',
    period: '7d'
  });

  const { data: outgoingStats } = trpc.webhooks.getStats.useQuery({
    projectId,
    type: 'outgoing', 
    period: '7d'
  });

  return (
    <div className="grid grid-cols-2 gap-4">
      <StatsCard title="Incoming Webhooks" stats={incomingStats} />
      <StatsCard title="Outgoing Webhooks" stats={outgoingStats} />
    </div>
  );
}
```

## URL Structure

### Incoming Webhooks
- Pattern: `https://api.repo.md/webhooks/incoming/:token`
- Example: `https://api.repo.md/webhooks/incoming/abc123def456ghi789`
- Methods: All HTTP methods supported (GET, POST, PUT, DELETE, etc.)

### Frontend Routes
- `/projects/[id]/webhooks` - Main webhook dashboard
- `/projects/[id]/webhooks/incoming` - Incoming webhook management
- `/projects/[id]/webhooks/outgoing` - Outgoing webhook management
- `/projects/[id]/webhooks/executions` - Execution logs and monitoring