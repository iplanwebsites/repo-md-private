import { Agent, createTool } from "@voltagent/core";
import { VercelAIProvider } from "@voltagent/vercel-ai";
import { z } from "zod";
import { PassThrough } from "stream";
import { v4 as uuidv4 } from "uuid";

/**
 * BaseAgent - Foundation for all composable agents
 * 
 * This class provides core functionality that all agents need:
 * - Volt Agent SDK integration
 * - Tool management and conversion
 * - Streaming support
 * - Context management
 * 
 * Agents can be composed by:
 * 1. Extending this class for specialized behavior
 * 2. Using AgentComposer to combine multiple agents
 * 3. Dynamically adding tools and capabilities
 */
export class BaseAgent {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.name = options.name || "BaseAgent";
    this.description = options.description || "Base agent with core functionality";
    this.tools = [];
    this.context = options.context || {};
    this.voltOpsClient = options.voltOpsClient;
    this.provider = options.provider;
    this.agent = null;
    this.initialized = false;
  }

  /**
   * Initialize the agent
   */
  async initialize() {
    if (this.initialized) return;

    // Load tools for this agent
    await this.loadTools();

    // Create the Volt agent
    this.agent = new Agent({
      client: this.voltOpsClient,
      name: this.name,
      description: this.description,
      provider: this.provider,
      tools: this.tools,
    });

    this.initialized = true;
  }

  /**
   * Load tools for this agent - override in subclasses
   */
  async loadTools() {
    // Base implementation - subclasses should override
    // Example: this.tools = await this.getToolsForType();
  }

  /**
   * Add a tool to this agent
   */
  addTool(tool) {
    if (this.initialized) {
      throw new Error("Cannot add tools after initialization");
    }
    this.tools.push(tool);
  }

  /**
   * Add multiple tools
   */
  addTools(tools) {
    tools.forEach(tool => this.addTool(tool));
  }

  /**
   * Convert OpenAI format tool to Volt format
   */
  convertToVoltTool(toolDef) {
    const def = toolDef.function || toolDef;
    
    // Parse parameters to Zod schema
    const parameters = this.parseParametersToZod(def.parameters || {});
    
    return createTool({
      name: def.name,
      description: def.description,
      parameters,
      execute: async (args) => {
        // Execute through the tool executor or custom implementation
        return await this.executeTool(def.name, args);
      }
    });
  }

  /**
   * Parse OpenAI parameters to Zod schema
   */
  parseParametersToZod(params) {
    if (!params.properties) {
      return z.object({});
    }

    const zodSchema = {};
    const required = params.required || [];

    for (const [key, prop] of Object.entries(params.properties)) {
      let schema;
      
      switch (prop.type) {
        case "string":
          schema = z.string();
          if (prop.enum) schema = z.enum(prop.enum);
          break;
        case "number":
          schema = z.number();
          break;
        case "boolean":
          schema = z.boolean();
          break;
        case "array":
          schema = z.array(z.any()); // Simplified for now
          break;
        case "object":
          schema = z.object({}); // Simplified for now
          break;
        default:
          schema = z.any();
      }

      // Add description if available
      if (prop.description) {
        schema = schema.describe(prop.description);
      }

      // Make optional if not required
      if (!required.includes(key)) {
        schema = schema.optional();
      }

      zodSchema[key] = schema;
    }

    return z.object(zodSchema);
  }

  /**
   * Execute a tool - override in subclasses for custom behavior
   */
  async executeTool(toolName, args) {
    throw new Error(`Tool execution not implemented for ${toolName}`);
  }

  /**
   * Process a message with this agent
   */
  async processMessage(message, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const { stream = false, ...otherOptions } = options;

    if (stream) {
      return await this.streamMessage(message, otherOptions);
    } else {
      return await this.agent.run(message, otherOptions);
    }
  }

  /**
   * Stream a message response
   */
  async streamMessage(message, options = {}) {
    const stream = new PassThrough();
    
    try {
      const response = await this.agent.stream(message, options);
      
      // Pipe the response stream
      for await (const chunk of response) {
        stream.write(JSON.stringify(chunk) + '\n');
      }
      
      stream.end();
    } catch (error) {
      stream.destroy(error);
    }

    return stream;
  }

  /**
   * Get agent metadata
   */
  getMetadata() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      toolCount: this.tools.length,
      initialized: this.initialized
    };
  }

  /**
   * Update context
   */
  updateContext(updates) {
    this.context = { ...this.context, ...updates };
  }

  /**
   * Clone this agent with new options
   */
  clone(options = {}) {
    const ClonedClass = this.constructor;
    return new ClonedClass({
      ...this.context,
      ...options,
      voltOpsClient: this.voltOpsClient,
      provider: this.provider
    });
  }
}