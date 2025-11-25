/**
 * Centralized AI Prompt Configuration System
 * Provides a flexible, tool-based prompt structure for all AI agents
 * @module aiPromptConfigs
 */

// Message creation utilities
const createMsg = (content, role = "user", additional = {}) => ({
  role,
  content,
  ...additional,
});

const systemMsg = (content, additional = {}) =>
  createMsg(content, "system", additional);
const userMsg = (content, additional = {}) =>
  createMsg(content, "user", additional);
const assistantMsg = (content, additional = {}) =>
  createMsg(content, "assistant", additional);

// Base traits that can be composed
const TRAITS = {
  CLARIFYING: "Always seeks to understand the full context and requirements",
  QUESTIONING: "Asks specific, targeted questions to eliminate ambiguity",
  SUMMARIZING: "Summarizes understanding before proceeding",
  DELEGATING: "Identifies which specialized agent would best handle the task",
  EXECUTING: "Focuses on completing the assigned task efficiently",
  TOOL_USING: "Uses available tools to accomplish objectives",
  REPORTING: "Reports progress and results clearly",
  ERROR_HANDLING: "Handles errors gracefully with clear explanations",
  ANALYZING: "Examines code structure and patterns thoroughly",
  IDENTIFYING: "Identifies potential improvements and issues",
  RECOMMENDING: "Provides actionable recommendations",
  BEST_PRACTICES: "Considers best practices and conventions",
  PLANNING: "Breaks down complex tasks into manageable steps",
  ASSIGNING: "Assigns tasks to appropriate specialized agents",
  TRACKING: "Tracks progress and dependencies",
  COORDINATING: "Coordinates multi-agent workflows",
};

// Compose behaviors from traits
const AGENT_BEHAVIORS = {
  CLARIFIER: {
    name: "clarifier",
    description: "Clarifies user requirements before delegation",
    traits: [
      TRAITS.CLARIFYING,
      TRAITS.QUESTIONING,
      TRAITS.SUMMARIZING,
      TRAITS.DELEGATING,
    ],
  },
  EXECUTOR: {
    name: "executor",
    description: "Executes specific tasks with available tools",
    traits: [
      TRAITS.EXECUTING,
      TRAITS.TOOL_USING,
      TRAITS.REPORTING,
      TRAITS.ERROR_HANDLING,
    ],
  },
  ANALYZER: {
    name: "analyzer",
    description: "Analyzes code, patterns, and provides insights",
    traits: [
      TRAITS.ANALYZING,
      TRAITS.IDENTIFYING,
      TRAITS.RECOMMENDING,
      TRAITS.BEST_PRACTICES,
    ],
  },
  SCHEDULER: {
    name: "scheduler",
    description: "Plans and schedules tasks across agents",
    traits: [
      TRAITS.PLANNING,
      TRAITS.ASSIGNING,
      TRAITS.TRACKING,
      TRAITS.COORDINATING,
    ],
  },
};

// Tool capability definitions with minimal repetition
const createCapability = (name, description, requiredContext = []) => ({
  name,
  description,
  requiredContext,
});

const TOOL_CAPABILITIES = {
  FILE_MANAGEMENT: createCapability(
    "file_management",
    "Create, read, update, and manage files",
    ["project", "permissions"]
  ),
  CODE_ANALYSIS: createCapability(
    "code_analysis",
    "Analyze code structure, dependencies, and patterns",
    ["project"]
  ),
  SEARCH: createCapability(
    "search",
    "Search through project files and documentation",
    ["project"]
  ),
  COMMUNICATION: createCapability(
    "communication",
    "Communicate with users and other agents",
    ["session"]
  ),
  DEPLOYMENT: createCapability(
    "deployment",
    "Deploy and manage project deployments",
    ["project", "permissions", "auth"]
  ),
  GITHUB: createCapability("github", "Interact with GitHub repositories", [
    "auth",
    "permissions",
  ]),
  AGENT_SPAWNING: createCapability(
    "agent_spawning",
    "Create and manage sub-agents for specialized tasks",
    ["session", "permissions"]
  ),
  UTILITIES: createCapability(
    "utilities",
    "General utility tools including weather information",
    ["user"]
  ),
  PROJECT: createCapability(
    "project",
    "Project-specific tools for posts, media, and statistics",
    ["project"]
  ),
  PROJECT_NAVIGATOR: createCapability(
    "project_navigator",
    "Navigate and manage multiple projects when no project is selected",
    ["user", "org"]
  ),
  REPOMD: createCapability(
    "repomd",
    "Access and search project content using RepoMD SDK",
    ["project"]
  ),
};

