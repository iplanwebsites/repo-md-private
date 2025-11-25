# EditorChat Project Context Integration

This document describes the project context feature for EditorChat, which provides AI agents with comprehensive information about the current project.

## Overview

When an EditorChat session is created with a project context, the AI agent automatically receives:
- Project metadata (name, description, dates)
- Statistics (posts count, media count, deployments)
- GitHub repository information
- Project settings and configuration
- Access to project-specific tools

## Implementation Details

### 1. Project Context Loading

**File**: `lib/llm/projectContext.js`

The `loadProjectContext` function retrieves:
- Basic project information
- Post and media counts
- Deployment history
- Recent job statuses
- GitHub repository details
- Project features and capabilities

### 2. System Prompt Enhancement

The `generateProjectSystemPrompt` function creates a detailed system prompt that includes:

```
You have access to information about the current project: "Project Name"

## Project Information
- Name: Project Name
- Description: Project description
- Created: 1/1/2024
- Last Updated: 1/15/2024
- Last Deployed: 1/20/2024

## Project Statistics
- Total Posts: 25
- Total Media Files: 150
- Deployment Status: Active

## GitHub Repository
- Owner: username
- Repository: repo-name
- Default Branch: main
- URL: https://github.com/username/repo-name

## Available Features
- GitHub
- Deploys
- Blog
- Media
```

### 3. Project-Specific Tools

**File**: `lib/llm/tools/projectTools.js`

#### Available Tools:

1. **search_project_posts**
   - Search blog posts by keyword
   - Returns: title, slug, excerpt, date, author, tags
   - Falls back to database search if blog search unavailable

2. **list_project_media**
   - List media files with filtering options
   - Filter by type: all, image, video, document
   - Returns: filename, type, size, url, metadata

3. **get_project_stats**
   - Comprehensive project statistics
   - Posts by category, media by type
   - Deployment history and success rate
   - Recent job statuses

4. **get_project_file_tree**
   - Placeholder for GitHub file structure
   - Will integrate with GitHub API

### 4. Integration with EditorChat

**Modified**: `lib/llm/editorChat.js`

- Loads project context during initialization
- Injects project system prompt after agent prompts
- Makes project context available to all tools
- Maintains backward compatibility

### 5. Tool Catalogue Update

**Modified**: `lib/llm/tools/catalogue.js`

- Added PROJECT_TOOLS category
- Registered all project-specific tools

### 6. Agent Configuration

**Modified**: `lib/chat/aiPromptConfigs.js`

- Added PROJECT capability
- Updated GENERALIST archetype to include project tools

## Usage

### Backend Integration

```javascript
// Create EditorChat with project context
const handler = new EditorChatHandler({
  user,
  org,
  project, // Include project object
  model: "gpt-4.1-mini",
  temperature: 0.7,
  agentArchetype: "GENERALIST"
});

await handler.initialize(); // Project context loaded automatically
```

### Frontend Usage

```javascript
// Via tRPC
const chat = await trpc.editorChat.create.mutate({
  orgId: "org-handle",
  projectId: "project-id", // Include project ID
  title: "New Chat",
  model: "gpt-4.1-mini"
});

// Send message - AI will have project context
const response = await trpc.editorChat.sendMessage.mutate({
  chatId: chat.id,
  content: "How many posts does this project have?"
});
```

## Example Queries

With project context, users can ask:

1. **Project Information**
   - "What is this project about?"
   - "When was it last updated?"
   - "What's the GitHub repository URL?"

2. **Statistics**
   - "How many posts are there?"
   - "Show me media file statistics"
   - "What's the deployment success rate?"

3. **Content Search**
   - "Find posts about getting started"
   - "Search for documentation about API"
   - "List all image files"

4. **Combined Queries**
   - "Based on the existing posts, what topics should I cover next?"
   - "Compare this project's activity to last month"

## Testing

Run the test suite:
```bash
npm run test:project-context
```

This will:
- Load a real project from the database
- Test project information queries
- Test search functionality
- Test statistics retrieval
- Verify tool execution

## Notes

- Project context is optional - chats work without it
- Tools gracefully handle missing data (e.g., no posts collection)
- Blog search falls back to database search if needed
- All project tools require 'read' permission
- Context is loaded once per chat session for efficiency