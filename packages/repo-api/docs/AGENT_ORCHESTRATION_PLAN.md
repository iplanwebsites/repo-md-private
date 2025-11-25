# Agent Orchestration Plan for Repo.md

## Overview

This plan outlines the implementation of a hierarchical agent system where each project has a customized "Persona" agent with public-facing functions, and these agents can be nested as sub-agents within editor agents.

## Architecture

### 1. Agent Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                    Supervisor Layer                      │
├─────────────────────────────────────────────────────────┤
│  • ProjectEditorAgent (per project, authenticated)      │
│    - Full read/write access to project                  │
│    - Can delegate to PersonaAgent                       │
│    - Used in EditorChat                                │
│                                                         │
│  • GlobalAssistantAgent (cross-project)                │
│    - Organization-level access                          │
│    - Can coordinate multiple PersonaAgents             │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   SubAgent Layer                        │
├─────────────────────────────────────────────────────────┤
│  • PersonaAgent (per project, public)                   │
│    - Read-only access via SDK                          │
│    - Customizable personality/instructions              │
│    - Public search, browse, Q&A functions              │
│    - Can be accessed directly or via supervisor         │
│                                                         │
│  • SpecializedAgents (optional)                        │
│    - DocumentationAgent                                │
│    - CodeExplainerAgent                                │
│    - SearchAgent                                       │
└─────────────────────────────────────────────────────────┘
```

### 2. PersonaAgent Design

```javascript
// PersonaAgent Factory
class PersonaAgentFactory {
  static async createForProject(projectId, options = {}) {
    const project = await getProjectById(projectId);
    const projectSDK = new ProjectReadOnlySDK(projectId);

    // Load project-specific persona configuration
    const personaConfig = await loadPersonaConfig(projectId);

    const personaTools = [
      createProjectSearchTool(projectSDK),
      createBrowseFilesTool(projectSDK),
      createGetProjectInfoTool(projectSDK),
      createAnswerQuestionTool(projectSDK),
      createListContentTool(projectSDK),
    ];

    return new Agent({
      name: `${project.name} Assistant`,
      purpose:
        personaConfig.purpose || `Public assistant for ${project.name} project`,
      instructions:
        personaConfig.instructions || generateDefaultInstructions(project),
      llm: createHeliconeProvider(),
      model: openai(personaConfig.model || "gpt-4.1-mini"),
      tools: personaTools,
      markdown: true,
      // Custom metadata for identification
      metadata: {
        projectId,
        agentType: "persona",
        isPublic: true,
      },
    });
  }
}
```

### 3. ProjectEditorAgent with SubAgent

```javascript
// ProjectEditorAgent with PersonaAgent as subagent
class ProjectEditorAgentFactory {
  static async createForProject(projectId, user, options = {}) {
    // Create the persona agent for this project
    const personaAgent = await PersonaAgentFactory.createForProject(projectId);

    // Editor tools with full access
    const editorTools = [
      ...getToolsForArchetype("EDITOR", ["read", "write", "deploy"]),
      createAskPersonaAgentTool(), // Custom tool to query persona
    ];

    const projectContext = await loadProjectContext(projectId);

    return new Agent({
      name: `${project.name} Editor`,
      purpose: `Full-access editor agent for ${project.name}`,
      instructions: `
        You are an advanced code editor assistant with full read/write access.
        You have a public persona agent as a subagent that represents the project's public interface.
        
        When asked "what would the public agent say", delegate to the PersonaAgent.
        When asked about public information, you can choose to answer directly or delegate.
        
        ${generateProjectSystemPrompt(projectContext)}
      `,
      llm: createHeliconeProvider(),
      model: openai("gpt-4.1"),
      tools: editorTools,
      subAgents: [personaAgent], // PersonaAgent as subagent
      metadata: {
        projectId,
        agentType: "editor",
        userId: user._id,
      },
    });
  }
}
```

### 4. Read-Only SDK for PersonaAgent

```javascript
// ProjectReadOnlySDK - Safe, read-only access to project data
class ProjectReadOnlySDK {
  constructor(projectId) {
    this.projectId = projectId;
    this.repoMD = null; // Lazy load
  }

