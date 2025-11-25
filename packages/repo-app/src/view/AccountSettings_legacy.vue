// Settings.vue
<script setup>
import { ref, onMounted, computed, toRefs } from "vue";
import { useSettingsStore } from "@/store/settingsStore";
import { formatDateCustom } from "@/lib/utils/dateUtils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CreditCard,
  Bell,
  Video,
  Save,
  RefreshCw,
  CheckCircle,
  Calendar,
  ChevronRight,
  ChevronLeft,
  User,
  Github,
  Key,
  Eye,
  EyeOff,
  Copy,
  Settings,
} from "lucide-vue-next";
import ElipsisMenu from "@/components/ElipsisMenu.vue";

import { appConfigs } from "@/appConfigs.js";
import trpc from "@/trpc";
import { useToast } from "@/components/ui/toast/use-toast";

////import router
import { useRouter } from "vue-router";
import {
  requestRepositoryAccess,
  requestOrganizationAccess,
  initiateGitHubAuth,
  requestRepositorySelection,
} from "@/lib/githubAuthService";
const router = useRouter();
const { toast } = useToast();

const props = defineProps({
  session: {
    type: Object,
    default: () => ({}),
  },
});
const { session } = toRefs(props);
const user = computed(() => ({
  email: session.value?.user?.email || "",
  avatar: session.value?.user?.user_metadata?.avatar_url || "",
  name:
    session.value?.user?.user_metadata?.full_name ||
    session.value?.user?.email?.split("@")[0] ||
    "",
  id: session.value?.user?.id || "",
}));

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
  requestRepositoryAccess(user.value?.id || "", handleGitHubAuthError);
};

const triggerOrgAccess = () => {
  toast({
    title: "GitHub Organization Access",
    description: "Requesting access to your organizations...",
    duration: 3000,
  });
  requestOrganizationAccess(user.value?.id || "", handleGitHubAuthError);
};

const triggerCustomScopeAccess = (scopes) => {
  toast({
    title: "GitHub Custom Permissions",
    description: `Requesting custom scopes: ${scopes.join(", ")}`,
    duration: 3000,
  });
  initiateGitHubAuth({
    userId: user.value?.id || "",
    scopes,
    onError: handleGitHubAuthError,
  });
};

const settingsStore = useSettingsStore();
const activeTab = ref("account");
const { isLoading, isSaving } = settingsStore;

// API key management
const standardApiKey = ref("");
const showStandardApiKey = ref(false);
const generateStandardApiKey = async () => {
  standardApiKey.value = "sk_" + Math.random().toString(36).substring(2, 15);
  // Here you would typically call an API to generate a real API key
};

// Secret API key management
const secretApiKey = ref("");
const showSecretApiKey = ref(false);
const generateSecretApiKey = async () => {
  secretApiKey.value =
    "sk_secret_" + Math.random().toString(36).substring(2, 15);
  // Here you would typically call an API to generate a real API key
};

// Notification event types
const notificationEvents = ref([
  {
    id: "deployment-success",
    label: "Deployment success",
    description: "Receive notifications when deployments complete successfully",
    enabled: true,
  },
  {
    id: "deployment-failure",
    label: "Deployment failures",
    description: "Be alerted when deployments fail to complete",
    enabled: true,
  },
  {
    id: "deployment-warning",
    label: "Deployment warnings",
    description:
      "Get notified about issues like duplicate slugs or oversized files",
    enabled: false,
  },
  {
    id: "settings-change",
    label: "Settings changes",
    description: "Receive alerts when account settings are modified",
    enabled: true,
  },
  {
    id: "usage-reports",
    label: "Monthly usage reports",
    description:
      "Get monthly summaries of your account activity and resource usage",
    enabled: true,
  },
]);

// Computed property for enabled notification events
const enabledNotificationEvents = computed(() => {
  return notificationEvents.value.filter((event) => event.enabled);
});

// GitHub integration
const githubAccount = ref({
  connected: true,
  username: "johnsmith",
  avatar: "https://github.com/identicons/johnsmith.png",
  lastSync: "2025-04-02T15:30:00Z",
});

