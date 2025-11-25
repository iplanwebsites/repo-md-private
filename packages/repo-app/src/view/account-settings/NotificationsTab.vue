<script setup>
import { ref, computed } from "vue";
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
import { Badge } from "@/components/ui/badge";
import { Save } from "lucide-vue-next";

const props = defineProps({
  settingsStore: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['save-settings']);

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

// Function to save notification settings
async function saveNotificationSettings() {
  emit('save-settings', 'notifications');
}
</script>

<template>
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
              :disabled="settingsStore.isSaving"
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
              :disabled="settingsStore.isSaving"
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
              :disabled="settingsStore.isSaving"
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
            <Switch v-model="event.enabled" :disabled="settingsStore.isSaving" />
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
        :disabled="settingsStore.isSaving"
      >
        <Save class="h-4 w-4" :class="{ 'animate-spin': settingsStore.isSaving }" />
        <span>Save changes</span>
      </Button>
    </CardFooter>
  </Card>
</template>