import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	FileText,
	Edit,
	Bookmark,
	FolderTree,
	Code,
	Layers,
	History,
	GitBranch,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "File-based CMS",
		subtitle: "Keep your content in Markdown files, not locked in a database",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		//  btnSecondaryLabel: "Learn more",
		// btnSecondaryTo: "/features/cms",
		bgImage: getBannerImageByPath("/img/bg/bg5.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Key Features",
		features: [
			{
				title: "Markdown-First",
				description:
					"Write content in clean, standard Markdown that works with any editor",
				icon: FileText,
			},
			{
				title: "Local Editing",
				description:
					"Edit files locally on your machine - no web forms or proprietary formats",
				icon: Edit,
			},
			{
				title: "Folder Structure",
				description:
					"Organize content just like you would organize code - with folders and files",
				icon: FolderTree,
			},
			{
				title: "Git Version Control",
				description:
					"Every change is tracked with complete history and rollback capabilities",
				icon: GitBranch,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "Why File-Based Content?",
		content: `
      <p class="mb-4">Traditional CMS platforms store your content in databases, making it difficult to access, backup, or migrate. Our file-based approach keeps your content in plain Markdown files, giving you complete ownership and flexibility.</p>
      <p class="mb-4">With a file-based CMS, you can:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Use your favorite text editor or IDE</li>
        <li>Work offline without connectivity issues</li>
        <li>Track changes with Git version control</li>
        <li>Easily backup your entire content repository</li>
        <li>Collaborate using familiar development workflows</li>
      </ul>
    `,
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "File-Based Advantages",
		cards: [
			{
				title: "Developer Friendly",
				description: "Use the same tools and workflows you use for code",
				icon: Code,
			},
			{
				title: "Content Portability",
				description: "Your content is never locked into our platform",
				icon: Layers,
			},
			{
				title: "Revision History",
				description: "Complete history of all content changes",
				icon: History,
			},
			{
				title: "Structured Content",
				description: "Frontmatter for metadata and content organization",
				icon: Bookmark,
			},
		],
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Ready to Own Your Content?",
		subtitle: "Start writing content that stays in your control",
		btnLabel: "Get Started Free",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;
