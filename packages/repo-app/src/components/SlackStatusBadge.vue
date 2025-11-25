<script setup>
import { ref, onMounted, watch, computed } from "vue";
import { Hash, CheckCircle, XCircle, Loader2 } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import trpc from "@/trpc";

const props = defineProps({
  orgHandle: {
    type: String,
    required: true
  },
  showDetails: {
    type: Boolean,
    default: true
  },
  size: {
    type: String,
    default: "default",
    validator: (value) => ["small", "default", "large"].includes(value)
  }
});

// State
const isLoading = ref(true);
const status = ref(null);
const error = ref(null);

// Fetch status
const fetchStatus = async () => {
  if (!props.orgHandle) return;
  
  isLoading.value = true;
  error.value = null;
  
  try {
    const result = await trpc.slack.getInstallationStatus.query({
      orgHandle: props.orgHandle
    });
    status.value = result;
  } catch (err) {
    console.error("Failed to fetch Slack status:", err);
    error.value = err;
  } finally {
    isLoading.value = false;
  }
};

// Watch for orgHandle changes
watch(() => props.orgHandle, () => {
  fetchStatus();
});

// Initialize on mount
onMounted(() => {
  fetchStatus();
});

// Computed properties for styling
const iconSize = computed(() => {
  switch (props.size) {
    case "small": return "w-3 h-3";
    case "large": return "w-5 h-5";
    default: return "w-4 h-4";
  }
});

const badgeVariant = computed(() => {
  if (error.value) return "destructive";
  if (status.value?.isInstalled) return "default";
  return "secondary";
});
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <div class="inline-flex items-center">
          <!-- Loading state -->
          <Skeleton v-if="isLoading" class="h-6 w-24" />
          
          <!-- Error state -->
          <Badge v-else-if="error" variant="destructive" class="cursor-help">
            <XCircle :class="[iconSize, 'mr-1']" />
            <span v-if="showDetails">Error</span>
          </Badge>
          
          <!-- Connected state -->
          <Badge 
            v-else-if="status?.isInstalled" 
            :variant="badgeVariant"
            class="cursor-help"
          >
            <Hash :class="[iconSize, showDetails ? 'mr-1' : '']" />
            <span v-if="showDetails">
              Slack{{ status.teamName ? `: ${status.teamName}` : ' Connected' }}
            </span>
          </Badge>
          
          <!-- Not connected state -->
          <Badge 
            v-else 
            variant="outline" 
            class="cursor-help opacity-60"
          >
            <Hash :class="[iconSize, showDetails ? 'mr-1' : '']" />
            <span v-if="showDetails">Slack Not Connected</span>
          </Badge>
        </div>
      </TooltipTrigger>
      
      <TooltipContent>
        <div class="text-sm">
          <div v-if="isLoading">
            Loading Slack status...
          </div>
          <div v-else-if="error">
            Failed to load Slack integration status
          </div>
          <div v-else-if="status?.isInstalled">
            <div class="font-semibold">Connected to {{ status.teamName }}</div>
            <div class="text-xs text-muted-foreground">
              {{ status.channels?.length || 0 }} channel{{ status.channels?.length === 1 ? '' : 's' }} configured
            </div>
          </div>
          <div v-else>
            Slack integration not configured
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>