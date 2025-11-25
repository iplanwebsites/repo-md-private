// Scheduled Task type definitions aligned with backend schema

export interface ScheduledTask {
  _id?: string
  agentId: string
  projectId: string
  orgId: string
  
  // Basic info
  title: string
  description?: string
  
  // Type and status
  type: 'manual' | 'recurring' | 'trigger'
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled'
  
  // Temporal info
  scheduledAt: Date
  executedAt?: Date
  completedAt?: Date
  
  // Task data
  payload?: Record<string, any> // Agent-specific data
  
  // Recurrence (for recurring tasks)
  recurrence?: {
    pattern: 'daily' | 'weekly' | 'monthly' | 'custom'
    interval?: number
    daysOfWeek?: number[] // 0-6 (Sunday-Saturday)
    dayOfMonth?: number // 1-31
    time?: string // HH:mm format
    timezone?: string
    endDate?: Date
    occurrences?: number
    rrule?: string // Raw RRULE string
  }
  
  // Trigger info (for trigger tasks)
  trigger?: {
    type: 'webhook' | 'event' | 'condition'
    config: Record<string, any>
  }
  
  // Execution result
  result?: {
    success: boolean
    output?: any
    error?: string
    duration?: number
  }
  
  // Metadata
  createdAt: Date
  updatedAt: Date
  createdBy: string
  
  // Relations
  parentTaskId?: string
  childTaskIds?: string[]
}

export interface TaskHistory {
  _id?: string
  taskId: string
  action: 'created' | 'updated' | 'executed' | 'completed' | 'failed' | 'cancelled'
  timestamp: Date
  userId: string
  changes?: Record<string, any>
  result?: any
  error?: string
}

export interface TaskFilter {
  agentId?: string
  projectId?: string
  orgId?: string
  status?: ScheduledTask['status'] | ScheduledTask['status'][]
  type?: ScheduledTask['type'] | ScheduledTask['type'][]
  from?: Date
  to?: Date
  limit?: number
  offset?: number
}

export interface NaturalLanguageCommand {
  command: string
  context: {
    agentId: string
    projectId?: string
    orgId?: string
    userId?: string
  }
}

export interface CalendarFeedOptions {
  type: 'agent' | 'project' | 'org' | 'user'
  id: string
  format: 'ical' | 'json'
  token?: string
  includePrivate?: boolean
}

export interface TaskExecutor {
  agentId: string
  handler: (task: ScheduledTask) => Promise<any>
}

export interface QueueStatus {
  isRunning: boolean
  tasksInQueue: number
  currentTask?: ScheduledTask
  lastRunAt?: Date
  nextRunAt?: Date
}