<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, User, Lock, Github } from "lucide-vue-next";
import { useToast } from "@/components/ui/toast/use-toast";
import { useTemplateStore } from "@/store/templateStore";
import { useOrgStore } from "@/store/orgStore";
import ProjectNameInput from "@/components/repo/ProjectNameInput.vue";
import TemplateLinks from "@/components/repo/TemplateLinks.vue";

import { formatTimeAgo } from "@/lib/utils/dateUtils";
// Import tRPC client - verify this import path based on your project structure
import trpc from "@/trpc";

// get url param.
const route = useRoute();
const orgId = route.query.orgId || route.query.org || route.params.org || "";

// Initialize stores
const templateStore = useTemplateStore();
const orgStore = useOrgStore();

// Debug helper
console.log("trpc object available:", !!trpc);
console.log("trpc methods available:", {
	github: !!trpc.github,
	getProfile: !!(trpc.github && trpc.github.getProfile),
	listRepositories: !!(trpc.github && trpc.github.listRepositories),
	listOrganizations: !!(trpc.github && trpc.github.listOrganizations),
});

// Repository state
const repositories = ref([]);
const organizationRepos = ref({});
const userOrganizations = ref([]);
const profileData = ref(null);

// Show more repositories state
const maxReposShown = ref(5);
const showAllRepos = ref(false);

// Router instance
const router = useRouter();

// Initialize toast
const { toast } = useToast
	? useToast()
	: {
			toast: (config) => console.log("Toast:", config),
		};

// UI state
const searchQuery = ref("");
const selectedProvider = ref("github");
const selectedNamespace = ref(""); // To store the selected organization/username
const selectedFramework = ref("all");
const loading = ref(false);
const errorMessage = ref("");

// Template modal state
const showTemplateModal = ref(false);
const selectedTemplate = ref(null);
const projectName = ref("");
const processingTemplate = ref(false);

// AI prompt state
const aiPrompt = ref("");
const aiProjectName = ref("");
const generatingFromPrompt = ref(false);

// Computed properties
const filteredRepositories = computed(() => {
	// Get the repos for the selected namespace or profile repos if no namespace selected
	const repoList =
		selectedNamespace.value && organizationRepos.value[selectedNamespace.value]
			? organizationRepos.value[selectedNamespace.value]
			: repositories.value;

	if (!searchQuery.value.trim()) {
		return repoList;
	}

	const query = searchQuery.value.toLowerCase();
	return repoList.filter((repo) => repo.name.toLowerCase().includes(query));
});

// New computed property for limited repos display
const displayedRepositories = computed(() => {
	if (showAllRepos.value || searchQuery.value.trim()) {
		return filteredRepositories.value;
	}
	return filteredRepositories.value.slice(0, maxReposShown.value);
});

// Computed property to check if we need to show the "Load more" button
const hasMoreRepos = computed(() => {
	return (
		!showAllRepos.value &&
		!searchQuery.value.trim() &&
		filteredRepositories.value.length > maxReposShown.value
	);
});

// Get filtered templates from the store based on selected framework
const filteredTemplates = computed(() => {
	return templateStore.getTemplatesByFramework(selectedFramework.value);
});

