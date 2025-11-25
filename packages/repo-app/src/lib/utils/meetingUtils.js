// meetingUtils.js
// Common utility functions for handling meetings

import trpc from "@/trpc";

/**
 * Fetches a meeting by roomId that can be used by both hosts and guests
 * @param {string} roomId - The room ID to find the meeting for
 * @returns {Promise<object|null>} - The meeting object or null if not found
 */
export async function findMeetingByRoomId(roomId) {
	try {
		// First, try to get the meeting directly from the API
		// This endpoint should be accessible to both authenticated and non-authenticated users
		const response = await trpc.getMeetByRoomId.query({ roomId });

		if (response && response.success && response.meet) {
			return response.meet;
		}

		// Fallback if direct query fails
		return null;
	} catch (error) {
		console.error("Error finding meeting by roomId:", error);
		return null;
	}
}

/**
 * Sorts meetings by proximity to current time
 * @param {Array} meetings - Array of meeting objects with startTime
 * @returns {Array} - Sorted meetings (closest to now first)
 */
export function sortMeetingsByProximity(meetings) {
	if (!meetings || !Array.isArray(meetings) || meetings.length === 0) {
		return [];
	}

	const now = new Date();
	return [...meetings].sort((a, b) => {
		const timeA = Math.abs(new Date(a.startTime) - now);
		const timeB = Math.abs(new Date(b.startTime) - now);
		return timeA - timeB;
	});
}

/**
 * Formats a meeting time for display
 * @param {string|Date} dateTime - The date to format
 * @returns {string} - Formatted date/time string
 */
export function formatMeetingDateTime(dateTime) {
	if (!dateTime) return "";

	const date = new Date(dateTime);
	return new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		day: "numeric",
		month: "long",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}

/**
 * Gets meeting countdown text
 * @param {string|Date} meetingTime - The meeting time
 * @returns {string} - Formatted countdown or status text
 */
export function getMeetingCountdown(meetingTime) {
	if (!meetingTime) return null;

	const meetingDate = new Date(meetingTime);
	const now = new Date();

	// If meeting is in the past
	if (meetingDate < now) {
		return "La réunion a déjà commencé";
	}

	// Calculate time difference
	const diff = meetingDate - now;
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

	// Format countdown text
	if (days > 0) {
		return `Démarre dans ${days} jour${days > 1 ? "s" : ""} et ${hours}h`;
	} else if (hours > 0) {
		return `Démarre dans ${hours}h${minutes > 0 ? ` ${minutes}min` : ""}`;
	} else if (minutes > 0) {
		return `Démarre dans ${minutes} minute${minutes > 1 ? "s" : ""}`;
	} else {
		return "Démarre maintenant";
	}
}
