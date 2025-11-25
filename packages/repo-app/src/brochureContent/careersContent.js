import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Users,
	HeartHandshake,
	Code,
	Server,
	Briefcase,
	Gift,
	Zap,
	Clock,
	Building,
} from "lucide-vue-next";

// Define all blocks for the careers page
export const careersBlocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Join Our Team",
		subtitle:
			"We're looking for talented people to help us push things forward.",
		bgImage: getBannerImageByPath("/img/bg/bg17.png"),
		noBgFilter: false,
	},

	// Our Approach Section
	{
		type: BLOCK_TYPES.TEXT,
		title: "Our Approach",
		content: `
      <p>We're a small but growing team building something special. We don't fit in traditional boxes and we're pretty open about how we work.</p>
      <p>We believe in giving people autonomy, mastery, and purpose. We value collaboration, innovation, and a healthy work-life balance.</p>
      <p>If you're passionate about content management, developer experience, and creating tools that make people's lives easier, we'd love to hear from you.</p>
    `,
	},

	// Open Positions Section
	{
		type: BLOCK_TYPES.CARDS,
		title: "Open Positions",
		cards: [
			{
				title: "Customer Service Specialist",
				description:
					"Help our users get the most out of our platform. You'll be the friendly face of our company, providing support and guidance.",
				icon: HeartHandshake,
				btnLabel: "Apply Now",
				btnTo: "/contact",
			},
			{
				title: "Developer Relations Engineer",
				description:
					"Bridge the gap between our developer community and our product team. You'll create tutorials, documentation, and engage with users.",
				icon: Code,
				btnLabel: "Apply Now",
				btnTo: "/contact",
			},
			{
				title: "Enterprise Sales Manager",
				description:
					"Help larger organizations understand how our platform can transform their content workflows. You'll build relationships and drive growth.",
				icon: Building,
				btnLabel: "Apply Now",
				btnTo: "/contact",
			},
			{
				title: "DevOps Engineer",
				description:
					"Build and maintain our infrastructure. You'll ensure our platform is reliable, scalable, and secure for all our users.",
				icon: Server,
				btnLabel: "Apply Now",
				btnTo: "/contact",
			},
		],
	},

	// Benefits Section
	{
		type: BLOCK_TYPES.CARDS,
		title: "Benefits",
		cards: [
			{
				title: "Flexible Work",
				description:
					"Work from anywhere, with flexible hours to suit your lifestyle.",
				icon: Clock,
			},
			{
				title: "Competitive Compensation",
				description:
					"We offer competitive salaries, equity options, and performance bonuses.",
				icon: Briefcase,
			},
			{
				title: "Growth Opportunities",
				description:
					"We're growing fast, which means lots of opportunities to develop your skills and advance your career.",
				icon: Zap,
			},
			{
				title: "Great Perks",
				description:
					"Generous vacation time, health benefits, and professional development budget.",
				icon: Gift,
			},
		],
	},

	// CTA Section
	{
		type: BLOCK_TYPES.CTA,
		title: "Don't See the Right Fit?",
		subtitle:
			"We're always looking for talented people. Reach out and let us know how you can contribute.",
		btnLabel: "Contact Us",
		btnTo: "/contact",
	},
];

export default careersBlocks;
