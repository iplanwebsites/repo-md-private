import {
	User,
	Globe,
	Image,
	Edit,
	Terminal,
	Bot,
	Puzzle,
	Key,
	Server,
	Link,
	Webhook,
	Code,
} from "lucide-vue-next";

export const navSections = [
	{ id: "general", name: "General", icon: User },
	{ id: "theme", name: "Site Theme", icon: Globe },
	{ id: "media", name: "Media", icon: Image },
	{ id: "formatting", name: "Formatting", icon: Edit },
	{ id: "variables", name: "Frontmatter", icon: Terminal },
	{ id: "ai", name: "AI Agent Editor Behavior", icon: Bot },
	{ id: "integrations", name: "Integrations", icon: Puzzle },
	{ id: "secrets", name: "Secrets", icon: Key },
	{ id: "build", name: "Build and Deployment", icon: Server },
	{ id: "domains", name: "Domains", icon: Link },
	{ id: "webhooks", name: "Webhooks", icon: Webhook },
];

// Future sections (commented out in original)
// { id: "environments", name: "Environments", icon: Server },
// { id: "envVariables", name: "Environment Variables", icon: FileText },
// { id: "git", name: "Git", icon: BadgeAlert },
// { id: "deployment", name: "Deployment Protection", icon: Shield },
// { id: "functions", name: "Functions", icon: Server },
// { id: "dataCache", name: "Data Cache", icon: Server },