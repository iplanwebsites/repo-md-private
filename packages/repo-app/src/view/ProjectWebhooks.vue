<script setup>
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
	Settings, 
	Webhook, 
	Zap, 
	MessageSquare, 
	Code, 
	GitBranch, 
	Database, 
	Mail, 
	Slack,
	ExternalLink,
	Play,
	Copy
} from "lucide-vue-next";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent
} from "@/components/ui/card";
import WebhookEventsTable from "@/components/WebhookEventsTable.vue";
import PageHeadingBar from "@/components/PageHeadingBar.vue";

const props = defineProps({
  project: {
    type: Object,
    required: true,
  },
});

const route = useRoute();
const router = useRouter();

const projectId = computed(() => props.project?._id || props.project?.id);
const projectSlug = computed(() => props.project?.slug || route.params.projectId);
const orgHandle = computed(() => route.params.orgId);
const isSimulating = ref(false);
const simulationResult = ref(null);
const isLocalhost = computed(() => typeof window !== 'undefined' && window.location.hostname === 'localhost');

// Navigation helper
const navigateToSettings = () => {
	router.push(`/${orgHandle.value}/${projectSlug.value}/settings/webhooks`);
};

// Example webhook automations
const webhookExamples = [
	{
		title: "GitHub Integration",
		description: "Automatically deploy when code is pushed",
		icon: GitBranch,
		color: "bg-gray-900",
		trigger: "GitHub push event",
		command: "Deploy the latest changes from the main branch",
		useCase: "Continuous deployment"
	},
	{
		title: "Slack Bot Commands", 
		description: "Execute commands from your team chat",
		icon: Slack,
		color: "bg-purple-600",
		trigger: "Slack webhook",
		command: "Generate a performance report for this week",
		useCase: "Team automation"
	},
	{
		title: "Email Processing",
		description: "Process incoming emails into content",
		icon: Mail,
		color: "bg-blue-600",
		trigger: "Email webhook",
		command: "Create a new blog post from this email content",
		useCase: "Content automation"
	},
	{
		title: "Database Updates",
		description: "Sync content when data changes",
		icon: Database,
		color: "bg-green-600",
		trigger: "Database webhook",
		command: "Update product pages with the latest inventory data",
		useCase: "Data synchronization"
	},
	{
		title: "Custom API",
		description: "Trigger actions from external services",
		icon: Code,
		color: "bg-orange-600",
		trigger: "Custom webhook",
		command: "Analyze user feedback and create improvement suggestions",
		useCase: "API integration"
	},
	{
		title: "Scheduled Tasks",
		description: "Automate recurring content updates",
		icon: Zap,
		color: "bg-yellow-600",
		trigger: "Cron webhook",
		command: "Generate weekly analytics summary and publish to blog",
		useCase: "Scheduled automation"
	}
];

// Generate webhook URL for this project
const webhookUrl = computed(() => {
	if (!props.project?._id) return "";
	return `https://api.repo.md/webhooks/${props.project._id}/command`;
});

// Copy webhook URL to clipboard
const copyWebhookUrl = async () => {
	try {
		await navigator.clipboard.writeText(webhookUrl.value);
		// Could add a toast notification here
	} catch (err) {
		console.error('Failed to copy URL:', err);
	}
};

// Debug function for localhost only
const simulateGithubHook = async () => {
  isSimulating.value = true;
  simulationResult.value = null;

  try {
    const response = await fetch('/api/github/webhook/simulate/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repoFullName: props.project?.repository || 'test-user/test-repo',
        repoBranch: 'main',
        commitMessage: `Test webhook simulation - ${new Date().toISOString()}`,
        pusherName: 'test-user',
        pusherEmail: 'test@example.com'
      }),
    });

    const result = await response.json();
    simulationResult.value = result;
    
    if (result.success) {
      console.log('Webhook simulation successful:', result);
      // Optionally refresh the webhook events table
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      console.error('Webhook simulation failed:', result);
    }
  } catch (error) {
    console.error('Error simulating webhook:', error);
    simulationResult.value = { 
      success: false, 
      error: error.message || 'Unknown error' 
    };
  } finally {
    isSimulating.value = false;
  }
};
</script>

