import express from "express";
import crypto from "crypto";
import { db } from "../../db.js";
import { ObjectId } from "mongodb";
import asyncHandler from "../../utils/asyncHandler.js";
import cloudRunService from "../../lib/cloudRun.js";

const router = express.Router();

// Debug flag for webhook testing
const DEBUG_WEBHOOKS = process.env.DEBUG_WEBHOOKS === 'true' || process.env.NODE_ENV === 'development';

// GitHub webhook secret for validating webhook payloads
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

/**
 * Verify GitHub webhook signature
 * @param {string} payload - Raw request payload
 * @param {string} signature - GitHub signature header
 * @returns {boolean} - True if signature is valid
 */
function verifyGitHubSignature(payload, signature) {
  if (!GITHUB_WEBHOOK_SECRET) {
    console.warn("⚠️ GitHub webhook secret not configured - skipping signature verification");
    return true; // Allow webhooks in development without secret
  }

  if (!signature) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET);
  hmac.update(payload);
  const calculatedSignature = `sha256=${hmac.digest('hex')}`;
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(calculatedSignature)
  );
}

/**
 * Find project by repository information
 * @param {Object} repository - GitHub repository object
 * @returns {Object|null} - Project document or null
 */
async function findProjectByRepo(repository) {
  // Try multiple ways to match the repository
  const repoFullName = repository.full_name;
  const repoUrl = repository.html_url;
  const repoCloneUrl = repository.clone_url;
  
  // Search by multiple possible fields
  const project = await db.projects.findOne({
    $or: [
      { "githubRepo.fullName": repoFullName },
      { "github.fullName": repoFullName },
      { repoUrl: repoUrl },
      { repoUrl: repoCloneUrl },
      { repoUrl: repository.ssh_url },
      { "github.repoName": repository.name, "github.owner": repository.owner.login }
    ]
  });

  return project;
}

/**
 * Get GitHub token for project owner
 * @param {string} ownerId - Project owner user ID
 * @returns {string|null} - GitHub token or null
 */
async function getProjectOwnerGitToken(ownerId) {
  try {
    const user = await db.users.findOne({ id: ownerId });
    
    if (user && user.githubSupaToken) {
      return user.githubSupaToken;
    }
    
    // Fallback to environment token
    return process.env.TEMP_GH_TOKEN_FELIX;
  } catch (error) {
    console.error(`Error getting GitHub token for user ${ownerId}:`, error);
    return process.env.TEMP_GH_TOKEN_FELIX;
  }
}

/**
 * Process push event and trigger deployment
 * @param {Object} payload - GitHub webhook payload
 * @param {Object} project - Project document
 * @returns {Object} - Processing result
 */
async function processPushEvent(payload, project) {
  const { repository, ref, head_commit, pusher } = payload;
  
  // Extract branch name from ref (refs/heads/main -> main)
  const branch = ref.replace('refs/heads/', '');
  
  console.log(`📝 Processing push to ${repository.full_name}:${branch}`);
  console.log(`🔄 Commit: ${head_commit.id} by ${pusher.name}`);
  
  // Check if this is a branch creation event (no head_commit for new branches)
  if (!head_commit) {
    console.log(`⏭️ Skipping branch creation event for ${branch}`);
    return {
      success: true,
      skipped: true,
      reason: 'Branch creation event - no deployment needed',
      branch: branch
    };
  }
  
  // Only deploy on main or master branches
  const deploymentBranches = ['main', 'master'];
  if (!deploymentBranches.includes(branch)) {
    console.log(`⏭️ Skipping deployment for branch '${branch}' - only deploying on: ${deploymentBranches.join(', ')}`);
    return {
      success: true,
      skipped: true,
      reason: `Branch '${branch}' not in deployment branches: ${deploymentBranches.join(', ')}`,
      branch: branch
    };
  }
  
  // Get project owner's GitHub token
  const gitToken = await getProjectOwnerGitToken(project.ownerId);
  
  if (!gitToken) {
    throw new Error("No GitHub token found for project owner");
  }
  
  // Build the static domain URL for absolute paths
  const projectSlugValue = project.slug || project.name;
  const orgSlugValue = project.orgId || "_unknown-org-slug";
  const staticDomain = `https://static.repo.md/${orgSlugValue}/${projectSlugValue}`;

  // Create deployment job using the same flow as manual deployments
  const deploymentData = {
    projectId: project._id.toString(),
    userId: project.ownerId,
    commit: head_commit.id,
    branch: branch,
    gitToken: gitToken,
    repoUrl: repository.clone_url,
    projectSlug: projectSlugValue,
    orgSlug: orgSlugValue,
    orgId: project.orgId,
    // Build settings from project settings
    repositoryFolder: project.settings?.build?.repositoryFolder || "",
    ignoreFiles: project.settings?.build?.ignoreFiles || "",
    // Formatting settings for media/link paths
    notePrefix: project.formatting?.pageLinkPrefix || "",
    mediaPrefix: project.formatting?.mediaPrefix || "/_repo/medias",
    domain: staticDomain, // Always use absolute paths with static.repo.md
    // Add webhook metadata
    triggeredBy: 'webhook',
    webhook: {
      event: 'push',
      pusher: pusher.name,
      pusherEmail: pusher.email,
      commitMessage: head_commit.message,
      timestamp: new Date()
    }
  };
  
  // Create the deployment job
  const job = await cloudRunService.createJob("deploy-repo", deploymentData);
  
  console.log(`🚀 Webhook triggered deployment job: ${job._id}`);
  
  // Note: Slack notification is already sent by cloudRunService.createJob()
  // No need to send it again here
  
  return {
    success: true,
    jobId: job._id.toString(),
    projectId: project._id.toString(),
    branch: branch,
    commit: head_commit.id
  };
}

