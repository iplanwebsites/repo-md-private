// Comprehensive Tool Catalogue
// Central registry of all available tools with categorization and metadata

import * as fileTools from "./fileTools.js";
import * as githubTools from "./githubTools.js";
import * as searchTools from "./searchTools.js";
import * as analysisTools from "./analysisTools.js";
import * as readOnlySearchTools from "./readOnlySearchTools.js";
import * as deploymentTools from "./deploymentTools.js";
import * as communicationTools from "./communicationTools.js";
import * as agentTools from "./agentTools.js";
import * as weatherTools from "./weather.js";
import * as projectTools from "./projectTools.js";
import * as projectNavigatorTools from "./projectNavigatorTools.js";
import repoMdToolProvider from "./repoMdNativeTools.js";

// Tool metadata enrichment - handle both old and new tool formats
const enrichTool = (tool, category) => {
  // Return null for null tools
  if (!tool) {
    return null;
  }

  // If tool already has toJSON method (new format from createTool)
  if (typeof tool.toJSON === "function") {
    return tool.toJSON();
  }

  // Handle old format tool definitions { type: 'function', function: {...} }
  if (tool.type === "function" && tool.function) {
    return {
      definition: tool.function,
      implementation: null, // Will need to be added separately
      category,
      requiredPermissions: tool.requiredPermissions || [],
      rateLimit: tool.rateLimit || null,
      costEstimate: tool.costEstimate || "low",
      asyncExecution: tool.asyncExecution || false,
    };
  }

  // Handle direct tool format { name, description, parameters, execute }
  if (tool.name && tool.parameters) {
    return {
      definition: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
      implementation: tool.execute || null,
      category,
      requiredPermissions: tool.requiredPermissions || [],
      rateLimit: tool.rateLimit || null,
      costEstimate: tool.costEstimate || "low",
      asyncExecution: tool.asyncExecution || false,
    };
  }

  // Fallback - assume it's already enriched or has a custom format
  return {
    ...tool,
    category,
    requiredPermissions: tool.requiredPermissions || [],
    rateLimit: tool.rateLimit || null,
    costEstimate: tool.costEstimate || "low",
    asyncExecution: tool.asyncExecution || false,
  };
};

// File Management Tools
const FILE_MANAGEMENT_TOOLS = [
  enrichTool(fileTools.createFileTool, "file_management"),
  enrichTool(fileTools.editFileTool, "file_management"),
  enrichTool(fileTools.deleteFileTool, "file_management"),
  enrichTool(fileTools.moveFileTool, "file_management"),
  enrichTool(fileTools.listFilesTool, "file_management"),
  enrichTool(fileTools.readFileTool, "file_management"),
].filter(Boolean);

// Code Analysis Tools
const CODE_ANALYSIS_TOOLS = [
  enrichTool(analysisTools.analyzeCodeStructure, "code_analysis"),
  enrichTool(analysisTools.findDependencies, "code_analysis"),
  enrichTool(analysisTools.detectPatterns, "code_analysis"),
  enrichTool(analysisTools.suggestImprovements, "code_analysis"),
].filter(Boolean);

// Search Tools
const SEARCH_TOOLS = [
  // Commented out to avoid conflicts with content subagent
  // enrichTool(searchTools.searchProjectFiles, "search"),
  // enrichTool(searchTools.searchDocumentation, "search"),
  enrichTool(searchTools.semanticSearch, "search"),
  // enrichTool(readOnlySearchTools.searchProjectReadOnly, "search"),  // This is search_project_files
  enrichTool(readOnlySearchTools.getProjectStructure, "search"),
].filter(Boolean);

// GitHub Integration Tools
const GITHUB_TOOLS = [
  enrichTool(githubTools.createRepository, "github"),
  enrichTool(githubTools.pushToGitHub, "github"),
  enrichTool(githubTools.createPullRequest, "github"),
  enrichTool(githubTools.manageBranches, "github"),
].filter(Boolean);

