import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Image,
	Sparkles,
	Search,
	Zap,
	Eye,
	Palette,
	Download,
	Shield,
	Camera,
	Scan,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Images",
		subtitle: "Generate images, optimize your photos, search your library using AI vision",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		btnSecondaryLabel: "Documentation",
		btnSecondaryTo: "/docs",

		bgImage: getBannerImageByPath("/img/bg/bg18.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "AI-Powered Visual Workflow",
		features: [
			{
				title: "Generate Images",
				description:
					"Create custom visuals from text prompts - no design skills needed",
				icon: Sparkles,
			},
			{
				title: "Optimize Photos",
				description:
					"Automatic compression, resizing, and format optimization for any device",
				icon: Zap,
			},
			{
				title: "Search with AI Vision",
				description: "Find any image by describing what's in it, not just the filename",
				icon: Scan,
			},
			{
				title: "Smart Library Management",
				description: "AI automatically organizes and tags your entire photo collection",
				icon: Eye,
			},
		],
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "Visual Content Made Simple",
		cards: [
			{
				title: "Text-to-Image Creation",
				description:
					"Describe what you want, get professional images in seconds",
				icon: Camera,
			},
			{
				title: "Automatic Optimization",
				description:
					"Perfect compression and sizing for web, mobile, and print",
				icon: Zap,
			},
			{
				title: "Visual Search",
				description: "Find images by describing content: 'red car', 'sunset beach', etc.",
				icon: Search,
			},
			{
				title: "AI Organization",
				description:
					"Smart folders, auto-tagging, and duplicate detection",
				icon: Eye,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "Every Image Perfect, Every Time",
		content: `
      <p class="mb-4">Never worry about images again. Generate exactly what you need, optimize everything automatically, and find any photo instantly using AI vision that actually understands what's in your pictures.</p>
      <p class="mb-4">What you get with AI-powered images:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Generate custom images from simple text descriptions</li>
        <li>Automatic optimization for web performance and SEO</li>
        <li>Search by visual content, not just filenames</li>
        <li>Smart organization and duplicate detection</li>
        <li>Perfect integration with your content workflow</li>
      </ul>
    `,
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Upgrade Your Visual Game",
		subtitle: "Free tier includes image generation, optimization, and AI search",
		btnLabel: "Start Generating",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;