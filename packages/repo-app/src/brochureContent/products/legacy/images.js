import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Image,
	Upload,
	Shrink,
	Globe,
	RefreshCw,
	Fingerprint,
	Link2,
	Palette,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Image Management",
		subtitle: "Powerful image handling for your content without the complexity",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		//  btnSecondaryLabel: "See how it works",
		// btnSecondaryTo: "/features/images",
		bgImage: getBannerImageByPath("/img/bg/bg16.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Image Features",
		features: [
			{
				title: "Drag & Drop Upload",
				description:
					"Simple drag-and-drop interface for adding images to your content",
				icon: Upload,
			},
			{
				title: "Automatic Optimization",
				description:
					"Images are automatically compressed and optimized for web delivery",
				icon: Shrink,
			},
			{
				title: "Global CDN",
				description:
					"All images are served from our global content delivery network",
				icon: Globe,
			},
			{
				title: "Responsive Variants",
				description:
					"Multiple sizes automatically generated for different devices",
				icon: RefreshCw,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "Images Made Simple",
		content: `
      <p class="mb-4">Managing images for your content shouldn't be complicated. Our image system handles all the technical details automatically, so you can focus on creating great content.</p>
      <p class="mb-4">Simply add images to your Markdown files using standard syntax, and we'll take care of optimizing, hosting, and delivering them to your users with lightning speed.</p>
      <p class="mb-4">All images are:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Automatically compressed without visible quality loss</li>
        <li>Converted to modern formats like WebP when supported</li>
        <li>Served from edge locations around the world</li>
        <li>Cached intelligently for ultra-fast loading</li>
        <li>Protected against hotlinking and unauthorized use</li>
      </ul>
    `,
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "Additional Benefits",
		cards: [
			{
				title: "Content Hash URLs",
				description: "Immutable URLs based on content hash for perfect caching",
				icon: Fingerprint,
			},
			{
				title: "Markdown Integration",
				description: "Works seamlessly with standard Markdown image syntax",
				icon: Link2,
			},
			{
				title: "Image Transformations",
				description:
					"Apply filters, cropping, and other transformations as needed",
				icon: Palette,
			},
			{
				title: "Custom Alt Text",
				description:
					"Full accessibility support with custom alt text for all images",
				icon: Image,
			},
		],
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Simplify Your Image Workflow",
		subtitle: "Stop worrying about image optimization and delivery",
		btnLabel: "Start Using Today",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;
