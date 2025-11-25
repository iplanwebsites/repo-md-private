import express from "express";
import asyncHandler from "../../utils/asyncHandler.js";
import webhookProcessor from "../../lib/webhooks/WebhookProcessorVolt.js";
import { db } from "../../db.js";

const router = express.Router();

// Middleware to parse JSON body for incoming webhooks
router.use('/project/:token', express.json({ limit: '10mb' }));

// Incoming webhook endpoint
router.all('/project/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;
  
  console.log(`\n🎣 ====== PROJECT WEBHOOK RECEIVED ======`);
  console.log(`🔑 Token: ${token.substring(0, 8)}...`);
  console.log(`📨 Method: ${req.method}`);
  console.log(`📦 Has Body: ${!!req.body}`);
  
  // Process webhook using WebhookProcessor
  const result = await webhookProcessor.processIncomingWebhook(token, {
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query,
    ip: req.ip || req.connection.remoteAddress
  });
  
  res.status(result.statusCode).json(result.body);
}));

// Health check endpoint
router.get('/project/:token/health', asyncHandler(async (req, res) => {
  const { token } = req.params;
  
  const webhook = await db.projectWebhooks.findOne({ 
    token: token,
    isActive: true
  });
  
  if (!webhook) {
    return res.status(404).json({
      success: false,
      message: 'Webhook not found'
    });
  }
  
  res.json({
    success: true,
    message: 'Webhook is active',
    webhook: {
      name: webhook.name,
      lastUsedAt: webhook.lastUsedAt,
      totalCalls: webhook.totalCalls
    },
    timestamp: new Date()
  });
}));

export default router;