// Middleware to parse raw body for signature verification
router.use('/webhook', express.raw({ type: 'application/json' }));

// GitHub webhook endpoint
router.post('/webhook', asyncHandler(async (req, res) => {
  const signature = req.get('X-Hub-Signature-256');
  const event = req.get('X-GitHub-Event');
  const delivery = req.get('X-GitHub-Delivery');
  
  console.log(`\n🎣 ====== GITHUB WEBHOOK RECEIVED ======`);
  console.log(`📨 Event: ${event}`);
  console.log(`📦 Delivery ID: ${delivery}`);
  console.log(`🔐 Has Signature: ${!!signature}`);
  
  // Verify signature
  if (!verifyGitHubSignature(req.body, signature)) {
    console.error('❌ Invalid GitHub webhook signature');
    return res.status(401).json({
      success: false,
      message: 'Invalid signature'
    });
  }
  
  // Parse JSON payload
  let payload;
  try {
    // Check if body is already parsed as object or if it's raw buffer/string
    if (typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body)) {
      payload = req.body;
    } else {
      payload = JSON.parse(req.body.toString());
    }
  } catch (error) {
    console.error('❌ Invalid JSON payload:', error);
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload'
    });
  }
  
  if (DEBUG_WEBHOOKS) {
    console.log('🐛 DEBUG MODE: Full payload:', JSON.stringify(payload, null, 2));
  }
  
  // Store webhook event in gitEvents collection
  const gitEvent = {
    _id: new ObjectId(),
    event: event,
    delivery: delivery,
    repository: payload.repository ? {
      id: payload.repository.id,
      name: payload.repository.name,
      fullName: payload.repository.full_name,
      owner: payload.repository.owner.login,
      private: payload.repository.private
    } : null,
    payload: payload,
    signature: signature,
    timestamp: new Date(),
    processed: false,
    projectId: null,
    orgSlug: null
  };
  
  // Insert webhook event
  await db.gitEvents.insertOne(gitEvent);
  console.log(`📝 Stored webhook event: ${gitEvent._id}`);
  
  // Only process push events for now
  if (event !== 'push') {
    console.log(`ℹ️ Ignoring non-push event: ${event}`);
    
    // Update event as processed but ignored
    await db.gitEvents.updateOne(
      { _id: gitEvent._id },
      { 
        $set: { 
          processed: true, 
          ignored: true,
          ignoredReason: `Event type '${event}' not supported`
        }
      }
    );
    
    return res.json({
      success: true,
      message: `Event '${event}' received but not processed`,
      eventId: gitEvent._id.toString()
    });
  }
  
  try {
    // Find project for this repository
    const project = await findProjectByRepo(payload.repository);
    
    if (!project) {
      console.log(`⚠️ No project found for repository: ${payload.repository.full_name}`);
      
      // Update event as processed but no project found
      await db.gitEvents.updateOne(
        { _id: gitEvent._id },
        { 
          $set: { 
            processed: true, 
            ignored: true,
            ignoredReason: `No project found for repository ${payload.repository.full_name}`
          }
        }
      );
      
      return res.json({
        success: true,
        message: `No project found for repository: ${payload.repository.full_name}`,
        eventId: gitEvent._id.toString()
      });
    }
    
    console.log(`✅ Found project: ${project.name} (${project._id})`);
    
    // Update git event with project info
    await db.gitEvents.updateOne(
      { _id: gitEvent._id },
      { 
        $set: { 
          projectId: project._id.toString(),
          orgSlug: project.orgId
        }
      }
    );
    
    // Process the push event
    const result = await processPushEvent(payload, project);
    
    // Check if the event was skipped due to filtering
    if (result.skipped) {
      console.log(`⏭️ Webhook event skipped: ${result.reason}`);
      
      // Mark event as processed but skipped
      await db.gitEvents.updateOne(
        { _id: gitEvent._id },
        { 
          $set: { 
            processed: true,
            skipped: true,
            skipReason: result.reason,
            processingResult: result,
            processedAt: new Date()
          }
        }
      );
      
      return res.json({
        success: true,
        message: `Webhook received but skipped: ${result.reason}`,
        eventId: gitEvent._id.toString(),
        ...result
      });
    }
    
    // Mark event as processed
    await db.gitEvents.updateOne(
      { _id: gitEvent._id },
      { 
        $set: { 
          processed: true,
          processingResult: result,
          processedAt: new Date()
        }
      }
    );
    
    console.log(`✅ Webhook processed successfully`);
    
    return res.json({
      success: true,
      message: 'Webhook processed successfully',
      eventId: gitEvent._id.toString(),
      ...result
    });
    
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    
    // Mark event as failed
    await db.gitEvents.updateOne(
      { _id: gitEvent._id },
      { 
        $set: { 
          processed: true,
          failed: true,
          error: error.message,
          processedAt: new Date()
        }
      }
    );
    
    return res.status(500).json({
      success: false,
      message: 'Error processing webhook',
      error: error.message,
      eventId: gitEvent._id.toString()
    });
  }
}));

