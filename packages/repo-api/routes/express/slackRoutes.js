import express from "express";
import pkg from "@slack/bolt";
const { App } = pkg;
import { db } from "../../db.js";
import asyncHandler from "../../utils/asyncHandler.js";
import messageHandlerFactory from "../../lib/slack/messageHandlerFactory.js";
import agentManager from "../../lib/slack/agentManager.js";

const router = express.Router();

// Helper function to get base URL
const getBaseUrl = () => {
  if (
    process.env.USE_SLACK_DEV === "true" &&
    process.env.API_BASE_URL_DEV_TUNEL
  ) {
    return process.env.API_BASE_URL_DEV_TUNEL;
  } else if (
    process.env.USE_SLACK_DEV === "true" &&
    process.env.API_BASE_URL_DEV
  ) {
    return process.env.API_BASE_URL_DEV;
  } else if (process.env.USE_SLACK_DEV === "true") {
    return `http://localhost:${process.env.PORT || 3001}`;
  }
  return process.env.API_BASE_URL || "http://localhost:3001";
};

// Log Slack configuration mode
if (process.env.USE_SLACK_DEV === "true") {
  console.log("🔧 Slack integration running in DEVELOPMENT mode");
  console.log(`📍 Using redirect URL: ${getBaseUrl()}/api/slack/callback`);
} else {
  console.log("🚀 Slack integration running in PRODUCTION mode");
  console.log(`📍 Using redirect URL: ${getBaseUrl()}/api/slack/callback`);
}

// Initialize Slack app with OAuth
const slackApp = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  stateSecret: process.env.SLACK_STATE_SECRET || "default-state-secret",
  scopes: [
    "chat:write",
    "commands",
    "users:read",
    "users:read.email",
    "channels:read",
    "groups:read",
    "app_mentions:read",
    "chat:write.public",
    "channels:history",
    "groups:history",
    "im:history",
    "mpim:history",
  ],
  installerOptions: {
    stateStore: false, // We'll handle state manually
  },
  installationStore: {
    storeInstallation: async (installation) => {
      try {
        // Store installation data in MongoDB
        const { team } = installation;
        const result = await db.slackInstallations.updateOne(
          { teamId: team.id },
          {
            $set: {
              teamId: team.id,
              teamName: team.name,
              botToken: installation.bot.token,
              botUserId: installation.bot.userId,
              installationData: installation,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          { upsert: true }
        );

        console.log("✅ Stored Slack installation for team:", team.name);
        return result;
      } catch (error) {
        console.error("Error storing installation:", error);
        throw error;
      }
    },
    fetchInstallation: async (installQuery) => {
      try {
        const installation = await db.slackInstallations.findOne({
          teamId: installQuery.teamId,
        });

        if (!installation) {
          throw new Error("Installation not found");
        }

        return installation.installationData;
      } catch (error) {
        console.error("Error fetching installation:", error);
        throw error;
      }
    },
    deleteInstallation: async (installQuery) => {
      try {
        const result = await db.slackInstallations.deleteOne({
          teamId: installQuery.teamId,
        });

        return result.deletedCount > 0;
      } catch (error) {
        console.error("Error deleting installation:", error);
        throw error;
      }
    },
  },
});

// Log available properties for debugging
console.log("Slack app properties:", Object.keys(slackApp));
console.log("Has installer?", !!slackApp.installer);

