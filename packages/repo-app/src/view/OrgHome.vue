<script setup>
//# OrgHome.vue
import { ref, computed, onMounted } from "vue";
import { useOrgStore } from "@/store/orgStore";
import {
	Search,
	Plus,
	LayoutGrid,
	List,
	Github,
	GitBranch,
	MoreHorizontal,
	RefreshCw,
	AlertCircle,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRouter } from "vue-router";

// Get the organization store
const orgStore = useOrgStore();
const router = useRouter();

// UI state
const searchQuery = ref("");
const isGridView = ref(true);
const sortOption = ref("recent");
const hoverStates = ref(new Map());

// Get current organization and its projects
const currentOrg = computed(() => orgStore.currentOrg);

// Flag to track if we've attempted loading this org's projects
const hasAttemptedLoad = ref(false);

// Helper to format dates relative to now
const formatRelativeTime = (dateString) => {
	const date = new Date(dateString);
	const now = new Date();
	const diffInMs = now - date;
	const diffInSecs = Math.floor(diffInMs / 1000);
	const diffInMins = Math.floor(diffInSecs / 60);
	const diffInHours = Math.floor(diffInMins / 60);
	const diffInDays = Math.floor(diffInHours / 24);

	if (diffInSecs < 60) return "just now";
	if (diffInMins < 60) return `${diffInMins}m ago`;
	if (diffInHours < 24) return `${diffInHours}h ago`;
	if (diffInDays < 7) return `${diffInDays}d ago`;

	return date.toLocaleDateString();
};

// Format exact date and time for popover
const formatExactDateTime = (dateString) => {
	const date = new Date(dateString);
	return date.toLocaleString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
};

// Determine if current organization's projects need to be fetched
const needsFetch = computed(() => {
	if (!currentOrg.value?.handle) return false;

	// Check if we already have projects for this org
	const hasProjects = orgStore.currentOrgProjects.length > 0;

	// Skip if we've already loaded projects for this org or there's an error
	return !hasProjects && !hasAttemptedLoad.value && !orgStore.projectsLoading;
});

// Fetch projects for the current organization if needed
const fetchOrgProjects = async () => {
	if (!needsFetch.value) return;

	try {
		hasAttemptedLoad.value = true;
		await orgStore.fetchProjects(currentOrg.value.handle);
	} catch (err) {
		console.error("Error fetching projects:", err);
		// Keep hasAttemptedLoad = true to prevent constant retry attempts
	}
};

// Single initial fetch on mount if needed
onMounted(() => {
	if (needsFetch.value) {
		fetchOrgProjects();
	}
});

// All projects, unfiltered
const allProjects = computed(() => {
	if (!orgStore.currentOrgProjects.length) return [];
	return [...orgStore.currentOrgProjects];
});

// Filtered and sorted projects for display
const shownProjects = computed(() => {
	if (!allProjects.value.length) return [];

	// Filter by search query if provided
	let filtered = [...allProjects.value];
	if (searchQuery.value) {
		const query = searchQuery.value.toLowerCase();
		filtered = filtered.filter(
			(project) =>
				project.name.toLowerCase().includes(query) ||
				(project.description &&
					project.description.toLowerCase().includes(query)) ||
				(project.domain && project.domain.toLowerCase().includes(query)),
		);
	}

	// Sort projects
	return sortProjects(filtered, sortOption.value);
});

// Sort projects based on option
const sortProjects = (projects, option) => {
	switch (option) {
		case "name":
			return [...projects].sort((a, b) => a.name.localeCompare(b.name));
		case "recent":
			return [...projects].sort((a, b) => {
				// Sort by updatedAt or lastUpdated (supporting both formats)
				const dateA = a.updatedAt || a.lastUpdated;
				const dateB = b.updatedAt || b.lastUpdated;
				return new Date(dateB) - new Date(dateA);
			});
		case "created":
			return [...projects].sort((a, b) => {
				// Sort by createdAt
				return new Date(b.createdAt) - new Date(a.createdAt);
			});
		case "status":
			return [...projects].sort((a, b) => {
				if (a.status === b.status) return a.name.localeCompare(b.name);
				return a.status === "active" ? -1 : 1;
			});
		default:
			return projects;
	}
};

