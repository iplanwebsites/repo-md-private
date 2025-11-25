import { MongoClient } from "mongodb";

// Define collections array and export it
export const COLLECTIONS = [
  "r2",
  "users",
  "orgs",
  "projects",
  "deploys",
  "jobs",
  "gitEvents", // GitHub webhook events
  
  // Project webhook collections
  "projectWebhooks", // Incoming webhook configurations
  "projectWebhookEvents", // Incoming webhook execution logs
  "projectOutgoingWebhooks", // Outgoing webhook configurations
  "projectOutgoingWebhookEvents", // Outgoing webhook execution logs

  // Slack integration
  "slackInstallations", // Slack app installations per team
  "slackConversations", // Slack conversations and mentions
  "slackAgents", // Background agents created from Slack
  "slackChannelSettings", // Channel-specific default settings
  
  // Editor Chat
  "editorChats", // LLM conversations with tools for editing
  
  // Scheduling system
  "scheduledTasks", // AI agent scheduled tasks
  "taskHistory", // Task execution history
  
  // stuff
  "notes",
  "medias",
  "waitlist", // Collection for waitlist management
  "convos", // AI conversations for project generation
  /*
  "patients",
  "mentors",
  "extras",
  "extraConfigs", //moving from airtable
  "meets",
  "r2",
  "userActivities",
  "reccos", //reccomendations of actions to perfom, similar to notifs
  */
  //"TESTTT",
  "llmApiCache", //cache for llm api calls
  "dalleApiCache", //cache for dalle api calls
  "convos", //chat conversations
  "generatedProjects", //projects generated via chat
];

const TRACE_SAMPLE = true;

// Initialize empty db object
export const db = COLLECTIONS.reduce(
  (acc, name) => ({ ...acc, [name]: null }),
  {}
);

export const connectDb = async () => {
  const URI = process.env.MONGO_URL;

  try {
    const client = new MongoClient(URI);
    await client.connect();
    console.log("MongoDb is connected");

    // Extract database name from MongoDB URI
    // Handles formats like: mongodb://localhost:27017/dbname or mongodb+srv://user:pass@cluster.mongodb.net/dbname
    const dbName = URI.split("/").pop().split("?")[0];
    const database = client.db(dbName);

    // Initialize all collections from the array
    COLLECTIONS.forEach((name) => {
      db[name] = database.collection(name);
    });

    // Create necessary indexes
    await createIndexes();

    // Log initial collection stats
    if (TRACE_SAMPLE && !process.env.prod) await traceCollections();

    return client;
  } catch (error) {
    console.log(error.message);
    throw error;
  }
};

