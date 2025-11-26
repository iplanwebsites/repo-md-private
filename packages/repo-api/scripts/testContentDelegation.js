#!/usr/bin/env node

/**
 * Test actual content delegation with mock Volt agent
 */

import { config } from 'dotenv';
import RepoMD from 'repo-md';

config();

async function testContentDelegation() {
  console.log('🧪 Testing Content Delegation with RepoMD\n');
  
  try {
    // Test RepoMD directly first
    console.log('1️⃣ Testing RepoMD directly...');
    const repoMd = new RepoMD({ 
      project: 'test-project'  // This would be a real project slug in production
    });
    
    // Get tool specifications
    const toolSpec = repoMd.getOpenAiToolSpec({
      blacklistedTools: []
    });
    
    console.log(`✅ RepoMD provides ${toolSpec.functions.length} tools:\n`);
    
    // Group tools by category for better visibility
    const toolsByCategory = {};
    toolSpec.functions.forEach(func => {
      const category = func.name.split('_')[0] || 'other';
      if (!toolsByCategory[category]) {
        toolsByCategory[category] = [];
      }
      toolsByCategory[category].push(func.name);
    });
    
    Object.keys(toolsByCategory).forEach(category => {
      console.log(`📁 ${category}:`);
      toolsByCategory[category].forEach(toolName => {
        const tool = toolSpec.functions.find(f => f.name === toolName);
        console.log(`  - ${toolName}: ${tool.description.split('\n')[0]}`);
      });
      console.log();
    });
    
    // Test a specific tool execution
    console.log('2️⃣ Testing tool execution...');
    
    // Find search_posts tool
    const searchPostsTool = toolSpec.functions.find(f => f.name === 'search_posts');
    if (searchPostsTool) {
      console.log(`\n🔍 Testing ${searchPostsTool.name}:`);
      console.log(`Description: ${searchPostsTool.description}`);
      console.log(`Parameters: ${JSON.stringify(searchPostsTool.parameters, null, 2)}`);
      
      // Simulate tool execution
      try {
        const result = await repoMd.handleOpenAiRequest({
          function: 'search_posts',
          arguments: { query: 'pizza' }
        });
        console.log('\n✅ Tool execution result:');
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.log('\n⚠️ Tool execution failed (expected in test environment):');
        console.log(error.message);
      }
    }
    
    // Show which tools would handle content queries
    console.log('\n3️⃣ Tools for content queries:');
    const contentTools = [
      'getAllPosts',
      'getPostBySlug',
      'getPostByHash',
      'getPostByPath',
      'getRecentPosts',
      'getSimilarPostsBySlug',
      'getAllMedia',
      'getMediaItems'
    ];
    
    contentTools.forEach(toolName => {
      const tool = toolSpec.functions.find(f => f.name === toolName);
      if (tool) {
        console.log(`  ✅ ${toolName} - Available`);
      } else {
        console.log(`  ❌ ${toolName} - Not found`);
      }
    });
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testContentDelegation().catch(console.error);