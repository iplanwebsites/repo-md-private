import { db } from "../../db.js";
import { ObjectId } from "mongodb";
import cloudRunService from "../cloudRun.js";
import { Agent } from "@voltagent/core";
import { VercelAIProvider } from "@voltagent/vercel-ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { createHeliconeProvider } from "../volt/voltAgentConfig.js";

/**
 * Processes incoming webhook requests
 */
class WebhookProcessor {
  constructor() {
    this.debug = process.env.DEBUG_WEBHOOKS === "true";
  }

  /**
   * Create a webhook command extraction agent
   */
  createWebhookAgent(webhook) {
    const systemPrompt = `You are a webhook command interpreter.
Provider: ${webhook.provider}
Instructions: ${webhook.agentInstructions}

Extract the command and return JSON with:
- action: the action to perform (e.g., "create_content", "trigger_build", "read_analytics")
- parameters: relevant parameters for the action
- context: any additional context (user, channel, etc.)

Available actions: create_content, update_content, delete_content, trigger_build, deploy_preview, rollback, read_analytics, import, refresh, update`;

    return new Agent({
      name: "WebhookCommandExtractor",
      instructions: systemPrompt,
      llm: createHeliconeProvider(),
      model: openai("gpt-4.1-mini"),
      markdown: false, // We want JSON output
      memory: false, // Disable SQLite memory
    });
  }

  /**
   * Process incoming webhook request
   * @param {string} token - Webhook token
   * @param {Object} request - Request data
   * @returns {Object} - Processing result with statusCode and body
   */
  async processIncomingWebhook(token, request) {
    // Find webhook by token
    const webhook = await db.projectWebhooks.findOne({
      token: token,
      isActive: true,
    });

    if (!webhook) {
      return {
        statusCode: 404,
        body: {
          success: false,
          message: "Webhook not found",
        },
      };
    }

    console.log(
      `🎣 Processing webhook: ${webhook.name} for project ${webhook.projectId}`
    );

    // Validate request
    const validationResult = await this.validateRequest(webhook, request);
    if (!validationResult.valid) {
      return {
        statusCode: validationResult.statusCode || 403,
        body: {
          success: false,
          message: validationResult.message,
        },
      };
    }

    // Create event record
    const event = await this.createEventRecord(webhook, request);

    try {
      // Update webhook usage stats
      await this.updateWebhookStats(webhook._id);

      // Process the webhook action
      const result = await this.processWebhookAction(
        webhook,
        request.body,
        event._id
      );

      // Update event with success
      await this.updateEventStatus(event._id, "success", result);

      return {
        statusCode: 200,
        body: {
          success: true,
          message: "Webhook processed successfully",
          eventId: event._id.toString(),
          ...result,
        },
      };
    } catch (error) {
      console.error(`❌ Error processing webhook: ${error.message}`);

      // Update event with failure
      await this.updateEventStatus(event._id, "failed", null, error.message);

      return {
        statusCode: 500,
        body: {
          success: false,
          message: "Webhook processing failed",
          error: error.message,
          eventId: event._id.toString(),
        },
      };
    }
  }

  /**
   * Validate incoming request against webhook configuration
   * @param {Object} webhook - Webhook configuration
   * @param {Object} request - Request data
   * @returns {Object} - Validation result
   */
  async validateRequest(webhook, request) {
    // IP validation
    if (webhook.allowedIps && webhook.allowedIps.length > 0) {
      const clientIp = request.ip;
      if (!webhook.allowedIps.includes(clientIp)) {
        console.log(`❌ IP not allowed: ${clientIp}`);

        // Log rejected event
        await db.projectWebhookEvents.insertOne({
          _id: new ObjectId(),
          webhookId: webhook._id,
          projectId: webhook.projectId,
          request: {
            method: request.method,
            ip: clientIp,
            timestamp: new Date(),
          },
          status: "rejected",
          error: "IP not allowed",
          createdAt: new Date(),
        });

        return {
          valid: false,
          statusCode: 403,
          message: "Forbidden",
        };
      }
    }

    // Method validation
    if (webhook.allowedMethods && webhook.allowedMethods.length > 0) {
      if (!webhook.allowedMethods.includes(request.method)) {
        console.log(`❌ Method not allowed: ${request.method}`);
        return {
          valid: false,
          statusCode: 405,
          message: "Method not allowed",
        };
      }
    }

    return { valid: true };
  }

  /**
   * Create event record
   * @param {Object} webhook - Webhook configuration
   * @param {Object} request - Request data
   * @returns {Object} - Created event
   */
  async createEventRecord(webhook, request) {
    const event = {
      _id: new ObjectId(),
      webhookId: webhook._id,
      projectId: webhook.projectId,
      request: {
        method: request.method,
        headers: request.headers,
        body: request.body,
        query: request.query,
        ip: request.ip,
        timestamp: new Date(),
      },
      status: "processing",
      logs: [],
      createdAt: new Date(),
    };

    await db.projectWebhookEvents.insertOne(event);
    return event;
  }

