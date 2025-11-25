/**
 * Quick test script for Slack Background Agents
 */

import { parseCommand } from "../lib/slack/commandParser.js";
import agentManager from "../lib/slack/agentManager.js";
import { connectDb } from "../db.js";
import dotenv from "dotenv";

dotenv.config();

async function testAgentSystem() {
  console.log("🧪 Testing Slack Background Agents...\n");

  // Connect to database
  await connectDb();

  // Test 1: Command Parsing
  console.log("1️⃣ Testing Command Parser:");
  const testCommands = [
    "<@U123456> help",
    "<@U123456> fix the login bug",
    "<@U123456> [repo=myorg/api, branch=fix/auth] update token validation",
    "<@U123456> branch=main model=gpt-4 implement dark mode",
    "<@U123456> agent force new agent even in thread",
    "<@U123456> list my agents",
    "<@U123456> settings",
  ];

  testCommands.forEach((cmd) => {
    const parsed = parseCommand(cmd, "U123456");
    console.log(`\nCommand: "${cmd}"`);
    console.log("Parsed:", JSON.stringify(parsed, null, 2));
  });

  // Test 2: Agent Creation
  console.log("\n\n2️⃣ Testing Agent Creation:");
  const testAgent = await agentManager.createAgent({
    orgId: "507f1f77bcf86cd799439011",
    channelId: "C1234567890",
    threadTs: "1234567890.123456",
    userId: "U987654321",
    userName: "Test User",
    command: "fix the login bug",
    options: {
      branch: "fix/auth",
      model: "gpt-4.1-mini",
      repo: "myorg/api",
    },
    projectId: null,
    teamId: "T123456",
  });

  console.log("Created agent:", JSON.stringify(testAgent, null, 2));

  // Test 3: Channel Settings
  console.log("\n\n3️⃣ Testing Channel Settings:");
  await agentManager.updateChannelSettings(
    "C1234567890",
    "T123456",
    "507f1f77bcf86cd799439011",
    {
      repository: "myorg/frontend",
      branch: "main",
      model: "gpt-4.1-mini",
      autopr: true,
    },
    "U987654321"
  );

  const settings = await agentManager.getChannelSettings(
    "C1234567890",
    "T123456"
  );
  console.log("Channel settings:", settings);

  // Test 4: Options Merging
  console.log("\n\n4️⃣ Testing Options Merging:");
  const merged = await agentManager.mergeWithDefaults(
    { branch: "feature/test" },
    "C1234567890",
    "T123456",
    "507f1f77bcf86cd799439011"
  );
  console.log("Merged options:", merged);

  // Test 5: List User Agents
  console.log("\n\n5️⃣ Testing List User Agents:");
  const userAgents = await agentManager.getUserAgents("U987654321", "T123456");
  console.log(`Found ${userAgents.length} agents for user`);

  // Test 6: Mock Agent Execution
  console.log("\n\n6️⃣ Testing Agent Execution (5 second mock):");
  console.log("Starting agent execution...");
  await agentManager.executeAgent(testAgent);
  console.log("Agent execution started (will complete in 5 seconds)");

  // Wait to see completion
  setTimeout(async () => {
    const completedAgent = await agentManager.getUserAgents(
      "U987654321",
      "T123456",
      true
    );
    console.log("\nAgent status after execution:");
    console.log(completedAgent[0]);
    process.exit(0);
  }, 6000);
}

// Run tests
testAgentSystem().catch(console.error);
