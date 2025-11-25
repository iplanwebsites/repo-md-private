import ical from "ical-generator";
import { getUpcomingTasks } from "./scheduler.js";
import { db } from "../../db.js";
import { ObjectId } from "mongodb";

/**
 * Generate calendar feed for various views
 */
export async function generateCalendarFeed({
  type,
  id,
  format = "ical",
  includePrivate = false,
  from = new Date(),
  to = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days ahead
  title,
  description
}) {
  // Validate inputs
  if (!type || !id) {
    throw new Error("Type and ID are required");
  }

  if (!["agent", "project", "org", "user"].includes(type)) {
    throw new Error("Invalid type. Must be: agent, project, org, or user");
  }

  // Get tasks based on type
  const tasks = await getTasksForFeed(type, id, from, to, includePrivate);

  // Generate feed based on format
  if (format === "ical") {
    return generateICalFeed(tasks, { type, id, title, description });
  } else if (format === "json") {
    return generateJSONFeed(tasks, { type, id, title, description });
  } else {
    throw new Error("Invalid format. Must be: ical or json");
  }
}

/**
 * Get tasks for a specific feed type
 */
async function getTasksForFeed(type, id, from, to, includePrivate) {
  const query = {
    from,
    to,
    includeCompleted: false,
    includeRecurring: true,
    limit: 1000
  };

  switch (type) {
    case "agent":
      query.agentId = id;
      break;
    
    case "project":
      query.projectId = id;
      break;
    
    case "org":
      query.orgId = id;
      break;
    
    case "user":
      // Get all tasks for agents owned by this user
      const userAgents = await getUserAgents(id);
      if (userAgents.length === 0) {
        return [];
      }
      return await getTasksForMultipleAgents(userAgents, from, to);
    
    default:
      throw new Error(`Unknown feed type: ${type}`);
  }

  const tasks = await getUpcomingTasks(query);

  // Filter out private tasks if needed
  if (!includePrivate) {
    return tasks.filter(task => !task.metadata?.isPrivate);
  }

  return tasks;
}

/**
 * Generate iCal format feed
 */
function generateICalFeed(tasks, options) {
  const calendar = ical({
    name: options.title || generateFeedTitle(options.type, options.id),
    description: options.description || generateFeedDescription(options.type, options.id),
    timezone: "UTC",
    prodId: {
      company: "Repo.md",
      product: "AI Agent Scheduler",
      language: "EN"
    },
    method: "PUBLISH"
  });

  // Add tasks as events
  for (const task of tasks) {
    const event = {
      id: task._id.toString(),
      start: task.scheduledAt,
      summary: task.title,
      description: generateEventDescription(task),
      categories: [task.type, task.status],
      url: generateTaskUrl(task),
      created: task.createdAt,
      lastModified: task.updatedAt
    };

    // Add duration (default 1 hour for now, could be configurable)
    const duration = task.metadata?.duration || 60; // minutes
    event.end = new Date(task.scheduledAt.getTime() + duration * 60 * 1000);

    // Add location if available
    if (task.metadata?.location) {
      event.location = task.metadata.location;
    }

    // Add recurrence rule if applicable
    if (task.recurrence?.customRule) {
      event.repeating = task.recurrence.customRule;
    } else if (task.recurrence) {
      event.repeating = generateRRuleFromRecurrence(task.recurrence);
    }

    // Add alarms/reminders if configured
    if (task.metadata?.reminders) {
      event.alarms = task.metadata.reminders.map(reminder => ({
        type: "display",
        trigger: reminder.minutes * -60, // negative seconds before event
        description: `Reminder: ${task.title}`
      }));
    }

    // Add attendees if this is a collaborative task
    if (task.metadata?.attendees) {
      event.attendees = task.metadata.attendees.map(attendee => ({
        email: attendee.email,
        name: attendee.name,
        role: "REQ-PARTICIPANT"
      }));
    }

    // Add custom properties for agent/project tracking
    event.x = [
      { key: "X-AGENT-ID", value: task.agentId },
      { key: "X-TASK-TYPE", value: task.type },
      { key: "X-TASK-STATUS", value: task.status }
    ];

    if (task.projectId) {
      event.x.push({ key: "X-PROJECT-ID", value: task.projectId.toString() });
    }

    if (task.orgId) {
      event.x.push({ key: "X-ORG-ID", value: task.orgId.toString() });
    }

    calendar.createEvent(event);
  }

  return calendar.toString();
}

