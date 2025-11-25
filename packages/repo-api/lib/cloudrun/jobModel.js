/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

// job model for CloudRun service
import { ObjectId } from "mongodb";
import { db } from "../../db.js";
import { z } from "zod";

// Status enum for jobs
const JobStatus = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

// Job type enum
const JobType = {
  REPO_CLONE: "repo_clone",
  REPO_IMPORT: "repo_import",
  REPO_DEPLOY: "repo_deploy",
};

// Schema for repo clone job input
const RepoCloneJobInputSchema = z.object({
  repoName: z.string(),
  owner: z.string(),
  orgId: z.string(),
  projectName: z.string().optional(),
  projectSlug: z.string().optional(),
  projectDescription: z.string().optional(),
  visibility: z.enum(["public", "private"]).default("private"),
  gitScope: z.string(),
  newRepoName: z.string(),
  description: z.string().optional(),
  templateId: z.number().optional(),
  callbackUrl: z.string().optional(),
});

// Schema for repo import job input
const RepoImportJobInputSchema = z.object({
  sourceUrl: z.string(),
  orgId: z.string(),
  projectName: z.string().optional(),
  projectSlug: z.string().optional(),
  projectDescription: z.string().optional(),
  visibility: z.enum(["public", "private"]).default("private"),
  // gitScope: z.string(),
  //newRepoName: z.string(),
  description: z.string().optional(),
  branch: z.string().optional(),
  isPrivate: z.boolean().default(true),
  callbackUrl: z.string().optional(),
});

// Schema for job
const JobSchema = z.object({
  _id: z.string().optional(),
  userId: z.string(),
  type: z.enum([JobType.REPO_CLONE, JobType.REPO_IMPORT, JobType.REPO_DEPLOY]),
  status: z
    .enum([
      JobStatus.PENDING,
      JobStatus.RUNNING,
      JobStatus.COMPLETED,
      JobStatus.FAILED,
      JobStatus.CANCELLED,
    ])
    .default(JobStatus.PENDING),
  input: z.object({}).passthrough(),
  output: z.object({}).passthrough().optional(),
  logs: z.array(z.string()).default([]),
  error: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  completedAt: z.date().optional(),
  projectId: z.string().optional(),
});

// Helper functions for job operations
const createJob = async (jobData) => {
  try {
    const job = JobSchema.parse({
      ...jobData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await db.jobs.insertOne(job);
    return { ...job, _id: result.insertedId.toString() };
  } catch (error) {
    console.error("Error creating job:", error);
    throw error;
  }
};

const getJob = async (jobId) => {
  try {
    return await db.jobs.findOne({ _id: new ObjectId(jobId) });
  } catch (error) {
    console.error(`Error getting job ${jobId}:`, error);
    throw error;
  }
};

const listJobs = async (filter = {}, options = {}) => {
  try {
    return await db.jobs.find(filter, options).toArray();
  } catch (error) {
    console.error("Error listing jobs:", error);
    throw error;
  }
};

const updateJob = async (jobId, updateData) => {
  try {
    const update = {
      ...updateData,
      updatedAt: new Date(),
    };

    if (
      update.status === JobStatus.COMPLETED ||
      update.status === JobStatus.FAILED
    ) {
      update.completedAt = new Date();
    }

    await db.jobs.updateOne({ _id: new ObjectId(jobId) }, { $set: update });

    return await getJob(jobId);
  } catch (error) {
    console.error(`Error updating job ${jobId}:`, error);
    throw error;
  }
};

const addJobLog = async (jobId, logMessage) => {
  try {
    await db.jobs.updateOne(
      { _id: new ObjectId(jobId) },
      {
        $push: { logs: logMessage },
        $set: { updatedAt: new Date() },
      }
    );
  } catch (error) {
    console.error(`Error adding log to job ${jobId}:`, error);
    throw error;
  }
};

const completeJob = async (jobId, output) => {
  try {
    await updateJob(jobId, {
      status: JobStatus.COMPLETED,
      output,
      completedAt: new Date(),
    });
  } catch (error) {
    console.error(`Error completing job ${jobId}:`, error);
    throw error;
  }
};

const failJob = async (jobId, error) => {
  try {
    await updateJob(jobId, {
      status: JobStatus.FAILED,
      error: error.message || String(error),
      completedAt: new Date(),
    });
  } catch (err) {
    console.error(`Error failing job ${jobId}:`, err);
    throw err;
  }
};

export {
  JobStatus,
  JobType,
  RepoCloneJobInputSchema,
  RepoImportJobInputSchema,
  JobSchema,
  createJob,
  getJob,
  listJobs,
  updateJob,
  addJobLog,
  completeJob,
  failJob,
};
