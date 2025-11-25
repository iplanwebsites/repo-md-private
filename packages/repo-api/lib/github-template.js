import { Octokit } from "@octokit/rest";
import { triggerRepoDeploy } from "./deploy-helpers.js";

/**
 * Creates a new repository from a GitHub template
 * @param {Object} options - Configuration options
 * @param {string} options.userToken - User's GitHub personal access token
 * @param {string} options.templateOwner - Owner of the template repository
 * @param {string} options.templateRepo - Name of the template repository
 * @param {string} options.newRepoName - Name for the new repository
 * @param {string} options.userOwner - GitHub username who will own the new repo
 * @param {Object} options.repoOptions - Additional repository options
 * @param {boolean} options.repoOptions.private - Whether the repo should be private (default: false)
 * @param {string} options.repoOptions.description - Repository description
 * @param {boolean} options.repoOptions.includeAllBranches - Include all branches from template (default: false)
 * @param {boolean} options.triggerDeploy - Whether to trigger deployment after creation (default: false)
 * @returns {Promise<Object>} Result object with success status and repo details
 */
export async function createRepoFromTemplate({
	userToken,
	templateOwner,
	templateRepo,
	newRepoName,
	userOwner,
	repoOptions = {},
	triggerDeploy = false,
}) {
	const octokit = new Octokit({
		auth: userToken,
	});

	try {
		// Create repository from template
		const response = await octokit.rest.repos.createUsingTemplate({
			template_owner: templateOwner,
			template_repo: templateRepo,
			owner: userOwner,
			name: newRepoName,
			description: repoOptions.description || `Created from ${templateOwner}/${templateRepo} template`,
			include_all_branches: repoOptions.includeAllBranches || false,
			private: repoOptions.private || false,
		});

		const result = {
			success: true,
			repoId: response.data.id,
			repoName: response.data.name,
			repoFullName: response.data.full_name,
			repoUrl: response.data.html_url,
			cloneUrl: response.data.clone_url,
			sshUrl: response.data.ssh_url,
			defaultBranch: response.data.default_branch,
			createdAt: response.data.created_at,
		};

		// Trigger deployment if requested
		if (triggerDeploy) {
			// Wait for GitHub to fully initialize the repo
			await new Promise((resolve) => setTimeout(resolve, 500));

			try {
				const deployResult = await triggerRepoDeploy({
					repoFullName: result.repoFullName,
					branch: result.defaultBranch,
					userToken,
				});

				result.deployment = deployResult;
			} catch (deployError) {
				console.error("Deployment trigger failed:", deployError);
				result.deploymentError = deployError.message;
			}
		}

		return result;
	} catch (error) {
		console.error("Error creating repo from template:", error);
		return {
			success: false,
			error: error.message,
			statusCode: error.status,
		};
	}
}

/**
 * Lists available template repositories for an organization or user
 * @param {Object} options - Configuration options
 * @param {string} options.userToken - User's GitHub personal access token
 * @param {string} options.owner - Organization or user to list templates from
 * @param {string} options.type - Type of owner ('org' or 'user')
 * @returns {Promise<Object>} List of template repositories
 */
export async function listTemplateRepos({ userToken, owner, type = "org" }) {
	const octokit = new Octokit({
		auth: userToken,
	});

	try {
		const endpoint = type === "org" ? "listForOrg" : "listForUser";
		const params = type === "org" ? { org: owner } : { username: owner };

		const response = await octokit.rest.repos[endpoint]({
			...params,
			type: "all",
			per_page: 100,
		});

		// Filter for template repositories
		const templates = response.data.filter((repo) => repo.is_template);

		return {
			success: true,
			templates: templates.map((repo) => ({
				name: repo.name,
				fullName: repo.full_name,
				description: repo.description,
				defaultBranch: repo.default_branch,
				private: repo.private,
				htmlUrl: repo.html_url,
				createdAt: repo.created_at,
				updatedAt: repo.updated_at,
			})),
		};
	} catch (error) {
		console.error("Error listing template repos:", error);
		return {
			success: false,
			error: error.message,
			statusCode: error.status,
		};
	}
}