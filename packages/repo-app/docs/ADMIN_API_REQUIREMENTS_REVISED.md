# Admin Panel API Requirements (Revised)

## ✅ GOOD NEWS: Existing Database Query Infrastructure

The admin panel already has a generic database query system available through `/admin/db/:collection` that uses:

```typescript
// Get all available collections
trpc.getAllCollections.query()
// Returns: { collections: string[] }

// Get data from any collection with pagination
trpc.getCollectionData.query({
  collectionName: string,
  page: number,
  limit: number
})
// Returns: {
//   data: any[],
//   pagination: {
//     pages: number,
//     total: number
//   }
// }
```

## 🔄 Refactoring Strategy

Instead of creating 40+ new endpoints, we can refactor all admin panels to use the existing database query infrastructure with minimal backend changes.

### Required Backend Enhancements

1. **Add Search/Filter Support to `getCollectionData`**
   ```typescript
   trpc.getCollectionData.query({
     collectionName: string,
     page: number,
     limit: number,
     // NEW PARAMETERS:
     search?: string,        // Search across text fields
     filters?: {            // Field-specific filters
       [field: string]: any
     },
     orderBy?: {            // Sorting
       field: string,
       direction: 'asc' | 'desc'
     }
   })
   ```

2. **Add Stats Endpoint**
   ```typescript
   trpc.getCollectionStats.query({
     collectionName: string,
     groupBy?: string[]      // Fields to group by for counts
   })
   // Returns collection-specific stats
   ```

3. **Add Export Endpoint**
   ```typescript
   trpc.exportCollection.query({
     collectionName: string,
     format: 'csv' | 'json',
     filters?: Record<string, any>
   })
   ```

### Special Operations That Still Need Custom Endpoints

These operations involve business logic beyond simple CRUD:

```typescript
// User operations
trpc.admin.users.impersonate.mutate({ userId: string })
trpc.admin.users.toggleBan.mutate({ userId: string, banned: boolean })

// Organization operations  
trpc.admin.organizations.toggleSuspend.mutate({ orgId: string, suspended: boolean })

// Project operations
trpc.admin.projects.archive.mutate({ projectId: string })
trpc.admin.projects.updateStatus.mutate({ projectId: string, status: string })

// Deployment operations
trpc.admin.deployments.rebuild.mutate({ deploymentId: string })

// Job operations
trpc.admin.jobs.retry.mutate({ jobId: string })
trpc.admin.jobs.cancel.mutate({ jobId: string })

// Git event operations
trpc.admin.gitEvents.process.mutate({ eventId: string })

// Webhook operations
trpc.admin.webhooks.test.mutate({ webhookId: string, type: string })

// R2 operations (file operations, not DB)
trpc.admin.r2.delete.mutate({ bucket: string, key: string })
```

## 📝 Frontend Refactoring Plan

### Step 1: Create Enhanced DB Query Composable

```typescript
// composables/useAdminDbQuery.js
export function useAdminDbQuery(collectionName) {
  return {
    async list(params) {
      const result = await trpc.getCollectionData.query({
        collectionName,
        page: params.page || 1,
        limit: params.limit || 25,
        search: params.search,
        filters: params.filters,
        orderBy: params.orderBy
      });
      
      return {
        items: result.data,
        total: result.pagination.total,
        pages: result.pagination.pages
      };
    },
    
    async getStats(params) {
      return await trpc.getCollectionStats.query({
        collectionName,
        ...params
      });
    },
    
    async export(format) {
      return await trpc.exportCollection.query({
        collectionName,
        format
      });
    }
  };
}
```

### Step 2: Update Admin Panels

Each admin panel would be updated to use the generic DB query:

```typescript
// Example: AdminUsers.vue
const dbQuery = useAdminDbQuery('users');

// Replace trpc.users.list.query with:
const data = await dbQuery.list({
  page: page.value,
  limit: limit.value,
  search: searchQuery.value,
  filters: {
    status: filterStatus.value !== 'all' ? filterStatus.value : undefined
  }
});
```

## 📊 Collection Mapping

Map admin panels to database collections:

| Admin Panel | Collection Name | Special Fields |
|-------------|----------------|----------------|
| Users | `users` | status, role, organizationCount |
| Organizations | `orgs` | plan, status, memberCount, projectCount |
| Projects | `projects` | status, deploymentCount, postCount |
| Deployments | `deploys` | status, buildDuration, branch |
| Jobs | `jobs` | status, type, duration |
| Git Events | `gitEvents` | event, ref, commitHash |
| Webhooks (Incoming) | `projectWebhooks` | url, events, status |
| Webhooks (Outgoing) | `projectOutgoingWebhooks` | targetUrl, events, active |
| Notes | `notes` | type, isPublic, tags |
| Media Files | `medias` | (already implemented) |
| R2 Storage | N/A | (uses file API, not DB) |

## 🚀 Implementation Priority

### Phase 1: Backend Enhancements (Minimal)
1. Add search/filter/orderBy support to `getCollectionData`
2. Add `getCollectionStats` endpoint
3. Add `exportCollection` endpoint

### Phase 2: Special Operations
1. Implement the ~10 special operation endpoints listed above

### Phase 3: Frontend Refactoring
1. Create `useAdminDbQuery` composable
2. Update each admin panel to use the generic query
3. Remove references to non-existent endpoints

## ✅ Benefits of This Approach

1. **Minimal Backend Work**: Enhance 3 existing endpoints instead of creating 40+ new ones
2. **Consistency**: All collections use the same query interface
3. **Flexibility**: Easy to add new admin panels for any collection
4. **Reusability**: The DB explorer (`/admin/db`) already works with all collections
5. **Type Safety**: Can generate TypeScript types from collection schemas

## 🔒 Security Considerations

1. Ensure `getCollectionData` checks admin permissions
2. Add collection-level access control if needed
3. Sanitize search queries to prevent injection
4. Rate limit export operations
5. Audit log for sensitive operations

## 📋 Summary

Instead of implementing 40+ individual endpoints, we can:
- Use the existing `getCollectionData` endpoint with minor enhancements
- Add only ~10 special operation endpoints for business logic
- Refactor frontend to use the generic query system
- Maintain all functionality while reducing backend complexity by 75%