/**
 * Manage Slack Background Agents
 */

import { ObjectId } from "mongodb";
import { db } from "../../db.js";
import { randomUUID } from "crypto";
import agentNotifier from "./agentNotifier.js";

export class SlackAgentManager {
  /**
   * Create a new agent
   */
  async createAgent({
    orgId,
    channelId,
    threadTs,
    userId,
    userName,
    command,
    options,
    projectId,
    teamId,
  }) {
    const agent = {
      _id: new ObjectId(),
      orgId: new ObjectId(orgId),
      channelId,
      threadTs,
      userId,
      userName,
      teamId,
      status: "pending",
      command,
      options: options || {},
      projectId: projectId ? new ObjectId(projectId) : null,
      requestId: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.slackAgents.insertOne(agent);
    return agent;
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(agentId, status, additionalData = {}) {
    const update = {
      $set: {
        status,
        updatedAt: new Date(),
        ...additionalData,
      },
    };

    if (status === "completed" || status === "failed") {
      update.$set.completedAt = new Date();
    }

    const result = await db.slackAgents.findOneAndUpdate(
      { _id: new ObjectId(agentId) },
      update,
      { returnDocument: "after" }
    );

    return result;
  }

  /**
   * Add follow-up instructions to an agent
   */
  async addFollowUp(agentId, followUpText, userId) {
    const agent = await db.slackAgents.findOne({ _id: new ObjectId(agentId) });

    if (!agent) {
      throw new Error("Agent not found");
    }

    if (agent.userId !== userId) {
      throw new Error("Only the agent owner can add follow-up instructions");
    }

    if (agent.status === "completed" || agent.status === "failed") {
      throw new Error("Cannot add follow-up to completed or failed agent");
    }

    // Add follow-up to history
    const followUp = {
      text: followUpText,
      userId,
      timestamp: new Date(),
    };

    await db.slackAgents.updateOne(
      { _id: new ObjectId(agentId) },
      {
        $push: { followUps: followUp },
        $set: { updatedAt: new Date() },
      }
    );

    return agent;
  }

  /**
   * Get agents for a thread
   */
  async getThreadAgents(threadTs, channelId) {
    return await db.slackAgents
      .find({ threadTs, channelId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  /**
   * Get user's active agents
   */
  async getUserAgents(userId, teamId, includeCompleted = false) {
    const query = {
      userId,
      teamId,
    };

    if (!includeCompleted) {
      query.status = { $in: ["pending", "running"] };
    }

    return await db.slackAgents
      .find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
  }

  /**
   * Check if user owns an agent in thread
   */
  async userOwnsThreadAgent(threadTs, channelId, userId) {
    const agent = await db.slackAgents.findOne({
      threadTs,
      channelId,
      userId,
      status: { $in: ["pending", "running"] },
    });

    return agent;
  }

  /**
   * Delete (archive) an agent
   */
  async deleteAgent(agentId, userId) {
    const agent = await db.slackAgents.findOne({ _id: new ObjectId(agentId) });

    if (!agent) {
      throw new Error("Agent not found");
    }

    if (agent.userId !== userId) {
      throw new Error("Only the agent owner can delete it");
    }

    // Mark as archived instead of deleting
    await db.slackAgents.updateOne(
      { _id: new ObjectId(agentId) },
      {
        $set: {
          status: "archived",
          archivedAt: new Date(),
          archivedBy: userId,
        },
      }
    );

    return true;
  }

  /**
   * Get channel settings
   */
  async getChannelSettings(channelId, teamId) {
    const settings = await db.slackChannelSettings.findOne({
      channelId,
      teamId,
    });

    return settings?.defaults || {};
  }

  /**
   * Update channel settings
   */
  async updateChannelSettings(channelId, teamId, orgId, defaults, userId) {
    await db.slackChannelSettings.updateOne(
      { channelId, teamId },
      {
        $set: {
          orgId: new ObjectId(orgId),
          defaults,
          updatedAt: new Date(),
          updatedBy: userId,
        },
        $setOnInsert: {
          channelId,
          teamId,
        },
      },
      { upsert: true }
    );

    return true;
  }

  /**
   * Merge options with defaults
   */
  async mergeWithDefaults(explicitOptions, channelId, teamId, orgId) {
    // Get channel defaults
    const channelDefaults = await this.getChannelSettings(channelId, teamId);

    // Get org defaults (mock for now)
    const orgDefaults = {
      model: "gpt-4.1-mini",
      autopr: true,
    };

    // Merge with precedence: explicit > channel > org
    return {
      ...orgDefaults,
      ...channelDefaults,
      ...explicitOptions,
    };
  }

  /**
   * Resolve project from repository specification
   */
  async resolveProject(repoSpec, orgId) {
    if (!repoSpec) return null;

    // Mock implementation - in real app would lookup project by repo
    // For now, find first project in org
    const project = await db.projects.findOne({
      orgId: new ObjectId(orgId),
    });

    return project?._id || null;
  }

  /**
   * Mock LLM agent execution
   */
  async executeAgent(agent) {
    // Mock implementation
    console.log("Executing agent:", agent.requestId);

    // Update status to running
    await this.updateAgentStatus(agent._id, "running");

    // Simulate async execution
    setTimeout(async () => {
      try {
        // Mock PR creation
        const prUrl = `https://github.com/${
          agent.options.repo || "org/repo"
        }/pull/${Math.floor(Math.random() * 1000)}`;
        const completionMessage =
          "Successfully implemented the requested changes";

        await this.updateAgentStatus(agent._id, "completed", {
          prUrl,
          completionMessage,
        });

        // Notify Slack
        await agentNotifier.notifyAgentCompleted(
          agent._id,
          prUrl,
          completionMessage
        );
      } catch (error) {
        // Handle failure
        await this.updateAgentStatus(agent._id, "failed", {
          error: error.message,
        });

        // Notify Slack
        await agentNotifier.notifyAgentFailed(agent._id, error.message);
      }
    }, 5000);

    return agent.requestId;
  }
}

// Export singleton instance
export default new SlackAgentManager();
