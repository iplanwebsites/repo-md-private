#!/usr/bin/env node

/**
 * Test script for Slack LLM integration
 * Simulates Slack events to test the integrated handler
 */

import dotenv from "dotenv";
dotenv.config();

import { SlackMessageHandlerIntegrated } from "../lib/slack/messageHandlerIntegrated.js";
import { WebClient } from "@slack/web-api";
import { connectDb, db } from "../db.js";

// Mock Slack client for testing
class MockSlackClient {
	constructor() {
		this.botUserId = "U12345BOT";
	}

	async auth() {
		return {
			test: async () => ({ user_id: this.botUserId })
		};
	}

	async users() {
		return {
			info: async ({ user }) => ({
				user: {
					id: user,
					profile: {
						email: "test@example.com",
						display_name: "Test User"
					}
				}
			})
		};
	}

	async chat() {
		return {
			postMessage: async (params) => {
				console.log("\n📤 Bot would send to Slack:");
				console.log(`   Channel: ${params.channel}`);
				console.log(`   Thread: ${params.thread_ts || "new thread"}`);
				if (params.text) {
					console.log(`   Text: ${params.text}`);
				}
				if (params.blocks) {
					console.log(`   Blocks: ${JSON.stringify(params.blocks, null, 2)}`);
				}
				return { ts: Date.now().toString() };
			}
		};
	}

	// Add WebClient-style method delegation
	get chat() {
		return {
			postMessage: async (params) => {
				console.log("\n📤 Bot would send to Slack:");
				console.log(`   Channel: ${params.channel}`);
				console.log(`   Thread: ${params.thread_ts || "new thread"}`);
				if (params.text) {
					console.log(`   Text: ${params.text}`);
				}
				if (params.blocks) {
					console.log(`   Blocks: ${JSON.stringify(params.blocks, null, 2)}`);
				}
				return { ts: Date.now().toString() };
			}
		};
	}

	get users() {
		return {
			info: async ({ user }) => ({
				user: {
					id: user,
					profile: {
						email: "test@example.com",
						display_name: "Test User"
					}
				}
			})
		};
	}
}

async function testIntegration() {
	console.log("🧪 Testing Slack LLM Integration...\n");

	try {
		// Connect to database
		console.log("📦 Connecting to database...");
		await connectDb();

		// Get test org and create/update slack installation
		const testOrg = await db.orgs.findOne({});
		if (!testOrg) {
			throw new Error("No test org found in database");
		}
		console.log(`✅ Found test org: ${testOrg.name}`);
		
		// Create a test user
		const testUserEmail = "test@example.com";
		await db.users.updateOne(
			{ email: testUserEmail },
			{
				$set: {
					email: testUserEmail,
					name: "Test User",
					orgs: [testOrg._id],
					systemRole: "editor",
					createdAt: new Date()
				}
			},
			{ upsert: true }
		);
		console.log(`✅ Created test user: ${testUserEmail}`);
		
		// Create a test Slack installation
		const testTeamId = "T12345TEAM";
		
		// Update org with Slack integration
		await db.orgs.updateOne(
			{ _id: testOrg._id },
			{
				$set: {
					slackIntegration: {
						teamId: testTeamId,
						teamName: "Test Team",
						installedAt: new Date(),
						installedBy: "U12345USER"
					}
				}
			}
		);
		
		// Create Slack installation record
		await db.slackInstallations.updateOne(
			{ teamId: testTeamId },
			{
				$set: {
					teamId: testTeamId,
					teamName: "Test Team",
					botToken: "xoxb-test-token",
					botId: "U12345BOT",
					botUserId: "U12345BOT",
					orgId: testOrg._id,
					installedAt: new Date(),
					installedBy: "U12345USER"
				}
			},
			{ upsert: true }
		);
		console.log(`✅ Created test Slack installation and updated org\n`);

		// Create handler with mock client
		const mockClient = new MockSlackClient();
		const handler = new SlackMessageHandlerIntegrated(mockClient);

		// Test 1: Ping command (should use parent handler)
		console.log("📝 Test 1: Ping command");
		const pingEvent = {
			type: "app_mention",
			text: "<@U12345BOT> ping",
			user: "U12345USER",
			channel: "C12345CHANNEL",
			ts: "1234567890.123456"
		};

		// Handler will get installation and org from initialize method

		await handler.handleAppMention(pingEvent, "T12345TEAM");
		console.log("✅ Ping command handled\n");

		// Test 2: Deploy command (should use parent handler)
		console.log("📝 Test 2: Deploy command");
		const deployEvent = {
			type: "app_mention",
			text: "<@U12345BOT> deploy my-project",
			user: "U12345USER",
			channel: "C12345CHANNEL",
			ts: "1234567890.123457"
		};

		await handler.handleAppMention(deployEvent, "T12345TEAM");
		console.log("✅ Deploy command handled\n");

		// Test 3: General question (should use LLM)
		console.log("📝 Test 3: General question to LLM");
		const questionEvent = {
			type: "app_mention",
			text: "<@U12345BOT> what is the weather like?",
			user: "U12345USER",
			channel: "C12345CHANNEL",
			ts: "1234567890.123458"
		};

		console.log("⏳ Processing with LLM (this may take a moment)...");
		await handler.handleAppMention(questionEvent, "T12345TEAM");
		console.log("✅ LLM question handled\n");

		// Test 4: Slash command - /continue
		console.log("📝 Test 4: /continue slash command");
		const continueCommand = {
			command: "/continue",
			text: "6865a042de66167f9546f430",
			channel_id: "C12345CHANNEL",
			user_id: "U12345USER",
			team_id: "T12345TEAM",
			response_url: "https://hooks.slack.com/commands/1234/5678"
		};

		const continueResult = await handler.handleSlashCommand(continueCommand);
		console.log("Response:", continueResult);
		console.log("✅ /continue command handled\n");

		// Test 5: Slash command - /chats
		console.log("📝 Test 5: /chats slash command");
		const chatsCommand = {
			command: "/chats",
			text: "",
			channel_id: "C12345CHANNEL",
			user_id: "U12345USER",
			team_id: "T12345TEAM",
			response_url: "https://hooks.slack.com/commands/1234/5679"
		};

		const chatsResult = await handler.handleSlashCommand(chatsCommand);
		console.log("Response type:", chatsResult.response_type);
		console.log("Has blocks:", !!chatsResult.blocks);
		console.log("✅ /chats command handled\n");

		console.log("✅ All tests completed successfully!");

	} catch (error) {
		console.error("\n❌ Test failed:", error);
		console.error(error.stack);
	} finally {
		// Close database connection
		if (db.client) {
			await db.client.close();
		}
		process.exit(0);
	}
}

// Run tests
testIntegration();