<template>
  <div>
    <PageHeadingBar
      title="Webhook Automation"
      subtitle="Configure incoming webhooks to trigger AI-powered commands and automate your workflow"
    >
      <div class="flex items-center space-x-2">
        <Button @click="navigateToSettings" variant="outline" size="sm">
          <Settings class="w-4 h-4 mr-2" />
          Configure Webhooks
        </Button>
      </div>
    </PageHeadingBar>

    <!-- Debug Block - Only visible on localhost -->
    <div v-if="isLocalhost" class="container mb-6">
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 class="text-lg font-semibold text-yellow-800 mb-3">Debug Tools</h3>
        <div class="flex gap-3 mb-3">
          <button
            @click="simulateGithubHook"
            :disabled="isSimulating"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {{ isSimulating ? 'Simulating...' : 'Simulate GitHub Hook' }}
          </button>
        </div>
        
        <!-- Simulation Result -->
        <div v-if="simulationResult" class="mt-3 p-3 rounded-md" :class="{
          'bg-green-100 border border-green-200': simulationResult.success,
          'bg-red-100 border border-red-200': !simulationResult.success
        }">
          <div class="text-sm font-medium" :class="{
            'text-green-800': simulationResult.success,
            'text-red-800': !simulationResult.success
          }">
            {{ simulationResult.success ? '✅ Simulation Successful' : '❌ Simulation Failed' }}
          </div>
          <div class="text-xs mt-1 font-mono" :class="{
            'text-green-700': simulationResult.success,
            'text-red-700': !simulationResult.success
          }">
            {{ simulationResult.message || simulationResult.error }}
          </div>
          <div v-if="simulationResult.eventId" class="text-xs mt-1 text-gray-600">
            Event ID: {{ simulationResult.eventId }}
          </div>
        </div>
      </div>
    </div>

    <div class="container space-y-8">
      <!-- Webhook URL Section -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Webhook class="w-5 h-5" />
            Your Project Webhook URL
          </CardTitle>
          <CardDescription>
            Use this URL to send webhook requests that trigger AI commands in your project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="flex gap-2">
            <div class="flex-1 font-mono text-sm bg-muted p-3 rounded-md border">
              {{ webhookUrl || 'Project webhook URL will appear here' }}
            </div>
            <Button
              v-if="webhookUrl"
              @click="copyWebhookUrl"
              variant="outline"
              size="sm"
            >
              <Copy class="w-4 h-4" />
            </Button>
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            Send POST requests to this URL with a "command" field containing your natural language instruction
          </p>
        </CardContent>
      </Card>

      <!-- How It Works Section -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <MessageSquare class="w-5 h-5" />
            How Webhook Automation Works
          </CardTitle>
          <CardDescription>
            Send natural language commands via HTTP requests to automate your project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <div class="bg-muted/50 p-4 rounded-lg">
              <h4 class="font-medium mb-2">Example Webhook Request:</h4>
              <pre class="text-sm bg-background p-3 rounded border overflow-x-auto"><code>{
  "command": "Create a new blog post about AI trends in 2024",
  "context": {
    "source": "slack",
    "user": "john@company.com",
    "channel": "#content-team"
  }
}</code></pre>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div class="text-center">
                <div class="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">1</div>
                <p class="font-medium">Webhook Received</p>
                <p class="text-muted-foreground">Your service sends a POST request</p>
              </div>
              <div class="text-center">
                <div class="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">2</div>
                <p class="font-medium">AI Processing</p>
                <p class="text-muted-foreground">Command is processed by AI agent</p>
              </div>
              <div class="text-center">
                <div class="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">3</div>
                <p class="font-medium">Action Executed</p>
                <p class="text-muted-foreground">Content created or updated</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Use Cases Section -->
      <div>
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap class="w-5 h-5" />
          Automation Use Cases
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card v-for="example in webhookExamples" :key="example.title" class="hover:shadow-md transition-shadow">
            <CardHeader class="pb-3">
              <div class="flex items-start gap-3">
                <div :class="[example.color, 'w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0']">
                  <component :is="example.icon" class="w-5 h-5" />
                </div>
                <div class="min-w-0 flex-1">
                  <CardTitle class="text-base">{{ example.title }}</CardTitle>
                  <CardDescription class="text-sm">{{ example.description }}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent class="pt-0">
              <div class="space-y-3">
                <div>
                  <p class="text-xs font-medium text-muted-foreground mb-1">Trigger:</p>
                  <p class="text-sm">{{ example.trigger }}</p>
                </div>
                <div>
                  <p class="text-xs font-medium text-muted-foreground mb-1">Example Command:</p>
                  <p class="text-sm italic">"{{ example.command }}"</p>
                </div>
                <Badge variant="secondary" class="text-xs">{{ example.useCase }}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <!-- Integration Examples -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Code class="w-5 h-5" />
            Integration Examples
          </CardTitle>
          <CardDescription>
            Quick setup guides for popular services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- GitHub Actions -->
            <div class="space-y-3">
              <h4 class="font-medium flex items-center gap-2">
                <GitBranch class="w-4 h-4" />
                GitHub Actions
              </h4>
              <pre class="text-xs bg-muted p-3 rounded border overflow-x-auto"><code>- name: Trigger Content Update
  run: |
    curl -X POST {{ webhookUrl }} \
      -H "Content-Type: application/json" \
      -d '{"command": "Update docs from latest release"}'</code></pre>
            </div>

            <!-- Slack Slash Command -->
            <div class="space-y-3">
              <h4 class="font-medium flex items-center gap-2">
                <Slack class="w-4 h-4" />
                Slack Integration
              </h4>
              <pre class="text-xs bg-muted p-3 rounded border overflow-x-auto"><code>curl -X POST {{ webhookUrl }} \
  -H "Content-Type: application/json" \
  -d '{
    "command": "Create weekly team update",
    "context": {"slack_user": "@john"}
  }'</code></pre>
            </div>

            <!-- Zapier/Make -->
            <div class="space-y-3">
              <h4 class="font-medium flex items-center gap-2">
                <Zap class="w-4 h-4" />
                Zapier/Make.com
              </h4>
              <p class="text-sm text-muted-foreground">
                Use the webhook URL as an action in your automations. Send form submissions, email notifications, or database changes as natural language commands.
              </p>
            </div>

            <!-- Custom Scripts -->
            <div class="space-y-3">
              <h4 class="font-medium flex items-center gap-2">
                <Code class="w-4 h-4" />
                Custom Scripts
              </h4>
              <p class="text-sm text-muted-foreground">
                Integrate with your existing tools using any programming language. Perfect for monitoring systems, data pipelines, or scheduled tasks.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Recent Webhook Events -->
      <div>
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <Play class="w-5 h-5" />
          Recent Webhook Events
        </h3>
        <WebhookEventsTable
          scope="project"
          :project-id="projectId"
          :show-repository="false"
        />
      </div>
    </div>
  </div>
</template>