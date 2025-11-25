#!/usr/bin/env node
import "dotenv/config";
import { EditorChatHandler } from "../lib/llm/editorChat.js";
import { connectDb, db } from "../db.js";
import { ObjectId } from "mongodb";

// Color utilities
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

// Test scenarios with natural language requests
const TEST_SCENARIOS = {
  weather: [
    {
      name: "Simple weather query",
      message: "What's the weather like in San Francisco?",
      expectedTools: ["getWeather"]
    },
    {
      name: "Weather comparison",
      message: "Can you compare the weather between London and Paris? I'm trying to decide where to travel.",
      expectedTools: ["getWeather"]
    },
    {
      name: "Weather with preferences",
      message: "I prefer warm weather. Should I visit Miami or Seattle this week?",
      expectedTools: ["getWeather"]
    }
  ],
  
  fileOperations: [
    {
      name: "Create a simple file",
      message: "Create a new JavaScript file called utils.js with a function that formats dates",
      expectedTools: ["create_file"]
    },
    {
      name: "Create multiple files",
      message: "I need a basic React component. Create a Button.jsx file and a Button.css file with appropriate starter code",
      expectedTools: ["create_file"]
    },
    {
      name: "Edit existing file",
      message: "Can you update the utils.js file to add a function that formats currency values?",
      expectedTools: ["read_file", "edit_file"]
    },
    {
      name: "Refactor code",
      message: "The Button component needs to support a 'size' prop with values 'small', 'medium', and 'large'. Can you update it?",
      expectedTools: ["read_file", "edit_file"]
    }
  ],
  
  search: [
    {
      name: "Search for patterns",
      message: "Find all files that use React hooks in this project",
      expectedTools: ["search_project_files"]
    },
    {
      name: "Search for TODOs",
      message: "Can you find all TODO comments in the codebase and list them?",
      expectedTools: ["search_project_files"]
    },
    {
      name: "Find configuration",
      message: "Where is the database configuration in this project?",
      expectedTools: ["search_project_files", "search_documentation"]
    }
  ],
  
  combined: [
    {
      name: "Weather-based code",
      message: "Create a weatherWidget.js file that fetches and displays the current weather for New York",
      expectedTools: ["getWeather", "create_file"]
    },
    {
      name: "Search and modify",
      message: "Find all console.log statements in the project and create a migration guide for replacing them with a proper logger",
      expectedTools: ["search_project_files", "create_file"]
    },
    {
      name: "Complex refactoring",
      message: "I want to rename all instances of 'getUserData' to 'fetchUserProfile' across the entire project. Can you help?",
      expectedTools: ["search_project_files", "read_file", "edit_file"]
    }
  ]
};

async function runTest(handler, scenario, scenarioName) {
  console.log(`\n${colors.bright}${colors.blue}━━━ ${scenarioName}: ${scenario.name} ━━━${colors.reset}`);
  console.log(`${colors.cyan}User:${colors.reset} ${scenario.message}`);
  
  try {
    const startTime = Date.now();
    const response = await handler.sendMessage(scenario.message);
    const duration = Date.now() - startTime;
    
    // Extract response details
    const responseObj = typeof response === 'object' ? response : { message: response };
    const message = responseObj.content || responseObj.message || response;
    const toolsUsed = responseObj.toolsUsed || [];
    
    // Display response
    console.log(`\n${colors.green}Assistant:${colors.reset} ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}`);
    console.log(`${colors.magenta}Duration:${colors.reset} ${duration}ms`);
    
    // Display tools used
    if (toolsUsed.length > 0) {
      console.log(`\n${colors.yellow}🛠️  Tools Used (${toolsUsed.length}):${colors.reset}`);
      
      toolsUsed.forEach((tool, i) => {
        console.log(`\n  ${i + 1}. ${colors.bright}${tool.toolName}${colors.reset}`);
        console.log(`     Timestamp: ${tool.timestamp}`);
        
        // Show key arguments
        if (tool.args) {
          const argKeys = Object.keys(tool.args);
          if (argKeys.length > 0) {
            console.log(`     Args: ${JSON.stringify(tool.args).substring(0, 100)}...`);
          }
        }
        
        // Show result summary
        if (tool.result) {
          if (tool.result.success === false) {
            console.log(`     ${colors.red}Result: Failed - ${tool.result.error}${colors.reset}`);
          } else if (tool.result.fileTracking) {
            console.log(`     ${colors.green}File: ${tool.result.fileTracking.type} - ${tool.result.path}${colors.reset}`);
            if (tool.result.fileTracking.stats) {
              const stats = tool.result.fileTracking.stats;
              console.log(`     Changes: +${stats.additions} -${stats.deletions}`);
            }
          } else if (tool.result.data) {
            // Weather or other data
            const data = tool.result.data;
            console.log(`     ${colors.green}Result: ${JSON.stringify(data).substring(0, 100)}...${colors.reset}`);
          }
        }
      });
      
      // Check expected tools
      if (scenario.expectedTools) {
        const usedToolNames = toolsUsed.map(t => t.toolName);
        const expectedFound = scenario.expectedTools.filter(t => 
          usedToolNames.some(used => used.includes(t))
        );
        
        if (expectedFound.length === scenario.expectedTools.length) {
          console.log(`\n  ${colors.green}✅ All expected tools were used${colors.reset}`);
        } else {
          console.log(`\n  ${colors.yellow}⚠️  Expected tools: ${scenario.expectedTools.join(', ')}${colors.reset}`);
          console.log(`     Actually used: ${usedToolNames.join(', ')}`);
        }
      }
    } else {
      console.log(`\n${colors.yellow}No tools were used${colors.reset}`);
    }
    
    // Show file modifications if any
    if (handler.fileTracker) {
      const summary = handler.fileTracker.getSummary();
      if (summary.total > 0) {
        console.log(`\n${colors.cyan}📁 File Modifications:${colors.reset}`);
        console.log(`   Total: ${summary.total} (Created: ${summary.created}, Modified: ${summary.modified}, Deleted: ${summary.deleted})`);
        summary.files.forEach(f => {
          console.log(`   - ${f.path} (${f.type})`);
        });
      }
    }
    
    return { success: true, toolsUsed };
    
  } catch (error) {
    console.log(`\n${colors.red}❌ Error: ${error.message}${colors.reset}`);
    return { success: false, error };
  }
}

