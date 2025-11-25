# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

```bash
# Start the development server with auto-reload
npm run dev

# Start the production server
npm run start

# Deploy to production
npm run push
```

### Content Management

```bash
# Refresh blog content from obsidian-parser
npm run blog

# Build parser and convert content only
npm run b

# Refresh Airtable data
npm run airtable
# or shorthand
npm run at

# Full update cycle (blog, airtable, commit, deploy)
npm run update
```

### Utilities

```bash
# Update repo-md package
npm run up

# Test instructor embeddings
npm run instructor

# Start ngrok tunnel for local development
npm run t
```

### GitHub Webhook Testing

For testing GitHub webhooks locally, use ngrok to create a tunnel and webhook simulation endpoints.

#### Setup Ngrok Tunnel

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **In another terminal, start ngrok tunnel:**
   ```bash
   npm run t
   # This creates a tunnel to localhost:3001
   ```

3. **Configure GitHub webhook URL:**
   - Go to your GitHub repository → Settings → Webhooks
   - Add webhook URL: `https://your-ngrok-url.ngrok.io/api/github/webhook`
   - Content type: `application/json`
   - Events: Select "Push events" or "Send me everything"

#### Enable Debug Mode

Set environment variable for enhanced logging:
```bash
DEBUG_WEBHOOKS=true npm run dev
```

#### Webhook Simulation Endpoints

When `DEBUG_WEBHOOKS=true` or `NODE_ENV=development`, these endpoints are available:

**List simulation options:**
```bash
GET /api/github/webhook/simulate/options
```

**Simulate push webhook:**
```bash
POST /api/github/webhook/simulate/push
Content-Type: application/json

{
  "repoFullName": "owner/repo-name",
  "repoBranch": "main",
  "commitId": "abc123def456",
  "commitMessage": "Test commit message",
  "pusherName": "developer-name",
  "pusherEmail": "dev@example.com"
}
```

#### Testing Workflow

1. **Test webhook endpoint health:**
   ```bash
   curl http://localhost:3001/api/github/webhook/health
   ```

2. **Simulate a webhook locally:**
   ```bash
   curl -X POST http://localhost:3001/api/github/webhook/simulate/push \
     -H "Content-Type: application/json" \
     -d '{
       "repoFullName": "myorg/myrepo",
       "repoBranch": "feature/test",
       "commitId": "test123",
       "commitMessage": "Testing webhook simulation"
     }'
   ```

3. **Test with ngrok tunnel:**
   ```bash
   curl -X POST https://your-ngrok-url.ngrok.io/api/github/webhook/simulate/push \
     -H "Content-Type: application/json" \
     -d '{"repoFullName": "your-org/your-repo"}'
   ```

#### Webhook Callback URLs in Development

When `USE_DEV_CLOUDRUN_WORKER=true`, the system will use development-specific callback URLs:

1. **Set your development backend URL:**
   ```bash
   # For local testing
   BACKEND_URL_DEV=http://localhost:3001
   
   # For ngrok tunnel testing
   BACKEND_URL_DEV=https://your-ngrok-url.ngrok.io
   ```

2. **How it works:**
   - When the worker processes a job, it sends results back to the callback URL
   - In development mode, the callback URL uses `BACKEND_URL_DEV` instead of the production URL
   - This ensures the worker can reach your local development server through ngrok

3. **Example flow:**
   - GitHub sends webhook to `https://your-ngrok-url.ngrok.io/api/github/webhook`
   - API creates a job and sends it to the worker
   - Worker processes the job and calls back to `https://your-ngrok-url.ngrok.io/api/cloudrun/callback`
   - Your local server receives the callback and updates the job status

#### Monitoring Webhook Events

Use the tRPC admin endpoints to monitor webhook processing:
- View webhook events in the database via admin UI
- Check `gitEvents` collection for stored webhook data
- Monitor console logs for detailed processing information

## Architecture Overview

This is a Node.js Express API for the Repo.md platform that handles repository management, document processing, and AI integrations. The application uses a hybrid architecture combining Express REST APIs with tRPC for type-safe communication.

### Core Components

1. **Hybrid API Layer** - Combines Express REST routes (`/api/*`, `/auth/*`, `/v1/*`) for webhooks and public APIs with tRPC procedures (`/trpc/*`) for type-safe client-server communication.

2. **MongoDB Database** - Document-based storage with structured collections for users, projects, jobs, organizations, and deployment records. Connection managed in `db.js` with automatic indexing.

