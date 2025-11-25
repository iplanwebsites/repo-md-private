<script setup>
import { ref, computed, watch } from "vue";
import { ClipboardCopy } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select";
import SettingsCard from "@/components/SettingsCard.vue";
import SettingsHeading from "@/components/SettingsHeading.vue";
import { saveProjectSettings, copyToClipboard } from "../utils";
import { getMCPServerUrl, getA2AServerUrl, getAgentUrl } from "@/lib/utils/repoUrlUtils";

const props = defineProps({
	project: {
		type: Object,
		default: null,
	},
});

// Form data
const enableMCP = ref(true);
const enableA2A = ref(true);
const enableAIImageSearch = ref(true);
const enableAITextSearch = ref(true);
const enableAgent = ref(false);
const agentModel = ref("gpt-4o");
const agentSystemPrompt = ref("");
const projectSummary = ref("");
const publicAgentCapabilities = ref({
	sendSupportRequest: false,
	sendCustomerFeedback: false,
	searchContent: true,
	suggestNewContent: false,
	suggestEdits: false
});
const publicAgentIntegrations = ref({
	enablePublicMCP: false,
	enableAskEndpoint: false
});
const editorAgentPermissions = ref({
	editPosts: true,
	createPosts: true,
	publishSchedulePosts: false,
	generateImages: false
});
const editorAgentSystemPrompt = ref("");
const editorAgentRecurringTasks = ref("");
const isSaving = ref(false);

// URLs
const mcpServerUrl = computed(() => props.project?._id ? getMCPServerUrl(props.project._id) : "");
const a2aServerUrl = computed(() => props.project?._id ? getA2AServerUrl(props.project._id) : "");
const agentUrl = computed(() => props.project?._id ? getAgentUrl(props.project._id) : "");

// Available models
const openAiModels = [
	"gpt-4o",
	"gpt-4o-mini",
	"gpt-4-turbo",
	"gpt-4",
	"gpt-3.5-turbo",
	"o1",
	"o1-mini",
	"o3-mini"
];

// Parse recurring tasks
const parsedRecurringTasks = computed(() => {
	if (!editorAgentRecurringTasks.value) return [];
	
	const tasks = [];
	const lines = editorAgentRecurringTasks.value.split('\n').filter(line => line.trim());
	
	lines.forEach(line => {
		const parsed = {
			original: line,
			frequency: 'unknown',
			time: null,
			nextRun: null,
			description: line
		};
		
		// Parse daily tasks
		if (line.toLowerCase().includes('daily') || line.toLowerCase().includes('every day')) {
			parsed.frequency = 'daily';
			const timeMatch = line.match(/at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?|(\d{1,2})\s*(am|pm)/i);
			if (timeMatch) {
				parsed.time = timeMatch[0];
			}
			
			// Calculate next run
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			parsed.nextRun = `Tomorrow ${parsed.time || 'at scheduled time'}`;
		}
		
		// Parse weekly tasks
		else if (line.toLowerCase().includes('weekly') || line.toLowerCase().includes('every week')) {
			parsed.frequency = 'weekly';
			const dayMatch = line.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/i);
			if (dayMatch) {
				parsed.day = dayMatch[0];
				parsed.nextRun = `Next ${dayMatch[0]}`;
			}
		}
		
		// Parse time-based patterns
		const timePatterns = [
			/at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?/i,
			/(\d{1,2})\s*(am|pm)/i,
			/(\d{1,2})h/i
		];
		
		for (const pattern of timePatterns) {
			const match = line.match(pattern);
			if (match && !parsed.time) {
				parsed.time = match[0];
				break;
			}
		}
		
		tasks.push(parsed);
	});
	
	return tasks;
});

