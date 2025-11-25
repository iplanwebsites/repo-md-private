<script setup>
import { ref, computed, onMounted } from 'vue';
import trpc from '@/trpc.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/toast/use-toast.ts';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Rocket, 
  Search, 
  Filter, 
  GitBranch,
  Clock,
  Calendar,
  Globe,
  MoreHorizontal,
  Eye,
  RotateCcw,
  Trash2,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader,
  Building,
  FolderKanban,
  ExternalLink,
  FileText,
  Timer,
  Hash
} from 'lucide-vue-next';

const deployments = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const filterStatus = ref('all'); // 'all', 'success', 'failed', 'building', 'pending'
const filterProject = ref('all');
const filterOrg = ref('all');
const showDeploymentModal = ref(false);
const selectedDeployment = ref(null);

// Pagination
const page = ref(1);
const limit = ref(25);
const totalItems = ref(0);
const totalPages = computed(() => Math.ceil(totalItems.value / limit.value));

// Stats
const stats = ref({
  total: 0,
  success: 0,
  failed: 0,
  building: 0,
  avgBuildTime: 0,
  todayCount: 0
});

// Get unique projects and organizations
const uniqueProjects = computed(() => {
  const projects = [...new Set(deployments.value.map(d => d.projectName).filter(Boolean))];
  return projects.sort();
});

const uniqueOrgs = computed(() => {
  const orgs = [...new Set(deployments.value.map(d => d.organizationName).filter(Boolean))];
  return orgs.sort();
});

// Filtered deployments
const filteredDeployments = computed(() => {
  let filtered = deployments.value;
  
  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(deployment => 
      deployment.id?.toLowerCase().includes(query) ||
      deployment.projectName?.toLowerCase().includes(query) ||
      deployment.organizationName?.toLowerCase().includes(query) ||
      deployment.commitMessage?.toLowerCase().includes(query) ||
      deployment.commitHash?.toLowerCase().includes(query)
    );
  }
  
  // Status filter
  if (filterStatus.value !== 'all') {
    filtered = filtered.filter(deployment => deployment.status === filterStatus.value);
  }
  
  // Project filter
  if (filterProject.value !== 'all') {
    filtered = filtered.filter(deployment => deployment.projectName === filterProject.value);
  }
  
  // Organization filter
  if (filterOrg.value !== 'all') {
    filtered = filtered.filter(deployment => deployment.organizationName === filterOrg.value);
  }
  
  return filtered;
});

// Fetch deployments
async function fetchDeployments() {
  loading.value = true;
  
  try {
    const data = await trpc.deployments.list.query({
      page: page.value,
      limit: limit.value,
      search: searchQuery.value,
      status: filterStatus.value,
      projectName: filterProject.value === 'all' ? undefined : filterProject.value,
      organizationName: filterOrg.value === 'all' ? undefined : filterOrg.value
    });
    
    deployments.value = data.items || [];
    totalItems.value = data.total || 0;
    
    // Update stats
    if (data.stats) {
      stats.value = data.stats;
    }
  } catch (error) {
    console.error('Error fetching deployments:', error);
    toast({
      title: 'Error',
      description: 'Failed to load deployments',
      variant: 'destructive'
    });
  } finally {
    loading.value = false;
  }
}

// View deployment details
function viewDeployment(deployment) {
  selectedDeployment.value = deployment;
  showDeploymentModal.value = true;
}

// Rebuild deployment
async function rebuildDeployment(deployment) {
  if (!confirm(`Are you sure you want to rebuild deployment ${deployment.id}?`)) {
    return;
  }
  
  try {
    await trpc.deployments.rebuild.mutate({
      deploymentId: deployment.id
    });
    
    // Update local state
    deployment.status = 'building';
    
    toast({
      title: 'Success',
      description: 'Deployment rebuild initiated',
    });
    
    // Refresh after a delay to get updated status
    setTimeout(() => fetchDeployments(), 3000);
  } catch (error) {
    console.error('Error rebuilding deployment:', error);
    toast({
      title: 'Error',
      description: 'Failed to rebuild deployment',
      variant: 'destructive'
    });
  }
}

