/**
 * Project Content Agent using Native RepoMD Tools
 * This version uses RepoMD's built-in OpenAI function definitions
 */

import { createAgentConfig, AGENT_ARCHETYPES } from '../../chat/aiPromptConfigs.js';
import { getRepoMdNativeTools, getRepoMdDirectHandler } from '../tools/repoMdNativeTools.js';
import { exportToolDefinitions } from '../tools/catalogue.js';
import ToolExecutor from '../toolExecutor.js';
import { db } from '../../../db.js';
import RepoMD from 'repo-md';

/**
 * Create a project content agent using native RepoMD tools
 * @param {Object} options - Configuration options
 * @param {Object} options.project - Project context
 * @param {Object} options.user - User context
 * @param {Array} options.permissions - User permissions
 * @returns {Promise<Object>} Agent configuration for Volt
 */
export async function createProjectContentAgent(options = {}) {
  const { project, user, permissions = ['read'] } = options;
  
  if (!project) {
    throw new Error('Project context is required for ProjectContentAgent');
  }
  
  // Create RepoMD instance
  const repoMd = new RepoMD({ projectId: project._id.toString() });
  
  // Get native OpenAI tool specifications from RepoMD
  const toolSpec = repoMd.getOpenAiToolSpec({
    blacklistedTools: [] // You can blacklist tools here if needed
  });
  
  // Create context for the agent
  const context = {
    project,
    user,
    auth: !!user,
    permissions,
    repoMd // Include RepoMD instance in context
  };
  
  // Build system prompt for the agent
  const archetype = 'PROJECT_CONTENT';
  const agentArchetype = AGENT_ARCHETYPES[archetype];
  
  // Create agent configuration
  const agentConfig = createAgentConfig({
    interface: 'volt',
    archetype,
    context,
    availableTools: [] // We'll use native tools instead
  });
  
  // Return Volt-compatible agent configuration
  return {
    name: 'ProjectContentAgent',
    description: agentConfig.prompts[0].content, // System prompt
    tools: toolSpec.functions, // Use RepoMD's native OpenAI function definitions
    execute: async (toolName, args) => {
      try {
        // Execute through RepoMD's native handler
        const result = await repoMd.handleOpenAiRequest({
          function: toolName,
          arguments: args
        });
        
        return {
          success: true,
          data: result,
          message: `Executed ${toolName} successfully`
        };
      } catch (error) {
        console.error(`Error executing RepoMD tool ${toolName}:`, error);
        return {
          success: false,
          error: error.message
        };
      }
    },
    // Additional metadata for Volt
    metadata: {
      archetype,
      capabilities: agentConfig.capabilities.map(c => c.name),
      project: {
        id: project._id.toString(),
        name: project.name,
        slug: project.slug
      },
      nativeTools: true, // Indicates this uses native RepoMD tools
      toolCount: toolSpec.functions.length
    }
  };
}

/**
 * Create a Volt-compatible tool handler using native RepoMD
 */
export function createVoltNativeToolHandler(projectId, context = {}) {
  return async (toolCall) => {
    const { name: toolName, arguments: args } = toolCall;
    
    // Get direct handler
    const handler = await getRepoMdDirectHandler(projectId);
    
    try {
      // Execute through RepoMD directly
      const result = await handler.execute(toolName, args);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };
}

/**
 * Get all available native RepoMD tools for a project
 * This is useful for tool discovery
 */
export async function getProjectContentNativeTools(project) {
  const repoMd = new RepoMD({ project: project.slug || project.name });
  const toolSpec = repoMd.getOpenAiToolSpec();
  
  return toolSpec.functions;
}

/**
 * Create a hybrid agent that combines native RepoMD tools with custom tools
 */
export async function createHybridProjectAgent(options = {}) {
  const { project, user, permissions = ['read'], additionalTools = [] } = options;
  
  if (!project) {
    throw new Error('Project context is required');
  }
  
  // Get native agent configuration
  const nativeAgent = await createProjectContentAgent(options);
  
  // Combine with additional tools if provided
  const allTools = [
    ...nativeAgent.tools,
    ...additionalTools
  ];
  
  return {
    ...nativeAgent,
    name: 'HybridProjectAgent',
    tools: allTools,
    execute: async (toolName, args) => {
      // Check if it's a native RepoMD tool
      const isNativeTool = nativeAgent.tools.some(t => t.name === toolName);
      
      if (isNativeTool) {
        return await nativeAgent.execute(toolName, args);
      }
      
      // Handle additional tools
      const customTool = additionalTools.find(t => t.name === toolName);
      if (customTool && customTool.execute) {
        return await customTool.execute(args, options);
      }
      
      throw new Error(`Tool not found: ${toolName}`);
    }
  };
}

// Export for use in Volt configurations
export default {
  createProjectContentAgent,
  createVoltNativeToolHandler,
  getProjectContentNativeTools,
  createHybridProjectAgent
};