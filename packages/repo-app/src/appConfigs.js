import { isLocalhost } from "@/lib/utils/devUtils.js";
const isDev = isLocalhost();

// https://github.com/organizations/repo-md/settings/apps/repo-md
const GITHUB_CLIENT_ID = "Iv23li3idOHWIfGYUG4U";

export const appConfigs = {
	// -----------------------------------
	// DO NOT PUT SENSITIVE DATA HERE
	// USE .env files for that
	// These vars are exposed to the client
	// -----------------------------------
	WAITLIST_MODE:  !isDev, //true,
	GITHUB_CLIENT_ID,
	BRAND: "repo.md",
	ENABLE_SENTRY: false, // Disable Sentry for now until project is configured
	SENTRY_DSN: "",
	DISCORD_URL: "https://discord.gg/X4WTX8Ab2x",
	NPM_URL: "https://www.npmjs.com/package/repo-md",
	JS_SDK_PLAYGROUND_URL:  'https://playground.repo.md/', //'https://repo-md.github.io/repo-md/',// generated from SDK source
	GITHUB_APP_PUBLIC_URL: "https://github.com/apps/repo-md",
	GITHUB_REVIEW_ACCESS_URL:
		"https://github.com/settings/connections/applications/" + GITHUB_CLIENT_ID, //https://github.com/settings/connections/applications/:client_id
	//ext SSS "https://680ce8690aa8d98835257ca0d265d7b5@o4508876310183936.ingest.us.sentry.io/4508876496961536",

	USE_DEV_API_IN_DEV:
		(import.meta.env.VITE_USE_DEV_API_IN_DEV ?? "false") === "true",

	USE_DEV_STATIC_IN_DEV:
		(import.meta.env.VITE_USE_DEV_STATIC_IN_DEV ?? "false") === "false",

	USE_SENTRY_IN_DEV:
		(import.meta.env.VITE_USE_SENTRY_IN_DEV ?? "true") === "true",
	API_DOMAIN: import.meta.env.VITE_API_DOMAIN ?? "https://api.repo.md",
	STATIC_DOMAIN: "https://static.repo.md",
	DEV_API_DOMAIN:
		import.meta.env.VITE_DEV_API_DOMAIN ?? "http://localhost:5599",

	get apiUrl() {
		return isDev && this.USE_DEV_API_IN_DEV
			? this.DEV_API_DOMAIN
			: this.API_DOMAIN;
	},
	get staticDomain() {
		return isDev && this.USE_DEV_STATIC_IN_DEV
			? this.DEV_API_DOMAIN
			: this.STATIC_DOMAIN;
	},
	// AGORA_APP_ID: "5d413b3e17454228905ae4aa7a663723", //pushmd v1
	// AGORA_APP_ID: "f30692374bc14ad9bba1240492f145d7", //pushmd v2 https://console.agora.io/v2/project-management
	//  AGORA_LOG_LEVEL: 3, // 0: debug, 1: info, 2: warning, 3: error, 4: none
	SUPA_ID: "opyimzzocrxtrrklxaay",
	SUPA_CLIENTTOKEN_URL:
		"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9weWltenpvY3J4dHJya2x4YWF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNjIxODgsImV4cCI6MjA2MDczODE4OH0.ajZis_OxaarhnRyc5Sje_GoYfuWdYKtoG67b3IGTp7E",

	GITHUB_APP_URL:
		//to let user edits controls...
		"https://github.com/settings/connections/applications/Ov23lia1geAF70oiGMas",
};
