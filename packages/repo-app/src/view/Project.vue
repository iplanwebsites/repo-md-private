<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useOrgStore } from "@/store/orgStore";
import PrettyTabs from "@/components/pushmd/PrettyTabs.vue";
import E404 from "@/components/E404.vue";
import trpc from "@/trpc";
import {
	Search,
	ChevronDown,
	LayoutGrid,
	List,
	Github,
	GitBranch,
	MoreHorizontal,
	AlertCircle,
	Activity,
	ArrowRight,
	RotateCw,
} from "lucide-vue-next";

// Base tabs data
const baseTabs = [
	{ id: "project", name: "Project", path: "" },
	{ id: "chat", name: "Chat", path: "/chat" },
	{ id: "editor-agent", name: "Editor Agent", path: "/editor-agent" },
	{ id: "tasks", name: "Tasks", path: "/tasks" },
	{ id: "deployments", name: "Deployments", path: "/deployments" },
	{ id: "source", name: "Source Editor", path: "/source" },
	{ id: "code-editor", name: "Code Editor", path: "/code-editor" },
	{ id: "webhooks", name: "Webhook Events", path: "/webhooks" },
	// { id: "notes", name: "Notes", path: "/notes" },
	// { id: "medias", name: "Medias", path: "/medias" },
	{ id: "site", name: "Site", path: "/site" },
	{ id: "agent", name: "Agent", path: "/agent" },
//	{ id: "mcp", name: "MCP", path: "/mcp" },
//	{ id: "ai", name: "AI", path: "/ai" },
	{ id: "db", name: "Database", path: "/db" },
	{ id: "api", name: "API", path: "/api" },
	{ id: "settings", name: "Settings", path: "/settings" },
	/*
  { id: "analytics", name: "Analytics", path: "/analytics" },
  { id: "speed-insights", name: "Speed Insights", path: "/speed-insights" },
  { id: "logs", name: "Logs", path: "/logs" },
  { id: "observability", name: "Observability", path: "/observability" },
  { id: "firewall", name: "Firewall", path: "/firewall" },
  { id: "storage", name: "Storage", path: "/storage" },
  { id: "flags", name: "Flags", path: "/flags" },
  { id: "ai", name: "AI", path: "/ai" },
  */
];

// UI state
const searchQuery = ref("");
const isGridView = ref(true);
const sortOption = ref("activity");
const showDeployConfig = ref(false);
const isLoading = ref(false);
const error = ref(null);
const project = ref(null);

// Store and route information
const orgStore = useOrgStore();
const route = useRoute();
const router = useRouter();
const projectSlug = computed(() => route.params.projectId);
const orgHandle = computed(() => route.params.orgId);

// Toggle deploy config
const toggleDeployConfig = () => {
	showDeployConfig.value = !showDeployConfig.value;
};

// Computed tabs with fully formed paths including orgHandle and projectSlug
const tabs = computed(() => {
	return baseTabs.map((tab) => ({
		...tab,
		// Create a complete path for each tab, including the root path case
		path:
			tab.path === ""
				? `/${orgHandle.value}/${projectSlug.value}`
				: `/${orgHandle.value}/${projectSlug.value}${tab.path}`,
	}));
});

// Handle tab change
const handleTabChange = (tabId) => {
	console.log(`Project tab changed to: ${tabId}`);
};

// Fetch project data
const fetchProjectData = async () => {
	if (!orgHandle.value || !projectSlug.value) return;

	isLoading.value = true;
	error.value = null;

	try {
		// First make sure we have the org data
		const orgResult = await orgStore.fetchOrgById(orgHandle.value);
		
		// If organization doesn't exist, show error
		if (!orgStore.currentOrg) {
			throw new Error("Organization not found");
		}

		// Find project in the store if we already have it
		await orgStore.fetchProjects(orgHandle.value);

		const projectData = orgStore.currentOrgProjects.find(
			(p) => p.slug === projectSlug.value,
		);

		// If not found in store, fetch directly
		if (!projectData) {
			console.log(
				`Project ${projectSlug.value} not found in store, fetching directly`,
			);
			const response = await trpc.projects.getProjectByHandle.query({
				projectHandle: projectSlug.value,
				orgId: orgHandle.value,
			});

			if (response.success) {
				project.value = response.project;
			} else {
				throw new Error(response.error || "Project not found");
			}
		} else {
			project.value = projectData;
		}

		// If we still don't have a project, throw error
		if (!project.value) {
			throw new Error("Project not found");
		}

		console.log("Project data loaded:", project.value);
	} catch (err) {
		console.error("Error fetching project data:", err);
		error.value = err.message || "Project not found";
	} finally {
		isLoading.value = false;
	}
};

// Watch for route changes to reload project data if needed
watch(
	[orgHandle, projectSlug],
	() => {
		fetchProjectData();
	},
	{ immediate: false },
);

// Fetch data on component mount
onMounted(() => {
	fetchProjectData();
});
</script>

<template>

  <div class="min-h-screen">
    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center p-8">
      <div class="flex items-center gap-2">
        <RotateCw class="h-4 w-4 animate-spin" />
        <span>Loading project data...</span>
      </div>
    </div>

    <!-- Show 404 if project doesn't exist, without tabs -->
    <div v-else-if="error" class="project-not-found">
      <E404 
        title="Project not found" 
        description="The project you're looking for does not exist or you don't have access to it." 
      />
    </div>

    <!-- Normal state with tabs and content -->
    <template v-else>
      <!-- Navigation with updated PrettyTabs component - no orgId prop needed -->
      <PrettyTabs :tabs="tabs" @tab-change="handleTabChange" :sticky="true" />
      
      <!-- Main content -->
      <div class="bg-slate-100" style="min-height: 60vh">
        <router-view :key="$route.path" :project="project" v-if="project" />
      </div>
    </template>
  </div>
</template>

<style>
/* Hide the breadcrumb when showing project not found page */
.project-not-found {
  position: relative;
  z-index: 9999; /* Ensure it's above other elements */
}

/* This targets the AppNavbar's ProjectBread component */
body:has(.project-not-found) header [class*='ProjectBread'] {
  display: none !important;
}
</style>