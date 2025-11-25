// utils/loadScript.js

const loadedScripts = new Set();

export function loadScript(src) {
	return new Promise((resolve, reject) => {
		// Check if script is already loaded
		if (loadedScripts.has(src)) {
			resolve();
			return;
		}

		// Create script element
		const script = document.createElement("script");
		script.src = src;
		script.async = true;
		script.defer = true;

		// Handle script load and error
		script.onload = () => {
			loadedScripts.add(src); // Mark script as loaded
			resolve();
		};

		script.onerror = () => {
			reject(new Error(`Failed to load script: ${src}`));
		};

		// Append to document head
		document.head.appendChild(script);
	});
}
