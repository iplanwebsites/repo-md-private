import type { ScheduledTask, TaskFilter, NaturalLanguageCommand, CalendarFeedOptions } from '@/types/scheduledTask'

// Mock data store
let mockTasks: ScheduledTask[] = []
let taskIdCounter = 1

// Initialize with sample data
const initializeMockData = () => {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  
  mockTasks = [
    {
      _id: `task_${taskIdCounter++}`,
      agentId: 'content-agent',
      projectId: 'proj_456',
      orgId: 'org_123',
      title: 'Generate weekly newsletter',
      description: 'Create and send weekly newsletter with top posts and updates',
      type: 'recurring',
      status: 'scheduled',
      scheduledAt: tomorrow,
      payload: {
        template: 'weekly-newsletter',
        includeTopPosts: true,
        recipientGroups: ['subscribers', 'premium']
      },
      recurrence: {
        pattern: 'weekly',
        daysOfWeek: [5], // Friday
        time: '15:00',
        timezone: 'America/New_York'
      },
      createdAt: new Date('2024-01-01'),
      updatedAt: now,
      createdBy: 'user_123'
    },
    {
      _id: `task_${taskIdCounter++}`,
      agentId: 'marketing-agent',
      projectId: 'proj_456',
      orgId: 'org_123',
      title: 'Post Christmas offer',
      description: 'Create and publish a blog post about special Christmas promotions',
      type: 'manual',
      status: 'scheduled',
      scheduledAt: new Date('2024-12-20T10:00:00'),
      payload: {
        postType: 'promotional',
        offers: ['25% off all courses', 'Buy 2 get 1 free on templates'],
        targetAudience: 'holiday-shoppers'
      },
      createdAt: new Date('2024-11-01'),
      updatedAt: now,
      createdBy: 'user_123'
    },
    {
      _id: `task_${taskIdCounter++}`,
      agentId: 'analytics-agent',
      projectId: 'proj_456',
      orgId: 'org_123',
      title: 'Daily analytics report',
      description: 'Generate daily analytics and insights',
      type: 'recurring',
      status: 'scheduled',
      scheduledAt: tomorrow,
      recurrence: {
        pattern: 'daily',
        time: '09:00',
        timezone: 'America/New_York'
      },
      payload: {
        metrics: ['pageviews', 'engagement', 'conversions'],
        format: 'summary'
      },
      createdAt: new Date('2024-01-15'),
      updatedAt: now,
      createdBy: 'user_123'
    },
    {
      _id: `task_${taskIdCounter++}`,
      agentId: 'deployment-agent',
      projectId: 'proj_456',
      orgId: 'org_123',
      title: 'Deploy on git push',
      description: 'Automatically deploy when code is pushed to main branch',
      type: 'trigger',
      status: 'scheduled',
      scheduledAt: now,
      trigger: {
        type: 'webhook',
        config: {
          event: 'github.push',
          branch: 'main',
          autoApprove: true
        }
      },
      createdAt: new Date('2024-01-01'),
      updatedAt: now,
      createdBy: 'user_123'
    },
    {
      _id: `task_${taskIdCounter++}`,
      agentId: 'seo-agent',
      projectId: 'proj_456',
      orgId: 'org_123',
      title: 'Monthly SEO audit',
      description: 'Comprehensive SEO audit and recommendations',
      type: 'recurring',
      status: 'completed',
      scheduledAt: new Date('2024-11-01T08:00:00'),
      executedAt: new Date('2024-11-01T08:00:00'),
      completedAt: new Date('2024-11-01T08:15:00'),
      recurrence: {
        pattern: 'monthly',
        dayOfMonth: 1,
        time: '08:00',
        timezone: 'America/New_York'
      },
      result: {
        success: true,
        output: {
          score: 92,
          issues: 3,
          recommendations: 12
        },
        duration: 900000 // 15 minutes
      },
      payload: {
        auditType: 'comprehensive',
        includeCompetitors: true
      },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-11-01'),
      createdBy: 'user_123'
    }
  ]
}

// Initialize data
initializeMockData()