// OAuth callback handler
router.get(
  "/callback",
  asyncHandler(async (req, res) => {
    try {
      const { code, state } = req.query;

      if (!code) {
        return res.status(400).send("Missing code parameter");
      }

      // Decode state to get orgId and userId
      let stateData;
      try {
        stateData = JSON.parse(Buffer.from(state, "base64").toString());
      } catch (e) {
        console.error("Error parsing state:", e);
        return res.status(400).send("Invalid state parameter");
      }

      // Exchange code for access token
      const { WebClient } = await import("@slack/web-api");

      // Use helper function to get base URL
      const baseUrl = getBaseUrl();
      const redirectUri = `${baseUrl}/api/slack/callback`;

      const result = await new WebClient().oauth.v2.access({
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      });

      if (!result.ok) {
        throw new Error("OAuth exchange failed");
      }

      // Store the installation
      const installation = {
        team: {
          id: result.team.id,
          name: result.team.name,
        },
        bot: {
          token: result.access_token,
          scopes: result.scope.split(","),
          id: result.bot_user_id,
          userId: result.bot_user_id,
        },
        authVersion: "v2",
        isEnterpriseInstall: false,
      };

      // Store in Slack installations collection
      await db.slackInstallations.updateOne(
        { teamId: result.team.id },
        {
          $set: {
            teamId: result.team.id,
            teamName: result.team.name,
            botToken: result.access_token,
            botUserId: result.bot_user_id,
            installationData: installation,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      // Update the organization with Slack integration
      await db.orgs.updateOne(
        { handle: stateData.orgId },
        {
          $set: {
            slackIntegration: {
              teamId: result.team.id,
              teamName: result.team.name,
              installedAt: new Date(),
              installedBy: stateData.userId,
              channels: [], // To be configured later
            },
            updated_at: new Date(),
          },
        }
      );

      console.log(
        `✅ Connected Slack team ${result.team.name} to org ${stateData.orgId}`
      );

      // Success page
      res.send(`
			<html>
				<head>
					<title>Slack Integration Success</title>
					<style>
						body {
							font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
							display: flex;
							align-items: center;
							justify-content: center;
							height: 100vh;
							margin: 0;
							background-color: #f5f5f5;
						}
						.container {
							text-align: center;
							background: white;
							padding: 2rem;
							border-radius: 8px;
							box-shadow: 0 2px 4px rgba(0,0,0,0.1);
						}
						h1 { color: #2ea664; }
						p { color: #666; }
					</style>
				</head>
				<body>
					<div class="container">
						<h1>✅ Slack Integration Successful!</h1>
						<p>Your Slack workspace "${result.team.name}" has been connected.</p>
						<p>You can now close this window and return to Repo.md.</p>
						<script>
							setTimeout(() => {
								if (window.opener) {
									window.opener.postMessage({ type: 'slack-connected' }, '*');
								}
								window.close();
							}, 3000);
						</script>
					</div>
				</body>
			</html>
		`);
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.status(500).send(`
			<html>
				<head>
					<title>Slack Integration Failed</title>
					<style>
						body {
							font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
							display: flex;
							align-items: center;
							justify-content: center;
							height: 100vh;
							margin: 0;
							background-color: #f5f5f5;
						}
						.container {
							text-align: center;
							background: white;
							padding: 2rem;
							border-radius: 8px;
							box-shadow: 0 2px 4px rgba(0,0,0,0.1);
						}
						h1 { color: #e74c3c; }
						p { color: #666; }
					</style>
				</head>
				<body>
					<div class="container">
						<h1>❌ Authentication Failed</h1>
						<p>There was an error connecting your Slack workspace.</p>
						<p>Please try again or contact support.</p>
					</div>
				</body>
			</html>
		`);
    }
  })
);

// OAuth installation initiation - connects Slack team to an org
// This endpoint should be called from the frontend with proper authentication
router.get(
  "/install",
  asyncHandler(async (req, res) => {
    const { orgId, userId } = req.query;

    // Basic validation
    if (!orgId || !userId) {
      return res
        .status(400)
        .json({ error: "Missing orgId or userId parameter" });
    }

    // Verify user has access to the organization
    const org = await db.orgs.findOne({
      handle: orgId,
      $or: [
        { owner: userId },
        {
          "members.userId": userId,
          "members.role": { $in: ["admin", "owner"] },
        },
      ],
    });

    if (!org) {
      return res.status(403).json({
        error:
          "You don't have permission to install Slack for this organization",
      });
    }

    // Generate a state parameter that includes orgId and userId
    const state = Buffer.from(
      JSON.stringify({
        orgId: org.handle,
        userId: userId,
        timestamp: Date.now(),
      })
    ).toString("base64");

    // Generate installation URL with state
    // Use helper function to get base URL
    const baseUrl = getBaseUrl();
    const redirectUri = `${baseUrl}/api/slack/callback`;

    // Manually construct Slack OAuth URL
    const scopes = [
      "chat:write",
      "commands",
      "users:read",
      "users:read.email",
      "channels:read",
      "groups:read",
      "app_mentions:read",
      "chat:write.public",
      "channels:history",
      "groups:history",
      "im:history",
      "mpim:history",
    ];
    const userScopes = ["identity.basic", "identity.email"];

    const params = new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID,
      scope: scopes.join(","),
      user_scope: userScopes.join(","),
      redirect_uri: redirectUri,
      state: state,
    });

    const installUrl = `https://slack.com/oauth/v2/authorize?${params.toString()}`;

    console.log("Generated install URL:", installUrl);
    res.redirect(installUrl);
  })
);

// Handle interactive components (buttons, modals, etc.)
router.post(
  "/interactive",
  asyncHandler(async (req, res) => {
    console.log("🎮 Received interactive component");

    try {
      // Parse the payload
      const payload = JSON.parse(req.body.payload);
      const { type, user, team, channel, actions, view } = payload;

      // Acknowledge the request immediately
      res.status(200).send();

      // Handle different interaction types
      if (type === "block_actions") {
        // Handle button clicks
        for (const action of actions) {
          if (action.action_id === "open_settings_modal") {
            await openSettingsModal(payload);
          } else if (action.action_id === "retry_agent") {
            await retryAgent(payload);
          } else if (action.action_id.startsWith("set_default_project_")) {
            await handleSetDefaultProject(payload, action);
          }
          // Other button actions are URL buttons, handled by Slack
        }
      } else if (type === "view_submission") {
        // Handle modal submissions
        if (view.callback_id === "channel_settings_modal") {
          await handleSettingsSubmission(payload);
        }
      } else if (type === "shortcut") {
        // Handle shortcuts (context menu actions)
        if (payload.callback_id === "add_followup") {
          await openFollowUpModal(payload);
        } else if (payload.callback_id === "delete_agent") {
          await handleDeleteAgent(payload);
        }
      }
    } catch (error) {
      console.error("Error handling interactive component:", error);
    }
  })
);

// Helper functions for interactive components
async function openSettingsModal(payload) {
  const { trigger_id, channel, team } = payload;

  // Get current settings
  const org = await db.orgs.findOne({ "slackIntegration.teamId": team.id });
  if (!org) return;

  const currentSettings = await agentManager.getChannelSettings(
    channel.id,
    team.id
  );

  // Open modal
  const { WebClient } = await import("@slack/web-api");
  const installation = await db.slackInstallations.findOne({ teamId: team.id });
  const client = new WebClient(installation.botToken);

  await client.views.open({
    trigger_id,
    view: {
      type: "modal",
      callback_id: "channel_settings_modal",
      title: {
        type: "plain_text",
        text: "Channel Settings",
      },
      submit: {
        type: "plain_text",
        text: "Save",
      },
      close: {
        type: "plain_text",
        text: "Cancel",
      },
      private_metadata: JSON.stringify({ channelId: channel.id }),
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "Configure default settings for Background Agents in this channel.",
          },
        },
        {
          type: "input",
          block_id: "repository",
          label: {
            type: "plain_text",
            text: "Default Repository",
          },
          element: {
            type: "plain_text_input",
            action_id: "repository_input",
            placeholder: {
              type: "plain_text",
              text: "org/repository",
            },
            initial_value: currentSettings.repository || "",
          },
          optional: true,
        },
        {
          type: "input",
          block_id: "branch",
          label: {
            type: "plain_text",
            text: "Default Branch",
          },
          element: {
            type: "plain_text_input",
            action_id: "branch_input",
            placeholder: {
              type: "plain_text",
              text: "main",
            },
            initial_value: currentSettings.branch || "",
          },
          optional: true,
        },
        {
          type: "input",
          block_id: "model",
          label: {
            type: "plain_text",
            text: "Default Model",
          },
          element: {
            type: "static_select",
            action_id: "model_select",
            placeholder: {
              type: "plain_text",
              text: "Select a model",
            },
            options: [
              {
                text: { type: "plain_text", text: "gpt-4.1-mini" },
                value: "gpt-4.1-mini",
              },
              {
                text: { type: "plain_text", text: "GPT-3.5" },
                value: "gpt-3.5",
              },
              { text: { type: "plain_text", text: "O3" }, value: "o3" },
              { text: { type: "plain_text", text: "Claude" }, value: "claude" },
            ],
            initial_option: currentSettings.model
              ? {
                  text: { type: "plain_text", text: currentSettings.model },
                  value: currentSettings.model,
                }
              : undefined,
          },
          optional: true,
        },
        {
          type: "input",
          block_id: "autopr",
          label: {
            type: "plain_text",
            text: "Auto PR Creation",
          },
          element: {
            type: "radio_buttons",
            action_id: "autopr_radio",
            options: [
              { text: { type: "plain_text", text: "Enabled" }, value: "true" },
              {
                text: { type: "plain_text", text: "Disabled" },
                value: "false",
              },
            ],
            initial_option: {
              text: {
                type: "plain_text",
                text: currentSettings.autopr !== false ? "Enabled" : "Disabled",
              },
              value: currentSettings.autopr !== false ? "true" : "false",
            },
          },
        },
      ],
    },
  });
}

