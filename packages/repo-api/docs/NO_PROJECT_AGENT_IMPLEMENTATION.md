# No-Project Agent Implementation Notes

## Overview

When users engage with editorChat without specifying a project ID, they should get a specialized "Project Navigator" agent that helps them:

1. Understand what projects they have access to
2. Learn about their platform usage
3. Select and switch to a specific project
4. Get general platform assistance

## Implementation Strategy

### 1. Agent Archetype

Create a new archetype in `aiPromptConfigs.js`:

```javascript
AGENT_ARCHETYPES.PROJECT_NAVIGATOR = {
  name: "Project Navigator",
  description:
    "Helps users navigate projects and understand platform capabilities",
  capabilities: [
    "list_projects",
    "search_projects",
    "show_project_details",
    "analyze_user_activity",
    "platform_guidance",
    "switch_to_project",
  ],
  defaultModel: "gpt-4.1-mini",
  temperature: 0.7,
  systemPrompt: generateProjectNavigatorPrompt,
};
```

### 2. Context Injection

The Project Navigator agent needs rich context about:

```javascript
// In UnifiedAgentFactory or editorChat initialization
async function buildProjectNavigatorContext(user, org) {
  // 1. Get user's projects
  const projects = await db.projects
    .find({
      $or: [{ "members.userId": user._id }, { orgId: org._id }],
      deleted: { $ne: true },
    })
    .sort({ updatedAt: -1 })
    .limit(20)
    .toArray();

  // 2. Get user's recent activity
  const recentActivity = await db.editorChats
    .aggregate([
      {
        $match: {
          user: user._id,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
        },
      },
      {
        $group: {
          _id: "$project",
          lastUsed: { $max: "$createdAt" },
          chatCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "projects",
          localField: "_id",
          foreignField: "_id",
          as: "project",
        },
      },
      { $unwind: "$project" },
      { $sort: { lastUsed: -1 } },
      { $limit: 5 },
    ])
    .toArray();

  // 3. Get deployment statistics
  const deploymentStats = await db.deploys
    .aggregate([
      {
        $match: {
          userId: user._id,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: "$projectId",
          deployCount: { $sum: 1 },
          lastDeploy: { $max: "$createdAt" },
          successCount: {
            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
          },
        },
      },
    ])
    .toArray();

  return {
    projects: projects.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      description: p.description,
      visibility: p.visibility,
      lastUpdated: p.updatedAt,
      role: getUserProjectRole(user, p),
      hasRepo: !!p.repoMdProjectId,
      framework: p.framework,
      deploymentEnabled: !!p.deploymentConfig,
    })),
    recentActivity: recentActivity.map((a) => ({
      projectId: a._id.toString(),
      projectName: a.project.name,
      lastUsed: a.lastUsed,
      chatCount: a.chatCount,
    })),
    userStats: {
      totalProjects: projects.length,
      recentlyActiveProjects: recentActivity.length,
      deploymentsLast30Days: deploymentStats.reduce(
        (sum, s) => sum + s.deployCount,
        0
      ),
    },
    suggestions: generateProjectSuggestions(
      projects,
      recentActivity,
      deploymentStats
    ),
  };
}
```

### 3. System Prompt Generation

```javascript
function generateProjectNavigatorPrompt(context) {
  const { projects, recentActivity, userStats, suggestions } = context;

  return `You are a Project Navigator assistant for Repo.md. You help users:
1. Navigate and select from their available projects
2. Understand their platform usage and capabilities
3. Switch to specific projects for detailed work
4. Get started with new projects

## User's Current Context

**Account Overview:**
- Total Projects: ${userStats.totalProjects}
- Recently Active: ${userStats.recentlyActiveProjects} projects
- Deployments (30 days): ${userStats.deploymentsLast30Days}

**Available Projects:**
${projects
  .map(
    (p) => `- **${p.name}** (${p.visibility}): ${
      p.description || "No description"
    }
  - Role: ${p.role}
  - Framework: ${p.framework || "Not specified"}
  - Last Updated: ${formatRelativeTime(p.lastUpdated)}
  - Deployment: ${p.deploymentEnabled ? "Enabled" : "Not configured"}`
  )
  .join("\n")}

