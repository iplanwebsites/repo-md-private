import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Code,
	ExternalLink,
	ServerCrash,
	Clock,
	Box,
	Search,
	Database,
	Lock,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Content API",
		subtitle: "Access your content programmatically with our powerful API",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		btnSecondaryLabel: "Documentation",
		btnSecondaryTo: "/docs",

		bgImage: getBannerImageByPath("/img/bg/bg6.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "API Capabilities",
		features: [
			{
				title: "RESTful Endpoints",
				description:
					"Clean, well-documented REST API for all content operations",
				icon: Code,
			},
			{
				title: "Headless Architecture",
				description:
					"Use any frontend framework to consume and display your content",
				icon: ExternalLink,
			},
			{
				title: "Fast & Reliable",
				description: "Globally distributed API with 99.9% uptime guarantee",
				icon: ServerCrash,
			},
			{
				title: "Real-time Updates",
				description: "Webhooks and polling options for instant content updates",
				icon: Clock,
			},
		],
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "Build with Our API",
		cards: [
			{
				title: "Content Queries",
				description:
					"Flexible queries to retrieve exactly the content you need",
				icon: Search,
			},
			{
				title: "Structured Data",
				description:
					"Consistent JSON responses with clean structure and metadata",
				icon: Box,
			},
			{
				title: "Content Relationships",
				description: "Build and traverse relationships between content pieces",
				icon: Database,
			},
			{
				title: "Secure Access",
				description:
					"API keys, rate limiting, and other security best practices",
				icon: Lock,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "Build Your Way",
		content: `
      <p class="mb-4">Our API gives you complete flexibility to build your frontend exactly how you want it. Whether you're using React, Vue, Svelte, or any other framework, our API provides everything you need to create dynamic, content-driven applications.</p>
      <p class="mb-4">Key benefits include:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>SDK libraries for popular languages</li>
        <li>Comprehensive documentation and examples</li>
        <li>GraphQL-like querying capabilities</li>
        <li>CDN-backed responses for ultra-fast delivery</li>
        <li>Automatic content versioning and rollbacks</li>
      </ul>
    `,
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Start Building with Our API",
		subtitle: "Free tier includes 100,000 API requests per month",
		btnLabel: "Create API Key",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;