// Delete deployment
async function deleteDeployment(deployment) {
  if (!confirm(`Are you sure you want to delete deployment ${deployment.id}? This action cannot be undone.`)) {
    return;
  }
  
  try {
    await trpc.deployments.delete.mutate({
      deploymentId: deployment.id
    });
    
    // Remove from local state
    deployments.value = deployments.value.filter(d => d.id !== deployment.id);
    totalItems.value--;
    
    toast({
      title: 'Success',
      description: 'Deployment deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting deployment:', error);
    toast({
      title: 'Error',
      description: 'Failed to delete deployment',
      variant: 'destructive'
    });
  }
}

// Format date
function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Format duration
function formatDuration(seconds) {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// Get status badge variant
function getStatusBadgeVariant(status) {
  switch (status) {
    case 'success': return 'default';
    case 'failed': return 'destructive';
    case 'building': return 'secondary';
    case 'pending': return 'outline';
    default: return 'outline';
  }
}

// Get status icon
function getStatusIcon(status) {
  switch (status) {
    case 'success': return CheckCircle;
    case 'failed': return XCircle;
    case 'building': return Loader;
    case 'pending': return Clock;
    default: return AlertCircle;
  }
}

// Export deployments
async function exportDeployments() {
  try {
    const data = await trpc.deployments.export.query({
      format: 'csv'
    });
    
    // Create blob and download
    const blob = new Blob([data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({
      title: 'Success',
      description: 'Deployments exported successfully',
    });
  } catch (error) {
    console.error('Error exporting deployments:', error);
    toast({
      title: 'Error',
      description: 'Failed to export deployments',
      variant: 'destructive'
    });
  }
}

// Open deployment
function openDeployment(deployment) {
  const url = `/${deployment.organizationId}/${deployment.projectId}/${deployment.id}`;
  window.open(url, '_blank');
}

// Open deployment site
function openDeploymentSite(deployment) {
  if (deployment.url) {
    window.open(deployment.url, '_blank');
  }
}

onMounted(() => {
  fetchDeployments();
});
</script>

<template>
  <div class="container mx-auto py-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Deployments</h1>
        <p class="text-muted-foreground">Manage all deployments across projects</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" @click="exportDeployments">
          <Download class="mr-2 h-4 w-4" />
          Export
        </Button>
        <Button @click="fetchDeployments" :disabled="loading">
          <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': loading }" />
          Refresh
        </Button>
      </div>
    </div>
    
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-6 gap-4">
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Rocket class="h-8 w-8 text-primary" />
          <div>
            <p class="text-sm text-muted-foreground">Total</p>
            <p class="text-2xl font-bold">{{ stats.total }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <CheckCircle class="h-8 w-8 text-green-600" />
          <div>
            <p class="text-sm text-muted-foreground">Success</p>
            <p class="text-2xl font-bold">{{ stats.success }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <XCircle class="h-8 w-8 text-red-600" />
          <div>
            <p class="text-sm text-muted-foreground">Failed</p>
            <p class="text-2xl font-bold">{{ stats.failed }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Loader class="h-8 w-8 text-blue-600" />
          <div>
            <p class="text-sm text-muted-foreground">Building</p>
            <p class="text-2xl font-bold">{{ stats.building }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Timer class="h-8 w-8 text-purple-600" />
          <div>
            <p class="text-sm text-muted-foreground">Avg Time</p>
            <p class="text-2xl font-bold">{{ formatDuration(stats.avgBuildTime) }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Calendar class="h-8 w-8 text-orange-600" />
          <div>
            <p class="text-sm text-muted-foreground">Today</p>
            <p class="text-2xl font-bold">{{ stats.todayCount }}</p>
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
              placeholder="Search by ID, project, commit..."
              class="pl-10"
              @input="fetchDeployments"
            />
          </div>
        </div>
        <Select v-model="filterOrg" @update:modelValue="fetchDeployments">
          <SelectTrigger class="w-[200px]">
            <Building class="mr-2 h-4 w-4" />
            <SelectValue placeholder="All organizations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All organizations</SelectItem>
            <SelectItem v-for="org in uniqueOrgs" :key="org" :value="org">
              {{ org }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="filterProject" @update:modelValue="fetchDeployments">
          <SelectTrigger class="w-[200px]">
            <FolderKanban class="mr-2 h-4 w-4" />
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            <SelectItem v-for="project in uniqueProjects" :key="project" :value="project">
              {{ project }}
            </SelectItem>
          </SelectContent>
        </Select>
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterStatus === 'all' }"
            @click="filterStatus = 'all'; fetchDeployments()"
          >
            All
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterStatus === 'success' }"
            @click="filterStatus = 'success'; fetchDeployments()"
          >
            <CheckCircle class="mr-2 h-4 w-4" />
            Success
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterStatus === 'failed' }"
            @click="filterStatus = 'failed'; fetchDeployments()"
          >
            <XCircle class="mr-2 h-4 w-4" />
            Failed
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterStatus === 'building' }"
            @click="filterStatus = 'building'; fetchDeployments()"
          >
            <Loader class="mr-2 h-4 w-4" />
            Building
          </Button>
        </div>
      </div>
    </div>
    
    <!-- Deployments Table -->
    <div class="bg-card rounded-lg shadow">
      <Table>
        <TableCaption>
          Showing {{ (page - 1) * limit + 1 }} - {{ Math.min(page * limit, totalItems) }} of {{ totalItems }} deployments
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Deployment</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Commit</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Created</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="deployment in deployments" :key="deployment.id">
            <TableCell>
              <div>
                <div class="font-medium font-mono text-sm">{{ deployment.id }}</div>
                <div class="text-sm text-muted-foreground">{{ deployment.organizationName }}</div>
              </div>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <FolderKanban class="h-4 w-4 text-muted-foreground" />
                <span>{{ deployment.projectName }}</span>
              </div>
            </TableCell>
            <TableCell>
              <Badge :variant="getStatusBadgeVariant(deployment.status)">
                <component 
                  :is="getStatusIcon(deployment.status)" 
                  class="mr-1 h-3 w-3"
                  :class="{ 'animate-spin': deployment.status === 'building' }"
                />
                {{ deployment.status }}
              </Badge>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-1" v-if="deployment.branch">
                <GitBranch class="h-4 w-4 text-muted-foreground" />
                <span class="text-sm">{{ deployment.branch }}</span>
              </div>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>
              <div v-if="deployment.commitHash">
                <div class="flex items-center gap-1">
                  <Hash class="h-3 w-3 text-muted-foreground" />
                  <code class="text-xs">{{ deployment.commitHash.slice(0, 7) }}</code>
                </div>
                <div class="text-xs text-muted-foreground truncate max-w-[200px]" :title="deployment.commitMessage">
                  {{ deployment.commitMessage }}
                </div>
              </div>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-1">
                <Timer class="h-4 w-4 text-muted-foreground" />
                <span>{{ formatDuration(deployment.buildDuration) }}</span>
              </div>
            </TableCell>
            <TableCell>{{ formatDate(deployment.createdAt) }}</TableCell>
            <TableCell class="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal class="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem @click="viewDeployment(deployment)">
                    <Eye class="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="openDeployment(deployment)">
                    <ExternalLink class="mr-2 h-4 w-4" />
                    Open Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    v-if="deployment.url"
                    @click="openDeploymentSite(deployment)"
                  >
                    <Globe class="mr-2 h-4 w-4" />
                    View Site
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    @click="openDeployment(deployment) + '/logs'"
                  >
                    <FileText class="mr-2 h-4 w-4" />
                    View Logs
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    @click="rebuildDeployment(deployment)"
                    :disabled="deployment.status === 'building'"
                  >
                    <RotateCcw class="mr-2 h-4 w-4" />
                    Rebuild
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    @click="deleteDeployment(deployment)"
                    class="text-destructive"
                  >
                    <Trash2 class="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
          <TableRow v-if="deployments.length === 0">
            <TableCell colspan="8" class="text-center py-8">
              <div v-if="loading">Loading deployments...</div>
              <div v-else>No deployments found</div>
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
          @click="page--; fetchDeployments()"
          :disabled="page <= 1"
        >
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <Button
          v-for="p in Math.min(5, totalPages)"
          :key="p"
          variant="outline"
          size="sm"
          @click="page = p; fetchDeployments()"
          :class="{ 'bg-accent': page === p }"
        >
          {{ p }}
        </Button>
        <Button
          variant="outline"
          size="icon"
          @click="page++; fetchDeployments()"
          :disabled="page >= totalPages"
        >
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </div>
    
    <!-- Deployment Details Modal -->
    <Dialog v-model:open="showDeploymentModal">
      <DialogContent class="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Deployment Details</DialogTitle>
          <DialogDescription>
            Complete information for deployment {{ selectedDeployment?.id }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4" v-if="selectedDeployment">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <Badge :variant="getStatusBadgeVariant(selectedDeployment.status)">
                <component 
                  :is="getStatusIcon(selectedDeployment.status)" 
                  class="mr-1 h-3 w-3"
                  :class="{ 'animate-spin': selectedDeployment.status === 'building' }"
                />
                {{ selectedDeployment.status }}
              </Badge>
              <Badge v-if="selectedDeployment.branch" variant="outline">
                <GitBranch class="mr-1 h-3 w-3" />
                {{ selectedDeployment.branch }}
              </Badge>
            </div>
            <p class="text-sm text-muted-foreground font-mono">{{ selectedDeployment.id }}</p>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-sm font-medium">Organization</label>
              <p class="text-sm">{{ selectedDeployment.organizationName }}</p>
              <p class="text-sm text-muted-foreground font-mono">{{ selectedDeployment.organizationId }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Project</label>
              <p class="text-sm">{{ selectedDeployment.projectName }}</p>
              <p class="text-sm text-muted-foreground font-mono">{{ selectedDeployment.projectId }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Created</label>
              <p class="text-sm text-muted-foreground">{{ formatDate(selectedDeployment.createdAt) }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Build Duration</label>
              <p class="text-sm text-muted-foreground">{{ formatDuration(selectedDeployment.buildDuration) }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Deployment URL</label>
              <a 
                v-if="selectedDeployment.url"
                :href="selectedDeployment.url" 
                target="_blank"
                class="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {{ selectedDeployment.url }}
                <ExternalLink class="h-3 w-3" />
              </a>
              <span v-else class="text-sm text-muted-foreground">—</span>
            </div>
            <div>
              <label class="text-sm font-medium">Environment</label>
              <p class="text-sm text-muted-foreground">{{ selectedDeployment.environment || 'production' }}</p>
            </div>
          </div>
          
          <div v-if="selectedDeployment.commitHash" class="space-y-2">
            <label class="text-sm font-medium">Git Information</label>
            <div class="bg-muted p-3 rounded-lg space-y-2">
              <div class="flex items-center gap-2">
                <Hash class="h-4 w-4 text-muted-foreground" />
                <code class="text-sm">{{ selectedDeployment.commitHash }}</code>
              </div>
              <div v-if="selectedDeployment.commitMessage" class="text-sm text-muted-foreground">
                {{ selectedDeployment.commitMessage }}
              </div>
              <div v-if="selectedDeployment.commitAuthor" class="text-sm text-muted-foreground">
                by {{ selectedDeployment.commitAuthor }}
              </div>
            </div>
          </div>
          
          <div v-if="selectedDeployment.buildLog" class="space-y-2">
            <label class="text-sm font-medium">Build Log Preview</label>
            <pre class="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-[200px] overflow-y-auto">{{ selectedDeployment.buildLog }}</pre>
          </div>
          
          <div v-if="selectedDeployment.metadata" class="space-y-2">
            <label class="text-sm font-medium">Metadata</label>
            <pre class="text-xs bg-muted p-3 rounded-lg overflow-x-auto">{{ JSON.stringify(selectedDeployment.metadata, null, 2) }}</pre>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showDeploymentModal = false">Close</Button>
          <Button @click="openDeployment(selectedDeployment)" v-if="selectedDeployment">
            <ExternalLink class="mr-2 h-4 w-4" />
            Open Dashboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>