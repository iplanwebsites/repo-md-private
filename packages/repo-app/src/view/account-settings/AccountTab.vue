<script setup>
import { ref, onMounted, computed } from "vue";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Save,
} from "lucide-vue-next";

const props = defineProps({
  user: {
    type: Object,
    required: true
  },
  settingsStore: {
    type: Object,
    required: true
  },
  session: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['save-settings']);

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

// Initialize account settings with store values
onMounted(() => {
  accountSettings.value = {
    name: props.settingsStore.account.name || props.user.name,
    email: props.settingsStore.account.email || props.user.email,
    timezone: props.settingsStore.account.timezone || "America/New_York",
    language: props.settingsStore.account.language || "en",
    profileImage:
      props.settingsStore.account.profileImage ||
      props.settingsStore.account.github?.avatar_url ||
      props.user.avatar ||
      "",
    notificationPreferences: {
      ...props.settingsStore.account.notificationPreferences,
    },
    github: props.settingsStore.account.github,
    githubHandle: props.settingsStore.account.githubHandle || "",
  };
});

const isUpdatingAccount = ref(false);

// Function to save account settings
async function saveAccountSettings() {
  try {
    isUpdatingAccount.value = true;

    // Update the store with current values
    props.settingsStore.account.name = accountSettings.value.name;
    props.settingsStore.account.email = accountSettings.value.email;
    props.settingsStore.account.timezone = accountSettings.value.timezone;
    props.settingsStore.account.language = accountSettings.value.language;
    props.settingsStore.account.profileImage = accountSettings.value.profileImage;

    if (accountSettings.value.notificationPreferences) {
      props.settingsStore.account.notificationPreferences = {
        ...props.settingsStore.account.notificationPreferences,
        ...accountSettings.value.notificationPreferences,
      };
    }

    // Emit event to save settings from parent
    emit('save-settings', 'account');

  } catch (error) {
    console.error("Error updating account settings:", error);
  } finally {
    isUpdatingAccount.value = false;
  }
}
</script>

<template>
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
      <div class="pt-6 border-t" v-if=false>
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
</template>