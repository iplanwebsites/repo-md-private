import type { Task, TaskFilter, TaskStats, TaskExecution } from '@/types/task'

// Mock data store
let mockTasks: Task[] = []
let mockExecutions: TaskExecution[] = []

// Initialize with sample data
const initializeMockData = () => {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  
  mockTasks = [
    {
      id: 'task_1',
      orgId: 'org_123',
      projectId: 'proj_456',
      title: 'Generate weekly newsletter',
      description: 'Create and send weekly newsletter with top posts and updates',
      prompt: 'Write a newsletter summarizing this week\'s top content including {{topPosts}} and highlighting {{upcomingEvents}}',
      variables: {
        topPosts: ['post1', 'post2', 'post3'],
        upcomingEvents: ['Black Friday Sale', 'Holiday Content Series']
      },
      type: 'recurring',
      status: 'scheduled',
      priority: 'high',
      scheduledAt: tomorrow,
      recurrence: {
        pattern: 'weekly',
        daysOfWeek: [5], // Friday
        time: '15:00',
        timezone: 'America/New_York'
      },
      agentModel: 'gpt-4',
      agentTemperature: 0.7,
      tags: ['newsletter', 'marketing', 'automated'],
      createdAt: new Date('2024-01-01'),
      updatedAt: now,
      createdBy: 'user_123'
    },
    {
      id: 'task_2',
      orgId: 'org_123',
      projectId: 'proj_456',
      title: 'Post Christmas offer',
      description: 'Create and publish a blog post about special Christmas promotions',
      prompt: 'Write a festive blog post announcing our Christmas special offers: {{offers}}. Include gift ideas and holiday shopping tips.',
      variables: {
        offers: ['25% off all courses', 'Buy 2 get 1 free on templates', 'Free shipping on orders over $50']
      },
      type: 'one-time',
      status: 'pending',
      priority: 'urgent',
      scheduledAt: new Date('2024-12-20T10:00:00'),
      agentModel: 'gpt-4',
      agentTemperature: 0.8,
      tags: ['seasonal', 'marketing', 'promotional'],
      createdAt: new Date('2024-11-01'),
      updatedAt: now,
      createdBy: 'user_123'
    },
    {
      id: 'task_3',
      orgId: 'org_123',
      projectId: 'proj_456',
      title: 'Daily content curation',
      description: 'Find and create content based on trending topics',
      type: 'recurring',
      status: 'scheduled',
      priority: 'medium',
      scheduledAt: tomorrow,
      recurrence: {
        pattern: 'daily',
        time: '09:00',
        timezone: 'America/New_York'
      },
      agentModel: 'gpt-4',
      tags: ['content', 'daily', 'automated'],
      createdAt: new Date('2024-01-15'),
      updatedAt: now,
      createdBy: 'user_123'
    },
    {
      id: 'task_4',
      orgId: 'org_123',
      projectId: 'proj_456',
      parentTaskId: 'task_1',
      title: 'Generate newsletter header image',
      description: 'Create a visually appealing header image for the newsletter',
      prompt: 'Generate an image prompt for newsletter header with theme: {{theme}}',
      variables: {
        theme: 'Winter holidays and tech trends'
      },
      type: 'triggered',
      status: 'pending',
      priority: 'medium',
      agentModel: 'dall-e-3',
      tags: ['image', 'newsletter', 'design'],
      createdAt: new Date('2024-01-01'),
      updatedAt: now,
      createdBy: 'user_123'
    },
    {
      id: 'task_5',
      orgId: 'org_123',
      projectId: 'proj_456',
      title: 'Monthly analytics report',
      description: 'Generate comprehensive analytics report for content performance',
      type: 'recurring',
      status: 'completed',
      priority: 'high',
      scheduledAt: new Date('2024-11-01T08:00:00'),
      completedAt: new Date('2024-11-01T08:15:00'),
      duration: 900000, // 15 minutes
      recurrence: {
        pattern: 'monthly',
        dayOfMonth: 1,
        time: '08:00',
        timezone: 'America/New_York'
      },
      result: {
        status: 'success',
        output: {
          topPosts: 5,
          totalViews: 15000,
          engagement: 'high'
        },
        filesChanged: ['reports/november-2024.md'],
        tokensUsed: 2500,
        cost: 0.05
      },
      agentModel: 'gpt-4',
      tags: ['analytics', 'reporting', 'monthly'],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-11-01'),
      createdBy: 'user_123'
    }
  ]
  
  // Add some execution history
  mockExecutions = [
    {
      id: 'exec_1',
      taskId: 'task_5',
      status: 'completed',
      startedAt: new Date('2024-11-01T08:00:00'),
      completedAt: new Date('2024-11-01T08:15:00'),
      duration: 900000,
      output: {
        report: 'Monthly analytics generated successfully',
        metrics: { views: 15000, posts: 25 }
      },
      tokensUsed: 2500,
      cost: 0.05
    }
  ]
}

// Initialize data
initializeMockData()

