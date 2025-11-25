<script setup>
import { ref, watch } from "vue";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
const parseFormulas = ref(false);
const removeDeadLinks = ref(true);
const syntaxHighlighting = ref(true);
const pageLinkPrefix = ref("");
const mediaPrefix = ref("_repo/medias");
const isSaving = ref(false);

// Initialize form data from props
const initializeFormData = () => {
	if (props.project?.formatting) {
		parseFormulas.value = props.project.formatting.parseFormulas !== undefined ? props.project.formatting.parseFormulas : false;
		removeDeadLinks.value = props.project.formatting.removeDeadLinks !== undefined ? props.project.formatting.removeDeadLinks : true;
		syntaxHighlighting.value = props.project.formatting.syntaxHighlighting !== undefined ? props.project.formatting.syntaxHighlighting : true;
		pageLinkPrefix.value = props.project.formatting.pageLinkPrefix || "";
		mediaPrefix.value = props.project.formatting.mediaPrefix || "_repo/medias";
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
			formatting: {
				parseFormulas: parseFormulas.value,
				removeDeadLinks: removeDeadLinks.value,
				syntaxHighlighting: syntaxHighlighting.value,
				pageLinkPrefix: pageLinkPrefix.value,
				mediaPrefix: mediaPrefix.value
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
			title="Markdown Formatting"
			subtitle="Configure how markdown content is parsed and displayed in your project."
		/>

		<!-- Links & Paths Card -->
		<SettingsCard
			title="Links & Paths Configuration"
			description="Configure how links and media paths are structured in your project."
			:isSaving="isSaving"
			@save="saveSettings"
		>
			<div class="space-y-6">
				<div>
					<p class="font-medium mb-2">Page Link Prefix</p>
					<p class="text-sm text-muted-foreground mb-3">
						Add a prefix to all your page links. Can be empty, a relative path like "/blog", or a full URL like "https://blog.example.com/".
					</p>
					<Input
						v-model="pageLinkPrefix"
						placeholder="e.g., /blog or https://blog.example.com/"
					/>
					<p class="text-xs text-muted-foreground mt-1">
						This allows your content to be consumed from different domains or paths.
					</p>
				</div>

				<div>
					<p class="font-medium mb-2">Media Prefix</p>
					<p class="text-sm text-muted-foreground mb-3">
						Set the folder path for your optimized media files.
					</p>
					<Input
						v-model="mediaPrefix"
						placeholder="_repo/medias"
					/>
					<p class="text-xs text-muted-foreground mt-1">
						This magic folder will contain your optimized images with the selected sizes and formats.
						If you use content from different repo.md projects on the same domain, set a different prefix for each to properly routes assets.
					</p>
				</div>
			</div>
		</SettingsCard>

		<!-- Advanced Parsing Options Card -->
		<SettingsCard
			title="Advanced Parsing Options"
			description="Configure special markdown parsing features."
			:isSaving="isSaving"
			@save="saveSettings"
			more="/docs/markdown"
			moreText="markdown features"
		>
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="font-medium">Parse Formulas <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Pro</span></p>
						<p class="text-sm text-muted-foreground">
							Enable LaTeX-style formula parsing and rendering (e.g., $E=mc^2$)
						</p>
					</div>
					<Switch
						id="parse-formulas"
						v-model:checked="parseFormulas"
					/>
				</div>

				<div class="flex items-center justify-between">
					<div>
						<p class="font-medium">Remove Dead Links</p>
						<p class="text-sm text-muted-foreground">
							Automatically handle wiki-style links to pages that don't exist yet
						</p>
					</div>
					<Switch
						id="remove-dead-links"
						v-model:checked="removeDeadLinks"
					/>
				</div>

				<div class="flex items-center justify-between">
					<div>
						<p class="font-medium">Syntax Highlighting</p>
						<p class="text-sm text-muted-foreground">
							Enable syntax highlighting for code blocks
						</p>
					</div>
					<Switch
						id="syntax-highlighting"
						v-model:checked="syntaxHighlighting"
					/>
				</div>
			</div>
		</SettingsCard>
	</div>
</template>