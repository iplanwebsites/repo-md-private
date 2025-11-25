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

// Import orgStore
import { useOrgStore } from "@/store/orgStore";
const orgStore = useOrgStore();

// State
const repoName = ref("vite-react");
// Get git scope and team from orgStore
const gitScope = computed(() => orgStore.getGitScope);
const pushmdTeam = computed(() => orgStore.getUserTeam);
const selectedTemplate = ref(null);
const orgId = ref(""); // Default organization ID

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
</script>

<template>
  <div class="container">
    <div class="py-9 mb-3 text-center">
      <h1 class="font-bold text-5xl mb-3">Find your Template</h1>
      <p class="text-gray-600 text-lg">
        Jumpstart your content project with pre-built examples from Repo.md and
        our community.
      </p>
    </div>

    <!-- Template Selection -->
    <TemplateList :orgId="orgId" @template-selected="onTemplateSelected" />
  </div>
</template>