3. **Asynchronous Job System** - Core pattern for handling long-running repository operations:

   - Job creation → Worker dispatch → Status callbacks → Result processing
   - Supports HTTP-based worker service with Google Cloud Run fallback
   - Job types: `clone-repo`, `import-repo`, `deploy-repo`
   - Development simulation mode available

4. **Authorization Middleware Chain** - Composable security with hierarchical permissions:
   - Base: JWT token validation
   - System roles: Admin, Editor access
   - Resource-based: Project-specific permissions (Owner > Admin > Editor > Viewer)

### Key Integrations

1. **GitHub Integration** - OAuth flow, webhook processing, and per-user token management with system token fallback
2. **Content Processing Pipeline** - Obsidian-parser integration for converting Markdown wikis to JSON with embedded media handling
3. **AI Services** - OpenAI integration with caching layer (`llmApiCache`, `dalleApiCache`) and proxy support
4. **Cloudflare R2** - Asset storage for processed media and static files
5. **Brevo/Email Services** - Transactional email with template system

## Environment Setup

The application requires several environment variables to function correctly. Refer to `.env.example` for the required variables:

```
# Core Configuration
PORT=3001
NODE_ENV=development
API_BASE_URL=http://localhost:3001

# Database
MONGODB_URI=mongodb://localhost:27017/repo-md

# JWT Authentication
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=30d

# GitHub Integration
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_ACCESS_TOKEN=your_github_access_token

# Repo Worker Configuration
REPO_WORKER_API_URL=http://localhost:8080
USE_DEV_CLOUDRUN_WORKER=true
GOOGLE_CLOUD_PROJECT=your-gcp-project
GOOGLE_CLOUD_REGION=us-central1

# Backend URL Configuration
BACKEND_URL=https://api.repo.md
BACKEND_URL_DEV=http://localhost:3001  # Set to your ngrok URL for local webhook testing

# Weather Configuration
# Uses Open-Meteo API (free, no API key required)
USE_MOCK_WEATHER_DATA=false  # Set to 'true' for testing with mock data
```

## Repo Worker Integration

A key part of the architecture is the Repo Worker system, which handles repository operations asynchronously:

1. **Job Lifecycle**:

   - User requests repository operation
   - API creates job record in database
   - Worker processes job asynchronously
   - Worker sends results to callback endpoint
   - API updates job status

2. **Worker Tasks**:

   - `clone-repo` (maps to `acquire-user-repo` in worker)
   - `import-repo` (maps to `process-with-repo` in worker)
   - `deploy-repo` (maps to `deploy-repo` in worker)

3. **Development Mode**:
   - When `NODE_ENV=development` and no worker API is configured, the system simulates job execution

## MongoDB Collections

The system uses these MongoDB collections:

- `users` - User accounts
- `projects` - Repository projects
- `jobs` - Async processing jobs
- `orgs` - Organizations
- `deploys` - Deployment records
- `r2` - Cloudflare R2 related data
- `scheduledTasks` - AI agent scheduled tasks
- `taskHistory` - Task execution history

## Code Style & Linting

The project uses Biome for code formatting and linting:

- **Formatter**: Tab indentation, double quotes for JavaScript
- **Import organization**: Enabled
- **Linting**: Recommended rules enabled

**Note**: The project configuration specifies "dont run linting" - respect this preference in development.

## Development Patterns

### tRPC Procedure Structure

```javascript
// Base → Protected → Role-specific → Resource-specific
procedure → protectedProcedure → adminProcedure
                              → projectProcedure → projectAdminProcedure
```

### Job Processing Pattern

1. Create job record in MongoDB with "pending" status
2. Dispatch to worker service with callback URL
3. Worker processes asynchronously and calls back with results
4. API updates job status and processes results

### Error Handling

- Sentry integration for automatic error tracking
- Structured logging with job IDs and context
- tRPC error mapping with proper HTTP status codes

## Slack Integration

The platform includes a Slack integration that allows organizations to:
- Connect their Slack workspace to receive notifications
- Configure which channels receive deployment, error, and general notifications
- Use the `/projects` slash command to list organization projects

### Environment Variables for Slack
```bash
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_SIGNING_SECRET=your_slack_signing_secret
SLACK_BOT_TOKEN=your_slack_bot_token
SLACK_STATE_SECRET=your_slack_state_secret
USE_SLACK_DEV=true  # Set to true for local development with ngrok

# Development URLs (used when USE_SLACK_DEV=true)
API_BASE_URL_DEV=http://localhost:5599
API_BASE_URL_DEV_TUNEL=https://your-ngrok-url.ngrok-free.app  # Update after each ngrok restart
```

