<script setup>
import { ref, computed, watch } from "vue";
import { Plus, Check, ExternalLink, Puzzle, Mail, MessageSquare, Filter, Bot, LineChart, Hash } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import SettingsCard from "@/components/SettingsCard.vue";
import SettingsHeading from "@/components/SettingsHeading.vue";
import { saveProjectSettings } from "../utils";
import { useToast } from "@/components/ui/toast/use-toast";
import { integrationsConfig, categoryInfo } from "@/config/integrationsConfig";

const props = defineProps({
	project: {
		type: Object,
		default: null,
	},
});

const { toast } = useToast();

// Form data
const activeIntegrationFilter = ref("all");
const integrations = ref({});
const isSaving = ref(false);

// Initialize integrations from config
const initializeIntegrations = () => {
	const integrationsData = {};
	
	Object.entries(integrationsConfig).forEach(([key, config]) => {
		integrationsData[key] = {
			connected: false,
			enabled: false,
			category: config.category,
			fields: {}
		};
		
		// Initialize field values from config
		if (config.fields) {
			Object.entries(config.fields).forEach(([fieldKey, fieldConfig]) => {
				integrationsData[key].fields[fieldKey] = fieldConfig.default || "";
			});
		}
	});
	
	return integrationsData;
};

// Integration categories from config
const integrationCategories = computed(() => {
	const categories = [
		{ id: "all", name: "All Integrations", icon: Puzzle }
	];
	
	Object.entries(categoryInfo).forEach(([id, info]) => {
		categories.push({ id, ...info });
	});
	
	return categories;
});

// Filtered integrations based on selected category
const filteredIntegrations = computed(() => {
	if (activeIntegrationFilter.value === "all") {
		return Object.entries(integrations.value);
	}
	return Object.entries(integrations.value).filter(
		([key, config]) => config.category === activeIntegrationFilter.value
	);
});

// Get integration display info from config
const getIntegrationInfo = (key) => {
	const config = integrationsConfig[key];
	if (!config) {
		return { name: key, description: "", icon: Puzzle, color: "bg-gray-500" };
	}
	
	return {
		name: config.brandName || config.name,
		description: config.description,
		icon: config.icon,
		color: config.color,
		website: config.website,
		pricing: config.pricing,
		features: config.features
	};
};

// Handle integration connection
const connectIntegration = async (key) => {
	toast({
		title: "Connecting Integration",
		description: `Setting up ${getIntegrationInfo(key).name}...`,
	});
	
	// For now, just mark as connected
	// In production, this would handle OAuth flow or API key validation
	integrations.value[key].connected = true;
	
	toast({
		title: "Integration Connected",
		description: `${getIntegrationInfo(key).name} has been connected successfully.`,
	});
};

// Handle integration disconnection
const disconnectIntegration = async (key) => {
	integrations.value[key].connected = false;
	integrations.value[key].enabled = false;
	
	toast({
		title: "Integration Disconnected",
		description: `${getIntegrationInfo(key).name} has been disconnected.`,
	});
};

