# Task Management API Requirements

## Overview
The task management system enables agents to execute scheduled actions based on pre-defined prompts and variables. Tasks can be one-time, recurring, or triggered by parent tasks. This document outlines the tRPC endpoints required to support the task management feature.

## Data Model

### Task Entity
```typescript
interface Task {
  id: string
  orgId: string
  projectId: string
  parentTaskId?: string // For subtasks/triggered tasks
  
  // Basic info
  title: string
  description: string
  prompt?: string // Pre-saved prompt template for agent
  variables?: Record<string, any> // Variables to inject into prompt
  
  // Type and status
  type: 'one-time' | 'recurring' | 'triggered'
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  
  // Temporal info
  scheduledAt?: Date
  startedAt?: Date
  completedAt?: Date
  duration?: number // milliseconds
  
  // Recurrence settings
  recurrence?: {
    pattern: 'daily' | 'weekly' | 'monthly' | 'custom'
    interval?: number
    daysOfWeek?: number[] // 0-6
    dayOfMonth?: number // 1-31
    time?: string // HH:mm
    timezone?: string
    endDate?: Date
    occurrences?: number
  }
  
  // Agent configuration
  agentModel?: string
  agentTemperature?: number
  maxTokens?: number
  timeout?: number
  
  // Results
  result?: {
    status: 'success' | 'failure' | 'partial'
    output?: any
    error?: string
    filesChanged?: string[]
    tokensUsed?: number
    cost?: number
  }
  
  // Metadata
  tags?: string[]
  createdAt: Date
  updatedAt: Date
  createdBy: string
  lastModifiedBy?: string
  
  // Relations
  dependencies?: string[] // Task IDs that must complete first
}
```

## Required tRPC Endpoints

### 1. task.list
List tasks with filtering and pagination.

**Input:**
```typescript
{
  orgId?: string
  projectId?: string
  status?: Task['status'][]
  type?: Task['type'][]
  priority?: Task['priority'][]
  tags?: string[]
  scheduledAfter?: Date
  scheduledBefore?: Date
  parentTaskId?: string
  search?: string
  limit?: number
  offset?: number
  orderBy?: 'scheduledAt' | 'createdAt' | 'updatedAt'
  orderDirection?: 'asc' | 'desc'
}
```

**Output:**
```typescript
{
  tasks: Task[]
  total: number
  hasMore: boolean
}
```

### 2. task.get
Get a single task by ID.

**Input:**
```typescript
{
  taskId: string
}
```

**Output:** `Task`

### 3. task.create
Create a new task.

**Input:**
```typescript
{
  orgId: string
  projectId: string
  title: string
  description: string
  type: Task['type']
  priority?: Task['priority']
  prompt?: string
  variables?: Record<string, any>
  scheduledAt?: Date
  recurrence?: Task['recurrence']
  parentTaskId?: string
  dependencies?: string[]
  agentModel?: string
  agentTemperature?: number
  tags?: string[]
}
```

**Output:** `Task`

### 4. task.update
Update an existing task.

**Input:**
```typescript
{
  taskId: string
  data: Partial<Omit<Task, 'id' | 'orgId' | 'projectId' | 'createdAt' | 'createdBy'>>
}
```

**Output:** `Task`

### 5. task.delete
Delete a task.

**Input:**
```typescript
{
  taskId: string
}
```

**Output:**
```typescript
{
  success: boolean
}
```

### 6. task.execute
Manually trigger a task to run immediately.

**Input:**
```typescript
{
  taskId: string
  variables?: Record<string, any> // Override task variables
}
```

**Output:**
```typescript
{
  executionId: string
  status: 'started' | 'queued'
}
```

### 7. task.cancel
Cancel a running task.

**Input:**
```typescript
{
  taskId: string
}
```

**Output:**
```typescript
{
  success: boolean
}
```

### 8. task.calendar
Get tasks formatted for calendar view with recurring task expansion.

**Input:**
```typescript
{
  orgId?: string
  projectId?: string
  start: Date
  end: Date
  includeCompleted?: boolean
}
```

**Output:**
```typescript
{
  events: Array<{
    id: string
    title: string
    start: Date
    end?: Date
    allDay?: boolean
    task: Task
    isRecurringInstance?: boolean
    originalTaskId?: string // For recurring instances
  }>
}
```

