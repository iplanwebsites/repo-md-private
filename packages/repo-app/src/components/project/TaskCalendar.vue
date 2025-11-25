<script setup>
import { ref, computed, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Download,
  Plus,
  Filter,
  List,
  Grid3x3,
  Bot
} from 'lucide-vue-next'

const props = defineProps({
  tasks: {
    type: Array,
    default: () => []
  },
  view: {
    type: String,
    default: 'month' // month, week, day
  }
})

const emit = defineEmits(['task-click', 'date-click', 'view-change', 'export-ical'])

// Calendar state
const currentDate = ref(new Date())
const selectedDate = ref(null)
const calendarView = ref(props.view)
const showWeekends = ref(true)

// Get calendar days for current month
const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  
  // First day of the month
  const firstDay = new Date(year, month, 1)
  const startDate = new Date(firstDay)
  
  // Start from the previous Sunday
  startDate.setDate(startDate.getDate() - startDate.getDay())
  
  // Generate 6 weeks of days (42 days)
  const days = []
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    days.push(date)
  }
  
  return days
})

// Get tasks for a specific date
const getTasksForDate = (date) => {
  return props.tasks.filter(task => {
    if (!task.scheduledAt) return false
    
    const taskDate = new Date(task.scheduledAt)
    return taskDate.getFullYear() === date.getFullYear() &&
           taskDate.getMonth() === date.getMonth() &&
           taskDate.getDate() === date.getDate()
  })
}

// Format month/year for header
const currentMonthYear = computed(() => {
  return currentDate.value.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })
})

// Navigation
const previousMonth = () => {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() - 1)
  currentDate.value = newDate
}

const nextMonth = () => {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() + 1)
  currentDate.value = newDate
}

const goToToday = () => {
  currentDate.value = new Date()
  selectedDate.value = new Date()
}

// Check if date is today
const isToday = (date) => {
  const today = new Date()
  return date.getFullYear() === today.getFullYear() &&
         date.getMonth() === today.getMonth() &&
         date.getDate() === today.getDate()
}

// Check if date is in current month
const isCurrentMonth = (date) => {
  return date.getMonth() === currentDate.value.getMonth()
}

// Check if date is selected
const isSelected = (date) => {
  if (!selectedDate.value) return false
  return date.getFullYear() === selectedDate.value.getFullYear() &&
         date.getMonth() === selectedDate.value.getMonth() &&
         date.getDate() === selectedDate.value.getDate()
}

// Get task status color
const getTaskColor = (task) => {
  switch (task.status) {
    case 'completed': return 'bg-green-500'
    case 'running': return 'bg-blue-500'
    case 'failed': return 'bg-red-500'
    case 'scheduled': return 'bg-purple-500'
    case 'cancelled': return 'bg-gray-500'
    default: return 'bg-gray-400'
  }
}

// Get task type icon
const getTaskTypeIcon = (task) => {
  if (task.type === 'recurring') return '🔁'
  if (task.type === 'trigger') return '⚡'
  return ''
}

// Handle date click
const handleDateClick = (date) => {
  selectedDate.value = date
  emit('date-click', date)
}

// Handle task click
const handleTaskClick = (task, event) => {
  event.stopPropagation()
  emit('task-click', task)
}

// Change calendar view
const changeView = (view) => {
  calendarView.value = view
  emit('view-change', view)
}

// Export to iCal
const exportToICal = () => {
  emit('export-ical')
}

// Week view helpers
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Get week dates for week view
const currentWeekDates = computed(() => {
  const startOfWeek = new Date(currentDate.value)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  
  const dates = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek)
    date.setDate(startOfWeek.getDate() + i)
    dates.push(date)
  }
  return dates
})

// Format date for display
const formatDate = (date) => {
  return date.getDate()
}

