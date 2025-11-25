<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useToast } from "@/components/ui/toast/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Filter,
  RefreshCw,
  Eye,
  RotateCw,
  Github,
  GitBranch,
  User,
  Calendar,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
} from "lucide-vue-next";
import trpc from "@/trpc";

const props = defineProps({
  scope: {
    type: String,
    required: true,
    validator: (value) => ["project", "organization"].includes(value),
  },
  projectId: {
    type: String,
    default: null,
  },
  orgId: {
    type: String,
    default: null,
  },
  showRepository: {
    type: Boolean,
    default: false,
  },
});

const { toast } = useToast();

// State
const loading = ref(false);
const error = ref(null);
const events = ref([]);
const searchQuery = ref("");
const statusFilter = ref("all");
const eventTypeFilter = ref("all");
const repositoryFilter = ref("all");
const showEventDetails = ref(false);
const selectedEvent = ref(null);
const currentPage = ref(1);
const pageSize = ref(50);

// Available filters
const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
  { value: "pending", label: "Pending" },
];

const eventTypeOptions = [
  { value: "all", label: "All Events" },
  { value: "push", label: "Push" },
];

// Computed
const repositories = computed(() => {
  const repos = new Set();
  events.value.forEach((event) => {
    if (event.repository?.fullName) {
      repos.add(event.repository.fullName);
    }
  });
  return Array.from(repos).sort();
});

const repositoryOptions = computed(() => [
  { value: "all", label: "All Repositories" },
  ...repositories.value.map((repo) => ({ value: repo, label: repo })),
]);

const filteredEvents = computed(() => {
  let filtered = [...events.value];

  // Search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter((event) =>
      event.repository?.fullName?.toLowerCase().includes(query) ||
      event.processingResult?.commit?.toLowerCase().includes(query) ||
      event.processingResult?.branch?.toLowerCase().includes(query)
    );
  }

  // Status filter
  if (statusFilter.value !== "all") {
    filtered = filtered.filter((event) => {
      const status = getEventStatus(event);
      return status === statusFilter.value;
    });
  }

  // Event type filter
  if (eventTypeFilter.value !== "all") {
    filtered = filtered.filter((event) => event.event === eventTypeFilter.value);
  }

  // Repository filter
  if (repositoryFilter.value !== "all") {
    filtered = filtered.filter(
      (event) => event.repository?.fullName === repositoryFilter.value
    );
  }

  // Sort by timestamp (newest first)
  return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
});

// Methods
const getEventStatus = (event) => {
  if (event.failed) return "failed";
  if (event.processed && event.processingResult?.success) return "success";
  if (event.processed && !event.processingResult?.success) return "failed";
  if (event.ignored) return "ignored";
  return "pending";
};

