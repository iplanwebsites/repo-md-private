import { marked } from "marked";
import { formatDate } from "./dateUtils";

/**
 * Formatting utilities for text transformation
 */

export const formatMdText = (mdText) => {
	if (!mdText) return "";
	return marked.parse(mdText);
};

export const formatCurrency = (amount, currency = "USD", locale = "en-US") => {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: currency,
	}).format(amount);
};

// Export formatDate for backward compatibility
export { formatDate };

export const truncateText = (text, length, suffix = "...") => {
	if (!text || text.length <= length) return text;
	return text.substring(0, length - suffix.length) + suffix;
};

export const nl2br = (text) => {
	return text.replace(/\n/g, "<br>");
};

export const stripHtml = (html) => {
	return html.replace(/<[^>]*>/g, "");
};

export const slugify = (text) => {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.trim();
};

export const capitalizeWords = (text) => {
	return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
};
