# AI Agent Scheduling System

A comprehensive scheduling system for AI agents that provides temporal task management with natural language processing and calendar integration.

## Features

- **Natural Language Scheduling**: Schedule tasks using plain English like "schedule SEO review next Monday at 2pm"
- **Recurring Tasks**: Support for daily, weekly, monthly, and custom recurrence patterns
- **Calendar Feeds**: Generate iCal feeds for integration with calendar apps
- **Queue Integration**: Seamlessly integrates with the existing job queue system
- **Task Hierarchy**: Support for parent-child task relationships
- **Trigger-based Tasks**: Execute tasks based on events or conditions

## Installation

The scheduling system is already integrated into the project. To use it:

```javascript
import { 
  scheduleTask, 
  processNaturalCommand, 
  startTaskQueue 
} from './lib/schedule/index.js';
```

## Quick Start

### 1. Schedule a Simple Task

```javascript
const task = await scheduleTask({
  date: 'tomorrow at 2pm',
  title: 'Review weekly metrics',
  agentId: 'metrics-agent',
  projectId: projectId,
  orgId: orgId
});
```

### 2. Use Natural Language

```javascript
const result = await processNaturalCommand(
  'cancel next monday seo review',
  { agentId: 'seo-agent', projectId: projectId }
);
```

### 3. Create Recurring Tasks

```javascript
const recurringTask = await scheduleTask({
  date: 'next Monday at 9am',
  title: 'Weekly team standup',
  agentId: 'team-agent',
  type: 'recurring',
  recurrence: {
    pattern: 'weekly',
    daysOfWeek: [1] // Every Monday
  }
});
```

### 4. Start the Task Queue

```javascript
// In your server initialization
import { startTaskQueue } from './lib/schedule/index.js';

startTaskQueue(); // Starts polling for tasks to execute
```

## Natural Language Commands

The system understands various natural language patterns:

### Scheduling
- "schedule a meeting tomorrow at 3pm"
- "create weekly report every friday at 5pm"
- "add daily standup at 9:30am"

### Cancelling
- "cancel next monday seo review"
- "delete all meetings tomorrow"
- "remove weekly report task"

### Rescheduling
- "move tomorrow's meeting to thursday"
- "reschedule seo review to next week"
- "postpone daily standup to 10am"

### Listing
- "show upcoming tasks"
- "what's scheduled for tomorrow?"
- "list this week's tasks"

## Calendar Integration

### Generate iCal Feed

```javascript
const icalFeed = await generateCalendarFeed({
  type: 'agent',
  id: 'seo-agent',
  format: 'ical',
  title: 'SEO Agent Tasks',
  description: 'All scheduled SEO tasks'
});

// Get subscription URL
const subscriptionUrl = getCalendarSubscriptionUrl(
  'agent',
  'seo-agent',
  authToken
);
```

### Feed Types
- `agent`: Tasks for a specific agent
- `project`: All tasks in a project
- `org`: Organization-wide tasks
- `user`: Combined feed for all user's agents

## Task Executors

Register custom executors for your agents:

```javascript
import { registerTaskExecutor } from './lib/schedule/index.js';

registerTaskExecutor('seo-agent', async (task) => {
  console.log(`Executing SEO task: ${task.title}`);
  
  // Your task logic here
  const results = await performSeoAnalysis(task.payload);
  
  return {
    success: true,
    metrics: results
  };
});
```

## Trigger-Based Tasks

Create tasks that execute on specific events:

```javascript
const triggerTask = await scheduleTask({
  title: 'Process deployment',
  agentId: 'deploy-agent',
  type: 'trigger',
  trigger: {
    type: 'event',
    config: {
      eventName: 'deployment.completed'
    }
  }
});

// Trigger the task when event occurs
await processTriggerTasks('deployment.completed', {
  projectId: 'project123',
  environment: 'production'
});
```

## API Reference

### Core Functions

#### `scheduleTask(options)`
Creates a new scheduled task.

**Parameters:**
- `date` (Date|string): When to execute the task
- `title` (string): Task title
- `agentId` (string): Agent responsible for the task
- `message` (string, optional): Task description
- `projectId` (string, optional): Associated project
- `orgId` (string, optional): Associated organization
- `type` (string, optional): 'manual', 'trigger', or 'recurring'
- `recurrence` (object, optional): Recurrence configuration
- `payload` (object, optional): Task-specific data

#### `processNaturalCommand(command, context)`
Process a natural language command.

**Parameters:**
- `command` (string): Natural language command
- `context` (object): Execution context
  - `agentId` (string): Agent context
  - `projectId` (string, optional): Project context
  - `orgId` (string, optional): Organization context

#### `getUpcomingTasks(options)`
Retrieve upcoming scheduled tasks.

**Parameters:**
- `agentId` (string, optional): Filter by agent
- `projectId` (string, optional): Filter by project
- `orgId` (string, optional): Filter by organization
- `from` (Date, optional): Start date
- `to` (Date, optional): End date
- `limit` (number, optional): Maximum results

### Queue Management

#### `startTaskQueue()`
Start the task queue processor.

#### `stopTaskQueue()`
Stop the task queue processor.

#### `getQueueStatus()`
Get current queue statistics.

## Configuration

Environment variables:

```bash
# Task queue configuration
SCHEDULER_POLL_INTERVAL=60000      # Polling interval in ms (default: 1 minute)
SCHEDULER_BATCH_SIZE=10            # Tasks per batch (default: 10)
SCHEDULER_TASK_TIMEOUT=300000      # Task timeout in ms (default: 5 minutes)
SCHEDULER_AUTO_START=true          # Auto-start queue on app start

# MongoDB collections (automatically created)
# - scheduledTasks: Task definitions
# - taskHistory: Execution history
```

## Database Schema

### scheduledTasks Collection

```javascript
{
  _id: ObjectId,
  agentId: String,              // Required: Agent identifier
  title: String,                // Required: Task title
  description: String,          // Optional: Detailed description
  type: String,                 // 'manual', 'trigger', 'recurring'
  status: String,               // 'scheduled', 'pending', 'running', 'completed', 'cancelled', 'failed'
  
  scheduledAt: Date,            // When to execute
  executedAt: Date,             // When execution started
  completedAt: Date,            // When completed
  
  projectId: ObjectId,          // Optional: Project reference
  orgId: ObjectId,              // Optional: Organization reference
  parentTaskId: ObjectId,       // Optional: Parent task
  
  recurrence: {                 // For recurring tasks
    pattern: String,            // 'daily', 'weekly', 'monthly', 'custom'
    interval: Number,           // Repeat interval
    endDate: Date,              // Optional: End date
    daysOfWeek: [Number],       // For weekly: 0-6 (Sun-Sat)
    dayOfMonth: Number,         // For monthly
    customRule: String          // RRULE format
  },
  
  trigger: {                    // For trigger-based tasks
    type: String,               // 'webhook', 'event', 'condition'
    config: Object              // Trigger configuration
  },
  
  payload: Object,              // Task-specific data
  metadata: Object,             // Additional metadata
  result: Object,               // Execution result
  error: String,                // Error message if failed
  
  createdAt: Date,
  updatedAt: Date,
  createdBy: String             // User or agent ID
}
```

## Examples

### SEO Agent Weekly Reports

```javascript
// Schedule weekly SEO reports
await scheduleTask({
  date: 'next Monday at 9am',
  title: 'Weekly SEO Performance Report',
  agentId: 'seo-agent',
  projectId: projectId,
  type: 'recurring',
  recurrence: {
    pattern: 'weekly',
    daysOfWeek: [1] // Every Monday
  },
  payload: {
    reportType: 'weekly',
    metrics: ['traffic', 'rankings', 'backlinks']
  }
});

// Register executor
registerTaskExecutor('seo-agent', async (task) => {
  const { reportType, metrics } = task.payload;
  
  // Generate report
  const report = await generateSeoReport(task.projectId, {
    type: reportType,
    metrics: metrics,
    period: 'last_7_days'
  });
  
  // Send via email or Slack
  await sendReport(report, task.projectId);
  
  return { reportId: report.id, status: 'sent' };
});
```

### Deployment Schedule

```javascript
// Schedule deployment windows
await scheduleTask({
  date: 'every Friday at 6pm',
  title: 'Production Deployment Window',
  agentId: 'deploy-agent',
  projectId: projectId,
  type: 'recurring',
  recurrence: {
    pattern: 'weekly',
    daysOfWeek: [5] // Friday
  },
  metadata: {
    environment: 'production',
    approvalRequired: true
  }
});
```

### Natural Language Task Management

```javascript
// Handle user commands
async function handleUserCommand(userInput, userId) {
  const context = {
    agentId: 'personal-assistant',
    userId: userId
  };
  
  try {
    const result = await processNaturalCommand(userInput, context);
    
    if (result.success) {
      console.log(result.message);
      return result;
    } else {
      console.error('Command failed:', result.message);
      return result;
    }
  } catch (error) {
    console.error('Error processing command:', error);
    throw error;
  }
}

// Examples:
await handleUserCommand("schedule code review tomorrow at 2pm", userId);
await handleUserCommand("cancel all meetings this afternoon", userId);
await handleUserCommand("what's on my schedule next week?", userId);
```

## Best Practices

1. **Agent Naming**: Use descriptive agent IDs like 'seo-agent', 'deploy-agent'
2. **Task Titles**: Keep titles concise and descriptive
3. **Payload Data**: Store task-specific data in the payload field
4. **Error Handling**: Always implement error handling in task executors
5. **Timeouts**: Set appropriate timeouts for long-running tasks
6. **Logging**: Log task execution for debugging and auditing

## Troubleshooting

### Tasks Not Executing
1. Check if the task queue is running: `getQueueStatus()`
2. Verify task status is 'scheduled' and scheduledAt is in the past
3. Check if an executor is registered for the agent

### Natural Language Not Working
1. Ensure chrono-node is installed: `npm list chrono-node`
2. Check the command format matches expected patterns
3. Verify the context includes required agentId

### Calendar Feed Issues
1. Ensure ical-generator is installed: `npm list ical-generator`
2. Check feed token is valid if using authenticated feeds
3. Verify the feed URL is accessible

## Future Enhancements

- [ ] Web UI for task management
- [ ] Slack bot integration for natural commands
- [ ] Task dependencies and workflows
- [ ] Advanced scheduling constraints
- [ ] Task templates and presets
- [ ] Metrics and analytics dashboard