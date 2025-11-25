<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import {
	Search,
	MoreHorizontal,
	GitBranch,
	Info,
	Calendar,
	X,
	RefreshCcw,
	ExternalLink,
	Play,
	Clock,
	CheckCircle,
	XCircle,
	AlertCircle,
	FileText,
	Image,
	FolderOpen,
	GitGraph,
	ScrollText,
	Database,
	ChevronDown,
} from "lucide-vue-next";
import { useRouter, useRoute } from "vue-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import PageHeadingBar from "@/components/PageHeadingBar.vue";
import ElipsisMenu from "@/components/ElipsisMenu.vue";
import TimeDisplay from "@/components/ui/TimeDisplay.vue";
import PendingIndicator from "@/components/ui/PendingIndicator.vue";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuLabel,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import trpc from "@/trpc";
import { setActiveDeployment } from "@/lib/deploymentUtils";

// Props for project data passed from parent
const props = defineProps({
	project: {
		type: Object,
		default: null,
	},
});

const emit = defineEmits(['deployment-updated']);

const router = useRouter();
const route = useRoute();

// Computed properties
const projectId = computed(() => props.project?._id || route.params.projectId);
const projectSlug = computed(
	() => props.project?.slug || route.params.projectId,
);
const projectName = computed(() => props.project?.name || projectSlug.value);
const orgHandle = computed(() => route.params.orgId);
const repoName = computed(
	() =>
		props.project?.githubRepo?.fullName ||
		`${orgHandle.value}/${projectSlug.value}`,
);

// State
const searchTerm = ref("");
const selectedDateRange = ref({ start: null, end: null });
const selectedStatus = ref("all");
const showDatePicker = ref(false);
const jobs = ref([]);
const isLoadingJobs = ref(false);
const errorJobs = ref(null);
const jobsPagination = ref({
	total: 0,
	page: 1,
	limit: 50,
	pages: 0,
});

// Polling state
let pollingInterval = null;
const isPolling = ref(false);

// Status filter options
const statusOptions = [
	{ value: "all", label: "All Status" },
	{ value: "completed", label: "Completed" },
	{ value: "running", label: "Running" },
	{ value: "failed", label: "Failed" },
	{ value: "pending", label: "Pending" },
];

// Upgrade banner state
const showUpgradeBanner = ref(true);
const BANNER_HIDE_DURATION = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

// Check if banner should be shown
const checkBannerVisibility = () => {
	const hiddenUntil = localStorage.getItem('upgradebannerHiddenUntil');
	if (hiddenUntil) {
		const hiddenUntilTime = Number.parseInt(hiddenUntil, 10);
		if (Date.now() < hiddenUntilTime) {
			showUpgradeBanner.value = false;
		} else {
			// Time expired, remove the localStorage item
			localStorage.removeItem('upgradebannerHiddenUntil');
		}
	}
};

// Hide banner for 48 hours
const hideUpgradeBanner = () => {
	showUpgradeBanner.value = false;
	const hideUntil = Date.now() + BANNER_HIDE_DURATION;
	localStorage.setItem('upgradebannerHiddenUntil', hideUntil.toString());
};

// Load jobs for the project
const loadJobs = async () => {
	isLoadingJobs.value = true;
	errorJobs.value = null;

	try {
		const response = await trpc.cloudRun.listJobs.query({
			projectId: projectId.value,
			page: jobsPagination.value.page,
			limit: jobsPagination.value.limit,
		});

		if (response.success) {
			jobs.value = response.jobs;
			jobsPagination.value = response.pagination;
		} else {
			throw new Error("Failed to load jobs");
		}
	} catch (err) {
		console.error("Error loading jobs:", err);
		errorJobs.value = err.message || "Failed to load jobs";
	} finally {
		isLoadingJobs.value = false;
	}
};

