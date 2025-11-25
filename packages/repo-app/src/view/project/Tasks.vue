<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeadingBar from "@/components/PageHeadingBar.vue";
import TaskCalendar from "@/components/project/TaskCalendar.vue";
import TaskCommandBar from "@/components/project/TaskCommandBar.vue";
import { useToast } from "@/components/ui/toast/use-toast";
import { generateICal, downloadICal } from "@/lib/ical";
import { mockScheduleEndpoints } from "@/lib/trpc/mockScheduleEndpoints";
import trpc from "@/trpc";
import {
  Calendar,
  Clock,
  CheckCircle,
  Circle,
  Play,
  Pause,
  RotateCw,
  FileText,
  Plus,
  Edit,
  Trash2,
  CalendarDays,
  Timer,
  Repeat,
  AlertCircle,
  ChevronRight,
  Filter,
  Settings,
  Download,
  Upload,
  Bot,
} from "lucide-vue-next";

// Props for project data passed from parent
const props = defineProps({
  project: {
    type: Object,
    default: null,
  },
});

// Route and router
const route = useRoute();
const router = useRouter();
const { toast } = useToast();

// Reactive state
const activeTab = ref("calendar");
const selectedTask = ref(null);
const tasks = ref([]);
const loading = ref(false);

// Get org and project IDs from route
const orgId = computed(() => route.params.orgId);
const projectId = computed(() => route.params.projectId);

// Filter tasks by type
const upcomingTasks = computed(() => 
  tasks.value.filter(task => 
    task.type === 'manual' && 
    task.status !== 'completed' &&
    task.scheduledAt
  ).sort((a, b) => 
    new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  )
);

const recurringTasks = computed(() => 
  tasks.value.filter(task => task.type === 'recurring')
);

const triggerTasks = computed(() => 
  tasks.value.filter(task => task.type === 'trigger')
);

const completedTasks = computed(() => 
  tasks.value.filter(task => task.status === 'completed')
    .sort((a, b) => 
      new Date(b.completedAt || b.updatedAt).getTime() - 
      new Date(a.completedAt || a.updatedAt).getTime()
    )
);

// Calendar tasks (all scheduled tasks)
const calendarTasks = computed(() => 
  tasks.value.filter(task => task.scheduledAt)
);

// Active agent ID (for now, hardcoded)
const activeAgentId = computed(() => 'content-agent');

// OLD Mock data for scheduled tasks - TO BE REMOVED
const OLD_upcomingTasks = ref([
  {
    id: "task_1",
    title: "Post Christmas offer",
    description: "Create and publish a blog post about our special Christmas promotions and discounts",
    scheduledFor: new Date("2024-11-22T10:00:00"),
    type: "one-time",
    status: "pending",
    tags: ["marketing", "seasonal"],
    estimatedTime: "30 minutes",
  },
  {
    id: "task_2",
    title: "Update product documentation",
    description: "Review and update the API documentation with the latest endpoint changes",
    scheduledFor: new Date("2024-11-25T14:00:00"),
    type: "one-time",
    status: "pending",
    tags: ["documentation", "technical"],
    estimatedTime: "2 hours",
  },
  {
    id: "task_3",
    title: "Write Black Friday announcement",
    description: "Draft and schedule social media posts for Black Friday sales campaign",
    scheduledFor: new Date("2024-11-28T09:00:00"),
    type: "one-time",
    status: "pending",
    tags: ["marketing", "social-media"],
    estimatedTime: "1 hour",
  },
  {
    id: "task_4",
    title: "Publish year-end review",
    description: "Write a comprehensive blog post reviewing the year's achievements and milestones",
    scheduledFor: new Date("2024-12-20T11:00:00"),
    type: "one-time",
    status: "pending",
    tags: ["content", "annual"],
    estimatedTime: "3 hours",
  },
]);

