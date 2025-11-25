/**
 * Deployment Tools
 * Tools for managing project deployments
 * @module deploymentTools
 */

import { createTool, validators, responses, dbHelpers } from './baseTool.js';

const deployProject = createTool({
  definition: {
    name: 'deployProject',
    description: 'Deploy a project to production',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to deploy'
        },
        environment: {
          type: 'string',
          description: 'The target environment (production, staging)',
          enum: ['production', 'staging']
        },
        version: {
          type: 'string',
          description: 'The version tag for the deployment'
        }
      },
      required: ['projectId']
    }
  },
  implementation: async (args, context) => {
    const { projectId, environment = 'production', version } = args;
    const { db, user } = context;
    
    // Check project access
    const project = await dbHelpers.findProjectWithAccess(db, projectId, user);
    if (!project) {
      return responses.error('Project not found or access denied', 'PROJECT_ACCESS_DENIED');
    }
    
    // Create deployment job
    const deployJob = {
      type: 'deploy-repo',
      status: 'pending',
      projectId,
      userId: user._id,
      environment,
      version,
      createdAt: new Date(),
      metadata: {
        triggeredBy: 'ai-agent',
        agentId: context.agentId
      }
    };
    
    const result = await db.collection('jobs').insertOne(deployJob);
    
    // Create audit log
    await dbHelpers.createAuditLog(db, {
      action: 'deployment.initiated',
      userId: user._id,
      projectId,
      jobId: result.insertedId,
      metadata: { environment, version }
    });
    
    return responses.success({
      jobId: result.insertedId,
      environment,
      version
    }, `Deployment initiated for project ${project.name}`);
  },
  category: 'deployment',
  requiredPermissions: ['deploy'],
  requiredContext: ['db', 'user'],
  rateLimit: { requests: 10, window: '1h' },
  costEstimate: 'high',
  asyncExecution: true
});

const checkDeploymentStatus = createTool({
  definition: {
    name: 'checkDeploymentStatus',
    description: 'Check the status of a deployment',
    parameters: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: 'The deployment job ID'
        },
        projectId: {
          type: 'string',
          description: 'The project ID (alternative to jobId)'
        }
      }
    }
  },
  implementation: async (args, context) => {
    const { jobId, projectId } = args;
    const { db, user } = context;
    
    if (!jobId && !projectId) {
      return responses.error('Either jobId or projectId must be provided', 'MISSING_PARAMETER');
    }
    
    let query = {};
    
    if (jobId) {
      query._id = jobId;
    } else {
      query = {
        projectId,
        type: 'deploy-repo',
        userId: user._id
      };
    }
    
    const jobs = await db.collection('jobs')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();
    
    if (!jobs.length) {
      return responses.error('Deployment not found', 'NOT_FOUND');
    }
    
    const job = jobs[0];
    
    return responses.success({
      status: job.status,
      jobId: job._id,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      error: job.error,
      result: job.result
    });
  },
  category: 'deployment',
  requiredContext: ['db', 'user'],
  costEstimate: 'low'
});

const rollbackDeployment = createTool({
  definition: {
    name: 'rollbackDeployment',
    description: 'Rollback to a previous deployment',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID'
        },
        targetVersion: {
          type: 'string',
          description: 'The version to rollback to'
        }
      },
      required: ['projectId']
    }
  },
  implementation: async (args, context) => {
    const { projectId, targetVersion } = args;
    const { db, user } = context;
    
    // Check project access with admin permissions
    const project = await db.collection('projects').findOne({
      _id: projectId,
      $or: [
        { userId: user._id },
        { 'members.userId': user._id, 'members.role': { $in: ['admin', 'owner'] } }
      ]
    });
    
    if (!project) {
      return responses.error('Project not found or insufficient permissions', 'ACCESS_DENIED');
    }
    
    // Find the target deployment
    const targetDeploy = await db.collection('deploys').findOne({
      projectId,
      version: targetVersion || { $exists: true }
    });
    
    if (!targetDeploy) {
      return responses.error('Target deployment version not found', 'VERSION_NOT_FOUND');
    }
    
    // Create rollback job
    const rollbackJob = {
      type: 'deploy-repo',
      status: 'pending',
      projectId,
      userId: user._id,
      isRollback: true,
      targetVersion: targetDeploy.version,
      createdAt: new Date(),
      metadata: {
        triggeredBy: 'ai-agent',
        agentId: context.agentId,
        rollbackFrom: project.currentVersion
      }
    };
    
    const result = await db.collection('jobs').insertOne(rollbackJob);
    
    // Create audit log
    await dbHelpers.createAuditLog(db, {
      action: 'deployment.rollback',
      userId: user._id,
      projectId,
      jobId: result.insertedId,
      metadata: {
        fromVersion: project.currentVersion,
        toVersion: targetDeploy.version
      }
    });
    
    return responses.success({
      jobId: result.insertedId,
      fromVersion: project.currentVersion,
      toVersion: targetDeploy.version
    }, `Rollback initiated to version ${targetDeploy.version}`);
  },
  category: 'deployment',
  requiredPermissions: ['deploy', 'admin'],
  requiredContext: ['db', 'user'],
  rateLimit: { requests: 5, window: '1h' },
  costEstimate: 'high',
  asyncExecution: true
});

