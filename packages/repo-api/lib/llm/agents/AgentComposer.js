import { Agent, createTool } from "@voltagent/core";
import { z } from "zod";
import { BaseAgent } from "./BaseAgent.js";

/**
 * AgentComposer - Combines multiple agents into a composite agent
 * 
 * Features:
 * - Combine multiple specialized agents
 * - Dynamic tool aggregation
 * - Intelligent routing to appropriate subagents
 * - Context sharing between agents
 * - Configurable composition strategies
 */
export class AgentComposer extends BaseAgent {
  constructor(options = {}) {
    super({
      name: options.name || "CompositeAgent",
      description: options.description || "Composite agent with multiple capabilities",
      ...options
    });
    
    this.agents = new Map(); // agent id -> agent instance
    this.routingStrategy = options.routingStrategy || "auto"; // auto, manual, toolBased
    this.delegationTool = null;
  }

  /**
   * Add an agent to the composition
   */
  async addAgent(agent, options = {}) {
    const { 
      id = agent.id, 
      priority = 0,
      toolPrefix = null,
      capabilities = []
    } = options;

    // Initialize the agent if needed
    if (!agent.initialized) {
      await agent.initialize();
    }

    // Store agent with metadata
    this.agents.set(id, {
      agent,
      priority,
      toolPrefix,
      capabilities,
      metadata: agent.getMetadata()
    });

    // If already initialized, we need to rebuild tools
    if (this.initialized) {
      await this.rebuildTools();
    }
  }

  /**
   * Remove an agent from the composition
   */
  removeAgent(id) {
    this.agents.delete(id);
    
    if (this.initialized) {
      this.rebuildTools();
    }
  }

  /**
   * Load tools from all composed agents
   */
  async loadTools() {
    this.tools = [];

    // Add delegation tool if using manual routing
    if (this.routingStrategy === "manual") {
      this.tools.push(this.createDelegationTool());
    }

    // Aggregate tools from all agents
    for (const [id, agentInfo] of this.agents) {
      const { agent, toolPrefix } = agentInfo;
      
      // Get agent's tools
      const agentTools = agent.tools || [];
      
      // Add tools with optional prefix
      for (const tool of agentTools) {
        const modifiedTool = this.wrapAgentTool(tool, agent, toolPrefix);
        this.tools.push(modifiedTool);
      }
    }

    // Add composition management tools
    this.tools.push(...this.createCompositionTools());
  }

  /**
   * Wrap an agent's tool to route execution properly
   */
  wrapAgentTool(tool, agent, prefix = null) {
    const originalName = tool.name;
    const wrappedName = prefix ? `${prefix}_${originalName}` : originalName;

    return createTool({
      name: wrappedName,
      description: tool.description,
      parameters: tool.parameters,
      execute: async (args) => {
        // Route execution to the original agent
        return await agent.executeTool(originalName, args);
      }
    });
  }

  /**
   * Create a delegation tool for manual routing
   */
  createDelegationTool() {
    const agentChoices = Array.from(this.agents.entries()).map(([id, info]) => ({
      id,
      name: info.agent.name,
      description: info.agent.description,
      capabilities: info.capabilities
    }));

    return createTool({
      name: "delegate_to_agent",
      description: "Delegate a task to a specific specialized agent",
      parameters: z.object({
        agentId: z.string().describe("ID of the agent to delegate to"),
        task: z.string().describe("The task or question to delegate"),
        context: z.object({}).optional().describe("Additional context for the agent")
      }),
      execute: async ({ agentId, task, context }) => {
        const agentInfo = this.agents.get(agentId);
        if (!agentInfo) {
          return { error: `Agent ${agentId} not found` };
        }

        // Update agent context if provided
        if (context) {
          agentInfo.agent.updateContext(context);
        }

        // Process the task with the selected agent
        const result = await agentInfo.agent.processMessage(task);
        
        return {
          agentId,
          agentName: agentInfo.agent.name,
          result
        };
      }
    });
  }

  /**
   * Create composition management tools
   */
  createCompositionTools() {
    return [
      createTool({
        name: "list_available_agents",
        description: "List all available specialized agents and their capabilities",
        parameters: z.object({}),
        execute: async () => {
          const agents = Array.from(this.agents.entries()).map(([id, info]) => ({
            id,
            name: info.agent.name,
            description: info.agent.description,
            capabilities: info.capabilities,
            toolCount: info.metadata.toolCount,
            priority: info.priority
          }));

          return { agents };
        }
      }),

      createTool({
        name: "get_agent_tools",
        description: "Get the list of tools available from a specific agent",
        parameters: z.object({
          agentId: z.string().describe("ID of the agent")
        }),
        execute: async ({ agentId }) => {
          const agentInfo = this.agents.get(agentId);
          if (!agentInfo) {
            return { error: `Agent ${agentId} not found` };
          }

          const tools = agentInfo.agent.tools.map(tool => ({
            name: tool.name,
            description: tool.description
          }));

          return { agentId, tools };
        }
      })
    ];
  }

  /**
   * Rebuild tools after agent changes
   */
  async rebuildTools() {
    await this.loadTools();
    
    // Recreate the Volt agent with new tools
    if (this.agent) {
      this.agent = new Agent({
        client: this.voltOpsClient,
        name: this.name,
        description: this.description,
        provider: this.provider,
        tools: this.tools,
      });
    }
  }

  /**
   * Execute a tool - routes to appropriate agent
   */
  async executeTool(toolName, args) {
    // Find which agent owns this tool
    for (const [id, agentInfo] of this.agents) {
      const { agent, toolPrefix } = agentInfo;
      
      // Check if this agent has the tool (accounting for prefix)
      const originalName = toolPrefix && toolName.startsWith(`${toolPrefix}_`) 
        ? toolName.substring(toolPrefix.length + 1)
        : toolName;
        
      const hasTool = agent.tools.some(t => t.name === originalName);
      
      if (hasTool) {
        return await agent.executeTool(originalName, args);
      }
    }

    throw new Error(`Tool ${toolName} not found in any composed agent`);
  }

  /**
   * Process message with routing strategy
   */
  async processMessage(message, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    // For auto routing, analyze message and route to best agent
    if (this.routingStrategy === "auto" && this.agents.size > 0) {
      const bestAgent = await this.selectBestAgent(message);
      if (bestAgent) {
        return await bestAgent.agent.processMessage(message, options);
      }
    }

    // Otherwise use the composite agent with all tools
    return await super.processMessage(message, options);
  }

  /**
   * Select the best agent for a given message
   */
  async selectBestAgent(message) {
    // Simple implementation - can be enhanced with ML/embeddings
    // For now, just check if message mentions agent capabilities
    
    let bestMatch = null;
    let highestPriority = -1;

    for (const [id, agentInfo] of this.agents) {
      const { capabilities, priority } = agentInfo;
      
      // Check if message matches any capabilities
      const matches = capabilities.some(cap => 
        message.toLowerCase().includes(cap.toLowerCase())
      );

      if (matches && priority > highestPriority) {
        bestMatch = agentInfo;
        highestPriority = priority;
      }
    }

    return bestMatch;
  }

  /**
   * Get metadata including composed agents
   */
  getMetadata() {
    const base = super.getMetadata();
    return {
      ...base,
      composedAgents: Array.from(this.agents.entries()).map(([id, info]) => ({
        id,
        name: info.agent.name,
        priority: info.priority,
        capabilities: info.capabilities
      })),
      routingStrategy: this.routingStrategy
    };
  }
}