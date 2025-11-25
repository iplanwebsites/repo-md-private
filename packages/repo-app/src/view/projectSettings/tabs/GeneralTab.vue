<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useOrgStore } from "@/store/orgStore";
import { useRouter, useRoute } from "vue-router";
import { ClipboardCopy, Trash2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	AlertDialog,
	AlertDialogTrigger,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogAction,
	AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import SettingsCard from "@/components/SettingsCard.vue";
import { useToast } from "@/components/ui/toast/use-toast";
import { copyToClipboard, saveProjectSettings } from "../utils";
import trpc from "@/trpc";

const props = defineProps({
	project: {
		type: Object,
		default: null,
	},
});

const orgStore = useOrgStore();
const router = useRouter();
const route = useRoute();
const { toast } = useToast();

// Current organization from store
const currentOrg = computed(() => orgStore.currentOrg);

// Form data
const projectName = ref("");
const projectHandle = ref("");
const projectId = ref("");
const projectDomainKey = ref("");
const isSaving = ref(false);
const saveError = ref(null);

// Delete project state
const isDeletingProject = ref(false);
const deleteProjectError = ref(null);

// Initialize form data from props
const initializeFormData = () => {
	if (props.project) {
		projectName.value = props.project?.name || "";
		projectHandle.value = props.project?.slug || "";
		projectId.value = props.project._id || "";
		projectDomainKey.value = props.project?.domainKey || "";
	}
};

// Watch for project changes
watch(() => props.project, () => {
	initializeFormData();
}, { immediate: true });

// Copy project ID to clipboard
const copyProjectId = () => {
	copyToClipboard(projectId.value, "Project ID");
};

// Save settings
const saveSettings = async () => {
	if (!projectId.value) {
		toast({
			title: "Error",
			description: "No project ID available",
			variant: "destructive",
		});
		return;
	}

	isSaving.value = true;
	saveError.value = null;

	try {
		const settings = {
			name: projectName.value,
			slug: projectHandle.value,
			domainKey: projectDomainKey.value,
		};

		await saveProjectSettings(projectId.value, settings);
		
		// Update the org store with new project data
		if (orgStore.currentOrg) {
			await orgStore.loadOrgProjects(orgStore.currentOrg._id);
		}
	} catch (error) {
		saveError.value = error.message || "Failed to save settings";
	} finally {
		isSaving.value = false;
	}
};

// Delete project
const deleteProject = async () => {
	if (!projectId.value) {
		deleteProjectError.value = "No project ID available";
		return;
	}

	isDeletingProject.value = true;
	deleteProjectError.value = null;

	try {
		const response = await trpc.projects.deleteProject.mutate({
			projectId: projectId.value,
		});

		if (response.success) {
			toast({
				title: "Project deleted",
				description: "The project has been deleted successfully.",
			});

			// Navigate to org home
			router.push(`/${currentOrg.value?.handle || route.params.orgId}`);
		} else {
			throw new Error(response.error || "Failed to delete project");
		}
	} catch (error) {
		console.error("Error deleting project:", error);
		deleteProjectError.value = error.message || "Failed to delete project";
		toast({
			title: "Error deleting project",
			description: error.message || "Failed to delete project. Please try again.",
			variant: "destructive",
		});
	} finally {
		isDeletingProject.value = false;
	}
};

onMounted(() => {
	initializeFormData();
});
</script>

<template>
	<div>
		<!-- Project ID Card -->
		<SettingsCard
			title="Project ID"
			description="Used when interacting with the API."
			:save="false"
		>
			<div class="flex items-center max-w-full">
				<Input v-model="projectId" disabled class="flex-1" />
				<Button variant="outline" class="ml-2" @click="copyProjectId">
					<ClipboardCopy class="h-4 w-4" />
				</Button>
			</div>
		</SettingsCard>

		<!-- Project URL Card -->
		<SettingsCard
			title="Project URL"
			description="The URL slug for your project. This defines how your project will be accessed."
			:isSaving="isSaving"
			@save="saveSettings"
			more="/docs/project-urls"
			moreText="project URLs"
		>
			<div class="flex items-center max-w-full">
				<span
					class="px-3 py-2 bg-muted border border-r-0 rounded-l-md text-muted-foreground text-sm"
				>
					repo.md/{{ currentOrg?.handle || 'orgname' }}/
				</span>
				<Input v-model="projectHandle" class="rounded-l-none" />
			</div>
			<div v-if="saveError" class="mt-2 text-sm text-red-500">{{ saveError }}</div>
		</SettingsCard>

		<!-- Domain Key Card -->
		<SettingsCard
			title="Project Domain Key"
			description="Custom identifier for domain configuration."
			:isSaving="isSaving"
			@save="saveSettings"
		>
			<div class="flex items-center max-w-full">
				<Input v-model="projectDomainKey" placeholder="Enter domain key" />
			</div>
			<p class="text-xs text-muted-foreground mt-2">
				Used for custom domain configuration and routing.
			</p>
		</SettingsCard>

		<!-- Danger Zone Card -->
		<SettingsCard
			title="Danger Zone"
			description="Destructive actions that cannot be undone."
			:save="false"
		>
			<div class="border border-red-200 dark:border-red-900 rounded-md bg-red-50 dark:bg-red-950/30 p-4">
				<div class="flex justify-between items-center">
					<div>
						<p class="font-medium text-red-700 dark:text-red-400 mb-1">Delete Project</p>
						<p class="text-sm text-red-600 dark:text-red-300">
							Once you delete a project, there is no going back. This action cannot be undone.
						</p>
					</div>

					<AlertDialog>
						<AlertDialogTrigger as-child>
							<Button variant="destructive" class="flex items-center" :disabled="isDeletingProject">
								<Trash2 class="h-4 w-4 mr-2" />
								Delete Project
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
								<AlertDialogDescription>
									This action cannot be undone. This will permanently delete the
									<span class="font-medium">{{ projectName }}</span> project and all of its data.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction
									@click="deleteProject"
									class="bg-red-600 hover:bg-red-700 text-white"
								>
									Delete Project
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
				<div v-if="deleteProjectError" class="mt-2 text-sm text-red-600">{{ deleteProjectError }}</div>
			</div>
		</SettingsCard>
	</div>
</template>