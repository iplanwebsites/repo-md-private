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
const selectedTheme = ref(null);
const orgId = ref(""); // Default organization ID

// Methods
const onThemeSelected = (theme) => {
	selectedTheme.value = theme;
	repoName.value = theme.name.toLowerCase().replace(/\s+/g, "-");
};
</script>

<template>
  <div class="container">
    <div class="py-9 mb-3 text-center">
      <h1 class="font-bold text-5xl mb-3">Themes & Apps</h1>
      <p class="text-gray-600 text-lg">
        Build anything.

        <!-- Theme Selection -->
        These themes are just regular web apps. They connects to your content
        content and data.
        <br />
        Use them as-is, of vibe-customize them to fit your needs.

        <br />
      </p>
    </div>

    <!-- Theme Selection -->
    <ThemeList :orgId="orgId" @theme-selected="onThemeSelected" />
  </div>
</template>
