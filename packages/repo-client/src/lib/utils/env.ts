/**
 * Environment variable utilities shared across RepoMD
 */

/** Supported context strings for error messages */
export type EnvContext =
  | 'Next.js middleware'
  | 'Next.js config'
  | 'Vite proxy'
  | 'Remix loader'
  | 'RepoMD constructor'
  | '';

/** Environment variable names checked for project ID */
export interface EnvVarMap {
  'REPO_MD_PROJECT_ID': string | undefined;
  'REPOMD_PROJECT_ID': string | undefined;
  'NEXT_PUBLIC_REPO_MD_PROJECT_ID': string | undefined;
  'VITE_REPO_MD_PROJECT_ID': string | undefined;
  'REACT_APP_REPO_MD_PROJECT_ID': string | undefined;
}

/**
 * Get project ID from environment variables
 * @param projectId - Optional project ID override
 * @param context - Context for better error messages
 * @returns The project ID
 * @throws Error if no project ID is found
 */
export function getProjectIdFromEnv(projectId?: string | null, context: EnvContext = ''): string | null {
  // If projectId is provided, use it
  if (projectId) {
    return projectId;
  }

  // Check if we're in a browser environment
  if (typeof process === 'undefined' || !process.env) {
    return null;
  }

  // Try multiple common environment variable names
  const envVars: EnvVarMap = {
    'REPO_MD_PROJECT_ID': process.env.REPO_MD_PROJECT_ID,
    'REPOMD_PROJECT_ID': process.env.REPOMD_PROJECT_ID,
    'NEXT_PUBLIC_REPO_MD_PROJECT_ID': process.env.NEXT_PUBLIC_REPO_MD_PROJECT_ID,
    'VITE_REPO_MD_PROJECT_ID': process.env.VITE_REPO_MD_PROJECT_ID,
    'REACT_APP_REPO_MD_PROJECT_ID': process.env.REACT_APP_REPO_MD_PROJECT_ID,
  };

  // Find the first defined env var
  const envProjectId = Object.values(envVars).find((val): val is string => Boolean(val));

  if (!envProjectId) {
    const contextMsg = context ? ` in your ${context} config` : '';
    const envVarsList = Object.keys(envVars).map(key => `  ${key}=your-project-id`).join('\n');

    throw new Error(
      `\n🚨 RepoMD Project ID Missing!\n\n` +
      `The REPO_MD_PROJECT_ID environment variable needs to be configured, or passed directly${contextMsg}.\n\n` +
      `Option 1: Set an environment variable (recommended):\n${envVarsList}\n\n` +
      `Option 2: Pass it directly${contextMsg}:\n` +
      `  ${getExampleForContext(context)}\n\n` +
      `Learn more: https://docs.repo.md/configuration`
    );
  }

  return envProjectId;
}

/** Example code snippets for each context */
const contextExamples: Record<EnvContext, string> = {
  'Next.js middleware': `nextRepoMdMiddleware({ projectId: 'your-project-id' })`,
  'Next.js config': `nextRepoMdConfig({ projectId: 'your-project-id' })`,
  'Vite proxy': `viteRepoMdProxy({ projectId: 'your-project-id' })`,
  'Remix loader': `remixRepoMdLoader({ projectId: 'your-project-id' })`,
  'RepoMD constructor': `new RepoMD({ projectId: 'your-project-id' })`,
  '': `{ projectId: 'your-project-id' }`,
};

/**
 * Get context-specific example for error messages
 * @param context - The context string
 * @returns Example code snippet
 */
function getExampleForContext(context: EnvContext): string {
  return contextExamples[context] || contextExamples[''];
}
