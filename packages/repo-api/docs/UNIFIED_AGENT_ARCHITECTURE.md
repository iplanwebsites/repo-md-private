# Unified Agent Architecture Plan

## Overview

This document outlines the plan to consolidate editorChat and Slack message handlers with the PersonaAgent architecture, enabling consistent LLM-based natural language processing across all interfaces.

## Current State Analysis

### EditorChat (Volt Implementation)

- **Strengths**:
  - Full Volt Agent integration with tool execution
  - Project context awareness
  - Streaming support
  - File tracking capabilities
  - Tool permission system
  - Agent archetype system

### Slack Message Handler

- **Strengths**:
  - Command parsing structure
  - Thread context awareness
  - Agent archetype detection
  - Tool loading infrastructure
- **Limitations**:
  - No actual LLM integration (mocked execution)
  - No real tool execution
  - No streaming support
  - Limited natural language understanding

### Shared Components

- Tool catalogue system (`lib/llm/tools/catalogue.js`)
- Agent archetype configuration (`lib/chat/aiPromptConfigs.js`)
- Tool executor infrastructure (`lib/llm/toolExecutor.js`)

## Proposed Architecture

### 1. Base Agent Factory

Create a unified agent factory that both editorChat and Slack can use:

```javascript
// lib/agents/UnifiedAgentFactory.js
import { Agent } from "@voltagent/core";
import { createHeliconeProvider } from "../volt/voltAgentConfig.js";
import { openai } from "@ai-sdk/openai";
import { createAgentConfig } from "../chat/aiPromptConfigs.js";
import {
  getToolsForArchetype,
  exportToolDefinitions,
  createToolMapping,
} from "../llm/tools/catalogue.js";
import ToolExecutor from "../llm/toolExecutor.js";
import {
  loadProjectContext,
  generateProjectSystemPrompt,
} from "../llm/projectContext.js";

export class UnifiedAgentFactory {
  static async createAgent({
    // Common parameters
    name,
    archetype = "GENERALIST",
    model = "gpt-4.1-mini",

    // Context
    user,
    org,
    project = null,

    // Interface-specific
    interface = "generic", // "editorChat", "slack", "public"
    sessionId = null,

    // Options
    includeProjectContext = true,
    permissions = null,
    metadata = {},
    subAgents = [],
    hooks = {},
  }) {
    // Initialize tool executor
    const toolExecutor = new ToolExecutor({
      context: {
        user,
        org,
        project,
        sessionId,
        agentArchetype: archetype,
        agentId: `${interface}_${sessionId || Date.now()}`,
        auth: !!user,
        permissions: permissions || this.getDefaultPermissions(user, project),
        session: {
          id: sessionId,
          type: interface,
        },
      },
    });

    // Get tools for archetype
    const availableTools = await getToolsForArchetype(archetype, {
      user,
      org,
      project,
      auth: !!user,
      permissions: permissions || this.getDefaultPermissions(user, project),
    });

    // Create agent config
    const agentConfig = createAgentConfig({
      interface,
      archetype,
      context: {
        user,
        org,
        project,
        auth: !!user,
        permissions: permissions || this.getDefaultPermissions(user, project),
      },
      availableTools,
    });

    // Convert tools to Volt format
    const voltTools = this.convertToVoltTools(agentConfig.tools, toolExecutor, {
      user,
      org,
      project,
      sessionId,
    });

    // Build instructions
    let instructions = this.buildInstructions(agentConfig);

    // Add project context if requested
    if (includeProjectContext && project) {
      const projectContext = await loadProjectContext(project._id);
      instructions += "\n\n" + generateProjectSystemPrompt(projectContext);
    }

    // Get model configuration
    const modelConfig = getAiModelConfig(model);

    // Create the agent
    return new Agent({
      name,
      purpose: agentConfig.purpose || `${archetype} agent for ${interface}`,
      instructions,
      llm: createHeliconeProvider(),
      model: openai(modelConfig.model),
      tools: voltTools,
      markdown: true,
      subAgents,
      hooks,
      metadata: {
        ...metadata,
        interface,
        archetype,
        projectId: project?._id,
        userId: user?._id,
        orgId: org?._id,
      },
    });
  }

  static convertToVoltTools(tools, toolExecutor, context) {
    // Implementation similar to editorChatVolt.js
    return tools.map((tool) => {
      const toolDef = tool.definition || tool;
      return createTool({
        name: toolDef.name,
        description: toolDef.description,
        parameters: this.parseParametersToZod(toolDef.parameters),
        execute: async (args) => {
          return await tool.implementation(args, {
            ...context,
            toolExecutor,
          });
        },
      });
    });
  }

  static parseParametersToZod(parameters) {
    // Implementation from editorChatVolt.js
    // ... (full implementation)
  }

  static buildInstructions(agentConfig) {
    const systemPrompts = agentConfig.prompts.filter(
      (m) => m.role === "system"
    );
    return systemPrompts.map((p) => p.content).join("\n\n");
  }

  static getDefaultPermissions(user, project) {
    // Implementation from editorChat/Slack
    return {
      read: true,
      write: !!user,
      deploy: !!user && !!project,
      admin: false,
    };
  }
}
```

