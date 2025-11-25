<script setup>
import { ref } from "vue";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  Github,
  Key,
  Bell,
  Calendar,
  Save,
  Settings,
} from "lucide-vue-next";
import ElipsisMenu from "@/components/ElipsisMenu.vue";
import { appConfigs } from "@/appConfigs.js";
import { useToast } from "@/components/ui/toast/use-toast";
import {
  requestRepositoryAccess,
  requestOrganizationAccess,
  initiateGitHubAuth,
  requestRepositorySelection,
} from "@/lib/githubAuthService";

const props = defineProps({
  user: {
    type: Object,
    required: true
  },
  settingsStore: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['save-settings']);
const { toast } = useToast();

// GitHub auth handling functions
const handleGitHubAuthError = (error) => {
  console.error("GitHub auth error:", error);
  toast({
    title: "GitHub Authentication Error",
    description: error.message || "Failed to authenticate with GitHub",
    variant: "destructive",
    duration: 5000,
  });
};

const triggerRepoAccess = () => {
  toast({
    title: "GitHub Repository Access",
    description: "Requesting access to your repositories...",
    duration: 3000,
  });
  requestRepositoryAccess(props.user?.id || "", handleGitHubAuthError);
};

const triggerOrgAccess = () => {
  toast({
    title: "GitHub Organization Access",
    description: "Requesting access to your organizations...",
    duration: 3000,
  });
  requestOrganizationAccess(props.user?.id || "", handleGitHubAuthError);
};

const triggerCustomScopeAccess = (scopes) => {
  toast({
    title: "GitHub Custom Permissions",
    description: `Requesting custom scopes: ${scopes.join(", ")}`,
    duration: 3000,
  });
  initiateGitHubAuth({
    userId: props.user?.id || "",
    scopes,
    onError: handleGitHubAuthError,
  });
};

// GitHub actions menu items
const githubActionMenuItems = ref([
  {
    label: "Sync now",
    icon: RefreshCw,
    action: () => {
      toast({
        title: "GitHub sync",
        description: "Synchronizing with GitHub...",
        duration: 3000,
      });
    },
  },
  {
    label: "View on GitHub",
    icon: Github,
    action: () => {
      if (props.settingsStore.account.github?.html_url) {
        window.open(props.settingsStore.account.github.html_url, "_blank");
      }
    },
  },
  {
    label: "View App Page",
    icon: Settings,
    action: () => {
      window.open(appConfigs.GITHUB_APP_PUBLIC_URL, "_blank");
    },
  },
  {
    label: "Review access on GitHub",
    icon: Github,
    action: () => {
      window.open(appConfigs.GITHUB_REVIEW_ACCESS_URL, "_blank");
    },
  },
  { sep: true },
  {
    label: "Manage Repository Access",
    icon: Key,
    action: () => {
      toast({
        title: "GitHub Repository Selection",
        description: "Opening repository selection interface...",
        duration: 3000,
      });
      requestRepositorySelection(props.user?.id || "", handleGitHubAuthError);
    },
  },
  {
    label: "Manage Organization Access",
    icon: Key,
    action: triggerOrgAccess,
  },
  {
    label: "Request Workflow Permissions",
    icon: Key,
    action: () => triggerCustomScopeAccess(["workflow"]),
  },
  {
    label: "Request Package Permissions",
    icon: Key,
    action: () => triggerCustomScopeAccess(["read:packages", "write:packages"]),
  },
  { sep: true },
  {
    label: "Disconnect",
    action: () => {
      toast({
        title: "GitHub",
        description: "Disconnecting from GitHub...",
        variant: "destructive",
        duration: 3000,
      });
    },
  },
]);

// For custom GitHub scopes
const customScopes = ref("");

// Function to save integration settings
async function saveIntegrationSettings() {
  emit('save-settings', 'integrations');
}
</script>

<template>
  <Card class="shadow-md">
    <CardHeader>
      <CardTitle>Connected Services</CardTitle>
      <CardDescription>
        Manage your connected external accounts and services.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-6">
      <!-- GitHub Integration -->
      <div class="space-y-4">
        <h3 class="font-semibold text-base flex items-center gap-2">
          <Github class="h-5 w-5" />
          GitHub Integration
        </h3>

        <div class="bg-muted p-4 rounded-lg">
          <div v-if="settingsStore.account.github" class="space-y-4">
            <div class="flex items-center gap-3">
              <img
                :src="settingsStore.account.github.avatar_url"
                class="h-12 w-12 rounded-full border"
                alt="GitHub avatar"
              />
              <div>
                <h4 class="font-medium">
                  @{{ settingsStore.account.github.login }}
                </h4>
                <p class="text-sm text-muted-foreground">
                  GitHub ID: {{ settingsStore.account.github.id }}
                </p>
                <p class="text-sm text-muted-foreground">
                  Name:
                  {{ settingsStore.account.github.name || "Not set" }}
                </p>
              </div>
              <div class="ml-auto flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  @click="
                    () => {
                      toast({
                        title: 'GitHub Repository Selection',
                        description:
                          'Opening repository selection interface...',
                        duration: 3000,
                      });
                      requestRepositorySelection(
                        user?.id || '',
                        handleGitHubAuthError
                      );
                    }
                  "
                >
                  <Github class="h-4 w-4 mr-1" />
                  Manage Repo Access
                </Button>
                <ElipsisMenu :items="githubActionMenuItems" />
              </div>
            </div>

            <div class="border-t pt-3">
              <h4 class="font-medium text-sm mb-2">
                GitHub Account Details
              </h4>
              <div class="flex flex-wrap gap-2">
                <Badge
                  variant="secondary"
                  class="flex items-center gap-1"
                >
                  {{ settingsStore.account.github.login }}/repositories
                </Badge>
                <Badge
                  variant="secondary"
                  class="flex items-center gap-1"
                >
                  GitHub ID: {{ settingsStore.account.github.id }}
                </Badge>
              </div>

              <!-- Current Scopes (if available) -->
              <div
                v-if="settingsStore.account.github.scopes"
                class="mt-3"
              >
                <h5 class="text-xs font-medium mb-1">
                  Current Authorized Scopes:
                </h5>
                <div class="flex flex-wrap gap-1">
                  <Badge
                    v-for="scope in settingsStore.account.github.scopes.split(
                      ','
                    )"
                    :key="scope"
                    variant="outline"
                    class="text-xs"
                  >
                    {{ scope.trim() }}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="text-center py-6">
            <Github class="h-12 w-12 mx-auto mb-3 opacity-60" />
            <h4 class="font-medium mb-1">
              Connect your GitHub account
            </h4>
            <p class="text-sm text-muted-foreground mb-4">
              Integrate with your repositories to streamline your
              workflow.
            </p>
            <Button @click="triggerRepoAccess">
              <Github class="h-4 w-4 mr-2" />
              Connect GitHub Account
            </Button>
          </div>
        </div>

        <!-- GitHub Auth Testing Card -->
        <div
          class="bg-muted p-4 rounded-lg border border-dashed border-primary/30"
        >
          <h4 class="font-medium mb-3 flex items-center gap-2">
            <Key class="h-4 w-4" />
            GitHub Auth Testing
          </h4>
          <p class="text-sm text-muted-foreground mb-4">
            Use these buttons to test different GitHub authorization
            scopes
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
            <Button
              size="sm"
              variant="outline"
              @click="
                () => {
                  toast({
                    title: 'GitHub Repository Access',
                    description:
                      'Requesting access to your repositories...',
                    duration: 3000,
                  });
                  requestRepositoryAccess(
                    user?.id || '',
                    handleGitHubAuthError
                  );
                }
              "
              class="justify-start"
            >
              <Github class="h-4 w-4 mr-2" />
              Repository Access
            </Button>
            <Button
              size="sm"
              variant="outline"
              @click="triggerOrgAccess"
              class="justify-start"
            >
              <Github class="h-4 w-4 mr-2" />
              Organization Access
            </Button>
            <Button
              size="sm"
              variant="outline"
              @click="
                () => {
                  toast({
                    title: 'GitHub Repository Selection',
                    description:
                      'Opening repository selection interface...',
                    duration: 3000,
                  });
                  requestRepositorySelection(
                    user?.id || '',
                    handleGitHubAuthError
                  );
                }
              "
              class="justify-start"
            >
              <Github class="h-4 w-4 mr-2" />
              Repository Selection
            </Button>
            <Button
              size="sm"
              variant="outline"
              @click="() => triggerCustomScopeAccess(['workflow'])"
              class="justify-start"
            >
              <Github class="h-4 w-4 mr-2" />
              Workflow Access
            </Button>
            <Button
              size="sm"
              variant="outline"
              @click="
                () =>
                  triggerCustomScopeAccess([
                    'read:packages',
                    'write:packages',
                  ])
              "
              class="justify-start"
            >
              <Github class="h-4 w-4 mr-2" />
              Packages Access
            </Button>
          </div>

          <div class="mt-2">
            <h5 class="text-sm font-medium mb-2">Custom Scopes</h5>
            <div class="flex gap-2">
              <div class="flex-1">
                <Input
                  placeholder="Enter comma-separated scopes (e.g. gist,notifications)"
                  v-model="customScopes"
                />
              </div>
              <Button
                size="sm"
                @click="
                  () =>
                    triggerCustomScopeAccess(
                      customScopes
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                    )
                "
              >
                Request Scopes
              </Button>
            </div>
            <p class="text-xs text-muted-foreground mt-1">
              Common scopes: repo, read:org, admin:org, gist,
              notifications, user, delete_repo, write:packages,
              read:packages, workflow
            </p>
          </div>
        </div>
      </div>

      <!-- Other potential integrations -->
      <div class="pt-4 border-t">
        <h3 class="font-semibold text-base mb-3">
          Available Integrations
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            variant="outline"
            class="h-auto py-3 justify-start text-left flex items-start gap-3"
          >
            <div class="bg-primary/10 p-2 rounded">
              <Bell class="h-5 w-5 text-primary" />
            </div>
            <div>
              <p class="font-medium">Slack</p>
              <p class="text-sm text-muted-foreground">
                Get notifications in your Slack channels
              </p>
            </div>
          </Button>

          <Button
            variant="outline"
            class="h-auto py-3 justify-start text-left flex items-start gap-3"
          >
            <div class="bg-primary/10 p-2 rounded">
              <Calendar class="h-5 w-5 text-primary" />
            </div>
            <div>
              <p class="font-medium">Google Calendar</p>
              <p class="text-sm text-muted-foreground">
                Sync events with your Google Calendar
              </p>
            </div>
          </Button>
        </div>
      </div>
    </CardContent>
    <CardFooter class="flex justify-end">
      <Button
        @click="saveIntegrationSettings"
        class="flex items-center gap-1"
        :disabled="settingsStore.isSaving"
      >
        <Save class="h-4 w-4" :class="{ 'animate-spin': settingsStore.isSaving }" />
        <span>Save changes</span>
      </Button>
    </CardFooter>
  </Card>
</template>