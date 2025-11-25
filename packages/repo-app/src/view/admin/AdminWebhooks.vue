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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
  Webhook,
  Search, 
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Download,
  ArrowRight,
  ArrowLeft,
  Globe,
  Shield,
  AlertCircle,
  Zap
} from 'lucide-vue-next';

// Incoming webhooks table
const {
  items: incomingWebhooks,
  loading: loadingIncoming,
  searchQuery: searchIncoming,
  stats: statsIncoming,
  selectedItem: selectedIncoming,
  showModal: showIncomingModal,
  fetchItems: fetchIncoming,
  viewItem: viewIncoming
} = useAdminTable({
  fetchFn: trpc.projectWebhooks.list.query,
  itemName: 'webhook',
  itemsName: 'incoming webhooks'
});

// Outgoing webhooks table
const {
  items: outgoingWebhooks,
  loading: loadingOutgoing,
  searchQuery: searchOutgoing,
  stats: statsOutgoing,
  selectedItem: selectedOutgoing,
  showModal: showOutgoingModal,
  fetchItems: fetchOutgoing,
  viewItem: viewOutgoing
} = useAdminTable({
  fetchFn: trpc.projectOutgoingWebhooks.list.query,
  itemName: 'webhook',
  itemsName: 'outgoing webhooks'
});

// Active tab
const activeTab = ref('incoming');

// Stats
const totalStats = computed(() => ({
  totalIncoming: statsIncoming.value.total || 0,
  totalOutgoing: statsOutgoing.value.total || 0,
  activeWebhooks: (statsIncoming.value.active || 0) + (statsOutgoing.value.active || 0),
  failedToday: (statsIncoming.value.failedToday || 0) + (statsOutgoing.value.failedToday || 0)
}));

// Test webhook
async function testWebhook(webhook, type) {
  try {
    await trpc.webhooks.test.mutate({ 
      webhookId: webhook.id,
      type
    });
    toast({
      title: 'Success',
      description: 'Test webhook sent successfully',
    });
  } catch (error) {
    toast({
      title: 'Error',
      description: 'Failed to send test webhook',
      variant: 'destructive'
    });
  }
}

// Get status badge
function getStatusBadge(status) {
  const variants = {
    active: { variant: 'default', icon: CheckCircle, class: 'text-green-600' },
    inactive: { variant: 'secondary', icon: Clock, class: '' },
    failed: { variant: 'destructive', icon: XCircle, class: '' }
  };
  return variants[status] || variants.inactive;
}

// Fetch data on mount
onMounted(() => {
  fetchIncoming();
  fetchOutgoing();
});
</script>