// Function to check if a repository is already imported
const getImportedProject = (repo) => {
	// Use all projects if currentOrgProjects is empty or not set properly
	const projectsToCheck = orgStore.currentOrgProjects?.length > 0 
		? orgStore.currentOrgProjects 
		: orgStore.projects.filter(p => p.orgId === orgId);
		
	if (!projectsToCheck || projectsToCheck.length === 0 || !repo.full_name) {
		console.log('No projects to check or no repo full_name');
		return null;
	}
	
	// Check various possible URL formats and fields
	const repoFullName = repo.full_name; // e.g., "owner/repo"
	const repoUrl = repo.html_url; // e.g., "https://github.com/owner/repo"
	
	// Debug logging
	console.log(`Checking if ${repoFullName} is imported...`);
	console.log('Projects to check:', projectsToCheck.length);
	
	return projectsToCheck.find(project => {
		// Debug each project
		console.log('Checking project:', {
			id: project.id || project._id,
			name: project.name,
			repoUrl: project.repoUrl,
			repo: project.repo,
			sourceUrl: project.sourceUrl,
			sourceRepo: project.sourceRepo
		});
		
		// Check if project has any GitHub reference
		if (!project.repoUrl && !project.repo && !project.sourceUrl && !project.sourceRepo) return false;
		
		// Normalize URLs for comparison
		const normalizeUrl = (url) => {
			if (!url) return '';
			// Ensure url is a string
			const urlStr = String(url);
			return urlStr.toLowerCase()
				.replace(/\.git$/, '')
				.replace(/\/$/, '')
				.replace('https://github.com/', '')
				.replace('http://github.com/', '')
				.replace('git@github.com:', '')
				.replace('github.com/', '');
		};
		
		const normalizedRepoUrl = normalizeUrl(repoUrl);
		const normalizedRepoFullName = normalizeUrl(repoFullName);
		
		// Check against various possible fields and formats
		const isMatch = (
			normalizeUrl(project.repoUrl) === normalizedRepoUrl ||
			normalizeUrl(project.repoUrl) === normalizedRepoFullName ||
			normalizeUrl(project.repo) === normalizedRepoFullName ||
			normalizeUrl(project.sourceUrl) === normalizedRepoUrl ||
			normalizeUrl(project.sourceUrl) === normalizedRepoFullName ||
			normalizeUrl(project.sourceRepo) === normalizedRepoFullName ||
			project.sourceRepo === repoFullName
		);
		
		if (isMatch) {
			console.log(`Found match! Project ${project.name} matches repo ${repoFullName}`);
		}
		
		return isMatch;
	});
};

// Available namespaces (organizations + user)
const namespaces = computed(() => {
	let result = [];

	// Add the user as the primary option if profile data exists
	if (profileData.value) {
		result.push({
			value: profileData.value.login,
			label: profileData.value.login,
			type: "user",
			avatar: profileData.value.avatar_url || "/api/placeholder/20/20",
		});
	}

	// Add organizations
	if (userOrganizations.value.length > 0) {
		userOrganizations.value.forEach((org) => {
			result.push({
				value: org.login,
				label: org.login,
				type: "organization",
				avatar: org.avatar_url || "/api/placeholder/20/20",
			});
		});
	}

	return result;
});

// Methods
async function loadUserProfile() {
	console.log("loadUserProfile: Starting profile fetch");
	loading.value = true;
	errorMessage.value = "";

	try {
		console.log("loadUserProfile: Calling trpc.github.getProfile.query()");
		const result = await trpc.github.getProfile.query();
		console.log("loadUserProfile: Profile result received:", result);

		if (!result || !result.profile) {
			throw new Error("Invalid profile data received");
		}

		profileData.value = result.profile;
		console.log("loadUserProfile: Profile data set:", profileData.value.login);

		// Set default namespace to user's profile
		if (profileData.value && !selectedNamespace.value) {
			selectedNamespace.value = profileData.value.login;
			console.log(
				"loadUserProfile: Default namespace set to:",
				selectedNamespace.value,
			);
		}
	} catch (error) {
		console.error("loadUserProfile: Failed to load GitHub profile:", error);
		console.error("loadUserProfile: Error details:", {
			name: error.name,
			message: error.message,
			stack: error.stack,
			data: error.data,
		});
		errorMessage.value = `Failed to load GitHub profile: ${error.message || "Unknown error"}`;
		toast({
			title: "Error",
			description: "Failed to load GitHub profile",
			variant: "destructive",
		});
	} finally {
		console.log("loadUserProfile: Complete");
		loading.value = false;
	}
}

