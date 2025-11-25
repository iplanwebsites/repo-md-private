# Admin Panel API Requirements

## Overview

This document outlines all tRPC endpoints required by the admin panels. Many of these endpoints could potentially be consolidated into a generic database query endpoint to reduce backend complexity.

## Current Endpoint Usage by Admin Panel

### 1. **R2 Storage Admin** (`/admin/r2-storage`)

```typescript
// Required endpoints:
trpc.r2.list.query({
  page: number,
  limit: number
})
// Returns: { items: R2File[], total: number }

trpc.r2.delete.mutate({
  bucket: string,
  key: string
})
// Returns: { success: boolean }
```

### 2. **Users Admin** (`/admin/users`)

```typescript
// Required endpoints:
trpc.users.list.query({
  page: number,
  limit: number,
  search?: string,
  status?: 'all' | 'active' | 'inactive' | 'banned'
})
// Returns: { 
//   items: User[], 
//   total: number,
//   stats: {
//     total: number,
//     active: number,
//     inactive: number,
//     banned: number,
//     newThisMonth: number
//   }
// }

trpc.users.toggleBan.mutate({
  userId: string,
  banned: boolean
})

trpc.users.delete.mutate({
  userId: string
})

trpc.users.impersonate.mutate({
  userId: string
})
// Returns: { token: string }

trpc.users.export.query({
  format: 'csv'
})
// Returns: CSV string
```

### 3. **Organizations Admin** (`/admin/organizations`)

```typescript
// Required endpoints:
trpc.organizations.list.query({
  page: number,
  limit: number,
  search?: string,
  status?: 'all' | 'active' | 'trial' | 'suspended' | 'cancelled',
  plan?: 'all' | 'free' | 'pro' | 'team' | 'enterprise'
})
// Returns: {
//   items: Organization[],
//   total: number,
//   stats: {
//     total: number,
//     active: number,
//     trial: number,
//     suspended: number,
//     totalRevenue: number,
//     avgProjectsPerOrg: number
//   }
// }

trpc.organizations.toggleSuspend.mutate({
  orgId: string,
  suspended: boolean
})

trpc.organizations.delete.mutate({
  orgId: string
})

trpc.organizations.export.query({
  format: 'csv'
})
```

### 4. **Projects Admin** (`/admin/projects`)

```typescript
// Required endpoints:
trpc.projects.list.query({
  page: number,
  limit: number,
  search?: string,
  status?: 'all' | 'active' | 'paused' | 'archived',
  organizationName?: string
})
// Returns: {
//   items: Project[],
//   total: number,
//   stats: {
//     total: number,
//     active: number,
//     paused: number,
//     archived: number,
//     totalDeployments: number,
//     totalPosts: number,
//     totalMedia: number
//   }
// }

trpc.projects.updateStatus.mutate({
  projectId: string,
  status: 'active' | 'paused'
})

trpc.projects.archive.mutate({
  projectId: string
})

trpc.projects.delete.mutate({
  projectId: string
})

trpc.projects.export.query({
  format: 'csv'
})
```

### 5. **Deployments Admin** (`/admin/deployments`)

```typescript
// Required endpoints:
trpc.deployments.list.query({
  page: number,
  limit: number,
  search?: string,
  status?: 'all' | 'success' | 'failed' | 'building' | 'pending',
  projectName?: string,
  organizationName?: string
})
// Returns: {
//   items: Deployment[],
//   total: number,
//   stats: {
//     total: number,
//     success: number,
//     failed: number,
//     building: number,
//     avgBuildTime: number,
//     todayCount: number
//   }
// }

trpc.deployments.rebuild.mutate({
  deploymentId: string
})

trpc.deployments.delete.mutate({
  deploymentId: string
})

trpc.deployments.export.query({
  format: 'csv'
})
```

### 6. **Jobs Admin** (`/admin/jobs`)

```typescript
// Required endpoints:
trpc.jobs.list.query({
  page: number,
  limit: number,
  search?: string,
  status?: string,
  type?: string
})
// Returns: {
//   items: Job[],
//   total: number,
//   stats: {
//     total: number,
//     completed: number,
//     running: number,
//     pending: number,
//     failed: number
//   }
// }

trpc.jobs.retry.mutate({
  jobId: string
})

trpc.jobs.cancel.mutate({
  jobId: string
})

trpc.jobs.export.query({
  format: 'csv'
})
```

### 7. **Git Events Admin** (`/admin/git-events`)

```typescript
// Required endpoints:
trpc.gitEvents.list.query({
  page: number,
  limit: number,
  search?: string,
  event?: string
})
// Returns: {
//   items: GitEvent[],
//   total: number,
//   stats: {
//     total: number,
//     pushes: number,
//     pullRequests: number,
//     tags: number,
//     today: number
//   }
// }

trpc.gitEvents.process.mutate({
  eventId: string
})
```

### 8. **Webhooks Admin** (`/admin/webhooks`)

