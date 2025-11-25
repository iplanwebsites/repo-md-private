<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAdminTable, formatDate } from '@/composables/useAdminTable';
import { toast } from '@/components/ui/toast/use-toast.ts';
import trpc from '@/trpc.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequest,
  Search, 
  RefreshCw,
  Eye,
  Calendar,
  User,
  FolderKanban,
  Building,
  Hash,
  Tag,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-vue-next';

// Initialize table composable
const {
  items: gitEvents,
  loading,
  searchQuery,
  page,
  totalItems,
  totalPages,
  stats,
  selectedItem: selectedEvent,
  showModal: showEventModal,
  fetchItems: fetchGitEvents,
  viewItem: viewEvent,
  goToPage,
  nextPage,
  prevPage
} = useAdminTable({
  fetchFn: trpc.gitEvents.list.query,
  itemName: 'event',
  itemsName: 'git events',
  searchFields: ['id', 'event', 'ref', 'commitMessage', 'projectName', 'pusherName']
});

// Additional state
const filterEvent = ref('all');

// Event type icons
const eventIcons = {
  push: GitCommit,
  pull_request: GitPullRequest,
  merge: GitMerge,
  tag: Tag,
  branch: GitBranch
};

// Filtered events
const filteredEvents = computed(() => {
  let filtered = gitEvents.value;
  
  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(event => 
      event.id?.toLowerCase().includes(query) ||
      event.event?.toLowerCase().includes(query) ||
      event.ref?.toLowerCase().includes(query) ||
      event.commitMessage?.toLowerCase().includes(query) ||
      event.projectName?.toLowerCase().includes(query) ||
      event.pusherName?.toLowerCase().includes(query)
    );
  }
  
  // Event type filter
  if (filterEvent.value !== 'all') {
    filtered = filtered.filter(event => event.event === filterEvent.value);
  }
  
  return filtered;
});

// Get event icon
function getEventIcon(event) {
  return eventIcons[event] || GitBranch;
}

// Get event badge variant
function getEventBadgeVariant(event) {
  const variants = {
    push: 'default',
    pull_request: 'secondary',
    merge: 'outline',
    tag: 'secondary',
    branch: 'outline'
  };
  return variants[event] || 'outline';
}

// Process event
async function processEvent(event) {
  if (!confirm(`Are you sure you want to reprocess this event?`)) {
    return;
  }
  
  try {
    await trpc.gitEvents.process.mutate({ eventId: event.id });
    toast({
      title: 'Success',
      description: 'Event reprocessed successfully',
    });
    fetchGitEvents();
  } catch (error) {
    toast({
      title: 'Error',
      description: 'Failed to process event',
      variant: 'destructive'
    });
  }
}

// Fetch on mount
onMounted(() => {
  fetchGitEvents();
});
</script>

