<script setup>
import { ref, watch } from "vue";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

// Form data
const imageSizes = ref({
	xs: false,
	sm: false,
	lg: true,
	xl: false,
	"2xl": false
});
const imageFormats = ref({
	jpg: true,
	webp: false
});
const enableYoutubeEmbeds = ref(false);
const enableAudioPlayer = ref(false);
const codeBlockRender = ref("css");
const codeBlockTheme = ref("light");
const mermaidRender = ref("svg");
const mermaidTheme = ref("light");
const isSaving = ref(false);

// Initialize form data from props
const initializeFormData = () => {
	if (props.project?.media) {
		if (props.project.media.imageSizes) {
			imageSizes.value = { ...imageSizes.value, ...props.project.media.imageSizes };
		}
		if (props.project.media.imageFormats) {
			imageFormats.value = { ...imageFormats.value, ...props.project.media.imageFormats };
		}
		enableYoutubeEmbeds.value = props.project.media.enableYoutubeEmbeds || false;
		enableAudioPlayer.value = props.project.media.enableAudioPlayer || false;
		codeBlockRender.value = props.project.media.codeBlockRender || "css";
		codeBlockTheme.value = props.project.media.codeBlockTheme || "light";
		mermaidRender.value = props.project.media.mermaidRender || "svg";
		mermaidTheme.value = props.project.media.mermaidTheme || "light";
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
			media: {
				imageSizes: imageSizes.value,
				imageFormats: imageFormats.value,
				enableYoutubeEmbeds: enableYoutubeEmbeds.value,
				enableAudioPlayer: enableAudioPlayer.value,
				codeBlockRender: codeBlockRender.value,
				codeBlockTheme: codeBlockTheme.value,
				mermaidRender: mermaidRender.value,
				mermaidTheme: mermaidTheme.value
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
			title="Media Settings"
			subtitle="Configure image sizes, formats, and media embed options for your project."
		/>

		<!-- Images Card -->
		<SettingsCard
			title="Images"
			description="Configure how images are processed and stored in your project."
			:isSaving="isSaving"
			@save="saveSettings"
		>
			<!-- Image Sizes -->
			<div class="mb-6">
				<h3 class="text-md font-medium mb-3"> Sizes</h3>
				<p class="text-sm text-muted-foreground mb-4">
					Select which image sizes should be generated for your project.
				</p>

				<div class="grid grid-cols-2 md:grid-cols-5 gap-4">
					<div v-for="(checked, size) in imageSizes" :key="size" class="flex items-center space-x-2">
						<Checkbox :id="`size-${size}`" v-model:checked="imageSizes[size]" />
						<label :for="`size-${size}`" class="text-sm font-medium">{{ size }}</label>
					</div>
				</div>
			</div>

			<!-- Image Formats -->
			<div>
				<h3 class="text-md font-medium mb-3"> Formats</h3>
				<p class="text-sm text-muted-foreground mb-4">
					Select which image formats should be supported.
				</p>

				<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
					<div v-for="(checked, format) in imageFormats" :key="format" class="flex items-center space-x-2">
						<Checkbox :id="`format-${format}`" v-model:checked="imageFormats[format]" />
						<label :for="`format-${format}`" class="text-sm font-medium">{{ format }}</label>
					</div>
				</div>
			</div>
		</SettingsCard>

		<!-- Video & Audio Card -->
		<SettingsCard
			title="Video & Audio"
			description="Configure embedded media players and audio options."
			:isSaving="isSaving"
			@save="saveSettings"
			more="/docs/media-embedding"
			moreText="media embedding"
		>
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="font-medium">YouTube Embeds</p>
						<p class="text-sm text-muted-foreground">
							Allow embedding YouTube videos in your content
						</p>
					</div>
					<Switch
						id="youtube-embeds"
						v-model:checked="enableYoutubeEmbeds"
					/>
				</div>

				<div class="flex items-center justify-between">
					<div>
						<p class="font-medium">Audio Player <span class="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Experimental</span></p>
						<p class="text-sm text-muted-foreground">
							Enable audio player for audio files
						</p>
					</div>
					<Switch
						id="audio-player"
						v-model:checked="enableAudioPlayer"
					/>
				</div>
			</div>
		</SettingsCard>

		<!-- Code Blocks Settings -->
		<SettingsCard
			title="Code Blocks"
			description="Configure how code blocks are rendered on your site."
			:isSaving="isSaving"
			@save="saveSettings"
		>
			<div class="space-y-6">
				<div class="space-y-3">
					<Label>Rendering Method</Label>
					<RadioGroup v-model="codeBlockRender">
						<div class="flex items-center space-x-2">
							<RadioGroupItem value="css" id="code-css" />
							<Label for="code-css" class="font-normal cursor-pointer">
								CSS (Default)
								<span class="text-sm text-muted-foreground block">Faster rendering with native styling</span>
							</Label>
						</div>
						<div class="flex items-center space-x-2 mt-2">
							<RadioGroupItem value="iframe" id="code-iframe" />
							<Label for="code-iframe" class="font-normal cursor-pointer">
								iFrame
								<span class="text-sm text-muted-foreground block">Isolated rendering with copy button</span>
							</Label>
						</div>
					</RadioGroup>
				</div>

				<div class="space-y-3">
					<Label>Theme</Label>
					<RadioGroup v-model="codeBlockTheme">
						<div class="flex items-center space-x-2">
							<RadioGroupItem value="light" id="code-light" />
							<Label for="code-light" class="font-normal cursor-pointer">Light</Label>
						</div>
						<div class="flex items-center space-x-2 mt-2">
							<RadioGroupItem value="dark" id="code-dark" />
							<Label for="code-dark" class="font-normal cursor-pointer">Dark</Label>
						</div>
					</RadioGroup>
				</div>
			</div>
		</SettingsCard>

		<!-- Diagrams (Mermaid) Settings -->
		<SettingsCard
			title="Diagrams"
			description="Configure how Mermaid diagrams are rendered on your site."
			:isSaving="isSaving"
			@save="saveSettings"
		>
			<div class="space-y-6">
				<div class="space-y-3">
					<Label>Rendering Method</Label>
					<RadioGroup v-model="mermaidRender">
						<div class="flex items-center space-x-2">
							<RadioGroupItem value="svg" id="mermaid-svg" />
							<Label for="mermaid-svg" class="font-normal cursor-pointer">
								SVG (Default)
								<span class="text-sm text-muted-foreground block">Vector graphics with best quality</span>
							</Label>
						</div>
						<div class="flex items-center space-x-2 mt-2">
							<RadioGroupItem value="iframe" id="mermaid-iframe" />
							<Label for="mermaid-iframe" class="font-normal cursor-pointer">
								iFrame
								<span class="text-sm text-muted-foreground block">Isolated rendering environment</span>
							</Label>
						</div>
						<div class="flex items-center space-x-2 mt-2">
							<RadioGroupItem value="keep-as-code" id="mermaid-code" />
							<Label for="mermaid-code" class="font-normal cursor-pointer">
								Keep as Code Block
								<span class="text-sm text-muted-foreground block">Display as plain code without rendering</span>
							</Label>
						</div>
					</RadioGroup>
				</div>

				<div class="space-y-3">
					<Label>Theme</Label>
					<RadioGroup v-model="mermaidTheme">
						<div class="flex items-center space-x-2">
							<RadioGroupItem value="light" id="mermaid-light" />
							<Label for="mermaid-light" class="font-normal cursor-pointer">Light</Label>
						</div>
						<div class="flex items-center space-x-2 mt-2">
							<RadioGroupItem value="dark" id="mermaid-dark" />
							<Label for="mermaid-dark" class="font-normal cursor-pointer">Dark</Label>
						</div>
					</RadioGroup>
				</div>
			</div>
		</SettingsCard>
	</div>
</template>