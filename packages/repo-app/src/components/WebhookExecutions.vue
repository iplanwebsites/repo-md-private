<script setup>
import { ref, onMounted, computed } from "vue";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import CodeBlock from "@/components/CodeBlock.vue";
import { formatDistanceToNow } from "date-fns";
import trpc from "@/trpc";

const props = defineProps({
  projectId: {
    type: String,
    required: true
  },
  webhookId: {
    type: String,
    default: null
  },
  limit: {
    type: Number,
    default: 10
  }
});

const executions = ref([]);
const isLoading = ref(false);
const expandedExecutions = ref(new Set());

// Load executions
const loadExecutions = async () => {
  isLoading.value = true;
  try {
    const result = await trpc.projectWebhooks.incoming.listExecutions.query({
      projectId: props.projectId,
      webhookId: props.webhookId,
      limit: props.limit
    });
    executions.value = result.executions || [];
  } catch (error) {
    console.error('Failed to load webhook executions:', error);
  } finally {
    isLoading.value = false;
  }
};

// Get status icon
const getStatusIcon = (status) => {
  switch(status) {
    case 'success': return CheckCircle;
    case 'error': return XCircle;
    case 'pending': return Clock;
    default: return AlertCircle;
  }
};

// Get status badge variant
const getStatusVariant = (status) => {
  switch(status) {
    case 'success': return 'default';
    case 'error': return 'destructive';
    case 'pending': return 'secondary';
    default: return 'outline';
  }
};

// Toggle execution details
const toggleExecution = (id) => {
  if (expandedExecutions.value.has(id)) {
    expandedExecutions.value.delete(id);
  } else {
    expandedExecutions.value.add(id);
  }
};

// Format JSON for display
const formatJson = (obj) => {
  return JSON.stringify(obj, null, 2);
};

onMounted(() => {
  loadExecutions();
});
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-medium">Recent Executions</h3>
        <p class="text-sm text-muted-foreground">
          View webhook execution history and debug information
        </p>
      </div>
      <Button
        @click="loadExecutions"
        variant="outline"
        size="sm"
        :disabled="isLoading"
      >
        <RefreshCw class="w-4 h-4 mr-2" :class="{ 'animate-spin': isLoading }" />
        Refresh
      </Button>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading && executions.length === 0" class="text-center py-8">
      <RefreshCw class="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
      <p class="text-muted-foreground mt-2">Loading executions...</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="executions.length === 0" class="text-center py-8 text-muted-foreground">
      <Clock class="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
      <p>No webhook executions yet</p>
      <p class="text-sm">Webhook executions will appear here when triggered</p>
    </div>

    <!-- Executions list -->
    <div v-else class="space-y-3">
      <Card v-for="execution in executions" :key="execution.id">
        <Collapsible>
          <CollapsibleTrigger class="w-full">
            <CardHeader class="cursor-pointer hover:bg-muted/50 transition-colors">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <component 
                    :is="getStatusIcon(execution.status)" 
                    :class="{
                      'text-green-600': execution.status === 'success',
                      'text-red-600': execution.status === 'error',
                      'text-yellow-600': execution.status === 'pending',
                      'text-gray-600': !['success', 'error', 'pending'].includes(execution.status)
                    }"
                    class="w-5 h-5"
                  />
                  <div class="text-left">
                    <p class="font-medium">
                      {{ execution.command || 'No command extracted' }}
                    </p>
                    <p class="text-sm text-muted-foreground">
                      {{ formatDistanceToNow(new Date(execution.timestamp), { addSuffix: true }) }}
                      · {{ execution.webhookName || 'Unknown webhook' }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <Badge :variant="getStatusVariant(execution.status)">
                    {{ execution.status }}
                  </Badge>
                  <component 
                    :is="expandedExecutions.has(execution.id) ? ChevronUp : ChevronDown"
                    class="w-4 h-4 text-muted-foreground"
                  />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent class="space-y-4 pt-0">
              <!-- Execution details -->
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p class="text-muted-foreground">Execution ID</p>
                  <p class="font-mono">{{ execution.id }}</p>
                </div>
                <div>
                  <p class="text-muted-foreground">Duration</p>
                  <p>{{ execution.duration || 0 }}ms</p>
                </div>
              </div>

              <!-- Command details -->
              <div v-if="execution.extractedCommand" class="space-y-2">
                <p class="text-sm font-medium">Extracted Command</p>
                <CodeBlock
                  :code="formatJson(execution.extractedCommand)"
                  language="json"
                  class="text-sm"
                />
              </div>

              <!-- Request payload -->
              <div v-if="execution.payload" class="space-y-2">
                <p class="text-sm font-medium">Request Payload</p>
                <CodeBlock
                  :code="formatJson(execution.payload)"
                  language="json"
                  class="text-sm max-h-64 overflow-auto"
                />
              </div>

              <!-- Response -->
              <div v-if="execution.response" class="space-y-2">
                <p class="text-sm font-medium">Response</p>
                <CodeBlock
                  :code="formatJson(execution.response)"
                  language="json"
                  class="text-sm"
                />
              </div>

              <!-- Error details -->
              <div v-if="execution.error" class="space-y-2">
                <p class="text-sm font-medium text-red-600">Error Details</p>
                <div class="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p class="text-sm text-red-800">{{ execution.error }}</p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  </div>
</template>