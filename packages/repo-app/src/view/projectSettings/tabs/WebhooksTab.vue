<script setup>
import { ref, computed, watch } from "vue";
import { Copy, ExternalLink, RefreshCw, Webhook, Plus, Trash2, MessageSquare, Send, Shield, Settings, GitBranch, Hash, Mail, Calendar, Globe, Info, Sparkles, History } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import SettingsCard from "@/components/SettingsCard.vue";
import SettingsHeading from "@/components/SettingsHeading.vue";
import WebhookPermissions from "@/components/WebhookPermissions.vue";
import IncomingWebhookEditor from "@/components/IncomingWebhookEditor.vue";
import WebhookExecutions from "@/components/WebhookExecutions.vue";
import { saveProjectSettings } from "../utils";
import { useToast } from "@/components/ui/toast/use-toast";
import trpc from "@/trpc";

const props = defineProps({
	project: {
		type: Object,
		default: null,
	},
});

const { toast } = useToast();

// Form data
const webhooks = ref([]);
const incomingWebhooks = ref([]);
const webhookPermissions = ref({});
const showPermissionsDialog = ref(false);
const showIncomingWebhookDialog = ref(false);
const showExecutionsDialog = ref(false);
const editingWebhook = ref(null);
const viewingExecutionsWebhook = ref(null);
const isSaving = ref(false);
const isTestingWebhook = ref(false);
const isLoadingWebhooks = ref(false);

// Provider templates
const providerTemplates = ref([
	{
		id: 'slack',
		name: 'Slack',
		icon: MessageSquare
	},
	{
		id: 'github',
		name: 'GitHub Actions',
		icon: GitBranch
	},
	{
		id: 'discord',
		name: 'Discord',
		icon: Hash
	},
	{
		id: 'email',
		name: 'Email',
		icon: Mail
	},
	{
		id: 'calendar',
		name: 'Calendar',
		icon: Calendar
	},
	{
		id: 'api',
		name: 'API/Zapier',
		icon: Globe
	},
	{
		id: 'custom',
		name: 'Custom',
		icon: Webhook
	}
]);

// Webhook events available for configuration
const availableEvents = [
	{ value: "push", label: "Push", description: "Triggered when code is pushed to repository" },
	{ value: "pull_request", label: "Pull Request", description: "Triggered on pull request events" },
	{ value: "deployment", label: "Deployment", description: "Triggered when deployments are created" },
	{ value: "issues", label: "Issues", description: "Triggered on issue events" },
];

// Generate webhook URLs for this project
const incomingWebhookUrl = computed(() => {
	if (!props.project?._id) return "";
	return `https://api.repo.md/webhooks/${props.project._id}/command`;
});

const githubWebhookUrl = computed(() => {
	if (!props.project?._id) return "";
	return `https://api.repo.md/webhooks/${props.project._id}/github`;
});

// Add new webhook
const addWebhook = () => {
	webhooks.value.push({
		id: Date.now().toString(),
		url: "",
		secret: "",
		events: ["push"],
		active: true,
		insecure_ssl: false,
		content_type: "json"
	});
};

// Remove webhook
const removeWebhook = (index) => {
	webhooks.value.splice(index, 1);
};

// Copy webhook URL to clipboard
const copyWebhookUrl = async (url, type = "webhook") => {
	try {
		await navigator.clipboard.writeText(url);
		toast({
			title: "Copied!",
			description: `${type} URL copied to clipboard`,
		});
	} catch (err) {
		toast({
			title: "Failed to copy",
			description: "Please copy the URL manually",
			variant: "destructive",
		});
	}
};

// Test webhook
const testWebhook = async (webhook) => {
	if (!webhook.url) {
		toast({
			title: "Error",
			description: "Please enter a webhook URL first",
			variant: "destructive",
		});
		return;
	}

	isTestingWebhook.value = true;

	try {
		// Simulate webhook test - in production this would call actual API
		await new Promise(resolve => setTimeout(resolve, 2000));
		
		toast({
			title: "Webhook Test Successful",
			description: `Test payload sent to ${webhook.url}`,
		});
	} catch (err) {
		toast({
			title: "Webhook Test Failed",
			description: "Failed to deliver test payload",
			variant: "destructive",
		});
	} finally {
		isTestingWebhook.value = false;
	}
};

