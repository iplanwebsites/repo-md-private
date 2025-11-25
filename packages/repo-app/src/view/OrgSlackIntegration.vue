<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { Hash, AlertCircle, CheckCircle, Send, X, FolderOpen } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/toast/use-toast";
import PageHeadingBar from "@/components/PageHeadingBar.vue";
import trpc from "@/trpc";
import { useOrgStore } from "@/store/orgStore";

const route = useRoute();
const { toast } = useToast();
const orgStore = useOrgStore();

// Reactive state
const orgHandle = computed(() => route.params.orgId);
const isLoading = ref(true);
const isInstalling = ref(false);
const isSavingConfig = ref(false);
const status = ref(null);
const availableChannels = ref([]);
const channelConfig = ref([]);
const testingChannel = ref(null);
const projectScope = ref("all");
const selectedProjects = ref([]);
const projects = ref([]);

// Notification types
const notificationTypes = [
  { id: "deployments", label: "Deployments", description: "Successful and failed deployments" },
  { id: "errors", label: "Errors", description: "Error notifications and alerts" },
  { id: "tasks", label: "Tasks", description: "Task assignments and updates" },
  { id: "general", label: "General", description: "General updates and notifications" }
];

// Fetch installation status
const fetchStatus = async () => {
  isLoading.value = true;
  try {
    const result = await trpc.slack.getInstallationStatus.query({
      orgHandle: orgHandle.value
    });
    status.value = result;
    
    if (result.isInstalled && result.channels && result.channels.length > 0) {
      // Load saved channel configuration
      channelConfig.value = result.channels.map(ch => ({
        id: ch.id,
        name: ch.name,
        types: ch.types || []
      }));
    } else if (result.isInstalled && result.channelConfigs) {
      // Alternative: backend might return channelConfigs instead of channels
      channelConfig.value = result.channelConfigs.map(ch => ({
        id: ch.id,
        name: ch.name,
        types: ch.types || []
      }));
    }
    
    // Load project scope preferences
    if (result.projectScope) {
      projectScope.value = result.projectScope;
      selectedProjects.value = result.selectedProjects || [];
    }
  } catch (error) {
    console.error("Failed to fetch Slack status:", error);
    toast({
      title: "Error",
      description: "Failed to fetch Slack integration status",
      variant: "destructive"
    });
  } finally {
    isLoading.value = false;
  }
};

// Fetch available channels
const fetchChannels = async () => {
  if (!status.value?.isInstalled) return;
  
  try {
    const result = await trpc.slack.getChannels.query({
      orgHandle: orgHandle.value
    });
    availableChannels.value = result.channels;
  } catch (error) {
    console.error("Failed to fetch channels:", error);
    toast({
      title: "Error",
      description: "Failed to fetch Slack channels",
      variant: "destructive"
    });
  }
};

// Fetch organization projects
const fetchProjects = async () => {
  try {
    await orgStore.fetchProjects(orgHandle.value);
    projects.value = orgStore.currentOrgProjects || [];
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    toast({
      title: "Error",
      description: "Failed to fetch projects",
      variant: "destructive"
    });
  }
};

// Handle Slack installation
const handleInstall = async () => {
  isInstalling.value = true;
  
  try {
    const { installUrl } = await trpc.slack.generateInstallUrl.mutate({
      orgHandle: orgHandle.value
    });
    
    // Open OAuth flow in popup
    const popup = window.open(
      installUrl,
      'slack-oauth',
      'width=600,height=700,left=100,top=100'
    );
    
    // Listen for completion
    const messageHandler = (event) => {
      if (event.data.type === 'slack-connected') {
        popup?.close();
        window.removeEventListener('message', messageHandler);
        toast({
          title: "Success",
          description: "Slack has been connected successfully!"
        });
        fetchStatus();
        fetchChannels();
        isInstalling.value = false;
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Check if popup was closed
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageHandler);
        isInstalling.value = false;
        // Refresh status in case connection was completed
        fetchStatus();
        fetchChannels();
      }
    }, 1000);
    
  } catch (error) {
    console.error("Failed to start Slack installation:", error);
    toast({
      title: "Error",
      description: "Failed to connect to Slack. Please try again.",
      variant: "destructive"
    });
    isInstalling.value = false;
  }
};

// Handle Slack disconnection
const handleDisconnect = async () => {
  if (!confirm('Are you sure you want to disconnect Slack? All notification settings will be removed.')) {
    return;
  }
  
  try {
    await trpc.slack.uninstall.mutate({
      orgHandle: orgHandle.value
    });
    
    status.value = { isInstalled: false };
    channelConfig.value = [];
    availableChannels.value = [];
    
    toast({
      title: "Disconnected",
      description: "Slack integration has been removed"
    });
  } catch (error) {
    console.error("Failed to disconnect Slack:", error);
    toast({
      title: "Error",
      description: "Failed to disconnect Slack",
      variant: "destructive"
    });
  }
};