// Mock tRPC endpoints
export const mockTaskEndpoints = {
  // List tasks with filtering
  list: async ({ input }: { input?: TaskFilter }) => {
    let filtered = [...mockTasks]
    
    if (input?.orgId) {
      filtered = filtered.filter(t => t.orgId === input.orgId)
    }
    if (input?.projectId) {
      filtered = filtered.filter(t => t.projectId === input.projectId)
    }
    if (input?.status && input.status.length > 0) {
      filtered = filtered.filter(t => input.status!.includes(t.status))
    }
    if (input?.type && input.type.length > 0) {
      filtered = filtered.filter(t => input.type!.includes(t.type))
    }
    if (input?.priority && input.priority.length > 0) {
      filtered = filtered.filter(t => t.priority && input.priority!.includes(t.priority))
    }
    if (input?.tags && input.tags.length > 0) {
      filtered = filtered.filter(t => 
        t.tags && t.tags.some(tag => input.tags!.includes(tag))
      )
    }
    if (input?.scheduledAfter) {
      filtered = filtered.filter(t => 
        t.scheduledAt && new Date(t.scheduledAt) >= input.scheduledAfter!
      )
    }
    if (input?.scheduledBefore) {
      filtered = filtered.filter(t => 
        t.scheduledAt && new Date(t.scheduledAt) <= input.scheduledBefore!
      )
    }
    if (input?.search) {
      const search = input.search.toLowerCase()
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search)
      )
    }
    
    return filtered
  },
  
  // Get a single task
  get: async ({ input }: { input: { taskId: string } }) => {
    const task = mockTasks.find(t => t.id === input.taskId)
    if (!task) throw new Error('Task not found')
    return task
  },
  
  // Create a new task
  create: async ({ input }: { input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> }) => {
    const newTask: Task = {
      ...input,
      id: `task_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    mockTasks.push(newTask)
    return newTask
  },
  
  // Update a task
  update: async ({ input }: { input: { taskId: string; data: Partial<Task> } }) => {
    const index = mockTasks.findIndex(t => t.id === input.taskId)
    if (index === -1) throw new Error('Task not found')
    
    mockTasks[index] = {
      ...mockTasks[index],
      ...input.data,
      updatedAt: new Date()
    }
    return mockTasks[index]
  },
  
  // Delete a task
  delete: async ({ input }: { input: { taskId: string } }) => {
    const index = mockTasks.findIndex(t => t.id === input.taskId)
    if (index === -1) throw new Error('Task not found')
    
    mockTasks.splice(index, 1)
    return { success: true }
  },
  
  // Execute a task immediately
  execute: async ({ input }: { input: { taskId: string } }) => {
    const task = mockTasks.find(t => t.id === input.taskId)
    if (!task) throw new Error('Task not found')
    
    // Update task status
    task.status = 'in_progress'
    task.startedAt = new Date()
    
    // Create execution record
    const execution: TaskExecution = {
      id: `exec_${Date.now()}`,
      taskId: task.id,
      status: 'running',
      startedAt: new Date()
    }
    mockExecutions.push(execution)
    
    // Simulate async execution
    setTimeout(() => {
      execution.status = 'completed'
      execution.completedAt = new Date()
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime()
      execution.output = { message: 'Task completed successfully' }
      execution.tokensUsed = Math.floor(Math.random() * 5000)
      execution.cost = execution.tokensUsed * 0.00002
      
      task.status = 'completed'
      task.completedAt = execution.completedAt
      task.duration = execution.duration
      task.result = {
        status: 'success',
        output: execution.output,
        tokensUsed: execution.tokensUsed,
        cost: execution.cost
      }
    }, 3000)
    
    return execution
  },
  
  // Get task statistics
  stats: async ({ input }: { input: TaskFilter }) => {
    const tasks = await mockTaskEndpoints.list({ input })
    
    const stats: TaskStats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      scheduled: tasks.filter(t => t.status === 'scheduled').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      successRate: tasks.length > 0
        ? (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100
        : 0,
      avgDuration: tasks
        .filter(t => t.duration)
        .reduce((sum, t) => sum + t.duration!, 0) / tasks.filter(t => t.duration).length || 0,
      tokensUsed: tasks
        .filter(t => t.result?.tokensUsed)
        .reduce((sum, t) => sum + t.result!.tokensUsed!, 0),
      totalCost: tasks
        .filter(t => t.result?.cost)
        .reduce((sum, t) => sum + t.result!.cost!, 0)
    }
    
    return stats
  },
  
  // Get execution history for a task
  executions: async ({ input }: { input: { taskId: string } }) => {
    return mockExecutions.filter(e => e.taskId === input.taskId)
  },
  
  // Get tasks for calendar view
  calendar: async ({ input }: { input: { start: Date; end: Date; orgId?: string; projectId?: string } }) => {
    const tasks = await mockTaskEndpoints.list({
      input: {
        orgId: input.orgId,
        projectId: input.projectId,
        scheduledAfter: input.start,
        scheduledBefore: input.end
      }
    })
    
    // Expand recurring tasks into individual occurrences
    const expandedTasks: Task[] = []
    
    tasks.forEach(task => {
      if (task.recurrence && task.scheduledAt) {
        // Generate occurrences for recurring tasks
        const occurrences = generateOccurrences(task, input.start, input.end)
        expandedTasks.push(...occurrences)
      } else if (task.scheduledAt) {
        // Add one-time tasks
        expandedTasks.push(task)
      }
    })
    
    return expandedTasks
  }
}

// Helper function to generate occurrences for recurring tasks
function generateOccurrences(task: Task, start: Date, end: Date): Task[] {
  const occurrences: Task[] = []
  const recurrence = task.recurrence!
  
  let currentDate = new Date(task.scheduledAt!)
  let occurrenceCount = 0
  
  while (currentDate <= end && (!recurrence.endDate || currentDate <= recurrence.endDate)) {
    if (currentDate >= start) {
      // Create a task occurrence
      occurrences.push({
        ...task,
        id: `${task.id}_occ_${occurrenceCount}`,
        scheduledAt: new Date(currentDate)
      })
    }
    
    // Calculate next occurrence
    switch (recurrence.pattern) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + (recurrence.interval || 1))
        break
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7 * (recurrence.interval || 1))
        break
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + (recurrence.interval || 1))
        break
    }
    
    occurrenceCount++
    
    // Check occurrence limit
    if (recurrence.occurrences && occurrenceCount >= recurrence.occurrences) {
      break
    }
  }
  
  return occurrences
}