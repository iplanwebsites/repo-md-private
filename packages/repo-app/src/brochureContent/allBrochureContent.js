import { homeBlocks } from "./homeContent";
import { productBlocks } from "./productContent";
import { aboutBlocks } from "./aboutContent";
import { contactBlocks } from "./contactContent";

// Import product pages
import folderBlocks from "./products/folder";
import publishBlocks from "./products/publish";
import editorAgentBlocks from "./products/editor-agent";
import imagesBlocks from "./products/images";
import sdkBlocks from "./products/sdk";
import websitesBlocks from "./products/websites";

// Import solution pages
import blogsBlocks from "./solutions/blogs";
import marketingBlocks from "./solutions/marketing";
import wikisBlocks from "./solutions/wikis";
import vibeAppsBlocks from "./solutions/vibe-apps";
import aiHubsBlocks from "./solutions/ai-hubs";
import developersBlocks from "./solutions/developers";
import writersBlocks from "./solutions/writers";
import indieBloggersBlocks from "./solutions/indie-bloggers";
import wordpressAlternativeBlocks from "./solutions/wordpress-alternative";

// Group content by sections
export const productPages = {
	folder: folderBlocks,
	publish: publishBlocks,
	"editor-agent": editorAgentBlocks,
	images: imagesBlocks,
	sdk: sdkBlocks,
	websites: websitesBlocks,
};

export const solutionPages = {
	blogs: blogsBlocks,
	marketing: marketingBlocks,
	wikis: wikisBlocks,
	"vibe-apps": vibeAppsBlocks,
	"ai-hubs": aiHubsBlocks,
	developers: developersBlocks,
	writers: writersBlocks,
	"indie-bloggers": indieBloggersBlocks,
	"wordpress-alternative": wordpressAlternativeBlocks,
};

// Main pages
export const mainPages = {
	home: homeBlocks,
	product: productBlocks,
	about: aboutBlocks,
	contact: contactBlocks,
};

// Combine all content in a single object for easy access
export const allContent = {
	...mainPages,
	products: productPages,
	solutions: solutionPages,
};

/**
 * Get content blocks by section and ID
 * @param {string} section - The section of content (e.g., 'products', 'solutions')
 * @param {string} id - The ID of the content within the section (e.g., 'enterprise', 'blogs')
 * @returns {Array|null} The content blocks or null if not found
 */
export const getContentByPath = (section, id) => {
	// Direct lookup for main pages
	if (!section && id in mainPages) {
		return mainPages[id];
	}

	// Section-based lookup
	if (section && id && allContent[section] && allContent[section][id]) {
		return allContent[section][id];
	}

	// Not found
	return null;
};

export default {
	mainPages,
	productPages,
	solutionPages,
	allContent,
	getContentByPath,
};