// Base system prompt template with placeholders
const BASE_SYSTEM_PROMPT = `You are a {{role}} that {{purpose}}.
{{responsibilities}}
{{constraints}}`;

// Helper to build system prompt
const buildSystemPrompt = (
  role,
  purpose,
  responsibilities,
  constraints = ""
) => {
  return BASE_SYSTEM_PROMPT.replace("{{role}}", role)
    .replace("{{purpose}}", purpose)
    .replace("{{responsibilities}}", responsibilities)
    .replace("{{constraints}}", constraints);
};

// Agent archetype factory
const createArchetype = (name, config) => ({
  name,
  behaviors: config.behaviors,
  capabilities: config.capabilities,
  systemPrompt: buildSystemPrompt(
    config.role,
    config.purpose,
    config.responsibilities,
    config.constraints
  ),
});

// Define agent archetypes using the factory
const AGENT_ARCHETYPES = {
  GENERALIST: createArchetype("generalist", {
    behaviors: [AGENT_BEHAVIORS.CLARIFIER, AGENT_BEHAVIORS.SCHEDULER],
    capabilities: [
      TOOL_CAPABILITIES.SEARCH,
      TOOL_CAPABILITIES.COMMUNICATION,
      TOOL_CAPABILITIES.AGENT_SPAWNING,
      TOOL_CAPABILITIES.UTILITIES,
      TOOL_CAPABILITIES.PROJECT,
    ],
    role: "generalist AI assistant",
    purpose: "helps users understand and plan their tasks",
    responsibilities: `Your primary role is to:
1. Clarify user requirements through targeted questions
2. Understand the full context of what needs to be done
3. Identify the best approach and tools for the task
4. Delegate to specialized agents when appropriate
5. Coordinate multi-step workflows`,
    constraints:
      "Always start by understanding the user's goal before jumping into execution.",
  }),

  CODE_GENERATOR: createArchetype("code_generator", {
    behaviors: [AGENT_BEHAVIORS.EXECUTOR],
    capabilities: [
      TOOL_CAPABILITIES.FILE_MANAGEMENT,
      TOOL_CAPABILITIES.CODE_ANALYSIS,
      TOOL_CAPABILITIES.SEARCH,
    ],
    role: "specialized code generation agent",
    purpose: "focused on creating high-quality code",
    responsibilities: `Your responsibilities:
1. Generate code that follows project conventions and best practices
2. Create comprehensive implementations with proper error handling
3. Use existing project patterns and libraries
4. Report progress on complex generations
5. Explain key decisions and trade-offs`,
  }),

  CODE_REVIEWER: createArchetype("code_reviewer", {
    behaviors: [AGENT_BEHAVIORS.ANALYZER],
    capabilities: [TOOL_CAPABILITIES.CODE_ANALYSIS, TOOL_CAPABILITIES.SEARCH],
    role: "code review specialist",
    purpose: "analyzes code for quality and best practices",
    responsibilities: `Focus on:
1. Code quality, readability, and maintainability
2. Security vulnerabilities and potential bugs
3. Performance implications
4. Adherence to project conventions
5. Suggesting specific improvements with examples`,
  }),

  DEPLOYMENT_MANAGER: createArchetype("deployment_manager", {
    behaviors: [AGENT_BEHAVIORS.EXECUTOR],
    capabilities: [
      TOOL_CAPABILITIES.DEPLOYMENT,
      TOOL_CAPABILITIES.GITHUB,
      TOOL_CAPABILITIES.COMMUNICATION,
    ],
    role: "deployment specialist",
    purpose: "responsible for managing project deployments",
    responsibilities: `Your tasks include:
1. Preparing projects for deployment
2. Managing deployment configurations
3. Monitoring deployment status
4. Handling deployment errors
5. Communicating deployment updates`,
  }),

  PUBLIC_ASSISTANT: createArchetype("public_assistant", {
    behaviors: [AGENT_BEHAVIORS.ANALYZER],
    capabilities: [TOOL_CAPABILITIES.SEARCH],
    role: "public-facing AI assistant",
    purpose: "with read-only access to project information",
    responsibilities: `You can:
1. Answer questions about the project's purpose and features
2. Explain code structure and architecture
3. Provide insights about technologies used
4. Help users understand the project better`,
    constraints:
      "Remember: You have read-only access and cannot modify anything.",
  }),

  PROJECT_NAVIGATOR: createArchetype("project_navigator", {
    behaviors: [AGENT_BEHAVIORS.CLARIFIER, AGENT_BEHAVIORS.ANALYZER],
    capabilities: [
      TOOL_CAPABILITIES.PROJECT_NAVIGATOR,
      TOOL_CAPABILITIES.UTILITIES,
    ],
    role: "project navigation assistant",
    purpose: "helps users navigate and select from their available projects",
    responsibilities: `Your primary role is to:
1. Help users understand what projects they have access to
2. Show recent activity and usage patterns across projects
3. Guide users to the most relevant project based on their intent
4. Provide project recommendations and insights
5. Switch to specific project contexts when requested

When a user wants to work on a specific project, use the 'switch_to_project' tool to transition them to that project's context.`,
    constraints:
      "Always be helpful and guide users to the most relevant project based on their intent. You operate without a specific project context.",
  }),

  PROJECT_CONTENT: createArchetype("project_content", {
    behaviors: [AGENT_BEHAVIORS.ANALYZER, AGENT_BEHAVIORS.EXECUTOR],
    capabilities: [
      TOOL_CAPABILITIES.REPOMD,
      TOOL_CAPABILITIES.SEARCH,
      TOOL_CAPABILITIES.PROJECT,
    ],
    role: "project content specialist",
    purpose:
      "provides detailed information about project content, articles, and resources",
    responsibilities: `Your primary role is to:
1. Search and retrieve articles/posts within the project
2. Provide detailed information about project content
3. Navigate and explain the project's content structure
4. Find specific information within articles and documentation
5. Analyze content patterns and relationships

You have access to the project's full content via the RepoMD SDK. Use these tools to answer questions about:
- Articles and blog posts (search by topic, keyword, or category)
- Media files and resources
- Project navigation and structure
- Content metadata and relationships`,
    constraints:
      "Focus on providing accurate, relevant information from the project's content. Always cite specific articles or sources when providing information.",
  }),
};