// Poll single job status
const pollJobStatus = async (jobId) => {
	try {
		const response = await trpc.cloudRun.getJobStatus.query({
			projectId: projectId.value,
			jobId: jobId
		});

		if (response.success && response.job) {
			// Find the job in our current list and update it
			const jobIndex = jobs.value.findIndex(job => job._id === jobId);
			if (jobIndex !== -1) {
				const oldJob = jobs.value[jobIndex];
				const newJob = response.job;
				
				// Update the job in place
				jobs.value[jobIndex] = newJob;
				
				// Check if status changed
				if (oldJob.status !== newJob.status) {
					// Status changed - emit event to parent
					emit('deployment-updated', {
						job: newJob,
						previousStatus: oldJob.status,
						newStatus: newJob.status
					});
				}
			}
		}
	} catch (err) {
		console.error("Error polling job status:", err);
		// If job status polling fails, fall back to full refresh
		loadJobs();
	}
};

// Watch for project changes
watch(
	() => props.project,
	() => {
		loadJobs();
	},
	{ immediate: true },
);

// Check banner visibility on mount
onMounted(() => {
	checkBannerVisibility();
});

// Cleanup on unmount
onUnmounted(() => {
	stopPolling();
});

// Filter jobs based on search term, status, and date range
const filteredJobs = computed(() => {
	let filtered = jobs.value;

	// Filter by search term
	if (searchTerm.value) {
		const term = searchTerm.value.toLowerCase();
		filtered = filtered.filter(
			(job) =>
				job._id?.toLowerCase().includes(term) ||
				job.type?.toLowerCase().includes(term) ||
				job.status?.toLowerCase().includes(term) ||
				job.userId?.toLowerCase().includes(term),
		);
	}

	// Filter by status
	if (selectedStatus.value !== "all") {
		filtered = filtered.filter(
			(job) => job.status?.toLowerCase() === selectedStatus.value.toLowerCase(),
		);
	}

	// Filter by date range
	if (selectedDateRange.value.start && selectedDateRange.value.end) {
		filtered = filtered.filter((job) => {
			const jobDate = new Date(job.createdAt);
			return (
				jobDate >= selectedDateRange.value.start &&
				jobDate <= selectedDateRange.value.end
			);
		});
	}

	return filtered;
});

// Format date range for display
const dateRangeDisplay = computed(() => {
	if (!selectedDateRange.value.start || !selectedDateRange.value.end) {
		return "Select Date Range";
	}
	const start = selectedDateRange.value.start.toLocaleDateString();
	const end = selectedDateRange.value.end.toLocaleDateString();
	return `${start} - ${end}`;
});

// Get selected status label
const selectedStatusLabel = computed(() => {
	const option = statusOptions.find((opt) => opt.value === selectedStatus.value);
	return option ? option.label : "All Status";
});

// Check if any filters are active
const hasActiveFilters = computed(() => {
	return (
		searchTerm.value !== "" ||
		selectedStatus.value !== "all" ||
		(selectedDateRange.value.start && selectedDateRange.value.end)
	);
});

// Get the job to poll and whether we should poll
const jobToPoll = computed(() => {
	if (!jobs.value.length) return null;
	
	const mostRecentJob = jobs.value[0];
	if (!mostRecentJob) return null;
	
	const isPending = mostRecentJob.status?.toLowerCase() === 'pending' || 
					  mostRecentJob.status?.toLowerCase() === 'queued';
	
	if (!isPending) return null;
	
	try {
		const now = new Date();
		const created = new Date(mostRecentJob.createdAt);
		const diffMs = now - created;
		const diffMins = Math.floor(diffMs / (1000 * 60));
		
		// Poll if pending and less than 10 minutes old
		return diffMins < 10 ? mostRecentJob : null;
	} catch {
		return null;
	}
});

const shouldPoll = computed(() => jobToPoll.value !== null);

// Watch shouldPoll to start/stop polling
watch(shouldPoll, (newValue) => {
	if (newValue && !pollingInterval) {
		startPolling();
	} else if (!newValue && pollingInterval) {
		stopPolling();
	}
});

// Actions
const toggleMoreOptions = (id) => {
	console.log(`Toggling options for ${id}`);
};

// Clear date range
const clearDateRange = () => {
	selectedDateRange.value = { start: null, end: null };
};

// Clear all filters
const clearAllFilters = () => {
	searchTerm.value = "";
	selectedStatus.value = "all";
	selectedDateRange.value = { start: null, end: null };
};