  async initialize() {
    if (!this.repoMD) {
      const project = await db.projects.findOne({
        _id: new ObjectId(this.projectId),
      });
      this.repoMD = new RepoMD(project.repoMdProjectId);
      await this.repoMD.ready();
    }
  }

  async searchContent(query, options = {}) {
    await this.initialize();
    return this.repoMD.search(query, {
      limit: options.limit || 10,
      type: options.type || "all",
    });
  }

  async browseFile(path) {
    await this.initialize();
    const file = await this.repoMD.getSourceFile(path);
    if (!file) throw new Error(`File not found: ${path}`);
    return {
      path: file.path,
      content: file.content,
      language: file.language,
      size: file.size,
    };
  }

  async getProjectInfo() {
    const project = await db.projects.findOne({
      _id: new ObjectId(this.projectId),
    });
    return {
      name: project.name,
      description: project.description,
      visibility: project.visibility,
      techStack: project.techStack,
      lastUpdated: project.updatedAt,
      // Exclude sensitive data like tokens, keys, etc.
    };
  }

  async listContent(type = "all", limit = 20) {
    await this.initialize();
    const content = await this.repoMD.getContent({
      type,
      limit,
      includePrivate: false, // Only public content
    });
    return content;
  }
}
```

### 5. Tool Implementations for PersonaAgent

```javascript
// Search tool
function createProjectSearchTool(sdk) {
  return createTool({
    name: "search_project",
    description: "Search for content within the project",
    parameters: z.object({
      query: z.string().describe("Search query"),
      type: z.enum(["all", "docs", "code", "issues"]).optional(),
      limit: z.number().optional().default(10),
    }),
    execute: async ({ query, type, limit }) => {
      const results = await sdk.searchContent(query, { type, limit });
      return {
        success: true,
        results: results.map((r) => ({
          title: r.title,
          path: r.path,
          excerpt: r.excerpt,
          type: r.type,
        })),
      };
    },
  });
}