// Handle sorting change
const changeSorting = (option) => {
	sortOption.value = option;
};

// Compute project page URL
const getProjectPage = (project) => {
	const orgHandle = currentOrg.value?.handle || "";
	const projectHandle =
		project.handle ||
		project.name?.toLowerCase().replace(/[^a-z0-9-]/g, "-") ||
		"";
	return `/${orgHandle}/${projectHandle}`;
};

// Format status for display
const getStatusBadge = (status) => {
	switch (status) {
		case "active":
			return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
		case "inactive":
			return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
		case "pending":
			return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
		case "failed":
			return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
		default:
			return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
	}
};

// Get deployment status display text
const getDeploymentStatus = (project) => {
	// Check if project has ever been deployed
	const hasDeployment = project.lastDeployed || project.lastUpdated || project.updatedAt;
	
	if (!hasDeployment) {
		// Never deployed - show creation date and finish setup CTA
		return {
			text: `Created ${formatRelativeTime(project.createdAt)}`,
			date: project.createdAt,
			showFinishSetup: true
		};
	}
	
	// Has deployment - show last update with natural language
	const lastUpdate = project.lastDeployed || project.lastUpdated || project.updatedAt;
	const timeAgo = formatRelativeTime(lastUpdate);
	return {
		text: `Updated ${timeAgo}`,
		date: lastUpdate,
		showFinishSetup: false
	};
};

// Check if project has git repo info
const hasGitRepo = (project) => {
	return !!(project.repoUrl || project.repo);
};

// Hover state management
const getProjectId = (project) => project._id || project.id || project.name;
const setHoverState = (project, state) => {
	const id = getProjectId(project);
	hoverStates.value.set(id, state);
};
const getHoverState = (project) => {
	const id = getProjectId(project);
	return hoverStates.value.get(id) || false;
};

// Create new project
const createNewProject = () => {
	router.push(`/new?org=${currentOrg.value.handle}`);
};

// Force refresh projects
const refreshProjects = async () => {
	if (!currentOrg.value?.handle) return;

	try {
		await orgStore.refreshOrgProjects(currentOrg.value.handle);
	} catch (err) {
		console.error("Error refreshing projects:", err);
	}
};
</script>

