<script setup>
import { ref, computed, onMounted, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
	ArrowRight,
	ChevronDown,
	Github,
	GitBranch,
	HelpCircle,
	ArrowRightLeft,
} from "lucide-vue-next";
import { useTemplateStore } from "@/store/templateStore";
import { useOrgStore } from "@/store/orgStore";
import trpc from "@/trpc";
import { useToast } from "@/components/ui/toast";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

// Initialize stores and utilities
const templateStore = useTemplateStore();
const orgStore = useOrgStore();
const route = useRoute();
const router = useRouter();
const { toast } = useToast();

// Track loading state for project creation
const creatingProject = ref(false);
const createError = ref(null);

// Get repository URL from the query parameter
const repoUrl = computed(() => route.query.repo || "");

// For repository-based projects
const repoInfo = computed(() => {
	if (!repoUrl.value) return null;

	try {
		const url = new URL(repoUrl.value);
		if (!url.hostname.includes("github.com")) {
			return { valid: false, error: "Only GitHub repositories are supported" };
		}

		const pathParts = url.pathname.split("/").filter(Boolean);
		if (pathParts.length < 2) {
			return { valid: false, error: "Invalid GitHub repository URL" };
		}

		return {
			valid: true,
			owner: pathParts[0],
			name: pathParts[1],
			branch:
				pathParts.length > 2 && pathParts[2] === "tree" ? pathParts[3] : "main",
			fullUrl: repoUrl.value,
		};
	} catch (error) {
		return { valid: false, error: "Invalid URL format" };
	}
});

// Generate repository name based on source
const repoName = ref("");
// RepoMd project name
const projectName = ref("");

// Update computed to watched ref so user can edit it
watchEffect(() => {
	if (repoInfo.value?.valid) {
		repoName.value = repoInfo.value.name;
		projectName.value = repoInfo.value.name;
	}
});

// Track loading state for git scopes
const gitScopesLoading = ref(false);

// Get git scope and team from orgStore
const gitScope = computed(() => orgStore.getGitScope);
const pushmdTeam = computed(() => orgStore.getUserTeam);
const availableGitScopes = computed(() => orgStore.getAvailableGitScopes);

// Enhanced createProject method
const createProject = async () => {
	if (creatingProject.value) return;

	creatingProject.value = true;
	createError.value = null;

	try {
		if (!repoInfo.value?.valid) {
			throw new Error("Invalid repository");
		}

		const cloneData = {
			owner: repoInfo.value.owner,
			repoName: repoInfo.value.name,
			branch: repoInfo.value.branch,
			isPrivate: true,
			//newRepoName: repoName.value,
			//  gitScope: gitScope.value,
			description: `Imported from ${repoInfo.value.fullUrl}`,
			orgId: pushmdTeam.value.handle,
			projectName: projectName.value,
			sourceUrl: repoUrl.value, // Adding the original repo URL from query parameter
		};

		console.log("Creating project from repository:", cloneData);

		// Validate the data before sending
		if (
			!cloneData.owner ||
			!cloneData.repoName ||
			//    !cloneData.newRepoName ||
			//  !cloneData.gitScope ||
			!cloneData.projectName
		) {
			throw new Error("Missing required fields for project creation");
		}

		console.log("REPo DATA :", cloneData);
		// Call the TRPC endpoint
		const response = await trpc.cloudRun.importGitHubRepo.mutate(cloneData);

		console.log("Project creation response:", response);

		if (response.success) {
			// Show success toast
			toast({
				title: "Repository Import Started",
				description: "Your project is being set up and will be ready shortly.",
				variant: "default",
			});

			// Redirect to the project page
			if (response.job && response.job.projectId) {
				// Wait a short moment to ensure the toast is visible before redirect
				setTimeout(() => {
					const redirectUrl =
						response.dashboardUrl || response.job.dashboardUrl;
					if (redirectUrl) router.push(redirectUrl);
				}, 1500);
			}
		}
	} catch (error) {
		console.error("Error creating project:", error);
		const errorMessage = error.message || "Failed to create project";
		createError.value = errorMessage;

		// Show error toast
		toast({
			title: "Import Failed",
			description: errorMessage,
			variant: "destructive",
		});
	} finally {
		creatingProject.value = false;
	}
};

const browseTemplates = () => {
	window.location.href = "/new/templates";
};

