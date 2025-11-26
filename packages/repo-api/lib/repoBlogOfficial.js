import { RepoMD } from "repo-md";

// Blog content specific RepoMD instance configuration
const ORG_SLUG = "iplanwebsites"; // Organization slug for the official blog
const PROJECT_ID = "6817b5005374612ed8b91ffa"; // Project ID for the official blog content

// Create and export a singleton instance of RepoMD client for the official blog
const repoBlogOfficial = new RepoMD({
  projectId: PROJECT_ID,
  orgSlug: ORG_SLUG,
  orgId: ORG_SLUG,
  debug: true, // Set to true for debugging
  // Use appropriate API domain based on environment
  // domain: appConfigs.apiUrl,
  // staticDomain: appConfigs.staticDomain,
  strategy: "server", // auto, browser, server
});

export default repoBlogOfficial;
