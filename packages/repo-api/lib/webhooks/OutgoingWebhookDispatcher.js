import { db } from "../../db.js";
import { ObjectId } from "mongodb";
import WebhookSigner from "./WebhookSigner.js";

/**
 * Dispatches outgoing webhooks for project events
 */
class OutgoingWebhookDispatcher {
  constructor() {
    this.timeout = 30000; // 30 second timeout
  }
  
  /**
   * Dispatch an event to all configured webhooks
   * @param {string} projectId - Project ID
   * @param {string} eventType - Event type
   * @param {Object} eventData - Event payload data
   */
  async dispatch(projectId, eventType, eventData) {
    try {
      // Find all active webhooks for this event
      const webhooks = await db.projectOutgoingWebhooks.find({
        projectId: new ObjectId(projectId),
        events: eventType,
        isActive: true
      }).toArray();
      
      if (webhooks.length === 0) {
        console.log(`No active webhooks found for event ${eventType} in project ${projectId}`);
        return;
      }
      
      console.log(`📤 Dispatching ${eventType} to ${webhooks.length} webhooks for project ${projectId}`);
      
      // Create executions for each webhook
      const promises = webhooks.map(webhook => 
        this.createAndQueueExecution(webhook, eventType, eventData)
      );
      
      await Promise.all(promises);
      
    } catch (error) {
      console.error(`Error dispatching webhooks for ${eventType}:`, error);
    }
  }
  
  /**
   * Create execution record and queue for delivery
   * @param {Object} webhook - Webhook configuration
   * @param {string} eventType - Event type
   * @param {Object} eventData - Event data
   */
  async createAndQueueExecution(webhook, eventType, eventData) {
    try {
      // Create execution record
      const execution = {
        _id: new ObjectId(),
        webhookId: webhook._id,
        projectId: webhook.projectId,
        triggerEvent: eventType,
        triggerData: eventData,
        status: 'pending',
        attempts: [],
        createdAt: new Date()
      };
      
      await db.projectOutgoingWebhookEvents.insertOne(execution);
      
      // Deliver immediately (in production, this could be queued)
      await this.deliverWebhook(execution._id.toString());
      
    } catch (error) {
      console.error(`Error creating webhook execution:`, error);
    }
  }
  
  /**
   * Deliver a webhook
   * @param {string} executionId - Execution ID
   */
  async deliverWebhook(executionId) {
    const execution = await db.projectOutgoingWebhookEvents.findOne({
      _id: new ObjectId(executionId)
    });
    
    if (!execution) {
      console.error(`Webhook execution ${executionId} not found`);
      return;
    }
    
    const webhook = await db.projectOutgoingWebhooks.findOne({
      _id: execution.webhookId
    });
    
    if (!webhook) {
      console.error(`Webhook ${execution.webhookId} not found`);
      await this.markExecutionFailed(executionId, 'Webhook configuration not found');
      return;
    }
    
    // Prepare payload
    const payload = {
      event: execution.triggerEvent,
      timestamp: new Date().toISOString(),
      data: execution.triggerData
    };
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Repo.md-Webhook/1.0',
      'X-Webhook-Event': execution.triggerEvent,
      'X-Webhook-Delivery': executionId,
      ...webhook.headers
    };
    
    // Add signature if secret is configured
    if (webhook.secret) {
      const signature = WebhookSigner.sign(payload, webhook.secret);
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }
    
    // Record attempt
    const attemptNumber = (execution.attempts?.length || 0) + 1;
    const attemptStart = Date.now();
    