// Initialize form data from props
const initializeFormData = () => {
	if (props.project?.ai) {
		enableMCP.value = props.project.ai.enableMCP !== undefined ? props.project.ai.enableMCP : true;
		enableA2A.value = props.project.ai.enableA2A !== undefined ? props.project.ai.enableA2A : true;
		enableAgent.value = props.project.ai.enableAgent !== undefined ? props.project.ai.enableAgent : false;
		agentModel.value = props.project.ai.agentModel || "gpt-4o";
		agentSystemPrompt.value = props.project.ai.agentSystemPrompt || "";
		projectSummary.value = props.project.ai.projectSummary || "";
		enableAIImageSearch.value = props.project.ai.enableAIImageSearch !== undefined ? props.project.ai.enableAIImageSearch : true;
		enableAITextSearch.value = props.project.ai.enableAITextSearch !== undefined ? props.project.ai.enableAITextSearch : true;
		
		if (props.project.ai.publicAgentCapabilities) {
			publicAgentCapabilities.value = {
				...publicAgentCapabilities.value,
				...props.project.ai.publicAgentCapabilities
			};
		}
		
		if (props.project.ai.publicAgentIntegrations) {
			publicAgentIntegrations.value = {
				...publicAgentIntegrations.value,
				...props.project.ai.publicAgentIntegrations
			};
		}
		
		if (props.project.ai.editorAgentPermissions) {
			editorAgentPermissions.value = {
				...editorAgentPermissions.value,
				...props.project.ai.editorAgentPermissions
			};
		}
		
		editorAgentSystemPrompt.value = props.project.ai.editorAgentSystemPrompt || "";
		editorAgentRecurringTasks.value = props.project.ai.editorAgentRecurringTasks || "";
	}
};

// Watch for project changes
watch(() => props.project, () => {
	initializeFormData();
}, { immediate: true });

// Copy URL functions
const copyMCPUrl = () => copyToClipboard(mcpServerUrl.value, "MCP URL");
const copyA2AUrl = () => copyToClipboard(a2aServerUrl.value, "A2A URL");
const copyAgentUrl = () => copyToClipboard(agentUrl.value, "Agent URL");

// Save settings
const saveSettings = async () => {
	if (!props.project?._id) {
		return;
	}

	isSaving.value = true;

	try {
		const settings = {
			ai: {
				enableMCP: enableMCP.value,
				enableA2A: enableA2A.value,
				enableAgent: enableAgent.value,
				agentModel: agentModel.value,
				agentSystemPrompt: agentSystemPrompt.value,
				projectSummary: projectSummary.value,
				enableAIImageSearch: enableAIImageSearch.value,
				enableAITextSearch: enableAITextSearch.value,
				publicAgentCapabilities: publicAgentCapabilities.value,
				publicAgentIntegrations: publicAgentIntegrations.value,
				editorAgentPermissions: editorAgentPermissions.value,
				editorAgentSystemPrompt: editorAgentSystemPrompt.value,
				editorAgentRecurringTasks: editorAgentRecurringTasks.value
			}
		};

		await saveProjectSettings(props.project._id, settings);
	} finally {
		isSaving.value = false;
	}
};
</script>

