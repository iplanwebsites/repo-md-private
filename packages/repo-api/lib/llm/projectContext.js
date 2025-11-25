import { db } from '../../db.js';
import { ObjectId } from 'mongodb';

/**
 * Load comprehensive project context for AI agents
 */
export async function loadProjectContext(projectId) {
  if (!projectId) return null;
  
  try {
    // Get project details
    const project = await db.projects.findOne({
      _id: ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId
    });
    
    if (!project) return null;
    
    // Get project statistics
    const [postsCount, mediasCount, lastDeploy, recentJobs] = await Promise.all([
      // Count posts (assuming posts are stored with projectId)
      db.posts ? db.posts.countDocuments({ projectId: project._id }) : 0,
      
      // Count medias
      db.medias ? db.medias.countDocuments({ projectId: project._id }) : 0,
      
      // Get last deployment
      db.deploys.findOne(
        { projectId: project._id },
        { sort: { createdAt: -1 } }
      ),
      
      // Get recent jobs
      db.jobs.find(
        { projectId: project._id.toString() },
        { limit: 5, sort: { createdAt: -1 } }
      ).toArray()
    ]);
    
    // Build context object
    const context = {
      // Basic info
      id: project._id.toString(),
      name: project.name,
      description: project.description,
      handle: project.handle,
      visibility: project.visibility || 'private',
      
      // Dates
      createdAt: project.createdAt,
      updatedAt: project.updatedAt || project.createdAt,
      lastDeployedAt: lastDeploy?.createdAt,
      
      // GitHub info
      githubRepo: project.githubRepo ? {
        owner: project.githubRepo.owner,
        repoName: project.githubRepo.repoName,
        defaultBranch: project.githubRepo.defaultBranch || 'main',
        url: `https://github.com/${project.githubRepo.owner}/${project.githubRepo.repoName}`
      } : null,
      
      // Statistics
      stats: {
        postsCount,
        mediasCount,
        deploysCount: lastDeploy ? 1 : 0, // Could enhance this
        lastJobStatus: recentJobs[0]?.status || 'none',
        recentJobTypes: recentJobs.map(j => j.type)
      },
      
      // Settings
      settings: project.settings || {},
      
      // Organization
      orgId: project.orgId,
      
      // Configuration from repo.md.json
      repoConfig: project.repoConfig || {},
      
      // Theme and customization
      theme: project.settings?.themeId || 'default',
      customStyles: project.settings?.customStyles || null,
      
      // SEO/Metadata
      siteMetadata: project.settings?.siteMetadata || {},
      
      // Features/Capabilities
      features: {
        hasGitHub: !!project.githubRepo,
        hasDeploys: !!lastDeploy,
        hasCustomDomain: !!project.settings?.customDomain,
        hasBlog: postsCount > 0,
        hasMedia: mediasCount > 0
      }
    };
    
    return context;
  } catch (error) {
    console.error('Error loading project context:', error);
    return null;
  }
}

/**
 * Generate system prompt with project context
 */
export function generateProjectSystemPrompt(projectContext) {
  if (!projectContext) return '';
  
  const parts = [
    `You have access to information about the current project: "${projectContext.name}"`,
    '',
    '## Project Information',
    `- Name: ${projectContext.name}`,
    `- Description: ${projectContext.description || 'No description'}`,
    `- Created: ${new Date(projectContext.createdAt).toLocaleDateString()}`,
    `- Last Updated: ${new Date(projectContext.updatedAt).toLocaleDateString()}`,
    projectContext.lastDeployedAt ? `- Last Deployed: ${new Date(projectContext.lastDeployedAt).toLocaleDateString()}` : '- Never deployed',
    '',
    '## Project Statistics',
    `- Total Posts: ${projectContext.stats.postsCount}`,
    `- Total Media Files: ${projectContext.stats.mediasCount}`,
    `- Deployment Status: ${projectContext.stats.deploysCount > 0 ? 'Active' : 'Not deployed'}`,
  ];
  
  if (projectContext.githubRepo) {
    parts.push(
      '',
      '## GitHub Repository',
      `- Owner: ${projectContext.githubRepo.owner}`,
      `- Repository: ${projectContext.githubRepo.repoName}`,
      `- Default Branch: ${projectContext.githubRepo.defaultBranch}`,
      `- URL: ${projectContext.githubRepo.url}`
    );
  }
  
  if (projectContext.features.hasCustomDomain) {
    parts.push(
      '',
      '## Custom Domain',
      `- Domain: ${projectContext.settings.customDomain}`
    );
  }
  
  if (projectContext.siteMetadata.title) {
    parts.push(
      '',
      '## Site Metadata',
      `- Title: ${projectContext.siteMetadata.title}`,
      `- Description: ${projectContext.siteMetadata.description || 'Not set'}`,
      projectContext.siteMetadata.keywords?.length > 0 
        ? `- Keywords: ${projectContext.siteMetadata.keywords.join(', ')}`
        : ''
    );
  }
  
  parts.push(
    '',
    '## Available Features',
    Object.entries(projectContext.features)
      .filter(([_, enabled]) => enabled)
      .map(([feature, _]) => `- ${feature.replace(/^has/, '').replace(/([A-Z])/g, ' $1').trim()}`)
      .join('\n'),
    '',
    'Use this information to provide accurate responses about the project status, statistics, and configuration.'
  );
  
  return parts.filter(line => line !== null).join('\n');
}