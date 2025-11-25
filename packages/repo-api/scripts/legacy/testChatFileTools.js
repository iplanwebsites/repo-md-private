#!/usr/bin/env node
import "dotenv/config";
import { EditorChatHandler } from "../lib/llm/editorChat.js";
import { connectDb } from "../db.js";
import { ObjectId } from "mongodb";

// Mock user, org and project
const mockUser = {
  _id: new ObjectId(),
  id: "test123",
  name: "Test User",
  email: "test@example.com",
  permissions: ["read", "write"],
  githubSupaToken: process.env.GITHUB_ACCESS_TOKEN // Need GitHub token for file ops
};

const mockOrg = {
  _id: new ObjectId(), 
  id: "org123",
  name: "Test Org",
  handle: "test-org"
};

const mockProject = {
  _id: new ObjectId(),
  id: "proj123",
  name: "Test Project",
  githubRepo: {
    owner: "your-github-username", // Update this
    repoName: "test-repo"          // Update this
  }
};

async function testChatWithFileTools() {
  console.log("🧪 Testing EditorChat with file tools...\n");

  try {
    // Connect to database
    await connectDb();
    console.log("✅ Connected to database");
    
    // Create chat handler
    const handler = new EditorChatHandler({
      user: mockUser,
      org: mockOrg,
      project: mockProject, // Include project for file operations
      model: "gpt-4.1-mini",
      temperature: 0.7,
      stream: false, // Disable streaming for easier testing
      agentArchetype: "CODE_GENERATOR", // Use code generator for file tools
      debug: true
    });

    await handler.initialize();
    console.log("✅ Chat initialized with ID:", handler.chatId);

    // Test 1: Create a file
    console.log("\n📍 Test 1: Create a file");
    console.log("User: Create a new file called test.js with a simple hello world function");
    
    const response1 = await handler.sendMessage(
      "Create a new file called test.js with a simple hello world function"
    );
    
    console.log("\n🤖 Assistant response:");
    if (typeof response1 === 'object' && response1.toolsUsed) {
      console.log("Message:", response1.content || response1.message || response1);
      console.log("\n🛠️  Tools used:", response1.toolsUsed.length);
      
      response1.toolsUsed.forEach((tool, i) => {
        console.log(`\nTool ${i + 1}:`, tool.toolName);
        console.log("Args:", JSON.stringify(tool.args, null, 2));
        
        if (tool.result.fileTracking) {
          console.log("\n📁 File Tracking:");
          console.log("Type:", tool.result.fileTracking.type);
          console.log("Path:", tool.result.fileTracking.path);
          console.log("Size:", tool.result.fileTracking.size);
        }
        
        if (tool.result.allFileModifications) {
          console.log("\n📊 All File Modifications:");
          console.log(JSON.stringify(tool.result.allFileModifications, null, 2));
        }
      });
    }

    // Test 2: Edit the file
    console.log("\n\n📍 Test 2: Edit the file");
    console.log("User: Now modify the hello world function to accept a name parameter");
    
    const response2 = await handler.sendMessage(
      "Now modify the hello world function to accept a name parameter"
    );
    
    console.log("\n🤖 Assistant response:");
    if (typeof response2 === 'object' && response2.toolsUsed) {
      console.log("Message:", response2.content || response2.message || response2);
      console.log("\n🛠️  Tools used:", response2.toolsUsed.length);
      
      response2.toolsUsed.forEach((tool, i) => {
        console.log(`\nTool ${i + 1}:`, tool.toolName);
        
        if (tool.result.fileTracking) {
          console.log("\n📁 File Tracking:");
          console.log("Type:", tool.result.fileTracking.type);
          console.log("Stats:", tool.result.fileTracking.stats);
          
          if (tool.result.fileTracking.diff) {
            console.log("\n📝 Diff Preview (first 500 chars):");
            console.log(tool.result.fileTracking.diff.substring(0, 500) + "...");
          }
        }
        
        if (tool.result.allFileModifications) {
          console.log("\n📊 All File Modifications Summary:");
          const summary = tool.result.allFileModifications;
          console.log(`Total: ${summary.total} (Created: ${summary.created}, Modified: ${summary.modified}, Deleted: ${summary.deleted})`);
          console.log("Files:", summary.files);
        }
      });
    }

    // Show final file tracker summary
    console.log("\n\n📋 Final File Tracker Summary:");
    const finalSummary = handler.fileTracker.getSummary();
    console.log(JSON.stringify(finalSummary, null, 2));

    console.log("\n✅ All tests completed!");

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    // Exit to close database connection
    process.exit(0);
  }
}

// Run the test
console.log("⚠️  Note: This test requires:");
console.log("1. A valid GitHub token in GITHUB_ACCESS_TOKEN env var");
console.log("2. Update mockProject with your actual GitHub repo");
console.log("3. The repo should exist and you should have write access\n");

testChatWithFileTools().catch(console.error);