// Toggle notification type for a channel
const toggleChannelType = (channelId, channelName, type, checked) => {
  const existingConfigIndex = channelConfig.value.findIndex(ch => ch.id === channelId);
  
  if (checked) {
    // Add the type
    if (existingConfigIndex === -1) {
      // Add new channel config
      channelConfig.value.push({
        id: channelId,
        name: channelName,
        types: [type]
      });
    } else {
      // Add type to existing channel
      if (!channelConfig.value[existingConfigIndex].types.includes(type)) {
        channelConfig.value[existingConfigIndex].types.push(type);
      }
    }
  } else {
    // Remove the type
    if (existingConfigIndex !== -1) {
      const types = channelConfig.value[existingConfigIndex].types;
      const typeIndex = types.indexOf(type);
      if (typeIndex > -1) {
        types.splice(typeIndex, 1);
        // Remove channel config if no types selected
        if (types.length === 0) {
          channelConfig.value.splice(existingConfigIndex, 1);
        }
      }
    }
  }
};

// Check if a notification type is selected for a channel
const isTypeSelected = (channelId, type) => {
  const config = channelConfig.value.find(ch => ch.id === channelId);
  return config?.types.includes(type) || false;
};

// Save channel configuration
const saveConfiguration = async () => {
  isSavingConfig.value = true;
  
  try {
    await trpc.slack.configureChannels.mutate({
      orgHandle: orgHandle.value,
      channels: channelConfig.value,
      projectScope: projectScope.value,
      selectedProjects: projectScope.value === "selected" ? selectedProjects.value : []
    });
    
    toast({
      title: "Saved",
      description: "Notification settings have been updated"
    });
    
    // Refresh the status to ensure we have the latest configuration
    await fetchStatus();
  } catch (error) {
    console.error("Failed to save configuration:", error);
    toast({
      title: "Error",
      description: "Failed to save notification settings",
      variant: "destructive"
    });
  } finally {
    isSavingConfig.value = false;
  }
};

// Send test notification
const sendTestNotification = async (channelId) => {
  testingChannel.value = channelId;
  
  try {
    await trpc.slack.testNotification.mutate({
      orgHandle: orgHandle.value,
      channelId: channelId || undefined,
      message: `Test notification from Repo.md! Organization: ${orgHandle.value}`
    });
    
    toast({
      title: "Sent!",
      description: "Test notification has been sent to Slack"
    });
  } catch (error) {
    console.error("Failed to send test notification:", error);
    toast({
      title: "Error",
      description: "Failed to send test notification",
      variant: "destructive"
    });
  } finally {
    testingChannel.value = null;
  }
};

// Initialize on mount
onMounted(async () => {
  await fetchStatus();
  await fetchProjects();
  if (status.value?.isInstalled) {
    await fetchChannels();
  }
});
</script>