/**
 * Generate JSON format feed
 */
function generateJSONFeed(tasks, options) {
  return JSON.stringify({
    version: "1.0",
    title: options.title || generateFeedTitle(options.type, options.id),
    description: options.description || generateFeedDescription(options.type, options.id),
    home_page_url: process.env.API_BASE_URL || "https://api.repo.md",
    feed_url: `${process.env.API_BASE_URL}/api/schedule/feed/${options.type}/${options.id}.json`,
    items: tasks.map(task => ({
      id: task._id.toString(),
      title: task.title,
      content_text: task.description,
      content_html: generateHTMLContent(task),
      url: generateTaskUrl(task),
      date_published: task.createdAt.toISOString(),
      date_modified: task.updatedAt.toISOString(),
      date_scheduled: task.scheduledAt.toISOString(),
      tags: [task.type, task.status, task.agentId],
      metadata: {
        agent_id: task.agentId,
        project_id: task.projectId?.toString(),
        org_id: task.orgId?.toString(),
        type: task.type,
        status: task.status,
        recurrence: task.recurrence,
        is_recurrence_instance: task.isRecurrenceInstance || false,
        original_task_id: task.originalTaskId?.toString()
      }
    }))
  }, null, 2);
}

/**
 * Generate a unique feed token for authentication
 */
export async function generateFeedToken(userId, feedType, feedId) {
  const crypto = await import("crypto");
  
  const data = `${userId}:${feedType}:${feedId}:${Date.now()}`;
  const hash = crypto.createHash("sha256").update(data).digest("hex");
  
  // Store token in database for validation
  await db.feedTokens?.insertOne({
    token: hash,
    userId: new ObjectId(userId),
    feedType,
    feedId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
  });
  
  return hash;
}

/**
 * Validate a feed token
 */
export async function validateFeedToken(token) {
  if (!token) {
    return null;
  }

  const tokenDoc = await db.feedTokens?.findOne({
    token,
    expiresAt: { $gt: new Date() }
  });
  
  return tokenDoc;
}

/**
 * Get calendar subscription URL
 */
export function getCalendarSubscriptionUrl(type, id, token, format = "ical") {
  const baseUrl = process.env.API_BASE_URL || "https://api.repo.md";
  const extension = format === "ical" ? "ics" : "json";
  
  if (token) {
    return `${baseUrl}/api/schedule/feed/${type}/${id}.${extension}?token=${token}`;
  } else {
    return `${baseUrl}/api/schedule/feed/public/${type}/${id}.${extension}`;
  }
}

// Helper functions

function generateFeedTitle(type, id) {
  const titles = {
    agent: `AI Agent ${id} Schedule`,
    project: `Project ${id} Tasks`,
    org: `Organization ${id} Tasks`,
    user: `My AI Agents Schedule`
  };
  
  return titles[type] || "Task Schedule";
}

function generateFeedDescription(type, id) {
  const descriptions = {
    agent: `Scheduled tasks for AI agent ${id}`,
    project: `All scheduled tasks for project ${id}`,
    org: `Organization-wide scheduled tasks for ${id}`,
    user: `Combined schedule for all your AI agents`
  };
  
  return descriptions[type] || "AI Agent scheduled tasks";
}

