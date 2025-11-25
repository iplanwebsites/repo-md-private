import express from "express";
import { 
  scheduleTask,
  getUpcomingTasks,
  updateTask,
  cancelTask,
  rescheduleTask,
  deleteTask,
  getQueueStatus,
  executeTaskManually,
  processNaturalCommand,
  generateCalendarFeed,
  generateFeedToken,
  validateFeedToken,
  getCalendarSubscriptionUrl
} from "../../lib/schedule/index.js";
import { 
  asyncHandler, 
  schedulerErrorHandler,
  createErrorResponse 
} from "../../lib/schedule/errors.js";
import { 
  rateLimitMiddleware, 
  schedulingRateLimiter,
  nlpRateLimiter,
  feedRateLimiter 
} from "../../lib/schedule/rateLimiter.js";
// import { authMiddleware } from "../../middlewares/auth.js";
import { SUCCESS_MESSAGES } from "../../lib/schedule/constants.js";

const router = express.Router();

// TODO: Apply auth middleware to all routes
// router.use(authMiddleware);

/**
 * POST /api/schedule/tasks
 * Create a new scheduled task
 */
router.post("/tasks", 
  rateLimitMiddleware(schedulingRateLimiter, "create"),
  asyncHandler(async (req, res) => {
    const task = await scheduleTask({
      ...req.body,
      createdBy: req.user.id
    });
    
    res.status(201).json({
      success: true,
      message: SUCCESS_MESSAGES.TASK_SCHEDULED,
      task
    });
  })
);

/**
 * GET /api/schedule/tasks
 * Get upcoming scheduled tasks
 */
router.get("/tasks", 
  asyncHandler(async (req, res) => {
    const tasks = await getUpcomingTasks({
      ...req.query,
      // Parse numeric query params
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      includeCompleted: req.query.includeCompleted === "true",
      includeRecurring: req.query.includeRecurring !== "false",
      from: req.query.from ? new Date(req.query.from) : undefined,
      to: req.query.to ? new Date(req.query.to) : undefined
    });
    
    res.json({
      success: true,
      count: tasks.length,
      tasks
    });
  })
);

/**
 * GET /api/schedule/tasks/:taskId
 * Get a specific task by ID
 */
router.get("/tasks/:taskId", 
  asyncHandler(async (req, res) => {
    const { db } = await import("../../db.js");
    const { ObjectId } = await import("mongodb");
    
    const task = await db.scheduledTasks.findOne({
      _id: new ObjectId(req.params.taskId)
    });
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Task not found"
      });
    }
    
    res.json({
      success: true,
      task
    });
  })
);

/**
 * PATCH /api/schedule/tasks/:taskId
 * Update a scheduled task
 */
router.patch("/tasks/:taskId",
  rateLimitMiddleware(schedulingRateLimiter, "update"),
  asyncHandler(async (req, res) => {
    const task = await updateTask(
      req.params.taskId,
      req.body,
      req.user.id
    );
    
    res.json({
      success: true,
      message: SUCCESS_MESSAGES.TASK_UPDATED,
      task
    });
  })
);

/**
 * POST /api/schedule/tasks/:taskId/cancel
 * Cancel a scheduled task
 */
router.post("/tasks/:taskId/cancel",
  rateLimitMiddleware(schedulingRateLimiter, "cancel"),
  asyncHandler(async (req, res) => {
    await cancelTask(
      req.params.taskId,
      req.body.reason,
      req.user.id
    );
    
    res.json({
      success: true,
      message: SUCCESS_MESSAGES.TASK_CANCELLED
    });
  })
);

/**
 * POST /api/schedule/tasks/:taskId/reschedule
 * Reschedule a task to a new date
 */
router.post("/tasks/:taskId/reschedule",
  rateLimitMiddleware(schedulingRateLimiter, "reschedule"),
  asyncHandler(async (req, res) => {
    const task = await rescheduleTask(
      req.params.taskId,
      req.body.newDate,
      req.user.id
    );
    
    res.json({
      success: true,
      message: SUCCESS_MESSAGES.TASK_RESCHEDULED,
      task
    });
  })
);

