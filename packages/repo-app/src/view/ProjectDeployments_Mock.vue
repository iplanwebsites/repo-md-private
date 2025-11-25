<script setup>
import { ref, computed } from "vue";
import {
	Search,
	MoreHorizontal,
	GitBranch,
	Info,
	Calendar,
	X,
	RefreshCcw,
} from "lucide-vue-next";
import { useRouter } from "vue-router";

// Mock data for deployments
const mockDeployments = [
	{
		id: "yjc4gjdsd",
		environment: "Production",
		status: "Ready",
		branch: "main",
		commit: "b58a62e",
		commitType: "a",
		deployTime: "1m 1s (20h ago)",
		deployedBy: "felix_m",
		deployedAt: "20h ago",
		isCurrent: true,
	},
	{
		id: "lmku70bfb",
		environment: "Production",
		status: "Ready",
		branch: "main",
		commit: "0d3c550",
		commitType: "terms",
		deployTime: "1m 2s (5d ago)",
		deployedBy: "felix_m",
		deployedAt: "Apr 17",
	},
	{
		id: "kmgd5rrhO",
		environment: "Production",
		status: "Ready",
		branch: "main",
		commit: "ac4617d",
		commitType: "a",
		deployTime: "1m 1s (5d ago)",
		deployedBy: "felix_m",
		deployedAt: "Apr 17",
	},
	{
		id: "bs6vxofao",
		environment: "Production",
		status: "Ready",
		branch: "main",
		commit: "cba0adb",
		commitType: "a",
		deployTime: "1m (5d ago)",
		deployedBy: "felix_m",
		deployedAt: "Apr 17",
	},
	{
		id: "fna218iuw",
		environment: "Production",
		status: "Ready",
		branch: "main",
		commit: "06f6936",
		commitType: "a",
		deployTime: "59s (5d ago)",
		deployedBy: "felix_m",
		deployedAt: "Apr 17",
	},
	{
		id: "rhvkn52a4",
		environment: "Production",
		status: "Ready",
		branch: "main",
		commit: "8df5c21",
		commitType: "b",
		deployTime: "1m 5s (6d ago)",
		deployedBy: "felix_m",
		deployedAt: "Apr 16",
	},
];

const router = useRouter();

// State
const searchTerm = ref("");
const selectedDateRange = ref("");
const deployments = ref(mockDeployments);

// Filter deployments based on search term
const handleSearch = (e) => {
	const term = e.target.value.toLowerCase();
	searchTerm.value = term;

	if (!term) {
		deployments.value = mockDeployments;
		return;
	}

	deployments.value = mockDeployments.filter(
		(deployment) =>
			deployment.id.toLowerCase().includes(term) ||
			deployment.environment.toLowerCase().includes(term) ||
			deployment.branch.toLowerCase().includes(term) ||
			deployment.commit.toLowerCase().includes(term),
	);
};

// Actions
const openDeploymentDetails = (id) => {
	// Implementation would depend on your router setup
	console.log(`Opening deployment ${id}`);
};

// Toggle more options
const toggleMoreOptions = (id) => {
	console.log(`Toggling options for ${id}`);
};

const deployUrl = function (id) {
	//return org id project id deployid
	const orgId = router.currentRoute.value.params.orgId;
	const projectId = router.currentRoute.value.params.projectId;
	const deployId = router.currentRoute.value.params.deployId;
	return `/${orgId}/${projectId}/${id}`;
};
</script>