**Recent Activity:**
${
  recentActivity.length > 0
    ? recentActivity
        .map(
          (a) =>
            `- ${a.projectName}: Used ${formatRelativeTime(a.lastUsed)} (${
              a.chatCount
            } chats)`
        )
        .join("\n")
    : "No recent activity"
}

**Suggestions:**
${suggestions.join("\n")}

## Your Capabilities

You can help users:
- List and search through their projects
- Show detailed information about specific projects
- Switch to a project context for editing/deployment
- Understand their usage patterns
- Get recommendations on what to work on next

When a user wants to work on a specific project, use the 'switch_to_project' tool to transition them to that project's context.

Always be helpful and guide users to the most relevant project based on their intent.`;
}
```

### 4. Specialized Tools

Create tools specific to the Project Navigator:

```javascript
// In tool catalogue or separate file
export const projectNavigatorTools = {
  list_user_projects: {
    definition: {
      name: "list_user_projects",
      description: "List all projects the user has access to",
      parameters: {
        type: "object",
        properties: {
          filter: {
            type: "string",
            enum: ["all", "owned", "recent", "deployable"],
            description: "Filter projects by criteria",
          },
          limit: {
            type: "number",
            description: "Maximum number of projects to return",
          },
        },
      },
    },
    implementation: async (args, context) => {
      const { user, org } = context;
      // Implementation to list projects with filtering
    },
  },

  switch_to_project: {
    definition: {
      name: "switch_to_project",
      description:
        "Switch to a specific project context for editing/deployment",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "The ID of the project to switch to",
          },
          intent: {
            type: "string",
            enum: ["edit", "deploy", "browse", "general"],
            description: "What the user intends to do with the project",
          },
        },
        required: ["projectId"],
      },
    },
    implementation: async (args, context) => {
      const { projectId, intent } = args;
      const { user, toolExecutor } = context;

      // Verify user has access to project
      const project = await db.projects.findOne({
        _id: new ObjectId(projectId),
        $or: [{ "members.userId": user._id }, { orgId: context.org._id }],
      });

      if (!project) {
        throw new Error("Project not found or access denied");
      }

      // Return special response that tells the client to switch context
      return {
        action: "switch_context",
        projectId: project._id.toString(),
        projectName: project.name,
        intent,
        message: `Switching to ${project.name} for ${intent || "editing"}...`,
      };
    },
  },

  analyze_project_activity: {
    definition: {
      name: "analyze_project_activity",
      description: "Analyze user's activity patterns across projects",
      parameters: {
        type: "object",
        properties: {
          timeframe: {
            type: "string",
            enum: ["today", "week", "month", "all"],
            description: "Timeframe for analysis",
          },
        },
      },
    },
    implementation: async (args, context) => {
      // Analyze user's activity patterns
      // Return insights about most used projects, deployment patterns, etc.
    },
  },

  search_projects: {
    definition: {
      name: "search_projects",
      description:
        "Search through user's projects by name, description, or technology",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query",
          },
          searchIn: {
            type: "array",
            items: { type: "string" },
            description: "Fields to search in",
            default: ["name", "description", "framework", "techStack"],
          },
        },
        required: ["query"],
      },
    },
    implementation: async (args, context) => {
      // Search implementation
    },
  },
};
```

### 5. EditorChat Integration

Update `editorChatVolt.js` to handle no-project scenario:

