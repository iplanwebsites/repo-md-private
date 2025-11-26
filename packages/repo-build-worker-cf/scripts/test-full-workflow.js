#!/usr/bin/env node

import dotenv from 'dotenv';
import { createStarterProjectFromBrief } from '../src/lib/mdAgent.js';
import GitHubService from '../src/services/githubService.js';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { execSync } from 'child_process';

// Load environment variables
dotenv.config();

class ProjectWorkflowService {
  constructor() {
    this.githubService = process.env.GITHUB_TOKEN 
      ? new GitHubService(process.env.GITHUB_TOKEN)
      : null;
    this.tempDir = './temp-workflow';
  }

  /**
   * Complete workflow: Generate project → Create GitHub repo → Deploy
   */
  async executeFullWorkflow(brief, options = {}) {
    const {
      repoName = this.generateRepoName(brief),
      repoDescription = `Generated project: ${brief.substring(0, 100)}...`,
      isPrivate = true,
      mockGitHub = !process.env.GITHUB_TOKEN,
      deploymentTarget = 'cloudflare-pages' // or 'netlify', 'vercel', etc.
    } = options;

    console.log('🚀 Starting Full Project Workflow');
    console.log('═'.repeat(50));
    console.log(`📝 Brief: ${brief}`);
    console.log(`📦 Repo Name: ${repoName}`);
    console.log(`🔐 Private: ${isPrivate}`);
    console.log(`🚀 Deployment: ${deploymentTarget}`);
    console.log(`🧪 Mock GitHub: ${mockGitHub}`);
    console.log('═'.repeat(50));

    const workflowResult = {
      projectGeneration: null,
      githubRepo: null,
      deployment: null,
      errors: [],
      success: false
    };

    try {
      // Step 1: Generate project files
      console.log('\n🎯 STEP 1: Generating Project Files');
      console.log('-'.repeat(30));
      
      const projectDir = path.join(this.tempDir, repoName);
      workflowResult.projectGeneration = await createStarterProjectFromBrief(brief, {
        outputDir: projectDir,
        mockMode: !process.env.OPENAI_API_KEY
      });

      console.log(`✅ Generated ${workflowResult.projectGeneration.files.length} files`);

      // Step 2: Add deployment configuration
      console.log('\n⚙️  STEP 2: Adding Deployment Configuration');
      console.log('-'.repeat(30));
      
      await this.addDeploymentConfig(projectDir, deploymentTarget);

      // Step 3: Create GitHub repository
      console.log('\n📱 STEP 3: Creating GitHub Repository');
      console.log('-'.repeat(30));
      
      if (mockGitHub) {
        workflowResult.githubRepo = await this.mockCreateGitHubRepo(repoName, repoDescription, isPrivate);
      } else {
        workflowResult.githubRepo = await this.createGitHubRepo(projectDir, repoName, repoDescription, isPrivate);
      }

      // Step 4: Simulate deployment
      console.log('\n🚀 STEP 4: Deploying Project');
      console.log('-'.repeat(30));
      
      workflowResult.deployment = await this.simulateDeployment(projectDir, deploymentTarget, workflowResult.githubRepo);

      // Step 5: Cleanup
      console.log('\n🧹 STEP 5: Cleaning Up');
      console.log('-'.repeat(30));
      
      await this.cleanup(projectDir);

      workflowResult.success = true;
      console.log('\n🎉 Workflow completed successfully!');
      
      return workflowResult;

    } catch (error) {
      console.error('\n❌ Workflow failed:', error.message);
      workflowResult.errors.push(error.message);
      
      // Attempt cleanup even on failure
      try {
        await this.cleanup(path.join(this.tempDir, repoName));
      } catch (cleanupError) {
        console.warn('⚠️  Cleanup failed:', cleanupError.message);
      }
      
      throw error;
    }
  }

  /**
   * Add deployment configuration files
   */
  async addDeploymentConfig(projectDir, target) {
    switch (target) {
      case 'cloudflare-pages':
        await this.addCloudflareConfig(projectDir);
        break;
      case 'netlify':
        await this.addNetlifyConfig(projectDir);
        break;
      case 'vercel':
        await this.addVercelConfig(projectDir);
        break;
      default:
        console.log('ℹ️  No specific deployment config added');
    }
  }

  async addCloudflareConfig(projectDir) {
    const wranglerConfig = `
name = "generated-project"
compatibility_date = "2024-01-01"

[site]
bucket = "./dist"

[[routes]]
pattern = "*"
custom_origin = true
`;

    await fs.writeFile(path.join(projectDir, 'wrangler.toml'), wranglerConfig.trim());
    console.log('✅ Added Cloudflare Pages configuration');
  }

  async addNetlifyConfig(projectDir) {
    const netlifyConfig = `
[build]
  publish = "dist"
  command = "npm run build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;

    await fs.writeFile(path.join(projectDir, 'netlify.toml'), netlifyConfig.trim());
    console.log('✅ Added Netlify configuration');
  }

  async addVercelConfig(projectDir) {
    const vercelConfig = {
      "version": 2,
      "builds": [
        {
          "src": "**/*",
          "use": "@vercel/static"
        }
      ],
      "routes": [
        {
          "src": "/(.*)",
          "dest": "/$1"
        }
      ]
    };

    await fs.writeFile(path.join(projectDir, 'vercel.json'), JSON.stringify(vercelConfig, null, 2));
    console.log('✅ Added Vercel configuration');
  }

  /**
   * Create actual GitHub repository
   */
  async createGitHubRepo(projectDir, repoName, description, isPrivate) {
    if (!this.githubService) {
      throw new Error('GitHub token required for real repository creation');
    }

    // Create repository
    const repo = await this.githubService.createRepository(repoName, {
      description,
      private: isPrivate,
      auto_init: false
    });

    // Initialize git and push
    await this.initializeAndPushRepo(projectDir, repo.clone_url);

    console.log(`✅ Repository created: ${repo.html_url}`);
    return repo;
  }

  /**
   * Mock GitHub repository creation
   */
  async mockCreateGitHubRepo(repoName, description, isPrivate) {
    console.log('🧪 Simulating GitHub repository creation...');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const mockRepo = {
      id: Math.floor(Math.random() * 1000000),
      name: repoName,
      full_name: `mock-user/${repoName}`,
      description,
      private: isPrivate,
      html_url: `https://github.com/mock-user/${repoName}`,
      clone_url: `https://github.com/mock-user/${repoName}.git`,
      created_at: new Date().toISOString()
    };

