<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAdminTable, formatDate, formatDuration } from '@/composables/useAdminTable';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Briefcase, 
  Search, 
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Loader,
  Play,
  Pause,
  RotateCcw,
  Timer,
  Calendar,
  Eye
} from 'lucide-vue-next';

// Initialize table composable
const {
  items: jobs,
  loading,
  searchQuery,
  page,
  totalItems,
  totalPages,
  stats,
  selectedItem: selectedJob,
  showModal: showJobModal,
  fetchItems: fetchJobs,
  viewItem: viewJob,
  goToPage,
  nextPage,
  prevPage,
  exportItems
} = useAdminTable({
  fetchFn: trpc.jobs.list.query,
  itemName: 'job',
  itemsName: 'jobs',
  searchFields: ['id', 'type', 'status', 'projectName', 'organizationName']
});

// Additional state
const filterStatus = ref('all');
const filterType = ref('all');

// Get unique job types
const uniqueJobTypes = computed(() => {
  const types = [...new Set(jobs.value.map(j => j.type).filter(Boolean))];
  return types.sort();
});

// Filtered jobs
const filteredJobs = computed(() => {
  let filtered = jobs.value;
  
  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(job => 
      job.id?.toLowerCase().includes(query) ||
      job.type?.toLowerCase().includes(query) ||
      job.projectName?.toLowerCase().includes(query) ||
      job.organizationName?.toLowerCase().includes(query)
    );
  }
  
  // Status filter
  if (filterStatus.value !== 'all') {
    filtered = filtered.filter(job => job.status === filterStatus.value);
  }
  
  // Type filter
  if (filterType.value !== 'all') {
    filtered = filtered.filter(job => job.type === filterType.value);
  }
  
  return filtered;
});

// Retry job
async function retryJob(job) {
  if (!confirm(`Are you sure you want to retry job ${job.id}?`)) {
    return;
  }
  
  try {
    await trpc.jobs.retry.mutate({ jobId: job.id });
    job.status = 'pending';
    toast({
      title: 'Success',
      description: 'Job queued for retry',
    });
    setTimeout(() => fetchJobs(), 2000);
  } catch (error) {
    toast({
      title: 'Error',
      description: 'Failed to retry job',
      variant: 'destructive'
    });
  }
}

// Cancel job
async function cancelJob(job) {
  if (!confirm(`Are you sure you want to cancel job ${job.id}?`)) {
    return;
  }
  
  try {
    await trpc.jobs.cancel.mutate({ jobId: job.id });
    job.status = 'cancelled';
    toast({
      title: 'Success',
      description: 'Job cancelled',
    });
  } catch (error) {
    toast({
      title: 'Error',
      description: 'Failed to cancel job',
      variant: 'destructive'
    });
  }
}

// Export jobs
function handleExport() {
  exportItems(trpc.jobs.export.query, 'jobs.csv');
}

// Get status badge variant
function getStatusBadgeVariant(status) {
  const variants = {
    completed: 'default',
    failed: 'destructive',
    running: 'secondary',
    pending: 'outline',
    cancelled: 'outline'
  };
  return variants[status] || 'outline';
}

// Get status icon
function getStatusIcon(status) {
  const icons = {
    completed: CheckCircle,
    failed: XCircle,
    running: Loader,
    pending: Clock,
    cancelled: Pause
  };
  return icons[status] || Clock;
}

// Fetch on mount and when filters change
onMounted(() => {
  fetchJobs();
});
</script>