<template>
  <PageHeadingBar title="Deployments">
    <div class="flex items-center space-x-2">
      <button
        class="bg-white border px-4 py-1 rounded-md flex items-center text-sm"
      >
        Upgrade to Pro for bigger and faster builds
        <X class="ml-2 w-4 h-4" />
      </button>
      <button class="p-1">
        <MoreHorizontal class="w-5 h-5" />
      </button>
    </div>

    <template #secondary>
      <div class="pb-6 flex items-center text-gray-600 text-sm">
        <span class="flex items-center">
          <RefreshCcw class="w-4 h-4 mr-2" />
          Continuously generated from
          <span class="inline-flex items-center ml-1 text-red-500">
            <div class="w-3 h-3 mr-1 bg-red-500 rounded-full"></div>
            felix_m/sTODODO
          </span>
        </span>
      </div>
    </template>
  </PageHeadingBar>

  <div class="container">
    <!-- Header -->

    <!-- Source Info -->

    <!-- Filters -->
    <div class="flex gap-4 mb-4">
      <div class="relative flex-1 max-w-xs">
        <Search
          class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4"
        />
        <Input
          type="text"
          placeholder="All Branches..."
          class="border pl-10 pr-4 py-2 rounded-md w-full"
          v-model="searchTerm"
          @input="handleSearch"
        />
        <button class="absolute right-2 top-1/2 transform -translate-y-1/2">
          <MoreHorizontal class="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div class="relative flex-1 max-w-xs">
        <button
          class="border flex items-center px-4 py-2 rounded-md w-full justify-between"
        >
          <div class="flex items-center">
            <Calendar class="w-5 h-5 mr-2" />
            Select Date Range
          </div>
        </button>
      </div>

      <div class="flex items-center border rounded-md px-4 py-2">
        <span class="text-sm">Status</span>
        <div class="flex items-center ml-2 gap-1">
          <span class="bg-gray-200 px-2 py-0.5 rounded-md text-xs">5</span>
          <span>/</span>
          <span class="bg-gray-200 px-2 py-0.5 rounded-md text-xs">6</span>
        </div>
        <button class="ml-2">
          <MoreHorizontal class="w-5 h-5 text-gray-400" />
        </button>
      </div>
    </div>

    <!-- Deployments Table -->
    <div class="border rounded-lg overflow-hidden bg-white">
      <div
        v-for="(deployment, index) in deployments"
        :key="deployment.id"
        class="flex items-center p-4"
        :class="{ 'border-b': index !== deployments.length - 1 }"
      >
        <div class="flex-1">
          <div class="flex items-center">
            <!-- 
            <button
              class="bg-gray-200 text-gray-600 px-2 py-1 rounded-md text-sm"
              @click="openDeploymentDetails(deployment.id)"
            >
              View Details
            </button> -->

            <router-link :to="deployUrl(deployment.id)">
              <h3 class="font-mono text-sm font-medium">{{ deployment.id }}</h3>
            </router-link>
            <span
              v-if="deployment.isCurrent"
              class="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded"
            >
              Current
            </span>
          </div>
          <div class="flex items-center">
            <span class="text-sm text-gray-600">{{
              deployment.environment
            }}</span>
            <Info
              v-if="deployment.isCurrent"
              class="w-4 h-4 ml-1 text-blue-500"
            />
          </div>
        </div>

        <div class="flex-1">
          <router-link :to="deployUrl(deployment.id)">
            <div class="flex items-center">
              <div
                class="h-3 w-3 rounded-full mr-2"
                :class="{
                  'bg-green-400': deployment.status === 'Ready',
                  'bg-yellow-400': deployment.status !== 'Ready',
                }"
              ></div>
              {{ deployment.status }}
            </div>
            <div class="text-sm text-gray-600">{{ deployment.deployTime }}</div>
          </router-link>
        </div>

        <div class="flex-1">
          <div class="flex items-center">
            <GitBranch class="h-4 w-4 mr-1 text-gray-600" />
            <span class="text-sm">{{ deployment.branch }}</span>
          </div>
          <div class="flex items-center text-sm text-gray-600">
            <span class="font-mono">{{ deployment.commit }}</span>
            <span class="ml-1">{{ deployment.commitType }}</span>
          </div>
        </div>

        <div class="flex-1 text-right">
          <div class="text-sm">
            {{ deployment.deployedAt }} by {{ deployment.deployedBy }}
          </div>
          <div class="flex items-center justify-end mt-1">
            <div
              class="w-6 h-6 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white text-xs overflow-hidden"
            >
              F
            </div>
          </div>
        </div>

        <div class="ml-4">
          <button @click="toggleMoreOptions(deployment.id)">
            <MoreHorizontal class="h-5 w-5 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Additional styling can be added here if needed */
</style>