// Mock tRPC/API endpoints aligned with backend spec
export const mockScheduleEndpoints = {
  // Schedule a task using natural language or structured data
  scheduleTask: async ({ input }: { 
    input: {
      date: string // Natural language date like "tomorrow at 2pm"
      title: string
      agentId: string
      projectId?: string
      orgId?: string
      type?: 'manual' | 'recurring' | 'trigger'
      payload?: Record<string, any>
      recurrence?: ScheduledTask['recurrence']
      trigger?: ScheduledTask['trigger']
    }
  }) => {
    const task: ScheduledTask = {
      _id: `task_${taskIdCounter++}`,
      agentId: input.agentId,
      projectId: input.projectId || 'proj_456',
      orgId: input.orgId || 'org_123',
      title: input.title,
      type: input.type || 'manual',
      status: 'scheduled',
      scheduledAt: parseNaturalDate(input.date),
      payload: input.payload,
      recurrence: input.recurrence,
      trigger: input.trigger,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user_123'
    }
    
    mockTasks.push(task)
    return task
  },
  
  // Get upcoming tasks
  getUpcomingTasks: async ({ input }: { input?: TaskFilter }) => {
    let filtered = [...mockTasks]
    
    if (input?.agentId) {
      filtered = filtered.filter(t => t.agentId === input.agentId)
    }
    if (input?.projectId) {
      filtered = filtered.filter(t => t.projectId === input.projectId)
    }
    if (input?.orgId) {
      filtered = filtered.filter(t => t.orgId === input.orgId)
    }
    if (input?.status) {
      const statuses = Array.isArray(input.status) ? input.status : [input.status]
      filtered = filtered.filter(t => statuses.includes(t.status))
    }
    if (input?.type) {
      const types = Array.isArray(input.type) ? input.type : [input.type]
      filtered = filtered.filter(t => types.includes(t.type))
    }
    if (input?.from) {
      filtered = filtered.filter(t => new Date(t.scheduledAt) >= input.from!)
    }
    if (input?.to) {
      filtered = filtered.filter(t => new Date(t.scheduledAt) <= input.to!)
    }
    
    // Sort by scheduledAt
    filtered.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    
    // Apply pagination
    const limit = input?.limit || 20
    const offset = input?.offset || 0
    const paginated = filtered.slice(offset, offset + limit)
    
    return {
      tasks: paginated,
      total: filtered.length,
      hasMore: offset + limit < filtered.length
    }
  },
  
  // Process natural language command
  processNaturalCommand: async ({ input }: { input: NaturalLanguageCommand }) => {
    const { command, context } = input
    const lowerCommand = command.toLowerCase()
    
    // Parse different command types
    if (lowerCommand.includes('schedule') || lowerCommand.includes('create')) {
      // Extract task details from command
      const title = extractTitle(command)
      const date = extractDate(command)
      const recurring = detectRecurring(command)
      
      const task = await mockScheduleEndpoints.scheduleTask({
        input: {
          date: date || 'tomorrow at 9am',
          title: title || command,
          agentId: context.agentId,
          projectId: context.projectId,
          type: recurring ? 'recurring' : 'manual',
          recurrence: recurring ? parseRecurrence(command) : undefined
        }
      })
      
      return {
        action: 'created',
        task,
        message: `Task "${task.title}" scheduled for ${formatDate(task.scheduledAt)}`
      }
    }
    
    if (lowerCommand.includes('cancel') || lowerCommand.includes('delete')) {
      // Find tasks to cancel
      const tasksToCancel = mockTasks.filter(t => 
        t.agentId === context.agentId &&
        t.status === 'scheduled' &&
        matchesCommandFilter(t, command)
      )
      
      tasksToCancel.forEach(t => t.status = 'cancelled')
      
      return {
        action: 'cancelled',
        count: tasksToCancel.length,
        message: `Cancelled ${tasksToCancel.length} task(s)`
      }
    }
    
    if (lowerCommand.includes('reschedule') || lowerCommand.includes('move')) {
      // Extract task reference and new date
      const taskRef = extractTaskReference(command)
      const newDate = extractDate(command)
      
      const task = mockTasks.find(t => 
        t.agentId === context.agentId &&
        matchesTaskReference(t, taskRef)
      )
      
      if (task && newDate) {
        task.scheduledAt = parseNaturalDate(newDate)
        task.updatedAt = new Date()
        
        return {
          action: 'rescheduled',
          task,
          message: `Task "${task.title}" rescheduled to ${formatDate(task.scheduledAt)}`
        }
      }
    }
    
    if (lowerCommand.includes('show') || lowerCommand.includes('list')) {
      const timeRange = extractTimeRange(command)
      const tasks = await mockScheduleEndpoints.getUpcomingTasks({
        input: {
          agentId: context.agentId,
          from: timeRange.from,
          to: timeRange.to
        }
      })
      
      return {
        action: 'list',
        tasks: tasks.tasks,
        message: `Found ${tasks.tasks.length} task(s)`
      }
    }
    
    return {
      action: 'unknown',
      message: 'Command not understood. Try "schedule meeting tomorrow at 2pm" or "cancel all meetings"'
    }
  },
  
  // Get today's agenda
  getTodayAgenda: async ({ input }: { input: { agentId: string } }) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const result = await mockScheduleEndpoints.getUpcomingTasks({
      input: {
        agentId: input.agentId,
        from: today,
        to: tomorrow
      }
    })
    
    return result.tasks
  },
  
  // Update task
  updateTask: async ({ input }: { input: { taskId: string; updates: Partial<ScheduledTask> } }) => {
    const task = mockTasks.find(t => t._id === input.taskId)
    if (!task) throw new Error('Task not found')
    
    Object.assign(task, input.updates, { updatedAt: new Date() })
    return task
  },
  
  // Cancel task
  cancelTask: async ({ input }: { input: { taskId: string; reason?: string } }) => {
    const task = mockTasks.find(t => t._id === input.taskId)
    if (!task) throw new Error('Task not found')
    
    task.status = 'cancelled'
    task.updatedAt = new Date()
    
    return { success: true, task }
  },
  
  // Execute task immediately
  executeTask: async ({ input }: { input: { taskId: string } }) => {
    const task = mockTasks.find(t => t._id === input.taskId)
    if (!task) throw new Error('Task not found')
    
    task.status = 'running'
    task.executedAt = new Date()
    
    // Simulate execution
    setTimeout(() => {
      task.status = 'completed'
      task.completedAt = new Date()
      task.result = {
        success: true,
        output: { message: 'Task completed successfully' },
        duration: 5000
      }
    }, 5000)
    
    return { success: true, message: 'Task execution started' }
  },
  
  // Generate calendar feed
  generateCalendarFeed: async ({ input }: { input: CalendarFeedOptions }) => {
    let tasks = [...mockTasks]
    
    // Filter by type and ID
    switch (input.type) {
      case 'agent':
        tasks = tasks.filter(t => t.agentId === input.id)
        break
      case 'project':
        tasks = tasks.filter(t => t.projectId === input.id)
        break
      case 'org':
        tasks = tasks.filter(t => t.orgId === input.id)
        break
    }
    
    if (input.format === 'ical') {
      // Generate iCal format (reuse existing function)
      return generateICalFeed(tasks)
    } else {
      // Return JSON format
      return {
        version: '1.0',
        tasks: tasks.map(t => ({
          id: t._id,
          title: t.title,
          description: t.description,
          start: t.scheduledAt,
          end: new Date(new Date(t.scheduledAt).getTime() + 3600000), // +1 hour
          status: t.status,
          type: t.type,
          recurrence: t.recurrence
        }))
      }
    }
  },
  
  // Bulk operations
  bulkCancelTasks: async ({ input }: { input: { taskIds: string[]; reason?: string } }) => {
    const results = []
    
    for (const taskId of input.taskIds) {
      try {
        await mockScheduleEndpoints.cancelTask({ input: { taskId, reason: input.reason } })
        results.push({ taskId, success: true })
      } catch (error) {
        results.push({ taskId, success: false, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }
    
    return results
  },
  
  // Get queue status
  getQueueStatus: async () => {
    const runningTasks = mockTasks.filter(t => t.status === 'running')
    const scheduledTasks = mockTasks.filter(t => 
      t.status === 'scheduled' && 
      new Date(t.scheduledAt) <= new Date()
    )
    
    return {
      isRunning: true,
      tasksInQueue: scheduledTasks.length,
      currentTask: runningTasks[0],
      lastRunAt: new Date(Date.now() - 60000), // 1 minute ago
      nextRunAt: new Date(Date.now() + 60000)  // 1 minute from now
    }
  }
}

// Helper functions

function parseNaturalDate(dateStr: string): Date {
  const lower = dateStr.toLowerCase()
  const now = new Date()
  
  if (lower.includes('tomorrow')) {
    const date = new Date(now)
    date.setDate(date.getDate() + 1)
    return extractTimeFromString(dateStr, date)
  }
  
  if (lower.includes('next week')) {
    const date = new Date(now)
    date.setDate(date.getDate() + 7)
    return extractTimeFromString(dateStr, date)
  }
  
  if (lower.includes('next monday')) {
    const date = new Date(now)
    const daysUntilMonday = (8 - date.getDay()) % 7 || 7
    date.setDate(date.getDate() + daysUntilMonday)
    return extractTimeFromString(dateStr, date)
  }
  
  // Default to tomorrow 9am
  const date = new Date(now)
  date.setDate(date.getDate() + 1)
  date.setHours(9, 0, 0, 0)
  return date
}

function extractTimeFromString(str: string, date: Date): Date {
  const timeMatch = str.match(/(\d{1,2})(:\d{2})?\s*(am|pm)/i)
  if (timeMatch) {
    let hours = parseInt(timeMatch[1])
    const minutes = timeMatch[2] ? parseInt(timeMatch[2].slice(1)) : 0
    const isPM = timeMatch[3].toLowerCase() === 'pm'
    
    if (isPM && hours !== 12) hours += 12
    if (!isPM && hours === 12) hours = 0
    
    date.setHours(hours, minutes, 0, 0)
  }
  return date
}

function extractTitle(command: string): string {
  // Remove command words and dates
  let title = command
    .replace(/schedule|create|add/gi, '')
    .replace(/tomorrow|next week|next monday|today/gi, '')
    .replace(/at \d{1,2}(:\d{2})?\s*(am|pm)/gi, '')
    .replace(/every (day|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi, '')
    .trim()
  
  return title || 'New Task'
}

function extractDate(command: string): string | null {
  if (command.includes('tomorrow')) return 'tomorrow'
  if (command.includes('next week')) return 'next week'
  if (command.includes('next monday')) return 'next monday'
  if (command.includes('today')) return 'today'
  
  const timeMatch = command.match(/at \d{1,2}(:\d{2})?\s*(am|pm)/i)
  if (timeMatch) return timeMatch[0]
  
  return null
}

function detectRecurring(command: string): boolean {
  return /every (day|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(command)
}

function parseRecurrence(command: string): ScheduledTask['recurrence'] {
  if (command.includes('every day')) {
    return { pattern: 'daily' }
  }
  if (command.includes('every week')) {
    return { pattern: 'weekly' }
  }
  if (command.includes('every month')) {
    return { pattern: 'monthly' }
  }
  
  // Check for specific days
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayMatches = days.map((day, i) => 
    command.toLowerCase().includes(day) ? i : -1
  ).filter(i => i !== -1)
  
  if (dayMatches.length > 0) {
    return {
      pattern: 'weekly',
      daysOfWeek: dayMatches
    }
  }
  
  return { pattern: 'weekly' }
}

function matchesCommandFilter(task: ScheduledTask, command: string): boolean {
  const lower = command.toLowerCase()
  if (lower.includes('all')) return true
  if (lower.includes('tomorrow') && isTaskTomorrow(task)) return true
  if (lower.includes('today') && isTaskToday(task)) return true
  if (lower.includes(task.title.toLowerCase())) return true
  return false
}

function extractTaskReference(command: string): string {
  // Extract quoted text or task title
  const quoted = command.match(/"([^"]+)"|'([^']+)'/)?.[1]
  if (quoted) return quoted
  
  // Remove command words to find the task reference
  return command
    .replace(/reschedule|move|change/gi, '')
    .replace(/to (tomorrow|next week|next monday)/gi, '')
    .replace(/at \d{1,2}(:\d{2})?\s*(am|pm)/gi, '')
    .trim()
}

function matchesTaskReference(task: ScheduledTask, ref: string): boolean {
  return task.title.toLowerCase().includes(ref.toLowerCase())
}

function extractTimeRange(command: string) {
  const now = new Date()
  const from = new Date(now)
  const to = new Date(now)
  
  if (command.includes('today')) {
    from.setHours(0, 0, 0, 0)
    to.setHours(23, 59, 59, 999)
  } else if (command.includes('tomorrow')) {
    from.setDate(from.getDate() + 1)
    from.setHours(0, 0, 0, 0)
    to.setDate(to.getDate() + 1)
    to.setHours(23, 59, 59, 999)
  } else if (command.includes('next week') || command.includes('this week')) {
    to.setDate(to.getDate() + 7)
  } else {
    // Default to next 7 days
    to.setDate(to.getDate() + 7)
  }
  
  return { from, to }
}

function isTaskToday(task: ScheduledTask): boolean {
  const today = new Date()
  const taskDate = new Date(task.scheduledAt)
  return taskDate.toDateString() === today.toDateString()
}

function isTaskTomorrow(task: ScheduledTask): boolean {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const taskDate = new Date(task.scheduledAt)
  return taskDate.toDateString() === tomorrow.toDateString()
}

function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

function generateICalFeed(tasks: ScheduledTask[]): string {
  // Simplified iCal generation
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//repo.md//Agent Tasks//EN',
    'CALSCALE:GREGORIAN'
  ]
  
  tasks.forEach(task => {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${task._id}@repo.md`)
    lines.push(`DTSTAMP:${formatICalDate(new Date())}`)
    lines.push(`DTSTART:${formatICalDate(task.scheduledAt)}`)
    lines.push(`DTEND:${formatICalDate(new Date(new Date(task.scheduledAt).getTime() + 3600000))}`)
    lines.push(`SUMMARY:${task.title}`)
    if (task.description) {
      lines.push(`DESCRIPTION:${task.description}`)
    }
    if (task.recurrence?.rrule) {
      lines.push(`RRULE:${task.recurrence.rrule}`)
    }
    lines.push('END:VEVENT')
  })
  
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}