### 9. task.stats
Get task statistics.

**Input:**
```typescript
{
  orgId?: string
  projectId?: string
  dateRange?: {
    start: Date
    end: Date
  }
}
```

**Output:**
```typescript
{
  total: number
  byStatus: Record<Task['status'], number>
  byType: Record<Task['type'], number>
  successRate: number
  avgDuration: number
  tokensUsed: number
  totalCost: number
  upcomingCount: number
  overdueCount: number
}
```

### 10. task.executions
Get execution history for a task.

**Input:**
```typescript
{
  taskId: string
  limit?: number
  offset?: number
}
```

**Output:**
```typescript
{
  executions: Array<{
    id: string
    taskId: string
    status: 'running' | 'completed' | 'failed'
    startedAt: Date
    completedAt?: Date
    duration?: number
    output?: any
    error?: string
    tokensUsed?: number
    cost?: number
  }>
  total: number
}
```

### 11. task.clone
Clone an existing task.

**Input:**
```typescript
{
  taskId: string
  overrides?: {
    title?: string
    scheduledAt?: Date
    projectId?: string
  }
}
```

**Output:** `Task`

### 12. task.bulkUpdate
Update multiple tasks at once (e.g., for rescheduling).

**Input:**
```typescript
{
  taskIds: string[]
  data: Partial<Pick<Task, 'status' | 'scheduledAt' | 'priority' | 'tags'>>
}
```

**Output:**
```typescript
{
  updated: number
  failed: string[] // Task IDs that failed to update
}
```

## Implementation Notes

### Task Execution Flow
1. When a task's scheduled time arrives, the backend scheduler should:
   - Update task status to `in_progress`
   - Create an execution record
   - Send the task to the agent with its prompt and variables
   - Capture agent output and any file changes
   - Update task status and result
   - Trigger any dependent tasks

### Recurring Task Handling
- Recurring tasks should remain in `scheduled` status
- Each execution creates a new execution record
- The `scheduledAt` field represents the next occurrence
- After execution, calculate and update the next occurrence time

### Agent Integration
- Tasks should use the same agent infrastructure as ChatTask
- The `prompt` field contains the template with {{variable}} placeholders
- Variables are injected before sending to the agent
- File changes should be tracked and associated with the task

### Permissions
- Tasks inherit project/org permissions
- Users can only view/edit tasks in projects they have access to
- Task execution requires project write permissions

### Webhook Integration
- Task completion should trigger webhooks if configured
- Include task details and execution results in webhook payload

### Error Handling
- Failed tasks should retain error information
- Implement retry logic with exponential backoff
- Alert users of recurring task failures

### Performance Considerations
- Index tasks by scheduledAt for efficient scheduling queries
- Implement pagination for large task lists
- Cache calendar view data for better performance
- Consider task archival for old completed tasks

## Example Usage Scenarios

### 1. Content Publishing Workflow
```typescript
// Create a task to generate a blog post
const task = await trpc.task.create({
  orgId: 'org_123',
  projectId: 'proj_456',
  title: 'Write weekly tech news roundup',
  type: 'recurring',
  prompt: 'Write a blog post summarizing this week\'s top tech news: {{newsItems}}',
  variables: {
    newsItems: ['AI advances', 'New framework releases', 'Industry updates']
  },
  recurrence: {
    pattern: 'weekly',
    daysOfWeek: [1], // Monday
    time: '09:00'
  },
  agentModel: 'gpt-4'
})
```

### 2. Triggered Subtasks
```typescript
// Create a parent task that triggers image generation
const parentTask = await trpc.task.create({
  orgId: 'org_123',
  projectId: 'proj_456',
  title: 'Create product announcement',
  type: 'one-time',
  scheduledAt: new Date('2024-12-01T10:00:00')
})

// Create triggered subtask
const imageTask = await trpc.task.create({
  orgId: 'org_123',
  projectId: 'proj_456',
  parentTaskId: parentTask.id,
  title: 'Generate announcement banner',
  type: 'triggered',
  prompt: 'Create a banner image for: {{announcement}}',
  agentModel: 'dall-e-3'
})
```

### 3. Calendar Export
Tasks support iCal export for integration with external calendar applications. The export includes:
- One-time tasks as single events
- Recurring tasks with RRULE
- Task priority and tags
- Reminders (15 minutes before scheduled time)