import express from "express";
import multer from "multer";
import mime from "mime-types";
import path from "path";
import crypto from "crypto";
import fs from "fs/promises";
import axios from "axios";
import { db } from "../../db.js";
import { upload as uploadToR2, deleteObject } from "../../lib/r2.js";
import GitFileService from "../../lib/gitFileService.js";
import { requireAuth } from "../../lib/authMiddleware.js";
import { checkProjectAccess } from "../../lib/projectMiddleware.js";

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter for security
const fileFilter = (req, file, cb) => {
	// Allowed file types
	const allowedMimeTypes = [
		// Images
		"image/jpeg",
		"image/jpg",
		"image/png",
		"image/gif",
		"image/webp",
		"image/svg+xml",
		// Videos
		"video/mp4",
		"video/webm",
		"video/quicktime",
		// Audio
		"audio/mpeg",
		"audio/mp3",
		"audio/wav",
		"audio/ogg",
		// Documents
		"application/pdf",
		"text/plain",
		"text/markdown",
	];

	// Check mime type
	if (allowedMimeTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(
			new Error(
				`Invalid file type: ${file.mimetype}. Allowed types: ${allowedMimeTypes.join(", ")}`,
			),
			false,
		);
	}
};

// Configure multer
const upload = multer({
	storage: storage,
	fileFilter: fileFilter,
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB per file
		files: 20, // Max 20 files per request
	},
});

// Helper to get GitHub token
async function getUserGithubToken(userId) {
	try {
		const user = await db.users.findOne({ id: userId });
		if (user && user.githubSupaToken) {
			return user.githubSupaToken;
		}
	} catch (error) {
		console.error(`Failed to get GitHub token for user ${userId}:`, error);
	}
	return null;
}

// Helper to generate unique filename
function generateUniqueFilename(originalName, existingFiles = []) {
	let filename = originalName;
	let counter = 1;

	// Extract name and extension
	const ext = path.extname(originalName);
	const nameWithoutExt = path.basename(originalName, ext);

	// Check if filename exists
	while (existingFiles.includes(filename)) {
		filename = `${nameWithoutExt}(${counter})${ext}`;
		counter++;
	}

	return filename;
}

// Upload multiple files endpoint
router.post(
	"/:projectId/upload-files",
	requireAuth,
	checkProjectAccess("editor"),
	upload.array("files", 20),
	async (req, res) => {
		try {
			const { projectId } = req.params;
			const { folder = "", commit_message } = req.body;
			const userId = req.user.id;

			// Get project details
			const project = await db.projects.findOne({ _id: projectId });
			if (!project) {
				return res.status(404).json({
					success: false,
					error: "Project not found",
				});
			}

			// Get GitHub token
			const githubToken = await getUserGithubToken(userId);
			if (!githubToken) {
				return res.status(401).json({
					success: false,
					error: "GitHub authentication required",
				});
			}

			// Initialize git service
			const gitService = new GitFileService("github", githubToken);

			// Prepare upload folder path
			const uploadPath = folder ? `uploads/${folder}` : "uploads";

			// Get existing files in the upload directory
			let existingFiles = [];
			try {
				const dirContents = await gitService.listDirectory(
					project.githubRepo.owner,
					project.githubRepo.repoName,
					uploadPath,
					"main",
				);
				existingFiles = dirContents
					.filter((item) => item.type === "file")
					.map((item) => path.basename(item.path));
			} catch (error) {
				// Directory might not exist yet, that's okay
				console.log(`Upload directory ${uploadPath} doesn't exist yet`);
			}

			// Process uploaded files
			const uploadedFiles = [];
			const filesToCommit = [];

			for (const file of req.files) {
				// Generate unique filename
				const uniqueFilename = generateUniqueFilename(
					file.originalname,
					existingFiles,
				);
				const filePath = `${uploadPath}/${uniqueFilename}`;

				// Add to existing files list
				existingFiles.push(uniqueFilename);

				// Prepare file data
				const fileData = {
					path: filePath,
					content: file.buffer.toString("base64"),
					encoding: "base64",
				};

				filesToCommit.push(fileData);

				// Store file info for response
				uploadedFiles.push({
					original_name: file.originalname,
					final_name: uniqueFilename,
					path: filePath,
					size: file.size,
					type: file.mimetype,
					url: `https://static.repo.md/projects/${projectId}/${filePath}`,
				});
			}

			// Create commit message
			const defaultCommitMessage = `Add uploaded files: ${uploadedFiles.map((f) => f.final_name).join(", ")}`;
			const commitMessage = commit_message || defaultCommitMessage;

			// Create a single commit with all files
			const commitResult = await gitService.createCommitWithFiles(
				project.githubRepo.owner,
				project.githubRepo.repoName,
				filesToCommit,
				commitMessage,
				"main",
			);

			// Trigger deployment if configured
			if (project.deploymentEnabled) {
				// Create deployment job
				const jobData = {
					type: "deploy-repo",
					projectId: project._id.toString(),
					status: "pending",
					createdAt: new Date(),
					metadata: {
						trigger: "file-upload",
						commitSha: commitResult.sha,
					},
				};
				await db.jobs.insertOne(jobData);
			}

			res.json({
				success: true,
				data: {
					commit_sha: commitResult.sha,
					uploaded_files: uploadedFiles,
					commit_url: commitResult.html_url,
				},
				message: "Files uploaded successfully",
			});
		} catch (error) {
			console.error("File upload error:", error);
			res.status(500).json({
				success: false,
				error: "Upload failed",
				details: error.message,
			});
		}
	},
);

