#!/usr/bin/env node

/**
 * Test Volt integration with content subagent
 */

import { config } from "dotenv";
import { EditorChatHandler } from "../lib/llm/editorChat.js";
import { AGENT_ARCHETYPES } from "../lib/chat/aiPromptConfigs.js";
import { getToolsForArchetype } from "../lib/llm/tools/catalogue.js";

config();

async function testVoltIntegration() {
  console.log("🧪 Testing Volt Integration with Content Subagent\n");

  try {
    // Create mock data
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

    const mockContext = {
      user: mockUser,
      org: mockOrg,
      project: mockProject,
      auth: true,
      permissions: ["read", "write"],
    };

    console.log("1️⃣ Testing Tool Loading with Context...\n");

    // Get archetype
    const archetype = AGENT_ARCHETYPES["GENERALIST"];
    console.log("📋 GENERALIST Capabilities:");
    archetype.capabilities.forEach((cap) => {
      console.log(`  - ${cap.name}: ${cap.description}`);
    });

    // Get tools with proper context
    console.log("\n🔧 Loading tools with context...");
    const availableTools = getToolsForArchetype(
      "GENERALIST",
      archetype.capabilities,
      mockContext // This was missing before
    );

    console.log(`\n✅ Loaded ${availableTools.length} tools:`);

    // Group by category
    const toolsByCategory = {};
    availableTools.forEach((tool) => {
      if (!toolsByCategory[tool.category]) {
        toolsByCategory[tool.category] = [];
      }
      toolsByCategory[tool.category].push(tool.definition.name);
    });

    // Display tools by category
    Object.keys(toolsByCategory).forEach((category) => {
      console.log(`\n📁 ${category}:`);
      toolsByCategory[category].forEach((toolName) => {
        console.log(`  - ${toolName}`);
      });
    });

    // Check for delegate_task
    console.log("\n2️⃣ Checking for delegation capability...");
    const hasDelegateTask = availableTools.some(
      (t) => t.definition.name === "delegateTask"
    );
    console.log(
      `  ${hasDelegateTask ? "✅" : "❌"} delegateTask tool available`
    );

    console.log("\n3️⃣ Testing Handler Creation...");

    // Create handler
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

    console.log("✅ Handler created successfully");

    // Test partial initialization
    handler.initialize = async function () {
      console.log("  - Mocking initialization (no DB)");
      this.chatId = "test-chat-id";

      // Load tools first
      await this.loadTools();

      // Create agent (skip DB operations)
      await this.createAgent();

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

    // Check agent configuration
    console.log("\n4️⃣ Agent Configuration:");
    if (handler.agent) {
      console.log(`  ✅ Main agent created: ${handler.agent.name}`);
      console.log(`  - Tools: ${handler.agent.tools?.length || 0}`);

      // Check for delegate_task in agent tools
      const agentHasDelegateTask = handler.agent.tools?.some(
        (t) => t.name === "delegateTask"
      );
      console.log(
        `  - Has delegateTask: ${agentHasDelegateTask ? "✅" : "❌"}`
      );
    }

    if (handler.contentAgent) {
      console.log(
        `  ✅ Content subagent created: ${handler.contentAgent.name}`
      );
      console.log(`  - Tools: ${handler.contentAgent.tools?.length || 0}`);
    }

    if (handler.subAgents?.length > 0) {
      console.log(`  ✅ Subagents registered: ${handler.subAgents.length}`);
    }

    console.log("\n✅ Integration test completed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

// Run the test
testVoltIntegration().catch(console.error);
