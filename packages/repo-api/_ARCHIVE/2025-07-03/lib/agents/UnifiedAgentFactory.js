import { Agent, createTool } from "@voltagent/core";
import { z } from "zod";
import { createHeliconeProvider } from "../volt/voltAgentConfig.js";
import { openai } from "@ai-sdk/openai";
import { createAgentConfig } from "../chat/aiPromptConfigs.js";
import { getToolsForArchetype, exportToolDefinitions, createToolMapping } from "../llm/tools/catalogue.js";
import ToolExecutor from "../llm/toolExecutor.js";
import { loadProjectContext, generateProjectSystemPrompt } from "../llm/projectContext.js";
import { getAiModelConfig } from "../chat/openaiClient.js";

/**
 * Unified Agent Factory for creating Volt agents across all interfaces
 * Consolidates editorChat, Slack, and PersonaAgent creation
 */
export class UnifiedAgentFactory {
  /**
   * Create a Volt agent with unified configuration
   */
  static async createAgent({
    // Core agent properties
    name,
    purpose,
    archetype = "GENERALIST",
    model = "gpt-4.1-mini",
    
    // Context
    user,
    org,
    project = null,
    
    // Interface-specific
    interface = "generic", // "editorChat", "slack", "public", "persona"
    sessionId = null,
    
    // Options
    includeProjectContext = true,
    metadata = {},
    subAgents = [],
    hooks = {}
    
    // Advanced options
    temperature = 0.7,
    maxTokens = null,
    tools = null, // Override archetype tools if provided
    customInstructions = null, // Additional instructions to append
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
        session: {
          id: sessionId,
          type: interface,
        },
      },
    });

    // Get tools for archetype (unless custom tools provided)
    const availableTools = tools || await getToolsForArchetype(archetype, {
      user,
      org,
      project,
      auth: !!user,
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
      },
      availableTools,
    });

    // Convert tools to Volt format with proper execution binding
    const voltTools = this.convertToVoltTools(
      agentConfig.tools || availableTools, 
      toolExecutor, 
      {
        user,
        org,
        project,
        sessionId,
        interface,
      }
    );

    // Build instructions
    let instructions = this.buildInstructions(agentConfig);
    
    // Add project context if requested and available
    if (includeProjectContext && project) {
      try {
        const projectContext = await loadProjectContext(project._id);
        if (projectContext) {
          instructions += "\n\n" + generateProjectSystemPrompt(projectContext);
        }
      } catch (error) {
        console.warn("Failed to load project context:", error);
      }
    }
    
    // Append custom instructions if provided
    if (customInstructions) {
      instructions += "\n\n" + customInstructions;
    }

    // Get model configuration
    const modelConfig = getAiModelConfig(model);

    // Create the agent with all configurations
    return new Agent({
      name: name || `${archetype} Agent`,
      purpose: purpose || agentConfig.purpose || `${archetype} agent for ${interface}`,
      instructions,
      llm: createHeliconeProvider(),
      model: openai(modelConfig.model),
      tools: voltTools,
      markdown: true,
      memory: false, // Disable SQLite memory
      subAgents,
      hooks: {
        ...hooks,
        // Add default hooks for tracking
        onStart: (params) => {
          console.log(`[${interface}] Agent ${name} started`);
          if (hooks.onStart) hooks.onStart(params);
        },
        onEnd: (params) => {
          console.log(`[${interface}] Agent ${name} completed`);
          if (hooks.onEnd) hooks.onEnd(params);
        },
      },
      metadata: {
        ...metadata,
        interface,
        archetype,
        projectId: project?._id?.toString(),
        userId: user?._id?.toString(),
        orgId: org?._id?.toString(),
        sessionId,
        createdAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Convert tool definitions to Volt format with Zod schemas
   */
  static convertToVoltTools(tools, toolExecutor, context) {
    if (!Array.isArray(tools)) {
      console.warn("No tools provided for conversion");
      return [];
    }

    return tools.map(tool => {
      const toolDef = tool.definition || tool.function || tool;
      const implementation = tool.implementation || tool.execute;
      
      if (!toolDef.name || !implementation) {
        console.warn("Invalid tool structure:", tool);
        return null;
      }

      return createTool({
        name: toolDef.name,
        description: toolDef.description || "No description provided",
        parameters: this.parseParametersToZod(toolDef.parameters),
        execute: async (args) => {
          try {
            // Execute with full context
            const result = await implementation(args, {
              ...context,
              toolExecutor,
            });
            
            // Track successful execution
            if (context.interface === "slack") {
              console.log(`[Slack] Tool ${toolDef.name} executed successfully`);
            }
            
            return result;
          } catch (error) {
            console.error(`Tool ${toolDef.name} execution failed:`, error);
            throw error;
          }
        },
      });
    }).filter(Boolean);
  }

  /**
   * Parse OpenAI-style parameters to Zod schemas
   */
  static parseParametersToZod(parameters) {
    if (!parameters || !parameters.properties) {
      return z.object({});
    }
    
    const zodSchema = {};
    
    for (const [key, prop] of Object.entries(parameters.properties)) {
      let schema = this.convertPropertyToZod(prop);
      
      // Apply description if available
      if (prop.description) {
        schema = schema.describe(prop.description);
      }
      
      // Handle required fields
      if (parameters.required && parameters.required.includes(key)) {
        zodSchema[key] = schema;
      } else {
        zodSchema[key] = schema.optional();
      }
    }
    
    return z.object(zodSchema);
  }

  /**
   * Convert individual property to Zod schema
   */
  static convertPropertyToZod(prop) {
    switch (prop.type) {
      case 'string':
        if (prop.enum) {
          return z.enum(prop.enum);
        }
        return z.string();
        
      case 'number':
        return z.number();
        
      case 'integer':
        return z.number().int();
        
      case 'boolean':
        return z.boolean();
        
      case 'array':
        if (prop.items) {
          return z.array(this.convertPropertyToZod(prop.items));
        }
        return z.array(z.any());
        
      case 'object':
        if (prop.properties) {
          const nestedSchema = {};
          for (const [nestedKey, nestedProp] of Object.entries(prop.properties)) {
            nestedSchema[nestedKey] = this.convertPropertyToZod(nestedProp);
          }
          return z.object(nestedSchema);
        }
        return z.object({});
        
      default:
        return z.any();
    }
  }

  /**
   * Build instructions from agent config
   */
  static buildInstructions(agentConfig) {
    if (!agentConfig.prompts) {
      return "You are a helpful AI assistant.";
    }
    
    const systemPrompts = agentConfig.prompts.filter(m => m.role === "system");
    return systemPrompts.map(p => p.content).join("\n\n");
  }


  /**
   * Create a lightweight agent for specific tasks
   */
  static async createTaskAgent({
    task,
    model = "gpt-4.1-mini",
    temperature = 0.3,
    ...options
  }) {
    const taskConfigs = {
      'command_parser': {
        name: "Command Parser",
        archetype: "COMMAND_PARSER",
        instructions: "You are a command parsing assistant. Extract intent and entities from user messages.",
      },
      'code_reviewer': {
        name: "Code Reviewer",
        archetype: "CODE_REVIEWER",
        instructions: "You are a code review assistant. Analyze code for issues and suggest improvements.",
      },
      'deployment': {
        name: "Deployment Assistant",
        archetype: "DEPLOYMENT_SPECIALIST",
        instructions: "You are a deployment assistant. Help with deployment tasks and configurations.",
      },
    };
    
    const config = taskConfigs[task] || {
      name: "Task Assistant",
      archetype: "GENERALIST",
      instructions: "You are a helpful task assistant.",
    };
    
    return this.createAgent({
      ...config,
      model,
      temperature,
      includeProjectContext: false,
      ...options,
    });
  }
}