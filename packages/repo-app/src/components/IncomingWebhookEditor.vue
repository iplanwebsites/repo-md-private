<script setup>
import { ref, computed, watch } from "vue";
import { 
  Webhook, 
  Shield, 
  Copy, 
  RefreshCw,
  Info,
  AlertTriangle,
  Sparkles,
  MessageSquare,
  FileText,
  Mail,
  GitBranch,
  Calendar,
  Hash,
  Globe
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/use-toast";
import WebhookPermissions from "./WebhookPermissions.vue";
import CodeBlock from "./CodeBlock.vue";

const props = defineProps({
  webhook: {
    type: Object,
    default: () => ({
      id: null,
      name: '',
      description: '',
      provider: 'custom',
      active: true,
      permissions: {},
      agentInstructions: '',
      examples: []
    })
  },
  projectId: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['save', 'cancel']);

const { toast } = useToast();

// Local copy of webhook data
const localWebhook = ref({ ...props.webhook });

// Provider templates
const providerTemplates = ref([
  {
    id: 'custom',
    name: 'Custom',
    icon: Webhook,
    description: 'Generic webhook for any service',
    defaultInstructions: 'Extract the main command or request from the webhook payload. The command should be a clear action to perform on the project.'
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: MessageSquare,
    description: 'Slack slash commands and workflows',
    defaultInstructions: 'Extract the command from a Slack message. The "text" field contains the user\'s request. Identify the action they want to perform. The request comes from user "${user_name}" in channel "${channel_name}".',
    example: {
      text: "create blog post about new features",
      user_name: "john.doe",
      channel_name: "content-team",
      team_domain: "company"
    }
  },
  {
    id: 'github',
    name: 'GitHub Actions',
    icon: GitBranch,
    description: 'GitHub Actions and workflows',
    defaultInstructions: 'Extract the command from a GitHub Actions workflow. Look for the "inputs.command" field which contains the action to perform. This was triggered by "${actor}" on repository "${repository}".',
    example: {
      inputs: { command: "update documentation" },
      actor: "github-user",
      repository: "org/repo",
      ref: "main"
    }
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: Hash,
    description: 'Discord bots and webhooks',
    defaultInstructions: 'Extract the command from a Discord message. The "content" field contains the user\'s request. Parse it to understand what action they want to perform.'
  },
  {
    id: 'email',
    name: 'Email',
    icon: Mail,
    description: 'Email-triggered commands',
    defaultInstructions: 'Extract the command from an email. Combine the subject line and body to understand the requested action. Focus on clear, actionable requests.'
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: Calendar,
    description: 'Calendar-based automation',
    defaultInstructions: 'Extract the command from a calendar event. Look at the event title and description to determine what automated action should be triggered.'
  },
  {
    id: 'api',
    name: 'API/Zapier',
    icon: Globe,
    description: 'Generic API integrations',
    defaultInstructions: 'Extract the command from an API integration payload. Look for action fields or description fields that indicate what should be done.'
  }
]);

// Webhook URL will be provided by backend after creation
const webhookUrl = computed(() => {
  return localWebhook.value.webhookUrl || '';
});

// Get selected provider template
const selectedProvider = computed(() => {
  return providerTemplates.value.find(p => p.id === localWebhook.value.provider) || providerTemplates.value[0];
});

// Copy webhook URL
const copyWebhookUrl = async () => {
  if (!webhookUrl.value) return;
  
  try {
    await navigator.clipboard.writeText(webhookUrl.value);
    toast({
      title: "Copied!",
      description: "Webhook URL copied to clipboard",
    });
  } catch (err) {
    toast({
      title: "Failed to copy",
      description: "Please copy the URL manually",
      variant: "destructive",
    });
  }
};

// Update provider template
const updateProvider = (providerId) => {
  const provider = providerTemplates.value.find(p => p.id === providerId);
  if (provider) {
    localWebhook.value.provider = providerId;
    localWebhook.value.agentInstructions = provider.defaultInstructions;
  }
};

// Generate example payload
const examplePayload = computed(() => {
  const provider = selectedProvider.value;
  if (provider.example) {
    return JSON.stringify(provider.example, null, 2);
  }
  
  // Generic example
  return JSON.stringify({
    command: "Create a blog post about AI trends",
    sender: "john@example.com",
    timestamp: new Date().toISOString()
  }, null, 2);
});

// Generate example interpretation
const exampleInterpretation = computed(() => {
  return `Based on your instructions, the agent would extract: "Create a blog post about AI trends"`;
});

// Save webhook
const saveWebhook = () => {
  if (!localWebhook.value.name) {
    toast({
      title: "Name required",
      description: "Please provide a name for this webhook",
      variant: "destructive",
    });
    return;
  }
  
  if (!localWebhook.value.agentInstructions) {
    toast({
      title: "Agent instructions required",
      description: "Please provide instructions for how the agent should interpret commands",
      variant: "destructive",
    });
    return;
  }
  
  emit('save', localWebhook.value);
};

// Set default instructions if not provided
if (!localWebhook.value.agentInstructions && selectedProvider.value) {
  localWebhook.value.agentInstructions = selectedProvider.value.defaultInstructions;
}
</script>

<template>
  <div class="space-y-6">
    <!-- Basic Information -->
    <div class="space-y-4">
      <div>
        <Label for="webhook-name">Webhook Name *</Label>
        <Input
          id="webhook-name"
          v-model="localWebhook.name"
          placeholder="e.g., Slack Content Team"
          class="mt-1"
        />
        <p class="text-xs text-muted-foreground mt-1">
          A descriptive name to identify this webhook
        </p>
      </div>

      <div>
        <Label for="webhook-description">Description</Label>
        <Textarea
          id="webhook-description"
          v-model="localWebhook.description"
          placeholder="What this webhook is used for..."
          class="mt-1"
          rows="2"
        />
      </div>

      <div>
        <Label for="webhook-provider">Provider Type</Label>
        <Select 
          :value="localWebhook.provider"
          @update:modelValue="updateProvider"
        >
          <SelectTrigger id="webhook-provider" class="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem 
              v-for="provider in providerTemplates" 
              :key="provider.id" 
              :value="provider.id"
            >
              <div class="flex items-center gap-2">
                <component :is="provider.icon" class="w-4 h-4" />
                {{ provider.name }}
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <p class="text-xs text-muted-foreground mt-1">
          {{ selectedProvider.description }}
        </p>
      </div>

      <div class="flex items-center space-x-3">
        <Switch
          id="webhook-active"
          v-model:checked="localWebhook.active"
        />
        <Label for="webhook-active" class="cursor-pointer">
          Active
        </Label>
      </div>
    </div>

    <!-- Webhook URL -->
    <div v-if="webhookUrl" class="space-y-2">
      <Label>Webhook URL</Label>
      <div class="flex gap-2">
        <Input
          :value="webhookUrl"
          readonly
          class="font-mono text-sm"
        />
        <Button
          @click="copyWebhookUrl"
          variant="outline"
          size="sm"
        >
          <Copy class="w-4 h-4" />
        </Button>
      </div>
      <p class="text-xs text-muted-foreground">
        {{ webhook.id ? 'Use this URL to send commands to your project' : 'URL will be generated after creation' }}
      </p>
    </div>

    <!-- Natural Language Processing -->
    <Alert>
      <Sparkles class="h-4 w-4" />
      <AlertTitle>Natural Language Processing</AlertTitle>
      <AlertDescription>
        All incoming commands are processed through natural language understanding before execution.
        This prevents command injection and ensures safe interpretation of user intent.
      </AlertDescription>
    </Alert>

    <!-- Agent Instructions -->
    <div class="space-y-2">
      <Label for="agent-instructions">Agent Instructions *</Label>
      <Textarea
        id="agent-instructions"
        v-model="localWebhook.agentInstructions"
        placeholder="Tell the AI agent how to interpret commands from this webhook. For example: 'Extract the user's request from the text field. Look for actionable commands like creating content, updating pages, or triggering builds.'"
        class="mt-1"
        rows="4"
      />
      <p class="text-xs text-muted-foreground">
        Provide clear instructions for the AI agent to safely extract and interpret commands from the webhook payload.
        This prevents injection attacks by ensuring all commands are understood in context.
      </p>
    </div>

    <!-- Example Payload -->
    <div class="space-y-2">
      <Label>Example Incoming Payload</Label>
      <CodeBlock
        :code="examplePayload"
        language="json"
        class="text-sm"
      />
      <div class="flex items-start gap-2 mt-2">
        <Info class="w-4 h-4 text-blue-500 mt-0.5" />
        <div class="text-xs text-muted-foreground">
          <p>{{ exampleInterpretation }}</p>
          <p class="mt-1">The agent will use your instructions to safely interpret the command within the allowed permissions.</p>
        </div>
      </div>
    </div>

    <!-- Permissions -->
    <div class="space-y-2">
      <Label>Permissions</Label>
      <p class="text-xs text-muted-foreground mb-2">
        Configure what this webhook can do in your project
      </p>
      <div class="border rounded-lg p-4">
        <WebhookPermissions 
          v-model:permissions="localWebhook.permissions"
          :readOnly="false"
        />
      </div>
    </div>

    <!-- Security Notice -->
    <Alert>
      <Shield class="h-4 w-4" />
      <AlertTitle>Security Features</AlertTitle>
      <AlertDescription>
        <ul class="list-disc list-inside space-y-1 text-sm mt-2">
          <li>Commands are interpreted using AI, not executed directly</li>
          <li>Permissions are enforced at execution time</li>
          <li>All actions are logged for audit purposes</li>
          <li>Rate limiting prevents abuse</li>
        </ul>
      </AlertDescription>
    </Alert>

    <!-- Actions -->
    <div class="flex justify-end gap-2 pt-4 border-t">
      <Button variant="outline" @click="$emit('cancel')">
        Cancel
      </Button>
      <Button @click="saveWebhook">
        {{ webhook.id ? 'Update' : 'Create' }} Webhook
      </Button>
    </div>
  </div>
</template>