<template>
  <div class="container mx-auto py-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Webhooks</h1>
        <p class="text-muted-foreground">Manage incoming and outgoing webhooks</p>
      </div>
      <Button 
        @click="activeTab === 'incoming' ? fetchIncoming() : fetchOutgoing()" 
        :disabled="loadingIncoming || loadingOutgoing"
      >
        <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': loadingIncoming || loadingOutgoing }" />
        Refresh
      </Button>
    </div>
    
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <ArrowRight class="h-8 w-8 text-primary" />
          <div>
            <p class="text-sm text-muted-foreground">Incoming</p>
            <p class="text-2xl font-bold">{{ totalStats.totalIncoming }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <ArrowLeft class="h-8 w-8 text-blue-600" />
          <div>
            <p class="text-sm text-muted-foreground">Outgoing</p>
            <p class="text-2xl font-bold">{{ totalStats.totalOutgoing }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <Zap class="h-8 w-8 text-green-600" />
          <div>
            <p class="text-sm text-muted-foreground">Active</p>
            <p class="text-2xl font-bold">{{ totalStats.activeWebhooks }}</p>
          </div>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center gap-3">
          <AlertCircle class="h-8 w-8 text-red-600" />
          <div>
            <p class="text-sm text-muted-foreground">Failed Today</p>
            <p class="text-2xl font-bold">{{ totalStats.failedToday }}</p>
          </div>
        </div>
      </Card>
    </div>
    
    <!-- Tabs -->
    <Tabs v-model="activeTab" class="w-full">
      <TabsList class="grid w-full grid-cols-2">
        <TabsTrigger value="incoming">
          <ArrowRight class="mr-2 h-4 w-4" />
          Incoming Webhooks
        </TabsTrigger>
        <TabsTrigger value="outgoing">
          <ArrowLeft class="mr-2 h-4 w-4" />
          Outgoing Webhooks
        </TabsTrigger>
      </TabsList>
      
      <!-- Incoming Webhooks -->
      <TabsContent value="incoming" class="space-y-4">
        <div class="bg-card rounded-lg p-4">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              v-model="searchIncoming"
              placeholder="Search incoming webhooks..."
              class="pl-10"
              @input="fetchIncoming"
            />
          </div>
        </div>
        
        <div class="bg-card rounded-lg shadow">
          <Table>
            <TableCaption>Project webhook endpoints</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Webhook URL</TableHead>
                <TableHead>Secret</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="webhook in incomingWebhooks" :key="webhook.id">
                <TableCell>
                  <div>
                    <div class="font-medium">{{ webhook.projectName }}</div>
                    <div class="text-sm text-muted-foreground">{{ webhook.organizationName }}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <code class="text-xs bg-muted px-2 py-1 rounded">{{ webhook.url }}</code>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    <Shield class="mr-1 h-3 w-3" />
                    {{ webhook.hasSecret ? 'Configured' : 'None' }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div class="flex flex-wrap gap-1">
                    <Badge 
                      v-for="event in (webhook.events || ['push'])" 
                      :key="event"
                      variant="secondary"
                      class="text-xs"
                    >
                      {{ event }}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge 
                    :variant="getStatusBadge(webhook.status).variant"
                  >
                    <component 
                      :is="getStatusBadge(webhook.status).icon" 
                      class="mr-1 h-3 w-3"
                      :class="getStatusBadge(webhook.status).class"
                    />
                    {{ webhook.status }}
                  </Badge>
                </TableCell>
                <TableCell>{{ formatDate(webhook.createdAt) }}</TableCell>
                <TableCell class="text-right">
                  <div class="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      @click="viewIncoming(webhook)"
                    >
                      <Eye class="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      @click="testWebhook(webhook, 'incoming')"
                    >
                      <Send class="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              <TableRow v-if="incomingWebhooks.length === 0">
                <TableCell colspan="7" class="text-center py-8">
                  <div v-if="loadingIncoming">Loading incoming webhooks...</div>
                  <div v-else>No incoming webhooks found</div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </TabsContent>
      
      <!-- Outgoing Webhooks -->
      <TabsContent value="outgoing" class="space-y-4">
        <div class="bg-card rounded-lg p-4">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              v-model="searchOutgoing"
              placeholder="Search outgoing webhooks..."
              class="pl-10"
              @input="fetchOutgoing"
            />
          </div>
        </div>
        
        <div class="bg-card rounded-lg shadow">
          <Table>
            <TableCaption>Configured outgoing webhooks</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Target URL</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Triggered</TableHead>
                <TableHead>Success Rate</TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="webhook in outgoingWebhooks" :key="webhook.id">
                <TableCell>
                  <div>
                    <div class="font-medium">{{ webhook.projectName }}</div>
                    <div class="text-sm text-muted-foreground">{{ webhook.organizationName }}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div class="flex items-center gap-1">
                    <Globe class="h-4 w-4 text-muted-foreground" />
                    <code class="text-xs">{{ webhook.targetUrl }}</code>
                  </div>
                </TableCell>
                <TableCell>
                  <div class="flex flex-wrap gap-1">
                    <Badge 
                      v-for="event in (webhook.events || [])" 
                      :key="event"
                      variant="secondary"
                      class="text-xs"
                    >
                      {{ event }}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge 
                    :variant="getStatusBadge(webhook.active ? 'active' : 'inactive').variant"
                  >
                    {{ webhook.active ? 'Active' : 'Inactive' }}
                  </Badge>
                </TableCell>
                <TableCell>{{ formatDate(webhook.lastTriggeredAt) }}</TableCell>
                <TableCell>
                  <div class="flex items-center gap-1">
                    <div 
                      class="w-16 bg-muted rounded-full h-2 overflow-hidden"
                      :title="`${webhook.successRate || 0}% success rate`"
                    >
                      <div 
                        class="h-full bg-green-600"
                        :style="`width: ${webhook.successRate || 0}%`"
                      />
                    </div>
                    <span class="text-sm text-muted-foreground">
                      {{ webhook.successRate || 0 }}%
                    </span>
                  </div>
                </TableCell>
                <TableCell class="text-right">
                  <div class="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      @click="viewOutgoing(webhook)"
                    >
                      <Eye class="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      @click="testWebhook(webhook, 'outgoing')"
                    >
                      <Send class="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              <TableRow v-if="outgoingWebhooks.length === 0">
                <TableCell colspan="7" class="text-center py-8">
                  <div v-if="loadingOutgoing">Loading outgoing webhooks...</div>
                  <div v-else>No outgoing webhooks configured</div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
    
    <!-- Incoming Webhook Details Modal -->
    <Dialog v-model:open="showIncomingModal">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Incoming Webhook Details</DialogTitle>
        </DialogHeader>
        <div class="space-y-4" v-if="selectedIncoming">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-sm font-medium">Webhook ID</label>
              <p class="text-sm font-mono">{{ selectedIncoming.id }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Project</label>
              <p class="text-sm">{{ selectedIncoming.projectName }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">URL</label>
              <code class="text-sm bg-muted px-2 py-1 rounded">{{ selectedIncoming.url }}</code>
            </div>
            <div>
              <label class="text-sm font-medium">Status</label>
              <Badge :variant="getStatusBadge(selectedIncoming.status).variant">
                {{ selectedIncoming.status }}
              </Badge>
            </div>
          </div>
          
          <div>
            <label class="text-sm font-medium">Recent Events</label>
            <div class="mt-2 space-y-2">
              <div 
                v-for="event in (selectedIncoming.recentEvents || [])" 
                :key="event.id"
                class="flex items-center justify-between p-2 bg-muted rounded"
              >
                <div class="flex items-center gap-2">
                  <Badge variant="outline">{{ event.type }}</Badge>
                  <span class="text-sm">{{ formatDate(event.timestamp) }}</span>
                </div>
                <Badge 
                  :variant="event.success ? 'default' : 'destructive'"
                  class="text-xs"
                >
                  {{ event.success ? 'Success' : 'Failed' }}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showIncomingModal = false">Close</Button>
          <Button @click="testWebhook(selectedIncoming, 'incoming'); showIncomingModal = false">
            <Send class="mr-2 h-4 w-4" />
            Send Test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    <!-- Outgoing Webhook Details Modal -->
    <Dialog v-model:open="showOutgoingModal">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Outgoing Webhook Details</DialogTitle>
        </DialogHeader>
        <div class="space-y-4" v-if="selectedOutgoing">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-sm font-medium">Webhook ID</label>
              <p class="text-sm font-mono">{{ selectedOutgoing.id }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Project</label>
              <p class="text-sm">{{ selectedOutgoing.projectName }}</p>
            </div>
            <div>
              <label class="text-sm font-medium">Target URL</label>
              <code class="text-sm bg-muted px-2 py-1 rounded">{{ selectedOutgoing.targetUrl }}</code>
            </div>
            <div>
              <label class="text-sm font-medium">Active</label>
              <Badge :variant="selectedOutgoing.active ? 'default' : 'secondary'">
                {{ selectedOutgoing.active ? 'Yes' : 'No' }}
              </Badge>
            </div>
          </div>
          
          <div>
            <label class="text-sm font-medium">Delivery History</label>
            <div class="mt-2 space-y-2">
              <div 
                v-for="delivery in (selectedOutgoing.deliveries || [])" 
                :key="delivery.id"
                class="flex items-center justify-between p-2 bg-muted rounded"
              >
                <div>
                  <Badge variant="outline" class="mr-2">{{ delivery.event }}</Badge>
                  <span class="text-sm">{{ formatDate(delivery.timestamp) }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted-foreground">{{ delivery.statusCode }}</span>
                  <Badge 
                    :variant="delivery.success ? 'default' : 'destructive'"
                    class="text-xs"
                  >
                    {{ delivery.success ? 'Delivered' : 'Failed' }}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showOutgoingModal = false">Close</Button>
          <Button @click="testWebhook(selectedOutgoing, 'outgoing'); showOutgoingModal = false">
            <Send class="mr-2 h-4 w-4" />
            Send Test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>