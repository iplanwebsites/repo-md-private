import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Code,
	Bot,
	Zap,
	Puzzle,
	Terminal,
	GitBranch,
	Database,
	Rocket,
	Package,
	Plug,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Modern SDK",
		subtitle: "Build anything, fast. Connect AI agents, use the API, skip the boilerplate",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		btnSecondaryLabel: "Documentation",
		btnSecondaryTo: "/docs",

		bgImage: getBannerImageByPath("/img/bg/bg8.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Build Anything, Fast",
		features: [
			{
				title: "Build Anything",
				description:
					"From simple sites to complex AI apps - the SDK handles it all",
				icon: Package,
			},
			{
				title: "Build Fast",
				description:
					"Pre-built components, smart defaults, zero configuration needed",
				icon: Zap,
			},
			{
				title: "Connect AI Agents",
				description: "MCP integration lets AI agents read and write your content directly",
				icon: Bot,
			},
			{
				title: "Skip the Boilerplate",
				description: "Authentication, caching, optimization - all handled automatically",
				icon: Code,
			},
		],
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "Development Without Friction",
		cards: [
			{
				title: "Plug-and-Play API",
				description:
					"Import the SDK, start building - no configuration required",
				icon: Plug,
			},
			{
				title: "AI-Ready Architecture",
				description:
					"Built-in MCP support for seamless AI agent integration",
				icon: Bot,
			},
			{
				title: "Framework Freedom",
				description: "React, Vue, Svelte, vanilla JS - use whatever you love",
				icon: Puzzle,
			},
			{
				title: "Production Ready",
				description:
					"Caching, rate limiting, error handling - all included",
				icon: Rocket,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "From Idea to Production in Minutes",
		content: `
      <p class="mb-4">Stop fighting with setup and configuration. Import our SDK and start building immediately. Whether you're creating a simple blog or a complex AI-powered platform, we handle the infrastructure so you can focus on features.</p>
      <p class="mb-4">What you can build with zero boilerplate:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>AI-powered content apps with built-in MCP integration</li>
        <li>Real-time collaborative editing interfaces</li>
        <li>Custom CMS and content management tools</li>
        <li>Multi-tenant SaaS platforms with content APIs</li>
        <li>Headless architectures with any frontend framework</li>
      </ul>
    `,
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Ship Faster, Build Better",
		subtitle: "Free tier includes the full SDK, API access, and AI agent connections",
		btnLabel: "Start Building",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;