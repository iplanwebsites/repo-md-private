# Frontend Integration Guide: GitHub Webhook Testing

This guide provides instructions for frontend developers to integrate webhook simulation triggers for testing the GitHub webhook functionality.

## Overview

The backend now supports webhook simulation endpoints that can be triggered from the frontend during development and testing. This allows you to test the complete webhook flow without needing to push actual commits to GitHub.

## Available Endpoints

### 1. Webhook Simulation Options
**Endpoint:** `GET /api/github/webhook/simulate/options`

Returns available webhook simulation endpoints and their parameters.

```typescript
// Response type
interface WebhookSimulationOptions {
  success: boolean;
  message: string;
  simulations: Array<{
    endpoint: string;
    method: string;
    description: string;
    parameters: Record<string, string>;
    example: Record<string, any>;
  }>;
}
```

### 2. Simulate Push Webhook
**Endpoint:** `POST /api/github/webhook/simulate/push`

Simulates a GitHub push webhook event.

```typescript
// Request payload type
interface SimulatePushWebhookRequest {
  repoFullName?: string;    // Format: "owner/repo" (default: "test-user/test-repo")
  repoBranch?: string;      // Branch name (default: "main")
  commitId?: string;        // Commit hash (default: "abc123def456")
  commitMessage?: string;   // Commit message (default: "Test commit for webhook simulation")
  pusherName?: string;      // Pusher name (default: "test-user")
  pusherEmail?: string;     // Pusher email (default: "test@example.com")
}

// Response type
interface SimulatePushWebhookResponse {
  success: boolean;
  message: string;
  eventId: string;
  simulation: true;
  // Additional fields if successful:
  jobId?: string;
  projectId?: string;
  branch?: string;
  commit?: string;
}
```

## Frontend Implementation

### 1. Add Webhook Testing UI Component

Create a webhook testing component for development/admin pages:

```typescript
// WebhookTestingPanel.tsx
import React, { useState } from 'react';

interface WebhookTestForm {
  repoFullName: string;
  repoBranch: string;
  commitId: string;
  commitMessage: string;
  pusherName: string;
  pusherEmail: string;
}

export const WebhookTestingPanel: React.FC = () => {
  const [formData, setFormData] = useState<WebhookTestForm>({
    repoFullName: 'test-user/test-repo',
    repoBranch: 'main',
    commitId: 'abc123def456',
    commitMessage: 'Test commit for webhook simulation',
    pusherName: 'test-user',
    pusherEmail: 'test@example.com'
  });
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/github/webhook/simulate/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof WebhookTestForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="webhook-testing-panel">
      <h3>Webhook Testing</h3>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Repository (owner/repo):</label>
          <input
            type="text"
            value={formData.repoFullName}
            onChange={(e) => handleInputChange('repoFullName', e.target.value)}
            placeholder="owner/repo-name"
          />
        </div>

        <div className="form-group">
          <label>Branch:</label>
          <input
            type="text"
            value={formData.repoBranch}
            onChange={(e) => handleInputChange('repoBranch', e.target.value)}
            placeholder="main"
          />
        </div>

        <div className="form-group">
          <label>Commit ID:</label>
          <input
            type="text"
            value={formData.commitId}
            onChange={(e) => handleInputChange('commitId', e.target.value)}
            placeholder="abc123def456"
          />
        </div>

        <div className="form-group">
          <label>Commit Message:</label>
          <input
            type="text"
            value={formData.commitMessage}
            onChange={(e) => handleInputChange('commitMessage', e.target.value)}
            placeholder="Test commit message"
          />
        </div>

        <div className="form-group">
          <label>Pusher Name:</label>
          <input
            type="text"
            value={formData.pusherName}
            onChange={(e) => handleInputChange('pusherName', e.target.value)}
            placeholder="developer-name"
          />
        </div>

        <div className="form-group">
          <label>Pusher Email:</label>
          <input
            type="email"
            value={formData.pusherEmail}
            onChange={(e) => handleInputChange('pusherEmail', e.target.value)}
            placeholder="dev@example.com"
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Simulating...' : 'Simulate Push Webhook'}
        </button>
      </form>

      {result && (
        <div className={`result ${result.success ? 'success' : 'error'}`}>
          <h4>Result:</h4>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
```