// Function to save API key settings
async function saveApiKeySettings() {
  await settingsStore.saveSettings("apikeys");
}

// Function to save integration settings
async function saveIntegrationSettings() {
  await settingsStore.saveSettings("integrations");
}

// Function to save meeting settings
async function saveMeetingsSettings() {
  await settingsStore.saveSettings("meetings");
}

// Function to save notification settings
async function saveNotificationSettings() {
  await settingsStore.saveSettings("notifications");
}

// For custom GitHub scopes
const customScopes = ref("");

// Format expiry date
const formattedExpiryDate = computed(() => {
  return settingsStore.billing.expiryDate
    ? formatDateCustom(settingsStore.billing.expiryDate)
    : "N/A";
});

// Text for auto-renewal button
const autoRenewButtonText = computed(() => {
  return settingsStore.billing.autoRenew
    ? "Disable auto-renewal"
    : "Enable auto-renewal";
});

// Account settings
const accountSettings = ref({
  name: "",
  email: "",
  timezone: "",
  language: "",
  profileImage: "",
  notificationPreferences: {
    email: false,
    push: false,
    sms: false,
  },
  github: null,
  githubHandle: "",
});

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
      if (settingsStore.account.github?.html_url) {
        window.open(settingsStore.account.github.html_url, "_blank");
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
      requestRepositorySelection(user.value?.id || "", handleGitHubAuthError);
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

// Load all settings and initialize values
onMounted(async () => {
  await settingsStore.loadSettings();

  // Initialize account settings with store values
  accountSettings.value = {
    name: settingsStore.account.name || user.value.name,
    email: settingsStore.account.email || user.value.email,
    timezone: settingsStore.account.timezone || "America/New_York",
    language: settingsStore.account.language || "en",
    profileImage:
      settingsStore.account.profileImage ||
      settingsStore.account.github?.avatar_url ||
      user.value.avatar ||
      "",
    notificationPreferences: {
      ...settingsStore.account.notificationPreferences,
    },
    github: settingsStore.account.github,
    githubHandle: settingsStore.account.githubHandle || "",
  };
});

const isUpdatingAccount = ref(false);

// Function to save account settings
async function saveAccountSettings() {
  try {
    isUpdatingAccount.value = true;

    // Update the store with current values
    settingsStore.account.name = accountSettings.value.name;
    settingsStore.account.email = accountSettings.value.email;
    settingsStore.account.timezone = accountSettings.value.timezone;
    settingsStore.account.language = accountSettings.value.language;
    settingsStore.account.profileImage = accountSettings.value.profileImage;

    if (accountSettings.value.notificationPreferences) {
      settingsStore.account.notificationPreferences = {
        ...settingsStore.account.notificationPreferences,
        ...accountSettings.value.notificationPreferences,
      };
    }

    // Save account settings using the store
    await settingsStore.saveSettings("account");

    toast({
      title: "Account settings updated",
      description: "Your account information has been updated successfully.",
      duration: 3000,
    });
  } catch (error) {
    console.error("Error updating account settings:", error);
    toast({
      title: "Error",
      description: "Failed to update account settings. Please try again.",
      variant: "destructive",
    });
  } finally {
    isUpdatingAccount.value = false;
  }
}

const back = () => {
  router.back();
};
</script>

<template>
  <json-debug :data="session" label="session" />

  <json-debug :data="settingsStore.account" label="settingsStore.account" />

  <div class="container mx-auto py-8 px-4">
    <div class="max-w-4xl mx-auto space-y-8">
      <Button variant="outline" class="min-w-[150px]" @click="back">
        <ChevronLeft class="ml-1 h-4 w-4" />
        Back
      </Button>

      <!-- Page header -->
      <div class="space-y-4">
        <h1 class="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p class="text-muted-foreground">
          Adjust your preferences. Project and team settings can be managedfrom
          the
          <router-link to="/" class="underline"> dashboard </router-link>.
        </p>
      </div>

      <!-- Navigation tabs -->
      <Tabs v-model="activeTab" class="space-y-6">
        <TabsList class="grid w-full grid-cols-5">
          <TabsTrigger value="account" class="flex items-center gap-2">
            <User class="h-4 w-4" />
            <span>Account</span>
          </TabsTrigger>
          <TabsTrigger value="billing" class="flex items-center gap-2">
            <CreditCard class="h-4 w-4" />
            <span>Billing</span>
          </TabsTrigger>
          <TabsTrigger value="apikeys" class="flex items-center gap-2">
            <Key class="h-4 w-4" />
            <span>API Keys</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" class="flex items-center gap-2">
            <Bell class="h-4 w-4" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" class="flex items-center gap-2">
            <RefreshCw class="h-4 w-4" />
            <span>Integrations</span>
          </TabsTrigger>
        </TabsList>

        <!-- Account Settings Section -->
        <TabsContent value="account" class="space-y-6">
          <Card class="shadow-md">
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Update your personal information and account preferences.
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Profile Picture -->
                <div class="md:col-span-2 flex items-center gap-4">
                  <div
                    class="w-20 h-20 relative rounded-full overflow-hidden border"
                  >
                    <img
                      :src="
                        accountSettings.profileImage ||
                        settingsStore.account.github?.avatar_url ||
                        '/placeholder.svg'
                      "
                      alt="Profile Picture"
                      class="w-full h-full object-cover"
                    />
                    <div
                      class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <span class="text-white text-xs">Change</span>
                    </div>
                  </div>
                  <div>
                    <h3 class="font-medium">Profile Picture</h3>
                    <p class="text-sm text-muted-foreground">
                      {{
                        settingsStore.account.github
                          ? "Using GitHub profile picture"
                          : "Upload a new profile picture or avatar"
                      }}
                    </p>
                    <div class="flex gap-2 mt-2">
                      <Button variant="outline" size="sm">
                        Upload Image
                      </Button>
                      <Button
                        v-if="settingsStore.account.github"
                        variant="outline"
                        size="sm"
                        @click="
                          accountSettings.profileImage =
                            settingsStore.account.github.avatar_url
                        "
                      >
                        <RefreshCw class="h-3 w-3 mr-1" />
                        Use GitHub Avatar
                      </Button>
                    </div>
                  </div>
                </div>

                <!-- Full Name -->
                <div class="space-y-2">
                  <label class="text-sm font-medium">Full Name</label>
                  <Input
                    v-model="accountSettings.name"
                    placeholder="Your full name"
                  />
                </div>

                <!-- Email (read-only) -->
                <div class="space-y-2">
                  <label class="text-sm font-medium">Email Address</label>
                  <Input
                    v-model="accountSettings.email"
                    placeholder="Your email address"
                    type="email"
                    disabled
                    class="text-muted-foreground bg-muted/50 cursor-not-allowed"
                  />
                  <p class="text-xs text-muted-foreground">
                    Email address cannot be changed
                  </p>
                </div>

                <!-- Language -->
                <div class="space-y-2">
                  <label class="text-sm font-medium">Language</label>
                  <Select v-model="accountSettings.language">
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <!-- Timezone -->
                <div class="space-y-2">
                  <label class="text-sm font-medium">Timezone</label>
                  <Select v-model="accountSettings.timezone">
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York"
                        >Eastern Time (ET)</SelectItem
                      >
                      <SelectItem value="America/Chicago"
                        >Central Time (CT)</SelectItem
                      >
                      <SelectItem value="America/Denver"
                        >Mountain Time (MT)</SelectItem
                      >
                      <SelectItem value="America/Los_Angeles"
                        >Pacific Time (PT)</SelectItem
                      >
                      <SelectItem value="Europe/London"
                        >London (GMT)</SelectItem
                      >
                      <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <!-- Notification Preferences -->
              <div class="pt-6 border-t">
                <h3 class="font-semibold text-base mb-4">
                  Notification Preferences
                </h3>
                <div class="space-y-4">
                  <div class="flex justify-between items-center">
                    <div>
                      <p class="font-medium">Email Notifications</p>
                      <p class="text-sm text-muted-foreground">
                        Receive updates and alerts via email
                      </p>
                    </div>
                    <Switch
                      v-model="accountSettings.notificationPreferences.email"
                    />
                  </div>
                  <div class="flex justify-between items-center">
                    <div>
                      <p class="font-medium">Push Notifications</p>
                      <p class="text-sm text-muted-foreground">
                        Receive browser push notifications
                      </p>
                    </div>
                    <Switch
                      v-model="accountSettings.notificationPreferences.push"
                    />
                  </div>
                  <div class="flex justify-between items-center">
                    <div>
                      <p class="font-medium">SMS Notifications</p>
                      <p class="text-sm text-muted-foreground">
                        Receive important alerts via text message
                      </p>
                    </div>
                    <Switch
                      v-model="accountSettings.notificationPreferences.sms"
                    />
                  </div>
                </div>
              </div>

              <!-- Security Section -->
              <div class="pt-6 border-t">
                <h3 class="font-semibold text-base mb-4">Security Settings</h3>
                <div class="space-y-4">
                  <div class="flex justify-between items-center">
                    <div>
                      <p class="font-medium">Two-Factor Authentication</p>
                      <p class="text-sm text-muted-foreground">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                    <Button variant="outline">Enable 2FA</Button>
                  </div>
                  <div class="flex justify-between items-center">
                    <div>
                      <p class="font-medium">Change Password</p>
                      <p class="text-sm text-muted-foreground">
                        Update your password regularly for better security
                      </p>
                    </div>
                    <Button variant="outline">Change</Button>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter class="flex justify-end">
              <Button
                @click="saveAccountSettings"
                class="flex items-center gap-1"
                :disabled="isUpdatingAccount"
              >
                <Save
                  class="h-4 w-4"
                  :class="{ 'animate-spin': isUpdatingAccount }"
                />
                <span>Save changes</span>
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <!-- Billing Section -->
        <TabsContent value="billing" class="space-y-6">
          <Card class="shadow-md">
            <CardHeader>
              <CardTitle>Your Current Plan</CardTitle>
              <CardDescription>
                Manage your subscription options and track your payment
                deadlines.
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-6">
              <!-- Current plan information -->
              <div
                v-if="!settingsStore.currentPlanDetails"
                class="text-center py-6"
              >
                <CreditCard class="h-12 w-12 mx-auto mb-3 opacity-60" />
                <h3 class="font-medium mb-2">No active plan</h3>
                <p class="text-sm text-muted-foreground mb-4">
                  Choose a subscription plan to access our services.
                </p>
                <Button> Subscribe to a Plan </Button>
              </div>

              <div v-else class="flex items-start justify-between gap-4">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <h3 class="font-semibold text-lg">
                      {{ settingsStore.currentPlanDetails.name }} Plan
                    </h3>
                    <Badge variant="secondary">
                      {{ settingsStore.currentPlanDetails.price }}/month
                    </Badge>
                  </div>
                  <p class="text-sm text-muted-foreground">
                    Expiration:
                    <span class="font-medium">{{ formattedExpiryDate }}</span>
                  </p>
                  <ul class="text-sm text-muted-foreground mt-2 space-y-1">
                    <li
                      v-for="(feature, index) in settingsStore
                        .currentPlanDetails.features || []"
                      :key="index"
                      class="flex items-center gap-1"
                    >
                      <CheckCircle class="h-3.5 w-3.5 text-green-500" />
                      <span>{{ feature }}</span>
                    </li>
                  </ul>
                </div>
                <div class="space-y-3">
                  <Button variant="outline" class="w-full min-w-[150px]">
                    Change plan
                    <ChevronRight class="ml-1 h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    class="w-full flex items-center gap-1"
                    @click="settingsStore.toggleAutoRenew()"
                    :disabled="isSaving"
                  >
                    <RefreshCw
                      class="h-4 w-4"
                      :class="{ 'animate-spin': isSaving }"
                    />
                    <span>{{ autoRenewButtonText }}</span>
                  </Button>
                </div>
              </div>

              <!-- Payment method -->
              <div class="pt-4 border-t">
                <h4 class="font-semibold text-base mb-2">Payment Method</h4>
                <div
                  v-if="
                    settingsStore.billing.paymentMethod &&
                    settingsStore.billing.paymentMethod.last4
                  "
                  class="flex items-center gap-3"
                >
                  <CreditCard class="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p class="text-sm">
                      Card ending in
                      {{ settingsStore.billing.paymentMethod.last4 }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      Expires on
                      {{
                        settingsStore.billing.paymentMethod.expiryDate || "N/A"
                      }}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" class="ml-auto">
                    Edit
                  </Button>
                </div>
                <div v-else class="flex items-center gap-3">
                  <CreditCard class="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p class="text-sm">No payment method on file</p>
                    <p class="text-xs text-muted-foreground">
                      Add a payment method to subscribe to a plan
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" class="ml-auto">
                    Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Billing history -->
          <Card class="shadow-md">
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>
                View and download your invoices.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div class="text-center py-4 text-muted-foreground">
                <Calendar class="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>No invoices are available at this time.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- API Keys Section -->
        <TabsContent value="apikeys" class="space-y-6">
          <Card class="shadow-md">
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Securely access our API with your private keys.
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-6">
              <div class="space-y-6">
                <!-- Standard API Key -->
                <div>
                  <h3 class="font-medium mb-3">Standard API Key</h3>
                  <div class="space-y-4">
                    <p class="text-sm text-muted-foreground">
                      Use this API key for most operations. It has read-only
                      access to your account data.
                    </p>

                    <div class="flex items-center space-x-2">
                      <div class="relative flex-1">
                        <input
                          :type="showStandardApiKey ? 'text' : 'password'"
                          :value="
                            standardApiKey || '••••••••••••••••••••••••••'
                          "
                          readonly
                          class="w-full px-3 py-2 border rounded-md text-sm"
                          placeholder="No API key generated"
                        />
                        <button
                          @click="showStandardApiKey = !showStandardApiKey"
                          class="absolute right-10 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <Eye v-if="!showStandardApiKey" class="h-4 w-4" />
                          <EyeOff v-else class="h-4 w-4" />
                        </button>
                      </div>
                      <Button
                        v-if="standardApiKey"
                        variant="outline"
                        size="sm"
                        @click="
                          () => {
                            navigator.clipboard.writeText(standardApiKey);
                          }
                        "
                      >
                        <Copy class="h-4 w-4" />
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        @click="generateStandardApiKey"
                      >
                        <Key class="h-4 w-4 mr-1" />
                        {{ standardApiKey ? "Regenerate" : "Generate" }}
                      </Button>
                    </div>
                  </div>
                </div>

                <!-- Secret API Key -->
                <div class="pt-4 border-t">
                  <h3 class="font-medium mb-3">Secret API Key</h3>
                  <div class="space-y-4">
                    <p class="text-sm text-muted-foreground">
                      This key has full access to your account, including the
                      ability to modify data and make purchases.
                    </p>

                    <div class="flex items-center space-x-2">
                      <div class="relative flex-1">
                        <input
                          :type="showSecretApiKey ? 'text' : 'password'"
                          :value="secretApiKey || '••••••••••••••••••••••••••'"
                          readonly
                          class="w-full px-3 py-2 border rounded-md text-sm"
                          placeholder="No API key generated"
                        />
                        <button
                          @click="showSecretApiKey = !showSecretApiKey"
                          class="absolute right-10 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <Eye v-if="!showSecretApiKey" class="h-4 w-4" />
                          <EyeOff v-else class="h-4 w-4" />
                        </button>
                      </div>
                      <Button
                        v-if="secretApiKey"
                        variant="outline"
                        size="sm"
                        @click="
                          () => {
                            navigator.clipboard.writeText(secretApiKey);
                          }
                        "
                      >
                        <Copy class="h-4 w-4" />
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        @click="generateSecretApiKey"
                      >
                        <Key class="h-4 w-4 mr-1" />
                        {{ secretApiKey ? "Regenerate" : "Generate" }}
                      </Button>
                    </div>
                  </div>
                </div>

                <!-- API Security Notice -->
                <div class="pt-4 border-t">
                  <div
                    class="text-sm text-muted-foreground bg-muted p-4 rounded-md"
                  >
                    <p class="font-medium text-destructive mb-2">
                      Important Security Information:
                    </p>
                    <ul class="list-disc pl-5 space-y-1">
                      <li>
                        API keys provide programmatic access to your account
                      </li>
                      <li>
                        Do not share your API keys in public repositories or
                        client-side code
                      </li>
                      <li>
                        Immediately regenerate your keys if you suspect they've
                        been compromised
                      </li>
                      <li>
                        Store API keys securely using environment variables or a
                        secrets manager
                      </li>
                      <li>
                        All API activity is logged and can be monitored in your
                        account dashboard
                      </li>
                    </ul>
                  </div>
                </div>

                <!-- API Documentation Link -->
                <div class="pt-4 flex justify-end">
                  <Button variant="outline" class="flex items-center gap-1">
                    View API Documentation
                    <ChevronRight class="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
            <CardFooter class="flex justify-end">
              <Button
                @click="saveApiKeySettings"
                class="flex items-center gap-1"
                :disabled="isSaving"
              >
                <Save class="h-4 w-4" :class="{ 'animate-spin': isSaving }" />
                <span>Save changes</span>
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <!-- Notifications Section -->
        <TabsContent value="notifications" class="space-y-6">
          <Card class="shadow-md">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose your preferred channels and stay informed.
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-6">
              <!-- Notification channels -->
              <div class="space-y-4">
                <h3 class="font-semibold text-base">Notification Channels</h3>
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="font-medium">Email notifications</p>
                      <p class="text-sm text-muted-foreground">
                        Receive notifications by email
                      </p>
                    </div>
                    <Switch
                      v-model="settingsStore.notifications.email"
                      :disabled="isSaving"
                    />
                  </div>
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="font-medium">Browser notifications</p>
                      <p class="text-sm text-muted-foreground">
                        Receive notifications in your browser
                      </p>
                    </div>
                    <Switch
                      v-model="settingsStore.notifications.browser"
                      :disabled="isSaving"
                    />
                  </div>
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="font-medium">Slack notifications</p>
                      <p class="text-sm text-muted-foreground">
                        Send notifications to your connected Slack workspace
                      </p>
                    </div>
                    <Switch
                      v-model="settingsStore.notifications.slack"
                      :disabled="isSaving"
                    />
                  </div>
                </div>
              </div>

              <!-- Event types -->
              <div class="space-y-4 pt-4 border-t">
                <h3 class="font-semibold text-base">Event Types</h3>
                <div class="space-y-3">
                  <div
                    v-for="event in notificationEvents"
                    :key="event.id"
                    class="flex items-center justify-between"
                  >
                    <div>
                      <p class="font-medium">{{ event.label }}</p>
                      <p class="text-sm text-muted-foreground">
                        {{ event.description }}
                      </p>
                    </div>
                    <Switch v-model="event.enabled" :disabled="isSaving" />
                  </div>
                </div>
              </div>

              <!-- Active notifications summary -->
              <div class="bg-muted p-4 rounded-md">
                <h4 class="font-medium mb-2">Active notifications</h4>
                <div class="flex flex-wrap gap-2">
                  <Badge
                    v-for="event in enabledNotificationEvents"
                    :key="event.id"
                    variant="secondary"
                  >
                    {{ event.label }}
                  </Badge>
                  <p
                    v-if="enabledNotificationEvents.length === 0"
                    class="text-sm text-muted-foreground"
                  >
                    No notification events enabled
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter class="flex justify-end">
              <Button
                @click="saveNotificationSettings"
                class="flex items-center gap-1"
                :disabled="isSaving"
              >
                <Save class="h-4 w-4" :class="{ 'animate-spin': isSaving }" />
                <span>Save changes</span>
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <!-- Integrations Section -->
        <TabsContent value="integrations" class="space-y-6">
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
                                user.value?.id || '',
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
                            user.value?.id || '',
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
                            user.value?.id || '',
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
                :disabled="isSaving"
              >
                <Save class="h-4 w-4" :class="{ 'animate-spin': isSaving }" />
                <span>Save changes</span>
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
}
</style>
