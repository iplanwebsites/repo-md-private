// githubAuth.js - Client-side GitHub authentication utilities
import { appConfigs } from "@/appConfigs.js";

// Configuration constants
const AUTH_START_ENDPOINT = "/auth/github/start";
const USER_PROFILE_ENDPOINT = "/auth/github/user";
const MANAGE_ENDPOINT = "/auth/github/manage-start";

/**
 * Common logic for GitHub OAuth flow redirection
 * 
 * @param {Object} options - Auth options
 * @param {string} options.userId - User ID to associate with this auth request
 * @param {string[]} options.scopes - Additional scopes to request
 * @param {string} options.endpoint - API endpoint to use
 * @param {Function} options.onError - Error callback function
 * @returns {void}
 */
const redirectToGitHubAuth = (options = {}) => {
	try {
		// Extract options with defaults
		const userId = options.userId || localStorage.getItem("userId");
		const scopes = options.scopes || [];
		const endpoint = options.endpoint || AUTH_START_ENDPOINT;

		console.log(`Initiating GitHub auth for user ID: ${userId || "none"}`);
		console.log(
			`Requesting scopes: ${scopes.length ? scopes.join(", ") : "default"}`,
		);

		// Build query params
		const params = new URLSearchParams();
		if (userId) params.append("userId", userId);
		if (scopes.length) params.append("scopes", scopes.join(","));

		// Construct the redirect URL with the apiUrl from appConfigs
		const redirectUrl = `${appConfigs.apiUrl}${endpoint}?${params.toString()}`;

		console.log(`Redirecting to auth endpoint: ${redirectUrl}`);

		// Redirect to server's auth endpoint
		window.location.href = redirectUrl;
	} catch (error) {
		console.error("Error initiating GitHub auth:", error);
		if (typeof options.onError === "function") {
			options.onError(error);
		}
	}
};

/**
 * Initiates GitHub OAuth flow by redirecting to the server's auth start endpoint
 *
 * @param {Object} options - Auth options
 * @param {string} options.userId - User ID to associate with this auth request
 * @param {string[]} options.scopes - Additional scopes to request
 * @param {Function} options.onError - Error callback function
 * @returns {void}
 */
export const initiateGitHubAuth = (options = {}) => {
	redirectToGitHubAuth({
		...options,
		endpoint: AUTH_START_ENDPOINT
	});
};

/**
 * Initiates GitHub OAuth flow using the manage endpoint to let users select new repos
 *
 * @param {Object} options - Auth options
 * @param {string} options.userId - User ID to associate with this auth request
 * @param {string[]} options.scopes - Additional scopes to request
 * @param {Function} options.onError - Error callback function
 * @returns {void}
 */
export const initiateGitHubManage = (options = {}) => {
	redirectToGitHubAuth({
		...options,
		endpoint: MANAGE_ENDPOINT
	});
};

/**
 * Request repository access
 *
 * @param {string} userId - User ID to associate with the authorization
 * @param {Function} onError - Error callback function
 * @returns {void}
 */
export const requestRepositoryAccess = (userId, onError) => {
	redirectToGitHubAuth({
		userId,
		scopes: ["repo"],
		endpoint: AUTH_START_ENDPOINT,
		onError,
	});
};

/**
 * Request organization access
 *
 * @param {string} userId - User ID to associate with the authorization
 * @param {Function} onError - Error callback function
 * @returns {void}
 */
export const requestOrganizationAccess = (userId, onError) => {
	redirectToGitHubAuth({
		userId,
		scopes: ["read:org", "admin:org"],
		endpoint: AUTH_START_ENDPOINT,
		onError,
	});
};

/**
 * Request repository selection using the manage endpoint
 *
 * @param {string} userId - User ID to associate with the authorization
 * @param {Function} onError - Error callback function
 * @returns {void}
 */
export const requestRepositorySelection = (userId, onError) => {
	redirectToGitHubAuth({
		userId,
		scopes: ["repo"],
		endpoint: MANAGE_ENDPOINT,
		onError,
	});
};

/**
 * Get the authenticated GitHub user profile
 *
 * @param {string} token - GitHub access token
 * @returns {Promise<Object>} User profile data
 */
export const getGitHubUserProfile = async (token) => {
	if (!token) {
		throw new Error("GitHub token is required");
	}

	const response = await fetch(`${appConfigs.apiUrl}${USER_PROFILE_ENDPOINT}`, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to get user profile: ${response.statusText}`);
	}

	const data = await response.json();

	if (!data.success) {
		throw new Error(data.message || "Failed to get user profile");
	}

	return data.user;
};

/**
 * Handle successful authentication message from popup window
 *
 * @param {Function} callback - Function to call with user data on success
 * @returns {Function} Message event handler
 */
export const handleAuthSuccess = (callback) => {
	return (event) => {
		if (event.data && event.data.type === "auth-success") {
			if (typeof callback === "function") {
				callback({
					provider: event.data.provider,
					userId: event.data.userId,
				});
			}
		}
	};
};

/**
 * Handle authentication error message from popup window
 *
 * @param {Function} callback - Function to call with error on failure
 * @returns {Function} Message event handler
 */
export const handleAuthError = (callback) => {
	return (event) => {
		if (event.data && event.data.type === "auth-error") {
			if (typeof callback === "function") {
				callback(new Error(event.data.error || "Authentication failed"));
			}
		}
	};
};
