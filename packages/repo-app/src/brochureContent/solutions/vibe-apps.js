import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Code,
	Layers,
	Zap,
	RefreshCw,
	LayoutGrid,
	GitPullRequest,
	Workflow,
	Gauge,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Vibe-coded Apps",
		subtitle:
			"Create content-rich applications with separate content and design",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		// btnSecondaryLabel: "How it works",
		// btnSecondaryTo: "/solutions/vibe-apps/how-it-works",
		bgImage: getBannerImageByPath("/img/bg/bg12.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Vibe-coding Features",
		features: [
			{
				title: "Content/Design Separation",
				description: "Keep content and code completely separate",
				icon: Layers,
			},
			{
				title: "Developer Friendly",
				description: "Use your favorite frontend framework",
				icon: Code,
			},
			{
				title: "Instant Content Updates",
				description: "Update content without redeploying code",
				icon: Zap,
			},
			{
				title: "Continuous Integration",
				description: "Smooth workflows for both content and code",
				icon: RefreshCw,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "The Vibe-coding Approach",
		content: `
      <p class="mb-4">Vibe-coding separates content from application code, allowing each to evolve independently. This approach gives you the best of both worlds: developers can build and maintain the application while content creators can update content without technical knowledge.</p>
      <p class="mb-4">Key benefits of vibe-coding:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Faster content updates without requiring code changes</li>
        <li>Reduced risk when updating either content or code</li>
        <li>Clear separation of responsibilities between teams</li>
        <li>Enhanced collaboration between technical and non-technical team members</li>
        <li>Ability to reuse content across multiple platforms</li>
      </ul>
    `,
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "Development Advantages",
		cards: [
			{
				title: "Modern Frontend",
				description: "Use any modern frontend framework or approach",
				icon: LayoutGrid,
			},
			{
				title: "Collaborative Workflow",
				description: "Content and code teams can work in parallel",
				icon: GitPullRequest,
			},
			{
				title: "Content Pipeline",
				description: "Structured content workflow from draft to production",
				icon: Workflow,
			},
			{
				title: "Optimized Performance",
				description: "Better performance with efficient content delivery",
				icon: Gauge,
			},
		],
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Build Better Apps with Vibe-coding",
		subtitle: "Separate your content and code for more efficient development",
		btnLabel: "Get Started Today",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;
