/**
 * Agent Registry - Defines different types of conversational agents
 */

export const AGENT_TYPES = {
  EDITOR: "editor",
  PROJECT: "project",
  PUBLIC_PROJECT: "public_project",
};

export const agentRegistry = {
  [AGENT_TYPES.EDITOR]: {
    name: "Editor Agent",
    description: "Professional development assistant for authenticated users",
    auth: "required",

    // Default system prompt for editor agent
    getSystemPrompt: (context) => {
      return `You are an expert software architect and developer helping users with their projects.

Your capabilities include:
- Creating new projects from scratch
- Modifying existing code
- Answering technical questions
- Suggesting improvements and best practices

Guidelines:
- Write clean, production-ready code
- Follow modern best practices
- Include proper error handling
- Add comments only where necessary
- Be concise and professional

${context.additionalInstructions || ""}`;
    },

    // Available tools for this agent
    tools: ["fileTools", "githubTools", "searchTools"],

    // Model configuration
    modelConfig: {
      model: "gpt-4.1-mini",
      temperature: 0.7,
      maxTokens: 4000,
    },
  },

  [AGENT_TYPES.PROJECT]: {
    name: "Project Agent",
    description: "Project-specific assistant for team members",
    auth: "project_member",

    getSystemPrompt: (context) => {
      const projectInfo = context.projectInfo || {};
      return `You are an AI assistant for the ${projectInfo.name || "project"}.

Project Description: ${projectInfo.description || "No description provided"}
Tech Stack: ${projectInfo.techStack?.join(", ") || "Not specified"}

Your role is to help team members:
- Understand the codebase
- Make modifications and improvements
- Answer questions about the project
- Suggest refactoring opportunities

Always consider the existing code patterns and maintain consistency with the project's style.

${context.additionalInstructions || ""}`;
    },

    tools: ["projectFileTools", "searchTools", "analysisTools"],

    modelConfig: {
      model: "gpt-4.1-mini",
      temperature: 0.5,
      maxTokens: 4000,
    },
  },

  [AGENT_TYPES.PUBLIC_PROJECT]: {
    name: "Public Project Agent",
    description: "Public-facing Q&A assistant",
    auth: "none",

    // User-defined prompt with fallback
    getSystemPrompt: (context) => {
      if (context.customPrompt) {
        return context.customPrompt;
      }

      // Fallback prompt
      const projectInfo = context.projectInfo || {};
      return `You are a helpful assistant for the ${
        projectInfo.name || "project"
      }.

${
  projectInfo.description
    ? `About this project: ${projectInfo.description}`
    : ""
}

You can answer questions about:
- How to use the project
- What features are available
- Technical documentation
- Common issues and solutions

Note: You have read-only access and cannot modify any code.

Please be helpful and friendly in your responses.`;
    },

    // Limited tools for public access
    tools: ["readOnlySearchTools", "docTools"],

    modelConfig: {
      model: "gpt-4.1-mini", // Cheaper model for public use
      temperature: 0.3, // More consistent responses
      maxTokens: 2000, // Limit response length
    },

    // Rate limiting configuration
    rateLimits: {
      messagesPerHour: 20,
      tokensPerHour: 50000,
      maxConversationLength: 50,
    },
  },
};

/**
 * Get agent configuration
 */
export function getAgent(type) {
  const agent = agentRegistry[type];
  if (!agent) {
    throw new Error(`Unknown agent type: ${type}`);
  }
  return agent;
}

/**
 * Check if user has access to use an agent
 */
export async function checkAgentAccess(
  agentType,
  { userId, projectId, isProjectMember }
) {
  const agent = getAgent(agentType);

  switch (agent.auth) {
    case "none":
      return true;

    case "required":
      return !!userId;

    case "project_member":
      return !!userId && !!projectId && isProjectMember;

    default:
      return false;
  }
}

/**
 * Get tools for an agent
 */
export async function getAgentTools(agentType) {
  const agent = getAgent(agentType);
  const tools = [];

  for (const toolType of agent.tools) {
    switch (toolType) {
      case "fileTools":
        const { allFileTools } = await import("../tools/fileTools.js");
        tools.push(...allFileTools);
        break;

      case "githubTools":
        const { allGithubTools } = await import("../tools/githubTools.js");
        tools.push(...allGithubTools);
        break;

      case "searchTools":
        const { allSearchTools } = await import("../tools/searchTools.js");
        tools.push(...allSearchTools);
        break;

      case "projectFileTools":
        const { allProjectFileTools } = await import(
          "../tools/projectFileTools.js"
        );
        tools.push(...allProjectFileTools);
        break;

      case "readOnlySearchTools":
        const { allReadOnlySearchTools } = await import(
          "../tools/readOnlySearchTools.js"
        );
        tools.push(...allReadOnlySearchTools);
        break;

      case "docTools":
        const { allDocTools } = await import("../tools/docTools.js");
        tools.push(...allDocTools);
        break;

      case "analysisTools":
        const { allAnalysisTools } = await import("../tools/analysisTools.js");
        tools.push(...allAnalysisTools);
        break;
    }
  }

  return tools;
}