async function loadUserRepos() {
	console.log("loadUserRepos: Starting repository fetch");
	loading.value = true;
	errorMessage.value = "";

	try {
		console.log("loadUserRepos: Calling trpc.github.listRepositories.query()");
		const result = await trpc.github.listRepositories.query();
		console.log("loadUserRepos: Repository result received:", result);

		if (result.success && result.repositories) {
			console.log(
				`loadUserRepos: Processing ${result.repositories.length} repositories`,
			);
			repositories.value = result.repositories.map((repo) => ({
				id: repo.id,
				name: repo.name,
				full_name: repo.full_name,
				icon: repo.owner?.avatar_url || "/api/placeholder/20/20",
				private: repo.private,
				timeAgo: formatTimeAgo(repo.updated_at),
				html_url: repo.html_url,
				description: repo.description,
			}));
			console.log("loadUserRepos: Repositories processed and stored");
		} else {
			console.warn(
				"loadUserRepos: No repositories found or success flag missing",
			);
			throw new Error("Invalid repository data received");
		}
	} catch (error) {
		console.error("loadUserRepos: Failed to load repositories:", error);
		console.error("loadUserRepos: Error details:", {
			name: error.name,
			message: error.message,
			stack: error.stack,
			data: error.data,
		});
		errorMessage.value = `Failed to load repositories: ${error.message || "Unknown error"}`;
		toast({
			title: "Error",
			description: "Failed to load repositories",
			variant: "destructive",
		});
	} finally {
		console.log("loadUserRepos: Complete");
		loading.value = false;
	}
}

async function loadOrganizations() {
	console.log("loadOrganizations: Starting organizations fetch");
	loading.value = true;
	errorMessage.value = "";

	try {
		console.log(
			"loadOrganizations: Calling trpc.github.listOrganizations.query()",
		);
		const result = await trpc.github.listOrganizations.query();
		console.log("loadOrganizations: Organizations result received:", result);

		if (result.success && result.organizations) {
			console.log(
				`loadOrganizations: Found ${result.organizations.length} organizations`,
			);
			userOrganizations.value = result.organizations;

			// Load repositories for each organization
			if (result.organizations.length > 0) {
				console.log(
					"loadOrganizations: Loading repositories for each organization",
				);
				for (const org of result.organizations) {
					console.log(
						`loadOrganizations: Loading repos for organization: ${org.login}`,
					);
					await loadOrganizationRepos(org.login);
				}
				console.log(
					"loadOrganizations: Finished loading all organization repositories",
				);
			} else {
				console.log(
					"loadOrganizations: No organizations to load repositories for",
				);
			}
		} else {
			console.warn(
				"loadOrganizations: No organizations found or success flag missing",
			);
		}
	} catch (error) {
		console.error("loadOrganizations: Failed to load organizations:", error);
		console.error("loadOrganizations: Error details:", {
			name: error.name,
			message: error.message,
			stack: error.stack,
			data: error.data,
		});
		errorMessage.value = `Failed to load organizations: ${error.message || "Unknown error"}`;
		toast({
			title: "Error",
			description: "Failed to load GitHub organizations",
			variant: "destructive",
		});
	} finally {
		console.log("loadOrganizations: Complete");
		loading.value = false;
	}
}

async function loadOrganizationRepos(orgName) {
	console.log(`loadOrganizationRepos(${orgName}): Starting repository fetch`);

	try {
		console.log(
			`loadOrganizationRepos(${orgName}): Calling trpc.github.listUserRepositories.query()`,
		);
		const result = await trpc.github.listUserRepositories.query({
			username: orgName,
		});
		console.log(`loadOrganizationRepos(${orgName}): Result received:`, result);

		if (result.success && result.repositories) {
			console.log(
				`loadOrganizationRepos(${orgName}): Processing ${result.repositories.length} repositories`,
			);
			organizationRepos.value[orgName] = result.repositories.map((repo) => ({
				id: repo.id,
				name: repo.name,
				full_name: repo.full_name,
				icon: repo.owner?.avatar_url || "/api/placeholder/20/20",
				private: repo.private,
				timeAgo: formatTimeAgo(repo.updated_at),
				html_url: repo.html_url,
				description: repo.description,
			}));
			console.log(
				`loadOrganizationRepos(${orgName}): Repositories processed and stored`,
			);
		} else {
			console.warn(
				`loadOrganizationRepos(${orgName}): No repositories found or success flag missing`,
			);
		}
	} catch (error) {
		console.error(
			`loadOrganizationRepos(${orgName}): Failed to load repositories:`,
			error,
		);
		console.error(`loadOrganizationRepos(${orgName}): Error details:`, {
			name: error.name,
			message: error.message,
			stack: error.stack,
			data: error.data,
		});
		// Don't set errorMessage since this is a sub-operation and we don't want to override the main error message
	}

	console.log(`loadOrganizationRepos(${orgName}): Complete`);
}

