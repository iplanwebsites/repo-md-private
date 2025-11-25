# Project Content Agent

The Project Content Agent is a specialized Volt subagent that provides access to project content through the RepoMD SDK. It can be used as a subagent in the editorChat interface to answer questions about project content, articles, media, and more.

## Integration with EditorChat

The projectContentAgent is automatically included as a subagent when you create an EditorChatHandler with a project context. The main agent can delegate content-related queries to this specialized subagent.

### How it Works

1. When EditorChatHandler is initialized with a project, it automatically creates a content subagent
2. The content subagent has access to all native RepoMD tools (50+ tools)
3. The main agent can delegate content queries using the `delegate_task` tool
4. Examples of queries that get delegated:
   - "Find articles about authentication"
   - "Search for posts mentioning API"
   - "What content do we have about GraphQL?"
   - "List all blog posts in the tutorials category"

## Two Approaches

### 1. Native RepoMD Tools (Recommended)
Uses RepoMD's built-in OpenAI function definitions directly. This approach:
- Always stays in sync with RepoMD updates
- Requires less code maintenance
- Provides access to all RepoMD features automatically
- Better performance (no wrapper overhead)

### 2. Custom Wrapper Tools
Creates custom tool definitions that wrap RepoMD functions. This approach:
- Allows custom logic and validation
- Provides consistent error handling
- Can combine multiple RepoMD calls
- Easier to mock for testing

## Overview

The projectContentAgent provides the following capabilities:
- Search articles/posts by keyword, topic, or content
- Retrieve full article content
- List articles with filtering by category, tag, or author
- Access project navigation structure
- Get project metadata and configuration
- List and search media files

## Usage

### Using Native RepoMD Tools (Recommended)

```javascript
import { createProjectContentAgentNative } from './lib/llm/agents/projectContentAgentNative.js';

// Create agent with native RepoMD tools
const agent = await createProjectContentAgentNative({
  project: projectData,
  user: currentUser,
  permissions: ['read']
});

// The agent automatically has all RepoMD tools available
const results = await agent.execute('search', {
  query: 'authentication',
  limit: 10
});
```

### As a Volt Subagent

```javascript
import { createProjectContentAgentNative } from './lib/llm/agents/projectContentAgentNative.js';

// In your Volt agent configuration
const agentConfig = {
  name: 'MyAgent',
  subagents: [
    {
      name: 'content',
      factory: async (context) => await createProjectContentAgentNative({
        project: context.project,
        user: context.user,
        permissions: context.permissions
      })
    }
  ]
};
```

### Standalone Usage

```javascript
// Create a content agent for a specific project
const contentAgent = createProjectContentAgent({
  project: projectData,
  user: currentUser,
  permissions: ['read']
});

// Search for articles
const results = await contentAgent.execute('search_articles', {
  query: 'authentication',
  limit: 10
});

// Get a specific article
const article = await contentAgent.execute('get_article', {
  path: 'tutorials/getting-started'
});
```

## Discovering Available Tools

With native RepoMD tools, the available tools depend on your RepoMD version. To see what tools are available:

```javascript
import RepoMD from 'repo-md';

const repoMd = new RepoMD({ project: 'my-project' });
const toolSpec = repoMd.getOpenAiToolSpec();

console.log('Available tools:');
toolSpec.functions.forEach(func => {
  console.log(`- ${func.name}: ${func.description}`);
});
```

## Common RepoMD Tools

These are typically available (exact names may vary by RepoMD version):

### search_articles
Search for articles/posts in the project by keyword, title, or content.

**Parameters:**
- `query` (string, required): Search query
- `limit` (number, optional): Maximum results (default: 10)

**Example:**
```javascript
await agent.execute('search_articles', {
  query: 'pizza recipes',
  limit: 5
});
```

### get_article
Get the full content of a specific article by path or slug.

**Parameters:**
- `path` (string, required): Article path or slug
- `format` (string, optional): Content format - 'markdown', 'html', 'plain' (default: 'markdown')

