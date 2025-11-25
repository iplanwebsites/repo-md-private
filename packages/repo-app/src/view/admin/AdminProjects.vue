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
  FolderKanban, 
  Search, 
  Filter, 
  GitBranch,
  Rocket,
  Calendar,
  Globe,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Activity,
  AlertCircle,
  CheckCircle,
  Building,
  ExternalLink,
  FileText,
  Image as ImageIcon
} from 'lucide-vue-next';

const projects = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const filterStatus = ref('all'); // 'all', 'active', 'paused', 'archived'
const filterOrg = ref('all');
const showProjectModal = ref(false);
const selectedProject = ref(null);

// Pagination
const page = ref(1);
const limit = ref(25);
const totalItems = ref(0);
const totalPages = computed(() => Math.ceil(totalItems.value / limit.value));

// Stats
const stats = ref({
  total: 0,
  active: 0,
  paused: 0,
  archived: 0,
  totalDeployments: 0,
  totalPosts: 0,
  totalMedia: 0
});

// Get unique organizations
const uniqueOrgs = computed(() => {
  const orgs = [...new Set(projects.value.map(p => p.organizationName).filter(Boolean))];
  return orgs.sort();
});

// Filtered projects
const filteredProjects = computed(() => {
  let filtered = projects.value;
  
  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(project => 
      project.name?.toLowerCase().includes(query) ||
      project.id?.toLowerCase().includes(query) ||
      project.organizationName?.toLowerCase().includes(query) ||
      project.domain?.toLowerCase().includes(query)
    );
  }
  
  // Status filter
  if (filterStatus.value !== 'all') {
    filtered = filtered.filter(project => project.status === filterStatus.value);
  }
  
  // Organization filter
  if (filterOrg.value !== 'all') {
    filtered = filtered.filter(project => project.organizationName === filterOrg.value);
  }
  
  return filtered;
});

// Fetch projects
async function fetchProjects() {
  loading.value = true;
  
  try {
    const data = await trpc.projects.list.query({
      page: page.value,
      limit: limit.value,
      search: searchQuery.value,
      status: filterStatus.value,
      organizationName: filterOrg.value === 'all' ? undefined : filterOrg.value
    });
    
    projects.value = data.items || [];
    totalItems.value = data.total || 0;
    
    // Update stats
    if (data.stats) {
      stats.value = data.stats;
    }
  } catch (error) {
    console.error('Error fetching projects:', error);
    toast({
      title: 'Error',
      description: 'Failed to load projects',
      variant: 'destructive'
    });
  } finally {
    loading.value = false;
  }
}

// View project details
function viewProject(project) {
  selectedProject.value = project;
  showProjectModal.value = true;
}

// Toggle project status
async function toggleProjectStatus(project) {
  const newStatus = project.status === 'active' ? 'paused' : 'active';
  
  if (!confirm(`Are you sure you want to ${newStatus === 'paused' ? 'pause' : 'activate'} ${project.name}?`)) {
    return;
  }
  
  try {
    await trpc.projects.updateStatus.mutate({
      projectId: project.id,
      status: newStatus
    });
    
    // Update local state
    project.status = newStatus;
    
    toast({
      title: 'Success',
      description: `Project ${newStatus === 'paused' ? 'paused' : 'activated'} successfully`,
    });
  } catch (error) {
    console.error('Error updating project status:', error);
    toast({
      title: 'Error',
      description: 'Failed to update project status',
      variant: 'destructive'
    });
  }
}

// Archive project
async function archiveProject(project) {
  if (!confirm(`Are you sure you want to archive ${project.name}? This will hide it from the organization's project list.`)) {
    return;
  }
  
  try {
    await trpc.projects.archive.mutate({
      projectId: project.id
    });
    
    // Update local state
    project.status = 'archived';
    
    toast({
      title: 'Success',
      description: 'Project archived successfully',
    });
  } catch (error) {
    console.error('Error archiving project:', error);
    toast({
      title: 'Error',
      description: 'Failed to archive project',
      variant: 'destructive'
    });
  }
}