<template>
  <div class="container mx-auto py-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Jobs</h1>
        <p class="text-muted-foreground">Background job queue management</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" @click="handleExport">
          <Download class="mr-2 h-4 w-4" />
          Export
        </Button>
        <Button @click="fetchJobs" :disabled="loading">
          <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': loading }" />
          Refresh
        </Button>
      </div>
    </div>
    
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Briefcase class="h-8 w-8 text-primary" />
          <div>
            <p class="text-sm text-muted-foreground">Total</p>
            <p class="text-2xl font-bold">{{ stats.total || 0 }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <CheckCircle class="h-8 w-8 text-green-600" />
          <div>
            <p class="text-sm text-muted-foreground">Completed</p>
            <p class="text-2xl font-bold">{{ stats.completed || 0 }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Loader class="h-8 w-8 text-blue-600" />
          <div>
            <p class="text-sm text-muted-foreground">Running</p>
            <p class="text-2xl font-bold">{{ stats.running || 0 }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Clock class="h-8 w-8 text-yellow-600" />
          <div>
            <p class="text-sm text-muted-foreground">Pending</p>
            <p class="text-2xl font-bold">{{ stats.pending || 0 }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <XCircle class="h-8 w-8 text-red-600" />
          <div>
            <p class="text-sm text-muted-foreground">Failed</p>
            <p class="text-2xl font-bold">{{ stats.failed || 0 }}</p>
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
              placeholder="Search by ID, type, project..."
              class="pl-10"
              @input="fetchJobs"
            />
          </div>
        </div>
        <Select v-model="filterType" @update:modelValue="fetchJobs">
          <SelectTrigger class="w-[180px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem v-for="type in uniqueJobTypes" :key="type" :value="type">
              {{ type }}
            </SelectItem>
          </SelectContent>
        </Select>
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterStatus === 'all' }"
            @click="filterStatus = 'all'; fetchJobs()"
          >
            All
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterStatus === 'completed' }"
            @click="filterStatus = 'completed'; fetchJobs()"
          >
            Completed
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterStatus === 'running' }"
            @click="filterStatus = 'running'; fetchJobs()"
          >
            Running
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterStatus === 'pending' }"
            @click="filterStatus = 'pending'; fetchJobs()"
          >
            Pending
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterStatus === 'failed' }"
            @click="filterStatus = 'failed'; fetchJobs()"
          >
            Failed
          </Button>
        </div>
      </div>
    </div>
    
    <!-- Jobs Table -->
    <div class="bg-card rounded-lg shadow">
      <Table>
        <TableCaption>
          Showing {{ filteredJobs.length }} of {{ totalItems }} jobs
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Job ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Completed</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="job in filteredJobs" :key="job.id">
            <TableCell class="font-mono text-sm">{{ job.id }}</TableCell>
            <TableCell>
              <Badge variant="outline">{{ job.type }}</Badge>
            </TableCell>
            <TableCell>
              <Badge :variant="getStatusBadgeVariant(job.status)">
                <component 
                  :is="getStatusIcon(job.status)" 
                  class="mr-1 h-3 w-3"
                  :class="{ 'animate-spin': job.status === 'running' }"
                />
                {{ job.status }}
              </Badge>
            </TableCell>
            <TableCell>
              <div v-if="job.projectName">
                <div class="text-sm">{{ job.projectName }}</div>
                <div class="text-xs text-muted-foreground">{{ job.organizationName }}</div>
              </div>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-1">
                <Timer class="h-4 w-4 text-muted-foreground" />
                <span>{{ formatDuration(job.duration) }}</span>
              </div>
            </TableCell>
            <TableCell>{{ formatDate(job.createdAt) }}</TableCell>
            <TableCell>{{ formatDate(job.completedAt) }}</TableCell>
            <TableCell class="text-right">
              <div class="flex items-center justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  @click="viewJob(job)"
                >
                  <Eye class="h-4 w-4" />
                </Button>
                <Button
                  v-if="job.status === 'failed'"
                  size="icon"
                  variant="ghost"
                  @click="retryJob(job)"
                >
                  <RotateCcw class="h-4 w-4" />
                </Button>
                <Button
                  v-if="job.status === 'running' || job.status === 'pending'"
                  size="icon"
                  variant="ghost"
                  @click="cancelJob(job)"
                  class="text-destructive hover:text-destructive"
                >
                  <Pause class="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-if="filteredJobs.length === 0">
            <TableCell colspan="8" class="text-center py-8">
              <div v-if="loading">Loading jobs...</div>
              <div v-else>No jobs found</div>
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
    
    <!-- Job Details Modal -->
    <Dialog v-model:open="showJobModal">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Job Details</DialogTitle>
          <DialogDescription>
            Complete information for job {{ selectedJob?.id }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4" v-if="selectedJob">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-sm font-medium">Job ID</label>
              <p class="text-sm font-mono">{{ selectedJob.id }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Type</label>
              <p class="text-sm">{{ selectedJob.type }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Status</label>
              <Badge :variant="getStatusBadgeVariant(selectedJob.status)">
                {{ selectedJob.status }}
              </Badge>
            </div>
            <div>
              <label class="text-sm font-medium">Priority</label>
              <p class="text-sm">{{ selectedJob.priority || 'normal' }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Created</label>
              <p class="text-sm">{{ formatDate(selectedJob.createdAt) }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Started</label>
              <p class="text-sm">{{ formatDate(selectedJob.startedAt) }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Completed</label>
              <p class="text-sm">{{ formatDate(selectedJob.completedAt) }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Duration</label>
              <p class="text-sm">{{ formatDuration(selectedJob.duration) }}</p>
            </div>
          </div>
          
          <div v-if="selectedJob.error" class="space-y-2">
            <label class="text-sm font-medium text-destructive">Error</label>
            <pre class="text-xs bg-destructive/10 text-destructive p-3 rounded-lg overflow-x-auto">{{ selectedJob.error }}</pre>
          </div>
          
          <div v-if="selectedJob.payload" class="space-y-2">
            <label class="text-sm font-medium">Payload</label>
            <pre class="text-xs bg-muted p-3 rounded-lg overflow-x-auto">{{ JSON.stringify(selectedJob.payload, null, 2) }}</pre>
          </div>
          
          <div v-if="selectedJob.result" class="space-y-2">
            <label class="text-sm font-medium">Result</label>
            <pre class="text-xs bg-muted p-3 rounded-lg overflow-x-auto">{{ JSON.stringify(selectedJob.result, null, 2) }}</pre>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showJobModal = false">Close</Button>
          <Button 
            v-if="selectedJob?.status === 'failed'"
            @click="retryJob(selectedJob); showJobModal = false"
          >
            <RotateCcw class="mr-2 h-4 w-4" />
            Retry Job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>