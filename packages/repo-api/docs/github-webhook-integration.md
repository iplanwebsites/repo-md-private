# GitHub Webhook Integration

This document describes the GitHub webhook integration that automatically triggers deployments when code is pushed to repositories.

## Overview

The webhook system listens for GitHub push events and automatically triggers deployments for projects linked to those repositories. All webhook events are logged to the `gitEvents` collection for audit purposes.

## Setup

### 1. Environment Variables

Add the following environment variable for webhook security:

```bash
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here
```

### 2. GitHub Repository Configuration

In your GitHub repository settings:

1. Go to Settings → Webhooks
2. Add a new webhook with:
   - **Payload URL**: `https://your-api-domain.com/api/github/webhook`
   - **Content type**: `application/json`
   - **Secret**: The same value as `GITHUB_WEBHOOK_SECRET`
   - **Events**: Select "Push events"

## Features

### Automatic Deployment Triggers

- **Push Events**: When code is pushed to any branch, the system automatically triggers a deployment
- **Project Matching**: Repositories are matched to projects using multiple criteria:
  - GitHub repository full name
  - Repository URL
  - Clone URL
  - SSH URL

### Webhook Event Storage

All GitHub webhook events are stored in the `gitEvents` collection with:
- Complete webhook payload
- Processing status and results
- Error information for failed processing
- Project and organization references
- Timestamps for auditing

### Database Schema

The `gitEvents` collection includes:

```javascript
{
  _id: ObjectId,
  event: "push",                    // GitHub event type
  delivery: "delivery-id",          // GitHub delivery ID
  repository: {                     // Repository information
    id: 123456,
    name: "repo-name",
    fullName: "owner/repo-name",
    owner: "owner",
    private: false
  },
  payload: { ... },                 // Complete GitHub payload
  signature: "sha256=...",          // GitHub signature
  timestamp: Date,                  // Event timestamp
  processed: true,                  // Processing status
  projectId: "project-id",          // Linked project ID
  orgSlug: "org-slug",             // Organization slug
  
  // Processing results
  ignored: false,                   // If event was ignored
  ignoredReason: "...",            // Reason for ignoring
  failed: false,                    // If processing failed
  error: "...",                     // Error message
  processingResult: { ... },        // Deployment job details
  processedAt: Date                 // Processing timestamp
}
```

### API Endpoints

#### Webhook Endpoint
- `POST /api/github/webhook` - Receives GitHub webhook events

#### Management Routes (tRPC)
- `webhooks.listProjectEvents` - List webhook events for a project
- `webhooks.getEvent` - Get detailed webhook event information
- `webhooks.listAllEvents` - List all webhook events (admin only)
- `webhooks.getStats` - Get webhook statistics (admin only)
- `webhooks.retryEvent` - Retry a failed webhook event (admin only)

### Deployment Flow

When a push event is received:

1. **Validation**: Verify GitHub signature and parse payload
2. **Storage**: Store complete event in `gitEvents` collection
3. **Project Matching**: Find project linked to the repository
4. **Token Retrieval**: Get project owner's GitHub token
5. **Deployment Creation**: Create deployment job using existing CloudRun flow
6. **Status Update**: Update event with processing results

### Error Handling

The system handles various error scenarios:

- **Invalid Signature**: Returns 401 Unauthorized
- **Invalid JSON**: Returns 400 Bad Request
- **Project Not Found**: Event is stored but marked as ignored
- **Missing GitHub Token**: Event fails with appropriate error message
- **Deployment Failure**: Error is captured and stored with the event

### Security

- **Signature Verification**: All webhook payloads are verified using HMAC-SHA256
- **Token Safety**: GitHub tokens are securely retrieved from user records
- **Access Control**: Webhook management routes require appropriate permissions

### Monitoring

Use the webhook statistics endpoint to monitor:
- Total events processed
- Success/failure rates
- Events by repository
- Recent activity (last 24 hours)

### Development

For development without webhook secrets:
- Set `GITHUB_WEBHOOK_SECRET` to an empty string
- Signature verification will be skipped with a warning

## Integration Points

The webhook system integrates with:
- **Cloud Run Service**: Uses existing deployment job creation
- **Project Management**: Links events to existing projects
- **User Authentication**: Retrieves GitHub tokens from user records
- **Database**: Leverages existing MongoDB collections and indexes