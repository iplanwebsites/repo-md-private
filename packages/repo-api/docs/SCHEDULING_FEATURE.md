# AI Agent Scheduling System Documentation

## Overview

The AI Agent Scheduling System is a comprehensive temporal task management solution that enables AI agents to schedule, manage, and execute tasks over time. It features natural language processing, calendar integration, and automatic task execution.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        API Layer                             │
├─────────────────────┬───────────────────────────────────────┤
│    REST API         │           tRPC Procedures              │
│  /api/schedule/*    │         trpc.schedule.*               │
└─────────────────────┴───────────────────────────────────────┘
                                │
┌───────────────────────────────┴─────────────────────────────┐
│                    Core Scheduling Engine                    │
├─────────────┬──────────────┬──────────────┬────────────────┤
│  Scheduler  │     NLP      │    Feeds     │     Queue      │
│   (CRUD)    │  (Commands)  │  (Calendar)  │  (Execution)   │
└─────────────┴──────────────┴──────────────┴────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                        MongoDB                               │
├───────────────────────┬─────────────────────────────────────┤
│   scheduledTasks      │         taskHistory                 │
└───────────────────────┴─────────────────────────────────────┘
```

## File Structure

```
lib/schedule/
├── index.js              # Main entry point, exports all functions
├── scheduler.js          # Core scheduling logic (CRUD operations)
├── nlp.js               # Natural language processing
├── feeds.js             # Calendar feed generation (iCal/JSON)
├── queue.js             # Task execution queue
├── schemas.js           # Zod validation schemas
├── errors.js            # Custom error classes
├── constants.js         # Configuration constants
├── rateLimiter.js       # Rate limiting utilities
├── trpcProcedures.js    # tRPC procedure definitions
├── README.md            # Feature documentation
└── IMPLEMENTATION_SUMMARY.md  # Technical implementation details

routes/
├── express/
│   └── scheduleRoutes.js     # REST API routes
└── scheduleRouter.js         # tRPC router

scripts/
└── testScheduling.js         # Test script for the feature
```

## Key Features

### 1. Natural Language Scheduling

Users can create and manage tasks using plain English:

```javascript
// Examples of supported commands:
"schedule weekly team meeting every monday at 10am"
"cancel tomorrow's deployment" 
"reschedule friday's review to next week"
"show me next week's tasks"
"move the SEO audit to thursday at 2pm"
```

### 2. Task Types

- **Manual Tasks**: One-time scheduled tasks
- **Recurring Tasks**: Daily, weekly, monthly, or custom RRULE patterns
- **Trigger Tasks**: Event-driven tasks (webhook, event, condition)

### 3. Calendar Integration

Generate calendar feeds in multiple formats:
- **iCal**: For Apple Calendar, Google Calendar, Outlook
- **JSON**: For custom integrations
- **Views**: Agent-specific, project-wide, organization-wide, or user's combined feed

### 4. Task Execution

- Polling-based queue system
- Configurable executors per agent
- Automatic retry with exponential backoff
- Integration with existing job system

## API Reference

### REST Endpoints

```bash
# Create a task
POST /api/schedule/tasks
{
  "date": "tomorrow at 2pm",
  "title": "Review metrics",
  "agentId": "analytics-agent",
  "projectId": "project123"
}

# List upcoming tasks
GET /api/schedule/tasks?agentId=seo-agent&limit=10

# Process natural language
POST /api/schedule/nlp
{
  "command": "cancel next monday's meeting",
  "context": { "agentId": "team-agent" }
}

# Get calendar feed
GET /api/schedule/feed/agent/seo-agent?format=ical
```

### tRPC Procedures

```javascript
// Schedule a task
const task = await trpc.schedule.scheduleTask.mutate({
  date: 'next Monday at 9am',
  title: 'Weekly Review',
  agentId: 'review-agent'
});

// Process natural language
const result = await trpc.schedule.processNaturalCommand.mutate({
  command: 'schedule daily standup at 9:30am',
  context: { agentId: 'team-agent' }
});

// Get upcoming tasks
const tasks = await trpc.schedule.getUpcomingTasks.query({
  agentId: 'seo-agent',
  limit: 20
});
```

## Configuration

### Environment Variables

```bash
# Task Queue Configuration
SCHEDULER_POLL_INTERVAL=60000      # How often to check for tasks (ms)
SCHEDULER_BATCH_SIZE=10            # Tasks to process per batch
SCHEDULER_TASK_TIMEOUT=300000      # Max execution time per task (ms)
SCHEDULER_AUTO_START=true          # Start queue on app startup

# Rate Limiting (optional)
SCHEDULER_MAX_PER_MINUTE=30        # Max scheduling requests per minute
SCHEDULER_MAX_PER_HOUR=500         # Max scheduling requests per hour
```

### Database Collections

1. **scheduledTasks**
   - Stores all task definitions
   - Indexed by agentId, projectId, orgId, scheduledAt, status
   
2. **taskHistory**
   - Audit trail of all task operations
   - Indexed by taskId, action, timestamp

## Usage Examples

### Basic Task Scheduling

```javascript
import { scheduleTask } from './lib/schedule/index.js';

// Schedule a simple task
const task = await scheduleTask({
  date: 'tomorrow at 3pm',
  title: 'Generate weekly report',
  agentId: 'reporting-agent',
  projectId: 'project123',
  payload: {
    reportType: 'weekly',
    format: 'pdf'
  }
});
```

### Recurring Tasks

```javascript
// Schedule a daily standup
const dailyStandup = await scheduleTask({
  date: 'tomorrow at 9:30am',
  title: 'Daily Standup',
  agentId: 'team-agent',
  type: 'recurring',
  recurrence: {
    pattern: 'daily',
    endDate: new Date('2024-12-31')
  }
});

// Schedule weekly reviews every Monday
const weeklyReview = await scheduleTask({
  date: 'next Monday at 2pm',
  title: 'Weekly Performance Review',
  agentId: 'review-agent',
  type: 'recurring',
  recurrence: {
    pattern: 'weekly',
    daysOfWeek: [1], // Monday
    interval: 1      // Every week
  }
});
```

### Natural Language Commands

```javascript
import { processNaturalCommand } from './lib/schedule/index.js';

// Schedule using natural language
const result = await processNaturalCommand(
  'schedule team meeting every tuesday and thursday at 3pm',
  { 
    agentId: 'meeting-agent',
    projectId: 'project123'
  }
);

// Cancel tasks
const cancelResult = await processNaturalCommand(
  'cancel all meetings tomorrow',
  { agentId: 'meeting-agent' }
);
```

### Task Executors

```javascript
import { registerTaskExecutor, startTaskQueue } from './lib/schedule/index.js';

// Register an executor for an agent
registerTaskExecutor('reporting-agent', async (task) => {
  console.log(`Executing task: ${task.title}`);
  
  // Access task payload
  const { reportType, format } = task.payload;
  
  // Perform the task
  const report = await generateReport(reportType, format);
  
  // Return result
  return {
    success: true,
    reportId: report.id,
    generatedAt: new Date()
  };
});

// Start the task queue
startTaskQueue();
```

### Calendar Feed Integration

```javascript
import { generateCalendarFeed, generateFeedToken } from './lib/schedule/index.js';

// Generate a private feed token
const token = await generateFeedToken(userId, 'agent', 'seo-agent');

// Get the subscription URL
const calendarUrl = `https://api.repo.md/api/schedule/feed/agent/seo-agent.ics?token=${token}`;

// Generate feed programmatically
const icalFeed = await generateCalendarFeed({
  type: 'project',
  id: projectId,
  format: 'ical',
  includePrivate: true
});
```

## Development & Testing

### Running Tests

```bash
# Basic tests
node scripts/testScheduling.js

# Test with queue execution
node scripts/testScheduling.js --run-queue
```

### Adding New Features

1. **New Task Types**: Add to `TaskType` enum in `scheduler.js`
2. **New Intents**: Add to `Intent` enum and handlers in `nlp.js`
3. **New Executors**: Register in `queue.js` using `registerTaskExecutor()`
4. **New API Endpoints**: Add to `scheduleRoutes.js` and `trpcProcedures.js`

## Common Patterns

### Error Handling

```javascript
try {
  const task = await scheduleTask({...});
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors
  } else if (error instanceof TaskNotFoundError) {
    // Handle not found errors
  } else {
    // Handle other errors
  }
}
```

### Bulk Operations

```javascript
// Cancel multiple tasks
const taskIds = ['task1', 'task2', 'task3'];
const results = await trpc.schedule.bulkCancelTasks.mutate({
  taskIds,
  reason: 'Project cancelled'
});
```

### Query Patterns

```javascript
// Get tasks for next 7 days
const weekTasks = await getUpcomingTasks({
  agentId: 'my-agent',
  from: new Date(),
  to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
});

// Get today's agenda
const todayTasks = await trpc.schedule.getTodayAgenda.query({
  agentId: 'my-agent'
});
```

## Troubleshooting

### Tasks Not Executing

1. Check queue status: `GET /api/schedule/queue/status`
2. Verify executor is registered for the agent
3. Check task status is 'scheduled' and scheduledAt is in the past
4. Look for errors in taskHistory collection

### Natural Language Not Working

1. Check command format matches expected patterns
2. Verify agentId is provided in context
3. Try more specific commands (e.g., include full date instead of "tomorrow")

### Calendar Feed Issues

1. Verify token is valid and not expired
2. Check feed URL format is correct
3. Ensure proper content-type headers are set

## Security Considerations

1. **Authentication**: All endpoints require JWT authentication
2. **Authorization**: Agents can only access their own tasks
3. **Rate Limiting**: Prevents abuse and DoS attacks
4. **Input Validation**: All inputs validated with Zod schemas
5. **SQL Injection**: Protected by using MongoDB parameterized queries

## Performance Optimization

1. **Indexes**: All common query patterns have MongoDB indexes
2. **Batch Processing**: Queue processes multiple tasks per cycle
3. **Caching**: Calendar feeds can be cached for 5 minutes
4. **Pagination**: All list endpoints support limit/offset

## Future Enhancements

- [ ] Web UI for visual task management
- [ ] Task dependencies (task A must complete before task B)
- [ ] Webhook notifications on task state changes
- [ ] Task templates for common operations
- [ ] Analytics dashboard for task metrics
- [ ] Slack bot for natural language commands
- [ ] Time zone support per agent/user
- [ ] Task priority levels
- [ ] Resource constraints (max concurrent tasks)

## Migration Guide

If updating from a previous version:

1. Run database migrations to create new collections
2. Update environment variables for queue configuration
3. Register task executors for existing agents
4. Test natural language commands with your use cases

## Support

For issues or questions:
1. Check the test script for examples
2. Review error messages and logs
3. Check MongoDB for task status
4. Use queue status endpoint for diagnostics