async function importRepository(repo) {
	console.log(`importRepository: Starting import for repo ${repo.name}`);
	console.log(repo);
	try {
		loading.value = true;

		// Extract owner and repo name from full_name (e.g., "owner/repo")
		const [owner, repoName] = repo.full_name.split("/");
		console.log(
			`importRepository: Extracted owner=${owner}, repoName=${repoName}`,
		);

		console.log(
			`importRepository: Calling trpc.github.cloneRepository.mutate()`,
		);
		const result = await trpc.github.cloneRepository.mutate({
			repoName: repoName,
			owner: owner,
		});
		console.log(`importRepository: Clone repository result:`, result);

		if (result.success) {
			console.log(
				`importRepository: Repository ${repo.name} imported successfully`,
			);
			toast({
				title: "Success",
				description: `Repository ${repo.name} imported successfully`,
			});

			// Navigate to the project page
			console.log(`importRepository: Navigating to /project/${repo.name}`);
			router.push(`/project/${repo.name}`);
		} else {
			console.warn(`importRepository: Success flag missing in the response`);
			throw new Error("Repository import failed: Invalid response");
		}
	} catch (error) {
		console.error("importRepository: Failed to import repository:", error);
		console.error("importRepository: Error details:", {
			name: error.name,
			message: error.message,
			stack: error.stack,
			data: error.data,
		});
		toast({
			title: "Error",
			description: `Failed to import repository: ${error.message || "Unknown error"}`,
			variant: "destructive",
		});
	} finally {
		console.log(`importRepository: Complete`);
		loading.value = false;
	}
}

// Function to handle load more repositories
function loadMoreRepositories() {
	showAllRepos.value = true;
	console.log("Showing all repositories");
}

function handleNamespaceChange(value) {
	selectedNamespace.value = value;
	// Reset the view when changing namespace
	showAllRepos.value = false;
	// repositories are already loaded through computed property
}

const openTemplateDetails = (template) => {
	router.push(`/new/clone?template=${template.id}`);
};

const closeTemplateModal = () => {
	showTemplateModal.value = false;
	selectedTemplate.value = null;
};

const createFromTemplate = async () => {
	if (!projectName.value) {
		toast({
			title: "Required Information",
			description: "Please enter a project name",
			variant: "destructive",
		});
		return;
	}

	try {
		processingTemplate.value = true;

		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 1500));

		closeTemplateModal();

		toast({
			title: "Project Created",
			description: `${projectName.value} has been created successfully`,
		});

		// Navigate to the new project
		router.push(`/project/${projectName.value}`);
	} catch (error) {
		console.error("Error creating project:", error);
		toast({
			title: "Error",
			description: "Unable to create project",
			variant: "destructive",
		});
	} finally {
		processingTemplate.value = false;
	}
};

const createProjectFromPrompt = async () => {
	if (!aiPrompt.value.trim()) {
		toast({
			title: "Required Information",
			description: "Please describe your project",
			variant: "destructive",
		});
		return;
	}

	if (!aiProjectName.value.trim()) {
		toast({
			title: "Required Information",
			description: "Please enter a project name",
			variant: "destructive",
		});
		return;
	}

	try {
		generatingFromPrompt.value = true;

		console.log("Creating project from prompt:", {
			prompt: aiPrompt.value,
			newRepoName: aiProjectName.value,
			orgId: orgId
		});

		const result = await trpc.projects.createRepoFromPrompt.mutate({
			prompt: aiPrompt.value,
			newRepoName: aiProjectName.value,
			orgId: orgId || undefined,
			repoOptions: {
				private: false
			}
		});

		console.log("AI project creation result:", result);

		if (result && result.success) {
			toast({
				title: "Project Created Successfully",
				description: `${aiProjectName.value} has been generated and deployed`,
			});

			// Navigate to the new project - adjust path based on your routing structure
			if (result.projectId) {
				router.push(`/${orgId}/${result.projectId}`);
			} else if (result.repository) {
				// Fallback to project name if projectId not available
				router.push(`/${orgId}/${aiProjectName.value}`);
			} else {
				// Navigate to org dashboard as fallback
				router.push(`/${orgId}`);
			}

			// Clear the form after successful submission
			aiPrompt.value = "";
			aiProjectName.value = "";
		} else {
			throw new Error("Project creation failed: Invalid response");
		}
	} catch (error) {
		console.error("Error generating project from prompt:", error);
		toast({
			title: "Error",
			description: `Unable to generate project: ${error.message || "Unknown error"}`,
			variant: "destructive",
		});
	} finally {
		generatingFromPrompt.value = false;
	}
};

