import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Edit,
	Image,
	Share2,
	Search,
	BarChart3,
	Users,
	MessageSquare,
	BookOpen,
	Globe,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Blogging Made Simple",
		subtitle:
			"A powerful platform for creating, managing, and growing your blog",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		btnSecondaryLabel: "Browse templates",
		btnSecondaryTo: "/templates",
		bgImage: getBannerImageByPath("/img/bg/bg8.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Blogging Features",
		features: [
			{
				title: "Markdown Editor",
				description: "Write content in Markdown with real-time preview",
				icon: Edit,
			},
			{
				title: "Media Management",
				description: "Easily upload, organize, and optimize images",
				icon: Image,
			},
			{
				title: "SEO Tools",
				description:
					"Built-in tools to help your content rank better in search results",
				icon: Search,
			},
			{
				title: "Social Sharing",
				description: "Automatically share new posts to social media platforms",
				icon: Share2,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "Built for Bloggers",
		content: `
      <p class="mb-4">Our blogging platform is designed specifically for content creators who want to focus on writing without the hassle of managing complex technology.</p>
      <p class="mb-4">Whether you're a solo blogger or part of a publishing team, our tools make it easy to create, publish, and distribute high-quality content that engages your audience.</p>
    `,
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "Grow Your Audience",
		cards: [
			{
				title: "Analytics",
				description:
					"Track performance with detailed analytics on readers and engagement",
				icon: BarChart3,
			},
			{
				title: "Comments",
				description: "Built-in commenting system with moderation tools",
				icon: MessageSquare,
			},
			{
				title: "Community",
				description: "Tools to build and engage with your reader community",
				icon: Users,
			},
			{
				title: "Global Reach",
				description: "Multilingual support and global content delivery network",
				icon: Globe,
			},
		],
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Start Your Blog Today",
		subtitle: "Join thousands of bloggers already using our platform",
		btnLabel: "Get Started",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;