// OLD Mock data for recurring tasks - TO BE REMOVED
const OLD_recurringTasks = ref([
  {
    id: "recur_1",
    title: "Plan weekly content roadmap",
    description: "Plan the posts roadmap based on customer feedback and analytics data",
    schedule: "weekly",
    dayOfWeek: "Monday",
    time: "09:00",
    status: "active",
    lastRun: new Date("2024-11-18T09:00:00"),
    nextRun: new Date("2024-11-25T09:00:00"),
    tags: ["planning", "content"],
  },
  {
    id: "recur_2",
    title: "Write daily blog post",
    description: "Create and publish a new blog post on trending topics in our industry",
    schedule: "daily",
    time: "10:00",
    status: "active",
    lastRun: new Date("2024-11-20T10:00:00"),
    nextRun: new Date("2024-11-21T10:00:00"),
    tags: ["content", "daily"],
  },
  {
    id: "recur_3",
    title: "Weekly newsletter",
    description: "Compile and send weekly newsletter with top posts and updates",
    schedule: "weekly",
    dayOfWeek: "Friday",
    time: "15:00",
    status: "active",
    lastRun: new Date("2024-11-15T15:00:00"),
    nextRun: new Date("2024-11-22T15:00:00"),
    tags: ["email", "marketing"],
  },
  {
    id: "recur_4",
    title: "Monthly analytics report",
    description: "Generate comprehensive analytics report and insights for content performance",
    schedule: "monthly",
    dayOfMonth: 1,
    time: "08:00",
    status: "active",
    lastRun: new Date("2024-11-01T08:00:00"),
    nextRun: new Date("2024-12-01T08:00:00"),
    tags: ["analytics", "reporting"],
  },
]);

// OLD Mock data for completed tasks - TO BE REMOVED
const OLD_completedTasks = ref([
  {
    id: "comp_1",
    title: "Launch announcement post",
    description: "Published announcement for new Editor Agent feature",
    scheduledFor: new Date("2024-11-15T11:00:00"),
    completedAt: new Date("2024-11-15T11:05:00"),
    type: "automated",
    result: {
      status: "success",
      postId: "post_xyz123",
      url: "/posts/editor-agent-launch",
      metrics: {
        views: 1250,
        engagement: "high",
      }
    },
    tags: ["announcement", "product"],
  },
  {
    id: "comp_2",
    title: "Weekly content roadmap",
    description: "Generated content plan for week 47",
    scheduledFor: new Date("2024-11-18T09:00:00"),
    completedAt: new Date("2024-11-18T09:12:00"),
    type: "automated",
    result: {
      status: "success",
      tasksCreated: 5,
      topicsIdentified: ["AI tools", "productivity", "tutorials"],
    },
    tags: ["planning", "automated"],
  },
  {
    id: "comp_3",
    title: "Daily blog post",
    description: "Created post: '10 Tips for Better Content Creation'",
    scheduledFor: new Date("2024-11-19T10:00:00"),
    completedAt: new Date("2024-11-19T10:08:00"),
    type: "automated",
    result: {
      status: "success",
      postId: "post_abc456",
      wordCount: 1500,
      seoScore: 92,
    },
    tags: ["content", "daily"],
  },
]);

