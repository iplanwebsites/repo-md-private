import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import { navigationItems } from "@/components/nav/navigationItems";

import {
	Brain,
	Target,
	BarChart,
	ChevronRight,
	Clock,
	LineChart,
	Zap,
	Shield,
	Lock,
	Eye,
	Key,
	User,
	Lightbulb,
	FileText,
	Code,
	Github,
	Server,
	GitBranch,
	Edit,
	Bot,
	History,
	Search,
	Image,
	FileJson,
	Layers,
	Pen,
} from "lucide-vue-next";

// Create blocks from navigation items
const createProductFeaturesBlock = () => {
	return {
		type: BLOCK_TYPES.CARDS,
		title: "All Features You Need",
		subtitle: "Everything to build, manage, and deploy your content efficiently",
		cards: navigationItems.Product.map(item => ({
			title: item.name,
			description: item.description,
			icon: item.icon,
			btnLabel: "Learn more",
			btnTo: item.href
		}))
	};
};

const createSolutionsBlock = () => {
	// Group solutions by their intended audience
	const useCases = navigationItems.Solutions.filter(item => item.group === "Use Cases");
	const audiences = navigationItems.Solutions.filter(item => item.group === "Users");
	
	return {
		type: BLOCK_TYPES.FEATURES,
		title: "What People Are Building",
		subtitle: "See how teams are using repo.md to create websites, wikis, and AI systems",
		features: [
			...useCases.map(item => ({
				title: item.name,
				description: item.description,
				icon: item.icon,
				href: item.href
			})),
			...audiences.map(item => ({
				title: item.name,
				description: item.description2 || item.description,
				icon: item.icon,
				href: item.href
			}))
		]
	};
};

