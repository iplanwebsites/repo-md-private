/**
 * Utility functions for generating repository-related URLs
 */

export const getMCPServerUrl = (projectId) => {
	if (!projectId) return "";
	return `https://mcp.repo.md/projects/${projectId}/sse`;
};

export const getA2AServerUrl = (projectId) => {
	if (!projectId) return "";
	return `https://a2a.repo.md/project/id/${projectId}`;
};

export const getAgentUrl = (projectId) => {
	if (!projectId) return "";
	return `https://agent.repo.md/project/id/${projectId}`;
};