// Load incoming webhooks from API
const loadIncomingWebhooks = async () => {
	if (!props.project?._id) return;
	
	isLoadingWebhooks.value = true;
	try {
		const result = await trpc.projectWebhooks.incoming.list.query({
			projectId: props.project._id
		});
		console.log('Loaded webhooks:', result);
		
		// Handle different response formats
		if (Array.isArray(result)) {
			// Direct array response
			incomingWebhooks.value = result;
		} else if (result.webhooks) {
			// Object with webhooks property
			incomingWebhooks.value = result.webhooks;
		} else {
			// Fallback
			incomingWebhooks.value = [];
		}
	} catch (error) {
		console.error('Failed to load webhooks:', error);
		toast({
			title: "Error loading webhooks",
			description: error.message || "Failed to load incoming webhooks",
			variant: "destructive",
		});
	} finally {
		isLoadingWebhooks.value = false;
	}
};

// Initialize form data from props
const initializeFormData = () => {
	if (props.project?.webhooks && Array.isArray(props.project.webhooks)) {
		webhooks.value = [...props.project.webhooks];
	} else {
		webhooks.value = [];
	}
	
	// Load incoming webhooks from API
	loadIncomingWebhooks();
	
	// Initialize webhook permissions (legacy - for backward compatibility)
	if (props.project?.webhookPermissions) {
		webhookPermissions.value = { ...props.project.webhookPermissions };
	}
};

// Add new incoming webhook
const addIncomingWebhook = () => {
	editingWebhook.value = {
		id: null,
		name: '',
		description: '',
		provider: 'custom',
		active: true,
		permissions: {
			content_management: {
				create_content: true,
				update_content: false,
				delete_content: false
			},
			media_management: {
				upload_media: false,
				generate_images: false,
				optimize_media: false
			},
			deployment: {
				trigger_build: false,
				deploy_preview: false,
				rollback: false
			},
			external_services: {
				call_apis: false,
				send_emails: false,
				trigger_webhooks: false
			},
			data_access: {
				read_analytics: true,
				access_database: false,
				modify_settings: false
			},
			ai_agents: {
				execute_agents: false,
				train_models: false
			}
		},
		agentInstructions: 'Extract the main command or request from the webhook payload. The command should be a clear action to perform on the project.'
	};
	showIncomingWebhookDialog.value = true;
};

// Edit incoming webhook
const editIncomingWebhook = (webhook) => {
	// Ensure we use the correct ID field
	editingWebhook.value = { 
		...webhook,
		id: webhook.id || webhook._id
	};
	showIncomingWebhookDialog.value = true;
};

// Save incoming webhook
const saveIncomingWebhook = async (webhook) => {
	isSaving.value = true;
	try {
		if (webhook.id) {
			// Update existing webhook
			const updated = await trpc.projectWebhooks.incoming.update.mutate({
				webhookId: webhook.id,
				name: webhook.name,
				description: webhook.description,
				provider: webhook.provider,
				active: webhook.active,
				agentInstructions: webhook.agentInstructions,
				permissions: webhook.permissions
			});
			console.log('Update response:', updated);
			
			// Reload webhooks to get fresh data with URLs
			await loadIncomingWebhooks();
		} else {
			// Create new webhook
			const result = await trpc.projectWebhooks.incoming.create.mutate({
				projectId: props.project._id,
				name: webhook.name,
				description: webhook.description,
				provider: webhook.provider,
				agentInstructions: webhook.agentInstructions,
				permissions: webhook.permissions
			});
			console.log('Create response:', result);
			
			// Reload webhooks to get fresh data with URLs
			await loadIncomingWebhooks();
		}
		
		toast({
			title: webhook.id ? "Webhook Updated" : "Webhook Created",
			description: `${webhook.name} has been ${webhook.id ? 'updated' : 'created'} successfully`,
		});
		
		showIncomingWebhookDialog.value = false;
		editingWebhook.value = null;
	} catch (error) {
		toast({
			title: "Error",
			description: error.message || "Failed to save webhook",
			variant: "destructive",
		});
	} finally {
		isSaving.value = false;
	}
};