**Example:**
```javascript
await agent.execute('get_article', {
  path: 'blog/2024/my-post',
  format: 'html'
});
```

### list_articles
List articles with optional filtering.

**Parameters:**
- `category` (string, optional): Filter by category
- `tag` (string, optional): Filter by tag
- `author` (string, optional): Filter by author
- `limit` (number, optional): Maximum results (default: 20)
- `offset` (number, optional): Skip articles (default: 0)

**Example:**
```javascript
await agent.execute('list_articles', {
  category: 'tutorials',
  limit: 10
});
```

### get_navigation
Get the project's navigation structure including categories, tags, and sections.

**Parameters:**
- `includeArticleCounts` (boolean, optional): Include article counts (default: true)

**Example:**
```javascript
await agent.execute('get_navigation', {
  includeArticleCounts: true
});
```

### get_project_metadata
Get project metadata and configuration.

**Parameters:** None

**Example:**
```javascript
await agent.execute('get_project_metadata', {});
```

### get_project_media
Get media files used in the project.

**Parameters:**
- `type` (string, optional): Filter by type - 'all', 'image', 'video', 'document', 'audio' (default: 'all')
- `limit` (number, optional): Maximum results (default: 50)

**Example:**
```javascript
await agent.execute('get_project_media', {
  type: 'image',
  limit: 20
});
```

## Integration Examples

### Public Persona Agent
```javascript
// When a user asks "What articles do you have about X?"
const results = await contentSubagent.execute('search_articles', {
  query: userQuery
});
```

### Editor Agent
```javascript
// Help editor understand content structure
const navigation = await contentSubagent.execute('get_navigation', {});
const recentArticles = await contentSubagent.execute('list_articles', {
  limit: 10
});
```

### Chat Interface
```javascript
// Determine intent and use appropriate tool
if (message.includes('find') || message.includes('search')) {
  const results = await contentAgent.execute('search_articles', {
    query: extractQuery(message)
  });
}
```

## Architecture

The projectContentAgent:
1. Uses the RepoMD SDK to access project content
2. Implements the PROJECT_CONTENT archetype from aiPromptConfigs
3. Provides tools through the standard tool catalogue system
4. Can be instantiated with different permission levels
5. Caches RepoMD instances for performance

## Permissions

The agent respects permission levels:
- `read`: Can search and view content
- `write`: Can search, view, and get detailed metadata
- `admin`: Full access to all content and configuration

## Error Handling

All tools return standardized responses:
- Success: `{ success: true, data: {...}, message: "..." }`
- Error: `{ success: false, error: "...", code: "..." }`

The agent handles:
- Missing project context
- Invalid paths or queries
- Permission denied scenarios
- RepoMD SDK initialization failures

## Migrating to Native Tools

If you're currently using custom wrapper tools, here's how to migrate:

### Before (Custom Wrapper):
```javascript
import { createProjectContentAgent } from './projectContentAgent.js';

const agent = createProjectContentAgent(context);
await agent.execute('search_articles', { query: 'test' });
```

### After (Native Tools):
```javascript
import { createProjectContentAgentNative } from './projectContentAgentNative.js';

const agent = await createProjectContentAgentNative(context);
await agent.execute('search', { query: 'test' }); // Note: tool names may differ
```

### Key Differences:
1. **Async Creation**: Native agent creation is async
2. **Tool Names**: Native tools use RepoMD's naming (e.g., 'search' vs 'search_articles')
3. **Tool Discovery**: Use `repoMd.getOpenAiToolSpec()` to see available tools
4. **Direct Access**: You get all RepoMD tools automatically

### Blacklisting Tools:
```javascript
const repoMd = new RepoMD({ project: 'my-project' });
const toolSpec = repoMd.getOpenAiToolSpec({
  blacklistedTools: ['deleteArticle', 'updateArticle'] // Remove write operations
});
```