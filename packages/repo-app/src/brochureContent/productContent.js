import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Rocket,
	Puzzle,
	Sparkles,
	Zap,
	Heart,
	Check,
	Shield,
	Infinity,
	Star,
} from "lucide-vue-next";

// Define blocks for the product page
export const productBlocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Build Better Content Faster",
		subtitle:
			"A powerful platform for creating, organizing, and publishing content that resonates with your audience.",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		// btnSecondaryLabel: "View features",
		// btnSecondaryTo: "/features",
		// bgImage: '/img/lan1/Landing_A.png'
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Key Features",
		features: [
			{
				title: "Markdown Support",
				description:
					"Write content in Markdown and convert it to beautiful HTML.",
				icon: Rocket,
			},
			{
				title: "Git Integration",
				description: "Version control for your content with Git integration.",
				icon: Puzzle,
			},
			{
				title: "AI-Powered Insights",
				description:
					"Get intelligent suggestions to improve your content quality.",
				icon: Sparkles,
			},
			{
				title: "Instant Publishing",
				description:
					"Publish your content with a single click to various platforms.",
				icon: Zap,
			},
		],
	},

	// Cards Block - Benefits
	{
		type: BLOCK_TYPES.CARDS,
		title: "Why Choose Our Platform",
		cards: [
			{
				title: "Improved Workflow",
				description:
					"Streamline your content creation process from ideation to publication.",
				icon: "/img/lan1/Landing_12.png",
			},
			{
				title: "Content Metrics",
				description:
					"Track how your content performs and make data-driven decisions.",
				icon: "/img/lan1/Landing_13.png",
			},
			{
				title: "Team Collaboration",
				description:
					"Work together seamlessly with real-time editing and comments.",
				icon: "/img/lan1/Landing_14.png",
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "Our Mission",
		content: `
      <p class="mb-4">We believe that great content should be easy to create, manage, and distribute. Our platform is built with the modern content creator in mind, whether you're a solo blogger, a marketing team, or an enterprise publisher.</p>
      <p class="mb-4">Our mission is to empower creators with tools that make their work more efficient, effective, and enjoyable. We're committed to building a platform that evolves with your needs and helps you stay ahead in a rapidly changing digital landscape.</p>
    `,
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Ready to Transform Your Content Strategy?",
		subtitle:
			"Join thousands of creators who are already using our platform to grow their audience and improve their content quality.",
		btnLabel: "Start Free Trial",
		btnTo: HERO_BTN_CTA,
	},
];

export default productBlocks;
