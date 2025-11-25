import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Brain,
	MessageSquare,
	Search,
	Sparkles,
	FileSearch,
	Lightbulb,
	Locate,
	Bot,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "MCP Server",
		subtitle: "AI-powered content intelligence for your knowledge base",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		// btnSecondaryLabel: "Learn more",
		// btnSecondaryTo: "/features/mcp",
		bgImage: getBannerImageByPath("/img/bg/bg22.png"), //17
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "AI Content Features",
		features: [
			{
				title: "Semantic Search",
				description: "Find content by meaning, not just keywords",
				icon: Search,
			},
			{
				title: "AI Chat Interface",
				description: "Let users chat with your content using natural language",
				icon: MessageSquare,
			},
			{
				title: "Content Generation",
				description: "Generate summaries, excerpts, and related content",
				icon: Sparkles,
			},
			{
				title: "Deep Content Understanding",
				description: "AI comprehension of your entire knowledge base",
				icon: Brain,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "Your Content, Enhanced by AI",
		content: `
      <p class="mb-4">The MCP (Machine Content Processing) Server transforms your static content into an intelligent knowledge system. By applying advanced AI to your content repository, we enable new ways for users to discover and interact with your information.</p>
      <p class="mb-4">Key capabilities include:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Natural language querying of your entire content repository</li>
        <li>Automatic categorization and tagging of content</li>
        <li>Identification of related content and knowledge gaps</li>
        <li>Content embedding for powerful vector search</li>
        <li>Integration with popular AI assistants</li>
      </ul>
    `,
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "AI Capabilities",
		cards: [
			{
				title: "Document Analysis",
				description: "Extract key information and insights automatically",
				icon: FileSearch,
			},
			{
				title: "Content Suggestions",
				description: "Get AI-powered suggestions for improving content",
				icon: Lightbulb,
			},
			{
				title: "Context-Aware Search",
				description: "Results based on meaning and context, not just keywords",
				icon: Locate,
			},
			{
				title: "Chatbot Integration",
				description: "Create AI assistants that leverage your content",
				icon: Bot,
			},
		],
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Make Your Content Intelligent",
		subtitle:
			"Transform your static content into an interactive knowledge system",
		btnLabel: "Get Started with MCP",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;
