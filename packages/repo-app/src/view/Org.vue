<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useOrgStore } from "@/store/orgStore";
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
} from "lucide-vue-next";
import PrettyTabs from "@/components/pushmd/PrettyTabs.vue";
import E404 from "@/components/E404.vue";

// Get store and route information
const orgStore = useOrgStore();
const route = useRoute();
const router = useRouter();
const orgId = computed(() => route.params.orgId);

// Tabs data with full formed URLs
const tabs = computed(() => [
	{
		id: "overview",
		name: "Overview",
		path: `/${orgId.value}`,
	},
	{
		id: "chat",
		name: "Chat",
		path: `/${orgId.value}/~/chat`,
	},
	{
		id: "webhooks",
		name: "Webhook Events",
		path: `/${orgId.value}/~/webhooks`,
	},
	{
		id: "settings",
		name: "Settings",
		path: `/${orgId.value}/~/settings`,
	},
	{
		id: "slack",
		name: "Slack",
		path: `/${orgId.value}/~/integrations/slack`,
	},
	// Uncomment and adjust these as needed
	// {
	//   id: "integrations",
	//   name: "Integrations",
	//   path: `/${orgId.value}/~/integrations`
	// },
	// {
	//   id: "activity",
	//   name: "Activity",
	//   path: `/${orgId.value}/~/activity`
	// },
	// {
	//   id: "usage",
	//   name: "Usage",
	//   path: `/${orgId.value}/~/usage`
	// },
]);

// UI state
const searchQuery = ref("");
const isGridView = ref(true);
const sortOption = ref("activity");
const loading = computed(
	() => orgStore.orgsLoading || orgStore.projectsLoading || orgStore.orgLoading,
);

// Get projects from the store for the current organization
const projects = computed(() => orgStore.currentOrgProjects);

// Get the current organization
const currentOrg = computed(() => orgStore.currentOrg);

// Handle tab change
const handleTabChange = (tabId) => {
	console.log(`Tab changed to: ${tabId}`);
};

// Track if we've fetched data for the current org
const hasFetchedCurrentOrg = ref(false);

// Load organization data
const loadOrgData = async (id) => {
	if (!id) return;

	try {
		// Reset the fetch tracking when org changes
		hasFetchedCurrentOrg.value = false;

		// Fetch org details if not already loaded or if the ID doesn't match
		if (!orgStore.currentOrg || orgStore.currentOrg._id !== id) {
			await orgStore.fetchOrgById(id);
		}

		// Only fetch projects if organization exists and projects are not already loaded
		if (
			orgStore.currentOrg && 
			!orgStore.loadedOrgProjects.has(id) &&
			!orgStore.failedOrgProjects.has(id)
		) {
			await orgStore.fetchProjects(id);
		}

		hasFetchedCurrentOrg.value = true;
		// Log the state after fetching to help with debugging
		console.log("Org fetch complete:", {
			orgId: id,
			currentOrg: orgStore.currentOrg, 
			hasFetchedCurrentOrg: hasFetchedCurrentOrg.value
		});
	} catch (error) {
		console.error("Error loading org data:", error);
		hasFetchedCurrentOrg.value = true; // Still mark as fetched even on error
	}
};

// Watch for route changes to load new org data
watch(
	orgId,
	(newOrgId, oldOrgId) => {
		if (newOrgId && newOrgId !== oldOrgId) {
			loadOrgData(newOrgId);
		}
	},
	{ immediate: true },
);

// Load data when component mounts
onMounted(async () => {
	// Load all organizations to populate the store only if needed
	if (orgStore.orgs.length === 0) {
		await orgStore.fetchOrgs();
	}
});
</script>

<style>
/* Hide the breadcrumb when showing org not found page */
.org-not-found {
  position: relative;
  z-index: 9999; /* Ensure it's above other elements */
}

/* This targets the AppNavbar's ProjectBread component */
body:has(.org-not-found) header [class*='ProjectBread'] {
  display: none !important;
}
</style>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <!-- Loading state -->
    <div v-if="loading && !hasFetchedCurrentOrg" class="p-8 text-center">
      <p class="text-muted-foreground">Loading organization data...</p>
    </div>

    <!-- 404 state for non-existent or inaccessible orgs - Hides the org ID from breadcrumb via router -->
    <div v-else-if="!currentOrg && hasFetchedCurrentOrg" class="org-not-found">
      <E404 
        title="Organization not found" 
        description="The organization you're looking for does not exist or you don't have access to it." 
      />
    </div>

    <!-- Normal state when organization exists -->
    <template v-else>
      <!-- Navigation using PrettyTabs component - no orgId prop needed anymore -->
      <PrettyTabs :tabs="tabs" @tab-change="handleTabChange" />

      <!-- Main content -->
      <div class="bg-slate-100" style="min-height: 60vh">
        <router-view :key="$route.path" />
      </div>
    </template>
  </div>
</template>