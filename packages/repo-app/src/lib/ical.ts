import type { Task } from '@/types/task'

/**
 * Generate iCal content from tasks
 */
export function generateICal(tasks: Task[], options?: {
  includeCompleted?: boolean
  dateRange?: { start: Date; end: Date }
}): string {
  const lines: string[] = []
  
  // iCal header
  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//repo.md//Task Calendar//EN')
  lines.push('CALSCALE:GREGORIAN')
  lines.push('METHOD:PUBLISH')
  lines.push(`X-WR-CALNAME:repo.md Tasks`)
  lines.push(`X-WR-CALDESC:Tasks from repo.md`)
  
  // Filter tasks based on options
  let filteredTasks = tasks
  
  if (!options?.includeCompleted) {
    filteredTasks = filteredTasks.filter(task => task.status !== 'completed')
  }
  
  if (options?.dateRange) {
    filteredTasks = filteredTasks.filter(task => {
      if (!task.scheduledAt) return false
      const taskDate = new Date(task.scheduledAt)
      return taskDate >= options.dateRange!.start && taskDate <= options.dateRange!.end
    })
  }
  
  // Add each task as a VEVENT
  filteredTasks.forEach(task => {
    if (task.recurrence) {
      // Handle recurring tasks
      lines.push(...createRecurringEvent(task))
    } else if (task.scheduledAt) {
      // Handle one-time tasks
      lines.push(...createEvent(task))
    }
  })
  
  // iCal footer
  lines.push('END:VCALENDAR')
  
  return lines.join('\r\n')
}

/**
 * Create a single event from a task
 */
function createEvent(task: Task): string[] {
  const lines: string[] = []
  
  lines.push('BEGIN:VEVENT')
  lines.push(`UID:${task.id}@repo.md`)
  lines.push(`DTSTAMP:${formatDate(new Date())}`)
  
  if (task.scheduledAt) {
    const startDate = new Date(task.scheduledAt)
    lines.push(`DTSTART:${formatDate(startDate)}`)
    
    // Estimate end time based on task duration or default to 1 hour
    const duration = task.duration || 3600000 // 1 hour in milliseconds
    const endDate = new Date(startDate.getTime() + duration)
    lines.push(`DTEND:${formatDate(endDate)}`)
  }
  
  lines.push(`SUMMARY:${escapeText(task.title)}`)
  
  if (task.description) {
    lines.push(`DESCRIPTION:${escapeText(task.description)}`)
  }
  
  // Add location as project/org info
  lines.push(`LOCATION:Project ${task.projectId}`)
  
  // Add categories from tags
  if (task.tags && task.tags.length > 0) {
    lines.push(`CATEGORIES:${task.tags.join(',')}`)
  }
  
  // Add priority
  const priority = getPriority(task.priority)
  if (priority) {
    lines.push(`PRIORITY:${priority}`)
  }
  
  // Add status
  const status = getStatus(task.status)
  if (status) {
    lines.push(`STATUS:${status}`)
  }
  
  // Add alarm/reminder (15 minutes before)
  lines.push('BEGIN:VALARM')
  lines.push('TRIGGER:-PT15M')
  lines.push('ACTION:DISPLAY')
  lines.push(`DESCRIPTION:Task reminder: ${escapeText(task.title)}`)
  lines.push('END:VALARM')
  
  lines.push('END:VEVENT')
  
  return lines
}

/**
 * Create a recurring event from a task
 */
function createRecurringEvent(task: Task): string[] {
  const lines = createEvent(task)
  
  // Insert recurrence rule after DTSTART
  const rrule = generateRRule(task.recurrence!)
  if (rrule) {
    const dtStartIndex = lines.findIndex(line => line.startsWith('DTSTART:'))
    if (dtStartIndex !== -1) {
      lines.splice(dtStartIndex + 1, 0, rrule)
    }
  }
  
  return lines
}

/**
 * Generate RRULE for recurring tasks
 */
function generateRRule(recurrence: Task['recurrence']): string {
  if (!recurrence) return ''
  
  const parts: string[] = ['RRULE:']
  
  switch (recurrence.pattern) {
    case 'daily':
      parts.push(`FREQ=DAILY`)
      if (recurrence.interval && recurrence.interval > 1) {
        parts.push(`;INTERVAL=${recurrence.interval}`)
      }
      break
      
    case 'weekly':
      parts.push(`FREQ=WEEKLY`)
      if (recurrence.interval && recurrence.interval > 1) {
        parts.push(`;INTERVAL=${recurrence.interval}`)
      }
      if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
        const days = recurrence.daysOfWeek.map(d => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d])
        parts.push(`;BYDAY=${days.join(',')}`)
      }
      break
      
    case 'monthly':
      parts.push(`FREQ=MONTHLY`)
      if (recurrence.interval && recurrence.interval > 1) {
        parts.push(`;INTERVAL=${recurrence.interval}`)
      }
      if (recurrence.dayOfMonth) {
        parts.push(`;BYMONTHDAY=${recurrence.dayOfMonth}`)
      }
      break
  }
  
  // Add end conditions
  if (recurrence.endDate) {
    parts.push(`;UNTIL=${formatDate(recurrence.endDate)}`)
  } else if (recurrence.occurrences) {
    parts.push(`;COUNT=${recurrence.occurrences}`)
  }
  
  return parts.join('')
}

/**
 * Format date for iCal (YYYYMMDDTHHMMSSZ)
 */
function formatDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

/**
 * Escape text for iCal format
 */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

/**
 * Convert priority to iCal format (1-9, where 1 is highest)
 */
function getPriority(priority?: Task['priority']): number | null {
  switch (priority) {
    case 'urgent': return 1
    case 'high': return 3
    case 'medium': return 5
    case 'low': return 7
    default: return null
  }
}

/**
 * Convert status to iCal format
 */
function getStatus(status: Task['status']): string | null {
  switch (status) {
    case 'completed': return 'COMPLETED'
    case 'cancelled': return 'CANCELLED'
    case 'in_progress': return 'IN-PROCESS'
    case 'pending':
    case 'scheduled':
      return 'TENTATIVE'
    default: return null
  }
}

/**
 * Download iCal file
 */
export function downloadICal(content: string, filename: string = 'tasks.ics'): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}