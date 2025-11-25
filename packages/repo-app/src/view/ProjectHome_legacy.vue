<script setup>
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import PageHeadingBar from "@/components/PageHeadingBar.vue";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast/use-toast";
import trpc from "@/trpc";
import {
	Search,
	ChevronDown,
	LayoutGrid,
	List,
	Github,
	GitBranch,
	MoreHorizontal,
	AlertCircle,
	Activity,
	ArrowRight,
	RotateCw,
	Shield,
	X,
	LineChart,
	TrendingUp,
	ExternalLink,
} from "lucide-vue-next";

// Props for project data passed from parent
const props = defineProps({
	project: {
		type: Object,
		default: null,
	},
});

// Route information
const route = useRoute();
const router = useRouter();
const params = route.params;

// Check if project data is available
const hasProject = computed(() => !!props.project);

// Default values for null/undefined properties
const defaultDomain = computed(() => {
	const slug = props.project?.slug || params.projectId || "project";
	return `${slug}.api.repo.md`;
});

// Format dates for display
const formatDate = (dateString) => {
	if (!dateString) return "recently";
	return new Date(dateString).toLocaleDateString();
};

// Simplified computed properties that use project data directly with fallbacks
const projectId = computed(
	() => props.project?._id || props.project?.slug || params.projectId,
);
const projectName = computed(
	() => props.project?.name || props.project?.slug || params.projectId,
);
const projectSlug = computed(() => props.project?.slug || params.projectId);
const projectDescription = computed(() => props.project?.description || "");
const projectStatus = computed(() => props.project?.status || "ready");
const projectVisibility = computed(
	() => props.project?.visibility || "private",
);
const projectOrgId = computed(() => props.project?.orgId || "");
const projectDomains = computed(() => {
	if (props.project?.domains?.length) return props.project.domains;
	return [
		{ url: props.project?.domain || defaultDomain.value, verified: true },
	];
});
const projectUpdatedAt = computed(() => formatDate(props.project?.updatedAt));
const projectCreatedAt = computed(() => formatDate(props.project?.createdAt));
const projectBranch = computed(
	() =>
		props.project?.github?.repoName ||
		props.project?.githubRepo?.branch ||
		"main",
);
const projectRevision = computed(
	() =>
		props.project?.activeRev || props.project?.githubRepo?.commit || "latest",
);
const projectGithubInfo = computed(() => props.project?.github || null);

// Deployment metrics
const metrics = ref({
	firewall: {
		status: "active",
		requestsDenied: 2,
		timeframe: "24h",
	},
	observability: {
		edgeRequests: 105,
		functionInvocations: 0,
		errorRate: "0%",
		timeframe: "6h",
	},
});

// UI state
const activeTab = ref("project");
const searchQuery = ref("");
const isGridView = ref(true);
const sortOption = ref("activity");
const showDeployConfig = ref(false);

// Methods
const setActiveTab = (tabId) => {
	activeTab.value = tabId;
};

const toggleDeployConfig = () => {
	showDeployConfig.value = !showDeployConfig.value;
};

// Toast setup
const { toast } = useToast();

// Redeploy button state
const redeploying = ref(false);

// Redeploy project
const redeployProject = async () => {
	if (redeploying.value || !hasProject.value) return;

	redeploying.value = true;

	try {
		// Use the computed property directly
		const response = await trpc.cloudRun.createRepoDeployJob.mutate({
			projectId: projectId.value,
		});

		console.log("Project redeploy response:", response);

		if (response.success) {
			// Show success toast
			toast({
				title: "Redeployment Started",
				description:
					"Your project is being redeployed and will be updated shortly.",
				variant: "default",
			});

			// Redirect to dashboard if provided
			if (response.job && response.job.projectId) {
				// Wait a short moment to ensure the toast is visible before redirect
				setTimeout(() => {
					const redirectUrl =
						response.dashboardUrl || response.job.dashboardUrl;
					if (redirectUrl) {
						// Use router-link programmatically via $router instead of router.push
						// Since this is in a function handling an API response, we need to use
						// the router object directly here
						router.push(redirectUrl);
					}
				}, 1500);
			}
		}
	} catch (error) {
		console.error("Error redeploying project:", error);
		const errorMessage = error.message || "Failed to redeploy project";

		// Show error toast
		toast({
			title: "Redeploy Failed",
			description: errorMessage,
			variant: "destructive",
		});
	} finally {
		redeploying.value = false;
	}
};
</script>