// Delete project
async function deleteProject(project) {
  if (!confirm(`Are you sure you want to permanently delete ${project.name}? This will delete all deployments, content, and data. This action cannot be undone.`)) {
    return;
  }
  
  try {
    await trpc.projects.delete.mutate({
      projectId: project.id
    });
    
    // Remove from local state
    projects.value = projects.value.filter(p => p.id !== project.id);
    totalItems.value--;
    
    toast({
      title: 'Success',
      description: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    toast({
      title: 'Error',
      description: 'Failed to delete project',
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
    day: 'numeric'
  });
}

// Get status badge variant
function getStatusBadgeVariant(status) {
  switch (status) {
    case 'active': return 'default';
    case 'paused': return 'secondary';
    case 'archived': return 'outline';
    default: return 'outline';
  }
}

// Get status icon
function getStatusIcon(status) {
  switch (status) {
    case 'active': return CheckCircle;
    case 'paused': return AlertCircle;
    case 'archived': return Activity;
    default: return Activity;
  }
}

// Export projects
async function exportProjects() {
  try {
    const data = await trpc.projects.export.query({
      format: 'csv'
    });
    
    // Create blob and download
    const blob = new Blob([data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `projects-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({
      title: 'Success',
      description: 'Projects exported successfully',
    });
  } catch (error) {
    console.error('Error exporting projects:', error);
    toast({
      title: 'Error',
      description: 'Failed to export projects',
      variant: 'destructive'
    });
  }
}

// Open project in new tab
function openProject(project) {
  const url = `/${project.organizationId}/${project.id}`;
  window.open(url, '_blank');
}

// Open project site
function openProjectSite(project) {
  if (project.domain) {
    window.open(`https://${project.domain}`, '_blank');
  }
}

onMounted(() => {
  fetchProjects();
});
</script>

<template>
  <div class="container mx-auto py-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Projects</h1>
        <p class="text-muted-foreground">Manage all projects across organizations</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" @click="exportProjects">
          <Download class="mr-2 h-4 w-4" />
          Export
        </Button>
        <Button @click="fetchProjects" :disabled="loading">
          <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': loading }" />
          Refresh
        </Button>
      </div>
    </div>
    
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-7 gap-4">
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <FolderKanban class="h-8 w-8 text-primary" />
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
            <p class="text-sm text-muted-foreground">Active</p>
            <p class="text-2xl font-bold">{{ stats.active }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <AlertCircle class="h-8 w-8 text-yellow-600" />
          <div>
            <p class="text-sm text-muted-foreground">Paused</p>
            <p class="text-2xl font-bold">{{ stats.paused }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Activity class="h-8 w-8 text-gray-600" />
          <div>
            <p class="text-sm text-muted-foreground">Archived</p>
            <p class="text-2xl font-bold">{{ stats.archived }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Rocket class="h-8 w-8 text-blue-600" />
          <div>
            <p class="text-sm text-muted-foreground">Deploys</p>
            <p class="text-2xl font-bold">{{ stats.totalDeployments }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <FileText class="h-8 w-8 text-purple-600" />
          <div>
            <p class="text-sm text-muted-foreground">Posts</p>
            <p class="text-2xl font-bold">{{ stats.totalPosts }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <ImageIcon class="h-8 w-8 text-pink-600" />
          <div>
            <p class="text-sm text-muted-foreground">Media</p>
            <p class="text-2xl font-bold">{{ stats.totalMedia }}</p>
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
              placeholder="Search by name, ID, organization, or domain..."
              class="pl-10"
              @input="fetchProjects"
            />
          </div>
        </div>
        <Select v-model="filterOrg" @update:modelValue="fetchProjects">
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
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterStatus === 'all' }"
            @click="filterStatus = 'all'; fetchProjects()"
          >
            All
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterStatus === 'active' }"
            @click="filterStatus = 'active'; fetchProjects()"
          >
            <CheckCircle class="mr-2 h-4 w-4" />
            Active
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterStatus === 'paused' }"
            @click="filterStatus = 'paused'; fetchProjects()"
          >
            <AlertCircle class="mr-2 h-4 w-4" />
            Paused
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterStatus === 'archived' }"
            @click="filterStatus = 'archived'; fetchProjects()"
          >
            <Activity class="mr-2 h-4 w-4" />
            Archived
          </Button>
        </div>
      </div>
    </div>
    
    <!-- Projects Table -->
    <div class="bg-card rounded-lg shadow">
      <Table>
        <TableCaption>
          Showing {{ (page - 1) * limit + 1 }} - {{ Math.min(page * limit, totalItems) }} of {{ totalItems }} projects
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Domain</TableHead>
            <TableHead>Deployments</TableHead>
            <TableHead>Posts</TableHead>
            <TableHead>Media</TableHead>
            <TableHead>Last Deploy</TableHead>
            <TableHead>Created</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="project in projects" :key="project.id">
            <TableCell>
              <div>
                <div class="font-medium">{{ project.name }}</div>
                <div class="text-sm text-muted-foreground font-mono">{{ project.id }}</div>
              </div>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <Building class="h-4 w-4 text-muted-foreground" />
                <span>{{ project.organizationName }}</span>
              </div>
            </TableCell>
            <TableCell>
              <Badge :variant="getStatusBadgeVariant(project.status)">
                <component :is="getStatusIcon(project.status)" class="mr-1 h-3 w-3" />
                {{ project.status }}
              </Badge>
            </TableCell>
            <TableCell>
              <button 
                v-if="project.domain"
                @click="openProjectSite(project)"
                class="flex items-center gap-1 text-primary hover:underline"
              >
                <Globe class="h-4 w-4" />
                {{ project.domain }}
              </button>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <Rocket class="h-4 w-4 text-muted-foreground" />
                <span>{{ project.deploymentCount || 0 }}</span>
              </div>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <FileText class="h-4 w-4 text-muted-foreground" />
                <span>{{ project.postCount || 0 }}</span>
              </div>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <ImageIcon class="h-4 w-4 text-muted-foreground" />
                <span>{{ project.mediaCount || 0 }}</span>
              </div>
            </TableCell>
            <TableCell>{{ formatDate(project.lastDeployedAt) }}</TableCell>
            <TableCell>{{ formatDate(project.createdAt) }}</TableCell>
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
                  <DropdownMenuItem @click="viewProject(project)">
                    <Eye class="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="openProject(project)">
                    <ExternalLink class="mr-2 h-4 w-4" />
                    Open Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    v-if="project.domain"
                    @click="openProjectSite(project)"
                  >
                    <Globe class="mr-2 h-4 w-4" />
                    View Site
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    v-if="project.status !== 'archived'"
                    @click="toggleProjectStatus(project)"
                  >
                    <component 
                      :is="project.status === 'active' ? AlertCircle : CheckCircle" 
                      class="mr-2 h-4 w-4" 
                    />
                    {{ project.status === 'active' ? 'Pause' : 'Activate' }} Project
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    v-if="project.status !== 'archived'"
                    @click="archiveProject(project)"
                    class="text-orange-600"
                  >
                    <Activity class="mr-2 h-4 w-4" />
                    Archive Project
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    @click="deleteProject(project)"
                    class="text-destructive"
                  >
                    <Trash2 class="mr-2 h-4 w-4" />
                    Delete Project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
          <TableRow v-if="projects.length === 0">
            <TableCell colspan="10" class="text-center py-8">
              <div v-if="loading">Loading projects...</div>
              <div v-else>No projects found</div>
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
          @click="page--; fetchProjects()"
          :disabled="page <= 1"
        >
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <Button
          v-for="p in Math.min(5, totalPages)"
          :key="p"
          variant="outline"
          size="sm"
          @click="page = p; fetchProjects()"
          :class="{ 'bg-accent': page === p }"
        >
          {{ p }}
        </Button>
        <Button
          variant="outline"
          size="icon"
          @click="page++; fetchProjects()"
          :disabled="page >= totalPages"
        >
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </div>
    
    <!-- Project Details Modal -->
    <Dialog v-model:open="showProjectModal">
      <DialogContent class="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Project Details</DialogTitle>
          <DialogDescription>
            Complete information for {{ selectedProject?.name }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4" v-if="selectedProject">
          <div>
            <h3 class="text-lg font-semibold">{{ selectedProject.name }}</h3>
            <p class="text-muted-foreground font-mono text-sm">{{ selectedProject.id }}</p>
            <div class="flex gap-2 mt-2">
              <Badge :variant="getStatusBadgeVariant(selectedProject.status)">
                <component :is="getStatusIcon(selectedProject.status)" class="mr-1 h-3 w-3" />
                {{ selectedProject.status }}
              </Badge>
              <Badge v-if="selectedProject.branch" variant="outline">
                <GitBranch class="mr-1 h-3 w-3" />
                {{ selectedProject.branch }}
              </Badge>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-sm font-medium">Organization</label>
              <p class="text-sm">{{ selectedProject.organizationName }}</p>
              <p class="text-sm text-muted-foreground font-mono">{{ selectedProject.organizationId }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Domain</label>
              <p class="text-sm">{{ selectedProject.domain || '—' }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Created</label>
              <p class="text-sm text-muted-foreground">{{ formatDate(selectedProject.createdAt) }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Last Deployed</label>
              <p class="text-sm text-muted-foreground">{{ formatDate(selectedProject.lastDeployedAt) }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Deployments</label>
              <p class="text-sm text-muted-foreground">{{ selectedProject.deploymentCount || 0 }} total</p>
            </div>
            <div>
              <label class="text-sm font-medium">Content</label>
              <p class="text-sm text-muted-foreground">
                {{ selectedProject.postCount || 0 }} posts, {{ selectedProject.mediaCount || 0 }} media files
              </p>
            </div>
          </div>
          
          <div v-if="selectedProject.gitUrl" class="space-y-2">
            <label class="text-sm font-medium">Git Repository</label>
            <div class="flex items-center gap-2">
              <GitBranch class="h-4 w-4 text-muted-foreground" />
              <code class="text-sm bg-muted px-2 py-1 rounded">{{ selectedProject.gitUrl }}</code>
            </div>
          </div>
          
          <div v-if="selectedProject.settings" class="space-y-2">
            <label class="text-sm font-medium">Settings</label>
            <pre class="text-xs bg-muted p-3 rounded-lg overflow-x-auto">{{ JSON.stringify(selectedProject.settings, null, 2) }}</pre>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showProjectModal = false">Close</Button>
          <Button @click="openProject(selectedProject)" v-if="selectedProject">
            <ExternalLink class="mr-2 h-4 w-4" />
            Open Dashboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>