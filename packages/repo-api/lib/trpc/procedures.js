/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import { TRPCError } from "@trpc/server";
import { procedure } from "./trpc.js";
import { authMiddleware } from "../../middlewares/auth.js";
//import { getPatient } from "../../lib/patient.js";
import { z } from "zod"; // Assuming you're using zod for validation
import { getProjectById, verifyProjectAccess } from "../project.js";

// Create the protected procedure
export const protectedProcedure = procedure.use(authMiddleware);

// Create an admin-only procedure
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user?.isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next();
});

export const editorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user?.isEditor) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Editor access required",
    });
  }
  return next();
});

/*
export const patientProcedure = protectedProcedure
  .input(z.object({ patientId: z.string() }))
  .use(async ({ ctx, input, next }) => {
    try {
      const patient = await getPatient(input.patientId);

      if (!patient || patient.ownerId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to access this patient",
        });
      }

      return next({
        ctx: {
          ...ctx,
          patient,
          patientId: input.patientId,
        },
      });
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to verify patient access",
      });
    }
  });
*/

// Project procedure that verifies the user has access to the project
// and adds the project to the context
export const projectProcedure = protectedProcedure
  .input(z.object({ projectId: z.string() }))
  .use(async ({ ctx, input, next }) => {
    try {
      // Get the project and verify the user has access to it
      const project = await verifyProjectAccess(input.projectId, ctx.user.id);

      // Add project to context for downstream procedures
      return next({
        ctx: {
          ...ctx,
          project,
          projectId: input.projectId,
        },
      });
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to verify project access",
      });
    }
  });

// Project procedure that requires a specific role (admin, editor, viewer)
// This builds on top of projectProcedure and adds an additional role check
export const projectRoleProcedure = (requiredRole) =>
  projectProcedure.use(async ({ ctx, next }) => {
    try {
      const { project, user } = ctx;

      // Check if user is the project owner
      const isOwner = project.ownerId === user.id;

      // Owners have full access
      if (isOwner) {
        return next();
      }

      // Find the user's collaboration
      const userCollaboration = project.collaborators?.find(
        (collab) => collab.userId === user.id
      );

      if (!userCollaboration) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this project",
        });
      }

      // Role hierarchy: admin > editor > viewer
      const roleHierarchy = {
        admin: 3,
        editor: 2,
        viewer: 1,
      };

      const userRoleLevel = roleHierarchy[userCollaboration.role] || 0;
      const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

      if (userRoleLevel < requiredRoleLevel) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You need ${requiredRole} access for this action`,
        });
      }

      return next();
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to verify project role access",
      });
    }
  });

// Create role-specific procedures
export const projectAdminProcedure = projectRoleProcedure("admin");
export const projectEditorProcedure = projectRoleProcedure("editor");
export const projectViewerProcedure = projectRoleProcedure("viewer");

// Project owner procedure - only the project owner can access
export const projectOwnerProcedure = projectProcedure.use(async ({ ctx, next }) => {
  try {
    const { project, user } = ctx;

    if (project.ownerId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only the project owner can perform this action",
      });
    }

    return next();
  } catch (error) {
    if (error instanceof TRPCError) throw error;

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to verify project ownership",
    });
  }
});