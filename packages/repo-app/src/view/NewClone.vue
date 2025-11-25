<script setup>
import { ref, computed, onMounted, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
	ChevronDown,
	Github,
	GitBranch,
	HelpCircle,
	ArrowRightLeft,
} from "lucide-vue-next";
import { useTemplateStore } from "@/store/templateStore";
import { useOrgStore } from "@/store/orgStore";
import trpc from "@/trpc";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import ProjectNameInput from "@/components/repo/ProjectNameInput.vue";
import GitScopeSelector from "@/components/repo/GitScopeSelector.vue";
import TemplateLinks from "@/components/repo/TemplateLinks.vue";

// Initialize stores
const templateStore = useTemplateStore();
const orgStore = useOrgStore();
const route = useRoute();
const router = useRouter();

// Track loading state for project creation
const creatingProject = ref(false);
const createError = ref(null);

// Check URL parameters for template ID or repository URL
const templateId = computed(() => {
	const id = route.query.templateId;
	return id ? Number(id) : null;
});

const repoUrl = computed(() => route.query.repo || "");

// Determine the source type (template or repo)
const sourceType = computed(() => {
	if (repoUrl.value) return "repo";
	if (templateId.value) return "template";
	return "template";
});

// For template-based projects
const selectedTemplate = computed(() =>
	templateId.value
		? templateStore.getTemplateById(templateId.value)
		: templateStore.templates[0],
);

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
	if (sourceType.value === "repo" && repoInfo.value?.valid) {
		repoName.value = repoInfo.value.name;
		projectName.value = repoInfo.value.name;
	} else if (sourceType.value === "template" && selectedTemplate.value) {
		const formattedName = selectedTemplate.value.name
			.toLowerCase()
			.replace(/[^a-z0-9]/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "");
		repoName.value = formattedName;
		projectName.value = selectedTemplate.value.name;
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
		if (sourceType.value === "template" && selectedTemplate.value) {
			// Use templateOwner and templateRepo if available from API, otherwise parse from githubRepo
			let templateOwner = selectedTemplate.value.templateOwner;
			let templateRepo = selectedTemplate.value.templateRepo;

			// Fallback to parsing from githubRepo if API fields not available
			if (!templateOwner || !templateRepo) {
				const githubRepo = selectedTemplate.value.githubRepo;

				if (githubRepo.startsWith("https://github.com/")) {
					// Full URL format
					const urlParts = githubRepo.split("/");
					templateOwner = urlParts[3];
					templateRepo = urlParts[4];
				} else {
					// Assume format is "owner/repo"
					const parts = githubRepo.split("/");
					templateOwner = parts[0];
					templateRepo = parts[1];
				}
			}

			// Use the new createFromTemplate endpoint
			const response = await trpc.projects.createFromTemplate.mutate({
				templateOwner,
				templateRepo,
				newRepoName: repoName.value,
				orgId: pushmdTeam.value.handle,
				repoOptions: {
					private: true,
					description: selectedTemplate.value.description,
					includeAllBranches: false
				},
				createProject: true,
				triggerDeploy: true
			});

			console.log("Project creation response:", response);

			if (response.success && response.project) {
				// Redirect to the new project using Vue Router
				// Use orgId and name from the project object
				router.push(`/${response.project.orgId}/${response.project.name}`);
			}
		} else if (sourceType.value === "repo" && repoInfo.value?.valid) {
			// For importing existing repos, use the original cloneRepository endpoint
			const cloneData = {
				owner: repoInfo.value.owner,
				repoName: repoInfo.value.name,
				branch: repoInfo.value.branch,
				isPrivate: true,
				newRepoName: repoName.value,
				gitScope: gitScope.value,
				description: `Imported from ${repoInfo.value.fullUrl}`,
				orgId: pushmdTeam.value.handle,
				projectName: projectName.value,
			};

			console.log("Creating project from repository:", cloneData);
			
			// Validate the data before sending
			if (
				!cloneData.owner ||
				!cloneData.repoName ||
				!cloneData.newRepoName ||
				!cloneData.gitScope ||
				!cloneData.projectName
			) {
				throw new Error("Missing required fields for project creation");
			}

			const response = await trpc.cloudRun.cloneRepository.mutate(cloneData);

			console.log("Project creation response:", response);

			if (response.success) {
				// Log the values to debug
				console.log("Redirecting with:", {
					orgId: cloneData.orgId,
					newRepoName: cloneData.newRepoName,
					pushmdTeam: pushmdTeam.value,
					response: response
				});
				
				// Check if response contains project info
				if (response.project) {
					// Use project info from response - it has orgId and name properties
					router.push(`/${response.project.orgId}/${response.project.name}`);
				} else {
					// Fallback to using the request data
					router.push(`/${cloneData.orgId}/${cloneData.newRepoName}`);
				}
			}
		} else {
			throw new Error("Invalid project source");
		}
	} catch (error) {
		console.error("Error creating project:", error);
		createError.value = error.message || "Failed to create project";
	} finally {
		creatingProject.value = false;
	}
};

const importRepository = () => {
	window.location.href = "/new";
};

