<script setup>
import { ref, computed, watch } from "vue";
import { useThemeStore } from "@/store/themeStore";
import { Sun, Moon, MonitorSmartphone, ExternalLink } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import SettingsCard from "@/components/SettingsCard.vue";
import SettingsHeading from "@/components/SettingsHeading.vue";
import { saveProjectSettings } from "../utils";

const props = defineProps({
	project: {
		type: Object,
		default: null,
	},
});

const themeStore = useThemeStore();

// Form data
const selectedThemeId = ref("simple-blog-remix");
const siteName = ref("");
const footerText = ref("");
const preferredColorScheme = ref("auto");
const isSaving = ref(false);

// Get available themes from store
const themes = computed(() => themeStore.getAllThemes);

// Initialize form data from props
const initializeFormData = () => {
	if (props.project?.theme) {
		selectedThemeId.value = props.project.theme.themeId || "simple-blog-remix";
		siteName.value = props.project.theme.siteName || "";
		footerText.value = props.project.theme.footerText || "";
		preferredColorScheme.value = props.project.theme.preferredColorScheme || "auto";
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
			theme: {
				themeId: selectedThemeId.value,
				siteName: siteName.value,
				footerText: footerText.value,
				preferredColorScheme: preferredColorScheme.value,
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
			title="Site Theme Settings"
			subtitle="Configure theme, content, and appearance preferences for your project."
		>
			<Button
				variant="outline"
				to="/themes"
				size="sm"
				class="flex items-center"
			>
				View site
				<ExternalLink class="h-4 w-4 ml-2" />
			</Button>
		</SettingsHeading>

		<!-- Theme Selection Card -->
		<SettingsCard
			title="Theme Selection"
			description="Choose a theme for your website."
			:isSaving="isSaving"
			@save="saveSettings"
			more="/themes"
			moreText="available themes"
		>
			<Select v-model="selectedThemeId">
				<SelectTrigger class="w-full">
					<SelectValue placeholder="Select a theme" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem v-for="theme in themes" :key="theme.id" :value="theme.id">
						{{ theme.name }}
					</SelectItem>
				</SelectContent>
			</Select>

			<div v-if="selectedThemeId" class="mt-4 p-4 bg-muted rounded-md">
				<div class="flex items-center gap-3">
					<div class="w-16 h-16 bg-background rounded overflow-hidden">
						<img
							:src="themes.find(t => t.id === selectedThemeId)?.image || '/placeholder.svg'"
							alt="Theme preview"
							class="w-full h-full object-cover"
						/>
					</div>
					<div>
						<h4 class="font-medium">{{ themes.find(t => t.id === selectedThemeId)?.name }}</h4>
						<p class="text-sm text-muted-foreground">
							{{ themes.find(t => t.id === selectedThemeId)?.description }}
						</p>
					</div>
				</div>
			</div>
		</SettingsCard>

		<!-- Content Settings Card -->
		<SettingsCard
			title="Content Settings"
			description="Configure site name and footer content."
			:isSaving="isSaving"
			@save="saveSettings"
		>
			<div class="space-y-6">
				<!-- Site Name -->
				<div>
					<h3 class="text-md font-medium mb-2">Site Name</h3>
					<p class="text-sm text-muted-foreground mb-3">
						Enter the name of your site as it will appear in the header and title.
					</p>
					<Input v-model="siteName" placeholder="My Awesome Site" />
				</div>

				<!-- Footer Text -->
				<div>
					<h3 class="text-md font-medium mb-2">Footer Text</h3>
					<p class="text-sm text-muted-foreground mb-3">
						Customize the text displayed in the footer of your site.
					</p>
					<Input v-model="footerText" placeholder="© 2025 My Company. All rights reserved." />
				</div>
			</div>
		</SettingsCard>

		<!-- Appearance Settings Card -->
		<SettingsCard
			title="Appearance Settings"
			description="Configure color scheme preferences."
			:isSaving="isSaving"
			@save="saveSettings"
		>
			<h3 class="text-md font-medium mb-3">Color Scheme</h3>
			<p class="text-sm text-muted-foreground mb-4">
				Choose your preferred color scheme for your site.
			</p>

			<RadioGroup v-model="preferredColorScheme" class="space-y-3">
				<div class="flex items-center space-x-2">
					<RadioGroupItem id="scheme-light" value="light" />
					<Label for="scheme-light" class="flex items-center">
						<Sun class="h-4 w-4 mr-2" />
						<span>Light</span>
					</Label>
				</div>

				<div class="flex items-center space-x-2">
					<RadioGroupItem id="scheme-dark" value="dark" />
					<Label for="scheme-dark" class="flex items-center">
						<Moon class="h-4 w-4 mr-2" />
						<span>Dark</span>
					</Label>
				</div>

				<div class="flex items-center space-x-2">
					<RadioGroupItem id="scheme-auto" value="auto" />
					<Label for="scheme-auto" class="flex items-center">
						<MonitorSmartphone class="h-4 w-4 mr-2" />
						<span>Auto (follow system preference)</span>
					</Label>
				</div>
			</RadioGroup>
		</SettingsCard>
	</div>
</template>