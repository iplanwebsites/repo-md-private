import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	MessageCircle,
	Bot,
	Sparkles,
	Zap,
	PenTool,
	Calendar,
	Search,
	BarChart,
	Cog,
	Target,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Editor Agent",
		subtitle: "Create posts on autopilot, plan roadmaps, request edits, automate SEO",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		btnSecondaryLabel: "Documentation",
		btnSecondaryTo: "/docs",

		bgImage: getBannerImageByPath("/img/bg/bg14.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Content Creation on Autopilot",
		features: [
			{
				title: "Posts on Autopilot",
				description:
					"Set it and forget it - AI creates your content automatically",
				icon: Cog,
			},
			{
				title: "Plan Roadmaps",
				description:
					"AI analyzes your goals and creates comprehensive content roadmaps",
				icon: Calendar,
			},
			{
				title: "Request Edits",
				description: "Just ask for changes in plain English - the agent handles the rest",
				icon: MessageCircle,
			},
			{
				title: "Automate SEO",
				description: "Keywords, meta tags, and optimization happen automatically",
				icon: Target,
			},
		],
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "Your AI Content Team",
		cards: [
			{
				title: "Set Publishing Schedule",
				description:
					"Schedule posts weeks in advance - AI writes and publishes automatically",
				icon: Calendar,
			},
			{
				title: "Content Strategy",
				description:
					"AI creates comprehensive roadmaps based on your business goals",
				icon: BarChart,
			},
			{
				title: "Conversational Editing",
				description: "Chat with your content - ask for changes, improvements, rewrites",
				icon: MessageCircle,
			},
			{
				title: "SEO Automation",
				description:
					"Keyword research, optimization, and ranking improvements - all automatic",
				icon: Search,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "Content Creation Without the Work",
		content: `
      <p class="mb-4">Imagine never running out of content ideas, never missing publishing deadlines, and never worrying about SEO again. The Editor Agent handles it all while you focus on your business.</p>
      <p class="mb-4">What happens on autopilot:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Weekly blog posts written and published automatically</li>
        <li>Content roadmaps planned months in advance</li>
        <li>SEO optimization that actually improves rankings</li>
        <li>Real-time edits and improvements via simple requests</li>
        <li>Brand-consistent content that sounds like you</li>
      </ul>
    `,
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Put Your Content on Autopilot",
		subtitle: "Free tier includes automated posting, roadmap planning, and SEO",
		btnLabel: "Start Automating",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;