// Get ellipsis menu items for deployment
const getDeploymentMenuItems = (job) => {
	const deployId = job._id;
	const basePath = `/${orgHandle.value}/${projectSlug.value}/${deployId}`;
	const isActive = deployId === props.project?.activeRev;
	const isCompleted = job.status?.toLowerCase() === 'completed';
	
	const items = [
		{
			label: "View Posts",
			icon: FileText,
			to: `${basePath}/posts`,
		},
		{
			label: "View Media",
			icon: Image,
			to: `${basePath}/medias`,
		},
		{
			label: "View Source",
			icon: FolderOpen,
			to: `${basePath}/source`,
		},
		{
			label: "View Graph",
			icon: GitGraph,
			to: `${basePath}/graph`,
		},
		{ sep: true },
		{
			label: "View Logs",
			icon: ScrollText,
			to: `${basePath}/logs`,
		},
		{
			label: "SQLite Browser",
			icon: Database,
			to: `${basePath}/sqlite`,
		},
	];
	
	// Add "Use this version" button if deployment is completed and not already active
	if (isCompleted && !isActive) {
		items.push({ sep: true });
		items.push({
			label: "Use this version",
			icon: CheckCircle,
			action: async () => {
				try {
					await setActiveDeployment(projectId.value, deployId, {
						onSuccess: (response) => {
							// Emit event for parent component
							emit('deployment-updated', {
								job: job,
								action: 'activated',
								response: response
							});
							
							// Refresh the deployments list to show updated state
							loadJobs();
						}
					});
				} catch (error) {
					// Error is already handled in setActiveDeployment
				}
			}
		});
	}
	
	return items;
};