    try {
      console.log(`🚀 Delivering webhook to ${webhook.targetUrl}`);
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      // Make the request
      const response = await fetch(webhook.targetUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const responseTime = Date.now() - attemptStart;
      
      // Check if response is successful (2xx)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Read response body
      let responseBody;
      try {
        responseBody = await response.text();
        // Try to parse as JSON if possible
        try {
          responseBody = JSON.parse(responseBody);
        } catch {}
      } catch {
        responseBody = null;
      }
      
      // Convert headers to object
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      
      // Record successful delivery
      await db.projectOutgoingWebhookEvents.updateOne(
        { _id: execution._id },
        {
          $set: {
            status: 'success',
            finalStatus: 'delivered',
            completedAt: new Date(),
            request: {
              url: webhook.targetUrl,
              method: 'POST',
              headers: headers,
              body: payload,
              signature: headers['X-Webhook-Signature'],
              sentAt: new Date(attemptStart)
            },
            response: {
              statusCode: response.status,
              headers: responseHeaders,
              body: responseBody,
              receivedAt: new Date(),
              responseTime: responseTime
            }
          },
          $push: {
            attempts: {
              attemptNumber,
              sentAt: new Date(attemptStart),
              statusCode: response.status,
              responseTime
            }
          }
        }
      );
      
      console.log(`✅ Webhook delivered successfully (${response.status})`);
      
    } catch (error) {
      const responseTime = Date.now() - attemptStart;
      const errorMessage = error.name === 'AbortError' 
        ? 'Request timeout'
        : error.message;
      
      console.error(`❌ Webhook delivery failed: ${errorMessage}`);
      
      // Record failed attempt
      await db.projectOutgoingWebhookEvents.updateOne(
        { _id: execution._id },
        {
          $push: {
            attempts: {
              attemptNumber,
              sentAt: new Date(attemptStart),
              error: errorMessage,
              responseTime
            }
          }
        }
      );
      
      // Check if we should retry
      const retryPolicy = webhook.retryPolicy || { 
        enabled: true, 
        maxAttempts: 3, 
        backoffRate: 2 
      };
      
      if (retryPolicy.enabled && attemptNumber < retryPolicy.maxAttempts) {
        // Calculate next retry time with exponential backoff
        const backoffMs = Math.pow(retryPolicy.backoffRate, attemptNumber - 1) * 1000;
        const nextRetryAt = new Date(Date.now() + backoffMs);
        
        await db.projectOutgoingWebhookEvents.updateOne(
          { _id: execution._id },
          {
            $set: {
              status: 'retrying',
              nextRetryAt: nextRetryAt
            }
          }
        );
        
        console.log(`🔄 Will retry in ${backoffMs}ms (attempt ${attemptNumber + 1}/${retryPolicy.maxAttempts})`);
        
        // Schedule retry (in production, use a proper job queue)
        setTimeout(() => {
          this.deliverWebhook(executionId);
        }, backoffMs);
        
      } else {
        // Mark as permanently failed
        await this.markExecutionFailed(executionId, errorMessage);
      }
    }
  }
  
  /**
   * Retry a failed webhook execution
   * @param {string} executionId - Execution ID
   */
  async retryFailedWebhook(executionId) {
    const execution = await db.projectOutgoingWebhookEvents.findOne({
      _id: new ObjectId(executionId),
      finalStatus: { $in: ['failed', null] }
    });
    
    if (!execution) {
      throw new Error('Webhook execution not found or already succeeded');
    }
    
    // Reset status for retry
    await db.projectOutgoingWebhookEvents.updateOne(
      { _id: execution._id },
      {
        $set: {
          status: 'pending',
          finalStatus: null,
          nextRetryAt: null
        }
      }
    );
    
    // Deliver webhook
    await this.deliverWebhook(executionId);
  }
  
  /**
   * Mark execution as permanently failed
   * @param {string} executionId - Execution ID
   * @param {string} error - Error message
   */
  async markExecutionFailed(executionId, error) {
    await db.projectOutgoingWebhookEvents.updateOne(
      { _id: new ObjectId(executionId) },
      {
        $set: {
          status: 'failed',
          finalStatus: 'failed_permanently',
          error: error,
          completedAt: new Date()
        }
      }
    );
    
    console.log(`💀 Webhook execution ${executionId} failed permanently`);
  }
  
  /**
   * Send a test webhook
   * @param {string} webhookId - Webhook ID
   * @param {string} eventType - Event type to test
   */
  async testWebhook(webhookId, eventType) {
    const webhook = await db.projectOutgoingWebhooks.findOne({
      _id: new ObjectId(webhookId)
    });
    
    if (!webhook) {
      throw new Error('Webhook not found');
    }
    
    // Create test event data
    const testData = {
      test: true,
      projectId: webhook.projectId,
      webhookId: webhook._id,
      webhookName: webhook.name,
      timestamp: new Date(),
      message: 'This is a test webhook delivery'
    };
    
    // Create and deliver test execution
    await this.createAndQueueExecution(webhook, eventType, testData);
  }
}

export default new OutgoingWebhookDispatcher();