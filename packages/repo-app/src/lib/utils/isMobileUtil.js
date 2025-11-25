/**
 * Utility to detect if the current device is a mobile device
 * Can be imported and used across different components
 */

/**
 * Checks if the current device is a mobile device based on user agent and screen width
 * @returns {boolean} true if mobile device is detected, otherwise false
 */
export function isMobile() {
	// Using browser's navigator object to check user agent
	if (typeof navigator !== "undefined" && typeof window !== "undefined") {
		const userAgent = navigator.userAgent.toLowerCase();
		const mobileKeywords = [
			"android",
			"iphone",
			"ipad",
			"ipod",
			"blackberry",
			"windows phone",
			"opera mini",
			"mobile",
			"tablet",
		];

		// Check user agent for mobile keywords
		const isMobileByUserAgent = mobileKeywords.some(
			(keyword) => userAgent.indexOf(keyword) !== -1,
		);

		// Also check screen width as a fallback or additional check
		// Common breakpoint for mobile devices (768px)
		const isMobileByScreenWidth = window.innerWidth < 768;

		return isMobileByUserAgent || isMobileByScreenWidth;
	}

	// Default to false if we're in a non-browser environment
	return false;
}

export default isMobile;
