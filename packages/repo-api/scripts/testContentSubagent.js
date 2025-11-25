#!/usr/bin/env node

/**
 * Test the content subagent delegation using internal libraries
 */

import { config } from "dotenv";
import { EditorChatHandler } from "../lib/llm/editorChat.js";

config();

async function testContentSubagent() {
  console.log("🧪 Testing Content Subagent Delegation\n");

  try {
    // Create mock data for testing
    const mockUser = {
      _id: "123",
      id: "user123",
      name: "Test User",
      email: "test@example.com",
    };

    const mockProject = {
      _id: "456",
      name: "Test Project",
      slug: "test-project",
      ownerId: "user123",
    };

    const mockOrg = {
      _id: "789",
      name: "Test Org",
      handle: "testorg",
      owner: "user123",
    };

    console.log(`✅ User: ${mockUser.name}`);
    console.log(`✅ Project: ${mockProject.name} (${mockProject.slug})`);
    console.log(`✅ Org: ${mockOrg.name}\n`);

    // Create handler with content subagent
    console.log("🤖 Creating EditorChatHandler...");
    const handler = new EditorChatHandler({
      user: mockUser,
      org: mockOrg,
      project: mockProject,
      model: "gpt-4.1-mini",
      temperature: 0.7,
      stream: false,
      enableStreaming: false,
      debug: true,
      agentArchetype: "GENERALIST",
    });

    // Don't call initialize() to avoid database dependencies
    // Just check the structure

    console.log("📋 Handler created with:");
    console.log(`  - User: ${handler.user.name}`);
    console.log(`  - Project: ${handler.project?.name}`);
    console.log(`  - Archetype: ${handler.agentArchetype}`);

    // Test the shouldDelegateToContent method
    console.log("\n📝 Testing content query detection...");

    const testQueries = [
      // Should delegate
      {
        query: "What articles do you have about authentication?",
        expected: true,
      },
      { query: "Search for posts about API", expected: true },
      { query: "Find content about pizza", expected: true },
      { query: "Show me blog posts about React", expected: true },
      { query: "List all documentation", expected: true },
      { query: "Find media files", expected: true },
      { query: "What's in the navigation?", expected: true },

      // Should NOT delegate
      { query: "Deploy the project", expected: false },
      { query: "Create a new file", expected: false },
      { query: "Run the tests", expected: false },
      { query: "What's the weather?", expected: false },
    ];

    testQueries.forEach(({ query, expected }) => {
      const result = handler.shouldDelegateToContent(query);
      const icon = result === expected ? "✅" : "❌";
      console.log(
        `  ${icon} "${query}" → ${
          result ? "Would delegate" : "Would NOT delegate"
        }`
      );
    });

    // Test partial initialization without database
    console.log("\n🔧 Testing partial initialization...");

    // Override initialize to skip database calls
    handler.initialize = async function () {
      console.log("  - Skipping database initialization");
      this.chatId = "test-chat-id";

      // Try to create content subagent
      if (this.project) {
        console.log("  - Creating content subagent...");
        try {
          await this.createContentSubagent();
          console.log("  ✅ Content subagent created");
        } catch (error) {
          console.log("  ❌ Failed to create content subagent:", error.message);
        }
      }
    };

    await handler.initialize();

    // Check if content agent was created
    if (handler.contentAgent) {
      console.log(`\n📚 Content Agent Details:`);
      console.log(`  - Name: ${handler.contentAgent.name}`);
      console.log(
        `  - Tools: ${handler.contentAgent.tools?.length || 0} tools`
      );
    } else {
      console.log("\n❌ Content agent was not created");
    }

    console.log("\n✅ Test completed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

// Run the test
testContentSubagent().catch(console.error);
