<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import PageHeadingBar from "@/components/PageHeadingBar.vue";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast/use-toast";
import TimeDisplay from "@/components/ui/TimeDisplay.vue";
import PendingIndicator from "@/components/ui/PendingIndicator.vue";
import trpc from "@/trpc";
import {
	Github,
	GitBranch,
	RotateCw,
	Shield,
	ExternalLink,
	Activity,
	Users,
	Database,
	FileText,
	TrendingUp,
	Globe,
	Zap,
	CheckCircle,
	AlertCircle,
	Clock,
	Settings,
	Rocket,
	GitPullRequest,
	X,
	RefreshCcw,
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

// Check if project has any deployments
const hasDeployments = computed(() => !!props.project?.activeRev);

// Computed properties for project data
const projectId = computed(
	() => props.project?._id || props.project?.slug || params.projectId,
);
const projectName = computed(
	() => props.project?.name || props.project?.slug || params.projectId,
);
const projectDescription = computed(() => props.project?.description || "");
const projectStatus = computed(() => props.project?.status || "ready");
const projectOrgId = computed(() => props.project?.orgId || "");
const projectDomains = computed(() => {
	if (props.project?.domains?.length) return props.project.domains;
	const defaultDomain = `${props.project?.slug || params.projectId}.api.repo.md`;
	return [{ url: props.project?.domain || defaultDomain, verified: true }];
});
const projectGithubInfo = computed(() => props.project?.github || null);
const projectBranch = computed(
	() => props.project?.github?.repoName || props.project?.githubRepo?.branch || "main",
);

// Format dates for display
const formatDate = (dateString) => {
	if (!dateString) return "recently";
	return new Date(dateString).toLocaleDateString();
};

// Load latest deployment for build banner
const loadLatestDeployment = async () => {
	if (!hasProject.value) return;
	
	try {
		isLoadingDeployment.value = true;
		const response = await trpc.cloudRun.listJobs.query({
			projectId: projectId.value,
			page: 1,
			limit: 1,
		});

		if (response.success && response.jobs.length > 0) {
			latestDeployment.value = response.jobs[0];
			checkBuildBanner();
		}
	} catch (err) {
		console.error("Error loading latest deployment:", err);
	} finally {
		isLoadingDeployment.value = false;
	}
};

// Check if we should show build banner
const checkBuildBanner = () => {
	if (!latestDeployment.value) {
		showBuildBanner.value = false;
		return;
	}
	
	const status = latestDeployment.value.status?.toLowerCase();
	const isPending = status === 'pending' || status === 'queued' || status === 'running' || status === 'in_progress';
	
	if (!isPending) {
		showBuildBanner.value = false;
		stopPolling();
		return;
	}
	
	// Check if recent (less than 30 min)
	try {
		const now = new Date();
		const created = new Date(latestDeployment.value.createdAt);
		const diffMs = now - created;
		const diffMins = Math.floor(diffMs / (1000 * 60));
		
		showBuildBanner.value = diffMins < 30;
		
		if (showBuildBanner.value && !pollingInterval) {
			startPolling();
		} else if (!showBuildBanner.value) {
			stopPolling();
		}
	} catch {
		showBuildBanner.value = false;
	}
};

// Polling functions
const startPolling = () => {
	if (pollingInterval) return;
	
	pollingInterval = setInterval(() => {
		loadLatestDeployment();
	}, 30000); // 30 seconds
};

const stopPolling = () => {
	if (pollingInterval) {
		clearInterval(pollingInterval);
		pollingInterval = null;
	}
};

// Get deployment status info
const deploymentStatusText = computed(() => {
	if (!latestDeployment.value) return '';
	const status = latestDeployment.value.status?.toLowerCase();
	
	switch (status) {
		case 'pending':
		case 'queued':
			return 'Build queued';
		case 'running':
		case 'in_progress':
			return 'Build in progress';
		default:
			return 'Building';
	}
});

// Toast setup
const { toast } = useToast();

// Redeploy button state
const redeploying = ref(false);

// Build banner state
const showBuildBanner = ref(false);
const latestDeployment = ref(null);
const isLoadingDeployment = ref(false);
let pollingInterval = null;

// Quick actions data
const quickActions = computed(() => [
	{
		title: "Content",
		description: "Manage pages and posts",
		icon: FileText,
		route: `/${projectOrgId.value}/${projectName.value}/${props.project?.activeRev || 'latest'}/posts`,
		available: true,
		primary: true,
	},
	{
		title: "Graph",
		description: "Content relationships",
		icon: Activity,
		route: `/${projectOrgId.value}/${projectName.value}/graph`,
		available: true,
	},
	{
		title: "Database",
		description: "Data management",
		icon: Database,
		route: `/${projectOrgId.value}/${projectName.value}/database`,
		available: true,
	},
	{
		title: "API",
		description: "Endpoints & docs",
		icon: Zap,
		route: `/${projectOrgId.value}/${projectName.value}/api`,
		available: true,
	},
]);

// Project metrics
const metrics = computed(() => [
	{
		label: "Status",
		value: projectStatus.value === "ready" ? "Live" : projectStatus.value,
		icon: projectStatus.value === "ready" ? CheckCircle : AlertCircle,
		color: projectStatus.value === "ready" ? "text-green-600" : "text-yellow-600",
	},
	{
		label: "Updated",
		value: props.project?.updatedAt,
		icon: Clock,
		color: "text-gray-600",
		isDate: true,
	},
	{
		label: "Collaborators",
		value: props.project?.collaborators?.length || 0,
		icon: Users,
		color: "text-blue-600",
	},
]);

// Open demo page
const openDemoPage = () => {
	// Get template ID from project or use a default
	const templateId = props.project?.siteTemplateId || 'noti';
	const demoUrl = `/site-demo/${templateId}?projectId=${projectId.value}`;
	
	// Open in new window
	window.open(demoUrl, '_blank');
};

// Redeploy project
const redeployProject = async () => {
	if (redeploying.value || !hasProject.value) return;

	redeploying.value = true;

	try {
		const response = await trpc.cloudRun.createRepoDeployJob.mutate({
			projectId: projectId.value,
		});

		if (response.success) {
			toast({
				title: "Redeployment Started",
				description: "Your project is being redeployed and will be updated shortly.",
				variant: "default",
			});

			if (response.job && response.job.projectId) {
				setTimeout(() => {
					const redirectUrl = response.dashboardUrl || response.job.dashboardUrl;
					if (redirectUrl) {
						router.push(redirectUrl);
					}
				}, 1500);
			}
		}
	} catch (error) {
		console.error("Error redeploying project:", error);
		const errorMessage = error.message || "Failed to redeploy project";

		toast({
			title: "Redeploy Failed",
			description: errorMessage,
			variant: "destructive",
		});
	} finally {
		redeploying.value = false;
	}
};

// Watch for project changes
watch(
	() => props.project,
	() => {
		if (hasProject.value) {
			loadLatestDeployment();
		}
	},
	{ immediate: true },
);

// Lifecycle hooks
onMounted(() => {
	if (hasProject.value) {
		loadLatestDeployment();
	}
});

onUnmounted(() => {
	stopPolling();
});
</script>

<template>
  <div v-if="hasProject">
    <!-- Build Banner -->
    <div 
      v-if="showBuildBanner && latestDeployment"
      class="bg-blue-50 border-b border-blue-200 px-4 py-3 mb-4"
    >
      <div class="container mx-auto flex items-center justify-between">
        <div class="flex items-center">
          <RefreshCcw class="w-5 h-5 mr-3 text-blue-600 animate-spin" />
          <span class="text-blue-800 font-medium">{{ deploymentStatusText }}</span>
          <span class="text-blue-600 ml-2">
            - Started <TimeDisplay :date="latestDeployment.createdAt" />
          </span>
          <router-link
            :to="`/${projectOrgId}/${projectName}/${latestDeployment._id}/logs`"
            class="ml-4 text-blue-600 hover:text-blue-800 underline text-sm"
          >
            View logs
          </router-link>
        </div>
        <button
          @click="showBuildBanner = false"
          class="text-blue-600 hover:text-blue-800 p-1"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Project Header -->
    <PageHeadingBar :title="projectName" :titleWeight="900">
      <div v-if="projectDescription" class="text-sm text-gray-600 mt-1">
        {{ projectDescription }}
      </div>
      
      <template #actions>
        <div class="flex items-center space-x-3">
          <a 
            v-if="projectGithubInfo" 
            :href="`https://github.com/${projectGithubInfo.fullName}`" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <Github class="h-4 w-4 mr-2" />
              Repository
            </Button>
          </a>
          
          <a 
            :href="`https://${projectDomains[0]?.url}`" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Button size="sm">
              <Globe class="h-4 w-4 mr-2" />
              Visit Site
              <ExternalLink class="h-3 w-3 ml-1" />
            </Button>
          </a>

          <Button
            variant="outline"
            size="sm"
            @click="openDemoPage"
          >
            <Globe class="h-4 w-4 mr-2" />
            Template Demo
            <ExternalLink class="h-3 w-3 ml-1" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            @click="redeployProject"
            :disabled="redeploying"
          >
            <RotateCw
              class="h-4 w-4 mr-2"
              :class="{ 'animate-spin': redeploying }"
            />
            {{ redeploying ? "Deploying..." : "Deploy" }}
          </Button>
        </div>
      </template>
    </PageHeadingBar>

    <!-- Empty State - No Deployments -->
    <div v-if="!hasDeployments" class="container py-16">
      <div class="max-w-2xl mx-auto text-center">
        <div class="bg-white rounded-lg border p-12">
          <Rocket class="w-16 h-16 text-gray-400 mx-auto mb-6" />
          <h2 class="text-2xl font-semibold mb-3">Ready to Launch!</h2>
          <p class="text-gray-600 mb-8 text-lg">
            Your project is set up and waiting for its first deployment.
          </p>
          
          <div class="bg-gray-50 rounded-lg p-6 mb-8 text-left max-w-md mx-auto">
            <h3 class="font-medium mb-3 flex items-center">
              <GitPullRequest class="w-5 h-5 mr-2 text-gray-600" />
              Push to deploy
            </h3>
            <p class="text-sm text-gray-600 mb-4">
              repo.md automatically deploys your content when you push to Git.
            </p>
            <div class="bg-gray-900 text-gray-100 rounded p-3 font-mono text-sm overflow-x-auto">
              <div class="text-gray-400"># Add your content</div>
              <div>git add .</div>
              <div>git commit -m "Initial content"</div>
              <div>git push origin {{ projectBranch }}</div>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" size="lg" @click="router.push(`/${projectOrgId}/${projectName}/settings`)">
              <Settings class="w-4 h-4 mr-2" />
              Project Settings
            </Button>
            <a 
              v-if="projectGithubInfo?.repoUrl"
              :href="projectGithubInfo.repoUrl"
              target="_blank"
              class="inline-flex"
            >
              <Button variant="outline" size="lg">
                <Github class="w-4 h-4 mr-2" />
                View Repository
                <ExternalLink class="w-4 h-4 ml-2" />
              </Button>
            </a>
          </div>

          <div class="mt-8 pt-8 border-t">
            <p class="text-sm text-gray-500">
              Need help? Check out our 
              <router-link to="/docs/quick-start" class="text-blue-600 hover:underline">
                quick start guide
              </router-link>
              or 
              <router-link to="/docs/troubleshooting" class="text-blue-600 hover:underline">
                deployment troubleshooting
              </router-link>.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Existing Content - With Deployments -->
    <div v-else class="container space-y-8">
      <!-- Project Overview -->
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main Project Info -->
        <div class="lg:col-span-2">
          <div class="bg-white rounded-lg border p-6">
            <h2 class="text-lg font-semibold mb-4">Project Overview</h2>
            
            <!-- Key Metrics -->
            <div class="grid grid-cols-3 gap-4 mb-6">
              <div 
                v-for="metric in metrics" 
                :key="metric.label"
                class="text-center p-3 bg-gray-50 rounded-lg"
              >
                <component 
                  :is="metric.icon" 
                  :class="['w-6 h-6 mx-auto mb-2', metric.color]"
                />
                <div class="text-sm font-medium">
                  <TimeDisplay v-if="metric.isDate" :date="metric.value" />
                  <span v-else>{{ metric.value }}</span>
                </div>
                <div class="text-xs text-gray-500">{{ metric.label }}</div>
              </div>
            </div>

            <!-- Deployment Info -->
            <div class="space-y-3">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600">Live URL:</span>
                <a 
                  :href="`https://${projectDomains[0]?.url}`"
                  target="_blank"
                  class="text-blue-600 hover:underline font-mono"
                >
                  {{ projectDomains[0]?.url }}
                </a>
              </div>
              
              <div v-if="projectGithubInfo" class="flex items-center justify-between text-sm">
                <span class="text-gray-600">Source:</span>
                <div class="flex items-center">
                  <GitBranch class="w-4 h-4 mr-1 text-gray-400" />
                  <span class="font-mono">{{ projectBranch }}</span>
                </div>
              </div>

              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600">Visibility:</span>
                <div class="flex items-center">
                  <Shield class="w-4 h-4 mr-1 text-gray-400" />
                  <span class="capitalize">{{ props.project?.visibility || 'private' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div>
          <div class="bg-white rounded-lg border p-6">
            <h3 class="text-lg font-semibold mb-4">Quick Actions</h3>
            <div class="space-y-3">
              <router-link
                v-for="action in quickActions"
                :key="action.title"
                :to="action.route"
                :class="[
                  'block p-3 rounded-lg border transition-colors',
                  action.primary 
                    ? 'border-blue-200 bg-blue-50 hover:bg-blue-100' 
                    : 'border-gray-200 hover:bg-gray-50'
                ]"
              >
                <div class="flex items-center">
                  <component 
                    :is="action.icon" 
                    :class="[
                      'w-5 h-5 mr-3',
                      action.primary ? 'text-blue-600' : 'text-gray-600'
                    ]"
                  />
                  <div>
                    <div :class="[
                      'font-medium text-sm',
                      action.primary ? 'text-blue-900' : 'text-gray-900'
                    ]">
                      {{ action.title }}
                    </div>
                    <div :class="[
                      'text-xs',
                      action.primary ? 'text-blue-700' : 'text-gray-600'
                    ]">
                      {{ action.description }}
                    </div>
                  </div>
                </div>
              </router-link>
            </div>
          </div>
        </div>
      </section>

      <!-- Feature Grid -->
      <section>
        <h2 class="text-xl font-semibold mb-6">Project Features</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <!-- Content Management -->
          <div class="bg-white rounded-lg border p-6">
            <div class="flex items-center mb-4">
              <FileText class="w-6 h-6 text-blue-600 mr-3" />
              <h3 class="font-semibold">Content Management</h3>
            </div>
            <p class="text-gray-600 text-sm mb-4">
              Create, edit, and organize your content with our markdown editor and media library.
            </p>
            <div class="space-y-2">
              <router-link
                :to="`/${projectOrgId}/${projectName}/${props.project?.activeRev || 'latest'}/posts`"
                class="text-blue-600 hover:underline text-sm block"
              >
                → Manage Content
              </router-link>
              <router-link
                :to="`/${projectOrgId}/${projectName}/medias`"
                class="text-blue-600 hover:underline text-sm block"
              >
                → Media Library
              </router-link>
            </div>
          </div>

          <!-- Analytics & Insights -->
          <div class="bg-white rounded-lg border p-6">
            <div class="flex items-center mb-4">
              <TrendingUp class="w-6 h-6 text-green-600 mr-3" />
              <h3 class="font-semibold">Analytics & Insights</h3>
            </div>
            <p class="text-gray-600 text-sm mb-4">
              Understand your content relationships and visitor patterns.
            </p>
            <div class="space-y-2">
              <router-link
                :to="`/${projectOrgId}/${projectName}/graph`"
                class="text-blue-600 hover:underline text-sm block"
              >
                → Content Graph
              </router-link>
              <router-link
                :to="`/${projectOrgId}/${projectName}/deployments`"
                class="text-blue-600 hover:underline text-sm block"
              >
                → Deployment Stats
              </router-link>
            </div>
          </div>

          <!-- Developer Tools -->
          <div class="bg-white rounded-lg border p-6">
            <div class="flex items-center mb-4">
              <Zap class="w-6 h-6 text-purple-600 mr-3" />
              <h3 class="font-semibold">Developer Tools</h3>
            </div>
            <p class="text-gray-600 text-sm mb-4">
              APIs, database access, and AI agent configuration for your project.
            </p>
            <div class="space-y-2">
              <router-link
                :to="`/${projectOrgId}/${projectName}/api`"
                class="text-blue-600 hover:underline text-sm block"
              >
                → API Documentation
              </router-link>
              <router-link
                :to="`/${projectOrgId}/${projectName}/database`"
                class="text-blue-600 hover:underline text-sm block"
              >
                → Database Console
              </router-link>
              <router-link
                :to="`/${projectOrgId}/${projectName}/agent`"
                class="text-blue-600 hover:underline text-sm block"
              >
                → AI Agent Setup
              </router-link>
            </div>
          </div>

          <!-- Team Collaboration -->
          <div class="bg-white rounded-lg border p-6">
            <div class="flex items-center mb-4">
              <Users class="w-6 h-6 text-orange-600 mr-3" />
              <h3 class="font-semibold">Team Collaboration</h3>
            </div>
            <p class="text-gray-600 text-sm mb-4">
              Invite team members and manage permissions for your project.
            </p>
            <div class="space-y-2">
              <router-link
                :to="`/${projectOrgId}/${projectName}/settings`"
                class="text-blue-600 hover:underline text-sm block"
              >
                → Project Settings
              </router-link>
              <router-link
                :to="`/${projectOrgId}/${projectName}/webhook-events`"
                class="text-blue-600 hover:underline text-sm block"
              >
                → Webhook Events
              </router-link>
            </div>
          </div>

          <!-- Deployment Status -->
          <div class="bg-white rounded-lg border p-6">
            <div class="flex items-center mb-4">
              <Activity class="w-6 h-6 text-red-600 mr-3" />
              <h3 class="font-semibold">Deployment Status</h3>
            </div>
            <p class="text-gray-600 text-sm mb-4">
              Monitor deployments, view build logs, and manage your live site.
            </p>
            <div class="space-y-2">
              <router-link
                :to="`/${projectOrgId}/${projectName}/deployments`"
                class="text-blue-600 hover:underline text-sm block"
              >
                → Deployment History
              </router-link>
              <span class="text-gray-500 text-sm block">
                → Build Logs (coming soon)
              </span>
            </div>
          </div>

          <!-- Project Settings -->
          <div class="bg-white rounded-lg border p-6">
            <div class="flex items-center mb-4">
              <Settings class="w-6 h-6 text-gray-600 mr-3" />
              <h3 class="font-semibold">Configuration</h3>
            </div>
            <p class="text-gray-600 text-sm mb-4">
              Manage domains, environment variables, and project configuration.
            </p>
            <div class="space-y-2">
              <router-link
                :to="`/${projectOrgId}/${projectName}/settings`"
                class="text-blue-600 hover:underline text-sm block"
              >
                → General Settings
              </router-link>
              <span class="text-gray-500 text-sm block">
                → Domain Management (coming soon)
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* Component-specific styles */
</style>