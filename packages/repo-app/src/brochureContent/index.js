import { homeBlocks } from "./homeContent";
import { productBlocks } from "./productContent";
import { aboutBlocks } from "./aboutContent";
import { contactBlocks } from "./contactContent";
import { careersBlocks } from "./careersContent";
import * as allBrochureContent from "./allBrochureContent";

export { homeBlocks, productBlocks, aboutBlocks, contactBlocks, careersBlocks };

// Re-export all content from allBrochureContent
export * from "./allBrochureContent";

// Export a mapping of page names to content blocks for easier lookup
export const contentMap = {
	home: homeBlocks,
	product: productBlocks,
	about: aboutBlocks,
	contact: contactBlocks,
	careers: careersBlocks,
	...allBrochureContent.productPages,
	...allBrochureContent.solutionPages,
};

export default {
	homeBlocks,
	productBlocks,
	aboutBlocks,
	contactBlocks,
	careersBlocks,
	contentMap,
	allBrochureContent,
	getContentByPath: allBrochureContent.getContentByPath,
};