function generateEventDescription(task) {
  let description = task.description || "";
  
  if (task.metadata?.notes) {
    description += `\n\nNotes: ${task.metadata.notes}`;
  }
  
  if (task.parentTaskId) {
    description += `\n\nParent Task: ${task.parentTaskId}`;
  }
  
  if (task.payload && Object.keys(task.payload).length > 0) {
    description += `\n\nPayload: ${JSON.stringify(task.payload, null, 2)}`;
  }
  
  return description;
}

function generateTaskUrl(task) {
  const baseUrl = process.env.FRONTEND_URL || "https://repo.md";
  return `${baseUrl}/tasks/${task._id}`;
}

function generateRRuleFromRecurrence(recurrence) {
  const rruleMap = {
    daily: "FREQ=DAILY",
    weekly: "FREQ=WEEKLY",
    monthly: "FREQ=MONTHLY"
  };
  
  let rrule = rruleMap[recurrence.pattern] || "FREQ=DAILY";
  
  if (recurrence.interval > 1) {
    rrule += `;INTERVAL=${recurrence.interval}`;
  }
  
  if (recurrence.endDate) {
    const endDateStr = recurrence.endDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    rrule += `;UNTIL=${endDateStr}`;
  }
  
  if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
    const dayMap = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const days = recurrence.daysOfWeek.map(d => dayMap[d]).join(",");
    rrule += `;BYDAY=${days}`;
  }
  
  if (recurrence.dayOfMonth) {
    rrule += `;BYMONTHDAY=${recurrence.dayOfMonth}`;
  }
  
  return rrule;
}

function generateHTMLContent(task) {
  return `
    <div class="task-event">
      <h3>${task.title}</h3>
      <p>${task.description || "No description"}</p>
      <div class="task-meta">
        <span class="task-type">${task.type}</span>
        <span class="task-status">${task.status}</span>
        <time datetime="${task.scheduledAt.toISOString()}">
          ${task.scheduledAt.toLocaleString()}
        </time>
      </div>
    </div>
  `;
}

async function getUserAgents(userId) {
  // This would need to be implemented based on your agent storage
  // For now, returning empty array
  return [];
}

async function getTasksForMultipleAgents(agentIds, from, to) {
  const allTasks = [];
  
  for (const agentId of agentIds) {
    const tasks = await getUpcomingTasks({
      agentId,
      from,
      to,
      includeCompleted: false,
      includeRecurring: true
    });
    
    allTasks.push(...tasks);
  }
  
  // Sort by scheduled date
  allTasks.sort((a, b) => a.scheduledAt - b.scheduledAt);
  
  return allTasks;
}

/**
 * Generate agenda view (text format)
 */
export async function generateAgendaView({
  agentId,
  projectId,
  orgId,
  days = 7,
  groupBy = "day" // day, week, project
}) {
  const from = new Date();
  const to = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  
  const tasks = await getUpcomingTasks({
    agentId,
    projectId,
    orgId,
    from,
    to,
    includeCompleted: false,
    includeRecurring: true
  });
  
  if (tasks.length === 0) {
    return "No upcoming tasks scheduled.";
  }
  
  let agenda = `# Task Agenda (Next ${days} days)\n\n`;
  
  if (groupBy === "day") {
    const tasksByDay = groupTasksByDay(tasks);
    
    for (const [day, dayTasks] of Object.entries(tasksByDay)) {
      agenda += `## ${day}\n\n`;
      
      for (const task of dayTasks) {
        const time = task.scheduledAt.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit"
        });
        
        agenda += `- ${time} - **${task.title}**`;
        
        if (task.description) {
          agenda += ` - ${task.description}`;
        }
        
        if (task.type === "recurring") {
          agenda += " 🔄";
        }
        
        agenda += "\n";
      }
      
      agenda += "\n";
    }
  }
  
  return agenda;
}

function groupTasksByDay(tasks) {
  const grouped = {};
  
  for (const task of tasks) {
    const day = task.scheduledAt.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    
    if (!grouped[day]) {
      grouped[day] = [];
    }
    
    grouped[day].push(task);
  }
  
  return grouped;
}