import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Database,
	LineChart,
	Shield,
	Users,
	MessageSquare,
	Server,
	FileText,
	Lock,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Enterprise Content Management",
		subtitle:
			"Scale your content operations with our enterprise-grade platform",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		btnSecondaryLabel: "Request a Demo",
		btnSecondaryTo: "/contact",
		bgImage: getBannerImageByPath("/img/bg/bg15.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Enterprise Features",
		features: [
			{
				title: "Advanced Security",
				description:
					"Role-based access control, SSO integration, and enterprise-grade encryption",
				icon: Shield,
			},
			{
				title: "Team Collaboration",
				description: "Multi-user editing, comments, and approval workflows",
				icon: Users,
			},
			{
				title: "Advanced Analytics",
				description: "Detailed performance metrics and custom reporting",
				icon: LineChart,
			},
			{
				title: "Content Governance",
				description:
					"Define and enforce content standards across your organization",
				icon: Database,
			},
		],
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "Why Choose Enterprise?",
		cards: [
			{
				title: "Scale with Confidence",
				description:
					"Support for unlimited users, repositories, and content assets",
				icon: Server,
			},
			{
				title: "Dedicated Support",
				description:
					"Priority customer support with dedicated account managers",
				icon: MessageSquare,
			},
			{
				title: "Compliance Ready",
				description:
					"Meet regulatory requirements with audit logs and compliance features",
				icon: Lock,
			},
			{
				title: "Custom Integrations",
				description:
					"Connect with your existing tools and workflows through our API",
				icon: FileText,
			},
		],
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Ready to Scale Your Content Operations?",
		subtitle:
			"Contact our sales team to learn more about our enterprise solutions",
		btnLabel: "Contact Sales",
		btnTo: "/contact",
	},
];

export default blocks;
