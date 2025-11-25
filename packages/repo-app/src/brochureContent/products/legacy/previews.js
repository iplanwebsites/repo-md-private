import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Eye,
	Timer,
	PanelRight,
	Smartphone,
	Tablet,
	Monitor,
	Globe,
	Play,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Content Previews",
		subtitle: "See exactly how your content will look before you publish it",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		//   btnSecondaryLabel: "Try it now",
		//  btnSecondaryTo: "/features/previews",
		bgImage: getBannerImageByPath("/img/bg/bg19.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Preview Features",
		features: [
			{
				title: "Real-time Preview",
				description: "See changes instantly as you write your content",
				icon: Eye,
			},
			{
				title: "Fast Feedback",
				description: "Quick visual feedback for your content changes",
				icon: Timer,
			},
			{
				title: "Side-by-Side Mode",
				description: "Edit and preview in a split-screen interface",
				icon: PanelRight,
			},
			{
				title: "Device Simulation",
				description: "Preview how your content looks on different device types",
				icon: Smartphone,
			},
		],
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "Preview Capabilities",
		cards: [
			{
				title: "Mobile View",
				description: "Check appearance on mobile devices",
				icon: Smartphone,
			},
			{
				title: "Tablet View",
				description: "Optimize for tablet layouts",
				icon: Tablet,
			},
			{
				title: "Desktop View",
				description: "Ensure perfect desktop presentation",
				icon: Monitor,
			},
			{
				title: "Live URL Preview",
				description: "Share preview links with your team",
				icon: Globe,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "Why Content Previews Matter",
		content: `
      <p class="mb-4">Publishing content without seeing how it will look to your readers is like designing a building without blueprints. Our preview system gives you confidence that your content will display exactly as intended.</p>
      <p class="mb-4">Key benefits include:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Catch formatting issues before they go live</li>
        <li>Test how complex elements like tables and code blocks will render</li>
        <li>Ensure images and other media display correctly</li>
        <li>Share preview links with team members or clients for feedback</li>
        <li>Test responsive behavior on different screen sizes</li>
      </ul>
    `,
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Don't Publish Blindly",
		subtitle: "Use our preview system to publish with confidence",
		btnLabel: "Start Previewing",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;
