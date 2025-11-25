import { createTool, responses } from './baseTool.js';
import { db } from '../../../db.js';
import { ObjectId } from 'mongodb';

// Try to import blog search function, provide mock if not available
let searchBlogByContent;
try {
  const blogModule = await import('../../blog.js');
  searchBlogByContent = blogModule.searchBlogByContent;
} catch (error) {
  // Mock implementation if blog search not available
  searchBlogByContent = null;
}

/**
 * Search for posts in the project
 */
export const searchProjectPosts = createTool({
  definition: {
    name: 'search_project_posts',
    description: 'Search for blog posts in the current project by keyword or content',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find posts'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return',
          default: 10
        }
      },
      required: ['query']
    }
  },
  implementation: async (args, context) => {
    const { query, limit = 10 } = args;
    const { project } = context;
    
    if (!project) {
      return responses.error('No project context available');
    }
    
    try {
      // First try blog search if available
      if (searchBlogByContent) {
        const blogResults = searchBlogByContent(query, limit);
        
        if (blogResults && blogResults.length > 0) {
          return responses.success(
            {
              posts: blogResults.map(post => ({
                title: post.title,
                slug: post.slug,
                excerpt: post.excerpt || post.content?.substring(0, 200) + '...',
                date: post.date,
                author: post.author,
                tags: post.tags || [],
                category: post.category,
                score: post.score
              })),
              total: blogResults.length
            },
            `Found ${blogResults.length} posts matching "${query}"`
          );
        }
      }
      
      // Fallback to database search if blog search not available
      // This assumes posts are stored in a posts collection
      if (db.posts) {
        const posts = await db.posts.find({
          projectId: project._id,
          $or: [
            { title: { $regex: query, $options: 'i' } },
            { content: { $regex: query, $options: 'i' } },
            { tags: { $in: [new RegExp(query, 'i')] } }
          ]
        })
        .limit(limit)
        .toArray();
        
        return responses.success(
          {
            posts: posts.map(post => ({
              id: post._id.toString(),
              title: post.title,
              slug: post.slug,
              excerpt: post.excerpt || post.content?.substring(0, 200) + '...',
              date: post.createdAt,
              author: post.author,
              tags: post.tags || []
            })),
            total: posts.length
          },
          `Found ${posts.length} posts in database matching "${query}"`
        );
      }
      
      return responses.success(
        { posts: [], total: 0 },
        'Post search not available for this project'
      );
      
    } catch (error) {
      return responses.error(`Failed to search posts: ${error.message}`);
    }
  },
  category: 'project',
  requiredPermissions: ['read'],
  requiredContext: ['project']
});

/**
 * List media files in the project
 */
export const listProjectMedia = createTool({
  definition: {
    name: 'list_project_media',
    description: 'List media files (images, videos) in the current project',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['all', 'image', 'video', 'document'],
          description: 'Filter by media type',
          default: 'all'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 20
        }
      }
    }
  },
  implementation: async (args, context) => {
    const { type = 'all', limit = 20 } = args;
    const { project } = context;
    
    if (!project) {
      return responses.error('No project context available');
    }
    
    try {
      // Check if medias collection exists
      if (!db.medias) {
        return responses.success(
          { media: [], total: 0 },
          'Media collection not available'
        );
      }
      
      // Build query
      const query = { projectId: project._id };
      if (type !== 'all') {
        query.type = type;
      }
      
      // Get media files
      const mediaFiles = await db.medias
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      
      const total = await db.medias.countDocuments(query);
      
      return responses.success(
        {
          media: mediaFiles.map(file => ({
            id: file._id.toString(),
            filename: file.filename,
            type: file.type,
            size: file.size,
            url: file.url,
            thumbnailUrl: file.thumbnailUrl,
            createdAt: file.createdAt,
            metadata: file.metadata || {}
          })),
          total,
          showing: mediaFiles.length
        },
        `Found ${total} media files${type !== 'all' ? ` of type ${type}` : ''}`
      );
      
    } catch (error) {
      return responses.error(`Failed to list media: ${error.message}`);
    }
  },
  category: 'project',
  requiredPermissions: ['read'],
  requiredContext: ['project']
});

/**
 * Get project statistics
 */
