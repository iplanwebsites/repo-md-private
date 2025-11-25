import { createValidator } from "./supaAuth.js";
import { db } from "../db.js";

const tokenValidator = createValidator({
	supabaseUrl: process.env.SUPABASE_URL,
	supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
	enableCache: true,
	cacheTTL: 300,
});

const adminEmails = ["felix.menard@gmail.com"];

const editorEmails = ["cx@gmail.com"];

function isAdmin(email) {
	return adminEmails.includes(email);
}

function isEditor(email) {
	return adminEmails.includes(email) || editorEmails.includes(email);
}

export const requireAuth = async (req, res, next) => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader?.startsWith("Bearer ")) {
			return res.status(401).json({
				success: false,
				error: "Missing or invalid authorization header",
			});
		}

		const token = authHeader.split(" ")[1];

		// Validate token with Supabase
		const user = await tokenValidator.checkToken(token);

		// Get full user data from MongoDB including _id
		const fullUser = await db.users.findOne({ id: user.id });
		
		if (fullUser) {
			// Merge Supabase user data with MongoDB user data
			Object.assign(user, fullUser);
		}

		// Attach user to request
		req.user = {
			...user,
			isAdmin: isAdmin(user.email),
			isEditor: isEditor(user.email),
		};

		next();
	} catch (error) {
		console.error("Auth middleware error:", error);
		return res.status(401).json({
			success: false,
			error: "Authentication failed",
			details: error.message,
		});
	}
};

export const requireAdmin = async (req, res, next) => {
	// First run the basic auth check
	await requireAuth(req, res, () => {
		// Then check if user is admin
		if (!req.user?.isAdmin) {
			return res.status(403).json({
				success: false,
				error: "Admin access required",
			});
		}
		next();
	});
};

export const requireEditor = async (req, res, next) => {
	// First run the basic auth check
	await requireAuth(req, res, () => {
		// Then check if user is editor or admin
		if (!req.user?.isEditor) {
			return res.status(403).json({
				success: false,
				error: "Editor access required",
			});
		}
		next();
	});
};