const updateEnvironment = createTool({
  definition: {
    name: 'updateEnvironment',
    description: 'Update environment variables for a deployment',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID'
        },
        environment: {
          type: 'string',
          description: 'The environment to update',
          enum: ['production', 'staging']
        },
        variables: {
          type: 'object',
          description: 'Environment variables to set'
        },
        removeVariables: {
          type: 'array',
          items: { type: 'string' },
          description: 'Environment variable names to remove'
        }
      },
      required: ['projectId', 'environment']
    }
  },
  implementation: async (args, context) => {
    const { projectId, environment, variables = {}, removeVariables = [] } = args;
    const { db, user } = context;
    
    // Check project access with admin permissions
    const project = await db.collection('projects').findOne({
      _id: projectId,
      $or: [
        { userId: user._id },
        { 'members.userId': user._id, 'members.role': { $in: ['admin', 'owner'] } }
      ]
    });
    
    if (!project) {
      return responses.error('Project not found or insufficient permissions', 'ACCESS_DENIED');
    }
    
    // Update environment configuration
    const updateOp = {
      $set: {},
      $unset: {}
    };
    
    // Set new variables
    for (const [key, value] of Object.entries(variables)) {
      updateOp.$set[`environments.${environment}.${key}`] = value;
    }
    
    // Remove variables
    for (const key of removeVariables) {
      updateOp.$unset[`environments.${environment}.${key}`] = '';
    }
    
    await db.collection('projects').updateOne(
      { _id: projectId },
      updateOp
    );
    
    // Create audit log
    await dbHelpers.createAuditLog(db, {
      action: 'environment.updated',
      userId: user._id,
      projectId,
      metadata: {
        environment,
        updated: Object.keys(variables),
        removed: removeVariables
      }
    });
    
    return responses.success({
      updated: Object.keys(variables),
      removed: removeVariables
    }, `Environment variables updated for ${environment}`);
  },
  category: 'deployment',
  requiredPermissions: ['deploy', 'admin'],
  requiredContext: ['db', 'user'],
  costEstimate: 'low'
});

// Create a batch of deployment status tools
const statusToolsConfig = [
  {
    definition: {
      name: 'listDeployments',
      description: 'List recent deployments for a project',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'The project ID' },
          limit: { type: 'number', description: 'Number of deployments to return', default: 10 }
        },
        required: ['projectId']
      }
    },
    implementation: async (args, context) => {
      const { projectId, limit = 10 } = args;
      const { db, user } = context;
      
      const project = await dbHelpers.findProjectWithAccess(db, projectId, user);
      if (!project) {
        return responses.error('Project not found or access denied', 'PROJECT_ACCESS_DENIED');
      }
      
      const deployments = await db.collection('deploys')
        .find({ projectId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      
      return responses.paginated(deployments, {
        limit,
        total: deployments.length
      });
    }
  },
  {
    definition: {
      name: 'getDeploymentLogs',
      description: 'Get logs for a specific deployment',
      parameters: {
        type: 'object',
        properties: {
          deployId: { type: 'string', description: 'The deployment ID' },
          lines: { type: 'number', description: 'Number of log lines to return', default: 100 }
        },
        required: ['deployId']
      }
    },
    implementation: async (args, context) => {
      const { deployId, lines = 100 } = args;
      const { db, user } = context;
      
      const deploy = await db.collection('deploys').findOne({ _id: deployId });
      if (!deploy) {
        return responses.error('Deployment not found', 'NOT_FOUND');
      }
      
      // Verify project access
      const project = await dbHelpers.findProjectWithAccess(db, deploy.projectId, user);
      if (!project) {
        return responses.error('Access denied', 'ACCESS_DENIED');
      }
      
      // In real implementation, fetch logs from logging service
      return responses.success({
        deployId,
        logs: deploy.logs || [],
        truncated: false
      });
    }
  }
];

// Export individual tools and batched tools
export {
  deployProject,
  checkDeploymentStatus,
  rollbackDeployment,
  updateEnvironment
};

// Export the status tools as a group
export const statusTools = statusToolsConfig.map(config => createTool({
  ...config,
  category: 'deployment',
  requiredContext: ['db', 'user'],
  costEstimate: 'low'
}));