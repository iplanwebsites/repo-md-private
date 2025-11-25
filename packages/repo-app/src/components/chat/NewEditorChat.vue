<script setup>
import { ref, computed, watch } from 'vue'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { FolderIcon, GitBranchIcon, ArrowUpIcon } from 'lucide-vue-next'

const props = defineProps({
  placeholder: {
    type: String,
    default: 'Enter your question or task...'
  },
  submitButtonText: {
    type: String,
    default: 'Create Task'
  },
  showProjectSelector: {
    type: Boolean,
    default: true
  },
  projectOptions: {
    type: Array,
    default: () => []
  },
  branches: {
    type: Array,
    default: () => []
  },
  showBranchSelector: {
    type: Boolean,
    default: false
  },
  loadingBranches: {
    type: Boolean,
    default: false
  },
  creating: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'submit',
  'update:query',
  'update:selectedProject',
  'update:selectedBranch',
  'keypress'
])

const searchQuery = ref('')
const selectedProject = ref('all-projects')
const selectedBranch = ref('main')

const selectedProjectInfo = computed(() => {
  return props.projectOptions.find(p => p.value === selectedProject.value) || props.projectOptions[0]
})

const handleKeyPress = (event) => {
  emit('keypress', event)
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSubmit()
  }
}

const handleSubmit = () => {
  if (!searchQuery.value.trim() || props.creating) return
  
  emit('submit', {
    query: searchQuery.value,
    project: selectedProject.value,
    branch: selectedBranch.value
  })
}

const clearQuery = () => {
  searchQuery.value = ''
}

watch(searchQuery, (newValue) => {
  emit('update:query', newValue)
})

watch(selectedProject, (newValue) => {
  emit('update:selectedProject', newValue)
})

watch(selectedBranch, (newValue) => {
  emit('update:selectedBranch', newValue)
})

defineExpose({
  clearQuery,
  searchQuery,
  selectedProject,
  selectedBranch
})
</script>

<template>
  <div class="w-full flex justify-center">
    <Card class="p-4 w-full max-w-[800px]">
    <div class="flex items-start gap-4">
      <Textarea 
        v-model="searchQuery"
        :placeholder="placeholder"
        class="flex-1 min-h-[80px] resize-none border-0 shadow-none focus-visible:ring-0 text-muted-foreground"
        @keydown="handleKeyPress"
      />
      <div class="flex items-center gap-4">
        <Select 
          v-if="showProjectSelector && projectOptions.length > 0"
          v-model="selectedProject"
        >
          <SelectTrigger class="w-[150px] border-0 shadow-none">
            <div class="flex items-center gap-2 w-full">
              <FolderIcon class="w-4 h-4 text-muted-foreground shrink-0" />
              <SelectValue :placeholder="selectedProjectInfo?.label || 'Select project'" class="truncate" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem 
              v-for="project in projectOptions" 
              :key="project.value" 
              :value="project.value"
            >
              <span class="truncate block max-w-[120px]">{{ project.label }}</span>
            </SelectItem>
          </SelectContent>
        </Select>
        
        <Select 
          v-if="showBranchSelector" 
          v-model="selectedBranch"
          :disabled="loadingBranches"
        >
          <SelectTrigger class="w-[120px] border-0 shadow-none">
            <div class="flex items-center gap-2">
              <GitBranchIcon class="w-4 h-4 text-muted-foreground" />
              <SelectValue 
                :placeholder="loadingBranches ? 'Loading...' : 'Select branch'" 
              />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem 
              v-for="branch in branches" 
              :key="branch.value" 
              :value="branch.value"
            >
              <div class="flex items-center gap-2">
                {{ branch.label }}
                <Badge v-if="branch.protected" variant="secondary" class="text-xs">
                  Protected
                </Badge>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        
        <Button 
          variant="secondary" 
          class="text-muted-foreground hover:text-foreground"
          :disabled="!searchQuery.trim() || creating"
          @click="handleSubmit"
        >
          Ask
        </Button>
        
        <Button 
          class="rounded-full"
          :disabled="!searchQuery.trim() || creating"
          @click="handleSubmit"
        >
          <ArrowUpIcon v-if="!creating" class="w-4 h-4" />
          <span v-else>Creating...</span>
        </Button>
      </div>
    </div>
    </Card>
  </div>
</template>