### Slack Development Setup
1. When `USE_SLACK_DEV=true`, the system uses development URLs in this priority:
   - `API_BASE_URL_DEV_TUNEL` if set (for ngrok tunnels)
   - `API_BASE_URL_DEV` if set (for local development)
   - Falls back to `http://localhost:PORT`
2. Configure your Slack app's redirect URL to match your ngrok tunnel:
   - `https://your-ngrok-url.ngrok-free.app/api/slack/callback`
3. Update `API_BASE_URL_DEV_TUNEL` each time ngrok restarts with a new URL
4. The `/projects` command and event subscriptions work through the ngrok tunnel

### Slack API Endpoints
- **OAuth Flow**: `/api/slack/install`, `/api/slack/callback`
- **Events/Commands**: `/api/slack/events`
- **Health Check**: `/api/slack/health`

### Required Slack Bot Token Scopes
- `chat:write` - Post messages to channels
- `commands` - Handle slash commands
- `users:read` - Access user information
- `users:read.email` - Access user email addresses
- `channels:read` - List and read public channels
- `groups:read` - List and read private channels

### tRPC Procedures
All Slack operations are available through `trpc.slack.*`:
- `getInstallationStatus` - Check if Slack is connected
- `generateInstallUrl` - Get OAuth installation URL
- `uninstall` - Remove Slack integration
- `configureChannels` - Set notification channels
- `getChannels` - List available Slack channels
- `testNotification` - Send a test message
- `getConversations` - Retrieve conversation history
- `sendMessage` - Send a message to Slack

## AI Agent Scheduling System

The platform includes a comprehensive scheduling system for AI agents with natural language processing:

### Features
- **Natural Language Commands**: Schedule tasks using plain English (e.g., "schedule SEO review next Monday at 2pm")
- **Recurring Tasks**: Support for daily, weekly, monthly patterns
- **Calendar Feeds**: iCal integration for calendar apps
- **Task Queue**: Automatic execution of scheduled tasks

### API Endpoints
- **REST API**: `/api/schedule/*`
  - `POST /api/schedule/tasks` - Create scheduled task
  - `GET /api/schedule/tasks` - List upcoming tasks
  - `POST /api/schedule/nlp` - Process natural language commands
  - `GET /api/schedule/feed/:type/:id` - Get calendar feed

### tRPC Procedures
All scheduling operations are available through `trpc.schedule.*`:
- `scheduleTask` - Create a new scheduled task
- `getUpcomingTasks` - Get upcoming tasks with filters
- `processNaturalCommand` - Process natural language scheduling
- `generateCalendarFeed` - Generate iCal/JSON feeds
- `cancelTask` - Cancel a scheduled task
- `rescheduleTask` - Change task date/time

### Environment Variables
```bash
# Task queue configuration
SCHEDULER_POLL_INTERVAL=60000      # Polling interval (default: 1 minute)
SCHEDULER_BATCH_SIZE=10            # Tasks per batch
SCHEDULER_TASK_TIMEOUT=300000      # Task timeout (5 minutes)
SCHEDULER_AUTO_START=true          # Auto-start queue on app start
```

### Documentation
For detailed implementation and usage documentation, see:
- **Feature Documentation**: `/docs/SCHEDULING_FEATURE.md`
- **Implementation Summary**: `/lib/schedule/IMPLEMENTATION_SUMMARY.md`
- **API Examples**: `/lib/schedule/README.md`
- **Test Script**: `/scripts/testScheduling.js`

### Slack Message Handling Architecture
The Slack integration uses a modular architecture:
- **SlackMessageHandler** (`lib/slack/messageHandler.js`) - Core message processing logic
- **Response Templates** (`lib/slack/responseTemplates.js`) - Expandable response templates
- **Event Router** (`routes/express/slackRoutes.js`) - HTTP endpoint for Slack events
- **Format Helpers** (`lib/slack/formatHelpers.js`) - Utilities for formatting messages and JSON blocks

#### Thread Context Awareness
When the bot is mentioned in an existing conversation:
1. It automatically fetches up to 100 messages from the thread using Slack's API
2. Analyzes the conversation for technical details, issues, and context
3. Provides intelligent responses based on the full conversation history
4. Shows message counts and conversation summaries in responses

This is particularly useful when teams discuss an issue and then mention the bot to implement a solution - the bot has full context of what was discussed.

### Required Slack Scopes for Thread Context
- `app_mentions:read` - Receive @ mentions
- `channels:history` - Read message history in public channels
- `groups:history` - Read message history in private channels
- `im:history` - Read message history in DMs
- `mpim:history` - Read message history in group DMs
