/**
 * Block Types Definition
 *
 * This file contains the standard block types used in the landing page block system.
 * Each block type has a specific structure and required/optional properties.
 */

import { appConfigs } from "@/appConfigs";

export const BLOCK_TYPES = {
	HERO: "hero",
	CARDS: "cards",
	FEATURES: "features",
	TEXT: "text",
	CTA: "cta",
	CONTACT_FORM: "contactForm",
	COMPARISON_TABLE: "comparisonTable",
};

export const HERO_BTN_CTA = appConfigs.WAITLIST_MODE ? "/waitlist" : "/new";


export const getBannerImageByPath = function(path) {
	/// copied from media-path-hash-map.json
	const ar= {
		"/img/bg/bg1.jpg": "fc65431d4f901dfffd14255488a31b79c09df1d53bf07a058a37566036eb92c0",
		"/img/bg/bg10.png": "115e0af0e71e5ad8792cfa1ed3142331ad1178ad7cc94796e7cbc4c93c94c85d",
		"/img/bg/bg11.png": "228c3f7ce829b0acdb29be95590289de04f7bee4f3532776bb21288407f5755b",
		"/img/bg/bg12.png": "05ac14f9e3413aee1bb9403856af6089851f481183cbe52f8843c53c3d5a18ec",
		"/img/bg/bg13.png": "cec44089188afa3fbca0cb1ce6c2d0cf80318a465a637335adf0fd6edd8ac9ce",
		"/img/bg/bg14.png": "6d0afd9d4e1352fc818ec899df85674518316d60fc8bc6aae907fbe86f159bf0",
		"/img/bg/bg15.png": "5737687c7bd6e0fa9f3afec775d6e7a57032a873d3243458d097b8b20060c2d0",
		"/img/bg/bg16.png": "650e0a203babc372dc3217ed52590cf90059db04a67b55a02a668146fab0e28d",
		"/img/bg/bg17.png": "605726a2dad7297755a9f415988ce5b58ade4dbf22e2db9c6bd4e5ba36883d14",
		"/img/bg/bg18.png": "926b7ca386c9121de41aa2dea123f64de67cd0f7937f302737230e127599fe1a",
		"/img/bg/bg19.png": "a781f5770a0feca6a5f8350050a313609e18de19ecc69f36a83527a141857a47",
		"/img/bg/bg2.png": "a701afb138380281334341a3125aac34d1cf1d7d4abc25cd71ba7b06531cac09",
		"/img/bg/bg20.png": "3d36f651e298be00cd7313c5061719a74c6ae23b41aa34e837c3f82af1ac03f5",
		"/img/bg/bg21.png": "1d7ed278189ea186a35073bde296730d7c21c8e5974898d03ee5cd18ca645657",
		"/img/bg/bg22.png": "4ea4a6b806e8085967f61494a53c443b626f479686d1ea805f45bf73717a08fa",
		"/img/bg/bg23.png": "4d02bdeb6b170ac2bfd88ef3a2c4f158b706296eef52816af900aac3126fe7e4",
		"/img/bg/bg3.png": "f1cfb1bd032cd31a502b311878859dc030a5142009dbab5fa39ce5259291297c",
		"/img/bg/bg4.png": "04cb14927ecbedad468aa261a0e9bef5c7c78524b52b94de69a449c09e973b86",
		"/img/bg/bg5.png": "14b18e45e1885f61a44c660240d4485dc3da811597336312e404ff24cd575983",
		"/img/bg/bg6.png": "8763b75a847b1b7d98cdc4c2019c1f2ec5d18d83fc7f25d3319d79d780757d55",
		"/img/bg/bg7.png": "60a390f96934ac42787004afda802e748b3c871ab7d50ee0383c05a0f13b09aa",
		"/img/bg/bg8.png": "2c6110da039d810e38909d92491de16267138096f2aabe0aa33055066940c21d",
		"/img/bg/bg9.png": "96db6f253e7bd59c0e1fc9a1a0559c846f55354f6573c12650c6ae5b03f5885e"
	  }

	  const defaultKey = "/img/bg/bg1.jpg";
	  const hash = ar[path] || ar[defaultKey];
	  // https://static.repo.md/projects/6817b5005374612ed8b91ffa/_shared/medias/04cb14927ecbedad468aa261a0e9bef5c7c78524b52b94de69a449c09e973b86-sm.jpeg
	  const base = "https://static.repo.md/projects/6817b5005374612ed8b91ffa/_shared/medias/"
	  const size = "-lg.webp"
	  const absolute = `${base}${hash}${size}`;
		return absolute;

	}