<template>
	<div>
		<SettingsHeading
			title="AI Settings"
			subtitle="Configure AI capabilities and provide context about your project for AI interactions."
		/>

		<!-- AI Search Card -->
		<SettingsCard
			title="AI Search"
			description="Configure AI-powered search capabilities for your content."
			:isSaving="isSaving"
			@save="saveSettings"
			more="/docs/ai-search"
		>
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="font-medium">Enable AI Image Search</p>
						<p class="text-sm text-muted-foreground">
							Find images by describing their content (e.g., "lovely furry things" will return kitten pictures)
						</p>
					</div>
					<Switch
						id="enable-ai-image-search"
						v-model:checked="enableAIImageSearch"
					/>
				</div>

				<div class="flex items-center justify-between">
					<div>
						<p class="font-medium">Enable AI Text Search</p>
						<p class="text-sm text-muted-foreground">
							Used for similarity ranking and finding documents by asking questions
						</p>
					</div>
					<Switch
						id="enable-ai-text-search"
						v-model:checked="enableAITextSearch"
					/>
				</div>
			</div>
		</SettingsCard>

		<!-- AI Integration Card -->
		<SettingsCard
			title="AI Integration"
			description="Enable or disable AI capabilities for your project."
			:isSaving="isSaving"
			@save="saveSettings"
		>
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="font-medium">Enable MCP (Model Context Protocol)</p>
						<p class="text-sm text-muted-foreground">
							Allow AI to process and understand your project's context
						</p>
					</div>
					<Switch
						id="enable-mcp"
						v-model:checked="enableMCP"
					/>
				</div>

				<div class="flex items-center justify-between">
					<div>
						<p class="font-medium">Enable A2A (Agent-to-Agent Communication)</p>
						<p class="text-sm text-muted-foreground">
							Allow AI agents to communicate with each other about your project
						</p>
					</div>
					<Switch
						id="enable-a2a"
						v-model:checked="enableA2A"
					/>
				</div>

				<!-- MCP Server URL -->
				<div v-if="enableMCP && mcpServerUrl" class="mt-2 pl-6 border-l-2 border-l-muted mb-4">
					<div class="flex items-center">
						<Input
							v-model="mcpServerUrl"
							disabled
							class="flex-1 bg-muted/30"
							readonly
						/>
						<Button
							variant="outline"
							class="ml-2"
							@click="copyMCPUrl"
						>
							<ClipboardCopy class="h-4 w-4 mr-2" />
							Copy MCP URL
						</Button>
					</div>
				</div>

				<!-- A2A Server URL -->
				<div v-if="enableA2A && a2aServerUrl" class="mt-2 pl-6 border-l-2 border-l-muted">
					<div class="flex items-center">
						<Input
							v-model="a2aServerUrl"
							disabled
							class="flex-1 bg-muted/30"
							readonly
						/>
						<Button
							variant="outline"
							class="ml-2"
							@click="copyA2AUrl"
						>
							<ClipboardCopy class="h-4 w-4 mr-2" />
							Copy A2A URL
						</Button>
					</div>
				</div>
			</div>
		</SettingsCard>

		<!-- Public Agent Card -->
		<SettingsCard
			title="Public Agent"
			description="Configure your public-facing agent that answers questions from visitors to your site."
			:isSaving="isSaving"
			@save="saveSettings"
		>
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="font-medium">Enable Public Agent</p>
						<p class="text-sm text-muted-foreground">
							Allow visitors to interact with your content through an AI assistant
						</p>
					</div>
					<Switch
						id="enable-agent"
						v-model:checked="enableAgent"
					/>
				</div>

				<template v-if="true">
					<!-- Agent URL -->
					<div v-if="agentUrl" class="mt-2 pl-6 border-l-2 border-l-muted mb-4">
						<div class="flex items-center">
							<Input
								v-model="agentUrl"
								disabled
								class="flex-1 bg-muted/30"
								readonly
							/>
							<Button
								variant="outline"
								class="ml-2"
								@click="copyAgentUrl"
							>
								<ClipboardCopy class="h-4 w-4 mr-2" />
								Copy Agent URL
							</Button>
						</div>
					</div>

					<!-- Agent Model Selection -->
					<div class="mt-2 pl-6 border-l-2 border-l-muted mb-4">
						<p class="font-medium mb-2">Agent Model</p>
						<Select v-model="agentModel">
							<SelectTrigger class="w-full">
								<SelectValue placeholder="Select a model" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem v-for="model in openAiModels" :key="model" :value="model">
									{{ model }}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<!-- Public Agent System Prompt -->
					<div class="mt-2 pl-6 border-l-2 border-l-muted">
						<p class="font-medium mb-2">Public Agent System Prompt</p>
						<Textarea
							v-model="agentSystemPrompt"
							placeholder="For example: A friendly assistant that helps visitors find information about our products and services. Always be helpful and direct users to relevant content."
							class="min-h-32"
						/>
						<p class="text-xs text-muted-foreground mt-2">
							Configure how your public agent interacts with visitors. This agent will answer questions from the general public visiting your site.
						</p>
					</div>

					<!-- Public Agent Capabilities -->
					<div class="mt-4 pl-6 border-l-2 border-l-muted space-y-3">
						<p class="font-medium mb-2">Agent Capabilities</p>
						<p class="text-sm text-muted-foreground mb-3">
							Enable specific features your public agent can use when interacting with visitors.
						</p>

						<!-- Search Content -->
						<div class="flex items-center space-x-3">
							<Checkbox 
								id="search-content"
								v-model:checked="publicAgentCapabilities.searchContent"
							/>
							<div class="grid gap-1.5 leading-none">
								<Label 
									for="search-content" 
									class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
								>
									Search content
								</Label>
								<p class="text-sm text-muted-foreground">
									Allow the agent to search and reference your published content
								</p>
							</div>
						</div>

						<!-- Send Support Request -->
						<div class="flex items-center space-x-3">
							<Checkbox 
								id="send-support"
								v-model:checked="publicAgentCapabilities.sendSupportRequest"
							/>
							<div class="grid gap-1.5 leading-none">
								<Label 
									for="send-support" 
									class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
								>
									Send support requests
								</Label>
								<p class="text-sm text-muted-foreground">
									Allow visitors to submit support tickets through the agent
								</p>
							</div>
						</div>

						<!-- Send Customer Feedback -->
						<div class="flex items-center space-x-3">
							<Checkbox 
								id="send-feedback"
								v-model:checked="publicAgentCapabilities.sendCustomerFeedback"
							/>
							<div class="grid gap-1.5 leading-none">
								<Label 
									for="send-feedback" 
									class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
								>
									Send customer feedback
								</Label>
								<p class="text-sm text-muted-foreground">
									Allow visitors to submit feedback and suggestions
								</p>
							</div>
						</div>

						<!-- Suggest New Content -->
						<div class="flex items-center space-x-3">
							<Checkbox 
								id="suggest-new-content"
								v-model:checked="publicAgentCapabilities.suggestNewContent"
							/>
							<div class="grid gap-1.5 leading-none">
								<Label 
									for="suggest-new-content" 
									class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
								>
									Suggest new content
								</Label>
								<p class="text-sm text-muted-foreground">
									Allow visitors to request new content topics
								</p>
							</div>
						</div>

						<!-- Suggest Edits -->
						<div class="flex items-center space-x-3">
							<Checkbox 
								id="suggest-edits"
								v-model:checked="publicAgentCapabilities.suggestEdits"
							/>
							<div class="grid gap-1.5 leading-none">
								<Label 
									for="suggest-edits" 
									class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
								>
									Suggest edits
								</Label>
								<p class="text-sm text-muted-foreground">
									Allow visitors to suggest corrections or improvements to content
								</p>
							</div>
						</div>
					</div>

					<!-- Public Agent Integrations -->
					<div class="mt-4 pl-6 border-l-2 border-l-muted space-y-3">
						<p class="font-medium mb-2">Integration Settings</p>
						<p class="text-sm text-muted-foreground mb-3">
							Configure how external services can interact with your public agent.
						</p>

						<!-- Enable Public MCP -->
						<div class="flex items-center space-x-3">
							<Checkbox 
								id="public-mcp"
								v-model:checked="publicAgentIntegrations.enablePublicMCP"
							/>
							<div class="grid gap-1.5 leading-none">
								<Label 
									for="public-mcp" 
									class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
								>
									Enable public MCP server connections
								</Label>
								<p class="text-sm text-muted-foreground">
									Allow external tools to connect to your agent via Model Context Protocol
								</p>
							</div>
						</div>

						<!-- Enable /ask Endpoint -->
						<div class="flex items-center space-x-3">
							<Checkbox 
								id="ask-endpoint"
								v-model:checked="publicAgentIntegrations.enableAskEndpoint"
							/>
							<div class="grid gap-1.5 leading-none">
								<Label 
									for="ask-endpoint" 
									class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
								>
									Enable /ask endpoint
								</Label>
								<p class="text-sm text-muted-foreground">
									Expose the NLWeb /ask endpoint for Microsoft's natural language query specification
								</p>
							</div>
						</div>
					</div>
				</template>
			</div>
		</SettingsCard>

		<!-- Editor Agent Card -->
		<SettingsCard
			title="Editor Agent"
			description="Configure AI assistance for content editing and creation."
			:isSaving="isSaving"
			@save="saveSettings"
		>
			<div class="space-y-4">
				<div class="p-4 bg-muted/50 rounded-lg">
					<p class="text-sm text-muted-foreground">
						Your Editor Agent is a private AI assistant that only you can access. It can be integrated into your development tools or accessed directly through your project's agent endpoints.
					</p>
				</div>

				<div class="space-y-3">
					<Label>Agent Permissions</Label>
					<p class="text-sm text-muted-foreground mb-3">
						Control what actions your Editor Agent can perform on your content.
					</p>

					<!-- Edit Posts Permission -->
					<div class="flex items-center space-x-3">
						<Checkbox 
							id="edit-posts"
							v-model:checked="editorAgentPermissions.editPosts"
						/>
						<div class="grid gap-1.5 leading-none">
							<Label 
								for="edit-posts" 
								class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
							>
								Make edits to posts
							</Label>
							<p class="text-sm text-muted-foreground">
								Allow the agent to modify existing content
							</p>
						</div>
					</div>

					<!-- Create Posts Permission -->
					<div class="flex items-center space-x-3">
						<Checkbox 
							id="create-posts"
							v-model:checked="editorAgentPermissions.createPosts"
						/>
						<div class="grid gap-1.5 leading-none">
							<Label 
								for="create-posts" 
								class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
							>
								Create new posts
							</Label>
							<p class="text-sm text-muted-foreground">
								Allow the agent to create new content from scratch
							</p>
						</div>
					</div>

					<!-- Publish/Schedule Permission -->
					<div class="flex items-center space-x-3">
						<Checkbox 
							id="publish-schedule"
							v-model:checked="editorAgentPermissions.publishSchedulePosts"
						/>
						<div class="grid gap-1.5 leading-none">
							<Label 
								for="publish-schedule" 
								class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
							>
								Publish and schedule posts
							</Label>
							<p class="text-sm text-muted-foreground">
								Allow the agent to publish content immediately or schedule for later
							</p>
						</div>
					</div>

					<!-- Generate Images Permission -->
					<div class="flex items-center space-x-3">
						<Checkbox 
							id="generate-images"
							v-model:checked="editorAgentPermissions.generateImages"
						/>
						<div class="grid gap-1.5 leading-none">
							<Label 
								for="generate-images" 
								class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
							>
								Generate images
							</Label>
							<p class="text-sm text-muted-foreground">
								Allow the agent to create images using AI generation
							</p>
						</div>
					</div>
				</div>

				<!-- Editor Agent System Prompt -->
				<div class="space-y-3 mt-6">
					<Label>Editor Agent System Prompt</Label>
					<Textarea
						v-model="editorAgentSystemPrompt"
						placeholder="For example: You are an expert content editor for my blog. Help me improve my writing, suggest better titles, fix grammar, and ensure consistency across all posts. Focus on clarity and engagement."
						class="min-h-32"
					/>
					<p class="text-sm text-muted-foreground">
						Configure how your Editor Agent assists you with content creation and editing. This prompt shapes the agent's behavior and expertise.
					</p>
				</div>

				<!-- Recurring Tasks -->
				<div class="space-y-3 mt-6">
					<Label>Recurring Tasks</Label>
					<Textarea
						v-model="editorAgentRecurringTasks"
						placeholder="Write a new blog post daily at 10am&#10;Plan weekly content roadmap every Monday at 9am&#10;Generate monthly analytics report on the 1st at 8am&#10;Review and update documentation weekly"
						class="min-h-32 font-mono text-sm"
					/>
					<p class="text-sm text-muted-foreground">
						Define recurring tasks in natural language. Each line should describe one task with its frequency and timing.
					</p>

					<!-- Parsed Tasks Display -->
					<div v-if="parsedRecurringTasks.length > 0" class="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
						<p class="text-sm font-medium text-muted-foreground mb-3">Interpreted Tasks:</p>
						<div v-for="(task, index) in parsedRecurringTasks" :key="index" class="p-3 bg-background rounded-md shadow-sm">
							<div class="text-sm space-y-1">
								<div class="font-medium">{{ task.description }}</div>
								<div class="flex items-center gap-4 text-xs text-muted-foreground">
									<span class="capitalize">
										<span class="font-medium">Frequency:</span> {{ task.frequency }}
										<span v-if="task.day"> ({{ task.day }})</span>
									</span>
									<span v-if="task.time">
										<span class="font-medium">Time:</span> {{ task.time }}
									</span>
									<span v-if="task.nextRun">
										<span class="font-medium">Next run:</span> {{ task.nextRun }}
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</SettingsCard>

		<!-- Project Summary Card -->
		<SettingsCard
			title="Project Summary for AI"
			description="Describe what your project is about and what AIs can do with its content. This helps AIs understand the purpose and context of your project."
			:isSaving="isSaving"
			@save="saveSettings"
		>
			<Textarea
				v-model="projectSummary"
				placeholder="This project is a blog about technology and science. It contains articles on AI, machine learning, and quantum computing. AIs can help users find related articles, summarize content, and generate new article ideas based on existing content."
				class="min-h-32"
			/>
			<p class="text-xs text-muted-foreground mt-2">
				Be specific about what your project contains and how AI should interact with it. This helps AI better understand and serve your project's needs.
			</p>
		</SettingsCard>
	</div>
</template>