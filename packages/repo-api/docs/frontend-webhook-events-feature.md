# Frontend Feature: GitHub Webhook Events View

## Overview

We need to add a new tab/section to both Project and Organization pages that displays GitHub webhook events and deployment actions. This will provide users with visibility into automatic deployments triggered by GitHub pushes.

## Requirements

### 1. **Project Action Page new tab - Enhancement**
- Add a "Webhook Events" or "Deployments" tab to the project page
- Display webhook events specific to that project
- Show deployment status and actions triggered by webhooks

### 2. **Organization Action Page new tab  - Enhancement**  
- Add a "Webhook Events" tab to the organization page
- Display webhook events for ALL projects within the organization
- Provide organization-wide view of deployment activity

### 3. **Reusable Component**
- Create a single `GitEventsTable` component
- Use the same component for both project and organization views
- Pass different parameters to control scope (single project vs. all org projects)

## Server API (tRPC Methods)

The backend provides these tRPC endpoints for the frontend to use:

### For Project-Specific Events:
```typescript
// Get webhook events for a specific project
const projectEvents = await trpc.webhooks.listProjectEvents.useQuery({
  projectId: "project-id-here",
  limit: 50,
  offset: 0,
  eventType: "push" // optional filter
});
```

### For Organization-Wide Events:
```typescript
// Get all webhook events (admin only - for org owners)
const orgEvents = await trpc.webhooks.listAllEvents.useQuery({
  limit: 50,
  offset: 0,
  eventType: "push", // optional filter
  repository: "org-name" // optional filter by repo name
});
```

### For Event Details:
```typescript
// Get detailed information about a specific webhook event
const eventDetails = await trpc.webhooks.getEvent.useQuery({
  eventId: "event-id-here"
});
```

### For Statistics (Optional):
```typescript
// Get webhook statistics for admin dashboard
const stats = await trpc.webhooks.getStats.useQuery();
```

## Frontend Implementation Plan

### 1. **Create Reusable Component**

Create `components/WebhookEventsTable.tsx`:

```typescript
interface WebhookEventsTableProps {
  scope: 'project' | 'organization';
  projectId?: string; // Required when scope is 'project'
  orgId?: string;     // Required when scope is 'organization'
  showRepository?: boolean; // Show repo column for org view
}

function WebhookEventsTable({ scope, projectId, orgId, showRepository = false }) {
  // Use conditional tRPC query based on scope
  const eventsQuery = scope === 'project' 
    ? trpc.webhooks.listProjectEvents.useQuery({ projectId, ... })
    : trpc.webhooks.listAllEvents.useQuery({ ... });
    
  // Render table with events...
}
```

### 2. **Table Columns to Display**

| Column | Description | Project View | Org View |
|--------|-------------|--------------|----------|
| **Event Time** | When the webhook was received | ✅ | ✅ |
| **Repository** | GitHub repository name | ❌ | ✅ |
| **Branch** | Git branch that was pushed | ✅ | ✅ |
| **Commit** | Commit hash and message | ✅ | ✅ |
| **Triggered By** | GitHub user who pushed | ✅ | ✅ |
| **Status** | Processing status (Success/Failed/Pending) | ✅ | ✅ |
| **Deployment** | Link to deployment job | ✅ | ✅ |
| **Actions** | View details, retry if failed | ✅ | ✅ |

### 3. **Integration Points**

#### Project Page:
```typescript
// In ProjectDetailsPage.tsx or similar
<Tabs>
  <Tab label="Overview">...</Tab>
  <Tab label="Settings">...</Tab>
  <Tab label="Webhook Events">
    <WebhookEventsTable 
      scope="project" 
      projectId={project.id} 
    />
  </Tab>
</Tabs>
```

#### Organization Page:
```typescript
// In OrganizationPage.tsx or similar  
<Tabs>
  <Tab label="Projects">...</Tab>
  <Tab label="Members">...</Tab>
  <Tab label="Webhook Events">
    <WebhookEventsTable 
      scope="organization" 
      orgId={org.id}
      showRepository={true}
    />
  </Tab>
</Tabs>
```

## Data Structure Reference

The webhook events returned from the API have this structure:

```typescript
interface WebhookEvent {
  _id: string;
  event: string; // "push"
  delivery: string;
  repository: {
    id: number;
    name: string;
    fullName: string; // "owner/repo-name"
    owner: string;
    private: boolean;
  };
  timestamp: Date;
  processed: boolean;
  ignored?: boolean;
  failed?: boolean;
  error?: string;
  ignoredReason?: string;
  processingResult?: {
    success: boolean;
    jobId: string;
    projectId: string;
    branch: string;
    commit: string;
  };
  processedAt?: Date;
}
```

## Features to Implement

### 1. **Basic Table View**
- Paginated list of webhook events
- Sorting by timestamp (newest first)
- Status indicators (success/failed/pending)

### 2. **Filtering Options**
- Filter by event type (push, etc.)
- Filter by repository (for org view)
- Filter by status (all/success/failed)
- Date range picker

### 3. **Event Details Modal**
- Show complete webhook payload
- Display deployment job details
- Show error messages for failed events
- Link to deployment logs

### 4. **Actions**
- "View Details" button for each event
- "Retry" button for failed events (admin only)
- "View Deployment" link to job details

### 5. **Real-time Updates** (Optional)
- Use WebSocket or polling to show new webhook events
- Update status when deployments complete

## Error Handling

- Show appropriate messages for no events
- Handle API errors gracefully
- Display loading states during data fetching
- Show retry options for failed requests

## Permissions

- **Project View**: Any project collaborator can view webhook events
- **Organization View**: Only organization owners/admins can view org-wide events
- **Retry Actions**: Only admins can retry failed webhook events

## Example UI Mockup

```
┌─────────────────────────────────────────────────────────────┐
│ Webhook Events                                     [Filters▼]│
├─────────────────────────────────────────────────────────────┤
│ Time        │ Repository    │ Branch │ Commit  │ Status    │ │
├─────────────────────────────────────────────────────────────┤
│ 2 min ago   │ owner/repo    │ main   │ abc123  │ ✅ Success │ │
│ 5 min ago   │ owner/repo    │ dev    │ def456  │ ⏳ Pending │ │
│ 1 hour ago  │ owner/other   │ main   │ ghi789  │ ❌ Failed  │ │
└─────────────────────────────────────────────────────────────┘
```

This feature will provide users with complete visibility into their automated deployment pipeline and help them troubleshoot any webhook processing issues.