<template>
  <div class="container mx-auto py-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Git Events</h1>
        <p class="text-muted-foreground">Monitor Git webhook events</p>
      </div>
      <Button @click="fetchGitEvents" :disabled="loading">
        <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': loading }" />
        Refresh
      </Button>
    </div>
    
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <GitBranch class="h-8 w-8 text-primary" />
          <div>
            <p class="text-sm text-muted-foreground">Total Events</p>
            <p class="text-2xl font-bold">{{ stats.total || 0 }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <GitCommit class="h-8 w-8 text-green-600" />
          <div>
            <p class="text-sm text-muted-foreground">Pushes</p>
            <p class="text-2xl font-bold">{{ stats.pushes || 0 }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <GitPullRequest class="h-8 w-8 text-blue-600" />
          <div>
            <p class="text-sm text-muted-foreground">Pull Requests</p>
            <p class="text-2xl font-bold">{{ stats.pullRequests || 0 }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Tag class="h-8 w-8 text-purple-600" />
          <div>
            <p class="text-sm text-muted-foreground">Tags</p>
            <p class="text-2xl font-bold">{{ stats.tags || 0 }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Calendar class="h-8 w-8 text-orange-600" />
          <div>
            <p class="text-sm text-muted-foreground">Today</p>
            <p class="text-2xl font-bold">{{ stats.today || 0 }}</p>
          </div>
        </div>
      </Card>
    </div>
    
    <!-- Filters -->
    <div class="bg-card rounded-lg p-4">
      <div class="flex flex-wrap gap-4">
        <div class="flex-1 min-w-[300px]">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              v-model="searchQuery"
              placeholder="Search by ref, commit, project, user..."
              class="pl-10"
              @input="fetchGitEvents"
            />
          </div>
        </div>
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterEvent === 'all' }"
            @click="filterEvent = 'all'; fetchGitEvents()"
          >
            All Events
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterEvent === 'push' }"
            @click="filterEvent = 'push'; fetchGitEvents()"
          >
            <GitCommit class="mr-2 h-4 w-4" />
            Push
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterEvent === 'pull_request' }"
            @click="filterEvent = 'pull_request'; fetchGitEvents()"
          >
            <GitPullRequest class="mr-2 h-4 w-4" />
            PR
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterEvent === 'tag' }"
            @click="filterEvent = 'tag'; fetchGitEvents()"
          >
            <Tag class="mr-2 h-4 w-4" />
            Tag
          </Button>
        </div>
      </div>
    </div>
    
    <!-- Events Table -->
    <div class="bg-card rounded-lg shadow">
      <Table>
        <TableCaption>
          Showing {{ filteredEvents.length }} of {{ totalItems }} events
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Commit</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Timestamp</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="event in filteredEvents" :key="event.id">
            <TableCell>
              <Badge :variant="getEventBadgeVariant(event.event)">
                <component :is="getEventIcon(event.event)" class="mr-1 h-3 w-3" />
                {{ event.event }}
              </Badge>
            </TableCell>
            <TableCell>
              <div v-if="event.projectName">
                <div class="flex items-center gap-2">
                  <FolderKanban class="h-4 w-4 text-muted-foreground" />
                  <span>{{ event.projectName }}</span>
                </div>
                <div class="text-xs text-muted-foreground">
                  <Building class="inline h-3 w-3 mr-1" />
                  {{ event.organizationName }}
                </div>
              </div>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>
              <div v-if="event.ref" class="flex items-center gap-1">
                <GitBranch class="h-4 w-4 text-muted-foreground" />
                <span class="text-sm font-mono">{{ event.ref.replace('refs/heads/', '') }}</span>
              </div>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>
              <div v-if="event.commitHash">
                <div class="flex items-center gap-1">
                  <Hash class="h-3 w-3 text-muted-foreground" />
                  <code class="text-xs">{{ event.commitHash.slice(0, 7) }}</code>
                </div>
                <div class="text-xs text-muted-foreground truncate max-w-[200px]" :title="event.commitMessage">
                  {{ event.commitMessage }}
                </div>
              </div>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>
              <div v-if="event.pusherName" class="flex items-center gap-1">
                <User class="h-4 w-4 text-muted-foreground" />
                <span class="text-sm">{{ event.pusherName }}</span>
              </div>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>{{ formatDate(event.createdAt) }}</TableCell>
            <TableCell class="text-right">
              <div class="flex items-center justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  @click="viewEvent(event)"
                >
                  <Eye class="h-4 w-4" />
                </Button>
                <Button
                  v-if="event.status === 'failed'"
                  size="icon"
                  variant="ghost"
                  @click="processEvent(event)"
                  title="Reprocess event"
                >
                  <RefreshCw class="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-if="filteredEvents.length === 0">
            <TableCell colspan="7" class="text-center py-8">
              <div v-if="loading">Loading git events...</div>
              <div v-else>No git events found</div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    
    <!-- Pagination -->
    <div class="flex items-center justify-between" v-if="totalPages > 1">
      <div class="text-sm text-muted-foreground">
        Page {{ page }} of {{ totalPages }}
      </div>
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          @click="prevPage"
          :disabled="page <= 1"
        >
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <Button
          v-for="p in Math.min(5, totalPages)"
          :key="p"
          variant="outline"
          size="sm"
          @click="goToPage(p)"
          :class="{ 'bg-accent': page === p }"
        >
          {{ p }}
        </Button>
        <Button
          variant="outline"
          size="icon"
          @click="nextPage"
          :disabled="page >= totalPages"
        >
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </div>
    
    <!-- Event Details Modal -->
    <Dialog v-model:open="showEventModal">
      <DialogContent class="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Git Event Details</DialogTitle>
          <DialogDescription>
            Complete webhook payload for {{ selectedEvent?.event }} event
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4" v-if="selectedEvent">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-sm font-medium">Event ID</label>
              <p class="text-sm font-mono">{{ selectedEvent.id }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Event Type</label>
              <Badge :variant="getEventBadgeVariant(selectedEvent.event)">
                {{ selectedEvent.event }}
              </Badge>
            </div>
            <div>
              <label class="text-sm font-medium">Repository</label>
              <p class="text-sm">{{ selectedEvent.repository }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Reference</label>
              <p class="text-sm font-mono">{{ selectedEvent.ref }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Timestamp</label>
              <p class="text-sm">{{ formatDate(selectedEvent.createdAt) }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Status</label>
              <Badge :variant="selectedEvent.status === 'processed' ? 'default' : 'destructive'">
                {{ selectedEvent.status || 'pending' }}
              </Badge>
            </div>
          </div>
          
          <div v-if="selectedEvent.payload" class="space-y-2">
            <label class="text-sm font-medium">Webhook Payload</label>
            <pre class="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">{{ JSON.stringify(selectedEvent.payload, null, 2) }}</pre>
          </div>
          
          <div v-if="selectedEvent.error" class="space-y-2">
            <label class="text-sm font-medium text-destructive">Error</label>
            <div class="bg-destructive/10 text-destructive p-3 rounded-lg">
              <AlertCircle class="inline h-4 w-4 mr-2" />
              {{ selectedEvent.error }}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showEventModal = false">Close</Button>
          <Button 
            v-if="selectedEvent?.status === 'failed'"
            @click="processEvent(selectedEvent); showEventModal = false"
          >
            <RefreshCw class="mr-2 h-4 w-4" />
            Reprocess Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>