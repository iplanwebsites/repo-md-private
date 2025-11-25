<!-- Parent Component: NewProject.vue -->
<script setup>
import { ref, computed } from "vue";
import {
	ArrowRight,
	ChevronDown,
	Github,
	HelpCircle,
	ArrowRightLeft,
	ArrowLeft,
} from "lucide-vue-next";

// Import orgStore, onMounted, and trpc client
import { useOrgStore } from "@/store/orgStore";
import { onMounted } from "vue";
import trpc from "@/trpc";
const orgStore = useOrgStore();

// State
const repoName = ref("vite-react");
// Get git scope and team from orgStore
const gitScope = computed(() => orgStore.getGitScope);
const pushmdTeam = computed(() => orgStore.getUserTeam);
const selectedTemplate = ref(null);

//get from route
const route = useRoute();
const orgId = computed(() => route.params.orgId);

// Methods
/*
const createProject = () => {
  alert("TBD: Project creation functionality");
};


const importRepository = () => {
  window.location.href = "#import";
};

const browseTemplates = () => {
  const path = orgId.value ? `/new/${orgId.value}/templates` : "/new/templates";
  window.location.href = path;
};

const onTemplateSelected = (template) => {
  selectedTemplate.value = template;
  repoName.value = template.name.toLowerCase().replace(/\s+/g, "-");
};
*/
// Initialize GitHub data for namespaces on component mount
onMounted(async () => {
	// Load Repo.md organizations if not already loaded
	if (orgStore.orgs.length === 0) {
		await orgStore.fetchOrgs();
	}

	// Initialize GitHub data to get namespaces if not already loaded
	if (orgStore.namespaces.length === 0) {
		try {
			// Check GitHub integration
			const integrationCheck = await trpc.github.checkIntegration.query();
			if (integrationCheck.isIntegrated) {
				await orgStore.initializeGitHubData();
			}
		} catch (error) {
			console.error("GitHub integration not available:", error);
			// This is non-critical, so we'll continue with default scopes
		}
	}
});
</script>

<template>
  <div class="container">
    <BackBt :to="'/new?org=' + orgId" title="   Back  " />

    <div class="py-9 mb-3">
      <h1 class="font-bold text-3xl">Select a template.</h1>
      <p>
        Jumpstart your content project with pre-built examples from Repo.md and
        our community.
      </p>
    </div>

    <!-- Template Selection -->
    <TemplateList :orgId="orgId" @template-selected="onTemplateSelected" />
  </div>
</template>
