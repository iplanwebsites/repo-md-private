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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Building, 
  Search, 
  Filter, 
  Users as UsersIcon,
  FolderKanban,
  Calendar,
  CreditCard,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Shield
} from 'lucide-vue-next';

const organizations = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const filterStatus = ref('all'); // 'all', 'active', 'trial', 'suspended', 'cancelled'
const filterPlan = ref('all'); // 'all', 'free', 'pro', 'team', 'enterprise'
const showOrgModal = ref(false);
const selectedOrg = ref(null);

// Pagination
const page = ref(1);
const limit = ref(25);
const totalItems = ref(0);
const totalPages = computed(() => Math.ceil(totalItems.value / limit.value));

// Stats
const stats = ref({
  total: 0,
  active: 0,
  trial: 0,
  suspended: 0,
  totalRevenue: 0,
  avgProjectsPerOrg: 0
});

// Filtered organizations
const filteredOrganizations = computed(() => {
  let filtered = organizations.value;
  
  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(org => 
      org.name?.toLowerCase().includes(query) ||
      org.id?.toLowerCase().includes(query) ||
      org.ownerEmail?.toLowerCase().includes(query)
    );
  }
  
  // Status filter
  if (filterStatus.value !== 'all') {
    filtered = filtered.filter(org => org.status === filterStatus.value);
  }
  
  // Plan filter
  if (filterPlan.value !== 'all') {
    filtered = filtered.filter(org => org.plan === filterPlan.value);
  }
  
  return filtered;
});

// Fetch organizations
async function fetchOrganizations() {
  loading.value = true;
  
  try {
    const data = await trpc.organizations.list.query({
      page: page.value,
      limit: limit.value,
      search: searchQuery.value,
      status: filterStatus.value,
      plan: filterPlan.value
    });
    
    organizations.value = data.items || [];
    totalItems.value = data.total || 0;
    
    // Update stats
    if (data.stats) {
      stats.value = data.stats;
    }
  } catch (error) {
    console.error('Error fetching organizations:', error);
    toast({
      title: 'Error',
      description: 'Failed to load organizations',
      variant: 'destructive'
    });
  } finally {
    loading.value = false;
  }
}

// View organization details
function viewOrg(org) {
  selectedOrg.value = org;
  showOrgModal.value = true;
}

// Suspend/unsuspend organization
async function toggleSuspend(org) {
  const action = org.status === 'suspended' ? 'unsuspend' : 'suspend';
  
  if (!confirm(`Are you sure you want to ${action} ${org.name}?`)) {
    return;
  }
  
  try {
    await trpc.organizations.toggleSuspend.mutate({
      orgId: org.id,
      suspended: org.status !== 'suspended'
    });
    
    // Update local state
    org.status = org.status === 'suspended' ? 'active' : 'suspended';
    
    toast({
      title: 'Success',
      description: `Organization ${action}ed successfully`,
    });
  } catch (error) {
    console.error('Error toggling suspend:', error);
    toast({
      title: 'Error',
      description: `Failed to ${action} organization`,
      variant: 'destructive'
    });
  }
}