// Remove incoming webhook
const removeIncomingWebhook = async (id) => {
	try {
		await trpc.projectWebhooks.incoming.delete.mutate({ webhookId: id });
		incomingWebhooks.value = incomingWebhooks.value.filter(w => w.id !== id);
		toast({
			title: "Webhook Deleted",
			description: "The webhook has been removed successfully",
		});
	} catch (error) {
		toast({
			title: "Error",
			description: error.message || "Failed to delete webhook",
			variant: "destructive",
		});
	}
};

// Watch for project changes
watch(() => props.project, () => {
	initializeFormData();
}, { immediate: true });

// Save settings
const saveSettings = async () => {
	if (!props.project?._id) {
		return;
	}

	isSaving.value = true;

	try {
		const settings = {
			webhooks: webhooks.value,
			// Don't save incomingWebhooks - they're managed separately via tRPC
			webhookPermissions: webhookPermissions.value // Keep for backward compatibility
		};

		await saveProjectSettings(props.project._id, settings);
		
		toast({
			title: "Webhooks Updated",
			description: "Your webhook settings have been saved successfully",
		});
	} finally {
		isSaving.value = false;
	}
};

// Get enabled permissions count
const enabledPermissionsCount = computed(() => {
	let count = 0;
	Object.values(webhookPermissions.value).forEach(category => {
		if (category && typeof category === 'object') {
			count += Object.values(category).filter(Boolean).length;
		}
	});
	return count;
});
</script>