// Helper functions
const getStatusIcon = (status) => {
	switch (status?.toLowerCase()) {
		case "completed":
		case "success":
			return { icon: CheckCircle, color: "text-green-500", bg: "bg-green-100" };
		case "failed":
		case "error":
			return { icon: XCircle, color: "text-red-500", bg: "bg-red-100" };
		case "running":
		case "in_progress":
			return { icon: Play, color: "text-blue-500", bg: "bg-blue-100" };
		case "pending":
		case "queued":
			return { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-100" };
		default:
			return { icon: AlertCircle, color: "text-gray-500", bg: "bg-gray-100" };
	}
};

const formatDate = (date) => {
	if (!date) return "";
	try {
		return new Date(date).toLocaleString();
	} catch {
		return date;
	}
};

const getTimeElapsed = (startTime, endTime, status) => {
	if (!startTime) return "-";

	try {
		const start = new Date(startTime);
		const end = endTime ? new Date(endTime) : new Date();
		const diff = end - start;

		// Convert to seconds
		const seconds = Math.floor(diff / 1000);
		
		// For pending status, don't show 0s running time
		if (status?.toLowerCase() === 'pending' || status?.toLowerCase() === 'queued') {
			return "-";
		}
		
		if (seconds < 60) return `${seconds}s`;

		// Convert to minutes
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ${seconds % 60}s`;

		// Convert to hours
		const hours = Math.floor(minutes / 60);
		return `${hours}h ${minutes % 60}m`;
	} catch {
		return "-";
	}
};

// Check if job is recent running job (< 30 min)
const isRecentRunningJob = (job) => {
	if (!job.createdAt) return false;
	
	const status = job.status?.toLowerCase();
	const isRunning = status === 'running' || status === 'in_progress';
	
	if (!isRunning) return false;
	
	try {
		const now = new Date();
		const created = new Date(job.createdAt);
		const diffMs = now - created;
		const diffMins = Math.floor(diffMs / (1000 * 60));
		
		return diffMins < 30;
	} catch {
		return false;
	}
};

const refreshJobs = () => {
	loadJobs();
};

// Polling control functions
const startPolling = () => {
	if (pollingInterval) return; // Already polling
	
	isPolling.value = true;
	pollingInterval = setInterval(() => {
		const job = jobToPoll.value;
		if (job) {
			pollJobStatus(job._id); // Poll specific job
		} else {
			stopPolling(); // Stop if no longer needed
		}
	}, 30000); // 30 seconds
};

const stopPolling = () => {
	if (pollingInterval) {
		clearInterval(pollingInterval);
		pollingInterval = null;
	}
	isPolling.value = false;
};

// Format relative time (like "20h ago")
const getRelativeTime = (date) => {
	if (!date) return "";
	try {
		const now = new Date();
		const past = new Date(date);
		const diffMs = now - past;
		const diffSecs = Math.floor(diffMs / 1000);
		const diffMins = Math.floor(diffSecs / 60);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffDays > 0) return `${diffDays}d ago`;
		if (diffHours > 0) return `${diffHours}h ago`;
		if (diffMins > 0) return `${diffMins}m ago`;
		return `${diffSecs}s ago`;
	} catch {
		return date;
	}
};

// Get short user ID (first 6 characters)
const getShortUserId = (userId) => {
	if (!userId) return "system";
	return userId.slice(0, 6);
};

// Get short ID (last 6 characters)
const getShortId = (id) => {
	if (!id) return "";
	return id.slice(-6);
};
</script>

<template>
  <json-debug :data="project" label="project" />
  <json-debug :data="jobs" label="jobs" />

  <!-- Deployments Section -->
  <PageHeadingBar title="Deployments">
    <div class="flex items-center space-x-2">
      <div
        v-if="showUpgradeBanner"
        class="bg-white border px-2 py-1 rounded-md flex items-center text-sm"
      >
        <router-link
          to="/upgrade"
          class="px-2 hover:underline"
        >
          Upgrade to Pro for bigger and faster builds
        </router-link>
        <button
          @click="hideUpgradeBanner"
          class="ml-2 p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <template #secondary>
      <div class="pb-6 flex items-center text-gray-600 text-sm">
        <span class="flex items-center">
          <RefreshCcw class="w-4 h-4 mr-2" />
          Continuously generated from
          <a
            :href="
              props.project?.githubRepo?.url || `https://github.com/${repoName}`
            "
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center ml-1 text-blue-500 hover:underline"
          >
            <div class="w-3 h-3 mr-1 bg-blue-500 rounded-full"></div>
            {{ repoName }}
            <ExternalLink class="h-3 w-3 ml-1" />
          </a>
        </span>
      </div>
    </template>
  </PageHeadingBar>

  <div class="container">
    <!-- Filters -->
    <div class="flex gap-4 mb-4 items-center">
      <div class="relative flex-1 max-w-xs">
        <Search
          class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4"
        />
        <Input
          type="text"
          placeholder="Search by ID, type, or status..."
          class="border pl-10 pr-4 py-2 rounded-md w-full"
          v-model="searchTerm"
        />
        <button class="absolute right-2 top-1/2 transform -translate-y-1/2">
          <MoreHorizontal class="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div class="relative flex-1 max-w-xs">
        <Popover v-model:open="showDatePicker">
          <PopoverTrigger as-child>
            <button
              class="border flex items-center px-4 py-2 rounded-md w-full justify-between hover:bg-gray-50 transition-colors"
            >
              <div class="flex items-center">
                <Calendar class="w-5 h-5 mr-2" />
                {{ dateRangeDisplay }}
              </div>
              <ChevronDown class="w-4 h-4 text-gray-400" />
            </button>
          </PopoverTrigger>
          <PopoverContent class="p-4" align="start">
            <div class="space-y-4">
              <div>
                <label class="text-sm font-medium mb-1 block">Start Date</label>
                <input
                  type="date"
                  :value="selectedDateRange.start?.toISOString().split('T')[0]"
                  @change="(e) => selectedDateRange.start = e.target.value ? new Date(e.target.value) : null"
                  class="w-full px-3 py-2 border rounded-md"
                  :max="new Date().toISOString().split('T')[0]"
                />
              </div>
              <div>
                <label class="text-sm font-medium mb-1 block">End Date</label>
                <input
                  type="date"
                  :value="selectedDateRange.end?.toISOString().split('T')[0]"
                  @change="(e) => selectedDateRange.end = e.target.value ? new Date(e.target.value) : null"
                  class="w-full px-3 py-2 border rounded-md"
                  :min="selectedDateRange.start?.toISOString().split('T')[0]"
                  :max="new Date().toISOString().split('T')[0]"
                />
              </div>
              <div class="flex justify-between pt-2">
                <Button variant="ghost" size="sm" @click="clearDateRange">
                  Clear
                </Button>
                <Button size="sm" @click="showDatePicker = false">
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div class="relative">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button class="flex items-center border rounded-md px-4 py-2 hover:bg-gray-50 transition-colors">
              <span class="text-sm">{{ selectedStatusLabel }}</span>
              <div class="flex items-center ml-2 gap-1">
                <span class="bg-gray-200 px-2 py-0.5 rounded-md text-xs">{{
                  filteredJobs.length
                }}</span>
                <span>/</span>
                <span class="bg-gray-200 px-2 py-0.5 rounded-md text-xs">{{
                  jobsPagination.total
                }}</span>
              </div>
              <ChevronDown class="w-4 h-4 ml-2 text-gray-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-48">
            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              v-for="option in statusOptions"
              :key="option.value"
              @click="selectedStatus = option.value"
              class="cursor-pointer"
              :class="{ 'bg-gray-100': selectedStatus === option.value }"
            >
              <component
                v-if="option.value !== 'all'"
                :is="getStatusIcon(option.value).icon"
                :class="['w-4 h-4 mr-2', getStatusIcon(option.value).color]"
              />
              <span class="ml-6" v-else></span>
              {{ option.label }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Button
        v-if="hasActiveFilters"
        variant="ghost"
        size="sm"
        @click="clearAllFilters"
        class="text-sm"
      >
        Clear filters
        <X class="w-4 h-4 ml-1" />
      </Button>
    </div>

    <!-- Loading State -->
    <div
      v-if="isLoadingJobs && jobs.length === 0"
      class="flex items-center justify-center p-12"
    >
      <RefreshCcw class="w-6 h-6 animate-spin text-blue-500 mr-3" />
      <span>Loading deployments...</span>
    </div>

    <!-- Error State -->
    <div
      v-else-if="errorJobs"
      class="p-8 bg-red-50 border border-red-200 rounded-md"
    >
      <div class="flex items-center gap-2 text-red-700">
        <AlertCircle class="w-5 h-5" />
        <span>{{ errorJobs }}</span>
      </div>
      <Button @click="loadJobs" variant="outline" class="mt-4"> Retry </Button>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredJobs.length === 0 && jobs.length === 0"
      class="text-center p-12 bg-white border rounded-lg"
    >
      <div
        class="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4"
      >
        <Calendar class="w-8 h-8 text-gray-400" />
      </div>
      <h3 class="text-lg font-medium mb-2">No deployments found</h3>
      <p class="text-gray-600 max-w-md mx-auto">
        There are no deployments for this project yet. Push to your repository
        to trigger a deployment.
      </p>
    </div>

    <!-- No Results State (filtered) -->
    <div
      v-else-if="filteredJobs.length === 0 && jobs.length > 0"
      class="text-center p-12 bg-white border rounded-lg"
    >
      <div
        class="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4"
      >
        <Search class="w-8 h-8 text-gray-400" />
      </div>
      <h3 class="text-lg font-medium mb-2">No deployments match your filters</h3>
      <p class="text-gray-600 max-w-md mx-auto mb-4">
        Try adjusting your search criteria or clearing filters to see all deployments.
      </p>
      <Button @click="clearAllFilters" variant="outline">
        Clear all filters
      </Button>
    </div>

    <!-- Deployments Table -->
    <div v-else class="border rounded-lg overflow-hidden bg-white">
      <router-link
        v-for="(job, index) in filteredJobs"
        :key="job._id"
        :to="`/${orgHandle}/${props.project?.name || projectSlug}/${job._id}`"
        class="flex items-center p-4 hover:bg-gray-50 cursor-pointer transition-colors block"
        :class="{ 'border-b': index !== filteredJobs.length - 1 }"
      >
        <div class="flex-1">
          <div class="flex items-center">
            <h3 class="font-mono text-sm font-medium">
              {{ getShortId(job._id) }}
            </h3>
            <span
              v-if="job._id === props.project?.activeRev"
              class="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded"
            >
              Active
            </span>
            <span
              v-else-if="index === 0 && job.status === 'completed'"
              class="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded"
            >
              Latest
            </span>
          </div>
          <div class="flex items-center">
            <span class="text-sm text-gray-600">{{
              job.type || "Production"
            }}</span>
            <Info
              v-if="job._id === props.project?.activeRev"
              class="w-4 h-4 ml-1 text-green-500"
            />
            <Info
              v-else-if="index === 0 && job.status === 'completed'"
              class="w-4 h-4 ml-1 text-blue-500"
            />
          </div>
        </div>

        <div class="flex-1">
          <PendingIndicator 
            :status="job.status" 
            :created-at="job.createdAt"
            v-if="job.status?.toLowerCase() === 'pending' || job.status?.toLowerCase() === 'queued'"
          />
          <div v-else class="flex items-center">
            <component
              :is="getStatusIcon(job.status).icon"
              :class="['w-4 h-4 mr-2', getStatusIcon(job.status).color]"
            />
            <span class="text-sm capitalize">{{ job.status }}</span>
          </div>
          <div class="text-sm text-gray-600">
            <template v-if="isRecentRunningJob(job)">
              Running for {{ getTimeElapsed(job.createdAt, job.updatedAt, job.status) }}
            </template>
            <template v-else>
              {{ getTimeElapsed(job.createdAt, job.updatedAt, job.status) }}
              (<TimeDisplay :date="job.createdAt" />)
            </template>
          </div>
        </div>

        <div class="flex-1">
          <div class="flex items-center">
            <GitBranch class="h-4 w-4 mr-1 text-gray-600" />
            <span class="text-sm">{{ job.input?.branch || "main" }}</span>
          </div>
          <div class="flex items-center text-sm text-gray-600">
            <a
              v-if="job.input?.commit && props.project?.githubRepo?.url"
              :href="`${props.project.githubRepo.url}/commit/${job.input.commit}`"
              target="_blank"
              rel="noopener noreferrer"
              class="font-mono text-blue-600 hover:underline"
              @click.stop
            >
              {{ job.input.commit.slice(0, 7) }}
            </a>
            <span 
              v-else
              class="font-mono"
            >
              {{ job.input?.commit?.slice(0, 7) || getShortId(job._id) }}
            </span>
          </div>
          <div class="text-sm text-gray-600 mt-1 truncate">
            {{ job.input?.message || "deployment" }}
          </div>
        </div>

        <div class="flex-1 text-right">
          <div class="text-sm">
            {{ formatDate(job.createdAt) }} by {{ getShortUserId(job.userId) }}
          </div>
          <div class="flex items-center justify-end mt-1">
            <div
              class="w-6 h-6 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white text-xs overflow-hidden"
            >
              {{ job.userId?.charAt(0)?.toUpperCase() || "S" }}
            </div>
          </div>
        </div>

        <div class="ml-4">
          <ElipsisMenu
            :items="getDeploymentMenuItems(job)"
            :hori="true"
            @click.stop
          />
        </div>
      </router-link>
    </div>

    <!-- Pagination -->
    <div
      v-if="jobsPagination.pages > 1"
      class="px-4 py-3 bg-white border rounded-lg mt-4 flex items-center justify-between"
    >
      <div class="text-sm text-gray-700">
        Showing
        {{ (jobsPagination.page - 1) * jobsPagination.limit + 1 }} to
        {{
          Math.min(
            jobsPagination.page * jobsPagination.limit,
            jobsPagination.total
          )
        }}
        of {{ jobsPagination.total }} deployments
      </div>
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="jobsPagination.page === 1"
          @click="
            jobsPagination.page--;
            loadJobs();
          "
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="jobsPagination.page === jobsPagination.pages"
          @click="
            jobsPagination.page++;
            loadJobs();
          "
        >
          Next
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Additional styling can be added here if needed */
</style>