// Delete organization
async function deleteOrg(org) {
  if (!confirm(`Are you sure you want to permanently delete ${org.name}? This will delete all projects and data. This action cannot be undone.`)) {
    return;
  }
  
  try {
    await trpc.organizations.delete.mutate({
      orgId: org.id
    });
    
    // Remove from local state
    organizations.value = organizations.value.filter(o => o.id !== org.id);
    totalItems.value--;
    
    toast({
      title: 'Success',
      description: 'Organization deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting organization:', error);
    toast({
      title: 'Error',
      description: 'Failed to delete organization',
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

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount || 0);
}

// Get org initials
function getOrgInitials(org) {
  if (org.name) {
    return org.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  return 'OR';
}

// Get plan badge variant
function getPlanBadgeVariant(plan) {
  switch (plan) {
    case 'enterprise': return 'default';
    case 'team': return 'secondary';
    case 'pro': return 'outline';
    default: return 'outline';
  }
}

// Get status badge variant
function getStatusBadgeVariant(status) {
  switch (status) {
    case 'active': return 'default';
    case 'trial': return 'secondary';
    case 'suspended': return 'destructive';
    case 'cancelled': return 'outline';
    default: return 'outline';
  }
}

// Export organizations
async function exportOrganizations() {
  try {
    const data = await trpc.organizations.export.query({
      format: 'csv'
    });
    
    // Create blob and download
    const blob = new Blob([data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `organizations-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({
      title: 'Success',
      description: 'Organizations exported successfully',
    });
  } catch (error) {
    console.error('Error exporting organizations:', error);
    toast({
      title: 'Error',
      description: 'Failed to export organizations',
      variant: 'destructive'
    });
  }
}

onMounted(() => {
  fetchOrganizations();
});
</script>

<template>
  <div class="container mx-auto py-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Organizations</h1>
        <p class="text-muted-foreground">Manage organizations and subscriptions</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" @click="exportOrganizations">
          <Download class="mr-2 h-4 w-4" />
          Export
        </Button>
        <Button @click="fetchOrganizations" :disabled="loading">
          <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': loading }" />
          Refresh
        </Button>
      </div>
    </div>
    
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-6 gap-4">
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Building class="h-8 w-8 text-primary" />
          <div>
            <p class="text-sm text-muted-foreground">Total Orgs</p>
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
            <p class="text-sm text-muted-foreground">Trial</p>
            <p class="text-2xl font-bold">{{ stats.trial }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Shield class="h-8 w-8 text-red-600" />
          <div>
            <p class="text-sm text-muted-foreground">Suspended</p>
            <p class="text-2xl font-bold">{{ stats.suspended }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <TrendingUp class="h-8 w-8 text-blue-600" />
          <div>
            <p class="text-sm text-muted-foreground">MRR</p>
            <p class="text-2xl font-bold">{{ formatCurrency(stats.totalRevenue) }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <FolderKanban class="h-8 w-8 text-purple-600" />
          <div>
            <p class="text-sm text-muted-foreground">Avg Projects</p>
            <p class="text-2xl font-bold">{{ stats.avgProjectsPerOrg?.toFixed(1) || 0 }}</p>
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
              placeholder="Search by name, ID, or owner email..."
              class="pl-10"
              @input="fetchOrganizations"
            />
          </div>
        </div>
        <div class="flex gap-2">
          <!-- Status filters -->
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterStatus === 'all' }"
            @click="filterStatus = 'all'; fetchOrganizations()"
          >
            All Status
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterStatus === 'active' }"
            @click="filterStatus = 'active'; fetchOrganizations()"
          >
            Active
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterStatus === 'trial' }"
            @click="filterStatus = 'trial'; fetchOrganizations()"
          >
            Trial
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterStatus === 'suspended' }"
            @click="filterStatus = 'suspended'; fetchOrganizations()"
          >
            Suspended
          </Button>
        </div>
        <div class="flex gap-2">
          <!-- Plan filters -->
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterPlan === 'all' }"
            @click="filterPlan = 'all'; fetchOrganizations()"
          >
            All Plans
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterPlan === 'free' }"
            @click="filterPlan = 'free'; fetchOrganizations()"
          >
            Free
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterPlan === 'pro' }"
            @click="filterPlan = 'pro'; fetchOrganizations()"
          >
            Pro
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterPlan === 'team' }"
            @click="filterPlan = 'team'; fetchOrganizations()"
          >
            Team
          </Button>
          <Button
            variant="outline"
            size="sm"
            :class="{ 'bg-accent': filterPlan === 'enterprise' }"
            @click="filterPlan = 'enterprise'; fetchOrganizations()"
          >
            Enterprise
          </Button>
        </div>
      </div>
    </div>
    
    <!-- Organizations Table -->
    <div class="bg-card rounded-lg shadow">
      <Table>
        <TableCaption>
          Showing {{ (page - 1) * limit + 1 }} - {{ Math.min(page * limit, totalItems) }} of {{ totalItems }} organizations
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Members</TableHead>
            <TableHead>Projects</TableHead>
            <TableHead>Revenue</TableHead>
            <TableHead>Created</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="org in organizations" :key="org.id">
            <TableCell>
              <div class="flex items-center gap-3">
                <Avatar>
                  <AvatarImage :src="org.logo" :alt="org.name" />
                  <AvatarFallback>{{ getOrgInitials(org) }}</AvatarFallback>
                </Avatar>
                <div>
                  <div class="font-medium">{{ org.name }}</div>
                  <div class="text-sm text-muted-foreground">{{ org.id }}</div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div>
                <div class="text-sm">{{ org.ownerName || '—' }}</div>
                <div class="text-sm text-muted-foreground">{{ org.ownerEmail }}</div>
              </div>
            </TableCell>
            <TableCell>
              <Badge :variant="getPlanBadgeVariant(org.plan)">
                {{ org.plan }}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge :variant="getStatusBadgeVariant(org.status)">
                {{ org.status }}
              </Badge>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <UsersIcon class="h-4 w-4 text-muted-foreground" />
                <span>{{ org.memberCount || 0 }}</span>
              </div>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <FolderKanban class="h-4 w-4 text-muted-foreground" />
                <span>{{ org.projectCount || 0 }}</span>
              </div>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <CreditCard class="h-4 w-4 text-muted-foreground" />
                <span>{{ formatCurrency(org.monthlyRevenue) }}</span>
              </div>
            </TableCell>
            <TableCell>{{ formatDate(org.createdAt) }}</TableCell>
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
                  <DropdownMenuItem @click="viewOrg(org)">
                    <Eye class="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem :disabled="true">
                    <Edit class="mr-2 h-4 w-4" />
                    Edit Organization
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    @click="toggleSuspend(org)"
                    :class="org.status === 'suspended' ? '' : 'text-orange-600'"
                  >
                    <Shield class="mr-2 h-4 w-4" />
                    {{ org.status === 'suspended' ? 'Unsuspend' : 'Suspend' }} Org
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    @click="deleteOrg(org)"
                    class="text-destructive"
                  >
                    <Trash2 class="mr-2 h-4 w-4" />
                    Delete Organization
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
          <TableRow v-if="organizations.length === 0">
            <TableCell colspan="9" class="text-center py-8">
              <div v-if="loading">Loading organizations...</div>
              <div v-else>No organizations found</div>
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
          @click="page--; fetchOrganizations()"
          :disabled="page <= 1"
        >
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <Button
          v-for="p in Math.min(5, totalPages)"
          :key="p"
          variant="outline"
          size="sm"
          @click="page = p; fetchOrganizations()"
          :class="{ 'bg-accent': page === p }"
        >
          {{ p }}
        </Button>
        <Button
          variant="outline"
          size="icon"
          @click="page++; fetchOrganizations()"
          :disabled="page >= totalPages"
        >
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </div>
    
    <!-- Organization Details Modal -->
    <Dialog v-model:open="showOrgModal">
      <DialogContent class="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Organization Details</DialogTitle>
          <DialogDescription>
            Complete information for {{ selectedOrg?.name }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4" v-if="selectedOrg">
          <div class="flex items-center gap-4">
            <Avatar class="h-16 w-16">
              <AvatarImage :src="selectedOrg.logo" :alt="selectedOrg.name" />
              <AvatarFallback>{{ getOrgInitials(selectedOrg) }}</AvatarFallback>
            </Avatar>
            <div>
              <h3 class="text-lg font-semibold">{{ selectedOrg.name }}</h3>
              <p class="text-muted-foreground">{{ selectedOrg.id }}</p>
              <div class="flex gap-2 mt-2">
                <Badge :variant="getStatusBadgeVariant(selectedOrg.status)">
                  {{ selectedOrg.status }}
                </Badge>
                <Badge :variant="getPlanBadgeVariant(selectedOrg.plan)">
                  {{ selectedOrg.plan }}
                </Badge>
              </div>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-sm font-medium">Owner</label>
              <p class="text-sm">{{ selectedOrg.ownerName || '—' }}</p>
              <p class="text-sm text-muted-foreground">{{ selectedOrg.ownerEmail }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Created</label>
              <p class="text-sm text-muted-foreground">{{ formatDate(selectedOrg.createdAt) }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Members</label>
              <p class="text-sm text-muted-foreground">{{ selectedOrg.memberCount || 0 }} members</p>
            </div>
            <div>
              <label class="text-sm font-medium">Projects</label>
              <p class="text-sm text-muted-foreground">{{ selectedOrg.projectCount || 0 }} projects</p>
            </div>
            <div>
              <label class="text-sm font-medium">Monthly Revenue</label>
              <p class="text-sm text-muted-foreground">{{ formatCurrency(selectedOrg.monthlyRevenue) }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Total Revenue</label>
              <p class="text-sm text-muted-foreground">{{ formatCurrency(selectedOrg.totalRevenue) }}</p>
            </div>
          </div>
          
          <div v-if="selectedOrg.subscription" class="space-y-2">
            <label class="text-sm font-medium">Subscription Details</label>
            <div class="bg-muted p-3 rounded-lg space-y-2 text-sm">
              <div class="flex justify-between">
                <span>Status:</span>
                <span>{{ selectedOrg.subscription.status }}</span>
              </div>
              <div class="flex justify-between">
                <span>Started:</span>
                <span>{{ formatDate(selectedOrg.subscription.startedAt) }}</span>
              </div>
              <div class="flex justify-between">
                <span>Next billing:</span>
                <span>{{ formatDate(selectedOrg.subscription.nextBillingDate) }}</span>
              </div>
              <div class="flex justify-between">
                <span>Customer ID:</span>
                <span class="font-mono text-xs">{{ selectedOrg.subscription.stripeCustomerId }}</span>
              </div>
            </div>
          </div>
          
          <div v-if="selectedOrg.settings" class="space-y-2">
            <label class="text-sm font-medium">Settings</label>
            <pre class="text-xs bg-muted p-3 rounded-lg overflow-x-auto">{{ JSON.stringify(selectedOrg.settings, null, 2) }}</pre>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showOrgModal = false">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>