<script setup>
import { ref, onMounted, computed, toRefs, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useSettingsStore } from "@/store/settingsStore";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  CreditCard,
  Key,
  Bell,
  RefreshCw,
  ChevronLeft,
  Puzzle
} from "lucide-vue-next";
import JsonDebug from "@/components/JsonDebug.vue";
import { useToast } from "@/components/ui/toast/use-toast";

const router = useRouter();
const route = useRoute();
const { toast } = useToast();
const settingsStore = useSettingsStore();

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

// Store the referrer URL when component is mounted
const previousUrl = ref('/');

onMounted(async () => {
  await settingsStore.loadSettings();
  
  // Simple approach: check if we have a referrer that's not a settings page
  const referrer = document.referrer;
  if (referrer && !referrer.includes('/settings')) {
    // Parse the URL to get just the path
    const url = new URL(referrer);
    previousUrl.value = url.pathname + url.search + url.hash;
  }
});

// Define the tabs
const tabs = [
  { value: 'account', label: 'Account', icon: User },
  { value: 'billing', label: 'Billing', icon: CreditCard },
  { value: 'apikeys', label: 'API Keys', icon: Key },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'integrations', label: 'Integrations', icon: Puzzle },
];

// Get active tab from route
const activeTab = computed(() => {
  const routeName = route.name;
  if (routeName?.startsWith('accountSettings.')) {
    return routeName.split('.')[1];
  }
  return route.params.tab || 'account';
});

// Handle tab change
const handleTabChange = (value) => {
  router.push({ name: `accountSettings.${value}` });
};

// Watch for route changes to ensure tab state stays in sync
watch(() => route.name, (newRouteName) => {
  console.log('Route changed to:', newRouteName);
});

// Common save handler for all tabs
const saveSettings = async (section) => {
  try {
    await settingsStore.saveSettings(section);
    toast({
      title: "Settings saved",
      description: `Your ${section} settings have been updated successfully.`,
      duration: 3000,
    });
  } catch (error) {
    console.error(`Error saving ${section} settings:`, error);
    toast({
      title: "Error",
      description: `Failed to save ${section} settings. Please try again.`,
      variant: "destructive",
      duration: 5000,
    });
  }
};

// Simple back function
const back = () => {
  router.push(previousUrl.value);
};
</script>

<template>
  <json-debug :data="session" label="session" />
  <json-debug :data="settingsStore.account" label="settingsStore.account" />

  <div class="container mx-auto py-8 px-4">
    <div class="max-w-4xl mx-auto space-y-8">
      <!-- Back button -->
      <Button 
        variant="ghost" 
        size="sm"
        @click="back"
        class="flex items-center gap-2"
      >
        <ChevronLeft class="h-4 w-4" />
        Back
      </Button>

      <!-- Rest of the template remains the same -->
      <!-- Page header -->
      <div class="space-y-4">
        <h1 class="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p class="text-muted-foreground">
          Adjust your preferences. Project and team settings can be managed from the
          <router-link to="/" class="underline"> dashboard </router-link>.
        </p>
      </div>

      <!-- Navigation tabs -->
      <Tabs 
        :model-value="activeTab" 
        class="space-y-6"
        @update:model-value="handleTabChange"
      >
        <TabsList class="grid w-full grid-cols-5">
          <TabsTrigger 
            v-for="tab in tabs"
            :key="tab.value"
            :value="tab.value"
            class="flex items-center gap-2"
          >
            <component :is="tab.icon" class="h-4 w-4" />
            <span>{{ tab.label }}</span>
          </TabsTrigger>
        </TabsList>

        <!-- Router view to load the appropriate tab content -->
        <router-view
          v-slot="{ Component }"
        >
          <component
            :is="Component"
            :user="user"
            :settings-store="settingsStore"
            :session="session"
            @save-settings="saveSettings"
          />
        </router-view>
      </Tabs>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
}
</style>