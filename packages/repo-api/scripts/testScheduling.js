#!/usr/bin/env node
/**
 * Test script for the AI Agent Scheduling System
 * 
 * Usage: node scripts/testScheduling.js
 */

import dotenv from "dotenv";
dotenv.config();

import { connectDb } from "../db.js";
import {
  scheduleTask,
  getUpcomingTasks,
  processNaturalCommand,
  startTaskQueue,
  registerTaskExecutor,
  getQueueStatus
} from "../lib/schedule/index.js";

async function main() {
  console.log("🚀 Testing AI Agent Scheduling System\n");

  // Connect to database
  await connectDb();
  console.log("✅ Connected to MongoDB\n");

  // Test 1: Schedule a simple task
  console.log("📅 Test 1: Scheduling a simple task");
  try {
    const task1 = await scheduleTask({
      date: "tomorrow at 2pm",
      title: "Review weekly metrics",
      agentId: "test-agent",
      metadata: {
        priority: "high",
        category: "analytics"
      }
    });
    console.log("✅ Task scheduled:", task1.title, "at", task1.scheduledAt);
  } catch (error) {
    console.error("❌ Error scheduling task:", error.message);
  }

  // Test 2: Natural language scheduling
  console.log("\n🗣️  Test 2: Natural language scheduling");
  try {
    const nlpResult = await processNaturalCommand(
      "schedule daily standup every weekday at 9:30am",
      { agentId: "team-agent" }
    );
    console.log("✅ NLP Result:", nlpResult.message);
  } catch (error) {
    console.error("❌ Error with NLP:", error.message);
  }

  // Test 3: List upcoming tasks
  console.log("\n📋 Test 3: Listing upcoming tasks");
  try {
    const tasks = await getUpcomingTasks({
      limit: 10,
      includeRecurring: true
    });
    console.log(`✅ Found ${tasks.length} upcoming tasks:`);
    tasks.forEach(task => {
      console.log(`   - ${task.title} (${task.agentId}) at ${task.scheduledAt}`);
    });
  } catch (error) {
    console.error("❌ Error listing tasks:", error.message);
  }

  // Test 4: Register a task executor
  console.log("\n⚙️  Test 4: Registering task executor");
  registerTaskExecutor("test-agent", async (task) => {
    console.log(`   📌 Executing task: ${task.title}`);
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      success: true,
      message: `Completed ${task.title}`,
      timestamp: new Date()
    };
  });
  console.log("✅ Executor registered for test-agent");

  // Test 5: Check queue status
  console.log("\n📊 Test 5: Queue status");
  const status = await getQueueStatus();
  console.log("✅ Queue Status:");
  console.log(`   - Running: ${status.isRunning}`);
  console.log(`   - Ready tasks: ${status.queue.ready}`);
  console.log(`   - Running tasks: ${status.queue.running}`);
  console.log(`   - Scheduled tasks: ${status.queue.scheduled}`);

  // Test 6: Natural language commands
  console.log("\n🧪 Test 6: Various natural language commands");
  const testCommands = [
    "schedule meeting tomorrow at 3pm",
    "cancel all meetings tomorrow",
    "reschedule weekly review to next friday",
    "list tasks for this week"
  ];

  for (const command of testCommands) {
    try {
      console.log(`\n   Testing: "${command}"`);
      const result = await processNaturalCommand(command, {
        agentId: "test-agent"
      });
      console.log(`   ✅ ${result.success ? "Success" : "Failed"}: ${result.message}`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  // Optional: Start the queue for 30 seconds
  const runQueue = process.argv.includes("--run-queue");
  if (runQueue) {
    console.log("\n🏃 Starting task queue for 30 seconds...");
    startTaskQueue();
    
    setTimeout(() => {
      console.log("\n⏹️  Stopping task queue...");
      process.exit(0);
    }, 30000);
  } else {
    console.log("\n✅ All tests completed!");
    console.log("💡 Run with --run-queue to test task execution");
    process.exit(0);
  }
}

// Run the tests
main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});