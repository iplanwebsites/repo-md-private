<script setup>
import { ref, watch } from "vue";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SettingsCard from "@/components/SettingsCard.vue";
import SettingsHeading from "@/components/SettingsHeading.vue";
import { saveProjectSettings } from "../utils";

const props = defineProps({
	project: {
		type: Object,
		default: null,
	},
});

// Form data
const apiKeys = ref({
	openai: "",
	anthropic: "",
	elevenlabs: "",
	google: "",
	replicate: "",
	huggingface: ""
});
const isSaving = ref(false);

// Initialize form data from props
const initializeFormData = () => {
	if (props.project?.secrets) {
		apiKeys.value = {
			openai: props.project.secrets.openai || "",
			anthropic: props.project.secrets.anthropic || "",
			elevenlabs: props.project.secrets.elevenlabs || "",
			google: props.project.secrets.google || "",
			replicate: props.project.secrets.replicate || "",
			huggingface: props.project.secrets.huggingface || ""
		};
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
			secrets: apiKeys.value
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
			title="API Keys & Secrets"
			subtitle="Manage third-party service API keys used to power AI agents and other features."
		/>

		<!-- API Keys Card -->
		<SettingsCard
			title="Third-Party Service Keys"
			description="Enter your API keys for various services. These keys are encrypted and stored securely."
			:isSaving="isSaving"
			@save="saveSettings"
		>
			<div class="space-y-6">
				<div class="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
					<p class="text-sm text-amber-800 dark:text-amber-200">
						<strong>Security Note:</strong> API keys are optional. If not provided, the default repo.md keys will be used with rate limits. Your keys are encrypted and never exposed to end users.
					</p>
				</div>

				<!-- OpenAI API Key -->
				<div class="space-y-2">
					<Label for="openai-key">OpenAI API Key</Label>
					<Input
						id="openai-key"
						v-model="apiKeys.openai"
						type="password"
						placeholder="sk-..."
						class="font-mono"
					/>
					<p class="text-xs text-muted-foreground">
						Powers GPT models for your agents. Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" class="text-blue-600 hover:underline">platform.openai.com</a>
					</p>
				</div>

				<!-- Anthropic API Key -->
				<div class="space-y-2">
					<Label for="anthropic-key">Anthropic API Key</Label>
					<Input
						id="anthropic-key"
						v-model="apiKeys.anthropic"
						type="password"
						placeholder="sk-ant-..."
						class="font-mono"
					/>
					<p class="text-xs text-muted-foreground">
						Powers Claude models for advanced AI capabilities. Get your key from <a href="https://console.anthropic.com" target="_blank" class="text-blue-600 hover:underline">console.anthropic.com</a>
					</p>
				</div>

				<!-- ElevenLabs API Key -->
				<div class="space-y-2">
					<Label for="elevenlabs-key">ElevenLabs API Key</Label>
					<Input
						id="elevenlabs-key"
						v-model="apiKeys.elevenlabs"
						type="password"
						placeholder="..."
						class="font-mono"
					/>
					<p class="text-xs text-muted-foreground">
						Enables text-to-speech functionality. Get your key from <a href="https://elevenlabs.io" target="_blank" class="text-blue-600 hover:underline">elevenlabs.io</a>
					</p>
				</div>

				<!-- Google API Key -->
				<div class="space-y-2">
					<Label for="google-key">Google API Key</Label>
					<Input
						id="google-key"
						v-model="apiKeys.google"
						type="password"
						placeholder="AIza..."
						class="font-mono"
					/>
					<p class="text-xs text-muted-foreground">
						Powers Google AI services like Gemini. Get your key from <a href="https://makersuite.google.com/app/apikey" target="_blank" class="text-blue-600 hover:underline">Google AI Studio</a>
					</p>
				</div>

				<!-- Replicate API Key -->
				<div class="space-y-2">
					<Label for="replicate-key">Replicate API Key</Label>
					<Input
						id="replicate-key"
						v-model="apiKeys.replicate"
						type="password"
						placeholder="r8_..."
						class="font-mono"
					/>
					<p class="text-xs text-muted-foreground">
						Access to various AI models for image generation and more. Get your key from <a href="https://replicate.com/account/api-tokens" target="_blank" class="text-blue-600 hover:underline">replicate.com</a>
					</p>
				</div>

				<!-- Hugging Face API Key -->
				<div class="space-y-2">
					<Label for="huggingface-key">Hugging Face API Key</Label>
					<Input
						id="huggingface-key"
						v-model="apiKeys.huggingface"
						type="password"
						placeholder="hf_..."
						class="font-mono"
					/>
					<p class="text-xs text-muted-foreground">
						Access to open-source AI models. Get your key from <a href="https://huggingface.co/settings/tokens" target="_blank" class="text-blue-600 hover:underline">huggingface.co</a>
					</p>
				</div>
			</div>
		</SettingsCard>
	</div>
</template>