/**
 * POST /api/schedule/tasks/:taskId/execute
 * Manually execute a task
 */
router.post("/tasks/:taskId/execute",
  rateLimitMiddleware(schedulingRateLimiter, "execute"),
  asyncHandler(async (req, res) => {
    const result = await executeTaskManually(
      req.params.taskId,
      req.user.id
    );
    
    res.json({
      success: true,
      message: "Task execution started",
      result
    });
  })
);

/**
 * DELETE /api/schedule/tasks/:taskId
 * Delete a scheduled task
 */
router.delete("/tasks/:taskId",
  rateLimitMiddleware(schedulingRateLimiter, "delete"),
  asyncHandler(async (req, res) => {
    await deleteTask(req.params.taskId, req.user.id);
    
    res.json({
      success: true,
      message: "Task deleted successfully"
    });
  })
);

/**
 * POST /api/schedule/nlp
 * Process natural language command
 */
router.post("/nlp",
  rateLimitMiddleware(nlpRateLimiter),
  asyncHandler(async (req, res) => {
    const { command, context = {} } = req.body;
    
    if (!command) {
      return res.status(400).json({
        success: false,
        error: "Command is required"
      });
    }
    
    const result = await processNaturalCommand(command, {
      ...context,
      userId: req.user.id
    });
    
    res.json(result);
  })
);

/**
 * GET /api/schedule/feed/:type/:id
 * Get calendar feed
 */
router.get("/feed/:type/:id",
  rateLimitMiddleware(feedRateLimiter),
  asyncHandler(async (req, res) => {
    const { type, id } = req.params;
    const { format = "ical", token } = req.query;
    
    // Validate token if provided
    let includePrivate = false;
    if (token) {
      const tokenData = await validateFeedToken(token);
      if (tokenData && tokenData.feedType === type && tokenData.feedId === id) {
        includePrivate = true;
      }
    }
    
    const feed = await generateCalendarFeed({
      type,
      id,
      format,
      includePrivate
    });
    
    // Set appropriate content type
    if (format === "ical") {
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${type}-${id}.ics"`);
    } else {
      res.setHeader("Content-Type", "application/json");
    }
    
    res.send(feed);
  })
);

/**
 * POST /api/schedule/feed/token
 * Generate a feed authentication token
 */
router.post("/feed/token",
  rateLimitMiddleware(feedRateLimiter, "token"),
  asyncHandler(async (req, res) => {
    const { feedType, feedId } = req.body;
    
    if (!feedType || !feedId) {
      return res.status(400).json({
        success: false,
        error: "Feed type and ID are required"
      });
    }
    
    const token = await generateFeedToken(req.user.id, feedType, feedId);
    const url = getCalendarSubscriptionUrl(feedType, feedId, token);
    
    res.json({
      success: true,
      token,
      url,
      expiresIn: "365 days"
    });
  })
);

/**
 * GET /api/schedule/queue/status
 * Get queue status and statistics
 */
router.get("/queue/status",
  asyncHandler(async (req, res) => {
    const status = await getQueueStatus();
    
    res.json({
      success: true,
      status
    });
  })
);

/**
 * GET /api/schedule/agents/:agentId/tasks
 * Get tasks for a specific agent
 */
router.get("/agents/:agentId/tasks",
  asyncHandler(async (req, res) => {
    const tasks = await getUpcomingTasks({
      agentId: req.params.agentId,
      ...req.query,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    });
    
    res.json({
      success: true,
      agentId: req.params.agentId,
      count: tasks.length,
      tasks
    });
  })
);

/**
 * GET /api/schedule/history/:taskId
 * Get task execution history
 */
router.get("/history/:taskId",
  asyncHandler(async (req, res) => {
    const { db } = await import("../../db.js");
    const { ObjectId } = await import("mongodb");
    
    const history = await db.taskHistory
      .find({ taskId: new ObjectId(req.params.taskId) })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();
    
    res.json({
      success: true,
      taskId: req.params.taskId,
      count: history.length,
      history
    });
  })
);

// Apply error handler
router.use(schedulerErrorHandler);

export default router;