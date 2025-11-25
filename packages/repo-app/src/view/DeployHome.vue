<script setup>
import { ref, computed, inject, provide } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
	ChevronDown,
	ChevronRight,
	Github,
	GitBranch,
	MoreHorizontal,
	ArrowRight,
	Clock,
	Globe,
	Code,
	Check,
	X,
	Loader,
	CheckCircle,
} from "lucide-vue-next";
import LogViewer from "@/components/LogViewer.vue";
import PageHeadingBar from "@/components/PageHeadingBar.vue";
import { setActiveDeployment } from "@/lib/deploymentUtils";
import { Button } from "@/components/ui/button";

// Define props from parent
const props = defineProps({
	deployment: {
		type: Object,
		required: true,
	},
	isLoading: {
		type: Boolean,
		default: false,
	},
	error: {
		type: [String, Object, null],
		default: null,
	},
	project: {
		type: Object,
		default: null,
	},
});

// Define emits to parent
const emit = defineEmits(["refresh"]);

// Route information
const route = useRoute();
const router = useRouter();

// UI state
const expandedSections = ref({
	configuration: false,
	buildLogs: false,
	summary: false,
	customDomains: false,
});

// Loading state for activation
const isActivating = ref(false);

// Computed properties
const currentDeploymentId = computed(() => {
	return props.deployment?.id || props.deployment?.rawData?._id || route.params.deployId;
});

const isActiveDeployment = computed(() => {
	return currentDeploymentId.value === props.project?.activeRev;
});

const activeRevisionShort = computed(() => {
	if (!props.project?.activeRev) return null;
	return props.project.activeRev.slice(-6);
});

const activeRevisionUrl = computed(() => {
	if (!props.project?.activeRev) return null;
	return `/${route.params.orgId}/${route.params.projectId}/${props.project.activeRev}`;
});

// Methods
const toggleSection = (section) => {
	expandedSections.value[section] = !expandedSections.value[section];
};

// Handle refresh
const refreshData = () => {
	emit("refresh");
};

// Handle activation of this deployment
const handleActivateDeployment = async () => {
	if (!props.project?._id || !currentDeploymentId.value) return;
	
	isActivating.value = true;
	try {
		await setActiveDeployment(props.project._id, currentDeploymentId.value, {
			onSuccess: (response) => {
				// Refresh the data to show updated status
				refreshData();
			}
		});
	} catch (error) {
		// Error is already handled in setActiveDeployment
	} finally {
		isActivating.value = false;
	}
};

// Check if deployment can be activated
const canActivate = computed(() => {
	const deploymentStatus = props.deployment?.rawData?.status || props.deployment?.status;
	const isCompleted = deploymentStatus?.toLowerCase() === 'completed';
	return isCompleted && !isActiveDeployment.value;
});
</script>

