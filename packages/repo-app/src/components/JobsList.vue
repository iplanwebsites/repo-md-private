<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import trpc from "@/trpc";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-vue-next";

const route = useRoute();
const project = ref(null);
const isLoading = ref(true);
const error = ref(null);
const jobs = ref([]);

// Get project data
const fetchProject = async () => {
	try {
		isLoading.value = true;
		error.value = null;

		const response = await trpc.cloudrun.getProject.query({
			projectId: route.params.projectId,
		});

		if (response.success) {
			project.value = response.project;
			fetchJobs();
		} else {
			throw new Error("Failed to load project");
		}
	} catch (err) {
		console.error("Error loading project:", err);
		error.value = err.message || "Failed to load project details";
		isLoading.value = false;
	}
};

const fetchJobs = async () => {
	try {
		isLoading.value = true;
		error.value = null;

		const response = await trpc.cloudrun.getJobs.query({
			projectId: project.value.id,
		});

		if (response.success) {
			jobs.value = response.jobs;
		} else {
			throw new Error("Failed to load jobs");
		}
	} catch (err) {
		console.error("Error loading jobs:", err);
		error.value = err.message || "Failed to load jobs";
	} finally {
		isLoading.value = false;
	}
};

const formatDate = (dateString) => {
	return new Date(dateString).toLocaleString();
};

onMounted(() => {
	fetchProject();
});

// Job status classes
const getStatusClass = (status) => {
	switch (status) {
		case "completed":
			return "bg-green-100 text-green-800 border-green-200";
		case "failed":
			return "bg-red-100 text-red-800 border-red-200";
		case "pending":
			return "bg-yellow-100 text-yellow-800 border-yellow-200";
		case "processing":
			return "bg-blue-100 text-blue-800 border-blue-200";
		default:
			return "bg-gray-100 text-gray-800 border-gray-200";
	}
};
</script>

<template>
  <div class="w-full">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center p-12">
      <RefreshCcw class="w-8 h-8 animate-spin text-blue-500" />
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="p-8 max-w-4xl mx-auto">
      <div class="bg-red-50 border border-red-200 rounded-md p-6">
        <h3 class="text-lg font-semibold text-red-800 mb-2">
          Error Loading Jobs
        </h3>
        <p class="text-red-600">{{ error }}</p>
        <Button @click="fetchJobs" variant="outline" class="mt-4">
          Retry
        </Button>
      </div>
    </div>

    <!-- Jobs List -->
    <div v-else>
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">Recent Jobs</h2>
        </div>
        
        <div v-if="jobs.length === 0" class="p-8 text-center">
          <p class="text-gray-500">No jobs found for this project.</p>
        </div>
        
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="job in jobs" :key="job._id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 py-1 text-xs rounded-full bg-gray-100">{{ job.type }}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="['px-2 py-1 text-xs rounded-full border', getStatusClass(job.status)]">
                    {{ job.status }}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <div v-if="job.type === 'repo_clone'" class="text-sm text-gray-900">
                    <div>
                      <span class="font-medium">Repo:</span> 
                      {{ job.input.repoName }}
                    </div>
                    <div>
                      <span class="font-medium">Owner:</span> 
                      {{ job.input.owner }}
                    </div>
                    <div>
                      <span class="font-medium">New Repo:</span> 
                      {{ job.input.newRepoName }}
                    </div>
                    <div class="text-xs text-gray-500 mt-1 truncate max-w-md">
                      {{ job.input.description }}
                    </div>
                  </div>
                  <div v-else class="text-sm text-gray-900">
                    {{ job.input ? JSON.stringify(job.input).substring(0, 100) + '...' : 'No details' }}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(job.createdAt) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(job.updatedAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <div class="mt-4 flex justify-end">
        <Button @click="fetchJobs" variant="outline" size="sm" class="flex items-center gap-2">
          <RefreshCcw class="w-4 h-4" />
          Refresh
        </Button>
      </div>
    </div>
  </div>
</template>