// Context builders - reduce repetition in context creation
const buildContextSection = (
  title,
  data,
  formatter = (k, v) => `- ${k}: ${v || "Not specified"}`
) => {
  if (!data) return null;

  const lines = [`${title}:`];
  for (const [key, value] of Object.entries(data)) {
    lines.push(formatter(key, value));
  }
  return lines.join("\n");
};

// Improved context-aware prompt generation
const generateAgentPrompt = (archetype, context = {}) => {
  const agent = AGENT_ARCHETYPES[archetype];
  if (!agent) {
    throw new Error(`Unknown agent archetype: ${archetype}`);
  }

  const messages = [systemMsg(agent.systemPrompt)];

  // Build context sections
  const contextSections = [
    context.project &&
      buildContextSection("Project Context", {
        Name: context.project.name,
        Description: context.project.description,
        Technologies: context.project.techStack?.join(", "),
        "Recent activity": context.project.recentActivity,
      }),

    context.user &&
      buildContextSection("User Context", {
        Name: context.user.name,
        Role: context.user.role,
        Permissions: context.user.permissions?.join(", "),
      }),

    context.task &&
      buildContextSection("Current Task", {
        Description: context.task.description,
        Priority: context.task.priority,
        Constraints: context.task.constraints?.join(", "),
      }),

    context.conversation &&
      buildContextSection("Conversation Context", {
        "Thread ID": context.conversation.threadId,
        "Previous messages": context.conversation.messageCount,
        "Key topics": context.conversation.topics?.join(", "),
      }),
  ].filter(Boolean);

  if (contextSections.length > 0) {
    messages.push(systemMsg(contextSections.join("\n\n")));
  }

  return messages;
};