### 2. Add Quick Test Buttons

For existing project pages, add quick test buttons:

```typescript
// ProjectWebhookTest.tsx
import React from 'react';

interface ProjectWebhookTestProps {
  projectRepoFullName: string;
}

export const ProjectWebhookTest: React.FC<ProjectWebhookTestProps> = ({ 
  projectRepoFullName 
}) => {
  const [testing, setTesting] = useState(false);

  const quickTest = async () => {
    setTesting(true);
    
    try {
      const response = await fetch('/api/github/webhook/simulate/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName: projectRepoFullName,
          commitMessage: `Quick test webhook - ${new Date().toISOString()}`
        }),
      });

      const result = await response.json();
      
      // Show notification/toast
      if (result.success) {
        toast.success(`Webhook test successful! Job ID: ${result.jobId}`);
      } else {
        toast.error(`Webhook test failed: ${result.message}`);
      }
    } catch (error) {
      toast.error('Failed to simulate webhook');
    } finally {
      setTesting(false);
    }
  };

  // Only show in development environment
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <button 
      onClick={quickTest} 
      disabled={testing}
      className="btn-secondary"
    >
      {testing ? 'Testing...' : 'Test Webhook'}
    </button>
  );
};
```

### 3. Add to tRPC Client (if using tRPC)

If your frontend uses tRPC, you can create a webhook simulation client:

```typescript
// trpc/webhook.ts
import { z } from 'zod';

export const webhookSimulateSchema = z.object({
  repoFullName: z.string().optional(),
  repoBranch: z.string().optional(),
  commitId: z.string().optional(),
  commitMessage: z.string().optional(),
  pusherName: z.string().optional(),
  pusherEmail: z.string().optional(),
});

// In your tRPC client setup
export const webhookRouter = router({
  simulate: publicProcedure
    .input(webhookSimulateSchema)
    .mutation(async ({ input }) => {
      // This would be a direct HTTP call since it's not a tRPC endpoint
      const response = await fetch('/api/github/webhook/simulate/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return response.json();
    }),
});
```

## Integration Points

### 1. Admin/Developer Dashboard
Add the `WebhookTestingPanel` component to your admin or developer dashboard.

### 2. Project Settings Page
Add the `ProjectWebhookTest` component to individual project settings pages.

### 3. Developer Tools Menu
Add webhook simulation options to your developer tools or debug menu.

## Environment Considerations

- **Development:** All webhook simulation endpoints are available
- **Production:** Webhook simulation endpoints are disabled unless `DEBUG_WEBHOOKS=true`
- **Testing:** Use simulation endpoints for automated testing scenarios

## Error Handling

The simulation endpoints return structured error responses:

```typescript
interface WebhookError {
  success: false;
  message: string;
  error?: string;
  simulation: true;
}
```

Handle these appropriately in your UI with proper error messages for users.

## Best Practices

1. **Environment Gating:** Only show webhook testing UI in development/staging environments
2. **User Permissions:** Restrict webhook testing to admin/developer users
3. **Rate Limiting:** Consider implementing client-side rate limiting for webhook tests
4. **Feedback:** Provide clear feedback when webhooks are triggered and processed
5. **Logging:** Log webhook test activities for debugging

## Example Scenarios

### Test Deployment Flow
```javascript
// Simulate a webhook that should trigger deployment
await simulateWebhook({
  repoFullName: 'myorg/production-app',
  repoBranch: 'main',
  commitMessage: 'Deploy to production'
});
```

### Test Branch-Specific Behavior
```javascript
// Test feature branch webhook
await simulateWebhook({
  repoFullName: 'myorg/myapp',
  repoBranch: 'feature/new-feature',
  commitMessage: 'Add new feature implementation'
});
```

### Test Error Scenarios
```javascript
// Test webhook for non-existent project
await simulateWebhook({
  repoFullName: 'nonexistent/project',
  commitMessage: 'This should fail gracefully'
});
```