// Deployment Tools - handle both individual tools and status tools array
const DEPLOYMENT_TOOLS = [
  enrichTool(deploymentTools.deployProject, "deployment"),
  enrichTool(deploymentTools.checkDeploymentStatus, "deployment"),
  enrichTool(deploymentTools.rollbackDeployment, "deployment"),
  enrichTool(deploymentTools.updateEnvironment, "deployment"),
  // Spread the status tools array
  ...(deploymentTools.statusTools || []).map((tool) =>
    enrichTool(tool, "deployment")
  ),
].filter(Boolean);

// Communication Tools
const COMMUNICATION_TOOLS = [
  // Removed sendSlackMessage - handled elsewhere in the system
  // enrichTool(communicationTools.sendSlackMessage, "communication"),
  enrichTool(communicationTools.createNotification, "communication"),
  enrichTool(communicationTools.scheduleMessage, "communication"),
].filter(Boolean);

// Agent Management Tools
const AGENT_TOOLS = [
  enrichTool(agentTools.spawnSpecialistAgent, "agent_spawning"),
  enrichTool(agentTools.delegateTask, "agent_spawning"),
  enrichTool(agentTools.coordinateAgents, "agent_spawning"),
  enrichTool(agentTools.getAgentStatus, "agent_spawning"),
].filter(Boolean);

// Utility Tools (including weather for testing)
const UTILITY_TOOLS = [
  weatherTools.getWeather
    ? enrichTool(weatherTools.getWeather, "utilities")
    : null,
].filter(Boolean);

// Project-specific Tools
const PROJECT_TOOLS = [
  // enrichTool(projectTools.searchProjectPosts, 'project'),
  // enrichTool(projectTools.listProjectMedia, 'project'),
  enrichTool(projectTools.getProjectStats, "project"),
  // enrichTool(projectTools.getProjectFileTree, 'project')
].filter(Boolean);

// Project Navigator Tools (for when no project is selected)
const PROJECT_NAVIGATOR_TOOLS = [
  enrichTool(projectNavigatorTools.list_projects, "project_navigator"),
  enrichTool(projectNavigatorTools.get_project_details, "project_navigator"),
  enrichTool(projectNavigatorTools.switch_to_project, "project_navigator"),
  enrichTool(
    projectNavigatorTools.analyze_project_activity,
    "project_navigator"
  ),
  enrichTool(projectNavigatorTools.deploy_project, "project_navigator"),
].filter(Boolean);

// RepoMD Tools are loaded dynamically via repoMdToolProvider
const REPOMD_TOOLS = [];

// Tool Registry
const TOOL_REGISTRY = {
  file_management: FILE_MANAGEMENT_TOOLS,
  code_analysis: CODE_ANALYSIS_TOOLS,
  search: SEARCH_TOOLS,
  github: GITHUB_TOOLS,
  deployment: DEPLOYMENT_TOOLS,
  communication: COMMUNICATION_TOOLS,
  agent_spawning: AGENT_TOOLS,
  utilities: UTILITY_TOOLS,
  project: PROJECT_TOOLS,
  project_navigator: PROJECT_NAVIGATOR_TOOLS,
  repomd: REPOMD_TOOLS,
};

// Get all tools for a category
const getToolsByCategory = (category) => {
  return TOOL_REGISTRY[category] || [];
};

// Get all available tools
const getAllTools = () => {
  return Object.values(TOOL_REGISTRY).flat();
};

// Get tools filtered by permissions
const getToolsByPermissions = (userPermissions = []) => {
  return getAllTools().filter((tool) => {
    if (!tool.requiredPermissions || tool.requiredPermissions.length === 0) {
      return true;
    }
    return tool.requiredPermissions.every((perm) =>
      userPermissions.includes(perm)
    );
  });
};

