<script setup>
import { ref, computed } from "vue";
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
} from "lucide-vue-next";

// Route information
const route = useRoute();
const router = useRouter();
const params = route.params;
const projectId = params.projectId; // This would come from route in a real app
const orgId = params.orgId; // This would come from route in a real app

// Mock data for current deployment
const currentDeployment = ref({
	id: "myKoko-app",
	name: "Deployment Details",
	created: {
		by: "felix_m",
		time: "22h ago",
	},
	status: "Ready",
	statusLabel: "Latest",
	duration: {
		value: "1m 1s",
		time: "22h ago",
	},
	environment: {
		type: "Production",
		label: "Current",
	},
	domains: [
		{ url: "myKoko.io", additional: "+4" },
		{ url: "myKoko-app-git-main-felix-m.repomd.app" },
		{ url: "myKoko-yjc4gjdsd-felix-m.repomd.app" },
	],
	source: {
		branch: "main",
		commit: "b58a62e",
		commitType: "a",
	},
	scores: {
		performance: 70,
		security: 82,
		accessibility: 94,
	},
	configuration: {
		fluidCompute: false,
		deploymentProtection: true,
		skewProtection: false,
	},
	buildLogs: {
		duration: "59s",
	},
	summary: {
		all: "All",
		count: "357",
		duration: "2s",
	},
	customDomains: {
		duration: "1s",
	},
	runtimeLogs: {
		description: "View and debug runtime logs & errors",
	},
	observability: {
		description: "Monitor app health & performance",
	},
	webAnalytics: {
		enabled: false,
		description: "Analyze visitors & traffic in real-time",
	},
	speedInsights: {
		enabled: false,
		description: "Performance metrics from real users",
	},
});

// UI state
const expandedSections = ref({
	configuration: false,
	buildLogs: false,
	summary: false,
	customDomains: false,
});

// Methods
const toggleSection = (section) => {
	expandedSections.value[section] = !expandedSections.value[section];
};
</script>

<template>
  <div class=" ">
    <!-- Project Header -->
    <PageHeadingBar :title="currentDeployment.name" titleSize="2xl">
      <div class="flex items-center space-x-2">
        <Button variant="outline" class="flex items-center">
          <span class="mr-1">Share</span>
        </Button>
        <div class="flex">
          <Button class="rounded-r-none">Visit</Button>
          <Button class="rounded-l-none border-l border-gray-700 px-2">
            <ChevronDown class="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" class="p-2">
          <MoreHorizontal class="h-4 w-4" />
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
              <!-- Image preview -->
              <img
                src="https://placehold.co/600x400/EEE/31343C"
                alt="Deployment preview"
                class="w-full"
              />
              <!-- Scores -->
              <div class="flex justify-around py-4">
                <div class="flex flex-col items-center">
                  <div class="text-blue-500 text-xl font-bold">
                    {{ currentDeployment.scores.performance }}
                  </div>
                  <div class="text-xs text-gray-500 mt-1 max-w-24 text-center">
                    DESIGNED RESPONSIVE DESKTOP & MOBILE
                  </div>
                </div>
                <div class="flex flex-col items-center">
                  <div class="text-blue-500 text-xl font-bold">
                    {{ currentDeployment.scores.security }}
                  </div>
                  <div class="text-xs text-gray-500 mt-1 max-w-24 text-center">
                    CROSS-BROWSER MEMORY-SAFE JAVASCRIPT
                  </div>
                </div>
                <div class="flex flex-col items-center">
                  <div class="text-blue-500 text-xl font-bold">
                    {{ currentDeployment.scores.accessibility }}
                  </div>
                  <div class="text-xs text-gray-500 mt-1 max-w-24 text-center">
                    CONTRAST ACCESSIBILITY KEYBOARD SUPPORT
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
                  <span>{{ currentDeployment.created.by }}</span>
                  <span class="text-gray-500 ml-2 text-sm">{{
                    currentDeployment.created.time
                  }}</span>
                </div>
              </div>

              <!-- Status -->
              <div>
                <h3 class="text-gray-500 text-sm font-medium mb-2">Status</h3>
                <div class="flex items-center">
                  <div class="flex items-center">
                    <div class="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span>{{ currentDeployment.status }}</span>
                  </div>
                  <span class="ml-2 text-gray-500 text-sm">{{
                    currentDeployment.statusLabel
                  }}</span>
                </div>
              </div>

              <!-- Duration -->
              <div>
                <h3 class="text-gray-500 text-sm font-medium mb-2">Duration</h3>
                <div class="flex items-center">
                  <Clock class="w-4 h-4 text-gray-500 mr-2" />
                  <span>{{ currentDeployment.duration.value }}</span>
                  <span class="ml-2 text-gray-500 text-sm">{{
                    currentDeployment.duration.time
                  }}</span>
                </div>
              </div>

              <!-- Environment -->
              <div>
                <h3 class="text-gray-500 text-sm font-medium mb-2">
                  Environment
                </h3>
                <div class="flex items-center">
                  <span>{{ currentDeployment.environment.type }}</span>
                  <span
                    class="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded"
                  >
                    {{ currentDeployment.environment.label }}
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
                  v-for="(domain, index) in currentDeployment.domains"
                  :key="index"
                >
                  <Globe
                    v-if="index === 0"
                    class="w-4 h-4 text-gray-500 mr-2"
                  />
                  <div v-else class="w-4 mr-2"></div>
                  <a href="#" class="text-blue-600 hover:underline">{{
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
                  <span>{{ currentDeployment.source.branch }}</span>
                </div>
                <div class="flex items-center">
                  <div class="w-4 mr-2"></div>
                  <span class="font-mono text-gray-500">{{
                    currentDeployment.source.commit
                  }}</span>
                  <span
                    class="ml-2 border border-gray-300 rounded px-1 text-xs"
                  >
                    {{ currentDeployment.source.commitType }}
                  </span>
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
                v-if="!currentDeployment.configuration.fluidCompute"
                class="w-4 h-4 text-gray-400 mr-1"
              />
              <Check v-else class="w-4 h-4 text-blue-600 mr-1" />
              <span class="text-sm">Fluid Compute</span>
            </div>
            <div class="flex items-center">
              <Check
                v-if="currentDeployment.configuration.deploymentProtection"
                class="w-4 h-4 text-blue-600 mr-1"
              />
              <X v-else class="w-4 h-4 text-gray-400 mr-1" />
              <span class="text-sm">Deployment Protection</span>
            </div>
            <div class="flex items-center">
              <X
                v-if="!currentDeployment.configuration.skewProtection"
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
            <span>{{ currentDeployment.buildLogs.duration }}</span>
            <Check class="w-4 h-4 text-green-500 ml-2" />
          </div>
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
              {{ currentDeployment.summary.all }}
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
                {{ currentDeployment.summary.count }}
              </div>
            </button>
            <span>{{ currentDeployment.summary.duration }}</span>
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
            <span>{{ currentDeployment.customDomains.duration }}</span>
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
            {{ currentDeployment.runtimeLogs.description }}
          </p>
        </div>

        <!-- Observability -->
        <div
          class="border border-gray-200 rounded-lg overflow-hidden bg-white p-4"
        >
          <h3 class="font-medium mb-2">Observability</h3>
          <p class="text-sm text-gray-500">
            {{ currentDeployment.observability.description }}
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
            {{ currentDeployment.webAnalytics.description }}
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
            {{ currentDeployment.speedInsights.description }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Add any additional component-specific styles here */
</style>
