<script setup>
import { ref, computed } from "vue";
import { 
  Shield, 
  FileEdit, 
  GitBranch, 
  Send, 
  Database, 
  Image, 
  Bot, 
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info
} from "lucide-vue-next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const props = defineProps({
  permissions: {
    type: Object,
    default: () => ({})
  },
  readOnly: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:permissions']);

// Define available webhook capabilities with their scopes
const webhookCapabilities = ref([
  {
    id: 'content_management',
    name: 'Content Management',
    icon: FileEdit,
    description: 'Create, update, and manage content files',
    capabilities: [
      {
        id: 'create_content',
        name: 'Create Content',
        description: 'Create new markdown files and pages',
        riskLevel: 'low',
        examples: ['Create blog posts', 'Generate documentation pages'],
        restrictions: ['Cannot overwrite existing files without explicit permission']
      },
      {
        id: 'update_content',
        name: 'Update Content',
        description: 'Modify existing content files',
        riskLevel: 'medium',
        examples: ['Update blog post metadata', 'Fix typos in documentation'],
        restrictions: ['Cannot delete content', 'Maintains version history']
      },
      {
        id: 'delete_content',
        name: 'Delete Content',
        description: 'Remove content files',
        riskLevel: 'high',
        examples: ['Archive old posts', 'Clean up drafts'],
        restrictions: ['Requires confirmation', 'Moves to trash first']
      }
    ]
  },
  {
    id: 'media_management',
    name: 'Media Management',
    icon: Image,
    description: 'Handle images and media files',
    capabilities: [
      {
        id: 'upload_media',
        name: 'Upload Media',
        description: 'Upload images and other media files',
        riskLevel: 'low',
        examples: ['Upload blog images', 'Add screenshots'],
        restrictions: ['File size limits apply', 'Only allowed file types']
      },
      {
        id: 'generate_images',
        name: 'Generate Images',
        description: 'Create images using AI',
        riskLevel: 'medium',
        examples: ['Generate blog headers', 'Create diagrams'],
        restrictions: ['Usage limits apply', 'Content policy enforced']
      },
      {
        id: 'optimize_media',
        name: 'Optimize Media',
        description: 'Compress and optimize media files',
        riskLevel: 'low',
        examples: ['Compress images', 'Convert formats'],
        restrictions: ['Preserves originals']
      }
    ]
  },
  {
    id: 'deployment',
    name: 'Deployment & Build',
    icon: GitBranch,
    description: 'Trigger builds and deployments',
    capabilities: [
      {
        id: 'trigger_build',
        name: 'Trigger Build',
        description: 'Start a new build process',
        riskLevel: 'medium',
        examples: ['Rebuild site', 'Process content changes'],
        restrictions: ['Rate limited', 'Queue management']
      },
      {
        id: 'deploy_preview',
        name: 'Deploy Preview',
        description: 'Create preview deployments',
        riskLevel: 'low',
        examples: ['Preview branches', 'Test changes'],
        restrictions: ['Temporary deployments only']
      },
      {
        id: 'rollback',
        name: 'Rollback Deployment',
        description: 'Revert to previous deployment',
        riskLevel: 'high',
        examples: ['Emergency rollback', 'Undo deployment'],
        restrictions: ['Limited rollback history', 'Requires confirmation']
      }
    ]
  },
  {
    id: 'external_services',
    name: 'External Services',
    icon: Send,
    description: 'Interact with external APIs and services',
    capabilities: [
      {
        id: 'call_apis',
        name: 'Call External APIs',
        description: 'Make HTTP requests to external services',
        riskLevel: 'high',
        examples: ['Fetch data from APIs', 'Send notifications'],
        restrictions: ['Whitelist required', 'Rate limits apply']
      },
      {
        id: 'send_emails',
        name: 'Send Emails',
        description: 'Send email notifications',
        riskLevel: 'medium',
        examples: ['Newsletter updates', 'Contact form responses'],
        restrictions: ['Sender verification required', 'Anti-spam measures']
      },
      {
        id: 'trigger_webhooks',
        name: 'Trigger Webhooks',
        description: 'Call other webhooks',
        riskLevel: 'medium',
        examples: ['Chain automations', 'Notify services'],
        restrictions: ['Loop prevention', 'Timeout limits']
      }
    ]
  },
  {
    id: 'data_access',
    name: 'Data Access',
    icon: Database,
    description: 'Access and modify project data',
    capabilities: [
      {
        id: 'read_analytics',
        name: 'Read Analytics',
        description: 'Access analytics and metrics',
        riskLevel: 'low',
        examples: ['Generate reports', 'Export statistics'],
        restrictions: ['Read-only access', 'Aggregated data only']
      },
      {
        id: 'access_database',
        name: 'Database Access',
        description: 'Query project database',
        riskLevel: 'high',
        examples: ['Custom queries', 'Data exports'],
        restrictions: ['Read-only by default', 'Query limits']
      },
      {
        id: 'modify_settings',
        name: 'Modify Settings',
        description: 'Change project configuration',
        riskLevel: 'high',
        examples: ['Update site config', 'Change build settings'],
        restrictions: ['Audit logged', 'Critical settings protected']
      }
    ]
  },
  {
    id: 'ai_agents',
    name: 'AI Agent Control',
    icon: Bot,
    description: 'Control AI agents and automation',
    capabilities: [
      {
        id: 'execute_agents',
        name: 'Execute AI Agents',
        description: 'Run AI-powered automation',
        riskLevel: 'medium',
        examples: ['Content generation', 'Data processing'],
        restrictions: ['Token limits', 'Supervised execution']
      },
      {
        id: 'train_models',
        name: 'Train Models',
        description: 'Update AI model training',
        riskLevel: 'high',
        examples: ['Fine-tune responses', 'Update knowledge base'],
        restrictions: ['Requires approval', 'Version control']
      }
    ]
  }
]);