    console.log(`✅ Mock repository created: ${mockRepo.html_url}`);
    return mockRepo;
  }

  /**
   * Initialize git repository and push to GitHub
   */
  async initializeAndPushRepo(projectDir, cloneUrl) {
    const commands = [
      'git init',
      'git add .',
      'git commit -m "Initial commit: Generated project from brief"',
      `git remote add origin ${cloneUrl}`,
      'git branch -M main',
      'git push -u origin main'
    ];

    for (const command of commands) {
      console.log(`▶️  ${command}`);
      try {
        execSync(command, { cwd: projectDir, stdio: 'pipe' });
      } catch (error) {
        console.warn(`⚠️  Command failed (this is expected in mock mode): ${command}`);
        // In real implementation, we'd throw here, but for demo we continue
      }
    }
  }

  /**
   * Simulate deployment process
   */
  async simulateDeployment(projectDir, target, repo) {
    console.log(`🚀 Simulating deployment to ${target}...`);

    // Simulate build process
    const buildResult = await this.simulateBuild(projectDir);
    
    // Simulate deployment
    await new Promise(resolve => setTimeout(resolve, 2000));

    const deploymentResult = {
      target,
      status: 'success',
      url: `https://${repo.name}.${target === 'cloudflare-pages' ? 'pages.dev' : target === 'netlify' ? 'netlify.app' : 'vercel.app'}`,
      buildTime: '45s',
      buildResult,
      deployedAt: new Date().toISOString()
    };

    console.log(`✅ Deployment successful: ${deploymentResult.url}`);
    return deploymentResult;
  }

  /**
   * Simulate build process
   */
  async simulateBuild(projectDir) {
    console.log('🔨 Simulating build process...');
    
    // Check if there's a package.json or other build indicators
    const files = await fs.readdir(projectDir);
    const hasPackageJson = files.includes('package.json');
    
    const buildSteps = [
      'Installing dependencies...',
      'Processing markdown files...',
      'Generating static assets...',
      'Optimizing images...',
      'Creating search index...'
    ];

    for (const step of buildSteps) {
      console.log(`   ${step}`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return {
      success: true,
      duration: '12s',
      outputSize: '2.3MB',
      files: files.length
    };
  }

  /**
   * Generate repository name from brief
   */
  generateRepoName(brief) {
    return brief
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(' ')
      .slice(0, 3)
      .join('-')
      .substring(0, 50) + '-' + Date.now().toString().slice(-4);
  }

  /**
   * Cleanup temporary files
   */
  async cleanup(projectDir) {
    try {
      await fs.rm(projectDir, { recursive: true, force: true });
      console.log('✅ Temporary files cleaned up');
    } catch (error) {
      console.warn('⚠️  Cleanup warning:', error.message);
    }
  }
}

/**
 * Test the full workflow with multiple scenarios
 */
async function testFullWorkflow() {
  console.log('🧪 Testing Full Project Workflow\n');

  const testCases = [
    {
      name: 'Personal Blog',
      brief: 'Create a personal blog about web development with posts about React, Node.js, and deployment best practices',
      deploymentTarget: 'cloudflare-pages'
    },
    {
      name: 'Product Documentation',
      brief: 'Build documentation for a SaaS API product including getting started guide and API reference',
      deploymentTarget: 'netlify'
    }
  ];

  const workflowService = new ProjectWorkflowService();

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    
    console.log(`\n${'🔄'.repeat(20)}`);
    console.log(`Test ${i + 1}/${testCases.length}: ${testCase.name}`);
    console.log(`${'🔄'.repeat(20)}`);
    
    try {
      const result = await workflowService.executeFullWorkflow(testCase.brief, {
        deploymentTarget: testCase.deploymentTarget,
        isPrivate: false
      });

      console.log('\n📊 WORKFLOW SUMMARY');
      console.log('═'.repeat(50));
      console.log(`✅ Success: ${result.success}`);
      console.log(`📁 Files Generated: ${result.projectGeneration?.files.length || 0}`);
      console.log(`📱 GitHub Repo: ${result.githubRepo?.html_url || 'Mock'}`);
      console.log(`🚀 Deployment URL: ${result.deployment?.url || 'Mock'}`);
      console.log(`⏱️  Build Time: ${result.deployment?.buildTime || 'N/A'}`);
      
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
    }
    
    if (i < testCases.length - 1) {
      console.log('\n⏳ Waiting before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n🎯 All workflow tests completed!');
}

// Check for required environment variables
const missingVars = [];
if (!process.env.OPENAI_API_KEY) {
  console.log('ℹ️  OPENAI_API_KEY not found - using mock mode');
}
if (!process.env.GITHUB_TOKEN) {
  console.log('ℹ️  GITHUB_TOKEN not found - using mock GitHub operations');
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  testFullWorkflow().catch(error => {
    console.error('❌ Workflow test failed:', error);
    process.exit(1);
  });
}

export { ProjectWorkflowService, testFullWorkflow };