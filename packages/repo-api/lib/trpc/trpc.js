/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import { initTRPC } from "@trpc/server";

// Create context type and creator
export const createContext = ({ req, res }) => {
  // Helper function to check if a job is recent and running
  const isRecentRunningJob = (job) => {
    if (!job) return false;
    
    // Check if job is in a running state
    const runningStates = ['pending', 'running', 'processing'];
    if (!runningStates.includes(job.status)) return false;
    
    // Check if job was created recently (within last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const jobCreatedAt = new Date(job.createdAt || job.created_at);
    
    return jobCreatedAt > tenMinutesAgo;
  };

  return {
    req,
    res,
    isRecentRunningJob,
  };
};

// Initialize tRPC
const t = initTRPC.context().create();

// Export the base procedures and router builder
export const router = t.router;
export const procedure = t.procedure;

// Export the middleware creator
export const middleware = t.middleware;
