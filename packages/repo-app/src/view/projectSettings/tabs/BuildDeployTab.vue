<script setup>
import { ref, watch } from "vue";
import { Server, Brain } from "lucide-vue-next";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { saveProjectSettings } from "../utils";

const props = defineProps({
	project: {
		type: Object,
		default: null,
	},
});

// Form data
const enableAutoDeployment = ref(true);
const repositoryFolder = ref("");
const ignoreFiles = ref("");
const isSaving = ref(false);

// Embeddings settings
const enableEmbeddings = ref(true);
const similarPostsCount = ref(10);

// Initialize form data from props
const initializeFormData = () => {
	if (props.project) {
		// Read from settings.build object (data is stored under project.settings)
		const buildSettings = props.project?.settings?.build || {};
		repositoryFolder.value = buildSettings.repositoryFolder || "";
		ignoreFiles.value = buildSettings.ignoreFiles || "";
		enableAutoDeployment.value = buildSettings.enableAutoDeployment !== undefined ? buildSettings.enableAutoDeployment : true;
		// Embeddings settings (skipEmbeddings is inverted to enableEmbeddings for better UX)
		enableEmbeddings.value = buildSettings.skipEmbeddings !== undefined ? !buildSettings.skipEmbeddings : true;
		similarPostsCount.value = buildSettings.similarPostsCount !== undefined ? buildSettings.similarPostsCount : 10;
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
			build: {
				repositoryFolder: repositoryFolder.value,
				ignoreFiles: ignoreFiles.value,
				enableAutoDeployment: enableAutoDeployment.value,
				// Store as skipEmbeddings (inverted from UI)
				skipEmbeddings: !enableEmbeddings.value,
				similarPostsCount: similarPostsCount.value
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
			title="Build and Deployment"
			subtitle="Configure how your project is built and deployed."
		/>

		<!-- Deploy Settings Card -->
		<SettingsCard
			title="Deployment Settings"
			description="Configure automatic deployment options."
			:isSaving="isSaving"
			@save="saveSettings"
		>
			<!-- Auto Deployment -->
			<div class="flex justify-between items-center mb-6">
				<div>
					<p class="font-medium">Auto Deployment</p>
					<p class="text-sm text-muted-foreground">
						Automatically deploy when changes are pushed to the production branch
					</p>
				</div>
				<Switch
					id="auto-deployment"
					v-model:checked="enableAutoDeployment"
				/>
			</div>

			<!-- Production Branch -->
			<div>
				<div class="flex justify-between items-center">
					<div>
						<p class="font-medium">Production Branch</p>
						<p class="text-sm text-muted-foreground">
							Select which branch deploys to production
						</p>
					</div>
					<div class="w-48">
						<Select>
							<SelectTrigger>
								<SelectValue placeholder="main" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="main">main</SelectItem>
								<SelectItem value="master">master</SelectItem>
								<SelectItem value="production">production</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>
		</SettingsCard>

		<!-- Repository Folder Card -->
		<SettingsCard
			title="Repository Folder"
			description="Specify a specific folder to use for markdown files and images (useful for monorepos)."
			:isSaving="isSaving"
			@save="saveSettings"
		>
			<div class="flex items-center max-w-full">
				<Input v-model="repositoryFolder" placeholder="docs/" />
			</div>
			<p class="text-xs text-muted-foreground mt-2">
				Leave empty to use the entire repository. Specify a folder path like "docs/" or "content/" to only process files from that directory.
			</p>
		</SettingsCard>

		<!-- Ignore Files Card -->
		<SettingsCard
			title="Ignore Files"
			description="Specify files and folders to ignore when processing your repository."
			:isSaving="isSaving"
			@save="saveSettings"
		>
			<Textarea
				v-model="ignoreFiles"
				placeholder="README.md&#10;.github/&#10;node_modules/&#10;*.log&#10;**/.DS_Store"
				class="min-h-32"
			/>
			<p class="text-xs text-muted-foreground mt-2">
				List files and folders to ignore, one per line. You can also create a <code>.repoignore</code> file directly in your repository for the same effect. Supports glob patterns like <code>*.log</code> and <code>**/.DS_Store</code>.
			</p>
		</SettingsCard>

		<!-- Embeddings Settings Card -->
		<SettingsCard
			title="AI & Embeddings"
			description="Configure AI-powered features like semantic search and similar content recommendations."
			:isSaving="isSaving"
			@save="saveSettings"
			more="/docs/embeddings"
			moreText="embeddings"
		>
			<div class="space-y-6">
				<!-- Enable Embeddings -->
				<div class="flex justify-between items-center">
					<div>
						<p class="font-medium">Generate Embeddings</p>
						<p class="text-sm text-muted-foreground">
							Enable AI-powered semantic search and similar content features. Disabling this speeds up builds but removes AI search capabilities.
						</p>
					</div>
					<Switch
						id="enable-embeddings"
						v-model:checked="enableEmbeddings"
					/>
				</div>

				<!-- Similar Posts Count -->
				<div v-if="enableEmbeddings" class="pl-6 border-l-2 border-l-muted">
					<div class="flex justify-between items-center">
						<div>
							<p class="font-medium">Similar Posts Count</p>
							<p class="text-sm text-muted-foreground">
								Number of similar posts to compute for each article (1-50)
							</p>
						</div>
						<div class="w-24">
							<Input
								v-model.number="similarPostsCount"
								type="number"
								min="1"
								max="50"
								placeholder="10"
							/>
						</div>
					</div>
				</div>

				<!-- Info when embeddings disabled -->
				<div v-if="!enableEmbeddings" class="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200 flex items-center gap-3">
					<Brain class="h-5 w-5 flex-shrink-0" />
					<span>With embeddings disabled, AI-powered search and "similar posts" features will not be available. Your content will still be searchable by keywords.</span>
				</div>
			</div>
		</SettingsCard>

		<!-- Build Settings Card -->
		<SettingsCard
			title="Build Configuration"
			description="Customize build options and optimizations."
			:isSaving="isSaving"
			@save="saveSettings"
			more="/docs/build-options"
			moreText="build options"
		>
			<div class="p-4 bg-muted/50 rounded-md border text-sm text-muted-foreground flex items-center gap-3">
				<Server class="h-5 w-5 text-muted-foreground/70" />
				<span>Build settings are automatically optimized based on your project configuration. Additional build options will be available in a future update.</span>
			</div>
		</SettingsCard>
	</div>
</template>