  /**
   * Update webhook usage stats
   * @param {ObjectId} webhookId - Webhook ID
   */
  async updateWebhookStats(webhookId) {
    await db.projectWebhooks.updateOne(
      { _id: webhookId },
      {
        $inc: { "stats.calls": 1 },
        $set: { "stats.lastCalled": new Date() },
      }
    );
  }

  /**
   * Process webhook action based on payload
   * @param {Object} webhook - Webhook configuration
   * @param {Object} payload - Request body
   * @param {ObjectId} eventId - Event ID for logging
   * @returns {Object} - Action result
   */
  async processWebhookAction(webhook, payload, eventId) {
    let { action } = payload;
    let command = null;

    // Get project
    const project = await db.projects.findOne({
      _id: new ObjectId(webhook.projectId),
    });
    if (!project) {
      throw new Error("Project not found");
    }

    // If webhook has AI instructions, use AI to extract command
    if (webhook.agentInstructions && webhook.provider) {
      command = await this.extractCommandWithAI(webhook, payload);
      action = command.action;

      if (this.debug) {
        console.log("🤖 AI extracted command:", command);
      }

      // Check permissions if available
      if (
        webhook.permissions &&
        !this.hasPermission(webhook.permissions, action)
      ) {
        await this.logEvent(
          eventId,
          "error",
          `Permission denied for action: ${action}`
        );
        throw new Error(`Permission denied for action: ${action}`);
      }
    }

    // Log the action
    await this.logEvent(
      eventId,
      "info",
      `Processing action: ${action || "default"}`
    );

    // Handle different actions
    switch (action) {
      case "deploy":
      case "deployment":
      case "trigger_build":
        return await this.triggerDeployment(
          project,
          command || payload,
          eventId
        );

      case "import":
      case "refresh":
        return await this.triggerImport(project, command || payload, eventId);

      case "update":
        return await this.updateProject(project, command || payload, eventId);

      case "create_content":
        // TODO: Implement content creation
        await this.logEvent(
          eventId,
          "info",
          "Content creation not yet implemented"
        );
        return {
          action: "content_created",
          message: "Content creation not yet implemented",
          parameters: command?.parameters,
        };

      case "read_analytics":
        // TODO: Implement analytics reading
        await this.logEvent(
          eventId,
          "info",
          "Analytics reading not yet implemented"
        );
        return {
          action: "analytics_read",
          message: "Analytics not yet implemented",
        };

      default:
        // Default action - check if payload contains deployment indicators
        if (payload.branch || payload.commit || payload.ref) {
          return await this.triggerDeployment(project, payload, eventId);
        }

        await this.logEvent(eventId, "info", "No specific action requested");
        return { message: "Webhook received but no action taken" };
    }
  }

  /**
   * Log event to webhook execution record
   * @param {ObjectId} eventId - Event ID
   * @param {string} level - Log level
   * @param {string} message - Log message
   */
  async logEvent(eventId, level, message) {
    await db.projectWebhookEvents.updateOne(
      { _id: eventId },
      {
        $push: {
          logs: {
            level,
            message,
            timestamp: new Date(),
          },
        },
      }
    );
  }

  /**
   * Update event status
   * @param {ObjectId} eventId - Event ID
   * @param {string} status - New status
   * @param {Object} result - Processing result
   * @param {string} error - Error message if failed
   */
  async updateEventStatus(eventId, status, result = null, error = null) {
    const update = {
      $set: {
        status,
        response: {
          statusCode: status === "success" ? 200 : 500,
          duration: Date.now() - new Date().getTime(),
        },
      },
    };

    if (result) {
      update.$set.response.body = result;
    }

    if (error) {
      update.$set.error = error;
    }

    await db.projectWebhookEvents.updateOne({ _id: eventId }, update);
  }