<template>
  <div class=" ">
    <json-debug :data="deployment.rawData" />
    <!-- Project Header -->
    <PageHeadingBar :title="deployment.name" titleSize="2xl">
      <div class="flex items-center space-x-2">
        <Button 
          v-if="canActivate"
          @click="handleActivateDeployment"
          :disabled="isActivating"
          class="flex items-center"
        >
          <Loader v-if="isActivating" class="h-4 w-4 mr-2 animate-spin" />
          <CheckCircle v-else class="h-4 w-4 mr-2" />
          <span>Use this version</span>
        </Button>
        <Button variant="outline" class="flex items-center">
          <span class="mr-1">Share</span>
        </Button>
        <div class="flex">
          <Button class="rounded-r-none">Visit</Button>
          <Button class="rounded-l-none border-l border-gray-700 px-2">
            <ChevronDown class="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          class="p-2"
          @click="refreshData"
          :disabled="isLoading"
        >
          <Loader v-if="isLoading" class="h-4 w-4 animate-spin" />
          <MoreHorizontal v-else class="h-4 w-4" />
        </Button>
      </div>
    </PageHeadingBar>

    <!-- Main Deployment Card -->
    <div class="container">
      <div
        class="border border-gray-200 rounded-lg overflow-hidden bg-white mb-4"
      >
        <div class="flex flex-row">
          <!-- Preview Section -->
          <div class="w-1/2 p-4 border-r border-gray-200">
            <div class="bg-gray-100 rounded-md overflow-hidden h-full">
              <!-- Loading state -->
              <div
                v-if="isLoading"
                class="flex items-center justify-center h-64"
              >
                <Loader class="h-10 w-10 text-gray-400 animate-spin" />
              </div>

              <!-- Image preview once loaded -->
              <div v-else>
                <img
                  src="https://placehold.co/600x400/EEE/31343C"
                  alt="Deployment preview"
                  class="w-full"
                />
                <!-- Scores -->
                <div class="flex justify-around py-4">
                  <div class="flex flex-col items-center">
                    <div class="text-blue-500 text-xl font-bold">
                      {{ deployment.scores.performance }}
                    </div>
                    <div
                      class="text-xs text-gray-500 mt-1 max-w-24 text-center"
                    >
                      DESIGNED RESPONSIVE DESKTOP & MOBILE
                    </div>
                  </div>
                  <div class="flex flex-col items-center">
                    <div class="text-blue-500 text-xl font-bold">
                      {{ deployment.scores.security }}
                    </div>
                    <div
                      class="text-xs text-gray-500 mt-1 max-w-24 text-center"
                    >
                      CROSS-BROWSER MEMORY-SAFE JAVASCRIPT
                    </div>
                  </div>
                  <div class="flex flex-col items-center">
                    <div class="text-blue-500 text-xl font-bold">
                      {{ deployment.scores.accessibility }}
                    </div>
                    <div
                      class="text-xs text-gray-500 mt-1 max-w-24 text-center"
                    >
                      CONTRAST ACCESSIBILITY KEYBOARD SUPPORT
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="w-1/2">
            <!-- Deployment Info Section -->
            <div class="grid grid-cols-2 gap-4 p-4 border-b border-gray-200">
              <!-- Created -->
              <div>
                <h3 class="text-gray-500 text-sm font-medium mb-2">Created</h3>
                <div class="flex items-center">
                  <div class="w-6 h-6 bg-gray-200 rounded-full mr-2"></div>
                  <span>{{ deployment.created.by }}</span>
                  <span class="text-gray-500 ml-2 text-sm">{{
                    deployment.created.time
                  }}</span>
                </div>
              </div>

              <!-- Status -->
              <div>
                <h3 class="text-gray-500 text-sm font-medium mb-2">Status</h3>
                <div class="space-y-2">
                  <div class="flex items-center">
                    <div class="flex items-center">
                      <div
                        class="w-2 h-2 rounded-full mr-2"
                        :class="{
                          'bg-green-500': deployment.status === 'completed',
                          'bg-red-500': deployment.status === 'failed',
                          'bg-yellow-500':
                            deployment.status === 'pending' ||
                            deployment.status === 'processing',
                          'bg-blue-500': deployment.status === 'queued',
                          'bg-gray-500': !deployment.status,
                        }"
                      ></div>
                      <span
                        :class="{
                          'text-red-600': deployment.status === 'failed',
                          'text-yellow-600':
                            deployment.status === 'pending' ||
                            deployment.status === 'processing',
                          'text-blue-600': deployment.status === 'queued',
                        }"
                        >{{ deployment.status }}</span
                      >
                    </div>
                    <span class="ml-2 text-gray-500 text-sm">{{
                      deployment.statusLabel
                    }}</span>
                  </div>
                  
                  <!-- Active/Inactive Status -->
                  <div class="flex items-center">
                    <div v-if="isActiveDeployment" class="flex items-center">
                      <div class="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      <span class="text-green-600 text-sm font-medium">Active Deployment</span>
                    </div>
                    <div v-else-if="activeRevisionShort" class="flex items-center">
                      <div class="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                      <span class="text-gray-600 text-sm">Inactive - Current revision:</span>
                      <router-link 
                        :to="activeRevisionUrl"
                        class="ml-1 text-blue-600 hover:underline font-mono text-sm"
                      >
                        {{ activeRevisionShort }}
                      </router-link>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Duration -->
              <div>
                <h3 class="text-gray-500 text-sm font-medium mb-2">Duration</h3>
                <div class="flex items-center">
                  <Clock class="w-4 h-4 text-gray-500 mr-2" />
                  <span>{{ deployment.duration.value }}</span>
                  <span class="ml-2 text-gray-500 text-sm">{{
                    deployment.duration.time
                  }}</span>
                </div>
              </div>

              <!-- Environment -->
              <div>
                <h3 class="text-gray-500 text-sm font-medium mb-2">
                  Environment
                </h3>
                <div class="flex items-center">
                  <span>{{ deployment.environment.type }}</span>
                  <span
                    class="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded"
                  >
                    {{ deployment.environment.label }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Domains Section -->
            <div class="px-4 py-3 border-b border-gray-200">
              <h3 class="text-gray-500 text-sm font-medium mb-2">Domains</h3>
              <div class="space-y-2">
                <div
                  class="flex items-center"
                  v-for="(domain, index) in deployment.domains"
                  :key="index"
                >
                  <Globe
                    v-if="index === 0"
                    class="w-4 h-4 text-gray-500 mr-2"
                  />
                  <div v-else class="w-4 mr-2"></div>
                  <span
                    v-if="deployment.status === 'failed'"
                    class="text-red-600"
                    >{{ domain.url }}</span
                  >
                  <a v-else href="#" class="text-blue-600 hover:underline">{{
                    domain.url
                  }}</a>
                  <span
                    v-if="domain.additional"
                    class="ml-2 text-gray-500 text-sm"
                    >{{ domain.additional }}</span
                  >
                </div>
              </div>
            </div>

            <!-- Source Section -->
            <div class="px-4 py-3">
              <h3 class="text-gray-500 text-sm font-medium mb-2">Source</h3>
              <div class="space-y-2">
                <div class="flex items-center">
                  <Code class="w-4 h-4 text-gray-500 mr-2" />
                  <span>{{ deployment.source?.branch || deployment.rawData?.input?.branch || 'main' }}</span>
                </div>
                <div class="flex items-center">
                  <div class="w-4 mr-2"></div>
                  <a
                    v-if="deployment.rawData?.input?.commit && props.project?.github?.fullName"
                    :href="`https://github.com/${props.project.github.fullName}/commit/${deployment.rawData.input.commit}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-mono text-blue-600 hover:underline"
                  >
                    {{ deployment.rawData.input.commit.slice(0, 7) }}
                  </a>
                  <span 
                    v-else
                    class="font-mono text-gray-500"
                  >
                    {{ deployment.source?.commit || deployment.rawData?.input?.commit?.slice(0, 7) || 'unknown' }}
                  </span>
                  <span
                    class="ml-2 border border-gray-300 rounded px-1 text-xs"
                  >
                    {{ deployment.source?.commitType || 'commit' }}
                  </span>
                </div>
                <div 
                  v-if="deployment.rawData?.input?.message"
                  class="flex items-start"
                >
                  <div class="w-4 mr-2 mt-1">
                    <div class="w-1 h-1 bg-gray-400 rounded-full"></div>
                  </div>
                  <span class="text-sm text-gray-600 break-words">{{ deployment.rawData.input.message }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Configuration Section -->
      <div
        class="border border-gray-200 rounded-lg overflow-hidden bg-white mb-4"
      >
        <div
          class="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
          @click="toggleSection('configuration')"
        >
          <div class="flex items-center">
            <ChevronRight
              class="h-5 w-5 mr-2"
              :class="{ 'transform rotate-90': expandedSections.configuration }"
            />
            <span class="font-medium">Deployment Configuration</span>
          </div>
          <div class="flex items-center space-x-4">
            <div class="flex items-center">
              <X
                v-if="!deployment.configuration.fluidCompute"
                class="w-4 h-4 text-gray-400 mr-1"
              />
              <Check v-else class="w-4 h-4 text-blue-600 mr-1" />
              <span class="text-sm">Fluid Compute</span>
            </div>
            <div class="flex items-center">
              <Check
                v-if="deployment.configuration.deploymentProtection"
                class="w-4 h-4 text-blue-600 mr-1"
              />
              <X v-else class="w-4 h-4 text-gray-400 mr-1" />
              <span class="text-sm">Deployment Protection</span>
            </div>
            <div class="flex items-center">
              <X
                v-if="!deployment.configuration.skewProtection"
                class="w-4 h-4 text-gray-400 mr-1"
              />
              <Check v-else class="w-4 h-4 text-blue-600 mr-1" />
              <span class="text-sm">Skew Protection</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Build Logs Section -->
      <div
        class="border border-gray-200 rounded-lg overflow-hidden bg-white mb-4"
      >
        <div
          class="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
          @click="toggleSection('buildLogs')"
        >
          <div class="flex items-center">
            <ChevronRight
              class="h-5 w-5 mr-2"
              :class="{ 'transform rotate-90': expandedSections.buildLogs }"
            />
            <span class="font-medium">Build Logs</span>
          </div>
          <div class="flex items-center">
            <span>{{ deployment.buildLogs?.duration }}</span>
            <Check class="w-4 h-4 text-green-500 ml-2" />
          </div>
        </div>

        <!-- Expanded build logs content -->
        <div
          v-if="expandedSections.buildLogs"
          class="p-4 border-t border-gray-200"
        >
          <LogViewer
            :logs="deployment.logs || []"
            :jobInfo="deployment"
            title="Build & Conversion Logs"
            subtitle="Internal logs of the repository processing"
            :showInfo="false"
            maxHeight="7850px"
          />
        </div>
      </div>

      <!-- Deployment Summary Section -->
      <div
        class="border border-gray-200 rounded-lg overflow-hidden bg-white mb-4"
      >
        <div
          class="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
          @click="toggleSection('summary')"
        >
          <div class="flex items-center">
            <ChevronRight
              class="h-5 w-5 mr-2"
              :class="{ 'transform rotate-90': expandedSections.summary }"
            />
            <span class="font-medium">Deployment Summary</span>
          </div>
          <div class="flex items-center">
            <button class="bg-gray-100 px-3 py-1 rounded-md text-sm mr-2">
              {{ deployment.summary.all }}
            </button>
            <button class="bg-gray-100 px-3 py-1 rounded-md text-sm mr-2">
              <div class="flex items-center">
                <svg
                  class="w-4 h-4 mr-1"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                {{ deployment.summary.count }}
              </div>
            </button>
            <span>{{ deployment.summary.duration }}</span>
            <Check class="w-4 h-4 text-green-500 ml-2" />
          </div>
        </div>
      </div>

      <!-- Custom Domains Section -->
      <div
        class="border border-gray-200 rounded-lg overflow-hidden bg-white mb-6"
      >
        <div
          class="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
          @click="toggleSection('customDomains')"
        >
          <div class="flex items-center">
            <ChevronRight
              class="h-5 w-5 mr-2"
              :class="{ 'transform rotate-90': expandedSections.customDomains }"
            />
            <span class="font-medium">Assigning Custom Domains</span>
          </div>
          <div class="flex items-center">
            <span>{{ deployment.customDomains.duration }}</span>
            <Check class="w-4 h-4 text-green-500 ml-2" />
          </div>
        </div>
      </div>

      <!-- Bottom Cards Grid -->
      <div class="grid grid-cols-4 gap-4 mb-6">
        <!-- Runtime Logs -->
        <div
          class="border border-gray-200 rounded-lg overflow-hidden bg-white p-4"
        >
          <h3 class="font-medium mb-2">Runtime Logs</h3>
          <p class="text-sm text-gray-500">
            {{ deployment.runtimeLogs.description }}
          </p>
        </div>

        <!-- Observability -->
        <div
          class="border border-gray-200 rounded-lg overflow-hidden bg-white p-4"
        >
          <h3 class="font-medium mb-2">Observability</h3>
          <p class="text-sm text-gray-500">
            {{ deployment.observability.description }}
          </p>
        </div>

        <!-- Web Analytics -->
        <div
          class="border border-gray-200 rounded-lg overflow-hidden bg-white p-4"
        >
          <div class="flex justify-between items-center mb-2">
            <h3 class="font-medium">Web Analytics</h3>
            <span class="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded"
              >Not Enabled</span
            >
          </div>
          <p class="text-sm text-gray-500">
            {{ deployment.webAnalytics.description }}
          </p>
        </div>

        <!-- Speed Insights -->
        <div
          class="border border-gray-200 rounded-lg overflow-hidden bg-white p-4"
        >
          <div class="flex justify-between items-center mb-2">
            <h3 class="font-medium">Speed Insights</h3>
            <span class="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded"
              >Not Enabled</span
            >
          </div>
          <p class="text-sm text-gray-500">
            {{ deployment.speedInsights.description }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Add any additional component-specific styles here */
</style>
