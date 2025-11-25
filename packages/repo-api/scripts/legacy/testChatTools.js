#!/usr/bin/env node
import "dotenv/config";
import { EditorChatHandler } from "../lib/llm/editorChat.js";
import { connectDb } from "../db.js";
import { ObjectId } from "mongodb";

// Mock user and org
const mockUser = {
  _id: new ObjectId(),
  id: "test123",
  name: "Test User",
  email: "test@example.com",
  permissions: ["read", "write"]
};

const mockOrg = {
  _id: new ObjectId(), 
  id: "org123",
  name: "Test Org",
  handle: "test-org"
};

async function testChatWithTools() {
  console.log("🧪 Testing EditorChat with tools (including weather)...\n");

  try {
    // Connect to database
    await connectDb();
    console.log("✅ Connected to database");
    
    // Create chat handler
    const handler = new EditorChatHandler({
      user: mockUser,
      org: mockOrg,
      model: "gpt-4.1-mini",
      temperature: 0.7,
      stream: false, // Disable streaming for easier testing
      agentArchetype: "GENERALIST", // Use generalist to get utilities
      debug: true
    });

    await handler.initialize();
    console.log("✅ Chat initialized with ID:", handler.chatId);

    // Test 1: Ask about weather
    console.log("\n📍 Test 1: Weather query");
    console.log("User: What's the weather like in Paris?");
    
    const response1 = await handler.sendMessage("What's the weather like in Paris?");
    
    console.log("\n🤖 Assistant response:");
    if (typeof response1 === 'object' && response1.toolsUsed) {
      console.log("Message:", response1.content || response1.message || response1);
      console.log("\n🛠️  Tools used:", response1.toolsUsed.length);
      response1.toolsUsed.forEach((tool, i) => {
        console.log(`\nTool ${i + 1}:`, tool.toolName);
        console.log("Args:", JSON.stringify(tool.args, null, 2));
        console.log("Result:", JSON.stringify(tool.result, null, 2));
      });
    } else {
      console.log("Response:", response1);
    }

    // Test 2: Multiple locations
    console.log("\n\n📍 Test 2: Multiple weather queries");
    console.log("User: Compare the weather in New York and Tokyo");
    
    const response2 = await handler.sendMessage("Compare the weather in New York and Tokyo");
    
    console.log("\n🤖 Assistant response:");
    if (typeof response2 === 'object' && response2.toolsUsed) {
      console.log("Message:", response2.content || response2.message || response2);
      console.log("\n🛠️  Tools used:", response2.toolsUsed.length);
      response2.toolsUsed.forEach((tool, i) => {
        console.log(`\nTool ${i + 1}:`, tool.toolName);
        console.log("Location:", tool.args.location);
        console.log("Temperature:", tool.result?.data?.temperature);
        console.log("Condition:", tool.result?.data?.condition);
      });
    } else {
      console.log("Response:", response2);
    }

    console.log("\n✅ All tests completed!");

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    // Exit to close database connection
    process.exit(0);
  }
}

testChatWithTools().catch(console.error);