const browseTemplates = () => {
	window.location.href = "/new/templates";
};

// Load templates and orgs on component mount
onMounted(async () => {
	gitScopesLoading.value = true;

	try {
		await templateStore.fetchTemplates();

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
    <!-- Loading state for template -->
    <div
      v-if="templateStore.loading && sourceType === 'template'"
      class="text-center p-8"
    >
      <div
        class="animate-spin h-8 w-8 border-2 border-primary rounded-full border-t-transparent mx-auto mb-4"
      ></div>
      <p>Loading template...</p>
    </div>

    <!-- Template not found -->
    <div
      v-else-if="sourceType === 'template' && !selectedTemplate"
      class="text-center p-8"
    >
      <p class="text-muted-foreground mb-4">Template not found</p>
      <router-link to="/new" class="text-primary hover:underline">
        Browse available templates
      </router-link>
    </div>

    <!-- Invalid repository -->
    <div
      v-else-if="sourceType === 'repo' && !repoInfo.valid"
      class="text-center p-8"
    >
      <p class="text-destructive mb-4">{{ repoInfo.error }}</p>
      <router-link to="/new" class="text-primary hover:underline">
        Go back to import options
      </router-link>
    </div>

    <!-- Main form -->
    <div v-else class="w-full max-w-2xl bg-card rounded-lg p-8 shadow-md">
      <h1 class="text-2xl font-bold mb-6">New Project</h1>

      <!-- Error display -->
      <div
        v-if="createError"
        class="bg-destructive/10 text-destructive p-4 rounded-md mb-6"
      >
        {{ createError }}
      </div>

      <!-- Template/Repo Selection -->
      <div class="flex bg-muted p-4 rounded-md mb-6">
        <div v-if="sourceType === 'template'" class="w-32 h-24 flex-shrink-0">
          <img
            :src="selectedTemplate.image"
            alt="Template preview"
            class="w-full h-full object-contain"
          />
        </div>
        <div
          v-else
          class="w-32 h-24 flex-shrink-0 flex items-center justify-center"
        >
          <Github size="48" class="text-muted-foreground" />
        </div>

        <div class="ml-4">
          <div class="flex items-center">
            <h2 class="font-medium">
              <template v-if="sourceType === 'template'">
                {{ selectedTemplate.name }}
              </template>
              <template v-else>
                {{ repoInfo.owner }}/{{ repoInfo.name }}
              </template>
              <span class="text-xs text-muted-foreground">↗</span>
            </h2>
          </div>
          <p class="text-sm text-muted-foreground mt-1">
            <template v-if="sourceType === 'template'">
              {{ selectedTemplate.description }}
            </template>
            <template v-else> Repository from GitHub </template>
          </p>

          <div class="mt-3 text-sm text-muted-foreground">
            <p v-if="sourceType === 'template'">Cloning from GitHub</p>
            <p v-else>Importing from GitHub</p>
            <div class="flex items-center mt-1">
              <span class="mr-2">
                <Github size="16" class="text-muted-foreground" />
              </span>
              <span class="text-foreground">
                <template v-if="sourceType === 'template'">
                  {{ selectedTemplate.githubRepo }}
                </template>
                <template v-else>
                  {{ repoInfo.owner }}/{{ repoInfo.name }}
                </template>
              </span>

              <span class="mx-2">
                <ArrowRightLeft size="14" class="text-muted-foreground" />
              </span>

              <span class="text-foreground">
                <template v-if="sourceType === 'template'">
                  {{ selectedTemplate.branch || "main" }}
                </template>
                <template v-else>
                  {{ repoInfo.branch }}
                </template>
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

        <div class="grid grid-cols-1 gap-4 mb-4">
          <ProjectNameInput
            v-model="projectName"
            label="RepoMd Project Name"
            placeholder="Enter your project name"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <GitScopeSelector
            v-model="gitScope"
            :available-scopes="availableGitScopes"
            :loading="gitScopesLoading"
            @update:modelValue="(scope) => orgStore.updateGitScope(scope)"
          />

          <div>
            <label class="block text-sm text-muted-foreground mb-2"
              >Private Repository Name</label
            >
            <div class="relative">
              <input
                v-model="repoName"
                type="text"
                class="w-full bg-muted border border-border rounded-md px-4 py-2 text-foreground"
              />
              <span class="absolute right-2 top-2">
                <HelpCircle size="16" class="text-muted-foreground" />
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Repo.md Team -->
      <div class="mb-8">
        <label class="block text-sm text-muted-foreground mb-2"
          >Repo.md Team</label
        >
        <div
          class="flex items-center justify-between bg-muted border border-border rounded-md px-4 py-2"
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

      <!-- Create Button -->
      <button
        @click="createProject"
        :disabled="creatingProject"
        class="w-full bg-primary text-primary-foreground font-medium py-3 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ creatingProject ? "Creating..." : "Create" }}
      </button>

      <!-- Footer Links -->
      <div class="mt-8 text-center">
        <NewRepoOtherLinks :org-id="pushmdTeam?.handle || ''" />
      </div>
    </div>
  </div>
</template>
