import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	LayoutGrid,
	Palette,
	Rocket,
	LineChart,
	Columns,
	Globe,
	ShoppingBag,
	Share2,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Marketing Sites",
		subtitle:
			"Beautiful, high-performing marketing websites powered by Markdown",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		btnSecondaryLabel: "See examples & templates",
		btnSecondaryTo: "/templates",
		bgImage: getBannerImageByPath("/img/bg/bg13.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Marketing Site Features",
		features: [
			{
				title: "Conversion-Focused",
				description: "Templates designed to convert visitors into customers",
				icon: Rocket,
			},
			{
				title: "Stunning Design",
				description: "Beautiful, customizable designs for your brand",
				icon: Palette,
			},
			{
				title: "Page Builder",
				description: "Flexible layouts without coding or complex editors",
				icon: LayoutGrid,
			},
			{
				title: "Performance Optimized",
				description: "Lightning-fast load times for better SEO and conversion",
				icon: LineChart,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "Marketing Sites That Convert",
		content: `
      <p class="mb-4">Your marketing site needs to look great, load quickly, and convert visitors effectively. Our platform combines the simplicity of Markdown with powerful marketing capabilities to help you achieve all three goals.</p>
      <p class="mb-4">With our marketing site solution, you get:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Conversion-optimized landing page templates</li>
        <li>Built-in analytics and A/B testing capabilities</li>
        <li>SEO optimization tools and performance monitoring</li>
        <li>Easy integration with marketing tools and CRMs</li>
        <li>Content workflows for team collaboration</li>
      </ul>
    `,
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "Marketing Capabilities",
		cards: [
			{
				title: "Landing Pages",
				description: "High-converting landing pages for campaigns",
				icon: Columns,
			},
			{
				title: "Global CDN",
				description: "Lightning-fast delivery anywhere in the world",
				icon: Globe,
			},
			{
				title: "E-commerce Ready",
				description: "Integrate with your favorite e-commerce platforms",
				icon: ShoppingBag,
			},
			{
				title: "Social Integration",
				description: "Built-in sharing and social media features",
				icon: Share2,
			},
		],
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Launch Your Marketing Site",
		subtitle:
			"Create high-converting marketing pages without technical headaches",
		btnLabel: "Start Building Today",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;