/**
 * Block Type Schemas
 *
 * These schemas define the structure of each block type, including
 * required and optional properties.
 */
export const blockTypeSchemas = {
	[BLOCK_TYPES.HERO]: {
		required: ["type", "title"],
		optional: [
			"subtitle",
			"btnLabel",
			"btnTo",
			"btnHref",
			"bgImage",
			"btnSecondaryLabel",
			"btnSecondaryTo",
			"btnSecondaryHref",
		],
	},
	[BLOCK_TYPES.CARDS]: {
		required: ["type", "cards"],
		optional: ["title", "subtitle"],
		cardSchema: {
			required: [],
			optional: ["title", "description", "icon", "metric", "btnLabel", "btnTo"],
		},
	},
	[BLOCK_TYPES.FEATURES]: {
		required: ["type", "features"],
		optional: ["title", "subtitle"],
		featureSchema: {
			required: [],
			optional: ["title", "description", "icon", "href"],
		},
	},
	[BLOCK_TYPES.TEXT]: {
		required: ["type", "content"],
		optional: ["title"],
	},
	[BLOCK_TYPES.CTA]: {
		required: ["type", "title"],
		optional: ["subtitle", "btnLabel", "btnTo", "btnHref"],
	},
	[BLOCK_TYPES.CONTACT_FORM]: {
		required: ["type"],
		optional: [
			"title",
			"subtitle",
			"successMessage",
			"buttonText",
			"nameLabel",
			"emailLabel",
			"subjectLabel",
			"messageLabel",
			"namePlaceholder",
			"emailPlaceholder",
			"subjectPlaceholder",
			"messagePlaceholder",
			"endpoint",
		],
	},
	[BLOCK_TYPES.COMPARISON_TABLE]: {
		required: ["type", "columns", "features"],
		optional: ["title", "subtitle", "highlightColumn"],
		featureSchema: {
			required: ["name", "values"],
			optional: ["info"],
		},
		columnSchema: {
			required: ["title"],
			optional: ["isHeader", "isOurs"],
		},
	},
};

/**
 * Create a sample block of the given type
 *
 * @param {string} type - The block type to create
 * @returns {object} A sample block of the given type
 */
