# Slack Background Agents Implementation Plan

## Overview
Implement Background Agents functionality that allows users to trigger code implementation tasks directly from Slack conversations using @mentions with natural language commands.

## Core Components to Implement

### 1. Command Parser (`lib/slack/commandParser.js`)
- Parse @mentions with various command formats
- Extract options: `branch`, `model`, `repo`, `autopr`
- Support bracket format: `@bot [branch=dev, model=o3] fix this`
- Support inline format: `@bot branch=dev model=o3 fix this`
- Handle command keywords: `help`, `settings`, `agent`, `list my agents`

### 2. Agent Manager (`lib/slack/agentManager.js`)
- Create and track background agents/tasks
- Store agent state in MongoDB (`slackAgents` collection)
- Handle agent lifecycle: created → running → completed/failed
- Support follow-up instructions to existing agents
- Manage agent ownership and permissions

### 3. Database Schema Updates
```javascript
// slackAgents collection
{
  _id: ObjectId,
  orgId: ObjectId,
  channelId: String,
  threadTs: String,
  userId: String,
  userName: String,
  status: 'pending' | 'running' | 'completed' | 'failed',
  command: String,
  options: {
    branch: String,
    model: String,
    repo: String,
    autopr: Boolean
  },
  projectId: ObjectId,
  prUrl: String,
  requestId: String,
  createdAt: Date,
  updatedAt: Date,
  completedAt: Date,
  error: String
}

// slackChannelSettings collection
{
  _id: ObjectId,
  orgId: ObjectId,
  channelId: String,
  teamId: String,
  defaults: {
    repository: String,
    branch: String,
    model: String,
    autopr: Boolean
  },
  updatedAt: Date,
  updatedBy: String
}
```

### 4. Response Templates Updates (`lib/slack/responseTemplates.js`)
- `agentStarted`: Show agent is running with "Open in Repo.md" button
- `agentCompleted`: Show PR created with "View PR" button
- `agentFailed`: Show error with retry option
- `helpCommand`: List all available commands
- `settingsModal`: Interactive settings configuration
- `listAgents`: Show user's running agents
- `followUpAdded`: Confirm follow-up instructions added

### 5. Message Handler Enhancements (`lib/slack/messageHandler.js`)
- Detect command patterns in messages
- Route to appropriate handlers
- Check for existing agents in thread
- Handle follow-up vs new agent logic
- Pass full thread context to agent

### 6. Interactive Components Handler (`routes/express/slackRoutes.js`)
- Handle button clicks (Open in Repo.md, View PR)
- Process settings modal submissions
- Handle context menu actions (Add follow-up, Delete agent)
- Implement slash command for settings

### 7. Integration Points
- Mock LLM service calls for agent execution
- Mock PR creation and URL generation
- Project resolution from repo specification
- User permission validation

## Implementation Steps

### Phase 1: Command Parsing & Basic Structure
1. Create `commandParser.js` with regex patterns
2. Add unit tests for various command formats
3. Update `messageHandler.js` to use parser
4. Create basic agent templates

### Phase 2: Agent Management
1. Create `agentManager.js` with CRUD operations
2. Add MongoDB collections and indexes
3. Implement agent status tracking
4. Add agent ownership validation

### Phase 3: Interactive Features
1. Add button handlers for agent actions
2. Implement settings modal
3. Create context menu handlers
4. Add slash command support

### Phase 4: Thread Context & Follow-ups
1. Enhance thread context for agent creation
2. Implement follow-up instruction handling
3. Add agent-in-thread detection
4. Handle multiple agents per thread

### Phase 5: Integration & Polish
1. Mock external service calls
2. Add comprehensive error handling
3. Implement rate limiting
4. Add usage analytics

## Key Features to Implement

### Command Recognition
```javascript
// Patterns to recognize:
"@bot fix this" → Create agent with default settings
"@bot [repo=owner/repo] implement feature" → Specific repo
"@bot agent fix bug" → Force new agent
"@bot settings" → Open settings modal
"@bot list my agents" → Show running agents
```

### Option Parsing
```javascript
// Extract options from various formats:
parseOptions("@bot [branch=dev, model=o3] fix") 
// → { branch: 'dev', model: 'o3' }

parseOptions("@bot branch=main repo=org/repo fix")
// → { branch: 'main', repo: 'org/repo' }
```

### Settings Hierarchy
1. Explicit command options (highest priority)
2. Channel-level defaults
3. User/org defaults
4. System defaults (lowest priority)

### Agent Status Updates
- Initial: "⏳ Creating agent..." 
- Running: "🚀 Agent is working..." + [Open in Repo.md]
- Completed: "✅ PR created!" + [View PR] [View in Repo.md]
- Failed: "❌ Agent failed" + [View Details] [Retry]

## Security Considerations
- Validate user has access to specified repository
- Check org permissions for agent creation
- Rate limit agent creation per user/channel
- Sanitize command inputs
- Audit log all agent actions

## Error Handling
- Invalid repository format
- No repository access
- Agent creation failures
- Network timeouts
- Invalid options
- Quota exceeded

## Success Metrics
- Agent creation success rate
- Average completion time
- User engagement (follow-ups added)
- Error rate by type
- Feature adoption rate