// Health check endpoint
router.get('/webhook/health', (req, res) => {
  res.json({
    success: true,
    message: 'GitHub webhook endpoint is healthy',
    timestamp: new Date()
  });
});

// ======= WEBHOOK SIMULATION ENDPOINTS FOR TESTING =======
// These endpoints are only available in development or when DEBUG_WEBHOOKS is true

if (DEBUG_WEBHOOKS) {
  // Simulate a push webhook for testing
  router.post('/webhook/simulate/push', asyncHandler(async (req, res) => {
    const { 
      repoFullName = 'test-user/test-repo',
      repoBranch = 'main',
      commitId = 'abc123def456',
      commitMessage = 'Test commit for webhook simulation',
      pusherName = 'test-user',
      pusherEmail = 'test@example.com'
    } = req.body;

    const simulatedPayload = {
      ref: `refs/heads/${repoBranch}`,
      repository: {
        id: 123456789,
        name: repoFullName.split('/')[1],
        full_name: repoFullName,
        owner: {
          login: repoFullName.split('/')[0],
          id: 87654321
        },
        private: false,
        html_url: `https://github.com/${repoFullName}`,
        clone_url: `https://github.com/${repoFullName}.git`,
        ssh_url: `git@github.com:${repoFullName}.git`
      },
      head_commit: {
        id: commitId,
        message: commitMessage,
        timestamp: new Date().toISOString(),
        author: {
          name: pusherName,
          email: pusherEmail
        }
      },
      pusher: {
        name: pusherName,
        email: pusherEmail
      }
    };

    // Create a mock request object
    const mockReq = {
      body: Buffer.from(JSON.stringify(simulatedPayload)),
      get: (header) => {
        switch (header) {
          case 'X-GitHub-Event':
            return 'push';
          case 'X-GitHub-Delivery':
            return `sim-${Date.now()}`;
          case 'X-Hub-Signature-256':
            return 'sha256=simulated-signature';
          default:
            return null;
        }
      }
    };

    console.log('\n🧪 ====== SIMULATED GITHUB WEBHOOK ======');
    console.log(`📨 Simulating push to: ${repoFullName}:${repoBranch}`);
    console.log(`🔄 Commit: ${commitId}`);
    console.log(`👤 Pusher: ${pusherName}`);

    try {
      // Process the simulated webhook using the same logic
      const signature = mockReq.get('X-Hub-Signature-256');
      const event = mockReq.get('X-GitHub-Event');
      const delivery = mockReq.get('X-GitHub-Delivery');

      // Parse JSON payload
      const payload = JSON.parse(mockReq.body.toString());

      if (DEBUG_WEBHOOKS) {
        console.log('🐛 DEBUG MODE: Simulated payload:', JSON.stringify(payload, null, 2));
      }

      // Store webhook event in gitEvents collection
      const gitEvent = {
        _id: new ObjectId(),
        event: event,
        delivery: delivery,
        repository: payload.repository ? {
          id: payload.repository.id,
          name: payload.repository.name,
          fullName: payload.repository.full_name,
          owner: payload.repository.owner.login,
          private: payload.repository.private
        } : null,
        payload: payload,
        signature: signature,
        timestamp: new Date(),
        processed: false,
        projectId: null,
        orgSlug: null,
        simulated: true
      };

      // Insert webhook event
      await db.gitEvents.insertOne(gitEvent);
      console.log(`📝 Stored simulated webhook event: ${gitEvent._id}`);

      // Find project for this repository
      const project = await findProjectByRepo(payload.repository);
      
      if (!project) {
        console.log(`⚠️ No project found for repository: ${payload.repository.full_name}`);
        
        await db.gitEvents.updateOne(
          { _id: gitEvent._id },
          { 
            $set: { 
              processed: true, 
              ignored: true,
              ignoredReason: `No project found for repository ${payload.repository.full_name}`
            }
          }
        );
        
        return res.json({
          success: true,
          message: `Simulated webhook: No project found for repository: ${payload.repository.full_name}`,
          eventId: gitEvent._id.toString(),
          simulation: true
        });
      }
      
      console.log(`✅ Found project: ${project.name} (${project._id})`);
      
      // Update git event with project info
      await db.gitEvents.updateOne(
        { _id: gitEvent._id },
        { 
          $set: { 
            projectId: project._id.toString(),
            orgSlug: project.orgId
          }
        }
      );
      
      // Process the push event
      const result = await processPushEvent(payload, project);
      
      // Check if the event was skipped due to filtering
      if (result.skipped) {
        console.log(`⏭️ Simulated webhook event skipped: ${result.reason}`);
        
        // Mark event as processed but skipped
        await db.gitEvents.updateOne(
          { _id: gitEvent._id },
          { 
            $set: { 
              processed: true,
              skipped: true,
              skipReason: result.reason,
              processingResult: result,
              processedAt: new Date()
            }
          }
        );
        
        return res.json({
          success: true,
          message: `Simulated webhook received but skipped: ${result.reason}`,
          eventId: gitEvent._id.toString(),
          simulation: true,
          ...result
        });
      }
      
      // Mark event as processed
      await db.gitEvents.updateOne(
        { _id: gitEvent._id },
        { 
          $set: { 
            processed: true,
            processingResult: result,
            processedAt: new Date()
          }
        }
      );
      
      console.log('✅ Simulated webhook processed successfully');
      
      return res.json({
        success: true,
        message: 'Simulated webhook processed successfully',
        eventId: gitEvent._id.toString(),
        simulation: true,
        ...result
      });

    } catch (error) {
      console.error('❌ Error processing simulated webhook:', error);
      return res.status(500).json({
        success: false,
        message: 'Error processing simulated webhook',
        error: error.message,
        simulation: true
      });
    }
  }));

  // List available webhook simulation options
  router.get('/webhook/simulate/options', (req, res) => {
    res.json({
      success: true,
      message: 'Available webhook simulations',
      simulations: [
        {
          endpoint: '/api/github/webhook/simulate/push',
          method: 'POST',
          description: 'Simulate a GitHub push webhook',
          parameters: {
            repoFullName: 'string (optional) - Format: owner/repo (default: test-user/test-repo)',
            repoBranch: 'string (optional) - Branch name (default: main)',
            commitId: 'string (optional) - Commit hash (default: abc123def456)',
            commitMessage: 'string (optional) - Commit message (default: Test commit for webhook simulation)',
            pusherName: 'string (optional) - Pusher name (default: test-user)',
            pusherEmail: 'string (optional) - Pusher email (default: test@example.com)'
          },
          example: {
            repoFullName: 'myorg/myrepo',
            repoBranch: 'feature/new-feature',
            commitId: '1a2b3c4d5e6f',
            commitMessage: 'Add new feature',
            pusherName: 'developer',
            pusherEmail: 'dev@company.com'
          }
        }
      ]
    });
  });

  console.log('🧪 Webhook simulation endpoints enabled (DEBUG_WEBHOOKS=true)');
}

export default router;