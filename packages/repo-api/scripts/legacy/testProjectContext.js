#!/usr/bin/env node
import "dotenv/config";
import { EditorChatHandler } from "../lib/llm/editorChat.js";
import { connectDb, db } from "../db.js";
import { ObjectId } from "mongodb";

// Colors for output
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

async function testProjectContext() {
  console.log(`${colors.bright}${colors.cyan}🧪 Testing EditorChat with Project Context${colors.reset}\n`);

  try {
    // Connect to database
    await connectDb();
    console.log("✅ Connected to database");
    
    // Get a real project from database
    const project = await db.projects.findOne({
      "githubRepo.repoName": { $exists: true }
    });
    
    if (!project) {
      console.log(`${colors.yellow}⚠️  No project found in database. Creating mock project...${colors.reset}`);
      // Create a mock project for testing
      const mockProject = {
        _id: new ObjectId(),
        name: "Test Documentation Site",
        description: "A test project for documentation",
        handle: "test-docs",
        visibility: "public",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-15"),
        githubRepo: {
          owner: "test-org",
          repoName: "test-docs",
          defaultBranch: "main"
        },
        settings: {
          themeId: "modern",
          siteMetadata: {
            title: "Test Docs",
            description: "Documentation for testing",
            keywords: ["docs", "test", "example"]
          }
        }
      };
      
      await db.projects.insertOne(mockProject);
      project = mockProject;
    }
    
    // Get user and org
    const user = await db.users.findOne({}) || {
      _id: new ObjectId(),
      name: "Test User",
      email: "test@example.com",
      permissions: ["read", "write"]
    };
    
    const org = await db.orgs.findOne({}) || {
      _id: new ObjectId(),
      name: "Test Org",
      handle: "test-org"
    };
    
    console.log(`\n📁 Using project: ${colors.bright}${project.name}${colors.reset}`);
    console.log(`   Repository: ${project.githubRepo?.owner}/${project.githubRepo?.repoName}`);
    console.log(`   Created: ${new Date(project.createdAt).toLocaleDateString()}`);
    
    // Create chat handler with project
    const handler = new EditorChatHandler({
      user,
      org,
      project, // Include project for context
      model: "gpt-4.1-mini",
      temperature: 0.7,
      stream: false,
      agentArchetype: "GENERALIST",
      debug: false
    });
    
    await handler.initialize();
    console.log(`\n✅ Chat initialized with ID: ${handler.chatId}`);
    
    // Test 1: Ask about project info
    console.log(`\n${colors.bright}${colors.blue}Test 1: Project Information Query${colors.reset}`);
    const test1 = await testQuery(handler, 
      "What can you tell me about this project? When was it last updated and how many posts does it have?"
    );
    
    // Test 2: Search posts (if available)
    console.log(`\n${colors.bright}${colors.blue}Test 2: Search Posts${colors.reset}`);
    const test2 = await testQuery(handler, 
      "Search for posts about 'getting started' or 'introduction'"
    );
    
    // Test 3: Get project stats
    console.log(`\n${colors.bright}${colors.blue}Test 3: Project Statistics${colors.reset}`);
    const test3 = await testQuery(handler, 
      "Can you give me detailed statistics about this project including deployments and media files?"
    );
    
    // Test 4: Combined query
    console.log(`\n${colors.bright}${colors.blue}Test 4: Combined Query${colors.reset}`);
    const test4 = await testQuery(handler, 
      "Based on the project information, what type of content should I create next? Also, what's the weather like in San Francisco?"
    );
    
    // Summary
    console.log(`\n${colors.bright}${colors.cyan}═══ Summary ═══${colors.reset}`);
    console.log(`Project Context Loaded: ${handler.projectContext ? '✅' : '❌'}`);
    
    if (handler.projectContext) {
      console.log(`\nProject Details:`);
      console.log(`- Name: ${handler.projectContext.name}`);
      console.log(`- Posts: ${handler.projectContext.stats.postsCount}`);
      console.log(`- Media: ${handler.projectContext.stats.mediasCount}`);
      console.log(`- Features:`, Object.entries(handler.projectContext.features)
        .filter(([_, v]) => v)
        .map(([k]) => k.replace('has', ''))
        .join(', '));
    }
    
    console.log(`\n${colors.green}✅ All tests completed!${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

async function testQuery(handler, query) {
  console.log(`${colors.cyan}User:${colors.reset} ${query}`);
  
  try {
    const startTime = Date.now();
    const response = await handler.sendMessage(query);
    const duration = Date.now() - startTime;
    
    // Extract response details
    const responseObj = typeof response === 'object' ? response : { message: response };
    const message = responseObj.content || responseObj.message || response;
    const toolsUsed = responseObj.toolsUsed || [];
    
    console.log(`\n${colors.green}Assistant:${colors.reset} ${message.substring(0, 300)}${message.length > 300 ? '...' : ''}`);
    console.log(`${colors.magenta}Duration:${colors.reset} ${duration}ms`);
    
    if (toolsUsed.length > 0) {
      console.log(`${colors.yellow}Tools Used:${colors.reset} ${toolsUsed.map(t => t.toolName).join(', ')}`);
      
      // Show project tool results
      const projectTools = toolsUsed.filter(t => 
        ['search_project_posts', 'get_project_stats', 'list_project_media'].includes(t.toolName)
      );
      
      if (projectTools.length > 0) {
        console.log(`${colors.cyan}Project Tool Results:${colors.reset}`);
        projectTools.forEach(tool => {
          if (tool.result && tool.result.success) {
            const data = tool.result.data || tool.result;
            console.log(`- ${tool.toolName}:`, JSON.stringify(data).substring(0, 100) + '...');
          }
        });
      }
    }
    
    return { success: true, message, toolsUsed };
    
  } catch (error) {
    console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    return { success: false, error };
  }
}

// Run the test
testProjectContext().catch(console.error);