// Define all blocks for the home landing page
export const homeBlocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		// title: "Publish content <br/> with one folder",
		// title: "Build <span class='typrwriter'>blogs</span><br/> with one folder",
		// typrwriter: ['blogs', 'wikis', 'websites', 'knowledge bases', 'AI agents', 'vibe coded apps'],
		title: "The Content Platform <br/>for <span class='typrwriter'>Modern Websites</span>",
		 typrwriter: ['Modern Websites', 'AI agents',  'Indie Blogs','Vibe Coding', 'Team Wikis', 'AI Apps' ],
		subtitle: `
  
Write using any editors. Work offline. Own your content. Collaborate with Git.
<br/>
Create blogs, wikis, and websites. Power agents and apps with your knowledge.

 	`,
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		btnSecondaryLabel: "Explore templates",
		btnSecondaryTo: "/templates",
		bgImageNo: "/img/bg/bg1.jpg",
		bgImage: getBannerImageByPath("/img/bg/bg23.png"),
		noBgFilter: true,
	},
	
	// Audience Paths Block
	/* 
	{
		type: BLOCK_TYPES.CARDS,
		title: "Choose Your Path",
		cards: [
			{
				title: "For Developers",
				description: "Integrate with your stack, API-first, Git-native. Build content-driven applications with clean separation of concerns.",
				icon: Code,
				btnLabel: "Developer Guide",
				btnTo: "/solutions/developers",
			},
			{
				title: "For Writers",
				description: "No coding, just Markdown. Write anywhere. Focus on content without fighting clunky web interfaces.",
				icon: Pen,
				btnLabel: "Writer Guide",
				btnTo: "/solutions/writers",
			},
		],
	},
	 */

	// Why Section
	{
		type: BLOCK_TYPES.CARDS,
		title: "Why Repo.md?",
		cards: [
			{
				title: "Content Freedom",
				description:
					"Keep your content in simple Markdown files that you own and control completely.",
				icon: FileText,
			},
			{
				title: "Developer Workflow",
				description:
					"Use Git for version control, collaboration, and deploy with familiar tools.",
				icon: GitBranch,
			},
			{
				title: "Write Anywhere",
				description:
					"Use your favorite Markdown editor instead of clunky web forms.",
				icon: Edit,
			},
			{
				title: "AI-Ready Publishing",
				description:
					"Power AI chatbots and applications with your structured content repository.",
				icon: Bot,
			},
		],
	},

	// Developer Section
	{
		type: BLOCK_TYPES.FEATURES,
		title: "For Developers",
		features: [
			{
				title: "Clear Separation of Concerns",
				description:
					"Focus on your code while content lives in its own structure - no more mixing content with application logic",
				icon: Layers,
			},
			{
				title: "Built-in Content Features",
				description:
					"Semantic search, similar articles, related content - all ready to use without custom server code",
				icon: Search,
			},
			{
				title: "Optimized Assets",
				description:
					"Automatic image optimization, responsive sizing, and fast CDN delivery out of the box",
				icon: Image,
			},
			{
				title: "API-First Design",
				description:
					"Clean JSON endpoints for all your content with flexible filtering and querying",
				icon: FileJson,
			},
		],
	},

	// Content Creator Section
	{
		type: BLOCK_TYPES.FEATURES,
		title: "For Content Creators",
		features: [
			{
				title: "Write in Your Tools",
				description:
					"Use VS Code, Obsidian, or any Markdown editor - never deal with slow web interfaces again",
				icon: Edit,
			},
			{
				title: "Complete Version History",
				description:
					"Instant rollbacks, view any previous version, and never lose your work with Git-powered backups",
				icon: History,
			},
			{
				title: "Collaborate Naturally",
				description:
					"Work together with pull requests, branches, and comments - just like developers do",
				icon: Github,
			},
			{
				title: "Focus on Writing",
				description:
					"No more platform-specific formatting or fighting with a WYSIWYG editor - just pure content",
				icon: Pen,
			},
		],
	},

	// Features block from navigation
	createProductFeaturesBlock(),

	// Solutions block from navigation
	createSolutionsBlock(),

	// Process Section
	{
		type: BLOCK_TYPES.CARDS,
		title: "Content Workflow That Makes Sense",
		cards: [
			{
				title: "Local-First",
				description: "Write in your favorite editor, organize your way, preview instantly",
				icon: FileText,
			},
			{
				title: "Git-Powered",
				description: "Full history, collaboration, branching, and secure backups built-in",
				icon: Github,
			},
			{
				title: "Deploy Anywhere",
				description: "Static sites, dynamic APIs, or AI-powered knowledge bases - all from the same content",
				icon: Server,
			},
		],
	},

	// Comparison Table Block
	{
		type: BLOCK_TYPES.COMPARISON_TABLE,
		title: "Flat-File CMS Comparison",
		subtitle: "See how different platforms handle content management",
		columns: [
			{ title: "Features", isHeader: true },
			{ title: "Repo.md", isOurs: true },
			{ title: "WordPress" },
			{ title: "Ghost" },
			{ title: "Notion" },
			{ title: "Obsidian Publish" },
			{ title: "Static Markdown" },
			{ title: "Strapi" },
		],
		features: [
			{
				name: "Markdown Support",
				info: "Native support for Markdown format files",
				values: [true, true, true, true, true, true, true]
			},
			{
				name: "Git Integration",
				info: "Ability to use Git for version control and collaboration",
				values: [true, false, false, false, false, "Manual", false]
			},
			{
				name: "Local-first Editing",
				info: "Edit content locally using your preferred tools before publishing",
				values: [true, false, false, false, true, true, false]
			},
			{
				name: "Fancy Editing UI",
				info: "Rich visual editing interface for content creators",
				values: ["Bring your own", true, true, true, true, false, true]
			},
			{
				name: "Custom Domains",
				info: "Ability to use your own domain name for your site",
				values: [true, true, true, true, true, false, true]
			},
			{
				name: "No Database Required",
				info: "Content stored as files rather than in a database",
				values: [true, false, false, true, true, true, false]
			},
			{
				name: "API Access",
				info: "Access content programmatically via API endpoints",
				values: [true, true, true, true, false, false, true]
			},
			{
				name: "Self-hosted Option",
				info: "Ability to host the platform on your own infrastructure",
				values: [true, true, true, false, false, true, true]
			},
			{
				name: "Version Control",
				info: "Track changes and maintain history of content modifications",
				values: [true, "Limited", "Limited", "Limited", "Limited", "Manual", "Limited"]
			},
			{
				name: "Use Any Editor",
				info: "Freedom to use your preferred editing tools",
				values: [true, false, false, false, true, true, false]
			},
			{
				name: "Image Handling",
				info: "Automatic optimization and management of images",
				values: [true, true, true, true, true, "Manual", true]
			},
			{
				name: "MCP Server Integration",
				info: "Integration with multi-modal AI content processing servers",
				values: [true, "Plugin", false, false, false, false, "Plugin"]
			},
			{
				name: "Content Graph",
				info: "Visualization and navigation of relationships between content",
				values: [true, "Plugin", false, "Limited", true, false, false]
			},
			{
				name: "SQLite Support",
				info: "Use SQLite database for client-side content querying",
				values: [true, false, false, false, false, false, false]
			},
			{
				name: "Vector Search",
				info: "Advanced search using vector embeddings for content and images",
				values: [true, "Plugin", "Plugin", "Limited", false, false, "Plugin"]
			},
			{
				name: "Free Themes & Templates",
				info: "Library of ready-to-use design themes and content templates",
				values: [true, true, "Limited", false, "Limited", false, "Limited"]
			},
			{
				name: "Runs on the Edge",
				info: "Deployable to edge computing networks for global performance",
				values: [true, false, false, false, false, false, false]
			},
			{
				name: "AI-ready Content",
				info: "Content structure optimized for AI applications",
				values: [true, "Plugin", "Plugin", "Limited", false, false, "Plugin"]
			},
			{
				name: "Similarity Search",
				info: "Find content similar to a given piece of content",
				values: [true, "Plugin", "Plugin", true, false, false, "Plugin"]
			},
			{
				name: "AI Search",
				info: "Use AI to search content semantically beyond keywords",
				values: [true, "Plugin", "Plugin", "Limited", false, false, "Plugin"]
			},
			{
				name: "Content/Container Separation",
				info: "Clear separation between content and presentation/application logic",
				values: [true, false, "Partial", false, "Partial", "Manual", true]
			},
		],
		highlightColumn: 1, // Index of column to highlight (Repo.md)
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Try Repo.md today",
		subtitle:
		"Own your content, not another platform.",
		btnLabel: "Get started for free",
		btnTo: HERO_BTN_CTA,
		links: [
			{ label: "For Developers", to: "/solutions/developers", icon: Code },
			{ label: "For Writers", to: "/solutions/writers", icon: Pen },
		]
	},
];

export default homeBlocks;