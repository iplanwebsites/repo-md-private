// Task type definitions with temporal information

export interface Task {
  id: string
  orgId: string
  projectId: string
  parentTaskId?: string // For subtasks
  
  // Basic info
  title: string
  description: string
  prompt?: string // Pre-saved prompt for agent execution
  variables?: Record<string, any> // Variables to use with the prompt
  
  // Type and status
  type: 'one-time' | 'recurring' | 'triggered'
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  
  // Temporal info
  scheduledAt?: Date // When the task should run
  startedAt?: Date // When the task actually started
  completedAt?: Date // When the task completed
  duration?: number // Duration in milliseconds
  
  // Recurrence
  recurrence?: {
    pattern: 'daily' | 'weekly' | 'monthly' | 'custom'
    interval?: number // e.g., every 2 weeks
    daysOfWeek?: number[] // 0-6 (Sunday-Saturday)
    dayOfMonth?: number // 1-31
    time?: string // HH:mm format
    timezone?: string
    endDate?: Date
    occurrences?: number // Max number of occurrences
  }
  
  // Execution details
  agentModel?: string // Which AI model to use
  agentTemperature?: number
  maxTokens?: number
  timeout?: number // Timeout in milliseconds
  
  // Results
  result?: {
    status: 'success' | 'failure' | 'partial'
    output?: any
    error?: string
    filesChanged?: string[]
    tokensUsed?: number
    cost?: number
  }
  
  // Metadata
  tags?: string[]
  createdAt: Date
  updatedAt: Date
  createdBy: string
  lastModifiedBy?: string
  
  // Relations
  childTasks?: Task[] // For task hierarchies
  dependencies?: string[] // Task IDs that must complete first
}

export interface TaskExecution {
  id: string
  taskId: string
  status: 'running' | 'completed' | 'failed'
  startedAt: Date
  completedAt?: Date
  duration?: number
  output?: any
  error?: string
  tokensUsed?: number
  cost?: number
}

export interface TaskFilter {
  orgId?: string
  projectId?: string
  status?: Task['status'][]
  type?: Task['type'][]
  priority?: Task['priority'][]
  tags?: string[]
  scheduledAfter?: Date
  scheduledBefore?: Date
  search?: string
}

export interface TaskStats {
  total: number
  pending: number
  scheduled: number
  inProgress: number
  completed: number
  failed: number
  successRate: number
  avgDuration: number
  tokensUsed: number
  totalCost: number
}

// Calendar event format for tasks
export interface TaskCalendarEvent {
  id: string
  title: string
  start: Date
  end?: Date
  allDay?: boolean
  color?: string
  extendedProps: {
    task: Task
    description?: string
    status: Task['status']
    priority: Task['priority']
    type: Task['type']
  }
}

// iCal export format
export interface TaskICalExport {
  tasks: Task[]
  includeCompleted?: boolean
  dateRange?: {
    start: Date
    end: Date
  }
}