async function handleSettingsSubmission(payload) {
  const { view, user, team } = payload;
  const { channelId } = JSON.parse(view.private_metadata);

  // Extract values from modal
  const values = view.state.values;
  const settings = {
    repository: values.repository?.repository_input?.value || undefined,
    branch: values.branch?.branch_input?.value || undefined,
    model: values.model?.model_select?.selected_option?.value || undefined,
    autopr: values.autopr?.autopr_radio?.selected_option?.value === "true",
  };

  // Remove undefined values
  Object.keys(settings).forEach((key) => {
    if (settings[key] === undefined || settings[key] === "") {
      delete settings[key];
    }
  });

  // Get org
  const org = await db.orgs.findOne({ "slackIntegration.teamId": team.id });
  if (!org) return;

  // Update settings
  await agentManager.updateChannelSettings(
    channelId,
    team.id,
    org._id,
    settings,
    user.id
  );

  // Send confirmation message
  const { WebClient } = await import("@slack/web-api");
  const installation = await db.slackInstallations.findOne({ teamId: team.id });
  const client = new WebClient(installation.botToken);

  await client.chat.postMessage({
    channel: channelId,
    text: "✅ Channel settings updated successfully!",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "✅ *Channel settings updated successfully!*",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: Object.entries(settings)
            .map(([key, value]) => `• *${key}:* ${value}`)
            .join("\n"),
        },
      },
    ],
  });
}