export const createSampleBlock = (type) => {
	switch (type) {
		case BLOCK_TYPES.HERO:
			return {
				type: BLOCK_TYPES.HERO,
				title: "Your Compelling Headline",
				subtitle:
					"A brief subtitle that expands on your headline and motivates visitors.",
				btnLabel: "Get Started",
				btnTo: HERO_BTN_CTA,
				bgImage: getBannerImageByPath("/path/to/your/image.jpg"),
			};

		case BLOCK_TYPES.CARDS:
			return {
				type: BLOCK_TYPES.CARDS,
				title: "Section Title",
				cards: [
					{
						title: "Card Title 1",
						description: "Card description text goes here.",
						icon: "/path/to/icon.svg",
					},
					{
						title: "Card Title 2",
						description: "Card description text goes here.",
						icon: "/path/to/icon.svg",
					},
					{
						title: "Card Title 3",
						description: "Card description text goes here.",
						icon: "/path/to/icon.svg",
					},
				],
			};

		case BLOCK_TYPES.FEATURES:
			return {
				type: BLOCK_TYPES.FEATURES,
				title: "Key Features",
				features: [
					{
						title: "Feature 1",
						description: "Description of feature 1",
						icon: "/path/to/icon.svg",
					},
					{
						title: "Feature 2",
						description: "Description of feature 2",
						icon: "/path/to/icon.svg",
					},
				],
			};

		case BLOCK_TYPES.TEXT:
			return {
				type: BLOCK_TYPES.TEXT,
				title: "Section Title",
				content:
					"<p>Rich text content can go here. You can use HTML formatting.</p>",
			};

		case BLOCK_TYPES.CTA:
			return {
				type: BLOCK_TYPES.CTA,
				title: "Ready to Get Started?",
				subtitle:
					"Join thousands of teams using our platform to build cool things and stay productive.",
				btnLabel: "Sign Up Now",
				btnTo: HERO_BTN_CTA,
			};

		case BLOCK_TYPES.CONTACT_FORM:
			return {
				type: BLOCK_TYPES.CONTACT_FORM,
				title: "Get in Touch",
				subtitle:
					"Send us a message and we'll get back to you as soon as possible.",
				successMessage: "Thanks! Your message has been sent successfully.",
				buttonText: "Send Message",
				nameLabel: "Your Name",
				emailLabel: "Your Email",
				subjectLabel: "Subject",
				messageLabel: "Message",
				namePlaceholder: "John Doe",
				emailPlaceholder: "your@email.com",
				subjectPlaceholder: "How can we help you?",
				messagePlaceholder: "Your message here...",
				endpoint: "/api/contact",
			};

		case BLOCK_TYPES.COMPARISON_TABLE:
			return {
				type: BLOCK_TYPES.COMPARISON_TABLE,
				title: "Feature Comparison",
				subtitle: "See how we stack up against the competition",
				columns: [
					{ title: "Features", isHeader: true },
					{ title: "Our Product", isOurs: true },
					{ title: "Competitor A" },
					{ title: "Competitor B" },
				],
				features: [
					{
						name: "Feature 1",
						info: "Explanation of Feature 1",
						values: [true, false, false],
					},
					{
						name: "Feature 2",
						info: "Explanation of Feature 2",
						values: [true, true, false],
					},
					{
						name: "Feature 3",
						info: "Explanation of Feature 3",
						values: [true, true, true],
					},
				],
				highlightColumn: 1, // Index of column to highlight (our product)
			};

		default:
			return {
				type: "unknown",
				title: "Unknown Block Type",
			};
	}
};

/**
 * Validate a block against its schema
 *
 * @param {object} block - The block to validate
 * @returns {object} Validation result with isValid and errors properties
 */
export const validateBlock = (block) => {
	const result = {
		isValid: true,
		errors: [],
	};

	if (!block.type) {
		result.isValid = false;
		result.errors.push("Block type is required");
		return result;
	}

	const schema = blockTypeSchemas[block.type];
	if (!schema) {
		result.isValid = false;
		result.errors.push(`Unknown block type: ${block.type}`);
		return result;
	}

	// Check required fields
	schema.required.forEach((field) => {
		if (field !== "type" && !block[field]) {
			result.isValid = false;
			result.errors.push(`Required field missing: ${field}`);
		}
	});

	// Check nested schemas for cards and features
	if (block.type === BLOCK_TYPES.CARDS && block.cards) {
		if (!Array.isArray(block.cards)) {
			result.isValid = false;
			result.errors.push("cards must be an array");
		} else if (block.cards.length === 0) {
			result.isValid = false;
			result.errors.push("cards array cannot be empty");
		}
	}

	if (block.type === BLOCK_TYPES.FEATURES && block.features) {
		if (!Array.isArray(block.features)) {
			result.isValid = false;
			result.errors.push("features must be an array");
		} else if (block.features.length === 0) {
			result.isValid = false;
			result.errors.push("features array cannot be empty");
		}
	}

	return result;
};

export default {
	BLOCK_TYPES,
	blockTypeSchemas,
	createSampleBlock,
	validateBlock,
};