export const getProjectStats = createTool({
  definition: {
    name: 'get_project_stats',
    description: 'Get detailed statistics about the current project',
    parameters: {
      type: 'object',
      properties: {
        includeDetails: {
          type: 'boolean',
          description: 'Include detailed breakdowns',
          default: false
        }
      }
    }
  },
  implementation: async (args, context) => {
    const { includeDetails = false } = args;
    const { project } = context;
    
    if (!project) {
      return responses.error('No project context available');
    }
    
    try {
      // Gather statistics
      const stats = {
        posts: {
          total: 0,
          byCategory: {},
          recentCount: 0
        },
        media: {
          total: 0,
          byType: {},
          totalSize: 0
        },
        deployments: {
          total: 0,
          successful: 0,
          failed: 0,
          lastDeploy: null
        },
        jobs: {
          total: 0,
          byType: {},
          recentStatus: {}
        }
      };
      
      // Get posts stats
      if (db.posts) {
        stats.posts.total = await db.posts.countDocuments({ projectId: project._id });
        
        if (includeDetails) {
          const categories = await db.posts.aggregate([
            { $match: { projectId: project._id } },
            { $group: { _id: '$category', count: { $sum: 1 } } }
          ]).toArray();
          
          categories.forEach(cat => {
            stats.posts.byCategory[cat._id || 'uncategorized'] = cat.count;
          });
          
          // Recent posts (last 30 days)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          stats.posts.recentCount = await db.posts.countDocuments({
            projectId: project._id,
            createdAt: { $gte: thirtyDaysAgo }
          });
        }
      }
      
      // Get media stats
      if (db.medias) {
        stats.media.total = await db.medias.countDocuments({ projectId: project._id });
        
        if (includeDetails) {
          const mediaTypes = await db.medias.aggregate([
            { $match: { projectId: project._id } },
            { $group: { 
              _id: '$type', 
              count: { $sum: 1 },
              totalSize: { $sum: '$size' }
            }}
          ]).toArray();
          
          mediaTypes.forEach(type => {
            stats.media.byType[type._id] = {
              count: type.count,
              size: type.totalSize
            };
            stats.media.totalSize += type.totalSize;
          });
        }
      }
      
      // Get deployment stats
      const deployments = await db.deploys.find({ 
        projectId: project._id 
      }).sort({ createdAt: -1 }).limit(includeDetails ? 100 : 1).toArray();
      
      stats.deployments.total = await db.deploys.countDocuments({ projectId: project._id });
      stats.deployments.successful = await db.deploys.countDocuments({ 
        projectId: project._id,
        status: 'completed'
      });
      stats.deployments.failed = await db.deploys.countDocuments({ 
        projectId: project._id,
        status: 'failed'
      });
      
      if (deployments.length > 0) {
        stats.deployments.lastDeploy = {
          date: deployments[0].createdAt,
          status: deployments[0].status,
          duration: deployments[0].duration
        };
      }
      
      // Get job stats
      const recentJobs = await db.jobs.find({
        projectId: project._id.toString()
      }).sort({ createdAt: -1 }).limit(50).toArray();
      
      stats.jobs.total = await db.jobs.countDocuments({ 
        projectId: project._id.toString() 
      });
      
      if (includeDetails) {
        recentJobs.forEach(job => {
          stats.jobs.byType[job.type] = (stats.jobs.byType[job.type] || 0) + 1;
          stats.jobs.recentStatus[job.status] = (stats.jobs.recentStatus[job.status] || 0) + 1;
        });
      }
      
      return responses.success(
        stats,
        `Retrieved comprehensive statistics for project "${project.name}"`
      );
      
    } catch (error) {
      return responses.error(`Failed to get project stats: ${error.message}`);
    }
  },
  category: 'project',
  requiredPermissions: ['read'],
  requiredContext: ['project']
});

/**
 * Get project file structure
 */
export const getProjectFileTree = createTool({
  definition: {
    name: 'get_project_file_tree',
    description: 'Get the file structure of the project repository',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to list (default: root)',
          default: '/'
        },
        maxDepth: {
          type: 'number',
          description: 'Maximum depth to traverse',
          default: 3
        }
      }
    }
  },
  implementation: async (args, context) => {
    const { path = '/', maxDepth = 3 } = args;
    const { project } = context;
    
    if (!project || !project.githubRepo) {
      return responses.error('No GitHub repository configured for this project');
    }
    
    try {
      // This would integrate with GitHub API to get file tree
      // For now, return a mock response
      return responses.success(
        {
          message: 'File tree functionality requires GitHub integration',
          githubRepo: {
            owner: project.githubRepo.owner,
            name: project.githubRepo.repoName
          }
        },
        'Use the read_file or search_project_files tools to work with specific files'
      );
      
    } catch (error) {
      return responses.error(`Failed to get file tree: ${error.message}`);
    }
  },
  category: 'project',
  requiredPermissions: ['read'],
  requiredContext: ['project']
});

// Export all project tools
export default {
  searchProjectPosts,
  listProjectMedia,
  getProjectStats,
  getProjectFileTree
};