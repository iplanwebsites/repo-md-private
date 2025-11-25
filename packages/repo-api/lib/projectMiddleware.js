import { db } from "../db.js";
import { ObjectId } from "mongodb";
import { verifyProjectAccess, getProjectAccessLevel } from "./project.js";

// Middleware factory to check project access with specific role requirements
export const checkProjectAccess = (requiredRole = "viewer") => {
	return async (req, res, next) => {
		try {
			const projectId = req.params.projectId;
			const userId = req.user?.id;

			if (!projectId) {
				return res.status(400).json({
					success: false,
					error: "Project ID is required",
				});
			}

			if (!userId) {
				return res.status(401).json({
					success: false,
					error: "User not authenticated",
				});
			}

			// Verify project access
			const project = await verifyProjectAccess(projectId, userId);

			// Get user's access level
			const accessLevel = await getProjectAccessLevel(projectId, userId);

			// Define role hierarchy
			const roleHierarchy = {
				owner: 4,
				admin: 3,
				editor: 2,
				viewer: 1,
			};

			const requiredLevel = roleHierarchy[requiredRole] || 1;
			const userLevel = roleHierarchy[accessLevel] || 0;

			if (userLevel < requiredLevel) {
				return res.status(403).json({
					success: false,
					error: `${requiredRole} access or higher required for this project`,
				});
			}

			// Attach project and access level to request
			req.project = project;
			req.projectAccessLevel = accessLevel;

			next();
		} catch (error) {
			console.error("Project access middleware error:", error);

			if (error.message?.includes("not found")) {
				return res.status(404).json({
					success: false,
					error: "Project not found",
				});
			}

			if (error.message?.includes("permission")) {
				return res.status(403).json({
					success: false,
					error: "You don't have permission to access this project",
				});
			}

			return res.status(500).json({
				success: false,
				error: "Failed to verify project access",
				details: error.message,
			});
		}
	};
};

// Convenience methods for specific roles
export const requireProjectOwner = checkProjectAccess("owner");
export const requireProjectAdmin = checkProjectAccess("admin");
export const requireProjectEditor = checkProjectAccess("editor");
export const requireProjectViewer = checkProjectAccess("viewer");