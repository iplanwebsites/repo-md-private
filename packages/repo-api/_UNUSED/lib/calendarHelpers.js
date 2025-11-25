/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

// calendarHelpers.js
import ical from "ical-generator";

/**
 * Create a base calendar with common configuration
 * @param {Object} options - Calendar configuration options
 * @returns {Object} - Configured iCal calendar object
 */
export function createBaseCalendar(options = {}) {
  const { name = "PushMD Calendar", url, subscriptionMode = true } = options;

  return ical({
    domain: process.env.DOMAIN || "repo.md",
    name: name,
    timezone: "America/Toronto", // Eastern Time (Montreal/Toronto)
    prodId: {
      company: "PushMD",
      product: "Calendar",
      language: "FR",
    },
    method: subscriptionMode ? "PUBLISH" : undefined, // Essential for subscription calendars
    ttl: subscriptionMode ? 1800 : undefined, // Time-to-live in seconds (30 minutes)
    url: url,
  });
}

/**
 * Add subscription headers to response
 * @param {Object} res - Express response object
 * @param {String} calendarName - Name of the calendar
 * @param {String} filename - Filename for the attachment
 */
export function addCalendarHeaders(res, calendarName, filename) {
  // Set headers specifically for calendar subscription
  res.set("Content-Type", "text/calendar; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename=${filename}`);

  // Add cache control headers - adjust max-age as needed
  res.set("Cache-Control", "public, max-age=1800"); // 30 minutes

  // Add headers to indicate this is a calendar subscription
  res.set("X-WR-CALNAME", calendarName);
  res.set("X-PUBLISHED-TTL", "PT30M"); // Update frequency hint (30 minutes)
}

/**
 * Create an event for the calendar
 * @param {Object} calendar - iCal calendar object
 * @param {Object} meet - Meeting data
 * @param {Object} options - Additional options
 */
export function addEventToCalendar(calendar, meet, options = {}) {
  const { patient, summary } = options;

  // Calculate end time
  const endTime = new Date(meet.startTime);
  endTime.setMinutes(endTime.getMinutes() + meet.duration);

  // Get patient email - either from meet.patientEmail or from the patient object
  const patientEmail = meet.patientEmail || (patient ? patient.email : null);

  // Create event attendees array
  const attendees = [];

  // Add owner/coach as an attendee
  if (meet.ownerEmail) {
    attendees.push({
      name: meet.ownerName || "Coach",
      email: meet.ownerEmail,
      role: "REQ-PARTICIPANT", // Required participant
      status: mapInviteeStatusToICalStatus("accepted"),
      rsvp: true,
    });
  }

  // Add patient as attendee if email exists
  if (patientEmail) {
    attendees.push({
      name: patient ? patient.name : "Patient",
      email: patientEmail,
      role: "REQ-PARTICIPANT", // Required participant
      status: mapInviteeStatusToICalStatus(meet.inviteeStatus || "pending"),
      rsvp: true,
    });
  }

  // Format description with details
  let description = meet.description || "";
  if (meet.eventUrl) {
    description += `\n\nSalle de vidéoconférence: \n${meet.eventUrl}\n\nPlus d'info:\nhttps://repo.md/meets/${meet.id}\n`;
  }

  // Create event in calendar
  calendar.createEvent({
    uid: meet.id,
    start: meet.startTime,
    end: endTime,
    summary: summary || meet.title,
    description: description,
    location: "Online Meeting",
    url: meet.eventUrl || meet.joinUrl,
    status: mapStatusToICalStatus(meet.status),
    created: meet.createdAt,
    lastModified: meet.updatedAt,
    organizer: {
      name: "PushMD Platform",
      email: process.env.SYSTEM_EMAIL || "rdv@repo.md",
    },
    attendees: attendees,
  });
}

/**
 * Map internal status to iCalendar status
 * @param {string} status - Internal meeting status
 * @returns {string} - iCalendar compatible status
 */
export function mapStatusToICalStatus(status) {
  switch (status) {
    case "scheduled":
      return "CONFIRMED";
    case "canceled":
      return "CANCELLED";
    case "completed":
      return "CONFIRMED";
    default:
      return "TENTATIVE";
  }
}

/**
 * Map invitee status to iCalendar attendee status
 * @param {string} status - Internal invitee status
 * @returns {string} - iCalendar compatible attendee status
 */
export function mapInviteeStatusToICalStatus(status) {
  switch (status) {
    case "accepted":
      return "ACCEPTED";
    case "declined":
      return "DECLINED";
    case "tentative":
      return "TENTATIVE";
    case "pending":
    default:
      return "NEEDS-ACTION";
  }
}
