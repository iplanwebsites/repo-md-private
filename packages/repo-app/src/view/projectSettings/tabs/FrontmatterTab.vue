<script setup>
import { ref, watch } from "vue";
import { FileText } from "lucide-vue-next";
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
const defaultPageVisibility = ref("public");
const isSaving = ref(false);

// Initialize form data from props
const initializeFormData = () => {
	if (props.project?.formatting) {
		defaultPageVisibility.value = props.project.formatting.defaultPageVisibility || "public";
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
				defaultPageVisibility: defaultPageVisibility.value
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
			title="Frontmatter Variables"
			subtitle="Configure default variables for frontmatter in markdown files."
		/>

		<!-- Page Visibility Card -->
		<SettingsCard
			title="Page Visibility"
			description="Set the default visibility for new pages created in your project."
			:isSaving="isSaving"
			@save="saveSettings"
		>
			<RadioGroup v-model="defaultPageVisibility" class="space-y-3">
				<div class="flex items-center space-x-2">
					<RadioGroupItem id="visibility-public" value="public" />
					<Label for="visibility-public" class="flex items-center">
						<span>Public</span>
						<span class="ml-2 text-xs text-muted-foreground">(Visible to everyone)</span>
					</Label>
				</div>

				<div class="flex items-center space-x-2">
					<RadioGroupItem id="visibility-private" value="private" />
					<Label for="visibility-private" class="flex items-center">
						<span>Private</span>
						<span class="ml-2 text-xs text-muted-foreground">(Visible only to authenticated users)</span>
					</Label>
				</div>

				<div class="flex items-center space-x-2">
					<RadioGroupItem id="visibility-hidden" value="hidden" />
					<Label for="visibility-hidden" class="flex items-center">
						<span>Hidden</span>
						<span class="ml-2 text-xs text-muted-foreground">(Not listed but accessible with direct link)</span>
					</Label>
				</div>
			</RadioGroup>
		</SettingsCard>

		<!-- Frontmatter Default Values Card -->
		<SettingsCard
			title="Frontmatter Default Values"
			description="Configure default variables for markdown frontmatter that will be applied to new pages."
			:isSaving="isSaving"
			@save="saveSettings"
			more="/docs/frontmatter"
			moreText="frontmatter variables"
		>
			<div class="p-4 bg-muted/50 rounded-md border text-sm text-muted-foreground flex items-center gap-3">
				<FileText class="h-5 w-5 text-muted-foreground/70" />
				<span>Frontmatter variables are key-value pairs at the top of markdown files that control page behavior and metadata. Common variables include title, date, author, and tags.</span>
			</div>
		</SettingsCard>
	</div>
</template>