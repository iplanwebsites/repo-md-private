import { Octokit } from "@octokit/rest";

/**
 * Triggers a deployment for a repository
 * @param {Object} options - Configuration options
 * @param {string} options.repoFullName - Full repository name (owner/repo)
 * @param {string} options.branch - Branch to deploy
 * @param {string} options.userToken - User's GitHub personal access token
 * @param {Object} options.deployOptions - Additional deployment options
 * @returns {Promise<Object>} Deployment result
 */
export async function triggerRepoDeploy({
	repoFullName,
	branch = "main",
	userToken,
	deployOptions = {},
}) {
	const [owner, repo] = repoFullName.split("/");
	const octokit = new Octokit({
		auth: userToken,
	});

	try {
		// Create a deployment
		const deployment = await octokit.rest.repos.createDeployment({
			owner,
			repo,
			ref: branch,
			auto_merge: false,
			required_contexts: [],
			environment: deployOptions.environment || "production",
			description: deployOptions.description || "Deployment triggered via template creation",
			transient_environment: false,
			production_environment: deployOptions.environment === "production",
		});

		return {
			success: true,
			deploymentId: deployment.data.id,
			deploymentUrl: deployment.data.url,
			environment: deployment.data.environment,
			createdAt: deployment.data.created_at,
		};
	} catch (error) {
		// If deployment creation fails, try to trigger via repository dispatch
		if (error.status === 409 || error.status === 422) {
			try {
				await octokit.rest.repos.createDispatchEvent({
					owner,
					repo,
					event_type: "deploy",
					client_payload: {
						branch,
						environment: deployOptions.environment || "production",
						triggered_by: "template_creation",
					},
				});

				return {
					success: true,
					method: "repository_dispatch",
					event_type: "deploy",
				};
			} catch (dispatchError) {
				throw dispatchError;
			}
		}

		throw error;
	}
}