<template>
  <div>
    <!-- Project Header -->
    <json-debug v-if="hasProject" :data="props.project" label="project (raw prop data)" />

    <PageHeadingBar v-if="hasProject" :title="projectName" :titleWeight="900">
      <div v-if="projectDescription" class="text-sm text-gray-500 mt-1">
        {{ projectDescription }}
      </div>
      
      <template #actions>
        <div class="flex items-center space-x-2">
          <a 
            v-if="projectGithubInfo" 
            :href="`https://github.com/${projectGithubInfo.fullName}`" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Button class=" " variant="outline">
              <span class="flex items-center">
                <span class="mr-2">GitHub</span>
                <Github class="h-4 w-4" />
              </span>
            </Button>
          </a>
          <Button variant="outline" class=" "> Usage </Button>
          <Button variant="outline" class=" "> Domains </Button>
          <a 
            :href="`https://${projectDomains[0]?.url}`" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Button class="">
              Visit site
              <ExternalLink class="h-4 w-4 ml-1" />
            </Button>
          </a>
        </div>
      </template>
    </PageHeadingBar>

    <div v-if="hasProject" class="container">
      <!-- Production Deployment Section -->
      <div class="p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-medium">Production Deployment</h2>
          <div class="flex space-x-2">
            <!-- 
            <Button class=" "> Build Logs </Button>
             -->
            <router-link 
              v-if="hasProject && props.project.activeRev"
              :to="`/${projectOrgId}/${projectName}/${props.project.activeRev}/posts`"
            >
              <Button class="0" variant="outline">
                Pages
              </Button>
            </router-link>
            <Button v-else class="0" variant="outline" disabled>
              Pages
            </Button>
            <Button
              class="nter"
              variant="outline"
              @click="redeployProject"
              :disabled="redeploying"
            >
              <RotateCw
                class="h-4 w-4 mr-1"
                :class="{ 'animate-spin': redeploying }"
              />
              {{ redeploying ? "Redeploying..." : "Redeploy" }}
            </Button>
          </div>
        </div>

        <!-- Deployment Content -->
        <div
          class="bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm"
        >
          <div class="grid grid-cols-12 gap-4">
            <!-- Left side - Deployment Visualization -->
            <div class="col-span-5 p-6">
              <div
                class="bg-gray-50 h-full rounded-lg border border-gray-200 flex items-center justify-center"
              >
                <!-- Deployment Visualization Placeholder -->
                <div class="text-center">
                  <div class="mb-8">
                    <span
                      class="inline-block px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs"
                    >
                      Git Deployed
                    </span>
                  </div>
                  <div class="grid grid-cols-3 gap-8">
                    <div class="flex flex-col items-center">
                      <div
                        class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2"
                      >
                        <span class="text-blue-600">100%</span>
                      </div>
                      <span class="text-xs text-gray-500 text-center"
                        >Security score for static website</span
                      >
                    </div>
                    <div class="flex flex-col items-center">
                      <div
                        class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2"
                      >
                        <span class="text-blue-600">80%</span>
                      </div>
                      <span class="text-xs text-gray-500 text-center"
                        >Performance rating across regions</span
                      >
                    </div>
                    <div class="flex flex-col items-center">
                      <div
                        class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2"
                      >
                        <span class="text-blue-600">0</span>
                      </div>
                      <span class="text-xs text-gray-500 text-center"
                        >Deploys needed (Auto-Fixed)</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right side - Deployment Info -->
            <div class="col-span-7 p-6">
              <div class="space-y-6">
                <!-- Deployment ID -->
                <div v-if="hasProject">
                  <h3 class="text-gray-500 text-sm mb-1">Deployment</h3>
                  <p>{{ defaultDomain }}</p>
                </div>

                <!-- Domains -->
                <div v-if="hasProject">
                  <h3 class="text-gray-500 text-sm mb-1">Domains</h3>
                  <div class="space-y-2">
                    <div
                      v-for="(domain, index) in projectDomains"
                      :key="index"
                      class="flex items-center"
                    >
                      <a
                        :href="`https://${domain.url}`"
                        target="_blank"
                        class="text-blue-600 hover:underline flex items-center"
                      >
                        {{ domain.url }}
                        <ArrowRight class="h-3 w-3 ml-1" />
                      </a>
                      <span
                        v-if="index === 1 && projectDomains.length > 2"
                        class="ml-2 text-xs text-gray-500"
                        >+{{ projectDomains.length - 2 }}</span
                      >
                    </div>
                  </div>
                </div>

                <!-- Status -->
                <div v-if="hasProject">
                  <h3 class="text-gray-500 text-sm mb-1">Status</h3>
                  <div class="flex items-center">
                    <div class="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                    <span>{{ projectStatus }}</span>
                    <span class="ml-2 text-gray-500">Updated: {{ projectUpdatedAt }}</span>
                  </div>
                  <div class="flex items-center mt-1 text-xs text-gray-500">
                    <span>Job ID: {{ props.project.jobId || "N/A" }}</span>
                    <span class="ml-2">Rev: {{ props.project.activeRev || "N/A" }}</span>
                  </div>
                </div>

                <!-- Source -->
                <div v-if="hasProject">
                  <h3 class="text-gray-500 text-sm mb-1">Source</h3>
                  <div class="space-y-2">
                    <div class="flex items-center">
                      <GitBranch class="h-4 w-4 mr-2 text-gray-500" />
                      <span>{{ projectBranch }}</span>
                    </div>
                    <div class="flex items-center">
                      <span class="font-mono text-gray-500 mr-2">{{ projectRevision }}</span>
                      <span class="border border-gray-300 rounded px-1 text-xs">latest revision</span>
                    </div>
                    <div v-if="projectGithubInfo" class="flex items-center">
                      <Github class="h-4 w-4 mr-2 text-gray-500" />
                      <a 
                        :href="`https://github.com/${projectGithubInfo.fullName}`"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-gray-500 hover:text-blue-600 hover:underline"
                      >
                        {{ projectGithubInfo.fullName }}
                      </a>
                    </div>
                  </div>
                </div>
                
                <!-- Description -->
                <div v-if="hasProject && projectDescription">
                  <h3 class="text-gray-500 text-sm mb-1">Description</h3>
                  <p class="text-sm">
                    <template v-if="projectDescription.startsWith('Cloned from GitHub:')">
                      Cloned from GitHub: 
                      <a 
                        v-if="projectGithubInfo"
                        :href="`https://github.com/${projectGithubInfo.fullName}`"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-gray-500 hover:text-blue-600 hover:underline"
                      >
                        {{ projectGithubInfo.fullName }}
                      </a>
                    </template>
                    <template v-else>
                      {{ projectDescription }}
                    </template>
                  </p>
                </div>

                <!-- Visibility -->
                <div v-if="hasProject">
                  <h3 class="text-gray-500 text-sm mb-1">Settings</h3>
                  <div class="flex items-center">
                    <Shield class="h-4 w-4 mr-2 text-gray-500" />
                    <span class="capitalize">{{ projectVisibility }}</span>
                    <span v-if="projectOrgId" class="ml-2 text-gray-500">
                      • Org: 
                      <router-link 
                        :to="`/${projectOrgId}`" 
                        class="text-gray-500 hover:text-blue-600 hover:underline"
                      >
                        {{ projectOrgId }}
                      </router-link>
                    </span>
                  </div>
                  <div class="flex items-center mt-1">
                    <span class="text-xs text-gray-500">
                      Created: {{ projectCreatedAt }}
                    </span>
                  </div>
                </div>

                <!-- Collaborators -->
                <div v-if="hasProject && props.project.collaborators?.length">
                  <h3 class="text-gray-500 text-sm mb-1">Collaborators</h3>
                  <div class="space-y-1">
                    <div v-for="(collaborator, index) in props.project.collaborators" :key="index" class="flex items-center">
                      <div class="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-xs mr-2">
                        {{ collaborator.userId.substring(0, 2) }}
                      </div>
                      <span class="text-sm truncate max-w-[200px]">{{ collaborator.userId }}</span>
                      <span class="ml-2 text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 capitalize">
                        {{ collaborator.role }}
                      </span>
                      <span class="text-xs text-gray-400 ml-2">
                        Added: {{ formatDate(collaborator.addedAt) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Deployment Configuration -->
        <div
          class="mt-6 bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm"
        >
          <div
            class="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100"
            @click="toggleDeployConfig"
          >
            <div class="flex items-center">
              <ChevronDown
                class="h-5 w-5 mr-2"
                :class="{ 'transform rotate-180': !showDeployConfig }"
              />
              <span>Deployment Configuration</span>
            </div>
            <div class="flex items-center space-x-4">
              <div class="flex items-center">
                <div class="h-2 w-2 rounded-full bg-blue-600 mr-2"></div>
                <span class="text-sm">Fluid Compute</span>
              </div>
              <div class="flex items-center">
                <div class="h-2 w-2 rounded-full bg-blue-600 mr-2"></div>
                <span class="text-sm">Deployment Protection</span>
              </div>
              <div class="flex items-center">
                <div class="h-2 w-2 rounded-full bg-gray-400 mr-2"></div>
                <span class="text-sm">Skew Protection</span>
              </div>
            </div>
          </div>
          <div v-if="showDeployConfig" class="p-4 border-t border-gray-200">
            <p class="text-gray-600">
              To update your Production Deployment, push to the
              <span class="font-mono">main</span> branch.
            </p>
          </div>
        </div>

        <!-- Metrics Grid -->
        <div class="grid grid-cols-3 gap-6 mt-6">
          <!-- Firewall Metrics -->
          <div
            class="bg-white rounded-lg overflow-hidden border border-gray-200 p-4 shadow-sm"
          >
            <div class="flex items-center justify-between mb-4">
              <h3>
                Firewall
                <span class="text-gray-500 text-sm">{{
                  metrics.firewall.timeframe
                }}</span>
              </h3>
              <ArrowRight class="h-5 w-5" />
            </div>
            <div class="flex items-center justify-center p-8">
              <div class="relative">
                <div
                  class="w-24 h-24 rounded-full border-4 border-blue-200 flex items-center justify-center"
                >
                  <div
                    class="absolute inset-0 flex items-center justify-center"
                  >
                    <Shield class="text-blue-600 w-10 h-10" />
                  </div>
                </div>
              </div>
            </div>
            <div class="text-center">
              <p class="text-blue-600">Firewall is active</p>
              <p class="flex items-center justify-center mt-2 text-sm">
                <X class="mr-1 w-4 h-4" />
                {{ metrics.firewall.requestsDenied }} requests denied
              </p>
            </div>
          </div>

          <!-- Observability Metrics -->
          <div
            class="bg-white rounded-lg overflow-hidden border border-gray-200 p-4 shadow-sm"
          >
            <div class="flex items-center justify-between mb-4">
              <h3>
                Observability
                <span class="text-gray-500 text-sm">{{
                  metrics.observability.timeframe
                }}</span>
              </h3>
              <ArrowRight class="h-5 w-5" />
            </div>
            <div class="space-y-4">
              <div>
                <div class="flex justify-between text-sm mb-1">
                  <span class="text-gray-500">Edge Requests</span>
                  <span>{{ metrics.observability.edgeRequests }}</span>
                </div>
                <div
                  class="h-10 bg-gray-100 rounded-md flex items-end overflow-hidden"
                >
                  <!-- Using LineChart component -->
                  <Activity class="w-full h-9 text-blue-600" />
                </div>
              </div>
              <div>
                <div class="flex justify-between text-sm mb-1">
                  <span class="text-gray-500">Function Invocations</span>
                  <span>{{ metrics.observability.functionInvocations }}</span>
                </div>
              </div>
              <div>
                <div class="flex justify-between text-sm mb-1">
                  <span class="text-gray-500">Error Rate</span>
                  <span>{{ metrics.observability.errorRate }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Analytics Metrics -->
          <div
            class="bg-white rounded-lg overflow-hidden border border-gray-200 p-4 shadow-sm"
          >
            <div class="flex items-center justify-between mb-4">
              <h3>Analytics</h3>
              <ArrowRight class="h-5 w-5" />
            </div>
            <div class="flex flex-col items-center justify-center h-40">
              <div class="flex items-center">
                <TrendingUp class="mr-2 w-5 h-5" />
                <span>Track visitors and page views</span>
              </div>
              <Button
                class="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Enable
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Add any additional component-specific styles here */
</style>