  /**
   * Trigger deployment from webhook
   * @param {Object} project - Project document
   * @param {Object} payload - Webhook payload or command
   * @param {ObjectId} eventId - Event ID
   * @returns {Object} - Deployment result
   */
  async triggerDeployment(project, payload, eventId) {
    // Handle both direct payload and AI-extracted command
    const branch = payload.branch || payload.parameters?.branch || "main";
    const commit = payload.commit || payload.parameters?.commit;
    const message = payload.message || payload.parameters?.message;

    await this.logEvent(
      eventId,
      "info",
      `Triggering deployment for branch: ${branch}`
    );

    // Get project owner's GitHub token
    const user = await db.users.findOne({ id: project.ownerId });
    const gitToken = user?.githubSupaToken || process.env.TEMP_GH_TOKEN_FELIX;

    if (!gitToken) {
      throw new Error("No GitHub token available for deployment");
    }

    // Create deployment job
    const deploymentData = {
      projectId: project._id.toString(),
      userId: project.ownerId,
      commit: commit,
      branch: branch,
      gitToken: gitToken,
      repoUrl: project.repoUrl,
      projectSlug: project.slug || project.name,
      orgSlug: project.orgId || "_unknown-org-slug",
      orgId: project.orgId,
      // Build settings from project settings
      repositoryFolder: project.settings?.build?.repositoryFolder || "",
      ignoreFiles: project.settings?.build?.ignoreFiles || "",
      triggeredBy: "webhook",
      webhook: {
        eventId: eventId.toString(),
        message: message || "Webhook triggered deployment",
      },
    };

    const job = await cloudRunService.createJob("deploy-repo", deploymentData);

    await this.logEvent(eventId, "info", `Created deployment job: ${job.id}`);

    return {
      action: "deployment",
      jobId: job.id,
      branch: branch,
      commit: commit,
    };
  }

  /**
   * Trigger import from webhook
   * @param {Object} project - Project document
   * @param {Object} payload - Webhook payload or command
   * @param {ObjectId} eventId - Event ID
   * @returns {Object} - Import result
   */
  async triggerImport(project, payload, eventId) {
    const branch = payload.branch || payload.parameters?.branch || "main";

    await this.logEvent(
      eventId,
      "info",
      `Triggering import for branch: ${branch}`
    );

    // Get project owner's GitHub token
    const user = await db.users.findOne({ id: project.ownerId });
    const gitToken = user?.githubSupaToken || process.env.TEMP_GH_TOKEN_FELIX;

    if (!gitToken) {
      throw new Error("No GitHub token available for import");
    }

    // Create import job
    const importData = {
      projectId: project._id.toString(),
      userId: project.ownerId,
      repoUrl: project.repoUrl,
      gitToken: gitToken,
      branch: branch,
      triggeredBy: "webhook",
      webhook: {
        eventId: eventId.toString(),
      },
    };

    const job = await cloudRunService.createJob("import-repo", importData);

    await this.logEvent(eventId, "info", `Created import job: ${job.id}`);

    return {
      action: "import",
      jobId: job.id,
      branch: branch,
    };
  }

  /**
   * Update project from webhook
   * @param {Object} project - Project document
   * @param {Object} payload - Webhook payload or command
   * @param {ObjectId} eventId - Event ID
   * @returns {Object} - Update result
   */
  async updateProject(project, payload, eventId) {
    const updates = payload.updates || payload.parameters || {};

    await this.logEvent(eventId, "info", `Updating project fields`);

    // Whitelist of allowed fields to update
    const allowedFields = ["name", "description", "visibility", "settings"];
    const filteredUpdates = {};

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error("No valid fields to update");
    }

    // Update project
    await db.projects.updateOne(
      { _id: project._id },
      { $set: filteredUpdates }
    );

    await this.logEvent(eventId, "info", "Project updated successfully");

    return {
      action: "update",
      updated: Object.keys(filteredUpdates),
    };
  }

  /**
   * Extract command from payload using AI
   * @param {Object} webhook - Webhook configuration with AI instructions
   * @param {Object} payload - Raw webhook payload
   * @returns {Object} - Extracted command
   */
  async extractCommandWithAI(webhook, payload) {
    try {
      const agent = this.createWebhookAgent(webhook);

      const prompt = `Extract command from: ${JSON.stringify(payload)}`;

      const response = await agent.generateText(prompt, {
        provider: {
          temperature: 0.1,
          maxTokens: 500,
        },
      });

      // Try to parse the response as JSON
      try {
        return JSON.parse(response.text);
      } catch (parseError) {
        // If not valid JSON, try to extract JSON from the text
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw parseError;
      }
    } catch (error) {
      console.error("AI extraction failed:", error);
      return { action: "none", error: "Failed to extract command" };
    }
  }

  /**
   * Check if webhook has permission for action
   * @param {Object} permissions - Webhook permissions object
   * @param {string} action - Action to check
   * @returns {boolean} - Whether action is permitted
   */
  hasPermission(permissions, action) {
    // Simple permission mapping
    const permissionMap = {
      create_content: "content_management.create_content",
      update_content: "content_management.update_content",
      delete_content: "content_management.delete_content",
      trigger_build: "deployment.trigger_build",
      deploy_preview: "deployment.deploy_preview",
      rollback: "deployment.rollback",
      read_analytics: "data_access.read_analytics",
      // Add more mappings as needed
    };

    const requiredPath = permissionMap[action];
    if (!requiredPath) return false;

    const [category, capability] = requiredPath.split(".");
    return permissions?.[category]?.[capability] === true;
  }
}

export default new WebhookProcessor();
