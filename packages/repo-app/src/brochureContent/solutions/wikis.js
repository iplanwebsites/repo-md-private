import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Bookmark,
	Search,
	Users,
	Link,
	FileText,
	GitMerge,
	FolderTree,
	MessageSquare,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "Team Wikis",
		subtitle: "Powerful knowledge bases that grow with your team",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		// btnSecondaryLabel: "Explore features",
		// btnSecondaryTo: "/solutions/wikis/features",
		bgImage: getBannerImageByPath("/img/bg/bg11.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "Wiki Features",
		features: [
			{
				title: "Knowledge Organization",
				description: "Flexible structure for organizing team knowledge",
				icon: FolderTree,
			},
			{
				title: "Team Collaboration",
				description: "Multi-user editing with version control",
				icon: Users,
			},
			{
				title: "Full-Text Search",
				description: "Find any information quickly with powerful search",
				icon: Search,
			},
			{
				title: "Internal Linking",
				description: "Create connections between related content",
				icon: Link,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "Centralize Your Team Knowledge",
		content: `
      <p class="mb-4">Team wikis help organizations capture, organize, and share knowledge effectively. Our wiki solution combines the simplicity of Markdown with powerful knowledge management features to create a single source of truth for your team.</p>
      <p class="mb-4">With our team wiki solution, you can:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Document processes, policies, and institutional knowledge</li>
        <li>Onboard new team members more efficiently</li>
        <li>Reduce knowledge silos and improve collaboration</li>
        <li>Track changes and maintain version history</li>
        <li>Integrate with your existing tools and workflows</li>
      </ul>
    `,
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "Wiki Capabilities",
		cards: [
			{
				title: "Documentation",
				description: "Comprehensive documentation and guides",
				icon: FileText,
			},
			{
				title: "Version Control",
				description: "Track changes with complete history",
				icon: GitMerge,
			},
			{
				title: "Categorization",
				description: "Organize content with tags and categories",
				icon: Bookmark,
			},
			{
				title: "Discussions",
				description: "Comment and discuss directly on wiki pages",
				icon: MessageSquare,
			},
		],
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Build Your Team's Knowledge Base",
		subtitle: "Start documenting and organizing your team's knowledge today",
		btnLabel: "Start Your Wiki",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;
