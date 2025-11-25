# AI Agent Scheduling System Plan

## Overview
A temporal task scheduling system for AI agents that enables them to manage tasks over time, with natural language processing capabilities and calendar feed integration.

## Architecture

### Core Components

1. **Task Scheduler** (`lib/schedule/scheduler.js`)
   - CRUD operations for scheduled tasks
   - Query upcoming tasks by agent, project, or organization
   - Natural language date parsing
   - Recurrence pattern support

2. **Task Model** (`lib/schedule/models/task.js`)
   - MongoDB schema for scheduled tasks
   - Support for trigger-based and manually launched tasks
   - Parent-child task relationships
   - Status tracking and history

3. **Natural Language Processor** (`lib/schedule/nlp.js`)
   - Parse natural language commands like "cancel next monday seo review"
   - Date/time extraction using chrono-node
   - Intent recognition for actions (schedule, cancel, reschedule)

4. **Calendar Feed Generator** (`lib/schedule/feeds.js`)
   - Generate iCal feeds for different views
   - Agent-specific calendars
   - Project/Organization calendars
   - Public and authenticated feeds

5. **Queue Integration** (`lib/schedule/queue.js`)
   - Interface with existing job queue system
   - Automatic task execution at scheduled times
   - Retry logic and error handling

## Database Schema

### scheduledTasks Collection
```javascript
{
  _id: ObjectId,
  agentId: String,          // AI agent identifier
  projectId: ObjectId,      // Reference to projects collection
  orgId: ObjectId,          // Reference to orgs collection
  parentTaskId: ObjectId,   // For subtasks/dependencies
  
  title: String,
  description: String,
  type: String,             // 'manual', 'trigger', 'recurring'
  status: String,           // 'scheduled', 'pending', 'running', 'completed', 'cancelled', 'failed'
  
  scheduledAt: Date,        // When to execute
  executedAt: Date,         // When actually executed
  completedAt: Date,        // When completed
  
  recurrence: {
    pattern: String,        // 'daily', 'weekly', 'monthly', 'custom'
    interval: Number,       // Every N days/weeks/months
    endDate: Date,          // Optional end date
    daysOfWeek: [Number],   // For weekly: 0-6 (Sun-Sat)
    dayOfMonth: Number,     // For monthly
    customRule: String      // RRULE format for complex patterns
  },
  
  trigger: {
    type: String,           // 'webhook', 'event', 'condition'
    config: Object          // Trigger-specific configuration
  },
  
  payload: Object,          // Task-specific data
  metadata: Object,         // Additional context
  
  createdAt: Date,
  updatedAt: Date,
  createdBy: String        // User or agent ID
}
```

### taskHistory Collection
```javascript
{
  _id: ObjectId,
  taskId: ObjectId,
  action: String,           // 'created', 'updated', 'executed', 'failed', 'cancelled'
  timestamp: Date,
  details: Object,
  performedBy: String
}
```

## API Design

### Core Functions

```javascript
// Schedule Management
async function scheduleTask(data: {
  date: Date | string,
  title: string,
  message?: string,
  parentTask?: string,
  projectId?: string,
  orgId?: string,
  agentId: string,
  type?: 'manual' | 'trigger' | 'recurring',
  recurrence?: RecurrenceOptions,
  payload?: object
}): Promise<ScheduledTask>

async function getUpcomingTasks(options: {
  agentId?: string,
  projectId?: string,
  orgId?: string,
  from?: Date,
  to?: Date,
  limit?: number,
  includeCompleted?: boolean
}): Promise<ScheduledTask[]>

async function updateTask(taskId: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask>

async function cancelTask(taskId: string, reason?: string): Promise<void>

async function rescheduleTask(taskId: string, newDate: Date | string): Promise<ScheduledTask>

// Natural Language Interface
async function processNaturalCommand(command: string, context: {
  agentId: string,
  projectId?: string,
  orgId?: string
}): Promise<CommandResult>

// Calendar Feeds
async function generateCalendarFeed(options: {
  type: 'agent' | 'project' | 'org',
  id: string,
  format: 'ical' | 'json',
  includePrivate?: boolean
}): Promise<string>
```

## Implementation Steps

### Phase 1: Core Infrastructure
1. Set up MongoDB collections and indexes
2. Implement basic CRUD operations
3. Create task model with validation
4. Build scheduling utilities

### Phase 2: Natural Language Processing
1. Integrate chrono-node for date parsing
2. Build intent recognition for task commands
3. Create command parser and executor
4. Add fuzzy matching for task titles

### Phase 3: Calendar Integration
1. Implement iCal feed generation using ical-generator
2. Create feed endpoints for different views
3. Add authentication for private feeds
4. Support calendar subscriptions

### Phase 4: Queue Integration
1. Connect with existing job queue system
2. Implement task execution logic
3. Add retry and error handling
4. Create status update mechanisms

### Phase 5: Advanced Features
1. Recurring task support
2. Task dependencies and chains
3. Trigger-based scheduling
4. Conflict detection and resolution

## Dependencies

- **chrono-node**: Natural language date parsing
- **ical-generator**: Generate iCal feeds
- **node-cron**: Cron job scheduling
- **rrule**: Recurrence rule processing
- **compromise**: Natural language processing (optional, for advanced NLP)

## Usage Examples

```javascript
// Schedule a task
await scheduleTask({
  date: 'next Monday at 2pm',
  title: 'SEO Review',
  message: 'Review SEO performance for the week',
  projectId: 'project123',
  agentId: 'seo-agent',
  type: 'recurring',
  recurrence: {
    pattern: 'weekly',
    daysOfWeek: [1] // Every Monday
  }
});

// Get upcoming tasks
const tasks = await getUpcomingTasks({
  agentId: 'seo-agent',
  from: new Date(),
  to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
  limit: 10
});

// Process natural language command
const result = await processNaturalCommand(
  "cancel next monday seo review",
  { agentId: 'seo-agent', projectId: 'project123' }
);

// Generate calendar feed
const icalFeed = await generateCalendarFeed({
  type: 'agent',
  id: 'seo-agent',
  format: 'ical'
});
```

## Success Metrics

1. Task scheduling accuracy > 99%
2. Natural language command success rate > 90%
3. Calendar feed generation < 100ms
4. Queue execution delay < 60 seconds
5. System uptime > 99.9%

## Security Considerations

1. Agent isolation - agents can only manage their own tasks
2. Project/Org scoping for multi-tenancy
3. Authenticated calendar feeds for private data
4. Rate limiting for API calls
5. Input validation for natural language commands