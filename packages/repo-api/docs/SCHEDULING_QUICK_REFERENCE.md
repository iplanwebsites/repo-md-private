# AI Agent Scheduling - Quick Reference

## 🚀 Quick Start

```javascript
import { scheduleTask, processNaturalCommand, startTaskQueue } from './lib/schedule/index.js';

// Start the queue (do this once on app startup)
startTaskQueue();
```

## 📅 Common Operations

### Schedule a Task

```javascript
// Simple one-time task
await scheduleTask({
  date: 'tomorrow at 2pm',
  title: 'Review metrics',
  agentId: 'metrics-agent'
});

// With payload data
await scheduleTask({
  date: 'next Monday at 9am',
  title: 'Generate report',
  agentId: 'report-agent',
  payload: { type: 'weekly', format: 'pdf' }
});
```

### Natural Language

```javascript
// Schedule
await processNaturalCommand(
  'schedule team meeting every monday at 10am',
  { agentId: 'meeting-agent' }
);

// Cancel
await processNaturalCommand(
  'cancel tomorrow\'s deployment',
  { agentId: 'deploy-agent' }
);

// Reschedule
await processNaturalCommand(
  'move friday review to next tuesday',
  { agentId: 'review-agent' }
);

// List
await processNaturalCommand(
  'show me this week\'s tasks',
  { agentId: 'my-agent' }
);
```

### Recurring Tasks

```javascript
// Daily
await scheduleTask({
  date: 'tomorrow at 9am',
  title: 'Daily standup',
  agentId: 'team-agent',
  type: 'recurring',
  recurrence: { pattern: 'daily' }
});

// Weekly (specific days)
await scheduleTask({
  date: 'next Monday at 2pm',
  title: 'Weekly review',
  agentId: 'review-agent',
  type: 'recurring',
  recurrence: {
    pattern: 'weekly',
    daysOfWeek: [1, 3, 5] // Mon, Wed, Fri
  }
});

// Monthly
await scheduleTask({
  date: '1st of next month at 10am',
  title: 'Monthly report',
  agentId: 'report-agent',
  type: 'recurring',
  recurrence: {
    pattern: 'monthly',
    dayOfMonth: 1
  }
});
```

### Task Executors

```javascript
import { registerTaskExecutor } from './lib/schedule/index.js';

// Register executor
registerTaskExecutor('my-agent', async (task) => {
  console.log(`Running: ${task.title}`);
  
  // Do work...
  const result = await doSomething(task.payload);
  
  return { success: true, data: result };
});
```

## 🌐 API Endpoints

### REST API

```bash
# Create task
curl -X POST http://localhost:3001/api/schedule/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "tomorrow at 2pm",
    "title": "Test task",
    "agentId": "test-agent"
  }'

# List tasks
curl http://localhost:3001/api/schedule/tasks?agentId=test-agent \
  -H "Authorization: Bearer $TOKEN"

# Natural language
curl -X POST http://localhost:3001/api/schedule/nlp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "schedule meeting tomorrow at 3pm",
    "context": { "agentId": "test-agent" }
  }'

# Get calendar feed
curl http://localhost:3001/api/schedule/feed/agent/test-agent \
  -H "Authorization: Bearer $TOKEN"
```

### tRPC

```javascript
// In your app
const tasks = await trpc.schedule.getUpcomingTasks.query({
  agentId: 'my-agent',
  limit: 10
});

const result = await trpc.schedule.processNaturalCommand.mutate({
  command: 'cancel all meetings tomorrow',
  context: { agentId: 'meeting-agent' }
});
```

## 📊 Query Examples

```javascript
// Today's tasks
const today = await getUpcomingTasks({
  agentId: 'my-agent',
  from: new Date(),
  to: new Date(new Date().setHours(23, 59, 59))
});

// This week
const weekStart = new Date();
weekStart.setDate(weekStart.getDate() - weekStart.getDay());
const weekEnd = new Date(weekStart);
weekEnd.setDate(weekEnd.getDate() + 6);

const weekTasks = await getUpcomingTasks({
  agentId: 'my-agent',
  from: weekStart,
  to: weekEnd
});

// Specific status
const runningTasks = await getUpcomingTasks({
  status: 'running',
  includeCompleted: true
});
```

## 🔧 Environment Variables

```bash
SCHEDULER_POLL_INTERVAL=60000    # Check every minute
SCHEDULER_BATCH_SIZE=10          # Process 10 tasks at a time
SCHEDULER_TASK_TIMEOUT=300000    # 5 minute timeout
SCHEDULER_AUTO_START=true        # Start on app boot
```

## 🐛 Debugging

```javascript
// Check queue status
const status = await getQueueStatus();
console.log(status);
// {
//   isRunning: true,
//   queue: {
//     ready: 5,      // Tasks ready to run
//     running: 2,    // Currently executing
//     scheduled: 15  // Future tasks
//   }
// }

// View task history
const history = await db.taskHistory
  .find({ taskId: taskId })
  .sort({ timestamp: -1 })
  .toArray();

// Manual execution
await executeTaskManually(taskId, 'manual-trigger');
```

## 📆 Natural Language Examples

```
✅ Supported Commands:
- "schedule daily standup at 9:30am"
- "schedule weekly review every friday at 2pm"
- "cancel tomorrow's deployment"
- "reschedule monday meeting to tuesday at 3pm"
- "move the SEO audit to next week"
- "show me next week's tasks"
- "list all upcoming meetings"
- "what's scheduled for tomorrow?"

❌ Not Yet Supported:
- Time zones: "schedule meeting at 2pm PST"
- Attendees: "schedule meeting with @john"
- Durations: "schedule 2 hour workshop"
- Locations: "schedule meeting in conference room A"
```

## 🔗 Integration Examples

### With Slack Notifications

```javascript
registerTaskExecutor('notification-agent', async (task) => {
  // Send Slack notification when task runs
  await trpc.slack.sendMessage.mutate({
    channel: '#notifications',
    text: `Task completed: ${task.title}`
  });
  
  return { success: true };
});
```

### With Deployment System

```javascript
registerTaskExecutor('deploy-agent', async (task) => {
  const { projectId, environment } = task.payload;
  
  // Trigger deployment
  const job = await createRepoDeployJob({
    projectId,
    environment
  });
  
  return { 
    success: true, 
    jobId: job._id 
  };
});
```

## 💡 Tips

1. **Use descriptive agent IDs**: `seo-agent`, `deploy-agent`, not `agent1`
2. **Include context in titles**: "Weekly SEO Report" not just "Report"
3. **Set reasonable timeouts**: Default 5 min is good for most tasks
4. **Handle errors gracefully**: Tasks that throw will be marked as failed
5. **Use payload for data**: Don't put complex data in the title
6. **Test with natural language**: It's more forgiving than you think!

## 🚨 Common Issues

### "No executor registered"
```javascript
// Fix: Register executor before starting queue
registerTaskExecutor('my-agent', async (task) => {...});
startTaskQueue();
```

### "Task not found"
```javascript
// Fix: Check task exists and use correct ID format
const task = await db.scheduledTasks.findOne({ 
  _id: new ObjectId(taskId) 
});
```

### "Invalid date"
```javascript
// Fix: Use supported formats
✅ "tomorrow at 2pm"
✅ "next Monday"
✅ "in 2 hours"
❌ "sometime next week"
❌ "after lunch"
```