async function main() {
  console.log(`${colors.bright}${colors.cyan}🧪 EditorChat Natural Language Testing${colors.reset}\n`);
  
  try {
    // Connect to database
    await connectDb();
    console.log("✅ Connected to database");
    
    // Get user with GitHub token for file operations
    const user = await db.users.findOne({ githubSupaToken: { $exists: true } });
    if (!user) {
      console.log(`${colors.yellow}⚠️  No user with GitHub token found. File operations will fail.${colors.reset}`);
    }
    
    // Get a project for file operations
    const project = await db.projects.findOne({ 
      "githubRepo.repoName": { $exists: true } 
    });
    
    // Get an org
    const org = await db.orgs.findOne({});
    
    if (!org) {
      console.log(`${colors.red}❌ No organization found in database${colors.reset}`);
      process.exit(1);
    }
    
    // Create chat handler
    const handler = new EditorChatHandler({
      user: user || {
        _id: new ObjectId(),
        id: "test123",
        name: "Test User",
        email: "test@example.com",
        permissions: ["read", "write"]
      },
      org: {
        _id: org._id,
        id: org._id.toString(),
        name: org.name || "Test Org",
        handle: org.handle || "test-org"
      },
      project: project || null,
      model: "gpt-4.1-mini",
      temperature: 0.7,
      stream: false,
      agentArchetype: "GENERALIST",
      debug: false // Set to true for verbose output
    });
    
    await handler.initialize();
    console.log(`✅ Chat initialized with ID: ${handler.chatId}`);
    console.log(`📁 Project: ${project ? project.name : 'No project (file operations will fail)'}`);
    console.log(`👤 User: ${user ? user.email : 'Mock user'}\n`);
    
    // Run test scenarios
    let totalTests = 0;
    let passedTests = 0;
    
    // Choose which scenarios to run
    const scenariosToRun = process.argv[2] ? [process.argv[2]] : Object.keys(TEST_SCENARIOS);
    
    for (const scenarioName of scenariosToRun) {
      if (!TEST_SCENARIOS[scenarioName]) {
        console.log(`${colors.red}Unknown scenario: ${scenarioName}${colors.reset}`);
        continue;
      }
      
      console.log(`\n${colors.bright}${colors.magenta}══════ ${scenarioName.toUpperCase()} SCENARIOS ══════${colors.reset}`);
      
      for (const scenario of TEST_SCENARIOS[scenarioName]) {
        totalTests++;
        const result = await runTest(handler, scenario, scenarioName);
        if (result.success) passedTests++;
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Summary
    console.log(`\n${colors.bright}${colors.cyan}════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}Test Summary:${colors.reset}`);
    console.log(`Total: ${totalTests}`);
    console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
    console.log(`${colors.red}Failed: ${totalTests - passedTests}${colors.reset}`);
    
    // Show final file modifications
    if (handler.fileTracker) {
      const finalSummary = handler.fileTracker.getSummary();
      if (finalSummary.total > 0) {
        console.log(`\n${colors.bright}Final File Modifications:${colors.reset}`);
        console.log(JSON.stringify(finalSummary, null, 2));
      }
    }
    
  } catch (error) {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

// Usage instructions
console.log(`${colors.cyan}Usage:${colors.reset}`);
console.log("  npm run test:nl              # Run all scenarios");
console.log("  npm run test:nl weather      # Run only weather scenarios");
console.log("  npm run test:nl fileOperations  # Run only file operation scenarios");
console.log("  npm run test:nl search       # Run only search scenarios");
console.log("  npm run test:nl combined     # Run only combined scenarios\n");

// Run the tests
main().catch(console.error);