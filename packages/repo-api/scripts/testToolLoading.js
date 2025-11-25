#!/usr/bin/env node

/**
 * Test which tools are loaded for GENERALIST archetype
 */

import { AGENT_ARCHETYPES, createAgentConfig } from '../lib/chat/aiPromptConfigs.js';
import { getToolsForArchetype, exportToolDefinitions } from '../lib/llm/tools/catalogue.js';

async function testToolLoading() {
  console.log('🔍 Testing Tool Loading for GENERALIST\n');
  
  const mockContext = {
    user: { _id: '123', name: 'Test User' },
    org: { _id: '456', name: 'Test Org' },
    project: { _id: '789', name: 'Test Project' },
    auth: true,
    permissions: ['read', 'write']
  };
  
  // Get archetype
  const archetype = AGENT_ARCHETYPES['GENERALIST'];
  console.log('📋 GENERALIST Capabilities:');
  archetype.capabilities.forEach(cap => {
    console.log(`  - ${cap.name}: ${cap.description}`);
  });
  
  // Get tools for archetype
  console.log('\n🔧 Loading tools...');
  const availableTools = getToolsForArchetype(
    'GENERALIST',
    archetype.capabilities,
    mockContext
  );
  
  console.log(`\n✅ Loaded ${availableTools.length} tools:`);
  
  // Group by category
  const toolsByCategory = {};
  availableTools.forEach(tool => {
    if (!toolsByCategory[tool.category]) {
      toolsByCategory[tool.category] = [];
    }
    toolsByCategory[tool.category].push(tool.definition.name);
  });
  
  // Display tools by category
  Object.keys(toolsByCategory).forEach(category => {
    console.log(`\n📁 ${category}:`);
    toolsByCategory[category].forEach(toolName => {
      console.log(`  - ${toolName}`);
    });
  });
  
  // Check for problematic tools
  console.log('\n⚠️  Checking for conflicting tools:');
  const conflictingTools = [
    'search_project_files',
    'search_documentation',
    'searchProjectPosts',
    'listProjectMedia'
  ];
  
  conflictingTools.forEach(toolName => {
    const found = availableTools.find(t => t.definition.name === toolName);
    if (found) {
      console.log(`  ❌ Found: ${toolName} (${found.category})`);
    } else {
      console.log(`  ✅ Not found: ${toolName}`);
    }
  });
}

testToolLoading().catch(console.error);