const getStatusBadge = (status) => {
  switch (status) {
    case "success":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "pending":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case "ignored":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    default:
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case "success":
      return CheckCircle;
    case "failed":
      return AlertCircle;
    case "pending":
      return Clock;
    case "ignored":
      return X;
    default:
      return Clock;
  }
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now - date;
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMins / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMins < 1) return "just now";
  if (diffInMins < 60) return `${diffInMins}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString();
};

const truncateCommit = (commit) => {
  return commit ? commit.substring(0, 7) : "";
};

const fetchEvents = async () => {
  if (!props.projectId && !props.orgId) {
    console.warn("WebhookEventsTable: No projectId or orgId provided");
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    let result;
    if (props.scope === "project") {
      result = await trpc.webhooks.listProjectEvents.query({
        projectId: props.projectId,
        limit: pageSize.value,
        offset: (currentPage.value - 1) * pageSize.value,
      });
    } else {
      result = await trpc.webhooks.listAllEvents.query({
        limit: pageSize.value,
        offset: (currentPage.value - 1) * pageSize.value,
      });
    }

    events.value = result.events || [];
  } catch (err) {
    console.error("Error fetching webhook events:", err);
    error.value = err.message || "Failed to load webhook events";
    toast({
      title: "Error",
      description: "Failed to load webhook events",
      variant: "destructive",
    });
  } finally {
    loading.value = false;
  }
};

const viewEventDetails = async (event) => {
  try {
    const details = await trpc.webhooks.getEvent.query({ eventId: event._id });
    selectedEvent.value = details;
    showEventDetails.value = true;
  } catch (err) {
    console.error("Error fetching event details:", err);
    toast({
      title: "Error",
      description: "Failed to load event details",
      variant: "destructive",
    });
  }
};

const retryEvent = async (event) => {
  if (!event.failed) return;
  
  try {
    await trpc.webhooks.retryEvent.mutate({ eventId: event._id });
    toast({
      title: "Success",
      description: "Event retry initiated",
    });
    // Refresh the events list
    await fetchEvents();
  } catch (err) {
    console.error("Error retrying event:", err);
    toast({
      title: "Error",
      description: "Failed to retry event",
      variant: "destructive",
    });
  }
};

const refreshEvents = () => {
  fetchEvents();
};

const openDeployment = (event) => {
  if (event.processingResult?.jobId) {
    // Navigate to deployment details page
    window.open(`/deployments/${event.processingResult.jobId}`, "_blank");
  }
};

// Watch for prop changes
watch([() => props.projectId, () => props.orgId], fetchEvents, {
  immediate: true,
});

// Lifecycle
onMounted(() => {
  fetchEvents();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 class="text-2xl font-bold">Webhook Events</h2>
        <p class="text-muted-foreground">
          {{ scope === "project" ? "Project webhook events and deployments" : "Organization-wide webhook events" }}
        </p>
      </div>
      <Button @click="refreshEvents" :disabled="loading" variant="outline">
        <RefreshCw class="w-4 h-4 mr-2" :class="{ 'animate-spin': loading }" />
        Refresh
      </Button>
    </div>

    <!-- Filters -->
    <div class="flex flex-col md:flex-row gap-4">
      <!-- Search -->
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          v-model="searchQuery"
          placeholder="Search by repository, commit, or branch..."
          class="pl-10"
        />
      </div>

      <!-- Filters -->
      <div class="flex gap-2">
        <Select v-model="statusFilter">
          <SelectTrigger class="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="option in statusOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select v-model="eventTypeFilter">
          <SelectTrigger class="w-[130px]">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="option in eventTypeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select v-if="showRepository" v-model="repositoryFilter">
          <SelectTrigger class="w-[200px]">
            <SelectValue placeholder="Repository" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="option in repositoryOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <!-- Loading State -->
    <Card v-if="loading && events.length === 0">
      <CardContent class="flex items-center justify-center py-8">
        <RefreshCw class="w-6 h-6 animate-spin mr-2" />
        <span>Loading webhook events...</span>
      </CardContent>
    </Card>

    <!-- Error State -->
    <Card v-else-if="error">
      <CardContent class="flex items-center justify-center py-8">
        <AlertCircle class="w-6 h-6 text-destructive mr-2" />
        <span>{{ error }}</span>
        <Button @click="refreshEvents" variant="outline" class="ml-4">
          Try Again
        </Button>
      </CardContent>
    </Card>

    <!-- Empty State -->
    <Card v-else-if="filteredEvents.length === 0">
      <CardContent class="flex flex-col items-center justify-center py-12">
        <Github class="w-12 h-12 text-muted-foreground mb-4" />
        <h3 class="text-lg font-medium mb-2">No webhook events found</h3>
        <p class="text-muted-foreground text-center mb-4">
          {{ searchQuery || statusFilter !== "all" || eventTypeFilter !== "all" || repositoryFilter !== "all"
            ? "No events match your current filters."
            : "No webhook events have been received yet." }}
        </p>
        <Button
          v-if="searchQuery || statusFilter !== 'all' || eventTypeFilter !== 'all' || repositoryFilter !== 'all'"
          @click="searchQuery = ''; statusFilter = 'all'; eventTypeFilter = 'all'; repositoryFilter = 'all'"
          variant="outline"
        >
          Clear Filters
        </Button>
      </CardContent>
    </Card>

    <!-- Events Table -->
    <Card v-else>
      <CardHeader>
        <CardTitle class="flex items-center justify-between">
          <span>{{ filteredEvents.length }} events</span>
          <div class="text-sm text-muted-foreground font-normal">
            {{ events.length }} total events
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead v-if="showRepository">Repository</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Commit</TableHead>
              <TableHead>Triggered By</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="event in filteredEvents" :key="event._id">
              <!-- Time -->
              <TableCell>
                <div class="flex items-center text-sm">
                  <Calendar class="w-4 h-4 mr-2 text-muted-foreground" />
                  {{ formatDate(event.timestamp) }}
                </div>
              </TableCell>

              <!-- Repository (if shown) -->
              <TableCell v-if="showRepository">
                <div class="flex items-center text-sm">
                  <Github class="w-4 h-4 mr-2 text-muted-foreground" />
                  {{ event.repository?.fullName || "Unknown" }}
                </div>
              </TableCell>

              <!-- Branch -->
              <TableCell>
                <div class="flex items-center text-sm">
                  <GitBranch class="w-4 h-4 mr-2 text-muted-foreground" />
                  {{ event.processingResult?.branch || "Unknown" }}
                </div>
              </TableCell>

              <!-- Commit -->
              <TableCell>
                <div class="font-mono text-sm">
                  {{ truncateCommit(event.processingResult?.commit) || "Unknown" }}
                </div>
              </TableCell>

              <!-- Triggered By -->
              <TableCell>
                <div class="flex items-center text-sm">
                  <User class="w-4 h-4 mr-2 text-muted-foreground" />
                  {{ event.repository?.owner || "Unknown" }}
                </div>
              </TableCell>

              <!-- Status -->
              <TableCell>
                <Badge :class="getStatusBadge(getEventStatus(event))" class="flex items-center w-fit">
                  <component :is="getStatusIcon(getEventStatus(event))" class="w-3 h-3 mr-1" />
                  {{ getEventStatus(event).charAt(0).toUpperCase() + getEventStatus(event).slice(1) }}
                </Badge>
              </TableCell>

              <!-- Actions -->
              <TableCell>
                <div class="flex items-center gap-2">
                  <Button @click="viewEventDetails(event)" variant="ghost" size="sm">
                    <Eye class="w-4 h-4" />
                  </Button>
                  <Button
                    v-if="event.processingResult?.jobId"
                    @click="openDeployment(event)"
                    variant="ghost"
                    size="sm"
                    title="View Deployment"
                  >
                    <ExternalLink class="w-4 h-4" />
                  </Button>
                  <Button
                    v-if="getEventStatus(event) === 'failed'"
                    @click="retryEvent(event)"
                    variant="ghost"
                    size="sm"
                    title="Retry Event"
                  >
                    <RotateCw class="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <!-- Event Details Modal -->
    <Dialog :open="showEventDetails" @update:open="showEventDetails = $event">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Webhook Event Details</DialogTitle>
          <DialogDescription>
            Detailed information about the webhook event and processing result
          </DialogDescription>
        </DialogHeader>

        <div v-if="selectedEvent" class="space-y-4">
          <!-- Event Info -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <h4 class="font-medium mb-2">Event Information</h4>
              <div class="space-y-2 text-sm">
                <div><strong>ID:</strong> {{ selectedEvent._id }}</div>
                <div><strong>Event:</strong> {{ selectedEvent.event }}</div>
                <div><strong>Delivery:</strong> {{ selectedEvent.delivery }}</div>
                <div><strong>Timestamp:</strong> {{ new Date(selectedEvent.timestamp).toLocaleString() }}</div>
              </div>
            </div>

            <div>
              <h4 class="font-medium mb-2">Repository</h4>
              <div class="space-y-2 text-sm">
                <div><strong>Name:</strong> {{ selectedEvent.repository?.fullName }}</div>
                <div><strong>Owner:</strong> {{ selectedEvent.repository?.owner }}</div>
                <div><strong>Private:</strong> {{ selectedEvent.repository?.private ? "Yes" : "No" }}</div>
              </div>
            </div>
          </div>

          <!-- Processing Result -->
          <div v-if="selectedEvent.processingResult">
            <h4 class="font-medium mb-2">Processing Result</h4>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Success:</strong> {{ selectedEvent.processingResult.success ? "Yes" : "No" }}</div>
              <div><strong>Job ID:</strong> {{ selectedEvent.processingResult.jobId }}</div>
              <div><strong>Project ID:</strong> {{ selectedEvent.processingResult.projectId }}</div>
              <div><strong>Branch:</strong> {{ selectedEvent.processingResult.branch }}</div>
              <div class="col-span-2"><strong>Commit:</strong> <code class="font-mono">{{ selectedEvent.processingResult.commit }}</code></div>
            </div>
          </div>

          <!-- Error Details -->
          <div v-if="selectedEvent.error">
            <h4 class="font-medium mb-2 text-destructive">Error Details</h4>
            <div class="bg-destructive/10 border border-destructive/20 rounded p-3">
              <pre class="text-sm text-destructive whitespace-pre-wrap">{{ selectedEvent.error }}</pre>
            </div>
          </div>

          <!-- Ignored Reason -->
          <div v-if="selectedEvent.ignored && selectedEvent.ignoredReason">
            <h4 class="font-medium mb-2">Ignored Reason</h4>
            <div class="bg-muted border rounded p-3">
              <p class="text-sm">{{ selectedEvent.ignoredReason }}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showEventDetails = false">
            Close
          </Button>
          <Button
            v-if="selectedEvent && getEventStatus(selectedEvent) === 'failed'"
            @click="retryEvent(selectedEvent); showEventDetails = false"
          >
            <RotateCw class="w-4 h-4 mr-2" />
            Retry Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>