// Improved tool selection with validation
const selectToolsForAgent = (archetype, availableTools, context = {}) => {
  const agent = AGENT_ARCHETYPES[archetype];
  if (!agent) return [];

  console.log("selectToolsForAgent - agent.capabilities:", agent.capabilities);
  console.log(
    "selectToolsForAgent - availableTools count:",
    availableTools.length
  );
  console.log(
    "selectToolsForAgent - user permissions:",
    context.permissions || []
  );

  const capabilityMap = new Map(
    agent.capabilities.map((cap) => [cap.name, cap])
  );

  return availableTools.filter((tool) => {
    console.log(
      "Checking tool:",
      tool.definition?.name,
      "category:",
      tool.category
    );

    if (!tool.definition || !tool.definition.name) {
      console.warn("Tool missing definition or name:", tool);
      return false;
    }

    // Check if tool category matches agent capabilities
    const capability = capabilityMap.get(tool.category);
    if (!capability) return false;

    // Check if user has required permissions for this tool
    if (tool.requiredPermissions && tool.requiredPermissions.length > 0) {
      const userPermissions = context.permissions || [];
      const hasPermissions = tool.requiredPermissions.every((perm) =>
        userPermissions.includes(perm)
      );

      if (!hasPermissions) {
        console.log(
          `Tool ${tool.definition.name} requires permissions ${tool.requiredPermissions} but user has ${userPermissions}`
        );
        return false;
      }
    }

    // Validate required context
    return capability.requiredContext.every(
      (req) => context[req] !== undefined
    );
  });
};

// Sub-agent workflow definitions
const createWorkflowStep = (agent, purpose, handoff = null) => ({
  agent,
  purpose,
  handoff,
});

const createWorkflow = (name, description, steps) => ({
  name,
  description,
  workflow: steps,
});

const SUB_AGENT_CONFIGS = {
  clarify_then_execute: createWorkflow(
    "Clarify Then Execute",
    "Clarify requirements then delegate to executor",
    [
      createWorkflowStep(
        "GENERALIST",
        "Clarify requirements and create execution plan",
        {
          to: "CODE_GENERATOR",
          condition: "requirements_clear",
          context: ["clarified_requirements", "execution_plan"],
        }
      ),
    ]
  ),

  review_and_improve: createWorkflow(
    "Review and Improve",
    "Generate code then review for improvements",
    [
      createWorkflowStep("CODE_GENERATOR", "Generate initial implementation", {
        to: "CODE_REVIEWER",
        condition: "code_generated",
        context: ["generated_files", "implementation_decisions"],
      }),
      createWorkflowStep("CODE_REVIEWER", "Review and suggest improvements", {
        to: "CODE_GENERATOR",
        condition: "improvements_identified",
        context: ["review_feedback", "improvement_suggestions"],
      }),
    ]
  ),

  deploy_with_validation: createWorkflow(
    "Deploy with Validation",
    "Validate project then deploy",
    [
      createWorkflowStep("CODE_REVIEWER", "Validate deployment readiness", {
        to: "DEPLOYMENT_MANAGER",
        condition: "validation_passed",
        context: ["validation_results", "deployment_checklist"],
      }),
    ]
  ),
};

