import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Edit,
	FileText,
	PencilRuler,
	Eye,
	BookOpen,
	Images,
	Share2,
	BarChart3,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Built for Writers",
		subtitle: "Focus on your words, not on complicated publishing systems",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		// btnSecondaryLabel: "Writer's Guide",
		//btnSecondaryTo: "/docs/writers",
		bgImage: getBannerImageByPath("/img/bg/bg9.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Writer-Friendly Features",
		features: [
			{
				title: "Markdown Focus",
				description: "Write in clean, distraction-free Markdown",
				icon: FileText,
			},
			{
				title: "Use Any Editor",
				description: "Write with your favorite editor or Markdown app",
				icon: Edit,
			},
			{
				title: "Content Templates",
				description: "Start quickly with customizable templates",
				icon: PencilRuler,
			},
			{
				title: "Real-time Preview",
				description: "See how your content will look as you write",
				icon: Eye,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "Write Your Way",
		content: `
      <p class="mb-4">Most traditional CMS platforms force writers to use clunky web interfaces with limited formatting options. Our platform lets you write in plain Markdown using any editor you prefer, giving you complete control over your writing environment.</p>
      <p class="mb-4">Benefits for writers include:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Freedom to use any text editor or Markdown app</li>
        <li>Ability to work offline and sync later</li>
        <li>Simple, distraction-free writing experience</li>
        <li>Version history for all your content</li>
        <li>Collaborate effectively with editors and reviewers</li>
      </ul>
    `,
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "Writer Tools",
		cards: [
			{
				title: "Rich Content",
				description: "Full support for rich media and formatting",
				icon: BookOpen,
			},
			{
				title: "Image Management",
				description: "Simple drag-and-drop image handling",
				icon: Images,
			},
			{
				title: "Publishing Workflow",
				description: "Smooth path from draft to published content",
				icon: Share2,
			},
			{
				title: "Content Analytics",
				description: "Track performance of your published content",
				icon: BarChart3,
			},
		],
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Start Writing Better Content",
		subtitle:
			"Join thousands of writers who've simplified their publishing workflow",
		btnLabel: "Start Writing Today",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;
