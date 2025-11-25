<script setup>
import { ref, computed, watch, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDeploymentStatus } from "@/store/deploymentStore";
import PrettyTabs from "@/components/pushmd/PrettyTabs.vue";
import trpc from "@/trpc";
import { RepoMD } from "@repo-md/client";
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
	Loader,
} from "lucide-vue-next";

// Base tabs data
const baseTabs = [
	{ id: "deploy", name: "Deployment", path: "" },
	// { id: "deployments", name: "Deployments", path: "/deployments" },

	// { id: "notes", name: "Notes", path: "/notes" },
	{ id: "posts", name: "Posts", path: "/posts" },
	{ id: "medias", name: "Medias", path: "/medias" },
	{ id: "graph", name: "Graph", path: "/graph" },
	{ id: "sqlite", name: "SQLite", path: "/sqlite" },
	{ id: "spec", name: "Spec", path: "/spec" },
	{ id: "source", name: "Source", path: "/source" },
	{ id: "logs", name: "Logs", path: "/logs" },
	{ id: "issues", name: "Issues", path: "/issues" },

	//{ id: "site", name: "Site", path: "/site" },
	//{ id: "mcp", name: "MCP", path: "/mcp" },
	//{ id: "api", name: "API", path: "/api" },
	//{ id: "settings", name: "Settings", path: "/settings" },
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

// Data state and loading state
const isLoading = ref(false);
const error = ref(null);
const project = ref(null);

// Current deployment data
const currentDeployment = ref({
	id: "",
	name: "Deployment Details",
	created: {
		by: "...",
		time: "...",
	},
	status: "Loading",
	statusLabel: "",
	duration: {
		value: "...",
		time: "...",
	},
	environment: {
		type: "...",
		label: "...",
	},
	domains: [{ url: "Loading domains...", additional: "" }],
	source: {
		branch: "...",
		commit: "...",
		commitType: "...",
	},
	repoUrl: "",
	scores: {
		performance: 0,
		security: 0,
		accessibility: 0,
	},
	configuration: {
		fluidCompute: false,
		deploymentProtection: false,
		skewProtection: false,
	},
	buildLogs: {
		duration: "...",
	},
	summary: {
		all: "All",
		count: "...",
		duration: "...",
	},
	customDomains: {
		duration: "...",
	},
	runtimeLogs: {
		description: "View and debug runtime logs & errors",
	},
	observability: {
		description: "Monitor app health & performance",
	},
	webAnalytics: {
		enabled: false,
		description: "Analyze visitors & traffic in real-time",
	},
	speedInsights: {
		enabled: false,
		description: "Performance metrics from real users",
	},
});

// RepoMD client instance
const repoClient = computed(() => {
	// Use the deployment data for projectId when available - wait for successful data fetch
	const projectIdentifier = currentDeployment.value?.projectId;
	const orgIdentifier = orgId.value;
	const revisionId = deployId.value;

	if (projectIdentifier && orgIdentifier && revisionId) {
		console.log(`Initializing RepoMD client with projectId: ${projectIdentifier}, orgSlug: ${orgIdentifier}, rev: ${revisionId}`);
		return new RepoMD({
			projectId: projectIdentifier,
			orgSlug: orgIdentifier,
			rev: revisionId,
			debug: true,
		});
	}
	return null;
});

// Toggle deploy config
const toggleDeployConfig = () => {
	showDeployConfig.value = !showDeployConfig.value;
};

// Route information
const route = useRoute();
const router = useRouter();
const projectId = computed(() => route.params.projectId);
const orgId = computed(() => route.params.orgId);
const deployId = computed(() => route.params.deployId);
currentDeployment.value.id = deployId.value;

// Computed tabs with fully formed paths including orgId and projectId
const tabs = computed(() => {
	return baseTabs.map((tab) => ({
		...tab,
		// Create a complete path for each tab, including the root path case
		path:
			tab.path === ""
				? `/${orgId.value}/${projectId.value}/${deployId.value}`
				: `/${orgId.value}/${projectId.value}/${deployId.value}${tab.path}`,
	}));
});

// Fetch project data
const fetchProjectData = async () => {
	if (!projectId.value || !orgId.value) return;
	
	try {
		const response = await trpc.projects.getProjectByHandle.query({
			projectHandle: projectId.value,
			orgId: orgId.value,
		});

		if (response.success) {
			project.value = response.project;
			console.log("Project data loaded:", project.value);
			
			// Update repoUrl in deployment data if available
			if (project.value?.github?.fullName) {
				currentDeployment.value.repoUrl = `https://github.com/${project.value.github.fullName}`;
			}
		} else {
			console.error("Failed to load project:", response.error);
		}
	} catch (err) {
		console.error("Error fetching project data:", err);
	}
};

// Fetch deployment data
const fetchDeploymentData = async () => {
	isLoading.value = true;
	error.value = null;

	try {
		// Fetch deployment data from API
		const deploymentData = await trpc.cloudRun.getJob.query({
			jobId: deployId.value,
		});

		// If successful, update state with real data
		if (deploymentData) {
			console.log("Raw job data:", deploymentData);

			// Keep original data reference for debugging
			currentDeployment.value.rawData = deploymentData;

			// Map API data to our component data structure
			currentDeployment.value = {
				...currentDeployment.value,
				id: deploymentData._id || deployId.value,
				name: `Deployment ${deploymentData._id || deployId.value}`,
				created: {
					by: deploymentData.userId || "unknown",
					time: deploymentData.createdAt || "unknown",
				},
				status: deploymentData.status || "Unknown",
				statusLabel: "",
				duration: {
					value:
						deploymentData.completedAt && deploymentData.createdAt
							? new Date(deploymentData.completedAt) -
								new Date(deploymentData.createdAt) +
								"ms"
							: "n/a",
					time: deploymentData.completedAt || "n/a",
				},
				environment: {
					type: "Production",
					label: "",
				},
				domains: [{ url: "Deployment in progress...", additional: "" }],
				source: {
					branch: deploymentData.input?.branch || "unknown",
					commit: deploymentData.input?.commit || "unknown",
					commitType: "",
				},
				error: deploymentData.error || null,
				logs: deploymentData.logs || [],
				projectId: deploymentData.projectId,
				type: deploymentData.type,
				updatedAt: deploymentData.updatedAt,
				rawData: deploymentData,
			};
			
			// After getting deployment data, fetch project data
			await fetchProjectData();
		}
	} catch (err) {
		console.error("Error fetching deployment data:", err);
		error.value = err.message || "Failed to load deployment data";
	} finally {
		isLoading.value = false;
	}
};

// Handle tab change
const handleTabChange = (tabId) => {
	console.log(`Project tab changed to: ${tabId}`);
};

// Watch for changes in route parameters to re-fetch data
watch([projectId, orgId, deployId], ([newProjectId, newOrgId, newDeployId], [oldProjectId, oldOrgId, oldDeployId]) => {
	console.log(`Route params changed: projectId: ${oldProjectId} -> ${newProjectId}, orgId: ${oldOrgId} -> ${newOrgId}, deployId: ${oldDeployId} -> ${newDeployId}`);
	fetchDeploymentData();
}, { immediate: true });

// Add computed property to check if data is ready to display
const isDataReady = computed(() => {
	const hasRepoClient = !!repoClient.value;
	const hasProjectId = !!currentDeployment.value?.projectId;
	const isStillLoading = isLoading.value;

	return hasRepoClient && hasProjectId && !isStillLoading;
});

// Use deployment status store
const { setDeploymentStatus, clearDeploymentStatus } = useDeploymentStatus();

// Watch for deployment status changes and update the store
watch(() => currentDeployment.value?.status, (newStatus) => {
	if (newStatus) {
		setDeploymentStatus(newStatus);
	}
});

// Clear deployment status when component is unmounted
onUnmounted(() => {
	clearDeploymentStatus();
});

// Watch for changes in deployment data that affect the RepoMD client
watch(() => currentDeployment.value?.projectId, (newProjectId, oldProjectId) => {
	if (newProjectId && newProjectId !== oldProjectId) {
		console.log(`Deployment projectId changed: ${oldProjectId} -> ${newProjectId}`);
	}
});
</script>

<template>
  <div class="min-h-screen">
    <!-- Navigation with updated PrettyTabs component - no orgId prop needed -->
    <PrettyTabs :tabs="tabs" @tab-change="handleTabChange" :sticky="true" />

    <!-- Global loading error -->
    <div v-if="error" class="container mt-4">
      <div
        class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
      >
        <strong class="font-bold">Error!</strong>
        <span class="block sm:inline"> {{ error }}</span>
      </div>
    </div>

    <!-- Global loading indicator -->
    <div
      v-if="isLoading && !currentDeployment"
      class="flex items-center justify-center h-32 mt-4"
    >
      <Loader class="h-8 w-8 animate-spin text-primary" />
      <span class="ml-2">Loading deployment data...</span>
    </div>

    <!-- Main content -->
    <div class="bg-slate-100" style="min-height: 60vh">
      <!-- Show loading spinner while data is being fetched or RepoMD client isn't ready -->
      <div
        v-if="!isDataReady"
        class="flex items-center justify-center h-64 w-full"
      >
        <div class="flex flex-col items-center">
          <Loader class="h-12 w-12 animate-spin text-primary mb-4" />
          <span class="text-gray-600">Loading deployment data...</span>
        </div>
      </div>

      <!-- Only show child routes when RepoMD is initialized and deployment data is loaded -->
      <router-view
        v-else
        :key="$route.fullPath"
        :deployment="currentDeployment"
        :isLoading="isLoading"
        :error="error"
        :repoClient="repoClient"
        :project="project"
        @refresh="fetchDeploymentData"
      />
    </div>
  </div>
</template>

<style scoped>
/* Add any additional component-specific styles here */
</style>