// Create and ensure indexes for better query performance
async function createIndexes() {
  try {
    // Jobs collection - index on projectId for efficient job lookup by project
    await db.jobs.createIndex({ projectId: 1 }, { background: true });
    
    // GitEvents collection - indexes for webhook processing
    await db.gitEvents.createIndex({ "repository.fullName": 1 }, { background: true });
    await db.gitEvents.createIndex({ projectId: 1 }, { background: true });
    await db.gitEvents.createIndex({ orgSlug: 1 }, { background: true });
    await db.gitEvents.createIndex({ timestamp: -1 }, { background: true });
    await db.gitEvents.createIndex({ event: 1, timestamp: -1 }, { background: true });
    
    // Project webhooks collections
    // Incoming webhooks
    await db.projectWebhooks.createIndex({ projectId: 1, isActive: 1 }, { background: true });
    await db.projectWebhooks.createIndex({ token: 1 }, { background: true });
    await db.projectWebhooks.createIndex({ createdBy: 1 }, { background: true });
    
    // Incoming webhook events
    await db.projectWebhookEvents.createIndex({ webhookId: 1, createdAt: -1 }, { background: true });
    await db.projectWebhookEvents.createIndex({ projectId: 1, createdAt: -1 }, { background: true });
    await db.projectWebhookEvents.createIndex({ status: 1, createdAt: -1 }, { background: true });
    
    // Outgoing webhooks
    await db.projectOutgoingWebhooks.createIndex({ projectId: 1, isActive: 1 }, { background: true });
    await db.projectOutgoingWebhooks.createIndex({ projectId: 1, events: 1, isActive: 1 }, { background: true });
    
    // Outgoing webhook events
    await db.projectOutgoingWebhookEvents.createIndex({ webhookId: 1, createdAt: -1 }, { background: true });
    await db.projectOutgoingWebhookEvents.createIndex({ projectId: 1, createdAt: -1 }, { background: true });
    await db.projectOutgoingWebhookEvents.createIndex({ status: 1, nextRetryAt: 1 }, { background: true });
    await db.projectOutgoingWebhookEvents.createIndex({ finalStatus: 1, createdAt: -1 }, { background: true });
    
    // Projects collection - _id is automatically indexed by MongoDB
    // But we ensure other common fields are indexed as needed
    
    // Convos collection - for AI conversations
    await db.convos.createIndex({ userId: 1, createdAt: -1 }, { background: true });
    await db.convos.createIndex({ orgId: 1, createdAt: -1 }, { background: true });
    await db.convos.createIndex({ projectId: 1 }, { background: true });
    await db.convos.createIndex({ status: 1, createdAt: -1 }, { background: true });
    await db.convos.createIndex({ type: 1, createdAt: -1 }, { background: true });
    await db.convos.createIndex({ sessionId: 1 }, { background: true });
    await db.convos.createIndex({ 'generationResult.projectId': 1 }, { background: true });
    
    // GeneratedProjects collection - for projects created via chat
    await db.generatedProjects.createIndex({ userId: 1, createdAt: -1 }, { background: true });
    await db.generatedProjects.createIndex({ orgId: 1, createdAt: -1 }, { background: true });
    await db.generatedProjects.createIndex({ conversationId: 1 }, { background: true });
    await db.generatedProjects.createIndex({ techStack: 1 }, { background: true });
    await db.generatedProjects.createIndex({ status: 1, createdAt: -1 }, { background: true });
    
    // EditorChats collection - for LLM conversations with tools
    await db.editorChats.createIndex({ user: 1, org: 1, createdAt: -1 }, { background: true });
    await db.editorChats.createIndex({ org: 1, project: 1, createdAt: -1 }, { background: true });
    await db.editorChats.createIndex({ org: 1, status: 1, createdAt: -1 }, { background: true });
    await db.editorChats.createIndex({ 'metadata.lastActivity': -1 }, { background: true });
    
    // Slack installations collection
    await db.slackInstallations.createIndex({ teamId: 1 }, { unique: true, background: true });
    await db.slackInstallations.createIndex({ createdAt: -1 }, { background: true });
    
    // Slack conversations collection
    await db.slackConversations.createIndex({ teamId: 1, channelId: 1, timestamp: 1 }, { background: true });
    await db.slackConversations.createIndex({ teamId: 1, userId: 1, createdAt: -1 }, { background: true });
    await db.slackConversations.createIndex({ orgId: 1, createdAt: -1 }, { background: true });
    await db.slackConversations.createIndex({ threadTs: 1 }, { background: true });
    
    // Slack Agents collection
    await db.slackAgents.createIndex({ threadTs: 1, channelId: 1 }, { background: true });
    await db.slackAgents.createIndex({ userId: 1, status: 1 }, { background: true });
    await db.slackAgents.createIndex({ orgId: 1, createdAt: -1 }, { background: true });
    await db.slackAgents.createIndex({ requestId: 1 }, { background: true, unique: true });
    
    // Slack Channel Settings
    await db.slackChannelSettings.createIndex({ channelId: 1, teamId: 1 }, { background: true, unique: true });
    
    // Scheduled Tasks collection
    await db.scheduledTasks.createIndex({ agentId: 1, scheduledAt: 1 }, { background: true });
    await db.scheduledTasks.createIndex({ projectId: 1, scheduledAt: 1 }, { background: true });
    await db.scheduledTasks.createIndex({ orgId: 1, scheduledAt: 1 }, { background: true });
    await db.scheduledTasks.createIndex({ status: 1, scheduledAt: 1 }, { background: true });
    await db.scheduledTasks.createIndex({ type: 1, status: 1 }, { background: true });
    await db.scheduledTasks.createIndex({ parentTaskId: 1 }, { background: true });
    await db.scheduledTasks.createIndex({ "recurrence.pattern": 1, status: 1 }, { background: true });
    await db.scheduledTasks.createIndex({ "trigger.type": 1, status: 1 }, { background: true });
    await db.scheduledTasks.createIndex({ createdAt: -1 }, { background: true });
    
    // Task History collection
    await db.taskHistory.createIndex({ taskId: 1, timestamp: -1 }, { background: true });
    await db.taskHistory.createIndex({ action: 1, timestamp: -1 }, { background: true });
    await db.taskHistory.createIndex({ performedBy: 1, timestamp: -1 }, { background: true });
    
    console.log("Database indexes created or verified successfully");
  } catch (error) {
    console.error("Error creating database indexes:", error);
    // We don't throw the error here to prevent app startup failure, 
    // but we log it for troubleshooting
  }
}

export const traceCollections = async () => {
  try {
    const stats = await Promise.all(
      COLLECTIONS.map(async (name) => {
        const collection = db[name];
        const count = await collection.countDocuments();
        const latest = await collection
          .find()
          .sort({ _id: -1 })
          .limit(1)
          .toArray();

        return {
          name,
          count,
          latest: latest[0] || null,
          timestamp: new Date().toISOString(),
        };
      })
    );

    console.log("\n=== Collection Statistics ===");
    stats.forEach(({ name, count, latest, timestamp }) => {
      console.log(`\n${name.toUpperCase()}:`);
      console.log(`Documents count: ${count}`);
      /*
      console.log(
        `Latest document: `,
        latest
          ? {
              _id: latest._id,
              timestamp: latest.createdAt || latest.timestamp || "N/A",
              // Add any specific fields you want to trace
              ...latest,
            }
          : "No documents"
      );*/
      console.log(`Checked at: ${timestamp}`);
    });
    console.log("\n===========================\n");

    return stats;
  } catch (error) {
    console.error("Error tracing collections:", error);
    throw error;
  }
};

// Usage:
// import { connectDb, db } from './db.js';
// await connectDb();
// const result = await db.convos.find({}).toArray();
