import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Store,
	Palette,
	Code,
	Sparkles,
	Globe,
	Smartphone,
	Zap,
	Eye,
	Layout,
	Wand2,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Websites",
		subtitle: "Pick a template, or vibe-code custom apps from scratch",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		btnSecondaryLabel: "Browse Templates",
		btnSecondaryTo: "/templates",

		bgImage: getBannerImageByPath("/img/bg/bg11.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Two Paths, Infinite Possibilities",
		features: [
			{
				title: "Pick a Template",
				description:
					"Start with beautiful, proven designs - customize as much or as little as you want",
				icon: Layout,
			},
			{
				title: "Vibe-Code from Scratch",
				description:
					"AI-assisted development - describe your vision, watch it come to life",
				icon: Wand2,
			},
			{
				title: "Custom Apps",
				description: "Go beyond websites - build interactive applications and tools",
				icon: Code,
			},
			{
				title: "Mobile Perfect",
				description: "Every site automatically works flawlessly on all devices",
				icon: Smartphone,
			},
		],
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "The Website Builder That Gets It",
		cards: [
			{
				title: "Template Fast-Track",
				description:
					"Professional designs ready to go - just add your content and launch",
				icon: Store,
			},
			{
				title: "Vibe-Code Magic",
				description:
					"Describe what you want, AI builds it - no coding knowledge required",
				icon: Sparkles,
			},
			{
				title: "Live Preview",
				description: "See every change instantly - no waiting, no guessing",
				icon: Eye,
			},
			{
				title: "Edge Deployment",
				description:
					"Global CDN hosting - your site loads fast everywhere",
				icon: Globe,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "Your Vision, Your Way",
		content: `
      <p class="mb-4">Need it fast? Pick a template and customize. Want something unique? Vibe-code from scratch with AI assistance. Either way, you get a website that's perfectly yours.</p>
      <p class="mb-4">What you can create:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Landing pages that convert visitors to customers</li>
        <li>Portfolio sites that showcase your best work</li>
        <li>Custom web apps with interactive features</li>
        <li>E-commerce stores with payment integration</li>
        <li>Documentation sites and knowledge bases</li>
      </ul>
    `,
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Create Something Amazing",
		subtitle: "Free tier includes templates, vibe-coding, and custom domains",
		btnLabel: "Pick Template or Vibe-Code",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;