async function retryAgent(payload) {
  // Mock implementation - would retry the agent
  console.log("Retrying agent:", payload.actions[0].value);
}

async function handleSetDefaultProject(payload, action) {
  const { user, team, channel } = payload;
  const { projectId, repoName, channelId } = JSON.parse(action.value);

  try {
    // Get org
    const org = await db.orgs.findOne({ "slackIntegration.teamId": team.id });
    if (!org) return;

    // Update channel settings
    await agentManager.updateChannelSettings(
      channelId,
      team.id,
      org._id,
      { repository: repoName },
      user.id
    );

    // Get updated project info
    const project = await db.projects.findOne({ _id: new ObjectId(projectId) });

    // Send confirmation message
    const { WebClient } = await import("@slack/web-api");
    const installation = await db.slackInstallations.findOne({
      teamId: team.id,
    });
    const client = new WebClient(installation.botToken);

    await client.chat.postMessage({
      channel: channel.id,
      text: `✅ Default project updated!`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `✅ *Default project updated!*`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${project.name}* is now the default project for this channel.\n🔗 \`${repoName}\`\n\nAll new agents will use this repository unless you specify a different one.`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Set by <@${user.id}> • Use \`@repo settings\` to change`,
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error("Error setting default project:", error);
  }
}

// Simple in-memory cache for event deduplication
// In production, use Redis or similar
const processedEvents = new Map();
const EVENT_CACHE_TTL = 60 * 1000; // 60 seconds

// Clean up old events periodically
setInterval(() => {
  const now = Date.now();
  for (const [eventId, timestamp] of processedEvents.entries()) {
    if (now - timestamp > EVENT_CACHE_TTL) {
      processedEvents.delete(eventId);
    }
  }
}, 30 * 1000); // Clean every 30 seconds

// Handle Slack events (including slash commands)
// Note: Don't use express.raw() here - let express.json() handle it from the main app
router.post(
  "/events",
  asyncHandler(async (req, res) => {
    console.log("📨 Received Slack event:", req.body?.type || "unknown");

    // Handle URL verification challenge
    if (req.body && req.body.type === "url_verification") {
      console.log("📡 Responding to Slack URL verification challenge");
      console.log("Challenge:", req.body.challenge);
      return res.json({ challenge: req.body.challenge });
    }

    // Handle event callbacks
    if (req.body && req.body.type === "event_callback") {
      const eventId = req.body.event_id;
      const event = req.body.event;
      const teamId = req.body.team_id;

      console.log("📬 Processing event callback:", {
        type: event?.type,
        eventId: eventId,
        eventTime: req.body.event_time,
        retryNum: req.headers["x-slack-retry-num"],
        retryReason: req.headers["x-slack-retry-reason"],
      });

      // Check if we've already processed this event
      if (eventId && processedEvents.has(eventId)) {
        console.log("⚠️ Duplicate event detected, skipping:", eventId);
        return res.status(200).send();
      }

      // Mark event as processed
      if (eventId) {
        processedEvents.set(eventId, Date.now());
      }

      try {
        // Route to appropriate handler based on event type
        if (event && event.type === "app_mention") {
          console.log("📢 App mentioned");
          await messageHandlerFactory.handleAppMention(event, teamId);
        } else if (
          event &&
          event.type === "message" &&
          event.thread_ts &&
          !event.bot_id
        ) {
          console.log("💬 Thread reply received");
          await messageHandlerFactory.handleThreadReply(event, teamId);
        }
      } catch (error) {
        console.error("Error processing event:", error);
        // Still return 200 to prevent Slack retries
      }
    }

    // Always return 200 for events
    res.status(200).send();
  })
);

// Slack command handler for /projects
slackApp.command("/projects", async ({ command, ack, respond }) => {
  await ack();

  try {
    // Find the org associated with this Slack team
    const slackIntegration = await db.orgs.findOne({
      "slackIntegration.teamId": command.team_id,
    });

    if (!slackIntegration) {
      await respond({
        text: "This Slack workspace is not connected to any organization. Please contact your admin to set up the integration.",
      });
      return;
    }

    // Get all projects for this org
    const projects = await db.projects
      .find({
        orgId: slackIntegration._id,
      })
      .sort({ updatedAt: -1 })
      .limit(20)
      .toArray();

    if (projects.length === 0) {
      await respond({
        text: `No projects found in ${slackIntegration.name}.`,
      });
      return;
    }

    // Format projects list
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Projects in ${slackIntegration.name}*`,
        },
      },
      {
        type: "divider",
      },
    ];

    for (const project of projects) {
      const visibility = project.visibility === "private" ? "🔒" : "🌐";
      const adminUrl = `https://repo.md/${slackIntegration.handle}/${project._id}`;
      const liveUrl = `https://${project._id}.repo.md`;

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${visibility} *<${adminUrl}|${project.name}>*\n${
            project.description || "No description"
          }\n<${liveUrl}|View Live Site ›>`,
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "Admin",
          },
          url: adminUrl,
          action_id: `view_project_${project._id}`,
        },
      });
    }

    await respond({
      blocks,
      text: `Found ${projects.length} projects in ${slackIntegration.name}`,
    });
  } catch (error) {
    console.error("Error handling /projects command:", error);
    await respond({
      text: "Sorry, something went wrong while fetching projects. Please try again later.",
    });
  }
});

// Slash command handler
router.post(
  "/commands",
  asyncHandler(async (req, res) => {
    const payload = req.body;

    try {
      // Handle slash commands through the appropriate handler
      const result = await messageHandlerFactory.handleSlashCommand(payload);

      // Send response
      if (result) {
        res.json(result);
      } else {
        res.status(200).send();
      }
    } catch (error) {
      console.error("Error handling slash command:", error);
      res.json({
        response_type: "ephemeral",
        text: "Sorry, something went wrong processing your command.",
      });
    }
  })
);

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    configured: !!(
      process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET
    ),
  });
});

export default router;
