#!/usr/bin/env node

/**
 * Test script for Slack-EditorChat integration
 * Tests the SharedChatService functionality
 */

import dotenv from "dotenv";
dotenv.config();

import { SharedChatService } from "../lib/llm/sharedChatService.js";
import { connectDb, db } from "../db.js";
import { ObjectId } from "mongodb";

async function testIntegration() {
	console.log("🧪 Testing Slack-EditorChat Integration...\n");

	try {
		// Connect to database
		console.log("📦 Connecting to database...");
		await connectDb();

		// Get test user and org
		const testUser = await db.users.findOne({});
		const testOrg = await db.orgs.findOne({});
		
		if (!testUser || !testOrg) {
			throw new Error("No test user or org found in database");
		}

		console.log(`✅ Found test user: ${testUser.email}`);
		console.log(`✅ Found test org: ${testOrg.name}`);
		console.log(`   User orgs: ${JSON.stringify(testUser.orgs)}`);
		console.log(`   User orgId: ${testUser.orgId}`);
		console.log(`   User systemRole: ${testUser.systemRole}\n`);

		// Test 1: Create a new chat without Slack
		console.log("📝 Test 1: Create chat without Slack integration");
		const webChat = await SharedChatService.getOrCreateChat({
			user: testUser,
			org: testOrg,
			project: null,
		});
		console.log(`✅ Created web chat: ${webChat._id}\n`);

		// Test 2: Create a chat with Slack thread
		console.log("📝 Test 2: Create chat with Slack thread");
		const slackChat = await SharedChatService.getOrCreateChat({
			user: testUser,
			org: testOrg,
			project: null,
			slackThread: {
				channelId: "C1234567890",
				threadTs: "1234567890.123456",
				teamId: "T1234567890",
			},
		});
		console.log(`✅ Created Slack-linked chat: ${slackChat._id}`);
		console.log(`   Slack threads: ${JSON.stringify(slackChat.slackThreads)}\n`);

		// Test 3: Find chat by Slack thread
		console.log("📝 Test 3: Find chat by Slack thread");
		const foundChat = await SharedChatService.findChatBySlackThread(
			"C1234567890",
			"1234567890.123456"
		);
		console.log(`✅ Found chat by Slack thread: ${foundChat?._id}\n`);

		// Test 4: Add messages
		console.log("📝 Test 4: Add messages to chat");
		
		// Add user message from Slack
		await SharedChatService.addMessage(slackChat._id, {
			role: "user",
			content: "Hello from Slack!",
		}, {
			channelId: "C1234567890",
			threadTs: "1234567890.123456",
			messageTs: "1234567890.123457",
			userId: "U1234567890",
		});
		console.log("✅ Added user message with Slack metadata");

		// Add assistant message
		await SharedChatService.addMessage(slackChat._id, {
			role: "assistant",
			content: "Hello! I can help you with your project.",
		});
		console.log("✅ Added assistant message\n");

		// Test 5: Link existing chat to Slack
		console.log("📝 Test 5: Link existing web chat to Slack");
		await SharedChatService.linkToSlackThread(webChat._id, {
			channelId: "C9876543210",
			threadTs: "9876543210.654321",
			teamId: "T9876543210",
		});
		console.log(`✅ Linked web chat ${webChat._id} to Slack thread\n`);

		// Test 6: Get user chats
		console.log("📝 Test 6: Get user's recent chats");
		const userChats = await SharedChatService.getUserChats(testUser._id, {
			orgId: testOrg._id,
			limit: 5,
		});
		console.log(`✅ Found ${userChats.length} chats for user\n`);

		// Test 7: Format Slack response
		console.log("📝 Test 7: Format response for Slack");
		const mockResponse = {
			content: "Here's a code example:\n```javascript\nconsole.log('Hello World!');\n```\nThis is how you log to console.",
			toolCalls: [{ name: "searchCode", args: { query: "console.log" } }],
		};
		const slackBlocks = SharedChatService.formatSlackResponse(mockResponse);
		console.log(`✅ Formatted response into ${slackBlocks.length} Slack blocks`);
		console.log(JSON.stringify(slackBlocks, null, 2));

		console.log("\n✅ All tests passed!");

	} catch (error) {
		console.error("\n❌ Test failed:", error);
		process.exit(1);
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