// Get tools for specific agent archetype
const getToolsForArchetype = (archetype, capabilities = [], context = {}) => {
  const tools = [];

  console.log("getToolsForArchetype called with:", { archetype, capabilities });

  for (const capability of capabilities) {
    console.log("Processing capability:", capability);
    // Handle both string and object capabilities
    const categoryName =
      typeof capability === "string" ? capability : capability?.name;
    if (!categoryName) {
      console.warn("Invalid capability:", capability);
      continue;
    }
    console.log("Looking for category:", categoryName);

    // Special handling for repomd tools - load dynamically from RepoMD
    if (categoryName === "repomd" && context.project) {
      console.log(
        "Loading native RepoMD tools for project:",
        context.project._id
      );
      // Get native tools from RepoMD asynchronously
      // Note: This is a limitation - we need to handle async tool loading
      // For now, we'll use the static tools but mark this for improvement
      const categoryTools = getToolsByCategory(categoryName);
      tools.push(...categoryTools);
    } else {
      const categoryTools = getToolsByCategory(categoryName);
      console.log(
        `Found ${categoryTools.length} tools for category ${categoryName}`
      );
      tools.push(...categoryTools);
    }
  }

  return tools;
};

// Tool validation
const validateToolExecution = (tool, args, context) => {
  // Check required permissions
  if (tool.requiredPermissions && tool.requiredPermissions.length > 0) {
    const userPermissions = context.user?.permissions || [];
    const hasPermissions = tool.requiredPermissions.every((perm) =>
      userPermissions.includes(perm)
    );

    if (!hasPermissions) {
      return {
        valid: false,
        error: `Missing required permissions: ${tool.requiredPermissions.join(
          ", "
        )}`,
      };
    }
  }

  // Check required context
  if (tool.requiredContext) {
    for (const contextKey of tool.requiredContext) {
      if (!context[contextKey]) {
        return {
          valid: false,
          error: `Missing required context: ${contextKey}`,
        };
      }
    }
  }

  // Validate arguments
  if (tool.definition.parameters) {
    const schema = tool.definition.parameters;
    // Basic validation - could be enhanced with a proper schema validator
    const required = schema.required || [];
    for (const req of required) {
      if (!(req in args)) {
        return {
          valid: false,
          error: `Missing required argument: ${req}`,
        };
      }
    }
  }

  return { valid: true };
};

// Tool search functionality
const searchForTools = (query, options = {}) => {
  const { category, permissions, includeDescription = true } = options;
  let tools = getAllTools();

  // Filter by category
  if (category) {
    tools = tools.filter((tool) => tool.category === category);
  }

  // Filter by permissions
  if (permissions) {
    tools = getToolsByPermissions(permissions);
  }

  // Search by query
  if (query) {
    const lowerQuery = query.toLowerCase();
    tools = tools.filter((tool) => {
      const nameMatch = tool.definition.name.toLowerCase().includes(lowerQuery);
      const descMatch =
        includeDescription &&
        tool.definition.description.toLowerCase().includes(lowerQuery);
      return nameMatch || descMatch;
    });
  }

  return tools;
};

// Export tool definitions for OpenAI function calling
const exportToolDefinitions = (tools) => {
  return tools.map((tool) => ({
    type: "function",
    function: tool.definition,
  }));
};

// Create tool mapping for execution
const createToolMapping = (tools) => {
  const mapping = {};
  for (const tool of tools) {
    mapping[tool.definition.name] = tool.implementation;
  }
  return mapping;
};

// Named exports
export {
  // Tool collections
  TOOL_REGISTRY,
  FILE_MANAGEMENT_TOOLS,
  CODE_ANALYSIS_TOOLS,
  SEARCH_TOOLS,
  GITHUB_TOOLS,
  DEPLOYMENT_TOOLS,
  COMMUNICATION_TOOLS,
  AGENT_TOOLS,
  UTILITY_TOOLS,
  PROJECT_TOOLS,
  PROJECT_NAVIGATOR_TOOLS,
  REPOMD_TOOLS,

  // Functions
  getToolsByCategory,
  getAllTools,
  getToolsByPermissions,
  getToolsForArchetype,
  validateToolExecution,
  searchForTools,
  exportToolDefinitions,
  createToolMapping,
};

// Individual tool access
export const tools = {
  file: fileTools,
  github: githubTools,
  search: searchTools,
  analysis: analysisTools,
  readOnly: readOnlySearchTools,
  deployment: deploymentTools,
  communication: communicationTools,
  agent: agentTools,
  weather: weatherTools,
  project: projectTools,
  projectNavigator: projectNavigatorTools,
  repoMd: repoMdToolProvider,
};
