/**
 * MongoDB Schema for Conversations Collection
 * Used to store AI chat conversations for project generation
 */

export const CONVO_STATUS = {
  ACTIVE: "active",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
  GENERATING: "generating",
  FAILED: "failed",
};

export const CONVO_TYPES = {
  PROJECT_GENERATION: "project_generation",
  PROJECT_MODIFICATION: "project_modification",
  SUPPORT: "support",
  GENERAL: "general",
};

export const MESSAGE_ROLES = {
  USER: "user",
  ASSISTANT: "assistant",
  SYSTEM: "system",
  FUNCTION: "function",
};

/**
 * Conversation document structure
 */
export const convoSchema = {
  _id: "ObjectId",

  // User and organization context
  userId: "ObjectId", // Reference to users collection
  orgId: "ObjectId", // Reference to orgs collection
  projectId: "ObjectId", // Reference to projects collection (if applicable)

  // Conversation metadata
  type: "string", // One of CONVO_TYPES
  status: "string", // One of CONVO_STATUS
  title: "string", // Auto-generated or user-provided title

  // Timestamps
  createdAt: "Date",
  updatedAt: "Date",
  completedAt: "Date", // When conversation was completed

  // Messages array
  messages: [
    {
      id: "string", // Unique message ID
      role: "string", // One of MESSAGE_ROLES
      content: "string", // Message content
      name: "string", // Function name (for function messages)
      functionCall: {
        // For assistant messages with function calls
        name: "string",
        arguments: "object",
      },
      timestamp: "Date",

      // Token usage tracking
      tokens: {
        prompt: "number",
        completion: "number",
        total: "number",
      },
    },
  ],

  // Extracted project brief (for project_generation type)
  projectBrief: {
    projectName: "string",
    projectType: "string",
    description: "string",
    techStack: {
      frontend: ["string"],
      backend: ["string"],
      database: ["string"],
      infrastructure: ["string"],
    },
    features: [
      {
        name: "string",
        description: "string",
        priority: "string",
      },
    ],
    targetAudience: "string",
    designPreferences: {
      style: "string",
      colors: ["string"],
      inspiration: ["string"],
    },
    constraints: {
      timeline: "string",
      budget: "string",
      teamSize: "number",
      expertise: "string",
    },
    integrations: [
      {
        service: "string",
        purpose: "string",
        required: "boolean",
      },
    ],
    additionalNotes: "string",
  },

  // Generation results
  generationResult: {
    success: "boolean",
    projectId: "ObjectId", // Created project ID
    repositoryUrl: "string",
    commitSha: "string",
    filesGenerated: "number",
    error: "string", // Error message if failed
    generatedAt: "Date",
  },

  // Analytics and metrics
  metrics: {
    totalMessages: "number",
    userMessages: "number",
    assistantMessages: "number",
    functionCalls: "number",
    totalTokens: "number",
    estimatedCost: "number", // Estimated cost in USD
    duration: "number", // Conversation duration in seconds
  },

  // User feedback
  feedback: {
    rating: "number", // 1-5 star rating
    comment: "string",
    helpful: "boolean",
    submittedAt: "Date",
  },

  // Session tracking
  sessionId: "string", // Browser session ID
  userAgent: "string",
  ipAddress: "string",

  // Feature flags and settings
  settings: {
    model: "string", // AI model used (e.g., 'gpt-4-turbo')
    temperature: "number",
    maxTokens: "number",
    streaming: "boolean",
  },
};

/**
 * Create indexes for the convos collection
 */
export async function createConvoIndexes(db) {
  await db.convos.createIndex(
    { userId: 1, createdAt: -1 },
    { background: true }
  );
  await db.convos.createIndex(
    { orgId: 1, createdAt: -1 },
    { background: true }
  );
  await db.convos.createIndex({ projectId: 1 }, { background: true });
  await db.convos.createIndex(
    { status: 1, createdAt: -1 },
    { background: true }
  );
  await db.convos.createIndex({ type: 1, createdAt: -1 }, { background: true });
  await db.convos.createIndex({ sessionId: 1 }, { background: true });
  await db.convos.createIndex(
    { "generationResult.projectId": 1 },
    { background: true }
  );
  await db.convos.createIndex(
    { "messages.timestamp": -1 },
    { background: true }
  );
}

/**
 * Helper function to create a new conversation document
 */
export function createConvoDocument({
  userId,
  orgId,
  type = CONVO_TYPES.PROJECT_GENERATION,
  title = "New Project Discussion",
  sessionId,
  userAgent,
  ipAddress,
  settings = {},
}) {
  return {
    userId,
    orgId,
    type,
    status: CONVO_STATUS.ACTIVE,
    title,
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [],
    metrics: {
      totalMessages: 0,
      userMessages: 0,
      assistantMessages: 0,
      functionCalls: 0,
      totalTokens: 0,
      estimatedCost: 0,
      duration: 0,
    },
    sessionId,
    userAgent,
    ipAddress,
    settings: {
      model: settings.model || "gpt-4.1-mini",
      temperature: settings.temperature || 0.7,
      maxTokens: settings.maxTokens || 4000,
      streaming: settings.streaming ?? true,
    },
  };
}

/**
 * Helper function to add a message to conversation
 */
export function addMessageToConvo(convo, message) {
  const messageDoc = {
    id: generateMessageId(),
    role: message.role,
    content: message.content,
    timestamp: new Date(),
    tokens: message.tokens || {},
  };

  if (message.name) messageDoc.name = message.name;
  if (message.functionCall) messageDoc.functionCall = message.functionCall;

  convo.messages.push(messageDoc);
  convo.updatedAt = new Date();

  // Update metrics
  convo.metrics.totalMessages++;
  if (message.role === MESSAGE_ROLES.USER) convo.metrics.userMessages++;
  if (message.role === MESSAGE_ROLES.ASSISTANT)
    convo.metrics.assistantMessages++;
  if (message.functionCall) convo.metrics.functionCalls++;
  if (message.tokens?.total) {
    convo.metrics.totalTokens += message.tokens.total;
    convo.metrics.estimatedCost += calculateTokenCost(
      message.tokens.total,
      convo.settings.model
    );
  }

  return messageDoc;
}

/**
 * Generate unique message ID
 */
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate estimated cost based on tokens and model
 */
function calculateTokenCost(tokens, model) {
  const rates = {
    "gpt-4.1-mini": 0.01 / 1000, // $0.01 per 1K tokens
    "gpt-4.1-mini": 0.03 / 1000, // $0.03 per 1K tokens
    "gpt-4.1-mini": 0.001 / 1000, // $0.001 per 1K tokens
  };

  const rate = rates[model] || rates["gpt-4.1-mini"];
  return tokens * rate;
}