// Stock photo integration endpoint
router.post(
	"/:projectId/add-stock-photo",
	requireAuth,
	checkProjectAccess("editor"),
	async (req, res) => {
		try {
			const { projectId } = req.params;
			const { unsplash_url, filename, folder = "", attribution } = req.body;
			const userId = req.user.id;

			// Validate Unsplash URL
			const unsplashRegex = /unsplash\.com\/photos\/([a-zA-Z0-9_-]+)/;
			const match = unsplash_url.match(unsplashRegex);
			if (!match) {
				return res.status(400).json({
					success: false,
					error: "Invalid Unsplash URL",
				});
			}

			const photoId = match[1];

			// Get project details
			const project = await db.projects.findOne({ _id: projectId });
			if (!project) {
				return res.status(404).json({
					success: false,
					error: "Project not found",
				});
			}

			// Get GitHub token
			const githubToken = await getUserGithubToken(userId);
			if (!githubToken) {
				return res.status(401).json({
					success: false,
					error: "GitHub authentication required",
				});
			}

			// Download photo from Unsplash (using their API for proper attribution)
			const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;
			if (!unsplashAccessKey) {
				return res.status(500).json({
					success: false,
					error: "Unsplash integration not configured",
				});
			}

			// Get photo details from Unsplash API
			const unsplashResponse = await axios.get(
				`https://api.unsplash.com/photos/${photoId}`,
				{
					headers: {
						Authorization: `Client-ID ${unsplashAccessKey}`,
					},
				},
			);

			const photoData = unsplashResponse.data;

			// Download the image
			const imageResponse = await axios.get(photoData.urls.regular, {
				responseType: "arraybuffer",
			});

			const imageBuffer = Buffer.from(imageResponse.data);

			// Generate filename
			const defaultFilename = `unsplash-${photoId}.jpg`;
			const finalFilename = filename || defaultFilename;

			// Initialize git service
			const gitService = new GitFileService("github", githubToken);

			// Prepare upload path
			const uploadPath = folder ? `uploads/${folder}` : "uploads";
			const filePath = `${uploadPath}/${finalFilename}`;

			// Create attribution file content
			const attributionContent = {
				photographer: attribution?.photographer || photoData.user.name,
				unsplash_username:
					attribution?.unsplash_username || photoData.user.username,
				photo_url: unsplash_url,
				unsplash_profile: `https://unsplash.com/@${photoData.user.username}`,
				download_date: new Date().toISOString(),
				license: "Unsplash License",
				license_url: "https://unsplash.com/license",
			};

			// Prepare files to commit
			const filesToCommit = [
				{
					path: filePath,
					content: imageBuffer.toString("base64"),
					encoding: "base64",
				},
				{
					path: `${uploadPath}/${path.basename(finalFilename, path.extname(finalFilename))}.attribution.json`,
					content: Buffer.from(
						JSON.stringify(attributionContent, null, 2),
					).toString("base64"),
					encoding: "base64",
				},
			];

			// Create commit
			const commitMessage = `Add stock photo from Unsplash: ${finalFilename}`;
			const commitResult = await gitService.createCommitWithFiles(
				project.githubRepo.owner,
				project.githubRepo.repoName,
				filesToCommit,
				commitMessage,
				"main",
			);

			// Trigger deployment if configured
			if (project.deploymentEnabled) {
				const jobData = {
					type: "deploy-repo",
					projectId: project._id.toString(),
					status: "pending",
					createdAt: new Date(),
					metadata: {
						trigger: "stock-photo-upload",
						commitSha: commitResult.sha,
					},
				};
				await db.jobs.insertOne(jobData);
			}

			// Trigger Unsplash download tracking (required by their API terms)
			await axios.get(`https://api.unsplash.com/photos/${photoId}/download`, {
				headers: {
					Authorization: `Client-ID ${unsplashAccessKey}`,
				},
			});

			res.json({
				success: true,
				data: {
					commit_sha: commitResult.sha,
					file: {
						original_name: defaultFilename,
						final_name: finalFilename,
						path: filePath,
						size: imageBuffer.length,
						type: "image/jpeg",
						url: `https://static.repo.md/projects/${projectId}/${filePath}`,
						attribution: attributionContent,
					},
				},
			});
		} catch (error) {
			console.error("Stock photo upload error:", error);
			res.status(500).json({
				success: false,
				error: "Stock photo upload failed",
				details: error.message,
			});
		}
	},
);

// Unsplash search endpoint
router.get("/unsplash/search", requireAuth, async (req, res) => {
	try {
		const { q, page = 1, per_page = 20, orientation } = req.query;

		if (!q) {
			return res.status(400).json({
				success: false,
				error: "Search query is required",
			});
		}

		const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;
		if (!unsplashAccessKey) {
			return res.status(500).json({
				success: false,
				error: "Unsplash integration not configured",
			});
		}

		// Build query parameters
		const params = new URLSearchParams({
			query: q,
			page,
			per_page: Math.min(per_page, 50), // Max 50 per Unsplash API
		});

		if (orientation) {
			params.append("orientation", orientation);
		}

		// Search Unsplash
		const response = await axios.get(
			`https://api.unsplash.com/search/photos?${params.toString()}`,
			{
				headers: {
					Authorization: `Client-ID ${unsplashAccessKey}`,
				},
			},
		);

		const data = response.data;

		res.json({
			success: true,
			data: {
				results: data.results.map((photo) => ({
					id: photo.id,
					urls: {
						thumb: photo.urls.thumb,
						small: photo.urls.small,
						regular: photo.urls.regular,
						full: photo.urls.full,
					},
					user: {
						name: photo.user.name,
						username: photo.user.username,
					},
					description: photo.description,
					alt_description: photo.alt_description,
				})),
				total: data.total,
				total_pages: data.total_pages,
			},
		});
	} catch (error) {
		console.error("Unsplash search error:", error);
		res.status(500).json({
			success: false,
			error: "Search failed",
			details: error.message,
		});
	}
});

export default router;