// Load templates and orgs on component mount
onMounted(async () => {
	gitScopesLoading.value = true;

	try {
		if (orgStore.orgs.length === 0) {
			await orgStore.fetchOrgs();
		}

		if (orgStore.namespaces.length === 0) {
			try {
				const integrationCheck = await trpc.github.checkIntegration.query();
				if (integrationCheck.isIntegrated) {
					await orgStore.initializeGitHubData();
				}
			} catch (error) {
				console.error("GitHub integration not available:", error);
			}
		}

		if (!orgStore.gitScope) {
			const scopes = orgStore.getAvailableGitScopes;
			if (scopes.length > 0) {
				orgStore.updateGitScope(scopes[0].value);
			} else if (orgStore.orgs.length > 0) {
				const firstOrg = orgStore.orgs[0];
				orgStore.updateGitScope(firstOrg.handle || firstOrg.name);
			}
		}
	} catch (error) {
		console.error("Error loading data:", error);
	} finally {
		gitScopesLoading.value = false;
	}
});
</script>

<template>
  <div
    class="bg-slate-100 min-h-screen text-foreground flex items-center justify-center"
  >
    <!-- Invalid repository -->
    <div v-if="!repoInfo || !repoInfo.valid" class="text-center p-8">
      <p class="text-destructive mb-4">
        {{ repoInfo?.error || "No repository specified" }}
      </p>
      <router-link to="/new" class="text-primary hover:underline">
        Go back to import options
      </router-link>
    </div>

    <!-- Main form -->
    <div v-else class="w-full max-w-2xl bg-card rounded-lg p-8 shadow-md">
      <h1 class="text-2xl font-bold mb-6">Import Repository</h1>

      <!-- Error display -->
      <div
        v-if="createError"
        class="bg-destructive/10 text-destructive p-4 rounded-md mb-6"
      >
        {{ createError }}
      </div>

      <!-- Repo Selection -->
      <div class="flex bg-muted p-4 rounded-md mb-6">
        <div class="w-32 h-24 flex-shrink-0 flex items-center justify-center">
          <Github size="48" class="text-muted-foreground" />
        </div>
        <div class="ml-4">
          <div class="flex items-center">
            <h2 class="font-medium">
              {{ repoInfo.owner }}/{{ repoInfo.name }}
              <span class="text-xs text-muted-foreground">↗</span>
            </h2>
          </div>
          <p class="text-sm text-muted-foreground mt-1">
            Repository from GitHub
          </p>

          <div class="mt-3 text-sm text-muted-foreground">
            <p>Importing from GitHub</p>
            <div class="flex items-center mt-1">
              <span class="mr-2">
                <Github size="16" class="text-muted-foreground" />
              </span>
              <span class="text-foreground">
                {{ repoInfo.owner }}/{{ repoInfo.name }}
              </span>

              <span class="mx-2">
                <ArrowRightLeft size="14" class="text-muted-foreground" />
              </span>

              <span class="text-foreground">
                {{ repoInfo.branch }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Repository Info -->
      <div class="mb-8">
        <p class="text-sm text-muted-foreground mb-4">
          To ensure you can easily update your project after deploying it, a Git
          repository must be created. Every push to that Git repository will be
          deployed automatically.
        </p>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <!-- Team column (first) -->
          <div>
            <label class="block text-sm text-muted-foreground mb-2"
              >Repo.md Team</label
            >
            <div
              class="flex items-center justify-between bg-muted border border-border rounded-md px-4 py-2 h-full"
            >
              <div class="flex items-center">
                <span
                  class="w-6 h-6 bg-muted-foreground/30 rounded-full mr-2 flex items-center justify-center text-xs"
                >
                  {{ String(pushmdTeam.name).charAt(0) }}
                </span>
                {{ pushmdTeam.name }}
              </div>
              <div class="flex items-center">
                <span
                  class="text-sm bg-muted-foreground/20 text-foreground px-2 py-0.5 rounded-md"
                >
                  {{ pushmdTeam.type }}
                </span>
                <ChevronDown size="16" class="text-muted-foreground ml-2" />
              </div>
            </div>
          </div>

          <!-- Project name column (second) -->
          <div>
            <label class="block text-sm text-muted-foreground mb-2"
              >RepoMd Project Name</label
            >
            <div class="relative">
              <input
                v-model="projectName"
                type="text"
                class="w-full bg-muted border border-border rounded-md px-4 py-2 text-foreground"
                placeholder="Enter your project name"
              />
              <span class="absolute right-2 top-2">
                <HelpCircle size="16" class="text-muted-foreground" />
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Create Button -->
      <button
        @click="createProject"
        :disabled="creatingProject"
        class="w-full bg-primary text-primary-foreground font-medium py-3 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ creatingProject ? "Creating..." : "Import Repository" }}
      </button>

      <!-- Footer Links -->

      <NewRepoOtherLinks />
    </div>
  </div>
</template>
