<script setup>
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Wand2, 
  Send, 
  Calendar,
  Clock,
  Bot,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-vue-next'
import { useToast } from '@/components/ui/toast/use-toast'
import { mockScheduleEndpoints } from '@/lib/trpc/mockScheduleEndpoints'

const props = defineProps({
  agentId: {
    type: String,
    required: true
  },
  projectId: {
    type: String,
    required: true
  },
  orgId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['command-executed', 'task-created', 'tasks-updated'])

const { toast } = useToast()

// State
const command = ref('')
const isProcessing = ref(false)
const lastResult = ref(null)
const showExamples = ref(false)

// Example commands
const exampleCommands = [
  'schedule weekly team meeting every monday at 10am',
  'create blog post tomorrow at 2pm',
  'cancel tomorrow\'s deployment',
  'reschedule friday\'s review to next week',
  'show me next week\'s tasks',
  'move the SEO audit to thursday at 2pm',
  'schedule daily standup at 9:30am',
  'cancel all meetings tomorrow'
]

// Process natural language command
const processCommand = async () => {
  if (!command.value.trim()) return
  
  isProcessing.value = true
  lastResult.value = null
  
  try {
    const result = await mockScheduleEndpoints.processNaturalCommand({
      input: {
        command: command.value,
        context: {
          agentId: props.agentId,
          projectId: props.projectId,
          orgId: props.orgId
        }
      }
    })
    
    lastResult.value = result
    
    // Show success message
    toast({
      title: getActionTitle(result.action),
      description: result.message,
      variant: result.action === 'unknown' ? 'destructive' : 'default'
    })
    
    // Emit events based on action
    if (result.action === 'created' && result.task) {
      emit('task-created', result.task)
    } else if (result.action !== 'unknown') {
      emit('tasks-updated')
    }
    
    emit('command-executed', result)
    
    // Clear command on success (except for unknown commands)
    if (result.action !== 'unknown') {
      command.value = ''
    }
    
  } catch (error) {
    console.error('Error processing command:', error)
    toast({
      title: 'Error',
      description: 'Failed to process command. Please try again.',
      variant: 'destructive'
    })
  } finally {
    isProcessing.value = false
  }
}

// Get action title for toast
const getActionTitle = (action) => {
  switch (action) {
    case 'created': return 'Task Created'
    case 'cancelled': return 'Tasks Cancelled'
    case 'rescheduled': return 'Task Rescheduled'
    case 'list': return 'Tasks Found'
    case 'unknown': return 'Command Not Understood'
    default: return 'Command Processed'
  }
}

// Use example command
const useExample = (example) => {
  command.value = example
  showExamples.value = false
}

// Command input placeholder
const placeholder = computed(() => {
  if (isProcessing.value) return 'Processing...'
  return 'Type a command like "schedule meeting tomorrow at 2pm"'
})
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Bot class="h-5 w-5" />
        AI Task Scheduler
      </CardTitle>
      <CardDescription>
        Use natural language to create and manage tasks. The agent will understand your intent and schedule accordingly.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- Command Input -->
      <div class="flex gap-2">
        <div class="relative flex-1">
          <Input
            v-model="command"
            :placeholder="placeholder"
            :disabled="isProcessing"
            @keyup.enter="processCommand"
            class="pr-10"
          />
          <Wand2 class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        <Button 
          @click="processCommand" 
          :disabled="!command.trim() || isProcessing"
        >
          <Loader2 v-if="isProcessing" class="h-4 w-4 mr-2 animate-spin" />
          <Send v-else class="h-4 w-4 mr-2" />
          {{ isProcessing ? 'Processing' : 'Send' }}
        </Button>
      </div>
      
      <!-- Examples Toggle -->
      <div class="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          @click="showExamples = !showExamples"
          class="text-xs"
        >
          <Sparkles class="h-3 w-3 mr-1" />
          {{ showExamples ? 'Hide' : 'Show' }} examples
        </Button>
        
        <!-- Last Result Status -->
        <div v-if="lastResult" class="flex items-center gap-2 text-sm">
          <component 
            :is="lastResult.action === 'unknown' ? AlertCircle : CheckCircle"
            :class="[
              'h-4 w-4',
              lastResult.action === 'unknown' ? 'text-destructive' : 'text-green-600'
            ]"
          />
          <span class="text-muted-foreground">{{ lastResult.message }}</span>
        </div>
      </div>
      
      <!-- Example Commands -->
      <div v-if="showExamples" class="space-y-2">
        <p class="text-sm text-muted-foreground mb-2">Click an example to use it:</p>
        <div class="grid gap-2">
          <Button
            v-for="example in exampleCommands"
            :key="example"
            variant="outline"
            size="sm"
            class="justify-start text-xs"
            @click="useExample(example)"
          >
            <Calendar class="h-3 w-3 mr-2 flex-shrink-0" />
            {{ example }}
          </Button>
        </div>
      </div>
      
      <!-- Command Syntax Help -->
      <div class="border-t pt-4">
        <h4 class="text-sm font-medium mb-2">Supported Commands:</h4>
        <div class="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div class="space-y-1">
            <p>• <strong>Schedule:</strong> "schedule [task] [when]"</p>
            <p>• <strong>Cancel:</strong> "cancel [task/time]"</p>
            <p>• <strong>Reschedule:</strong> "move [task] to [when]"</p>
          </div>
          <div class="space-y-1">
            <p>• <strong>List:</strong> "show [time period] tasks"</p>
            <p>• <strong>Recurring:</strong> "every [frequency] at [time]"</p>
            <p>• <strong>Time:</strong> tomorrow, next week, monday, 2pm</p>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>