```typescript
// Required endpoints:
trpc.projectWebhooks.list.query({
  page: number,
  limit: number,
  search?: string
})
// Returns: {
//   items: IncomingWebhook[],
//   total: number,
//   stats: { total: number, active: number, failedToday: number }
// }

trpc.projectOutgoingWebhooks.list.query({
  page: number,
  limit: number,
  search?: string
})
// Returns: {
//   items: OutgoingWebhook[],
//   total: number,
//   stats: { total: number, active: number, failedToday: number }
// }

trpc.webhooks.test.mutate({
  webhookId: string,
  type: 'incoming' | 'outgoing'
})
```

### 9. **Notes Admin** (`/admin/notes`)

```typescript
// Required endpoints:
trpc.notes.list.query({
  page: number,
  limit: number,
  search?: string,
  type?: string,
  visibility?: string
})
// Returns: {
//   items: Note[],
//   total: number,
//   stats: {
//     total: number,
//     public: number,
//     private: number,
//     uniqueTags: number
//   }
// }

trpc.notes.update.mutate({
  id: string,
  title: string,
  content: string,
  tags: string[],
  isPublic: boolean
})

trpc.notes.delete.mutate({
  id: string
})
```

### 10. **Existing Endpoints (Already Implemented)**

- `trpc.waitlist.*` - Waitlist management
- `trpc.media.*` - Media files (assumed existing)

## Consolidation Proposal

Instead of creating 40+ individual endpoints, we could implement a generic admin database query system:

### Option 1: Generic Database Query Endpoint

```typescript
trpc.admin.db.query({
  collection: string,  // 'users', 'organizations', 'projects', etc.
  operation: 'list' | 'get' | 'stats',
  filters: {
    page?: number,
    limit?: number,
    search?: string,
    where?: Record<string, any>,
    orderBy?: { field: string, direction: 'asc' | 'desc' }
  }
})

trpc.admin.db.mutate({
  collection: string,
  operation: 'create' | 'update' | 'delete',
  id?: string,
  data?: Record<string, any>
})

trpc.admin.db.export({
  collection: string,
  format: 'csv' | 'json',
  filters?: Record<string, any>
})
```

### Option 2: Collection-Specific Endpoints with Standard Interface

Create standardized endpoints for each collection that follow the same pattern:

```typescript
// Standard interface for all admin collections
interface AdminCollectionEndpoints<T> {
  list: {
    query: (params: ListParams) => Promise<ListResponse<T>>
  },
  get: {
    query: (id: string) => Promise<T>
  },
  create: {
    mutate: (data: Partial<T>) => Promise<T>
  },
  update: {
    mutate: (params: { id: string, data: Partial<T> }) => Promise<T>
  },
  delete: {
    mutate: (id: string) => Promise<void>
  },
  export: {
    query: (params: ExportParams) => Promise<string>
  }
}

// Then implement for each collection:
trpc.admin.users: AdminCollectionEndpoints<User>
trpc.admin.organizations: AdminCollectionEndpoints<Organization>
trpc.admin.projects: AdminCollectionEndpoints<Project>
// etc...
```

## Special Endpoints Still Needed

Some operations are specific to certain entities and would still need custom endpoints:

1. **User Operations**
   - `impersonate` - Generate auth token for user
   - `toggleBan` - Ban/unban user

2. **Organization Operations**
   - `toggleSuspend` - Suspend/unsuspend organization

3. **Project Operations**
   - `archive` - Archive project
   - `updateStatus` - Change project status

4. **Deployment Operations**
   - `rebuild` - Trigger deployment rebuild

5. **Job Operations**
   - `retry` - Retry failed job
   - `cancel` - Cancel running job

6. **Git Event Operations**
   - `process` - Reprocess webhook event

7. **Webhook Operations**
   - `test` - Send test webhook

## Data Structure Requirements

### Common Fields Across All Entities

```typescript
interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt?: string;
}
```

### Entity-Specific Fields

Each entity type needs to return specific fields for the admin panels to function properly. See individual endpoint sections above for required fields.

### Stats Requirements

Most admin panels display statistics that require aggregated data:

- Count by status/type
- Time-based aggregations (today, this month)
- Related entity counts
- Success/failure rates
- Revenue calculations

## Security Considerations

1. All admin endpoints must verify admin role
2. Audit logging for sensitive operations (delete, impersonate)
3. Rate limiting on export operations
4. Sanitization of search queries to prevent injection

## Implementation Priority

1. **High Priority** (blocking functionality):
   - User list/management endpoints
   - Organization list/management endpoints
   - Project list/management endpoints
   
2. **Medium Priority** (enhances functionality):
   - Deployment endpoints
   - Export functionality
   - Stats aggregation

3. **Low Priority** (nice to have):
   - Jobs monitoring
   - Git events
   - Webhook management

## Migration Path

If implementing the consolidated approach:

1. Create generic admin query endpoint
2. Update admin panels to use new endpoint
3. Remove individual endpoint references
4. Implement special operations as separate endpoints
5. Add proper TypeScript types for all operations