<template>
  <div>
    <PageHeadingBar
      title="Slack Integration"
      subtitle="Connect Slack to receive notifications about deployments, errors, and other project events"
    />

    <div class="container max-w-4xl">
      <!-- Loading State -->
      <div v-if="isLoading" class="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton class="h-8 w-64" />
            <Skeleton class="h-4 w-96 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton class="h-32 w-full" />
          </CardContent>
        </Card>
      </div>

      <!-- Not Connected State -->
      <Card v-else-if="!status?.isInstalled" class="border-2">
        <CardHeader>
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-lg bg-purple-600 flex items-center justify-center">
              <Hash class="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle>Connect Slack</CardTitle>
              <CardDescription>
                Get real-time notifications in your Slack workspace
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <div class="text-sm text-muted-foreground space-y-2">
              <p>Connect your Slack workspace to:</p>
              <ul class="list-disc list-inside space-y-1 ml-2">
                <li>Receive deployment notifications</li>
                <li>Get alerts for errors and issues</li>
                <li>Stay updated on project activity</li>
                <li>Configure notifications per channel</li>
              </ul>
            </div>
            
            <Button 
              @click="handleInstall" 
              :disabled="isInstalling"
              size="lg"
              class="w-full sm:w-auto"
            >
              <Hash class="w-4 h-4 mr-2" />
              {{ isInstalling ? 'Connecting...' : 'Connect Slack Workspace' }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Connected State -->
      <div v-else class="space-y-6">
        <!-- Connection Status Card -->
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-lg bg-purple-600 flex items-center justify-center">
                  <Hash class="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle class="flex items-center gap-2">
                    <CheckCircle class="w-5 h-5 text-green-600" />
                    Connected to {{ status.teamName }}
                  </CardTitle>
                  <CardDescription>
                    Connected {{ new Date(status.installedAt).toLocaleDateString() }}
                  </CardDescription>
                </div>
              </div>
              <div class="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  @click="sendTestNotification()"
                  :disabled="testingChannel !== null"
                >
                  <Send class="w-4 h-4 mr-2" />
                  Test
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  @click="handleDisconnect"
                >
                  <X class="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <!-- Channel Configuration -->
        <Card>
          <CardHeader>
            <CardTitle>Notification Channels</CardTitle>
            <CardDescription>
              Choose which Slack channels receive which types of notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div v-if="availableChannels.length === 0" class="text-center py-8 text-muted-foreground">
              <p>No channels available. Make sure the Repo.md bot is invited to your channels.</p>
            </div>
            
            <div v-else class="space-y-4">
              <!-- Notification type descriptions -->
              <Alert>
                <AlertCircle class="h-4 w-4" />
                <AlertDescription>
                  Invite the Repo.md bot to channels where you want to receive notifications.
                </AlertDescription>
              </Alert>

              <!-- Channel table -->
              <div class="rounded-lg border">
                <table class="w-full">
                  <thead>
                    <tr class="border-b bg-muted/50">
                      <th class="text-left p-4 font-medium">Channel</th>
                      <th v-for="type in notificationTypes" :key="type.id" class="text-center p-4 font-medium">
                        <div>{{ type.label }}</div>
                        <div class="text-xs font-normal text-muted-foreground">{{ type.description }}</div>
                      </th>
                      <th class="text-center p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="channel in availableChannels" :key="channel.id" class="border-b">
                      <td class="p-4">
                        <div class="flex items-center gap-2">
                          <Hash class="w-4 h-4 text-muted-foreground" />
                          <span class="font-medium">{{ channel.name }}</span>
                          <span v-if="!channel.isMember" class="text-xs text-orange-600">(Bot not in channel)</span>
                        </div>
                      </td>
                      <td v-for="type in notificationTypes" :key="type.id" class="text-center p-4">
                        <div class="flex flex-col items-center gap-1">
                          <Checkbox
                            :id="`check-${channel.id}-${type.id}`"
                            :model-value="isTypeSelected(channel.id, type.id)"
                            @update:model-value="(checked) => toggleChannelType(channel.id, channel.name, type.id, checked)"
                            :disabled="!channel.isMember"
                          />
                        </div>
                      </td>
                      <td class="text-center p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          @click="sendTestNotification(channel.id)"
                          :disabled="testingChannel !== null || !channel.isMember"
                        >
                          <Send class="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>
          </CardContent>
        </Card>

        <!-- Project Scope Configuration -->
        <Card>
          <CardHeader>
            <CardTitle>Project Scope</CardTitle>
            <CardDescription>
              Choose which projects should send notifications to Slack
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-6">
              <!-- Project scope radio options -->
              <RadioGroup v-model="projectScope">
                <div class="flex items-center space-x-3">
                  <RadioGroupItem value="all" id="scope-all" />
                  <Label for="scope-all" class="font-normal cursor-pointer">
                    <div>All projects in this organization</div>
                    <div class="text-sm text-muted-foreground">Receive notifications from all current and future projects</div>
                  </Label>
                </div>
                <div class="flex items-center space-x-3 mt-4">
                  <RadioGroupItem value="selected" id="scope-selected" />
                  <Label for="scope-selected" class="font-normal cursor-pointer">
                    <div>Selected projects only</div>
                    <div class="text-sm text-muted-foreground">Choose specific projects to receive notifications from</div>
                  </Label>
                </div>
              </RadioGroup>

              <!-- Project selection list (shown only when "selected" is chosen) -->
              <div v-if="projectScope === 'selected'" class="mt-6">
                <div v-if="projects.length === 0" class="text-center py-8 text-muted-foreground">
                  <p>No projects found in this organization.</p>
                </div>
                
                <div v-else class="space-y-3">
                  <div class="text-sm text-muted-foreground mb-2">
                    Select projects to receive notifications from:
                  </div>
                  <div class="max-h-64 overflow-y-auto border rounded-lg p-4 space-y-3">
                    <div v-for="project in projects" :key="project._id" class="flex items-start space-x-3">
                      <Checkbox
                        :id="`project-${project._id}`"
                        :model-value="selectedProjects.includes(project._id)"
                        @update:model-value="(checked) => {
                          if (checked) {
                            if (!selectedProjects.value.includes(project._id)) {
                              selectedProjects.value.push(project._id);
                            }
                          } else {
                            selectedProjects.value = selectedProjects.value.filter(id => id !== project._id);
                          }
                        }"
                      />
                      <Label :for="`project-${project._id}`" class="font-normal cursor-pointer flex-1">
                        <div class="flex items-center gap-2">
                          <FolderOpen class="w-4 h-4 text-muted-foreground" />
                          <span class="font-medium">{{ project.name }}</span>
                        </div>
                        <div v-if="project.domain" class="text-sm text-muted-foreground">
                          {{ project.domain }}
                        </div>
                      </Label>
                    </div>
                  </div>
                  <div class="text-sm text-muted-foreground">
                    {{ selectedProjects.length }} project{{ selectedProjects.length !== 1 ? 's' : '' }} selected
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Save Configuration Button -->
        <div class="flex justify-end">
          <Button 
            @click="saveConfiguration"
            :disabled="isSavingConfig"
            size="lg"
          >
            {{ isSavingConfig ? 'Saving...' : 'Save All Settings' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>