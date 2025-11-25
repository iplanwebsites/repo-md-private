import { ValidationError } from "./errors.js";

/**
 * Rate limiter for scheduling operations
 */
class RateLimiter {
  constructor(options = {}) {
    this.maxPerMinute = options.maxPerMinute || 60;
    this.maxPerHour = options.maxPerHour || 1000;
    this.maxPerDay = options.maxPerDay || 10000;
    this.windowSize = options.windowSize || 60000; // 1 minute
    this.requests = new Map(); // agentId -> timestamps
  }

  /**
   * Check if request is allowed
   */
  async checkLimit(agentId, operation = "default") {
    const key = `${agentId}:${operation}`;
    const now = Date.now();
    
    // Get or initialize request history
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    
    const timestamps = this.requests.get(key);
    
    // Clean old timestamps
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;
    
    const recentTimestamps = timestamps.filter(ts => ts > oneDayAgo);
    
    // Count requests in each window
    const lastMinute = recentTimestamps.filter(ts => ts > oneMinuteAgo).length;
    const lastHour = recentTimestamps.filter(ts => ts > oneHourAgo).length;
    const lastDay = recentTimestamps.length;
    
    // Check limits
    if (lastMinute >= this.maxPerMinute) {
      throw new ValidationError(
        `Rate limit exceeded: max ${this.maxPerMinute} requests per minute`,
        { 
          limit: this.maxPerMinute, 
          window: "minute", 
          current: lastMinute 
        }
      );
    }
    
    if (lastHour >= this.maxPerHour) {
      throw new ValidationError(
        `Rate limit exceeded: max ${this.maxPerHour} requests per hour`,
        { 
          limit: this.maxPerHour, 
          window: "hour", 
          current: lastHour 
        }
      );
    }
    
    if (lastDay >= this.maxPerDay) {
      throw new ValidationError(
        `Rate limit exceeded: max ${this.maxPerDay} requests per day`,
        { 
          limit: this.maxPerDay, 
          window: "day", 
          current: lastDay 
        }
      );
    }
    
    // Add current request
    recentTimestamps.push(now);
    this.requests.set(key, recentTimestamps);
    
    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      this.cleanup();
    }
    
    return {
      allowed: true,
      remaining: {
        minute: this.maxPerMinute - lastMinute - 1,
        hour: this.maxPerHour - lastHour - 1,
        day: this.maxPerDay - lastDay - 1
      }
    };
  }
  
  /**
   * Clean up old entries
   */
  cleanup() {
    const oneDayAgo = Date.now() - 86400000;
    
    for (const [key, timestamps] of this.requests.entries()) {
      const recent = timestamps.filter(ts => ts > oneDayAgo);
      
      if (recent.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, recent);
      }
    }
  }
  
  /**
   * Reset limits for an agent
   */
  reset(agentId, operation = null) {
    if (operation) {
      this.requests.delete(`${agentId}:${operation}`);
    } else {
      // Reset all operations for agent
      for (const key of this.requests.keys()) {
        if (key.startsWith(`${agentId}:`)) {
          this.requests.delete(key);
        }
      }
    }
  }
  
  /**
   * Get current usage stats
   */
  getStats(agentId, operation = "default") {
    const key = `${agentId}:${operation}`;
    const timestamps = this.requests.get(key) || [];
    const now = Date.now();
    
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;
    
    return {
      minute: {
        used: timestamps.filter(ts => ts > oneMinuteAgo).length,
        limit: this.maxPerMinute,
        resetIn: 60000 - (now - Math.max(...timestamps.filter(ts => ts > oneMinuteAgo), 0))
      },
      hour: {
        used: timestamps.filter(ts => ts > oneHourAgo).length,
        limit: this.maxPerHour,
        resetIn: 3600000 - (now - Math.max(...timestamps.filter(ts => ts > oneHourAgo), 0))
      },
      day: {
        used: timestamps.filter(ts => ts > oneDayAgo).length,
        limit: this.maxPerDay,
        resetIn: 86400000 - (now - Math.max(...timestamps.filter(ts => ts > oneDayAgo), 0))
      }
    };
  }
}

// Create default rate limiters
export const schedulingRateLimiter = new RateLimiter({
  maxPerMinute: 30,
  maxPerHour: 500,
  maxPerDay: 5000
});

export const nlpRateLimiter = new RateLimiter({
  maxPerMinute: 20,
  maxPerHour: 200,
  maxPerDay: 1000
});

export const feedRateLimiter = new RateLimiter({
  maxPerMinute: 10,
  maxPerHour: 100,
  maxPerDay: 500
});

/**
 * Middleware for Express routes
 */
export function rateLimitMiddleware(limiter, operation = "default") {
  return async (req, res, next) => {
    try {
      const agentId = req.body?.agentId || 
                     req.query?.agentId || 
                     req.params?.agentId ||
                     req.user?.id ||
                     req.ip;
      
      await limiter.checkLimit(agentId, operation);
      next();
    } catch (error) {
      if (error instanceof ValidationError && error.message.includes("Rate limit")) {
        res.status(429).json({
          error: error.message,
          code: "RATE_LIMIT_EXCEEDED",
          details: error.details
        });
      } else {
        next(error);
      }
    }
  };
}