// Load all data on mount
onMounted(async () => {
	console.log("Component mounted, initializing GitHub integration...");

	// Load templates from the store
	await templateStore.fetchTemplates();
	
	// Load organization projects if we have an orgId
	if (orgId) {
		try {
			// Fetch the org details first to set currentOrg properly
			await orgStore.fetchOrgById(orgId);
			await orgStore.fetchProjects(orgId);
			console.log("Organization projects loaded:", orgStore.currentOrgProjects?.length || 0);
			console.log("Current org:", orgStore.currentOrg);
			console.log("Projects:", orgStore.currentOrgProjects);
		} catch (error) {
			console.error("Failed to load organization projects:", error);
		}
	}

	try {
		console.log("Checking GitHub integration status...");
		// Check GitHub integration
		let integrationCheck;
		try {
			integrationCheck = await trpc.github.checkIntegration.query();
			console.log("Integration check response:", integrationCheck);
		} catch (checkError) {
			console.error("Failed to check GitHub integration:", checkError);
			throw new Error(
				`Integration check failed: ${checkError.message || "Unknown error"}`,
			);
		}

		if (!integrationCheck.isIntegrated) {
			console.warn("GitHub integration not set up");
			errorMessage.value =
				"GitHub integration not set up. Please connect your GitHub account.";
			toast({
				title: "GitHub Integration Required",
				description: "Please connect your GitHub account to continue",
				variant: "warning",
			});

			// Optionally redirect to setup URL if provided
			if (integrationCheck.setupUrl) {
				// router.push(integrationCheck.setupUrl);
				console.log("Redirect to:", integrationCheck.setupUrl);
			}
			return;
		}

		console.log("GitHub integration confirmed, loading data...");

		// Load data sequentially with detailed error handling
		try {
			console.log("Loading user profile...");
			await loadUserProfile();
			console.log("User profile loaded successfully");
		} catch (profileError) {
			console.error("Failed to load user profile:", profileError);
			errorMessage.value = `Failed to load GitHub profile: ${profileError.message || "Unknown error"}`;
			// Continue with other data loading
		}

		try {
			console.log("Loading user repositories...");
			await loadUserRepos();
			console.log("User repositories loaded successfully");
		} catch (reposError) {
			console.error("Failed to load repositories:", reposError);
			errorMessage.value = `Failed to load repositories: ${reposError.message || "Unknown error"}`;
			// Continue with organization loading
		}

		try {
			console.log("Loading organizations...");
			await loadOrganizations();
			console.log("Organizations loaded successfully");
		} catch (orgsError) {
			console.error("Failed to load organizations:", orgsError);
			errorMessage.value = `Failed to load organizations: ${orgsError.message || "Unknown error"}`;
		}

		console.log("Initialization complete:", {
			profileLoaded: !!profileData.value,
			reposCount: repositories.value.length,
			orgsCount: userOrganizations.value.length,
		});
	} catch (error) {
		console.error("Failed to initialize:", error);
		errorMessage.value = `Failed to initialize GitHub integration: ${error.message || "Unknown error"}`;
		toast({
			title: "Error",
			description: errorMessage.value,
			variant: "destructive",
		});
	}
});
</script>