<template>
  <div class="container p-6">
    <json-debug :data="orgStore.currentOrgProjects" label="projects" />
    <div v-if="allProjects.length > 0" class="mb-2 text-sm text-muted-foreground">
      <span>{{ allProjects.length }} projects total</span>
      <span v-if="shownProjects.length !== allProjects.length"> • {{ shownProjects.length }} shown</span>
    </div>
    <!-- Header with search and filters -->
    <div
      v-if="allProjects.length > 0"
      class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4"
    >
      <div class="flex-1 w-full md:w-auto">
        <div class="relative">
          <Search
            class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4"
          />
          <Input
            v-model="searchQuery"
            placeholder="Search projects..."
            class="pl-10 w-full"
          />
        </div>
      </div>

      <div
        class="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end"
      >
        <div class="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            :class="{ 'bg-secondary': isGridView }"
            @click="isGridView = true"
          >
            <LayoutGrid class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            :class="{ 'bg-secondary': !isGridView }"
            @click="isGridView = false"
          >
            <List class="h-4 w-4" />
          </Button>
        </div>

        <div class="flex items-center gap-2">
          <select
            v-model="sortOption"
            class="px-3 py-1.5 rounded-md border border-input bg-transparent text-sm"
          >
            <option value="recent">Recently updated</option>
            <option value="created">Recently created</option>
            <option value="name">Name</option>
            <option value="status">Status</option>
          </select>

          <Button
            variant="outline"
            size="icon"
            @click="refreshProjects"
            :disabled="orgStore.projectsLoading"
          >
            <RefreshCw
              class="h-4 w-4"
              :class="{ 'animate-spin': orgStore.projectsLoading }"
            />
          </Button>

          <Button @click="createNewProject">
            <Plus class="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>
    </div>

    <!-- Error state -->
    <div
      v-if="orgStore.error && !orgStore.projectsLoading"
      class="flex items-center justify-center space-x-2 text-destructive py-4"
    >
      <AlertCircle class="h-5 w-5" />
      <span>{{ orgStore.error }}</span>
      <Button variant="link" size="sm" @click="refreshProjects">
        Try again
      </Button>
    </div>

    <!-- Projects grid/list view -->
    <div
      v-if="orgStore.projectsLoading && allProjects.length === 0"
      class="text-center py-8"
    >
      <p class="text-muted-foreground">Loading projects...</p>
    </div>

    <div
      v-else-if="allProjects.length === 0"
      class="text-center py-12 border rounded-lg"
    >
      <h3 class="text-xl font-medium mb-2">No projects found</h3>
      <p class="text-muted-foreground mb-6">
        Get started by creating your first project
      </p>
      <Button @click="createNewProject">
        <Plus class="h-4 w-4 mr-2" />
        Create Project
      </Button>
    </div>

    <div v-else-if="shownProjects.length === 0" class="text-center py-12 border rounded-lg">
      <h3 class="text-xl font-medium mb-2">No matching projects</h3>
      <p class="text-muted-foreground mb-4">
        No projects match your current search criteria
      </p>
      <Button variant="outline" @click="searchQuery = ''">
        Clear search
      </Button>
    </div>

    <div
      v-else
      :class="
        isGridView
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
          : 'space-y-4'
      "
    >
      <!-- Project card -->
      <Card
        v-for="project in shownProjects"
        :key="project._id || project.id"
        class="hover:border-primary transition-colors"
      >
        <CardHeader class="pb-2">
          <div class="flex justify-between items-start">
            <CardTitle class="text-lg">
              <router-link 
                :to="getProjectPage(project)" 
                class="hover:text-primary hover:underline transition-colors focus:outline-none focus:underline"
              >
                {{ project.name }}
              </router-link>
            </CardTitle>
            <Badge :class="getStatusBadge(project.status)">
              {{ project.status }}
            </Badge>
          </div>
          <p
            class="text-muted-foreground text-sm line-clamp-2"
            :title="project.description"
          >
            {{ project.description || "No description provided" }}
          </p>
        </CardHeader>

        <router-link :to="getProjectPage(project)" class="block">
          <CardContent class="pb-2 hover:bg-muted/30 transition-colors">
            <div class="flex flex-col space-y-2">
              <div v-if="hasGitRepo(project)" class="flex items-center text-xs text-muted-foreground gap-3">
                <div class="flex items-center">
                  <Github class="h-3 w-3 mr-1" />
                  <span
                    class="truncate max-w-[150px]"
                    :title="project.repoUrl || project.repo"
                  >
                    {{
                      project.repoUrl
                        ? project.repoUrl.split("/").slice(-2).join("/")
                        : project.repo
                    }}
                  </span>
                </div>
                <div v-if="project.branch" class="flex items-center">
                  <GitBranch class="h-3 w-3 mr-1" />
                  <span>{{ project.branch }}</span>
                </div>
              </div>

              <div v-if="project.templateId" class="flex items-center text-xs">
                <Badge variant="outline" class="mr-2"
                  >Template {{ project.templateId }}</Badge
                >
                <Badge v-if="project.sourceRepo" variant="secondary" size="sm"
                  >Cloned</Badge
                >
              </div>
            </div>
          </CardContent>
        </router-link>

        <CardFooter
          class="pt-2 flex justify-between items-center text-xs text-muted-foreground"
        >
          <div class="flex flex-col">
            <Popover :open="getHoverState(project)">
              <PopoverTrigger as-child>
                <span 
                  @mouseenter="setHoverState(project, true)"
                  @mouseleave="setHoverState(project, false)"
                >
                  {{ getDeploymentStatus(project).text }}
                </span>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-2 text-sm">
                {{ formatExactDateTime(getDeploymentStatus(project).date) }}
              </PopoverContent>
            </Popover>
            <Button 
              v-if="getDeploymentStatus(project).showFinishSetup"
              variant="outline" 
              size="sm" 
              class="mt-1 text-xs"
              @click.stop="router.push(getProjectPage(project))"
            >
              Finish setup
            </Button>
          </div>
          <router-link :to="getProjectPage(project)">
            <Button variant="ghost" size="icon">
              <MoreHorizontal class="h-4 w-4" />
            </Button>
          </router-link>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>