// Helper to get risk level badge variant
const getRiskBadgeVariant = (level) => {
  switch(level) {
    case 'low': return 'default';
    case 'medium': return 'secondary';
    case 'high': return 'destructive';
    default: return 'outline';
  }
};

// Helper to get risk level icon
const getRiskIcon = (level) => {
  switch(level) {
    case 'low': return CheckCircle;
    case 'medium': return AlertTriangle;
    case 'high': return XCircle;
    default: return Info;
  }
};

// Toggle capability
const toggleCapability = (categoryId, capabilityId) => {
  if (props.readOnly) return;
  
  const newPermissions = { ...props.permissions };
  if (!newPermissions[categoryId]) {
    newPermissions[categoryId] = {};
  }
  
  newPermissions[categoryId][capabilityId] = !newPermissions[categoryId][capabilityId];
  emit('update:permissions', newPermissions);
};

// Check if capability is enabled
const isCapabilityEnabled = (categoryId, capabilityId) => {
  return props.permissions[categoryId]?.[capabilityId] || false;
};

// Get enabled capabilities count
const enabledCapabilitiesCount = computed(() => {
  let count = 0;
  Object.values(props.permissions).forEach(category => {
    count += Object.values(category).filter(Boolean).length;
  });
  return count;
});

// Get total capabilities count
const totalCapabilitiesCount = computed(() => {
  return webhookCapabilities.value.reduce((total, category) => {
    return total + category.capabilities.length;
  }, 0);
});
</script>

<template>
  <div class="space-y-6">
    <!-- Security Overview -->
    <Alert>
      <Shield class="h-4 w-4" />
      <AlertTitle>Webhook Security</AlertTitle>
      <AlertDescription>
        Configure what actions incoming webhooks can perform. Start with minimal permissions and expand as needed.
        {{ enabledCapabilitiesCount }} of {{ totalCapabilitiesCount }} capabilities enabled.
      </AlertDescription>
    </Alert>

    <!-- Permission Categories -->
    <div class="space-y-4">
      <Card v-for="category in webhookCapabilities" :key="category.id">
        <CardHeader>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <component :is="category.icon" class="w-5 h-5 text-muted-foreground" />
              <div>
                <CardTitle class="text-lg">{{ category.name }}</CardTitle>
                <CardDescription>{{ category.description }}</CardDescription>
              </div>
            </div>
            <Badge variant="outline">
              {{ category.capabilities.filter(c => isCapabilityEnabled(category.id, c.id)).length }} / {{ category.capabilities.length }}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent>
          <div class="space-y-4">
            <div 
              v-for="capability in category.capabilities" 
              :key="capability.id"
              class="flex items-start space-x-3 p-3 rounded-lg border"
              :class="{
                'bg-muted/50': isCapabilityEnabled(category.id, capability.id),
                'opacity-60': props.readOnly
              }"
            >
              <Switch
                :id="`${category.id}-${capability.id}`"
                :checked="isCapabilityEnabled(category.id, capability.id)"
                @update:checked="toggleCapability(category.id, capability.id)"
                :disabled="props.readOnly"
                class="mt-0.5"
              />
              
              <div class="flex-1 space-y-2">
                <div class="flex items-center justify-between">
                  <Label 
                    :for="`${category.id}-${capability.id}`"
                    class="text-base font-medium cursor-pointer"
                  >
                    {{ capability.name }}
                  </Label>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge :variant="getRiskBadgeVariant(capability.riskLevel)" class="ml-2">
                          <component :is="getRiskIcon(capability.riskLevel)" class="w-3 h-3 mr-1" />
                          {{ capability.riskLevel }} risk
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Risk level indicates potential impact on your project</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <p class="text-sm text-muted-foreground">
                  {{ capability.description }}
                </p>
                
                <div class="space-y-2">
                  <div v-if="capability.examples.length > 0">
                    <p class="text-xs font-medium text-muted-foreground">Examples:</p>
                    <ul class="text-xs text-muted-foreground list-disc list-inside">
                      <li v-for="example in capability.examples" :key="example">{{ example }}</li>
                    </ul>
                  </div>
                  
                  <div v-if="capability.restrictions.length > 0">
                    <p class="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Lock class="w-3 h-3" />
                      Restrictions:
                    </p>
                    <ul class="text-xs text-muted-foreground list-disc list-inside">
                      <li v-for="restriction in capability.restrictions" :key="restriction">{{ restriction }}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Permission Summary -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">Permission Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="space-y-2">
          <div class="flex items-center justify-between text-sm">
            <span>Total Capabilities</span>
            <span class="font-medium">{{ totalCapabilitiesCount }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span>Enabled</span>
            <span class="font-medium text-green-600">{{ enabledCapabilitiesCount }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span>Disabled</span>
            <span class="font-medium text-muted-foreground">{{ totalCapabilitiesCount - enabledCapabilitiesCount }}</span>
          </div>
          
          <div class="pt-2 mt-2 border-t">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <Info class="w-3 h-3" />
              <span>Permissions can be changed at any time from project settings</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>