<template>
  <div class="min-h-screen bg-slate-100 text-foreground">
    <!-- Header section -->
    <div class="container mx-auto px-6 py-12">
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-4xl font-bold mb-2">Let's build something new.</h1>
          <p class="text-muted-foreground">
            To deploy a new Markdown Project, import an existing Git Repository
            or get started with one of our Templates.
          </p>
        </div>
        <Button
          variant="outline"
          class="text-primary border-primary hover:bg-primary/20 flex items-center gap-2"
        >
          <User class="h-5 w-5" />
          Collaborate on a Pro Trial
        </Button>
      </div>
    </div>

    <!-- Main content area -->
    <div class="container mx-auto px-6 py-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Import Git Repository section -->
        <Card class="p-6">
          <h2 class="text-xl font-bold mb-4">Import Git Repository</h2>

          <div
            v-if="errorMessage"
            class="mb-4 p-3 bg-destructive/10 text-destructive rounded-md"
          >
            {{ errorMessage }}
          </div>

          <div class="flex mb-4">
            <div class="relative flex items-center">
              <Select
                v-model="selectedNamespace"
                @update:modelValue="handleNamespaceChange"
              >
                <SelectTrigger
                  class="bg-muted/50 flex items-center gap-2 rounded-md px-4 py-2 w-40"
                >
                  <template v-if="selectedNamespace">
                    <div class="flex items-center">
                      <img
                        :src="
                          namespaces.find((n) => n.value === selectedNamespace)
                            ?.avatar || '/api/placeholder/20/20'
                        "
                        class="w-5 h-5 mr-2 rounded-full"
                        alt="Namespace avatar"
                      />
                      {{ selectedNamespace }}
                    </div>
                  </template>
                  <SelectValue v-else placeholder="Select Namespace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="namespace in namespaces"
                    :key="namespace.value"
                    :value="namespace.value"
                  >
                    <div class="flex items-center">
                      <img
                        :src="namespace.avatar"
                        class="w-5 h-5 text-accent-foreground mr-2 rounded-full"
                      />
                      {{ namespace.label }}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex-grow ml-2">
              <div class="relative">
                <Search
                  class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="text"
                  v-model="searchQuery"
                  placeholder="Search repositories..."
                  class="w-full bg-muted/50 rounded-md pl-10 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          <div v-if="loading" class="py-10 flex justify-center items-center">
            <div
              class="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"
            ></div>
          </div>

          <div
            v-else-if="displayedRepositories.length === 0"
            class="py-10 text-center text-muted-foreground"
          >
            <p v-if="searchQuery">
              No repositories found matching "{{ searchQuery }}"
            </p>
            <p v-else>No repositories found</p>
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="repo in displayedRepositories"
              :key="repo.id"
              class="border-b border-border py-3 flex justify-between items-center"
            >
              <div class="flex items-center">
                <div class="bg-muted rounded-full p-2 mr-3">
                  <img
                    :src="repo.icon"
                    alt="Repo icon"
                    class="w-5 h-5 rounded-full"
                  />
                </div>
                <div>
                  <span class="font-medium inline"
                    >{{ repo.name }}
                    <Lock v-if="repo.private" class="h-4 w-4 mr-1 inline"
                  /></span>
                  <span class="inline text-muted-foreground text-sm">
                    <span>· {{ repo.timeAgo }}</span>
                  </span>
                </div>
              </div>
              <template v-if="getImportedProject(repo)">
                <router-link
                  :to="`/${orgId}/${getImportedProject(repo).id || getImportedProject(repo)._id}`"
                >
                  <Button
                    variant="outline"
                    class="px-4 py-1 rounded-md text-sm"
                  >
                    View Project
                  </Button>
                </router-link>
              </template>
              <template v-else>
                <router-link
                  :to="`/new/import?repo=${encodeURIComponent(repo.html_url)}&orgId=${orgId}`"
                >
                  <Button
                    variant="default"
                    class="bg-primary-foreground text-primary hover:bg-secondary px-4 py-1 rounded-md text-sm"
                    :disabled="loading"
                  >
                    Import
                  </Button>
                </router-link>
              </template>
            </div>

            <!-- Load More Button -->
            <div v-if="hasMoreRepos" class="flex justify-center pt-2">
              <Button
                variant="outline"
                @click="loadMoreRepositories"
                class="text-sm"
              >
                Load More ({{ filteredRepositories.length - maxReposShown }}
                more)
              </Button>
            </div>
          </div>

          <TemplateLinks route-prefix="/new" :org-id="orgId" />
        </Card>

        <!-- Right column with AI prompt and templates -->
        <div class="space-y-6">
          <!-- AI Template Prompt section -->
          <Card class="p-6">
            <h2 class="text-xl font-bold mb-4">Prompt a Template</h2>
            <p class="text-muted-foreground mb-4">
              Kickoff your project with AI - describe what you want to build
            </p>
            
            <div class="space-y-4">
              <textarea
                v-model="aiPrompt"
                placeholder="Describe your project... (e.g., 'A blog for sharing cooking recipes with categories and search functionality')"
                class="w-full min-h-[100px] p-3 bg-muted/50 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                :minlength="10"
                required
              />
              
              <ProjectNameInput
                v-model="aiProjectName"
                label="Project Name"
                placeholder="my-recipe-blog"
                :has-tooltip="false"
              />
              
              <Button
                @click="createProjectFromPrompt"
                :disabled="!aiPrompt.trim() || !aiProjectName.trim() || generatingFromPrompt"
                class="w-full"
              >
                <span v-if="generatingFromPrompt" class="flex items-center gap-2">
                  <div
                    class="animate-spin h-4 w-4 border-2 border-current rounded-full border-t-transparent"
                  ></div>
                  Generating project...
                </span>
                <span v-else>🤖 Generate with AI</span>
              </Button>
            </div>
          </Card>

          <!-- Clone Template section -->
          <Card class="p-6">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-bold">Clone Template</h2>
              <div class="relative">
                <Select v-model="selectedFramework">
                  <SelectTrigger
                    class="bg-muted/50 flex items-center gap-2 rounded-md px-4 py-2"
                  >
                    <SelectValue placeholder="Framework" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="react">React</SelectItem>
                    <SelectItem value="vue">Vue</SelectItem>
                    <SelectItem value="next">Next.js</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div
              v-if="templateStore.loading"
              class="py-10 flex justify-center items-center"
            >
              <div
                class="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"
              ></div>
            </div>

            <div v-else class="grid grid-cols-2 gap-4">
              <div
                v-for="template in filteredTemplates"
                :key="template.id"
                @click="openTemplateDetails(template)"
                class="cursor-pointer"
              >
                <router-link :to="`/new/clone?templateId=${template.id}`">
                  <Card
                    class="bg-card hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
                  >
                    <div class="p-2">
                      <img
                        :src="template.image"
                        alt="Template preview"
                        class="w-full h-32 object-cover rounded-md"
                      />
                    </div>
                    <div class="p-3 flex items-center justify-between">
                      <div class="flex items-center">
                        <img
                          :src="template.icon"
                          alt="Template icon"
                          class="w-5 h-5 mr-2"
                        />
                        <span>{{ template.name }}</span>
                      </div>
                    </div>
                  </Card>
                </router-link>
              </div>
            </div>

            <TemplateLinks route-prefix="/new" :org-id="orgId" />
          </Card>
        </div>
      </div>
    </div>
  </div>

  <!-- Template Details Modal -->
  <Dialog :open="showTemplateModal" @update:open="showTemplateModal = $event">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ selectedTemplate?.name }}</DialogTitle>
        <DialogDescription>
          Use this template to quickly start your project with pre-configured
          settings.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4 py-4">
        <img
          v-if="selectedTemplate?.image"
          :src="selectedTemplate.image"
          :alt="selectedTemplate?.name"
          class="w-full h-48 object-cover rounded-md"
        />

        <ProjectNameInput
          v-model="projectName"
          label="Project Name"
          placeholder="Enter your project name"
          :has-tooltip="false"
        />
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          @click="closeTemplateModal"
          :disabled="processingTemplate"
        >
          Cancel
        </Button>
        <Button
          @click="createFromTemplate"
          :disabled="processingTemplate || !projectName"
        >
          <span v-if="processingTemplate" class="flex items-center gap-2">
            <div
              class="animate-spin h-4 w-4 border-2 border-current rounded-full border-t-transparent"
            ></div>
            Processing...
          </span>
          <span v-else>Create Project</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
