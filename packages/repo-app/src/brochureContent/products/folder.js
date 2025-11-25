import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Folder,
	FileText,
	Edit,
	Save,
	GitBranch,
	Monitor,
	Smartphone,
	Users,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Content Folder",
		subtitle: "Markdown content, on your computer",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		btnSecondaryLabel: "Documentation",
		btnSecondaryTo: "/docs",

		bgImage: getBannerImageByPath("/img/bg/bg15.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Your Computer. Your Content.",
		features: [
			{
				title: "Local-First Storage",
				description:
					"Your content stays on your computer - no cloud lock-in, always accessible",
				icon: Folder,
			},
			{
				title: "Native Markdown",
				description:
					"Pure markdown files you can edit with any text editor or markdown app",
				icon: FileText,
			},
			{
				title: "File System Freedom",
				description: "Organize files however makes sense to you - folders, tags, links",
				icon: GitBranch,
			},
			{
				title: "Offline-First",
				description: "Create, edit, and manage content without an internet connection",
				icon: Monitor,
			},
		],
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "Work With Your Favorite Tools",
		cards: [
			{
				title: "Any Editor",
				description:
					"VS Code, Obsidian, Typora, vim - use whatever you love",
				icon: Edit,
			},
			{
				title: "Your File Structure",
				description:
					"Organize content the way your brain works, not how a CMS thinks",
				icon: Folder,
			},
			{
				title: "Version Control",
				description: "Git tracks every change - perfect for collaboration and rollbacks",
				icon: GitBranch,
			},
			{
				title: "True Portability",
				description:
					"Export anytime, import anywhere - your content is never trapped",
				icon: Save,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "Content That Lives Where You Live",
		content: `
      <p class="mb-4">Tired of web interfaces and proprietary formats? Your content should live on your computer, in standard markdown files you can open with any tool.</p>
      <p class="mb-4">Why local content matters:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Work offline, sync when you want</li>
        <li>Use your preferred writing tools and shortcuts</li>
        <li>Never lose access to your content</li>
        <li>Lightning-fast search and navigation</li>
        <li>Backup with simple file operations</li>
      </ul>
    `,
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Take Control of Your Content",
		subtitle: "Keep your content on your computer, publish everywhere",
		btnLabel: "Start Local",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;