### 2. Enhanced Slack Message Handler

Update the Slack handler to use real LLM execution:

```javascript
// lib/slack/messageHandlerVolt.js
import { UnifiedAgentFactory } from "../agents/UnifiedAgentFactory.js";
import { SlackMessageHandler } from "./messageHandler.js";

export class SlackMessageHandlerVolt extends SlackMessageHandler {
  /**
   * Execute agent with real LLM and tool support
   */
  async executeAgentWithTools(agent, agentConfig, toolExecutor) {
    try {
      // Update agent status
      await agentManager.updateAgentStatus(agent._id, "running");

      // Create Volt agent
      const voltAgent = await UnifiedAgentFactory.createAgent({
        name: agent.name,
        archetype: agent.archetype,
        model: agent.model || "gpt-4.1-mini",
        user: { _id: agent.userId }, // Minimal user object
        org: this.org,
        project: agent.projectId ? { _id: agent.projectId } : null,
        interface: "slack",
        sessionId: agent._id,
        permissions: agent.permissions,
        metadata: {
          slackThreadTs: agent.threadTs,
          slackChannelId: agent.channelId,
        },
      });

      // Process the prompt
      const response = await voltAgent.generateText(agent.prompt, {
        provider: {
          temperature: 0.7,
          maxTokens: 2000,
        },
      });

      // Update agent with results
      await agentManager.updateAgentStatus(agent._id, "completed", {
        executionTime: Date.now() - agent.createdAt,
        toolsUsed: response.toolCalls?.map((t) => t.toolName) || [],
        response: response.text,
      });

      // Send completion message
      const slackMessage = getTemplate("agentCompleted", {
        agent,
        result: response.text,
      });

      await this.client.chat.postMessage({
        channel: agent.channelId,
        text: slackMessage.text,
        thread_ts: agent.threadTs,
        blocks: slackMessage.blocks,
      });

      return response;
    } catch (error) {
      await agentManager.updateAgentStatus(agent._id, "failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Handle natural language commands
   */
  async handleNaturalLanguage(event, threadContext) {
    // Create a lightweight agent for command parsing
    const commandAgent = await UnifiedAgentFactory.createAgent({
      name: "Slack Command Parser",
      archetype: "COMMAND_PARSER", // New archetype for NL parsing
      model: "gpt-4.1-mini",
      user: { _id: event.user },
      org: this.org,
      interface: "slack",
      includeProjectContext: false,
      hooks: {
        onToolStart: ({ tool }) => {
          console.log(`Slack parsing command with tool: ${tool.name}`);
        },
      },
    });

    // Add command parsing instructions
    const parsePrompt = `
      Parse this Slack message and determine the user's intent:
      "${event.text}"
      
      Context: User is in a Slack workspace for ${this.org.name}.
      Thread has ${threadContext.messageCount} messages.
      
      Identify if this is:
      1. A deployment request (which project?)
      2. A task/implementation request
      3. A question about projects/status
      4. General conversation
      
      Extract key entities like project names, commands, etc.
    `;

    const parseResult = await commandAgent.generateText(parsePrompt);

    // Based on parsing, route to appropriate handler
    return this.routeBasedOnIntent(parseResult, event, threadContext);
  }
}
```

### 3. PersonaAgent Implementation

Implement the PersonaAgent as designed in the orchestration plan:

```javascript
// lib/agents/PersonaAgent.js
import { UnifiedAgentFactory } from "./UnifiedAgentFactory.js";
import { ProjectReadOnlySDK } from "../sdk/ProjectReadOnlySDK.js";

export class PersonaAgentFactory {
  static async createForProject(projectId, options = {}) {
    const project = await db.projects.findOne({ _id: new ObjectId(projectId) });
    const projectSDK = new ProjectReadOnlySDK(projectId);

    // Load project-specific persona configuration
    const personaConfig = await db.personaConfigs.findOne({ projectId });

    // Create persona-specific tools
    const personaTools = [
      this.createProjectSearchTool(projectSDK),
      this.createBrowseFilesTool(projectSDK),
      this.createGetProjectInfoTool(projectSDK),
      this.createAnswerQuestionTool(projectSDK),
      this.createListContentTool(projectSDK),
    ];

    // Use UnifiedAgentFactory to create the agent
    return await UnifiedAgentFactory.createAgent({
      name: personaConfig?.name || `${project.name} Assistant`,
      archetype: "PERSONA", // New archetype for personas
      model: personaConfig?.model || "gpt-4.1-mini",
      interface: "public",
      project,
      includeProjectContext: true,
      permissions: {
        read: true,
        write: false,
        deploy: false,
        admin: false,
      },
      metadata: {
        projectId,
        agentType: "persona",
        isPublic: true,
      },
      // Override with persona-specific instructions
      instructions:
        personaConfig?.instructions ||
        this.generateDefaultInstructions(project),
    });
  }

  static createProjectSearchTool(sdk) {
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

  // ... other tool implementations
}
```

### 4. Unified Tool Execution

Create a shared tool execution layer:

```javascript
// lib/agents/UnifiedToolExecutor.js
import ToolExecutor from "../llm/toolExecutor.js";

export class UnifiedToolExecutor extends ToolExecutor {
  constructor(options) {
    super(options);
    this.interface = options.context.interface;
    this.streamingEnabled = options.streamingEnabled || false;
  }

  async executeWithStreaming(toolName, args, streamCallback) {
    if (!this.streamingEnabled) {
      return super.execute(toolName, args);
    }

    // Stream updates back to the interface
    const onProgress = (update) => {
      if (streamCallback) {
        streamCallback({
          type: "tool_progress",
          toolName,
          update,
        });
      }
    };

    // Execute with progress tracking
    return super.execute(toolName, args, { onProgress });
  }

  // Interface-specific formatting
  formatResultForInterface(result) {
    switch (this.interface) {
      case "slack":
        return this.formatForSlack(result);
      case "editorChat":
        return this.formatForEditor(result);
      default:
        return result;
    }
  }

  formatForSlack(result) {
    // Convert results to Slack-friendly format
    if (typeof result === "object" && result.files) {
      return {
        text: `Found ${result.files.length} files`,
        blocks: result.files.map((f) => ({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `• \`${f.path}\` - ${f.description || "No description"}`,
          },
        })),
      };
    }
    return result;
  }
}
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

- [ ] Create UnifiedAgentFactory
- [ ] Create UnifiedToolExecutor
- [ ] Update voltAgentConfig.js with shared utilities
- [ ] Create base agent archetypes for Slack

### Phase 2: Slack LLM Integration (Week 2)

- [ ] Implement SlackMessageHandlerVolt
- [ ] Add natural language command parsing
- [ ] Replace mock execution with real LLM calls
- [ ] Add streaming support for long operations

### Phase 3: PersonaAgent Foundation (Week 3)

- [ ] Create ProjectReadOnlySDK
- [ ] Implement PersonaAgentFactory
- [ ] Create public API routes
- [ ] Add persona configuration schema

### Phase 4: Integration & Testing (Week 4)

- [ ] Update editorChat to use UnifiedAgentFactory
- [ ] Integrate PersonaAgent as subagent in editorChat
- [ ] Add PersonaAgent support in Slack
- [ ] Create comprehensive tests

### Phase 5: Advanced Features (Ongoing)

- [ ] Cross-agent memory sharing
- [ ] Multi-project coordination
- [ ] Performance optimizations
- [ ] Enhanced natural language understanding

## Benefits

1. **Consistency**: Same agent behavior across all interfaces
2. **Code Reuse**: Shared infrastructure reduces duplication
3. **Natural Language**: Slack gets full NL support
4. **Extensibility**: Easy to add new interfaces
5. **Maintainability**: Single source of truth for agent logic

## Migration Strategy

1. **Parallel Implementation**: Keep existing code while building new
2. **Feature Flags**: Use environment variables to toggle between old/new
3. **Gradual Rollout**: Test with internal team first
4. **Backwards Compatibility**: Ensure existing integrations continue working

## Testing Plan

1. **Unit Tests**: Test each component in isolation
2. **Integration Tests**: Test agent creation and execution flows
3. **Interface Tests**: Test Slack and editorChat separately
4. **End-to-End Tests**: Test complete workflows
5. **Performance Tests**: Ensure no regression in response times

## Success Metrics

1. **Response Accuracy**: NL commands parsed correctly 95%+ of the time
2. **Tool Execution**: All tools work across both interfaces
3. **Performance**: No increase in response latency
4. **User Adoption**: Increased usage of natural language in Slack
5. **Code Reduction**: 30%+ reduction in duplicated code