// Initialize form data from props
const initializeFormData = () => {
	// Reset integrations
	integrations.value = initializeIntegrations();
	
	// Load saved integrations from project
	if (props.project?.integrations) {
		Object.entries(props.project.integrations).forEach(([key, savedConfig]) => {
			if (integrations.value[key]) {
				integrations.value[key] = {
					...integrations.value[key],
					...savedConfig
				};
			}
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
			integrations: integrations.value
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
			title="Integrations"
			subtitle="Connect third-party services to extend your project's capabilities"
		/>

		<!-- Integration Services Title -->
		<SettingsCard
			title="Available Integrations"
			description="Connect your favorite tools and services to automate workflows and enhance your project"
			:hideSave="true"
			:isSaving="isSaving"
			@save="saveSettings"
		>
			<div class="space-y-6">
				<!-- Category Filter -->
				<div class="flex flex-wrap gap-2">
					<Button
						v-for="category in integrationCategories"
						:key="category.id"
						:variant="activeIntegrationFilter === category.id ? 'default' : 'outline'"
						size="sm"
						@click="activeIntegrationFilter = category.id"
						class="flex items-center gap-2"
					>
						<component :is="category.icon" class="w-4 h-4" />
						{{ category.name }}
					</Button>
				</div>

				<!-- Slack Organization-Level Notice -->
				<Card v-if="activeIntegrationFilter === 'all' || activeIntegrationFilter === 'notifications'" class="mb-4 border-purple-200 bg-purple-50/50">
					<CardHeader>
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center text-white">
								<Hash class="w-5 h-5" />
							</div>
							<div class="flex-1">
								<CardTitle class="text-lg">Slack Integration</CardTitle>
								<CardDescription class="text-sm">
									Team communication - Get notifications in your Slack workspace
								</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<div class="text-sm text-muted-foreground">
							<p class="mb-3">Slack integration is managed at the organization level to ensure consistent notifications across all projects.</p>
							<router-link 
								:to="`/${$route.params.orgId}/~/integrations/slack`" 
								class="inline-flex items-center text-primary hover:underline"
							>
								Configure Slack integration
								<ExternalLink class="w-3 h-3 ml-1" />
							</router-link>
						</div>
					</CardContent>
				</Card>

				<!-- Integration Cards -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Card 
						v-for="[key, config] in filteredIntegrations" 
						:key="key"
						:class="{ 'ring-2 ring-primary': config.enabled }"
					>
						<CardHeader>
							<div class="flex items-start justify-between">
								<div class="flex items-center gap-3">
									<div :class="[getIntegrationInfo(key).color, 'w-10 h-10 rounded-lg flex items-center justify-center text-white']">
										<component :is="getIntegrationInfo(key).icon" class="w-5 h-5" />
									</div>
									<div class="flex-1">
										<CardTitle class="text-lg">{{ getIntegrationInfo(key).name }}</CardTitle>
										<CardDescription class="text-sm">
											{{ getIntegrationInfo(key).description }}
										</CardDescription>
										<div v-if="getIntegrationInfo(key).pricing" class="text-xs text-muted-foreground mt-1">
											{{ getIntegrationInfo(key).pricing }}
										</div>
									</div>
								</div>
								<div class="flex items-center gap-2">
									<Button
										v-if="!config.connected"
										size="sm"
										@click="connectIntegration(key)"
									>
										<Plus class="w-4 h-4 mr-1" />
										Connect
									</Button>
									<Button
										v-else-if="config.connected && !config.enabled"
										size="sm"
										variant="outline"
										@click="disconnectIntegration(key)"
									>
										Disconnect
									</Button>
									<div v-if="config.connected" class="flex items-center gap-2">
										<Check class="w-4 h-4 text-green-600" />
										<Switch
											v-model:checked="config.enabled"
											:id="`${key}-enabled`"
										/>
									</div>
								</div>
							</div>
						</CardHeader>

						<CardContent v-if="config.connected" class="space-y-4">
							<!-- Show connection status message if not enabled -->
							<div v-if="!config.enabled" class="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
								Connected. Enable the integration to configure settings.
							</div>
							
							<!-- Show configuration fields when enabled -->
							<template v-else-if="config.enabled">
								<!-- Configuration Title -->
								<div class="border-b pb-3 mb-4">
									<h4 class="font-medium text-sm">Configure {{ getIntegrationInfo(key).name }}</h4>
									<p class="text-xs text-muted-foreground mt-1">
										Set up your {{ getIntegrationInfo(key).name }} integration settings below
									</p>
								</div>
								
								<!-- Dynamic field rendering based on config -->
								<div v-for="(fieldConfig, fieldKey) in integrationsConfig[key]?.fields" :key="fieldKey" class="space-y-2">
									<!-- Text/Password/URL inputs -->
									<template v-if="fieldConfig.type === 'text' || fieldConfig.type === 'password' || fieldConfig.type === 'url'">
										<Label :for="`${key}-${fieldKey}`">{{ fieldConfig.label }}</Label>
										<Input
											:id="`${key}-${fieldKey}`"
											v-model="config.fields[fieldKey]"
											:type="fieldConfig.type"
											:placeholder="fieldConfig.placeholder"
										/>
										<p v-if="fieldConfig.help" class="text-xs text-muted-foreground">
											{{ fieldConfig.help }}
										</p>
									</template>
									
									<!-- Checkbox inputs -->
									<template v-else-if="fieldConfig.type === 'checkbox'">
										<div class="flex items-center space-x-3">
											<Checkbox
												:id="`${key}-${fieldKey}`"
												v-model:checked="config.fields[fieldKey]"
											/>
											<Label :for="`${key}-${fieldKey}`" class="cursor-pointer">
												{{ fieldConfig.label }}
											</Label>
										</div>
										<p v-if="fieldConfig.help" class="text-xs text-muted-foreground ml-6">
											{{ fieldConfig.help }}
										</p>
									</template>
									
									<!-- Select inputs -->
									<template v-else-if="fieldConfig.type === 'select'">
										<Label :for="`${key}-${fieldKey}`">{{ fieldConfig.label }}</Label>
										<Select v-model="config.fields[fieldKey]">
											<SelectTrigger :id="`${key}-${fieldKey}`">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem
													v-for="option in fieldConfig.options"
													:key="option.value || option"
													:value="option.value || option"
												>
													{{ option.label || option }}
												</SelectItem>
											</SelectContent>
										</Select>
										<p v-if="fieldConfig.help" class="text-xs text-muted-foreground">
											{{ fieldConfig.help }}
										</p>
									</template>
								</div>
								
								<!-- Help link -->
								<div v-if="getIntegrationInfo(key).website" class="pt-2">
									<a
										:href="getIntegrationInfo(key).website"
										target="_blank"
										class="text-xs text-blue-600 hover:underline flex items-center gap-1"
									>
										Learn more about {{ getIntegrationInfo(key).name }}
										<ExternalLink class="w-3 h-3" />
									</a>
								</div>
							</template>
							
						</CardContent>
					</Card>
				</div>
			</div>
		</SettingsCard>

		<!-- Save Button -->
		<div class="mt-6 flex justify-end">
			<Button @click="saveSettings" :disabled="isSaving">
				<component :is="isSaving ? 'RotateCw' : 'Save'" class="w-4 h-4 mr-2" :class="{ 'animate-spin': isSaving }" />
				{{ isSaving ? "Saving..." : "Save Integrations" }}
			</Button>
		</div>
	</div>
</template>