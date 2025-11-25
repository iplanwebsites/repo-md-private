/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import { db } from "../db.js";
import { TRPCError } from "@trpc/server";
import { ObjectId } from "mongodb";

// Whitelist of project properties that can be updated
const UPDATABLE_PROPS = [
  "name",
  "description",
  "visibility",
  "settings",
  "githubRepo",
];

/**
 * Get a project by ID
 * @param {string} projectId - The project ID
 * @param {Object} options - Additional options
 * @returns {Promise<Object|null>} - The project or null if not found
 */
export const getProjectById = async (projectId, options = {}) => {
  try {
    // Convert string ID to ObjectId if needed
    const query = typeof projectId === 'string' && ObjectId.isValid(projectId) 
      ? { _id: new ObjectId(projectId) }
      : { _id: projectId };
    
    const project = await db.projects.findOne(query);
    return project;
  } catch (error) {
    console.error("Error getting project by ID:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to get project",
    });
  }
};

/**
 * Get a project by handle and organization ID
 * @param {string} projectHandle - The project handle/name
 * @param {string} orgId - The organization ID
 * @returns {Promise<Object|null>} - The project or null if not found
 */
export const getProjectByHandle = async (projectHandle, orgId) => {
  try {
    const project = await db.projects.findOne({
      orgId,
      name: projectHandle,
    });
    return project;
  } catch (error) {
    console.error("Error getting project by handle:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to get project by handle",
    });
  }
};

/**
 * Verify if a user has access to a project
 * @param {string} projectId - The project ID
 * @param {string} userId - The user ID
 * @param {string} requiredRole - Optional role requirement ("admin", "editor", "viewer")
 * @returns {Promise<Object>} - The project object
 * @throws {TRPCError} - If the project is not found or the user doesn't have access
 */