// Format date for display
const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Format time for display
const formatTime = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Format relative time
const getRelativeTime = (date) => {
  const now = new Date();
  const diff = date - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `in ${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
  if (diff > 0) return "in less than an hour";
  return "overdue";
};

// Get status badge variant
const getStatusVariant = (status) => {
  switch (status) {
    case "active":
    case "success":
      return "default";
    case "pending":
      return "secondary";
    case "paused":
      return "outline";
    case "failed":
      return "destructive";
    default:
      return "secondary";
  }
};

// Get schedule frequency label
const getScheduleLabel = (task) => {
  if (!task.recurrence) return 'One-time';
  
  const rec = task.recurrence;
  switch (rec.pattern) {
    case "daily":
      return `Daily${rec.interval > 1 ? ` every ${rec.interval} days` : ''} at ${rec.time || 'scheduled time'}`;
    case "weekly":
      if (rec.daysOfWeek && rec.daysOfWeek.length > 0) {
        const days = rec.daysOfWeek.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');
        return `Every ${days} at ${rec.time || 'scheduled time'}`;
      }
      return `Weekly${rec.interval > 1 ? ` every ${rec.interval} weeks` : ''}`;
    case "monthly":
      return `Monthly on day ${rec.dayOfMonth || '1'} at ${rec.time || 'scheduled time'}`;
    case "custom":
      return rec.rrule || 'Custom schedule';
    default:
      return rec.pattern;
  }
};

// Format trigger configuration
const formatTriggerConfig = (trigger) => {
  if (!trigger) return 'No trigger';
  
  switch (trigger.type) {
    case 'webhook':
      return `Webhook: ${trigger.config.event || 'unknown event'}`;
    case 'event':
      return `Event: ${trigger.config.name || 'unknown'}`;
    case 'condition':
      return `When ${trigger.config.condition || 'condition met'}`;
    default:
      return trigger.type;
  }
};

// Handle task actions
const runTaskNow = async (task) => {
  try {
    await mockScheduleEndpoints.executeTask({
      input: { taskId: task._id }
    });
    
    toast({
      title: "Running Task",
      description: `"${task.title}" is being executed...`,
    });
    
    // Reload tasks after a delay to show status change
    setTimeout(loadTasks, 2000);
  } catch (error) {
    toast({
      title: "Error",
      description: "Failed to execute task",
      variant: "destructive"
    });
  }
};

const editTask = (task) => {
  selectedTask.value = task;
  toast({
    title: "Edit Mode",
    description: "Task editing UI would open here",
  });
};

const deleteTask = async (task) => {
  try {
    await mockScheduleEndpoints.cancelTask({
      input: { 
        taskId: task._id,
        reason: 'User deleted task'
      }
    });
    
    toast({
      title: "Task Deleted",
      description: `Task "${task.title}" has been deleted`,
    });
    
    loadTasks();
  } catch (error) {
    toast({
      title: "Error",
      description: "Failed to delete task",
      variant: "destructive"
    });
  }
};

const toggleRecurringTask = async (task) => {
  try {
    const newStatus = task.status === "scheduled" ? "cancelled" : "scheduled";
    await mockScheduleEndpoints.updateTask({
      input: {
        taskId: task._id,
        updates: { status: newStatus }
      }
    });
    
    task.status = newStatus;
    toast({
      title: task.status === "scheduled" ? "Task Activated" : "Task Paused",
      description: `"${task.title}" is now ${task.status}`,
    });
  } catch (error) {
    toast({
      title: "Error",
      description: "Failed to update task status",
      variant: "destructive"
    });
  }
};

// Load tasks from API
const loadTasks = async () => {
  loading.value = true;
  try {
    // Using mock endpoints for now
    const result = await mockScheduleEndpoints.getUpcomingTasks({
      input: {
        orgId: orgId.value,
        projectId: projectId.value
      }
    });
    tasks.value = result.tasks;
  } catch (error) {
    console.error('Error loading tasks:', error);
    toast({
      title: "Error",
      description: "Failed to load tasks",
      variant: "destructive"
    });
  } finally {
    loading.value = false;
  }
};

// Handle calendar task click
const handleTaskClick = (task) => {
  selectedTask.value = task;
  // Switch to appropriate tab
  if (task.status === 'completed') {
    activeTab.value = 'history';
  } else if (task.type === 'recurring') {
    activeTab.value = 'recurring';
  } else {
    activeTab.value = 'upcoming';
  }
};

// Handle calendar date click
const handleDateClick = (date) => {
  // Could open a dialog to create a new task for this date
  console.log('Date clicked:', date);
};

// Export tasks to iCal
const exportToICal = async () => {
  try {
    // Get calendar feed from API
    const feed = await mockScheduleEndpoints.generateCalendarFeed({
      input: {
        type: 'project',
        id: projectId.value,
        format: 'ical'
      }
    });
    
    // Download the feed
    const blob = new Blob([feed], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks-${projectId.value}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    toast({
      title: "Export Successful",
      description: "Tasks exported to iCal file"
    });
  } catch (error) {
    toast({
      title: "Export Failed",
      description: "Failed to export tasks",
      variant: "destructive"
    });
  }
};

// Handle command execution result
const handleCommandExecuted = (result) => {
  console.log('Command executed:', result);
};

// Handle task creation
const handleTaskCreated = (task) => {
  // Switch to appropriate tab to show the new task
  if (task.type === 'recurring') {
    activeTab.value = 'recurring';
  } else if (task.type === 'trigger') {
    activeTab.value = 'recurring'; // Trigger tasks are shown in recurring tab
  } else {
    activeTab.value = 'upcoming';
  }
};

// Initialize on mount
onMounted(() => {
  loadTasks();
});
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Page Header -->
    <PageHeadingBar 
      title="Tasks"
      subtitle="Manage automated content tasks and publishing schedule"
      :pad="false"
    >
      <template #actions>
        <div class="flex gap-2">
          <Button variant="outline">
            <Upload class="w-4 h-4 mr-2" />
            Import Schedule
          </Button>
          <Button variant="outline">
            <Download class="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button>
            <Plus class="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>
      </template>
    </PageHeadingBar>

    <div class="container mx-auto p-6">
      <!-- Natural Language Command Bar -->
      <TaskCommandBar
        :agent-id="activeAgentId"
        :project-id="projectId"
        :org-id="orgId"
        @command-executed="handleCommandExecuted"
        @task-created="handleTaskCreated"
        @tasks-updated="loadTasks"
        class="mb-6"
      />

      <!-- Tabs -->
      <Tabs v-model="activeTab" class="space-y-4">
        <TabsList class="grid w-full grid-cols-4">
          <TabsTrigger value="calendar">
            <CalendarDays class="w-4 h-4 mr-2" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            <Calendar class="w-4 h-4 mr-2" />
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="recurring">
            <Repeat class="w-4 h-4 mr-2" />
            Recurring
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock class="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <!-- Calendar Tab -->
        <TabsContent value="calendar" class="mt-4">
          <TaskCalendar
            :tasks="calendarTasks"
            @task-click="handleTaskClick"
            @date-click="handleDateClick"
            @export-ical="exportToICal"
          />
        </TabsContent>

        <!-- Upcoming Tasks Tab -->
        <TabsContent value="upcoming" class="space-y-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium">One-time Scheduled Tasks</h3>
            <Button variant="outline" size="sm">
              <Filter class="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>

          <div class="space-y-3">
            <Card v-for="task in upcomingTasks" :key="task.id" class="hover:shadow-md transition-shadow">
              <CardContent class="p-4">
                <div class="flex items-start justify-between">
                  <div class="space-y-2 flex-1">
                    <div class="flex items-start gap-3">
                      <Circle class="w-5 h-5 text-gray-400 mt-0.5" />
                      <div class="flex-1">
                        <h4 class="font-medium">{{ task.title }}</h4>
                        <p class="text-sm text-gray-600 mt-1">{{ task.description }}</p>
                        
                        <div class="flex items-center gap-4 mt-3 text-sm">
                          <div class="flex items-center gap-1">
                            <CalendarDays class="w-4 h-4 text-gray-400" />
                            <span>{{ formatDate(task.scheduledFor) }}</span>
                          </div>
                          <div class="flex items-center gap-1">
                            <Clock class="w-4 h-4 text-gray-400" />
                            <span>{{ formatTime(task.scheduledFor) }}</span>
                          </div>
                          <Badge variant="secondary">
                            {{ getRelativeTime(task.scheduledFor) }}
                          </Badge>
                          <div class="flex items-center gap-1 text-gray-500">
                            <Timer class="w-4 h-4" />
                            <span>{{ task.estimatedTime }}</span>
                          </div>
                        </div>

                        <div class="flex gap-2 mt-3">
                          <Badge v-for="tag in task.tags" :key="tag" variant="outline" class="text-xs">
                            {{ tag }}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="flex gap-2 ml-4">
                    <Button size="sm" variant="ghost" @click="runTaskNow(task)">
                      <Play class="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" @click="editTask(task)">
                      <Edit class="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" @click="deleteTask(task)">
                      <Trash2 class="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <!-- Recurring Tasks Tab -->
        <TabsContent value="recurring" class="space-y-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium">Automated Recurring Tasks</h3>
            <Button variant="outline" size="sm">
              <Settings class="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>

          <div class="space-y-3">
            <Card v-for="task in recurringTasks" :key="task._id" class="hover:shadow-md transition-shadow">
              <CardContent class="p-4">
                <div class="flex items-start justify-between">
                  <div class="space-y-2 flex-1">
                    <div class="flex items-start gap-3">
                      <Repeat class="w-5 h-5 text-blue-500 mt-0.5" />
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <h4 class="font-medium">{{ task.title }}</h4>
                          <Badge :variant="getStatusVariant(task.status)">
                            {{ task.status }}
                          </Badge>
                          <Badge v-if="task.agentId" variant="outline" class="text-xs">
                            {{ task.agentId }}
                          </Badge>
                        </div>
                        <p class="text-sm text-gray-600 mt-1">{{ task.description }}</p>
                        
                        <div class="flex items-center gap-4 mt-3 text-sm">
                          <div class="flex items-center gap-1">
                            <RotateCw class="w-4 h-4 text-gray-400" />
                            <span>{{ getScheduleLabel(task) }}</span>
                          </div>
                          <div class="text-gray-500" v-if="task.scheduledAt">
                            Next run: {{ formatDate(task.scheduledAt) }} at {{ formatTime(task.scheduledAt) }}
                          </div>
                        </div>

                        <div class="flex items-center gap-4 mt-2 text-sm text-gray-500" v-if="task.executedAt">
                          <span>Last run: {{ formatDate(task.executedAt) }} at {{ formatTime(task.executedAt) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="flex gap-2 ml-4">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      @click="toggleRecurringTask(task)"
                      :title="task.status === 'scheduled' ? 'Pause task' : 'Resume task'"
                    >
                      <component :is="task.status === 'scheduled' ? Pause : Play" class="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" @click="runTaskNow(task)">
                      <RotateCw class="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" @click="editTask(task)">
                      <Edit class="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <!-- Trigger Tasks Section -->
          <div v-if="triggerTasks.length > 0" class="mt-8">
            <h3 class="text-lg font-medium mb-4">Event-Triggered Tasks</h3>
            <div class="space-y-3">
              <Card v-for="task in triggerTasks" :key="task._id" class="hover:shadow-md transition-shadow">
                <CardContent class="p-4">
                  <div class="flex items-start justify-between">
                    <div class="space-y-2 flex-1">
                      <div class="flex items-start gap-3">
                        <AlertCircle class="w-5 h-5 text-purple-500 mt-0.5" />
                        <div class="flex-1">
                          <div class="flex items-center gap-2">
                            <h4 class="font-medium">{{ task.title }}</h4>
                            <Badge variant="secondary">{{ task.trigger?.type }}</Badge>
                            <Badge v-if="task.agentId" variant="outline" class="text-xs">
                              {{ task.agentId }}
                            </Badge>
                          </div>
                          <p class="text-sm text-gray-600 mt-1">{{ task.description }}</p>
                          
                          <div class="flex items-center gap-4 mt-3 text-sm text-gray-500">
                            <span>Trigger: {{ formatTriggerConfig(task.trigger) }}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="flex gap-2 ml-4">
                      <Button size="sm" variant="ghost" @click="editTask(task)">
                        <Edit class="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" @click="deleteTask(task)">
                        <Trash2 class="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <!-- OLD Recurring Tasks Tab - TO BE REMOVED -->
        <TabsContent value="recurring-old" class="space-y-4 hidden">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium">Automated Recurring Tasks</h3>
            <Button variant="outline" size="sm">
              <Settings class="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>

          <div class="space-y-3">
            <Card v-for="task in recurringTasks" :key="task.id" class="hover:shadow-md transition-shadow">
              <CardContent class="p-4">
                <div class="flex items-start justify-between">
                  <div class="space-y-2 flex-1">
                    <div class="flex items-start gap-3">
                      <Repeat class="w-5 h-5 text-blue-500 mt-0.5" />
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <h4 class="font-medium">{{ task.title }}</h4>
                          <Badge :variant="getStatusVariant(task.status)">
                            {{ task.status }}
                          </Badge>
                          <Badge v-if="task.agentId" variant="outline" class="text-xs">
                            {{ task.agentId }}
                          </Badge>
                        </div>
                        <p class="text-sm text-gray-600 mt-1">{{ task.description }}</p>
                        
                        <div class="flex items-center gap-4 mt-3 text-sm">
                          <div class="flex items-center gap-1">
                            <RotateCw class="w-4 h-4 text-gray-400" />
                            <span>{{ getScheduleLabel(task) }}</span>
                          </div>
                          <div class="text-gray-500">
                            Next run: {{ formatDate(task.nextRun) }} at {{ formatTime(task.nextRun) }}
                          </div>
                        </div>

                        <div class="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span>Last run: {{ formatDate(task.lastRun) }} at {{ formatTime(task.lastRun) }}</span>
                        </div>

                        <div class="flex gap-2 mt-3">
                          <Badge v-for="tag in task.tags" :key="tag" variant="outline" class="text-xs">
                            {{ tag }}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="flex gap-2 ml-4">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      @click="toggleRecurringTask(task)"
                      :title="task.status === 'active' ? 'Pause task' : 'Resume task'"
                    >
                      <component :is="task.status === 'active' ? Pause : Play" class="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" @click="runTaskNow(task)">
                      <RotateCw class="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" @click="editTask(task)">
                      <Edit class="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <!-- History Tab -->
        <TabsContent value="history" class="space-y-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium">Completed Tasks</h3>
            <div class="flex gap-2">
              <Button variant="outline" size="sm">
                <CalendarDays class="w-4 h-4 mr-2" />
                Date Range
              </Button>
              <Button variant="outline" size="sm">
                <Filter class="w-4 h-4 mr-2" />
                Filter
              </Button>
            </div>
          </div>

          <div class="space-y-3">
            <Card v-for="task in completedTasks" :key="task.id" class="hover:shadow-md transition-shadow">
              <CardContent class="p-4">
                <div class="flex items-start justify-between">
                  <div class="space-y-2 flex-1">
                    <div class="flex items-start gap-3">
                      <CheckCircle class="w-5 h-5 text-green-500 mt-0.5" />
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <h4 class="font-medium">{{ task.title }}</h4>
                          <Badge variant="outline" class="text-xs">
                            {{ task.type }}
                          </Badge>
                        </div>
                        <p class="text-sm text-gray-600 mt-1">{{ task.description }}</p>
                        
                        <div class="flex items-center gap-4 mt-3 text-sm text-gray-500">
                          <span>Scheduled: {{ formatDate(task.scheduledFor) }}</span>
                          <span>Completed: {{ formatDate(task.completedAt) }} at {{ formatTime(task.completedAt) }}</span>
                        </div>

                        <!-- Result Details -->
                        <div v-if="task.result" class="mt-3 p-3 bg-gray-50 rounded-lg">
                          <div class="flex items-center gap-2 text-sm">
                            <Badge :variant="task.result.status === 'success' ? 'default' : 'destructive'" class="text-xs">
                              {{ task.result.status }}
                            </Badge>
                            
                            <div v-if="task.result.postId" class="flex items-center gap-1">
                              <FileText class="w-4 h-4 text-gray-400" />
                              <a :href="task.result.url" class="text-blue-600 hover:underline">
                                View Post
                              </a>
                            </div>

                            <div v-if="task.result.metrics" class="flex items-center gap-3">
                              <span class="text-gray-600">Views: {{ task.result.metrics.views }}</span>
                              <span class="text-gray-600">Engagement: {{ task.result.metrics.engagement }}</span>
                            </div>

                            <div v-if="task.result.tasksCreated" class="text-gray-600">
                              Created {{ task.result.tasksCreated }} tasks
                            </div>
                          </div>

                          <div v-if="task.result.topicsIdentified" class="mt-2">
                            <span class="text-xs text-gray-500">Topics: </span>
                            <span class="text-xs text-gray-700">{{ task.result.topicsIdentified.join(', ') }}</span>
                          </div>
                        </div>

                        <div class="flex gap-2 mt-3">
                          <Badge v-for="tag in task.tags" :key="tag" variant="outline" class="text-xs">
                            {{ tag }}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button size="sm" variant="ghost">
                    <ChevronRight class="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <!-- Quick Stats -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-gray-600">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">{{ tasks.length }}</div>
            <p class="text-xs text-gray-500 mt-1">{{ completedTasks.length }} completed, {{ upcomingTasks.length }} pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-gray-600">Active Recurring</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">{{ recurringTasks.filter(t => t.status === 'scheduled').length }}</div>
            <p class="text-xs text-gray-500 mt-1">{{ recurringTasks.filter(t => t.status === 'paused').length }} paused</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-gray-600">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">{{ tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0 }}%</div>
            <p class="text-xs text-gray-500 mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-gray-600">Next Task</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">{{ upcomingTasks.length > 0 ? getRelativeTime(upcomingTasks[0].scheduledAt) : 'None' }}</div>
            <p class="text-xs text-gray-500 mt-1">{{ upcomingTasks.length > 0 ? upcomingTasks[0].title : 'No upcoming tasks' }}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>