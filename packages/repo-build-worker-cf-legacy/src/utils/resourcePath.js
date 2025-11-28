/**
 * Utility functions for working with resource paths
 * This file contains functions for generating and managing resource paths
 * for various storage locations including R2 storage
 */

/**
 * Generates a destination path for R2 storage based on project and job IDs
 * This standardizes how resources are organized in storage
 * 
 * @param {string} projectId - The project identifier
 * @param {string} [jobId] - The deploy job identifier, required for path generation
 * @param {string} [prefix="projects"] - Storage prefix for organizing resources
 * @returns {string} - The destination path in R2 storage
 */
export function getResourcePath(projectId, jobId, prefix = "projects") {
  if (!projectId) {
    throw new Error("Project ID is required for resource path generation");
  }
  
  if (!jobId) {
    throw new Error("Job ID is required for resource path generation");
  }

  // Ensure IDs are sanitized for path usage
  const sanitizedProjectId = projectId.replace(/[^a-zA-Z0-9-_]/g, "-");
  const sanitizedJobId = jobId.replace(/[^a-zA-Z0-9-_]/g, "-");

  // Structure: projects/[projectId]/[jobId]/
  return `${prefix}/${sanitizedProjectId}/${sanitizedJobId}`;
}

/**
 * Parses a resource path to extract its components
 * Useful when working with existing paths
 * 
 * @param {string} path - The resource path to parse
 * @param {string} [prefix="projects"] - Expected prefix for validation
 * @returns {Object} - The extracted components { prefix, projectId, buildId }
 */
export function parseResourcePath(path, expectedPrefix = "projects") {
  if (!path) {
    throw new Error("Path is required for parsing");
  }
  
  // Remove leading/trailing slashes and split
  const parts = path.replace(/^\/+|\/+$/g, "").split("/");
  
  if (parts.length < 3) {
    throw new Error(`Invalid resource path: ${path}. Expected format: prefix/projectId/buildId`);
  }
  
  const [prefix, projectId, buildId, ...rest] = parts;
  
  if (expectedPrefix && prefix !== expectedPrefix) {
    throw new Error(`Invalid prefix in path: ${path}. Expected '${expectedPrefix}' but got '${prefix}'`);
  }
  
  return {
    prefix,
    projectId,
    buildId,
    remaining: rest.join("/")
  };
}

/**
 * Gets the build path for a project using the deploy job ID
 * 
 * @param {string} projectId - The project identifier
 * @param {string} jobId - The deploy job identifier
 * @param {string} [prefix="projects"] - Storage prefix for organizing resources
 * @returns {string} - The path to the build
 */
export function getLatestBuildPath(projectId, jobId, prefix = "projects") {
  return getResourcePath(projectId, jobId, prefix);
}