```javascript
class EditorChatHandlerVolt {
  async initialize() {
    // Existing initialization code...

    // Check if we're in no-project mode
    if (!this.project) {
      this.agentArchetype = "PROJECT_NAVIGATOR";
      this.isProjectNavigator = true;

      // Build navigator context
      this.navigatorContext = await buildProjectNavigatorContext(
        this.user,
        this.org
      );
    }

    // Continue with initialization...
  }

  async createAgent() {
    if (this.isProjectNavigator) {
      // Create specialized agent for project navigation
      this.agent = await UnifiedAgentFactory.createAgent({
        name: "Project Navigator",
        archetype: "PROJECT_NAVIGATOR",
        model: this.model,
        user: this.user,
        org: this.org,
        project: null, // Explicitly no project
        interface: "editorChat",
        sessionId: this.chatId,
        includeProjectContext: false, // Don't try to load project context
        customInstructions: generateProjectNavigatorPrompt(
          this.navigatorContext
        ),
        hooks: {
          onToolEnd: async ({ tool, result }) => {
            // Handle project switching
            if (
              tool.name === "switch_to_project" &&
              result.action === "switch_context"
            ) {
              await this.handleProjectSwitch(result);
            }
          },
        },
      });
    } else {
      // Existing project-specific agent creation
    }
  }

  async handleProjectSwitch(switchResult) {
    // Save the switch intention to the chat
    await editorChatDb.updateOne(
      { _id: new ObjectId(this.chatId) },
      {
        $set: {
          "metadata.switchedToProject": switchResult.projectId,
          "metadata.switchIntent": switchResult.intent,
          "metadata.switchedAt": new Date(),
        },
      }
    );

    // The client should handle this response and reload with the new project context
  }
}
```

### 6. Client-Side Handling

The client needs to handle project switching:

```javascript
// In the client code that processes chat responses
async function processChatResponse(response) {
  // Check for special actions in tool results
  if (response.toolResults) {
    for (const result of response.toolResults) {
      if (result.action === "switch_context") {
        // Handle project switch
        await switchToProject(result.projectId, result.intent);
        return;
      }
    }
  }

  // Normal response processing
}

async function switchToProject(projectId, intent) {
  // Update UI to show project switch
  showNotification(`Switching to project...`);

  // Reload editor with new project context
  window.location.href = `/editor/${projectId}?intent=${intent}`;

  // Or if using SPA, update state
  editorState.setProject(projectId);
  editorState.setIntent(intent);
  await editorState.reinitializeChat();
}
```

### 7. Suggested Behaviors

The Project Navigator should:

1. **Proactively suggest projects** based on user intent:

   - "I want to deploy something" → Show deployable projects
   - "I need to fix a bug" → Show recently active projects
   - "Show me my React projects" → Filter by framework

2. **Remember context** within the session:

   - Track which projects were discussed
   - Understand follow-up questions
   - Maintain conversation flow

3. **Provide helpful information**:

   - Project statistics
   - Last deployment status
   - Collaborator information
   - Quick actions available

4. **Guide new users**:
   - Explain how to create projects
   - Show example commands
   - Offer tutorials

### 8. Example Interactions

```
User: "Show me my projects"
Navigator: "You have 5 projects. Here are your most recently active:
1. **my-blog** (public) - Last used 2 hours ago
2. **api-backend** (private) - Last deployed yesterday
3. **landing-page** (public) - Updated last week
..."

User: "I want to work on the blog"
Navigator: "Switching to my-blog project... [triggers switch_to_project tool]"

User: "Which project did I deploy most recently?"
Navigator: "Your most recent deployment was **api-backend** yesterday at 3:45 PM. The deployment was successful. Would you like to check its status or deploy again?"

User: "Show me projects using React"
Navigator: "[uses search_projects tool] I found 2 projects using React:
1. **my-blog** - A Next.js blog with React
2. **dashboard-ui** - React with TypeScript
..."
```

## Implementation Checklist

- [ ] Add PROJECT_NAVIGATOR archetype to aiPromptConfigs.js
- [ ] Create buildProjectNavigatorContext function
- [ ] Implement projectNavigatorTools
- [ ] Update EditorChatHandlerVolt for no-project mode
- [ ] Add project switching logic
- [ ] Create activity analysis queries
- [ ] Add suggestion generation logic
- [ ] Test with various user scenarios
- [ ] Document the new behavior
- [ ] Update client to handle project switching
