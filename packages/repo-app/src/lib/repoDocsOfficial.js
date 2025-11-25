import { RepoMD } from "@repo-md/client";
import { appConfigs } from "@/appConfigs.js";

// Blog content specific RepoMD instance configuration
const ORG_SLUG = "iplanwebsites"; // Organization slug for the official blog
const PROJECT_ID = "6817b5205374612ed8b92000"; // Project ID for the official blog content

// Create and export a singleton instance of RepoMD client for the official blog
const repoBlogOfficial = new RepoMD({
	projectId: PROJECT_ID,
	//orgSlug: ORG_SLUG,
	//orgId: ORG_SLUG,
	debug: true, // Set to true for debugging
	// Use appropriate API domain based on environment
	// domain: appConfigs.apiUrl,
	// staticDomain: appConfigs.staticDomain,
});

export default repoBlogOfficial;
