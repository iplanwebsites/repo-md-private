import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Code,
	GitBranch,
	Terminal,
	Workflow,
	PackageOpen,
	Wand2,
	FileCode,
	Server,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Built for Developers",
		subtitle: "Content management that works the way developers do",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		btnSecondaryLabel: "Documentation",
		btnSecondaryTo: "/docs",
		bgImage: getBannerImageByPath("/img/bg/bg10.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Developer Features",
		features: [
			{
				title: "Git Workflow",
				description: "Use the same Git workflow you already know and love",
				icon: GitBranch,
			},
			{
				title: "API-First Design",
				description: "Comprehensive API for complete programmatic control",
				icon: Code,
			},
			{
				title: "CLI Tools",
				description: "Powerful command-line interface for automation",
				icon: Terminal,
			},
			{
				title: "CI/CD Integration",
				description: "Seamless integration with your CI/CD pipeline",
				icon: Workflow,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "Built By Developers, For Developers",
		content: `
      <p class="mb-4">Most CMS platforms were built for non-technical users, forcing developers to adapt to their limitations. Our platform was built from the ground up with developers in mind, integrating with the tools and workflows you already use.</p>
      <p class="mb-4">Developer benefits include:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Complete version control with Git</li>
        <li>Local development with instant preview</li>
        <li>Clean, well-documented API</li>
        <li>Automation capabilities with webhooks and events</li>
        <li>Flexible frontend options - use any framework you want</li>
      </ul>
    `,
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "Developer Tools",
		cards: [
			{
				title: "SDKs & Libraries",
				description: "Client libraries for multiple languages",
				icon: PackageOpen,
			},
			{
				title: "Content Migrations",
				description: "Tools for migrating from other CMS platforms",
				icon: Wand2,
			},
			{
				title: "Custom Schemas",
				description: "Define content models with JSON Schema",
				icon: FileCode,
			},
			{
				title: "Self-Hosting Option",
				description: "Run on your own infrastructure if needed",
				icon: Server,
			},
		],
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Start Building Today",
		subtitle:
			"Join thousands of developers who've simplified their content workflow",
		btnLabel: "Get Developer Access",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;