// Format time
const formatTime = (date) => {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

// Format recurrence
const formatRecurrence = (recurrence) => {
  if (!recurrence) return ''
  
  switch (recurrence.pattern) {
    case 'daily':
      return `Daily${recurrence.interval > 1 ? ` every ${recurrence.interval} days` : ''}`
    case 'weekly':
      if (recurrence.daysOfWeek?.length > 0) {
        const days = recurrence.daysOfWeek.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')
        return `Weekly on ${days}`
      }
      return `Weekly${recurrence.interval > 1 ? ` every ${recurrence.interval} weeks` : ''}`
    case 'monthly':
      return `Monthly on day ${recurrence.dayOfMonth || '1'}`
    default:
      return recurrence.pattern
  }
}
</script>

<template>
  <Card class="p-6">
    <!-- Calendar Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <Button variant="outline" size="icon" @click="previousMonth">
            <ChevronLeft class="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" @click="nextMonth">
            <ChevronRight class="h-4 w-4" />
          </Button>
        </div>
        
        <h2 class="text-xl font-semibold">{{ currentMonthYear }}</h2>
        
        <Button variant="outline" size="sm" @click="goToToday">
          Today
        </Button>
      </div>
      
      <div class="flex items-center gap-2">
        <!-- View Switcher -->
        <div class="flex rounded-md shadow-sm">
          <Button
            :variant="calendarView === 'month' ? 'default' : 'outline'"
            size="sm"
            class="rounded-r-none"
            @click="changeView('month')"
          >
            <Grid3x3 class="h-4 w-4 mr-2" />
            Month
          </Button>
          <Button
            :variant="calendarView === 'week' ? 'default' : 'outline'"
            size="sm"
            class="rounded-none border-x-0"
            @click="changeView('week')"
          >
            <List class="h-4 w-4 mr-2" />
            Week
          </Button>
          <Button
            :variant="calendarView === 'day' ? 'default' : 'outline'"
            size="sm"
            class="rounded-l-none"
            @click="changeView('day')"
          >
            <CalendarIcon class="h-4 w-4 mr-2" />
            Day
          </Button>
        </div>
        
        <div class="border-l pl-2">
          <Button variant="outline" @click="exportToICal">
            <Download class="h-4 w-4 mr-2" />
            Export to iCal
          </Button>
        </div>
      </div>
    </div>
    
    <!-- Month View -->
    <div v-if="calendarView === 'month'" class="calendar-grid">
      <!-- Week day headers -->
      <div class="grid grid-cols-7 gap-px bg-gray-200 mb-px">
        <div
          v-for="day in weekDays"
          :key="day"
          class="bg-gray-50 py-2 text-center text-sm font-medium text-gray-700"
        >
          {{ day }}
        </div>
      </div>
      
      <!-- Calendar days -->
      <div class="grid grid-cols-7 gap-px bg-gray-200">
        <div
          v-for="(date, index) in calendarDays"
          :key="index"
          @click="handleDateClick(date)"
          :class="[
            'min-h-[100px] bg-white p-2 cursor-pointer hover:bg-gray-50 transition-colors',
            !isCurrentMonth(date) && 'text-gray-400 bg-gray-50',
            isToday(date) && 'bg-blue-50',
            isSelected(date) && 'ring-2 ring-blue-500'
          ]"
        >
          <div class="flex justify-between items-start mb-1">
            <span
              :class="[
                'text-sm font-medium',
                isToday(date) && 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center'
              ]"
            >
              {{ formatDate(date) }}
            </span>
            
            <div v-if="getTasksForDate(date).length > 0" class="text-xs text-gray-500">
              {{ getTasksForDate(date).length }}
            </div>
          </div>
          
          <!-- Task items -->
          <div class="space-y-1">
            <div
              v-for="(task, taskIndex) in getTasksForDate(date).slice(0, 3)"
              :key="task.id"
              @click="handleTaskClick(task, $event)"
              :class="[
                'text-xs p-1 rounded truncate cursor-pointer hover:opacity-80',
                getTaskColor(task),
                'text-white'
              ]"
            >
              <span v-if="getTaskTypeIcon(task)" class="mr-1">{{ getTaskTypeIcon(task) }}</span>
              {{ task.title }}
            </div>
            
            <!-- More tasks indicator -->
            <div
              v-if="getTasksForDate(date).length > 3"
              class="text-xs text-gray-500 text-center"
            >
              +{{ getTasksForDate(date).length - 3 }} more
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Week View -->
    <div v-else-if="calendarView === 'week'" class="space-y-4">
      <div class="grid grid-cols-8 gap-4">
        <!-- Time column -->
        <div class="text-sm text-gray-500">
          <div class="h-12"></div>
          <div v-for="hour in 24" :key="hour" class="h-16 py-2">
            {{ hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM` }}
          </div>
        </div>
        
        <!-- Days columns -->
        <div
          v-for="(date, index) in currentWeekDates"
          :key="index"
          class="border-l pl-2"
        >
          <div class="text-center mb-2">
            <div class="text-sm text-gray-500">{{ weekDays[index] }}</div>
            <div
              :class="[
                'text-lg font-medium',
                isToday(date) && 'bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto'
              ]"
            >
              {{ formatDate(date) }}
            </div>
          </div>
          
          <!-- Hour slots -->
          <div class="relative">
            <div v-for="hour in 24" :key="hour" class="h-16 border-t"></div>
            
            <!-- Tasks positioned by time -->
            <div
              v-for="task in getTasksForDate(date)"
              :key="task.id"
              @click="handleTaskClick(task, $event)"
              :class="[
                'absolute left-0 right-0 mx-1 p-2 rounded text-xs text-white cursor-pointer hover:opacity-90 overflow-hidden',
                getTaskColor(task)
              ]"
              :style="{
                top: `${(new Date(task.scheduledAt).getHours() + new Date(task.scheduledAt).getMinutes() / 60) * 64}px`,
                height: '60px'
              }"
            >
              <div class="font-medium truncate">{{ task.title }}</div>
              <div class="text-xs opacity-75">{{ formatTime(task.scheduledAt) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Day View -->
    <div v-else-if="calendarView === 'day'" class="space-y-4">
      <div class="text-center text-lg font-medium mb-4">
        {{ currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }}
      </div>
      
      <div class="space-y-2">
        <div
          v-for="task in getTasksForDate(currentDate).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))"
          :key="task.id"
          @click="handleTaskClick(task, $event)"
          class="flex items-start gap-4 p-4 bg-white border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
        >
          <div class="text-sm text-gray-500 min-w-[80px]">
            {{ formatTime(task.scheduledAt) }}
          </div>
          
          <div :class="['w-1 self-stretch rounded', getTaskColor(task)]"></div>
          
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="font-medium">{{ task.title }}</h3>
              <span v-if="getTaskTypeIcon(task)" class="text-sm">{{ getTaskTypeIcon(task) }}</span>
              <Badge v-if="task.agentId" variant="outline" class="text-xs">
                <Bot class="h-3 w-3 mr-1" />
                {{ task.agentId }}
              </Badge>
            </div>
            
            <p v-if="task.description" class="text-sm text-gray-600 mb-2">
              {{ task.description }}
            </p>
            
            <div v-if="task.recurrence" class="text-xs text-gray-500 mb-2">
              {{ formatRecurrence(task.recurrence) }}
            </div>
          </div>
          
          <Badge :variant="task.status === 'completed' ? 'default' : 'secondary'">
            {{ task.status }}
          </Badge>
        </div>
        
        <div v-if="getTasksForDate(currentDate).length === 0" class="text-center py-12 text-gray-500">
          No tasks scheduled for this day
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped>
.calendar-grid {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
}
</style>