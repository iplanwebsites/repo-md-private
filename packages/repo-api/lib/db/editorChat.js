import { ObjectId } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import { db } from "../../db.js";

const editorChatDb = {
  async create({
    user,
    org,
    project,
    title,
    model = "gpt-4.1-mini",
    temperature = 0.7,
    slackThreads = [],
    source = "web",
  }) {
    const chat = {
      _id: new ObjectId(),
      user,
      org: org instanceof ObjectId ? org : new ObjectId(org),
      project: project
        ? project instanceof ObjectId
          ? project
          : new ObjectId(project)
        : null,
      title: title || "New Chat",
      model,
      temperature,
      messages: [],
      tasks: [],
      status: "active",
      tokensUsed: {
        prompt: 0,
        completion: 0,
        total: 0,
      },
      metadata: {
        lastActivity: new Date(),
        context: {},
        tags: [],
      },
      slackThreads: slackThreads || [],
      source,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.editorChats.insertOne(chat);
    return chat;
  },

  async findOne(query) {
    const chat = await db.editorChats.findOne(query);
    
    if (chat && chat.org) {
      chat.org = await db.orgs.findOne({ _id: chat.org });
    }
    if (chat && chat.project) {
      chat.project = await db.projects.findOne({ _id: chat.project });
    }
    
    return chat;
  },

  async findById(chatId) {
    const chat = await db.editorChats.findOne({
      _id: new ObjectId(chatId),
    });

    if (chat && chat.org) {
      chat.org = await db.orgs.findOne({ _id: chat.org });
    }
    if (chat && chat.project) {
      chat.project = await db.projects.findOne({ _id: chat.project });
    }

    return chat;
  },

  async list({ user, org, project, status = "active", limit = 50, skip = 0 }) {
    const query = {};

    if (user) query.user = user;
    if (org) query.org = org instanceof ObjectId ? org : new ObjectId(org);
    if (project)
      query.project =
        project instanceof ObjectId ? project : new ObjectId(project);
    if (status) query.status = status;

    const [chats, total] = await Promise.all([
      db.editorChats
        .find(query)
        .sort({ "metadata.lastActivity": -1 })
        .limit(limit)
        .skip(skip)
        .toArray(),
      db.editorChats.countDocuments(query),
    ]);

    // Populate org and project names
    for (const chat of chats) {
      if (chat.org) {
        chat.org = await db.orgs.findOne({ _id: chat.org });
      }
      if (chat.project) {
        chat.project = await db.projects.findOne({ _id: chat.project });
      }
    }

    return { chats, total };
  },

  async addMessage(chatId, message) {
    const messageId = message.id || uuidv4();
    const messageData = {
      ...message,
      id: messageId,
      timestamp: new Date(),
    };

    const result = await db.editorChats.findOneAndUpdate(
      { _id: new ObjectId(chatId) },
      {
        $push: { messages: messageData },
        $set: {
          "metadata.lastActivity": new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    return result.value;
  },

  async addMessages(chatId, messages) {
    const messagesData = messages.map((msg) => ({
      ...msg,
      id: msg.id || uuidv4(),
      timestamp: msg.timestamp || new Date(),
    }));

    const result = await db.editorChats.findOneAndUpdate(
      { _id: new ObjectId(chatId) },
      {
        $push: { messages: { $each: messagesData } },
        $set: {
          "metadata.lastActivity": new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    return result.value;
  },
  
  async updateMessage(chatId, messageId, updates) {
    const updateFields = {};
    Object.keys(updates).forEach((key) => {
      updateFields[`messages.$.${key}`] = updates[key];
    });

    const result = await db.editorChats.findOneAndUpdate(
      { _id: new ObjectId(chatId), "messages.id": messageId },
      {
        $set: {
          ...updateFields,
          "metadata.lastActivity": new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    return result.value;
  },

  async updateTokenUsage(chatId, tokens) {
    const result = await db.editorChats.findOneAndUpdate(
      { _id: new ObjectId(chatId) },
      {
        $inc: {
          "tokensUsed.prompt": tokens.prompt || 0,
          "tokensUsed.completion": tokens.completion || 0,
          "tokensUsed.total": tokens.total || 0,
        },
      },
      { returnDocument: "after" }
    );

    return result.value;
  },

  async updateStatus(chatId, status) {
    const result = await db.editorChats.findOneAndUpdate(
      { _id: new ObjectId(chatId) },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    return result.value;
  },

  async updateSummary(chatId, summary) {
    const result = await db.editorChats.findOneAndUpdate(
      { _id: new ObjectId(chatId) },
      {
        $set: {
          summary,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    return result.value;
  },

  async updateTitle(chatId, title) {
    const result = await db.editorChats.findOneAndUpdate(
      { _id: new ObjectId(chatId) },
      {
        $set: {
          title,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    return result.value;
  },

  async updateOne(query, update) {
    const result = await db.editorChats.updateOne(query, update);
    return result;
  },

  async addTask(chatId, task) {
    const taskId = task.id || uuidv4();
    const taskData = {
      ...task,
      id: taskId,
      createdAt: new Date(),
    };

    const result = await db.editorChats.findOneAndUpdate(
      { _id: new ObjectId(chatId) },
      {
        $push: { tasks: taskData },
        $set: {
          "metadata.lastActivity": new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    return result.value;
  },

  async updateTask(chatId, taskId, updates) {
    const updateFields = {};
    Object.keys(updates).forEach((key) => {
      updateFields[`tasks.$.${key}`] = updates[key];
    });

    if (updates.status === "completed") {
      updateFields["tasks.$.completedAt"] = new Date();
    } else if (updates.status === "in_progress" && !updates.startedAt) {
      updateFields["tasks.$.startedAt"] = new Date();
    }

    const result = await db.editorChats.findOneAndUpdate(
      { _id: new ObjectId(chatId), "tasks.id": taskId },
      {
        $set: {
          ...updateFields,
          "metadata.lastActivity": new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    return result.value;
  },

  async delete(chatId) {
    return await db.editorChats.deleteOne({ _id: new ObjectId(chatId) });
  },

  async getStats({ user, org, project }) {
    const matchStage = {};
    if (user) matchStage.user = user;
    if (org) matchStage.org = org instanceof ObjectId ? org : new ObjectId(org);
    if (project)
      matchStage.project =
        project instanceof ObjectId ? project : new ObjectId(project);

    const stats = await db.editorChats
      .aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalChats: { $sum: 1 },
            activeChats: {
              $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
            },
            completedChats: {
              $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
            },
            totalMessages: { $sum: { $size: "$messages" } },
            totalTasks: { $sum: { $size: "$tasks" } },
            totalTokens: { $sum: "$tokensUsed.total" },
          },
        },
      ])
      .toArray();

    return (
      stats[0] || {
        totalChats: 0,
        activeChats: 0,
        completedChats: 0,
        totalMessages: 0,
        totalTasks: 0,
        totalTokens: 0,
      }
    );
  },
};

export default editorChatDb;
