import express from "express";
import { db } from "../../db.js";
import { ObjectId } from "mongodb";
import _ from "lodash";
import asyncHandler from "../../utils/asyncHandler.js";
import fetch from "node-fetch";
import { getWorkerUrl } from "../../lib/cloudRun.js";

const router = express.Router();

/// Standard response helper with options pattern
const respond = (res, data, options = {}) => {
  // Set defaults
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "3600");

  // Cache control headers
  const maxAge = options.maxAge || 0; // Cache lifetime in seconds (default: 60s)
  const staleWhileRevalidate = options.staleWhileRevalidate || 0; // Time in seconds to use stale content while fetching new (default: 30s)
  const immutable = options.immutable || false; // Whether content is immutable

  // Set Cache-Control header with stale-while-revalidate directive
  let cacheControlValue = `public, max-age=${maxAge}, s-maxage=${maxAge}`;

  if (staleWhileRevalidate > 0) {
    cacheControlValue += `, stale-while-revalidate=${staleWhileRevalidate}`;
  }

  if (immutable) {
    cacheControlValue += ", immutable";
  }

  // Add additional Cloudflare-specific headers if needed
  if (options.cdnCacheEverything) {
    res.setHeader("CDN-Cache-Control", "public, max-age=31536000"); // 1 year
    res.setHeader("Cloudflare-CDN-Cache-Control", "public, max-age=31536000");
  }

  // You can also set Edge-Cache-Tag for purging specific cached content
  if (options.cacheTags && options.cacheTags.length > 0) {
    res.setHeader("Cache-Tag", options.cacheTags.join(","));
  }

  res.setHeader("ETag", ""); // This effectively disables the ETag, which often forces revalidation
  res.setHeader("Cache-Control", cacheControlValue);

  const envelope = {
    success: true,
    data: data,
  };

  return res.json(envelope);

  // const { status = 200, message, useEnvelope } = options;

  // const useEnvelopeFromQuery = res.req.query.envelope === "true";

  // const shouldUseEnvelope = useEnvelope || useEnvelopeFromQuery;

  // if (shouldUseEnvelope) {
  //   const response = {
  //     success: status >= 200 && status < 300,
  //     data: data,
  //   };

  //   if (message) {
  //     response.message = message;
  //   }

  //   return res.status(status).json(response);
  // } else {
  //   // Direct response without envelope
  //   return res.status(status).json(data);
  // }
};

/// Standard error response function with options pattern
const errorResponse = (res, options) => {
  // Set defaults
  const { status = 400, message, error, useEnvelope } = options;

  // Check if envelope is requested
  const useEnvelopeFromQuery = res.req.query.envelope === "true";
  const shouldUseEnvelope = useEnvelope || useEnvelopeFromQuery;

  // Prepare response object
  const response = { message };

  // Include error details in development
  if (error && process.env.NODE_ENV !== "production") {
    response.error = error.message || String(error);
  }

  // Add envelope if needed
  if (shouldUseEnvelope) {
    return res.status(status).json({
      success: false,
      message,
      ...(response.error && { error: response.error }),
    });
  } else {
    // Direct error response
    return res.status(status).json(response);
  }
};

/// Extract and sanitize project data for public consumption
const sanitizeProject = (project, includeGithubInfo = false) => {
  if (!project) return null;

  // If it's a database document, convert to plain object
  const plainProject = project; // project.toObject ? project.toObject() : project;
  /*

  const publicData = {
    id: project._id.toString(),
    name: project.name,
    slug: project.slug,
    description: project.description,
    orgId: project.orgId,
    visibility: project.visibility,
    created_at: project.created_at,
    updated_at: project.updated_at,
    settings: project.settings || {},
    deployment: project.deployment,
    status: project.status,
  };

  // Only include GitHub repo info if explicitly requested
  if (includeGithubInfo && project.githubRepo) {
    publicData.githubRepo = {
      name: project.githubRepo.name,
      owner: project.githubRepo.owner,
      fullName: project.githubRepo.fullName,
    };
  }
    */
  const whiteList = [
    // "_id",
    "name",
    "slug",
    "description",
    "orgId",
    "visibility",
    "created_at",
    "updated_at",
    "settings",
    "deployment",
    "status",
    "settings",
    "activeRev",
  ];
  let publicData = _.pick(plainProject, whiteList);
  publicData.id = project._id;
  return publicData;
};

/// Get project by ID
const getProjectById = async (id) => {
  if (!ObjectId.isValid(id)) {
    return { error: "Invalid project ID format" };
  }

  try {
    const project = await db.projects.findOne({ _id: new ObjectId(id) });
    if (!project) {
      return { error: "Project not found" };
    }
    return { project };
  } catch (error) {
    console.error("Error finding project by ID:", error);
    return { error: `Database error: ${error.message}` };
  }
};

/// Get project by slug
const getProjectBySlug = async (slug, orgId = null) => {
  try {
    const project = await db.projects.findOne({
      orgId,
      name: slug,
    });
    if (!project) {
      return { error: "Project not found" };
    }
    console.log("Found project by slug:", project);
    return { project };
  } catch (error) {
    console.error("Error finding project by slug:", error);
    return { error: `Database error: ${error.message}` };
  }
};

