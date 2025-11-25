import { BLOCK_TYPES, HERO_BTN_CTA, getBannerImageByPath } from "@/components/pushmd/blockTypes";
import {
	Brain,
	Database,
	MessageSquare,
	Zap,
	Code,
	FilterX,
	Sparkles,
	Bot,
} from "lucide-vue-next";

export const blocks = [
	// Hero Block
	{
		type: BLOCK_TYPES.HERO,
		title: "AI Content Hubs",
		subtitle: "Turn your knowledge base into an intelligent assistant",
		btnLabel: "Get started",
		btnTo: HERO_BTN_CTA,
		//  btnSecondaryLabel: "Discover features",
		// btnSecondaryTo: "/solutions/ai-hubs/features",
		bgImage: getBannerImageByPath("/img/bg/bg17.png"),
		noBgFilter: true,
	},

	// Features Block
	{
		type: BLOCK_TYPES.FEATURES,
		title: "AI Hub Features",
		features: [
			{
				title: "Knowledge Embedding",
				description: "Transform content into AI-ready vector embeddings",
				icon: Database,
			},
			{
				title: "AI Assistant Interface",
				description: "Chat interface powered by your content",
				icon: MessageSquare,
			},
			{
				title: "Real-time Updates",
				description: "AI knowledge base updates as content changes",
				icon: Zap,
			},
			{
				title: "Advanced AI Models",
				description: "Leverage state-of-the-art language models",
				icon: Brain,
			},
		],
	},

	// Text Block
	{
		type: BLOCK_TYPES.TEXT,
		title: "Make Your Content AI-Ready",
		content: `
      <p class="mb-4">AI Content Hubs transform your static content into interactive knowledge that AI assistants can leverage. By structuring and embedding your content properly, you can create powerful AI experiences that help users find exactly what they need.</p>
      <p class="mb-4">With our AI Content Hub solution, you can:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Create AI chatbots that answer questions using your content</li>
        <li>Provide context-aware responses based on user questions</li>
        <li>Maintain factual accuracy by grounding AI in your content</li>
        <li>Reduce hallucinations with proper context retrieval</li>
        <li>Scale knowledge sharing across your organization</li>
      </ul>
    `,
	},

	// Cards Block
	{
		type: BLOCK_TYPES.CARDS,
		title: "AI Capabilities",
		cards: [
			{
				title: "API Integration",
				description: "Connect your content to any AI service",
				icon: Code,
			},
			{
				title: "Hallucination Reduction",
				description: "Keep AI responses factual and accurate",
				icon: FilterX,
			},
			{
				title: "Automated Summaries",
				description: "Generate summaries and insights from your content",
				icon: Sparkles,
			},
			{
				title: "Customizable Assistants",
				description: "Build specialized AI assistants for different needs",
				icon: Bot,
			},
		],
	},

	// CTA Block
	{
		type: BLOCK_TYPES.CTA,
		title: "Power Your AI with Quality Content",
		subtitle: "Transform your knowledge base into an intelligent assistant",
		btnLabel: "Start Building Your AI Hub",
		btnTo: HERO_BTN_CTA,
	},
];

export default blocks;
