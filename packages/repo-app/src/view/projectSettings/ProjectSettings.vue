<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useOrgStore } from "@/store/orgStore";
import {
	Search,
	CornerLeftUp,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeadingBar from "@/components/PageHeadingBar.vue";
import { navSections } from "./navigationConfig";

// Props for project data passed from parent
const props = defineProps({
	project: {
		type: Object,
		default: null,
	},
});

// Get the organization store
const orgStore = useOrgStore();
const router = useRouter();
const route = useRoute();

// Current organization from store
const currentOrg = computed(() => orgStore.currentOrg);

// Active section based on current route - just use the last segment
const activeSection = computed(() => {
	const pathSegments = route.path.split('/');
	const lastSegment = pathSegments[pathSegments.length - 1];
	
	// If we're at the base settings path, default to 'general'
	return (lastSegment === 'settings' || lastSegment === '') ? 'general' : lastSegment;
});

// Get project name from project data
const projectName = computed(() => props.project?.name || "Project");

// Navigate to a section without scrolling
const navigateToSection = (sectionId) => {
	const path = `/${route.params.orgId}/${route.params.projectId}/settings/${sectionId}`;
	router.push(path).catch(() => {}); // catch navigation duplicates
};
</script>

<template>
	<PageHeadingBar title="Project Settings">
		<template #secondary>
			<div>
				<router-link :to="currentOrg && currentOrg.handle ? `/${currentOrg.handle}/~/settings` : '/settings'">
					<Button class="flex items-center" size="sm" variant="ghost">
						<CornerLeftUp class="w-4 h-4 mr-2" />
						Go to Team settings
					</Button>
				</router-link>
			</div>
		</template>
	</PageHeadingBar>

	<div class="container" v-if="project">
		<div class="flex">
			<!-- Sidebar navigation -->
			<aside class="w-64 flex-shrink-0 border-r">
				<div class="sticky top-32 max-h-[calc(100vh-8rem)] overflow-y-auto">
					<div class="p-4">
					<div class="relative mb-6">
						<Search
							class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4"
						/>
						<Input placeholder="Search..." class="pl-10 w-full text-sm" />
					</div>

					<div class="space-y-1">
						<div class="flex items-center p-2 mb-4">
							<div
								class="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs mr-2"
							>
								{{ projectName.charAt(0) || "P" }}
							</div>
							<span class="font-medium text-sm">{{
								projectName
							}}</span>
						</div>

						<button
							v-for="section in navSections"
							:key="section.id"
							class="flex items-center w-full p-2 rounded-md text-sm transition-colors text-left"
							:class="
								activeSection === section.id
									? 'bg-background text-foreground font-medium'
									: 'hover:bg-accent hover:text-accent-foreground'
							"
							@click="navigateToSection(section.id)"
						>
							<component :is="section.icon" class="h-4 w-4 mr-2" />
							{{ section.name }}
						</button>
					</div>
					</div>
				</div>
			</aside>

			<!-- Content area -->
			<main class="flex-1 min-w-0 p-6">
				<!-- Router view for child components -->
				<router-view :project="project" />
			</main>
		</div>
	</div>
</template>