/// Get active revision for a project
const getActiveRevision = async (projectId) => {
  try {
    // Find the latest completed job of type REPO_DEPLOY for this project
    const latestJob = await db.jobs.findOne(
      {
        projectId: projectId.toString(),
        type: "repo_deploy",
        status: "completed",
      },
      { sort: { completedAt: -1 } }
    );

    if (!latestJob) {
      return { error: "No completed deployments found for this project" };
    }

    return {
      revision: {
        jobId: latestJob._id.toString(),
        deployedAt: latestJob.completedAt,
        commit: latestJob.input?.commit || "latest",
        branch: latestJob.input?.branch || "main",
        output: latestJob.output,
      },
    };
  } catch (error) {
    console.error("Error getting active revision:", error);
    return { error: `Failed to get active revision: ${error.message}` };
  }
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    return respond(
      res,
      {
        health: "ok",
        message:
          "Welcome to the Repo.md API. Visit repo.md/docs for detailed documentation.",
      },
      {
        maxAge: 300, // Cache for 5 minutes
        staleWhileRevalidate: 1200, // Allow stale content for 20 minutes while fetching fresh
      }
    );
  })
);

router.get(
  "/orgs/:org/projects/slug/:slug",
  asyncHandler(async (req, res) => {
    const { slug, org } = req.params;
    const { project, error } = await getProjectBySlug(slug, org);

    if (error) {
      return errorResponse(res, { status: 404, message: error });
    }

    return respond(res, sanitizeProject(project));
  })
);

router.get(
  "/project-id/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { project, error } = await getProjectById(id);

    if (error) {
      return errorResponse(res, {
        status: error.includes("Invalid") ? 400 : 404,
        message: error,
      });
    }

    return respond(res, sanitizeProject(project));
  })
);

router.get(
  "/project-id/:id/rev",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return errorResponse(res, {
        status: 400,
        message: "Invalid project ID format",
      });
    }

    try {
      // Targeted DB call that only fetches the activeRev field
      const project = await db.projects.findOne(
        { _id: new ObjectId(id) },
        { projection: { activeRev: 1 } }
      );

      if (!project) {
        return errorResponse(res, {
          status: 404,
          message: "Project not found",
        });
      }

      if (!project.activeRev) {
        return errorResponse(res, {
          status: 404,
          message: "No active revision found for this project",
        });
      }

      return respond(res, project.activeRev, {
        maxAge: 0, // Cache for 5 minutes
        staleWhileRevalidate: 0, // Allow stale content for 20 minutes while fetching fresh
      });
    } catch (error) {
      console.error("Error fetching project revision:", error);
      return errorResponse(res, {
        status: 500,
        message: `Database error: ${error.message}`,
      });
    }
  })
);

// AI Inference Routes

/// Helper function to relay request to worker
const relayToWorker = async (endpoint, body) => {
  const workerUrl = getWorkerUrl();
  const url = `${workerUrl}/inference/${endpoint}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Worker responded with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error relaying to worker (${url}):`, error);
    throw error;
  }
};

/// Helper function for CLIP text embeddings
const handleClipTextEmbedding = asyncHandler(async (req, res) => {
  const text = req.body?.text || req.query.text;

  if (!text) {
    return errorResponse(res, {
      status: 400,
      message: "Missing required field: text",
    });
  }

  try {
    const result = await relayToWorker("clip-by-text", { text });
    return respond(res, result);
  } catch (error) {
    return errorResponse(res, {
      status: 500,
      message: "Failed to process CLIP text embedding",
      error,
    });
  }
});

/// CLIP Text Embeddings
router.post("/inference/clip-by-text", handleClipTextEmbedding);
router.get("/inference/clip-by-text", handleClipTextEmbedding);

/// CLIP Image Embeddings
router.post(
  "/inference/clip-by-image",
  asyncHandler(async (req, res) => {
    const { imageUrl, imageData } = req.body;

    if (!imageUrl && !imageData) {
      return errorResponse(res, {
        status: 400,
        message: "Missing required field: either imageUrl or imageData",
      });
    }

    try {
      const body = imageUrl ? { imageUrl } : { imageData };
      const result = await relayToWorker("clip-by-image", body);
      return respond(res, result);
    } catch (error) {
      return errorResponse(res, {
        status: 500,
        message: "Failed to process CLIP image embedding",
        error,
      });
    }
  })
);

/// Helper function for text embeddings
const handleTextEmbedding = asyncHandler(async (req, res) => {
  const text = req.body?.text || req.query.text;
  const instruction = req.body?.instruction || req.query.instruction;

  if (!text) {
    return errorResponse(res, {
      status: 400,
      message: "Missing required field: text",
    });
  }

  try {
    const body = { text };
    if (instruction) {
      body.instruction = instruction;
    }

    const result = await relayToWorker("text-embedding", body);
    return respond(res, result);
  } catch (error) {
    return errorResponse(res, {
      status: 500,
      message: "Failed to process text embedding",
      error,
    });
  }
});

/// Text Embeddings
router.post("/inference/text-embedding", handleTextEmbedding);
router.get("/inference/text-embedding", handleTextEmbedding);

export default router;