// Centralized template system
const TEMPLATE_FUNCTIONS = {
  welcome: (userName, features) => `Hello${
    userName ? ` ${userName}` : ""
  }! I'm your AI assistant for this project. I can help you with:
${
  features ||
  `- Understanding and navigating the codebase
- Generating new features and components
- Reviewing code for improvements
- Answering questions about the project`
}

What would you like to work on today?`,

  clarification: (
    topic
  ) => `I'd like to better understand your requirements for ${topic}. Could you provide more details about:
- What specific functionality you need
- Any constraints or requirements
- Expected behavior or outcomes`,

  taskComplete: (task) =>
    `I've completed ${task}. Here's a summary of what was done:`,

  error: (error) =>
    `I encountered an issue: ${error}. Would you like me to try a different approach?`,

  threadContext: (messageCount) =>
    `I've reviewed the last ${messageCount} messages in this thread. Based on the discussion, I understand you need help with:`,

  mention: (userName) =>
    `Hi ${userName}, I'm here to help! I can assist with project-related tasks and questions.`,

  projectInfo: (projectName) => `Here's information about ${projectName}:`,

  deploymentUpdate: (status) => `Deployment ${status}:`,

  greeting: () =>
    "I'm a public assistant for this project. I can help you understand the codebase, explain features, and answer questions about the project.",

  limitation: () =>
    "Note: I have read-only access and cannot make changes to the project.",

  projectOverview: (project) =>
    `This project, ${project.name}, is ${
      project.description || "a software project"
    }. I can help you explore its structure and understand how it works.`,
};

// Template getter with interface-specific overrides
const getTemplate = (interfaceType, templateName, ...args) => {
  const interfaceTemplates = PROMPT_TEMPLATES[interfaceType];
  const template =
    interfaceTemplates?.[templateName] || TEMPLATE_FUNCTIONS[templateName];

  if (typeof template === "function") {
    return template(...args);
  }

  return template || "";
};

// Interface-specific template overrides
const PROMPT_TEMPLATES = {
  editorChat: {
    welcome: (userName) => TEMPLATE_FUNCTIONS.welcome(userName),
  },
  slack: {
    mention: TEMPLATE_FUNCTIONS.mention,
  },
  publicApi: {
    greeting: TEMPLATE_FUNCTIONS.greeting,
    limitation: TEMPLATE_FUNCTIONS.limitation,
    projectOverview: TEMPLATE_FUNCTIONS.projectOverview,
  },
};

// Dynamic prompt building
const buildPrompt = (template, variables = {}) => {
  let prompt = template;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    prompt = prompt.replace(regex, value);
  }

  return prompt;
};

// Main configuration creator with sensible defaults
const createAgentConfig = (options = {}) => {
  const {
    interface: interfaceType = "editorChat",
    archetype = "GENERALIST",
    context = {},
    availableTools = [],
    customPrompts = {},
  } = options;

  // Generate base prompts
  const basePrompts = generateAgentPrompt(archetype, context);

  // Select appropriate tools
  const tools = selectToolsForAgent(archetype, availableTools, context);

  // Get interface-specific templates
  const templates = {
    ...PROMPT_TEMPLATES[interfaceType],
    ...customPrompts,
  };

  // Determine model configuration based on archetype and auth
  const agent = AGENT_ARCHETYPES[archetype];
  const isAnalyzer = agent.behaviors.some(
    (b) => b === AGENT_BEHAVIORS.ANALYZER
  );

  const modelConfig = {
    model: context.auth ? "gpt-4.1-mini" : "gpt-4.1-mini",
    temperature: isAnalyzer ? 0.3 : 0.7,
    maxTokens: context.auth ? 4000 : 1000,
  };

  return {
    archetype,
    prompts: basePrompts,
    tools,
    templates,
    modelConfig,
    capabilities: agent.capabilities,
    behaviors: agent.behaviors,
    canSpawnAgents: agent.capabilities.some(
      (cap) => cap.name === "agent_spawning"
    ),
  };
};

// Export all configurations and utilities
export {
  // Message creation helpers
  createMsg,
  systemMsg,
  userMsg,
  assistantMsg,

  // Core configuration objects
  AGENT_BEHAVIORS,
  TOOL_CAPABILITIES,
  AGENT_ARCHETYPES,
  SUB_AGENT_CONFIGS,

  // Template system
  PROMPT_TEMPLATES,
  getTemplate,

  // Core functions
  generateAgentPrompt,
  selectToolsForAgent,
  buildPrompt,
  createAgentConfig,
};

// Legacy support
export const basicMessages = {
  createMsg,
  systemMsg,
  userMsg,
  assistantMsg,
};
