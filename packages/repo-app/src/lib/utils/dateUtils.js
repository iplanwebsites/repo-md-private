/**
 * Date formatting and manipulation utilities
 */

const LOCALE_DEFAULT = "en-US";

/**
 * Format a date for display with various options
 * @param {Date|string} date - The date to format
 * @param {string} format - The format style: 'short', 'medium', 'long', or 'full'
 * @param {string} locale - The locale to use for formatting
 * @returns {string} The formatted date string
 */
export const formatDate = (date, format = "short", locale = "en-US") => {
	if (!date) return "Non programmé";
	const dateObj = date instanceof Date ? date : new Date(date);
	return dateObj.toLocaleDateString(locale, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
};

export function formatTimeAgo(dateString) {
	if (!dateString) return "";

	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now - date;
	const diffSecs = Math.floor(diffMs / 1000);
	const diffMins = Math.floor(diffSecs / 60);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffDays > 90) {
		return date.toLocaleDateString(LOCALE_DEFAULT, {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	} else if (diffDays >= 30) {
		return date.toLocaleDateString(LOCALE_DEFAULT, {
			month: "short",
			day: "numeric",
		});
	} else if (diffDays >= 1) {
		return `${diffDays}d ago`;
	} else if (diffHours >= 1) {
		return `${diffHours}h ago`;
	} else if (diffMins >= 1) {
		return `${diffMins}m ago`;
	} else {
		return "Just now";
	}
}

/**
 * Formats a date with the day of the week, day, and month
 * @param {Date|string} date - The date to format
 * @param {string} locale - The locale to use for formatting
 * @returns {string} The formatted date string with weekday, day, and month
 */
export const formatDayDate = (date, locale = LOCALE_DEFAULT) => {
	if (!date) return "";
	const dateObj = date instanceof Date ? date : new Date(date);
	return dateObj.toLocaleDateString(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
};

/**
 * Format month and year
 * @param {Date|string} date - The date to format
 * @param {string} locale - The locale to use for formatting
 * @returns {string} The formatted month and year string (e.g., "Juin 2024")
 */
export const formatMonthYear = (date, locale = LOCALE_DEFAULT) => {
	if (!date) return "";
	const dateObj = date instanceof Date ? date : new Date(date);
	return dateObj.toLocaleDateString(locale, {
		month: "long",
		year: "numeric",
	});
};

/**
 * Format date with short month representation
 * @param {Date|string} date - The date to format
 * @param {string} locale - The locale to use for formatting
 * @returns {string} The formatted date with short month (e.g., "15 juin")
 */
export const formatShortDate = (date, locale = LOCALE_DEFAULT) => {
	if (!date) return "";
	const dateObj = date instanceof Date ? date : new Date(date);
	return dateObj.toLocaleDateString(locale, {
		day: "numeric",
		month: "short",
	});
};

/**
 * Format date in custom format with day, short month and year
 * @param {Date|string} date - The date to format
 * @param {string} locale - The locale to use for formatting
 * @returns {string} The formatted date (e.g., "15 juin 2024")
 */
export const formatDateCustom = (date, locale = LOCALE_DEFAULT) => {
	if (!date) return "";
	const dateObj = date instanceof Date ? date : new Date(date);
	return dateObj.toLocaleDateString(locale, {
		day: "numeric",
		month: "short",
		year: "numeric"
	});
};

/**
 * Format date and time with weekday
 * @param {Date|string} date - The date to format
 * @param {string} locale - The locale to use for formatting
 * @returns {string} The formatted date and time string
 */
export const formatDateTime = (date, locale = LOCALE_DEFAULT) => {
	if (!date) return "";

	const dateObj = date instanceof Date ? date : new Date(date);
	return dateObj.toLocaleDateString(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

/**
 * Format time only
 * @param {Date|string} date - The date to extract time from
 * @param {string} locale - The locale to use for formatting
 * @returns {string} The formatted time string
 */
export const formatTime = (date, locale = LOCALE_DEFAULT) => {
	if (!date) return "";

	const dateObj = date instanceof Date ? date : new Date(date);
	return dateObj.toLocaleTimeString(locale, {
		hour: "2-digit",
		minute: "2-digit",
	});
};

/**
 * Convert a date to ISO string format
 * @param {Date|string} date - The date to format
 * @returns {string} The ISO string representation of the date
 */
export const formatISOString = (date) => {
	// Ensure date is a Date object
	const dt = date instanceof Date ? date : new Date(date);
	return dt.toISOString();
};

/**
 * Check if a given date is today
 * @param {Date|string} date - The date to check
 * @returns {boolean} True if the date is today, false otherwise
 */
export const isToday = (date) => {
	if (!date) return false;

	const inputDate = date instanceof Date ? date : new Date(date);
	const today = new Date();

	return (
		inputDate.getDate() === today.getDate() &&
		inputDate.getMonth() === today.getMonth() &&
		inputDate.getFullYear() === today.getFullYear()
	);
};

/**
 * Check if a date is in the past
 * @param {Date|string} date - The date to check
 * @returns {boolean} True if the date is in the past, false otherwise
 */
export const isPast = (date) => {
	if (!date) return false;
	const inputDate = date instanceof Date ? date : new Date(date);
	return inputDate < new Date();
};

/**
 * Format file size in bytes to human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Human-readable size (e.g., "2.5 MB")
 */
export const formatFileSize = (bytes) => {
	if (!bytes || isNaN(bytes)) return "Unknown";

	const units = ["B", "KB", "MB", "GB"];
	let size = bytes;
	let unitIndex = 0;

	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}

	return `${size.toFixed(1)} ${units[unitIndex]}`;
};

/**
 * Calculate time difference between now and a target date
 * @param {Date|string} targetDate - The target date to compare with
 * @param {string} locale - The locale to use for formatting
 * @returns {string} Formatted time difference
 */
export const timeUntil = (targetDate, locale = LOCALE_DEFAULT) => {
	if (!targetDate) return "";

	const now = new Date();
	const meetingStart = new Date(targetDate);

	if (now >= meetingStart) return "";

	const diffMs = meetingStart - now;
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffHours = Math.floor(
		(diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
	);
	const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

	const pluralize = (value, singular, plural) =>
		`${value} ${value > 1 ? plural : singular}`;

	if (diffDays > 0) {
		return `Dans ${pluralize(diffDays, "jour", "jours")} et ${pluralize(diffHours, "heure", "heures")}`;
	}

	if (diffHours > 0) {
		return `Dans ${pluralize(diffHours, "heure", "heures")} et ${pluralize(diffMinutes, "minute", "minutes")}`;
	}

	return `Dans ${pluralize(diffMinutes, "minute", "minutes")}`;
};