// Browse files tool
function createBrowseFilesTool(sdk) {
  return createTool({
    name: "browse_file",
    description: "Read the contents of a specific file",
    parameters: z.object({
      path: z.string().describe("File path to read"),
    }),
    execute: async ({ path }) => {
      try {
        const file = await sdk.browseFile(path);
        return {
          success: true,
          file,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  });
}

// Project info tool
function createGetProjectInfoTool(sdk) {
  return createTool({
    name: "get_project_info",
    description: "Get general information about the project",
    parameters: z.object({}),
    execute: async () => {
      const info = await sdk.getProjectInfo();
      return {
        success: true,
        project: info,
      };
    },
  });
}
```

### 6. Public Routes for PersonaAgent

```javascript
// routes/express/publicPersonaRoutes.js
router.post("/projects/:projectSlug/persona/chat", async (req, res) => {
  const { projectSlug } = req.params;
  const { message } = req.body;

  // Find project by slug
  const project = await db.projects.findOne({
    slug: projectSlug,
    visibility: "public",
  });
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  // Create or get cached persona agent
  const personaAgent = await PersonaAgentFactory.createForProject(project._id);

  // Get response
  const response = await personaAgent.generateText(message, {
    provider: {
      temperature: 0.7,
      maxTokens: 1000,
    },
  });

  res.json({
    response: response.text,
    usage: response.usage,
  });
});

// Streaming endpoint
router.post("/projects/:projectSlug/persona/chat/stream", async (req, res) => {
  // Similar but with SSE streaming
  res.writeHead(200, getSSEHeaders());

  const response = await personaAgent.streamText(message);

  if (response.fullStream) {
    for await (const chunk of response.fullStream) {
      // Send SSE events
    }
  }
});
```

### 7. Integration with EditorChat

```javascript
// In EditorChatHandler initialization
async createAgent() {
  // Get project-specific agents
  const personaAgent = await PersonaAgentFactory.createForProject(this.project._id);
  const editorAgent = await ProjectEditorAgentFactory.createForProject(
    this.project._id,
    this.user
  );

  // EditorAgent has PersonaAgent as subagent
  this.agent = editorAgent;
}

// Example usage in chat:
// User: "What would the public docs say about our API?"
// EditorAgent: *delegates to PersonaAgent via delegate_task*
// PersonaAgent: "Based on the public documentation, our API provides..."
// EditorAgent: "The public documentation states: [persona response]"
```

### 8. Persona Configuration Storage

```javascript
// MongoDB schema for persona configuration
const personaConfigSchema = {
  projectId: ObjectId,
  name: String,
  purpose: String,
  instructions: String, // Custom personality/behavior
  model: String, // AI model to use
  temperature: Number,
  publicEndpoints: {
    chat: Boolean,
    search: Boolean,
    browse: Boolean,
  },
  customResponses: {
    greeting: String,
    notFound: String,
    error: String,
  },
  allowedTools: [String], // Which tools this persona can use
  createdAt: Date,
  updatedAt: Date,
};

// API to update persona
router.put(
  "/projects/:projectId/persona",
  projectAdminProcedure,
  async (req, res) => {
    const { instructions, name, model, customResponses } = req.body;

    await db.personaConfigs.updateOne(
      { projectId: new ObjectId(req.params.projectId) },
      {
        $set: {
          instructions,
          name,
          model,
          customResponses,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    res.json({ success: true });
  }
);
```

### 9. Context Sharing Example

```javascript
// When EditorAgent asks PersonaAgent
const editorResponse = await editorAgent.streamText(
  "What would someone browsing our public docs learn about authentication?",
  {
    userContext: new Map([
      ["userId", user._id],
      ["projectId", project._id],
      ["sessionId", chatId],
    ]),
  }
);

// PersonaAgent receives this context and can log/track
const personaAgent = new Agent({
  // ... config ...
  hooks: createHooks({
    onStart: ({ context }) => {
      // Can see it's being called from EditorAgent
      if (context.parentAgentId) {
        console.log(`PersonaAgent called by parent: ${context.parentAgentId}`);
        // Track analytics, rate limits, etc.
      }
    },
  }),
});
```

### 10. Implementation Steps

1. **Phase 1: PersonaAgent Foundation**

   - [ ] Create ProjectReadOnlySDK
   - [ ] Implement PersonaAgentFactory
   - [ ] Create persona-specific tools
   - [ ] Add persona configuration schema

2. **Phase 2: Public API**

   - [ ] Create public persona routes
   - [ ] Add rate limiting
   - [ ] Implement caching for persona agents
   - [ ] Add analytics tracking

3. **Phase 3: SubAgent Integration**

   - [ ] Update EditorChatHandler to use subagents
   - [ ] Create ProjectEditorAgentFactory
   - [ ] Test delegation scenarios
   - [ ] Add context propagation

4. **Phase 4: UI & Configuration**

   - [ ] Create persona configuration UI
   - [ ] Add persona testing interface
   - [ ] Document public API endpoints
   - [ ] Create example integrations

5. **Phase 5: Advanced Features**
   - [ ] Multi-project coordination
   - [ ] Cross-agent memory sharing
   - [ ] Custom tool development
   - [ ] Performance optimization

## Benefits

1. **Clean Separation**: Public personas are isolated from private editor functions
2. **Reusability**: PersonaAgents can be used standalone or as subagents
3. **Customization**: Each project can have its own personality and behavior
4. **Security**: Read-only SDK ensures public agents can't modify data
5. **Scalability**: Agents can be cached and reused across requests
6. **Observability**: Full tracking of agent interactions and delegations

## Example Interactions

### Direct PersonaAgent Access

```
User: "How do I authenticate with this API?"
PersonaAgent: "According to our documentation, you can authenticate using..."
```

### Delegated Access via EditorAgent

```
User: "What would a new user see if they asked about our auth system?"
EditorAgent: "Let me check what our public documentation says..."
[Delegates to PersonaAgent]
PersonaAgent: "To authenticate with our API, you need to..."
EditorAgent: "A new user would see: 'To authenticate with our API...'"
```

### Cross-Project Coordination

```
User: "Compare the auth methods between Project A and Project B"
GlobalAssistant: "I'll check both projects' documentation..."
[Delegates to PersonaAgent A and PersonaAgent B]
GlobalAssistant: "Project A uses OAuth2 while Project B uses API keys..."
```
