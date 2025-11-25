import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Users,
	Award,
	Wand2,
	Heart,
	Building,
	Clock,
	Calendar,
	GraduationCap,
	Code,
	Github,
	Server,
	Target,
} from "lucide-vue-next";

// Define all blocks for the about page
export const aboutBlocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "About Repo.md",
		subtitle:
			"Learn about our mission, our team, and how we're transforming content management.",
		bgImage: getBannerImageByPath("/img/bg/bg5.png"),
		noBgFilter: false,
	},

	// Our Story Section
	{
		type: BLOCK_TYPES.TEXT,
		title: "Our Story",
		content: `
      <p>Founded in 2023, Repo.md was born from a simple observation: content management should be simple, powerful, and integrated with modern development workflows.</p>
      <p>Our team of developers and content creators were frustrated with the disconnect between content creation tools and deployment systems. We built Repo.md to bridge that gap, making it easy to create, manage, and publish content from markdown files to beautiful websites.</p>
      <p>What started as an internal tool quickly grew into a platform that's helping teams around the world streamline their content workflows.</p>
    `,
	},

	// Mission Section
	{
		type: BLOCK_TYPES.CARDS,
		title: "Our Mission",
		cards: [
			{
				title: "Simplify Content Management",
				description:
					"Make content management accessible to everyone, regardless of technical background.",
				icon: Wand2,
			},
			{
				title: "Empower Creators",
				description:
					"Give content creators the tools they need to focus on what matters - creating great content.",
				icon: Heart,
			},
			{
				title: "Bridge Development and Content",
				description:
					"Create a seamless workflow between content teams and development teams.",
				icon: Building,
			},
		],
	},

	// Team Section
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Our Team",
		features: [
			{
				title: "Experienced Professionals",
				description:
					"Our team combines decades of experience in content management, web development, and design.",
				icon: Users,
			},
			{
				title: "Award-Winning Innovation",
				description:
					"Recognized for our innovative approach to content management and publishing workflows.",
				icon: Award,
			},
		],
	},

	// Timeline Section
	{
		type: BLOCK_TYPES.CARDS,
		title: "Our Journey",
		cards: [
			{
				title: "2023",
				description:
					"Repo.md was founded with a mission to simplify content management for developers.",
				icon: Calendar,
			},
			{
				title: "Early 2024",
				description: "Launched our beta program with 100 early adopters.",
				icon: Clock,
			},
			{
				title: "Present",
				description:
					"Growing our platform and community with new features and integrations.",
				icon: Target,
			},
		],
	},

	// Values Section
	{
		type: BLOCK_TYPES.CARDS,
		title: "Our Values",
		cards: [
			{
				title: "Simplicity",
				description:
					"We believe in making complex tasks simple and accessible.",
				icon: Code,
			},
			{
				title: "Open Source",
				description:
					"We're committed to contributing to and supporting the open source community.",
				icon: Github,
			},
			{
				title: "User-Centered",
				description:
					"Everything we build starts with user needs and experiences.",
				icon: Users,
			},
			{
				title: "Continuous Learning",
				description:
					"We're constantly learning and improving our platform based on feedback.",
				icon: GraduationCap,
			},
		],
	},

	// CTA Section
	{
		type: BLOCK_TYPES.CTA,
		title: "Join Us on Our Journey",
		subtitle: "Be part of the future of content management.",
		btnLabel: "Get Started",
		btnTo: HERO_BTN_CTA,
	},
];

export default aboutBlocks;
