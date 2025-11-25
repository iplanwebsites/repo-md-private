<script setup>
import { RouterLink } from 'vue-router'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import DiffNums from '@/components/ui/DiffNums.vue'
import { Globe, Hash, Terminal, Plug } from 'lucide-vue-next'

const props = defineProps({
  tasks: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  emptyMessage: {
    type: String,
    default: 'No tasks yet'
  },
  loadingMessage: {
    type: String,
    default: 'Loading tasks...'
  },
  showProject: {
    type: Boolean,
    default: true
  },
  showDiffNums: {
    type: Boolean,
    default: false
  },
  isArchive: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['task-click'])

// Get task route function
const getTaskRoute = (task) => {
  if (task.route) {
    return task.route
  }
  // Default route construction if not provided
  return '#'
}

// Get source icon component
const getSourceIcon = (source) => {
  switch (source) {
    case 'slack':
      return Hash
    case 'cli':
      return Terminal
    case 'mcp':
      return Plug
    case 'web':
    default:
      return Globe
  }
}

// Get source tooltip
const getSourceTooltip = (source) => {
  switch (source) {
    case 'slack':
      return 'Created from Slack'
    case 'cli':
      return 'Created from CLI'
    case 'mcp':
      return 'Created from MCP'
    case 'web':
    default:
      return 'Created from Web'
  }
}

// Get badge variant based on status
const getBadgeVariant = (status) => {
  if (props.isArchive) {
    return 'secondary'
  }
  
  switch (status) {
    case 'Open':
      return 'default'
    case 'Completed':
    case 'Merged':
      return 'secondary'
    default:
      return 'outline'
  }
}
</script>

<template>
  <!-- Loading state -->
  <div v-if="loading" class="text-center py-12">
    <div class="text-muted-foreground">{{ loadingMessage }}</div>
  </div>
  
  <!-- Empty state -->
  <div v-else-if="tasks.length === 0" class="text-center py-12">
    <div class="text-muted-foreground">{{ emptyMessage }}</div>
  </div>
  
  <!-- Task list -->
  <template v-else>
    <RouterLink
      v-for="task in tasks" 
      :key="task.id"
      :to="task.route || '#'"
      class="block no-underline"
      @click="emit('task-click', task)"
    >
      <Card class="p-4 hover:shadow-sm transition-shadow cursor-pointer">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h3 class="text-foreground font-medium mb-1">{{ task.title }}</h3>
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <!-- Source icon -->
              <component 
                :is="getSourceIcon(task.source || 'web')"
                class="h-3.5 w-3.5"
                :title="getSourceTooltip(task.source || 'web')"
              />
              <span>{{ task.timeAgo }}</span>
              
              <!-- Project info (conditional) -->
              <template v-if="showProject && task.project">
                <span>·</span>
                <span>{{ task.project }}</span>
              </template>
              
              <!-- Repository info -->
              <template v-if="task.repository">
                <span>·</span>
                <span>{{ task.repository }}</span>
              </template>
              
              <!-- Message count -->
              <template v-if="task.messagesCount">
                <span>·</span>
                <span>{{ task.messagesCount }} messages</span>
              </template>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <Badge 
              v-if="task.status" 
              :variant="getBadgeVariant(task.status)"
            >
              {{ task.status }}
            </Badge>
            <DiffNums 
              v-if="showDiffNums && task.changes" 
              :changes="task.changes" 
            />
          </div>
        </div>
      </Card>
    </RouterLink>
  </template>
</template>