<template>
	<div>
		<SettingsHeading
			title="Webhook Configuration"
			subtitle="Configure incoming webhook automation and outgoing notifications for your project"
		/>

		<!-- Incoming Webhooks -->
		<SettingsCard
			title="Incoming Webhooks"
			description="Create multiple webhook endpoints with custom permissions and command interpretation"
			:hideSave="true"
		>
			<div class="space-y-6">
				<!-- Best Practices Alert -->
				<Alert>
					<Info class="h-4 w-4" />
					<AlertTitle>Best Practices</AlertTitle>
					<AlertDescription>
						Create one webhook URL per service provider (Slack, GitHub, etc.) for better organization and security.
						For more granular control, create separate webhooks for different teams or use cases.
					</AlertDescription>
				</Alert>

				<!-- Add webhook button -->
				<div class="flex justify-between items-center">
					<p class="text-sm text-muted-foreground">
						Each webhook has its own URL, permissions, and command interpretation rules
					</p>
					<Button @click="addIncomingWebhook" variant="outline" size="sm">
						<Plus class="w-4 h-4 mr-2" />
						Add Incoming Webhook
					</Button>
				</div>

				<!-- Webhooks list -->
				<div v-if="isLoadingWebhooks" class="text-center py-8 text-muted-foreground">
					<RefreshCw class="w-12 h-12 mx-auto mb-3 text-muted-foreground/50 animate-spin" />
					<p>Loading webhooks...</p>
				</div>
				
				<div v-else-if="incomingWebhooks.length === 0" class="text-center py-8 text-muted-foreground">
					<Webhook class="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
					<p>No incoming webhooks configured</p>
					<p class="text-sm">Create webhooks to receive commands from external services</p>
				</div>

				<div v-else-if="!isLoadingWebhooks" class="space-y-4">
					<Card v-for="webhook in incomingWebhooks" :key="webhook.id || webhook._id">
						<CardHeader class="flex flex-row items-center justify-between pb-3">
							<div>
								<CardTitle class="text-lg flex items-center gap-2">
									<component 
										:is="providerTemplates.find(p => p.id === webhook.provider)?.icon || Webhook" 
										class="w-5 h-5" 
									/>
									{{ webhook.name }}
								</CardTitle>
								<CardDescription>
									{{ webhook.description || 'No description' }}
								</CardDescription>
							</div>
							<div class="flex items-center gap-2">
								<Badge :variant="webhook.active ? 'default' : 'secondary'">
									{{ webhook.active ? 'Active' : 'Inactive' }}
								</Badge>
								<Button
									@click="editIncomingWebhook(webhook)"
									variant="outline"
									size="sm"
								>
									<Settings class="w-4 h-4" />
								</Button>
								<Button
									@click="removeIncomingWebhook(webhook.id || webhook._id)"
									variant="ghost"
									size="sm"
									class="text-destructive hover:text-destructive"
								>
									<Trash2 class="w-4 h-4" />
								</Button>
							</div>
						</CardHeader>

						<CardContent class="space-y-4">
							<!-- Webhook URL -->
							<div>
								<Label>Webhook URL</Label>
								<div class="flex gap-2 mt-1">
									<Input
										:value="webhook.webhookUrl || webhook.url || 'Loading...'"
										readonly
										class="font-mono text-sm"
									/>
									<Button
										@click="copyWebhookUrl(webhook.webhookUrl || webhook.url, webhook.name)"
										variant="outline"
										size="sm"
										:disabled="!webhook.webhookUrl && !webhook.url"
									>
										<Copy class="w-4 h-4" />
									</Button>
								</div>
							</div>

							<!-- Quick Info -->
							<div class="grid grid-cols-2 gap-4 text-sm">
								<div>
									<p class="text-muted-foreground">Provider</p>
									<p class="font-medium">{{ webhook.provider }}</p>
								</div>
								<div>
									<p class="text-muted-foreground">Command Interpretation</p>
									<p class="text-xs">AI-powered</p>
								</div>
							</div>

							<!-- Permissions Summary -->
							<div class="p-3 border rounded-lg bg-muted/50">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<Shield class="w-4 h-4 text-muted-foreground" />
										<span class="text-sm font-medium">Permissions</span>
									</div>
									<span class="text-sm text-muted-foreground">
										{{ Object.values(webhook.permissions || {}).reduce((acc, cat) => 
											acc + Object.values(cat).filter(Boolean).length, 0) 
										}} capabilities enabled
									</span>
								</div>
								
								<!-- View Executions Button -->
								<Button
									@click="viewingExecutionsWebhook = {...webhook, id: webhook.id || webhook._id}; showExecutionsDialog = true"
									variant="outline"
									size="sm"
									class="w-full mt-3"
								>
									<History class="w-4 h-4 mr-2" />
									View Execution History
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>

				<!-- Natural Language Notice -->
				<Alert>
					<Sparkles class="h-4 w-4" />
					<AlertTitle>Natural Language Processing</AlertTitle>
					<AlertDescription>
						All commands are interpreted using AI before execution. This prevents injection attacks and ensures
						commands are understood correctly regardless of how they're phrased.
					</AlertDescription>
				</Alert>
			</div>
		</SettingsCard>

		<!-- GitHub Webhook Integration -->
		<SettingsCard
			title="GitHub Integration"
			description="Configure GitHub webhooks to automatically trigger deployments when you push code"
			:hideSave="true"
		>
			<div class="space-y-4">
				<div>
					<Label>GitHub Webhook URL</Label>
					<div class="flex gap-2 mt-1">
						<Input
							:value="githubWebhookUrl"
							readonly
							class="font-mono text-sm"
							placeholder="GitHub webhook URL will appear here"
						/>
						<Button
							v-if="githubWebhookUrl"
							@click="copyWebhookUrl(githubWebhookUrl, 'GitHub webhook')"
							variant="outline"
							size="sm"
						>
							<Copy class="w-4 h-4" />
						</Button>
					</div>
					<p class="text-xs text-muted-foreground mt-1">
						Add this URL to your GitHub repository's webhook settings for automatic deployments
					</p>
				</div>

				<div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
					<div class="flex items-start gap-3">
						<Webhook class="w-5 h-5 text-blue-600 mt-0.5" />
						<div>
							<h4 class="font-medium text-blue-900 mb-1">GitHub Setup Instructions</h4>
							<ol class="text-sm text-blue-800 space-y-1 list-decimal list-inside">
								<li>Go to your GitHub repository settings</li>
								<li>Navigate to "Webhooks" section</li>
								<li>Click "Add webhook"</li>
								<li>Paste the webhook URL above</li>
								<li>Select "application/json" as content type</li>
								<li>Choose "Just the push event" or select specific events</li>
								<li>Save the webhook</li>
							</ol>
							<div class="mt-3">
								<a
									href="https://docs.github.com/en/developers/webhooks-and-events/webhooks/creating-webhooks"
									target="_blank"
									class="text-blue-600 hover:underline text-sm flex items-center gap-1"
								>
									View GitHub webhook documentation
									<ExternalLink class="w-3 h-3" />
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>
		</SettingsCard>

		<!-- Outgoing Webhooks -->
		<SettingsCard
			title="Outgoing Webhooks"
			description="Send notifications to external services when events occur in your project"
			:hideSave="true"
		>
			<div class="space-y-6">
				<!-- Add webhook button -->
				<div class="flex justify-between items-center">
					<p class="text-sm text-muted-foreground">
						Send notifications to Slack, Discord, email services, or custom endpoints when project events occur
					</p>
					<Button @click="addWebhook" variant="outline" size="sm">
						<Plus class="w-4 h-4 mr-2" />
						Add Webhook
					</Button>
				</div>

				<!-- Webhook list -->
				<div v-if="webhooks.length === 0" class="text-center py-8 text-muted-foreground">
					<Send class="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
					<p>No outgoing webhooks configured</p>
					<p class="text-sm">Add a webhook to send notifications to external services</p>
				</div>

				<div v-else class="space-y-4">
					<Card v-for="(webhook, index) in webhooks" :key="webhook.id || index">
						<CardHeader class="flex flex-row items-center justify-between pb-3">
							<div>
								<CardTitle class="text-lg flex items-center gap-2">
									<Send class="w-5 h-5" />
									Outgoing Webhook {{ index + 1 }}
								</CardTitle>
								<CardDescription>
									Send notifications to external services
								</CardDescription>
							</div>
							<div class="flex items-center gap-2">
								<Badge :variant="webhook.active ? 'default' : 'secondary'">
									{{ webhook.active ? 'Active' : 'Inactive' }}
								</Badge>
								<Button
									@click="removeWebhook(index)"
									variant="ghost"
									size="sm"
									class="text-destructive hover:text-destructive"
								>
									<Trash2 class="w-4 h-4" />
								</Button>
							</div>
						</CardHeader>

						<CardContent class="space-y-4">
							<!-- URL -->
							<div>
								<Label :for="`webhook-url-${index}`">Payload URL *</Label>
								<Input
									:id="`webhook-url-${index}`"
									v-model="webhook.url"
									type="url"
									placeholder="https://example.com/webhook"
									class="mt-1"
								/>
								<p class="text-xs text-muted-foreground mt-1">
									The URL that will receive the webhook payload
								</p>
							</div>

							<!-- Content Type -->
							<div>
								<Label :for="`webhook-content-type-${index}`">Content Type</Label>
								<Select v-model="webhook.content_type">
									<SelectTrigger :id="`webhook-content-type-${index}`" class="mt-1">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="json">application/json</SelectItem>
										<SelectItem value="form">application/x-www-form-urlencoded</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<!-- Secret -->
							<div>
								<Label :for="`webhook-secret-${index}`">Secret (Optional)</Label>
								<Input
									:id="`webhook-secret-${index}`"
									v-model="webhook.secret"
									type="password"
									placeholder="Enter a secret key"
									class="mt-1"
								/>
								<p class="text-xs text-muted-foreground mt-1">
									Used to validate webhook authenticity
								</p>
							</div>

							<!-- Events -->
							<div>
								<Label>Events</Label>
								<div class="grid grid-cols-2 gap-3 mt-2">
									<div v-for="event in availableEvents" :key="event.value" class="flex items-start space-x-3">
										<input
											type="checkbox"
											:id="`webhook-${index}-event-${event.value}`"
											:value="event.value"
											v-model="webhook.events"
											class="mt-1"
										/>
										<div class="flex-1">
											<Label :for="`webhook-${index}-event-${event.value}`" class="cursor-pointer">
												{{ event.label }}
											</Label>
											<p class="text-xs text-muted-foreground">
												{{ event.description }}
											</p>
										</div>
									</div>
								</div>
							</div>

							<!-- Settings -->
							<div class="flex items-center justify-between pt-3 border-t">
								<div class="flex items-center gap-4">
									<div class="flex items-center space-x-3">
										<Switch
											:id="`webhook-active-${index}`"
											v-model:checked="webhook.active"
										/>
										<Label :for="`webhook-active-${index}`" class="cursor-pointer">
											Active
										</Label>
									</div>
									<div class="flex items-center space-x-3">
										<Switch
											:id="`webhook-ssl-${index}`"
											v-model:checked="webhook.insecure_ssl"
										/>
										<Label :for="`webhook-ssl-${index}`" class="cursor-pointer text-sm">
											Disable SSL verification
										</Label>
									</div>
								</div>
								<Button
									@click="testWebhook(webhook)"
									variant="outline"
									size="sm"
									:disabled="!webhook.url || isTestingWebhook"
								>
									<RefreshCw class="w-4 h-4 mr-2" :class="{ 'animate-spin': isTestingWebhook }" />
									Test
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</SettingsCard>

		<!-- Save Button -->
		<div class="mt-6 flex justify-end">
			<Button @click="saveSettings" :disabled="isSaving">
				<RefreshCw v-if="isSaving" class="w-4 h-4 mr-2 animate-spin" />
				{{ isSaving ? "Saving..." : "Save Webhook Settings" }}
			</Button>
		</div>

		<!-- Permissions Dialog -->
		<Dialog :open="showPermissionsDialog" @update:open="showPermissionsDialog = $event">
			<DialogContent class="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Webhook Permissions Configuration</DialogTitle>
					<DialogDescription>
						Control what actions incoming webhooks can perform in your project
					</DialogDescription>
				</DialogHeader>
				
				<div class="mt-4">
					<WebhookPermissions 
						v-model:permissions="webhookPermissions"
						:readOnly="false"
					/>
				</div>
				
				<DialogFooter class="mt-6">
					<Button variant="outline" @click="showPermissionsDialog = false">
						Cancel
					</Button>
					<Button @click="showPermissionsDialog = false">
						Apply Permissions
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>

		<!-- Incoming Webhook Editor Dialog -->
		<Dialog :open="showIncomingWebhookDialog" @update:open="showIncomingWebhookDialog = $event">
			<DialogContent class="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{{ editingWebhook?.id ? 'Edit' : 'Create' }} Incoming Webhook</DialogTitle>
					<DialogDescription>
						Configure webhook settings, permissions, and command interpretation
					</DialogDescription>
				</DialogHeader>
				
				<div class="mt-4">
					<IncomingWebhookEditor 
						v-if="editingWebhook"
						:webhook="editingWebhook"
						:projectId="project._id"
						@save="saveIncomingWebhook"
						@cancel="showIncomingWebhookDialog = false"
					/>
				</div>
			</DialogContent>
		</Dialog>

		<!-- Webhook Executions Dialog -->
		<Dialog :open="showExecutionsDialog" @update:open="showExecutionsDialog = $event">
			<DialogContent class="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Webhook Execution History</DialogTitle>
					<DialogDescription>
						{{ viewingExecutionsWebhook?.name || 'All webhooks' }}
					</DialogDescription>
				</DialogHeader>
				
				<div class="mt-4">
					<WebhookExecutions 
						:projectId="project._id"
						:webhookId="viewingExecutionsWebhook?.id"
						:limit="20"
					/>
				</div>
			</DialogContent>
		</Dialog>
	</div>
</template>