export const verifyProjectAccess = async (projectId, userId, requiredRole = null) => {
  const project = await getProjectById(projectId);

  if (!project) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Project not found",
    });
  }

  // Check if user is owner or collaborator
  const isOwner = project.ownerId === userId;

  // If just checking access and user is owner, they have access
  if (!requiredRole && isOwner) {
    return project;
  }

  let hasAccess = isOwner;
  let hasRole = isOwner; // Owner has all roles

  if (!hasAccess && project.collaborators) {
    const collaboration = project.collaborators.find(
      (collab) => collab.userId === userId
    );

    if (collaboration) {
      hasAccess = true;

      // Check for role requirements
      if (requiredRole) {
        // Role hierarchy: admin > editor > viewer
        const roleHierarchy = {
          admin: 3,
          editor: 2,
          viewer: 1,
        };

        const userRoleLevel = roleHierarchy[collaboration.role] || 0;
        const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

        hasRole = userRoleLevel >= requiredRoleLevel;
      }
    }
  }

  if (!hasAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You don't have access to this project",
    });
  }

  if (requiredRole && !hasRole) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You need ${requiredRole} access for this action`,
    });
  }

  return project;
};

/**
 * Verify if a user is the owner of a project
 * @param {string} projectId - The project ID
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - The project object
 * @throws {TRPCError} - If the project is not found or the user is not the owner
 */
export const verifyProjectOwnership = async (projectId, userId) => {
  const project = await getProjectById(projectId);

  if (!project) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Project not found",
    });
  }

  if (project.ownerId !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the project owner can perform this action",
    });
  }

  return project;
};

/**
 * Get the access level of a user for a project
 * @param {string} projectId - The project ID
 * @param {string} userId - The user ID
 * @returns {Promise<string>} - The access level ('owner', 'admin', 'editor', 'viewer', or null)
 */
export const getProjectAccessLevel = async (projectId, userId) => {
  const project = await getProjectById(projectId);

  if (!project) {
    return null;
  }

  // Check if owner
  if (project.ownerId === userId) {
    return 'owner';
  }

  // Check collaborators
  const collaborator = project.collaborators?.find(
    (collab) => collab.userId === userId
  );

  if (collaborator) {
    return collaborator.role;
  }

  return null;
};

/**
 * List all projects for a user
 * @param {string} userId - The user ID
 * @param {Object} options - List options
 * @returns {Promise<Array>} - Array of projects
 */
export const listUserProjects = async (userId, options = {}) => {
  try {
    const { orgId, includeCollaborations = true } = options;

    // Create base query
    let query = {};

    if (orgId) {
      query.orgId = orgId;
    }

    // Build the query to find all projects user has access to
    if (includeCollaborations) {
      query = {
        $or: [
          { ...query, ownerId: userId },
          {
            ...query,
            collaborators: { $elemMatch: { userId } },
          },
        ],
      };
    } else {
      query = {
        ...query,
        ownerId: userId,
      };
    }

    // Get all projects
    const projects = await db.projects.find(query).toArray();

    return projects;
  } catch (error) {
    console.error("Error listing user projects:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to list projects",
    });
  }
};

/**
 * Update a project
 * @param {string} projectId - The project ID
 * @param {Object} updates - The updates to apply
 * @returns {Promise<boolean>} - Whether the update was successful
 */
export const updateProject = async (projectId, updates) => {
  try {
    // Filter updates to only include whitelisted properties
    const sanitizedUpdates = Object.keys(updates)
      .filter((key) => UPDATABLE_PROPS.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});

    if (Object.keys(sanitizedUpdates).length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No valid properties to update",
      });
    }

    // Handle special case for settings - merge with existing settings
    if (updates.settings) {
      const project = await getProjectById(projectId);
      if (project) {
        sanitizedUpdates.settings = {
          ...(project.settings || {}),
          ...updates.settings,
        };
      }
    }

    // Convert string ID to ObjectId if needed
    const query = typeof projectId === 'string' && ObjectId.isValid(projectId) 
      ? { _id: new ObjectId(projectId) }
      : { _id: projectId };

    const result = await db.projects.updateOne(
      query,
      {
        $set: {
          ...sanitizedUpdates,
          updated_at: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    return result.modifiedCount > 0;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    
    console.error("Error updating project:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to update project",
    });
  }
};

/**
 * Add a collaborator to a project
 * @param {string} projectId - The project ID
 * @param {string} userEmail - The email of the user to add
 * @param {string} role - The role to give the user
 * @returns {Promise<boolean>} - Whether the addition was successful
 */
export const addProjectCollaborator = async (projectId, userEmail, role = "editor") => {
  try {
    // Find the user to add
    const user = await db.users.findOne({ email: userEmail });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Check if user is already a collaborator
    const project = await getProjectById(projectId);
    
    if (!project) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    if (
      project.collaborators &&
      project.collaborators.some((collab) => collab.userId === user.id)
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "User is already a collaborator on this project",
      });
    }

    // Add the user as a collaborator
    // Convert string ID to ObjectId if needed
    const query = typeof projectId === 'string' && ObjectId.isValid(projectId) 
      ? { _id: new ObjectId(projectId) }
      : { _id: projectId };

    const result = await db.projects.updateOne(
      query,
      {
        $push: {
          collaborators: {
            userId: user.id,
            role,
            added_at: new Date(),
          },
        },
        $set: { updated_at: new Date() },
      }
    );

    return result.modifiedCount > 0;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    
    console.error("Error adding project collaborator:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to add collaborator to project",
    });
  }
};

/**
 * Remove a collaborator from a project
 * @param {string} projectId - The project ID
 * @param {string} userId - The user ID to remove
 * @returns {Promise<boolean>} - Whether the removal was successful
 */
export const removeProjectCollaborator = async (projectId, userId) => {
  try {
    // Convert string ID to ObjectId if needed
    const query = typeof projectId === 'string' && ObjectId.isValid(projectId) 
      ? { _id: new ObjectId(projectId) }
      : { _id: projectId };

    const result = await db.projects.updateOne(
      query,
      {
        $pull: { collaborators: { userId } },
        $set: { updated_at: new Date() },
      }
    );

    if (result.matchedCount === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    return result.modifiedCount > 0;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    
    console.error("Error removing project collaborator:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to remove collaborator from project",
    });
  }
};

/**
 * Delete a project
 * @param {string} projectId - The project ID
 * @returns {Promise<boolean>} - Whether the deletion was successful
 */
export const deleteProject = async (projectId) => {
  try {
    // Convert string ID to ObjectId if needed
    const query = typeof projectId === 'string' && ObjectId.isValid(projectId) 
      ? { _id: new ObjectId(projectId) }
      : { _id: projectId };

    const result = await db.projects.deleteOne(query);

    if (result.deletedCount === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    return true;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    
    console.error("Error deleting project:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to delete project",
    });
  }
};