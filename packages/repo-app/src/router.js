import {
	createMemoryHistory,
	createRouter,
	createWebHistory,
} from "vue-router";

import { usePageTitle } from "@/lib/utils/vueUtils";

// import HomeView from "./view/ref_self/Dashboard.vue";
const cat = "gfd";
import HomeRouter from "./view/HomeRouter.vue";

import { appConfigs } from "@/appConfigs.js";
const { BRAND } = appConfigs;

// Scroll behavior constants for settings pages
const SCROLL_CONSTANTS = {
	// Height of the header (navbar + page heading)
	// This should match the sticky top position of sidebars
	HEADER_HEIGHT: 200, // Increased from 128 to account for full header
	
	// Dead zone - if scroll position is within this range, don't auto-scroll
	// This prevents annoying small jumps when slightly scrolled
	SCROLL_DEAD_ZONE: 150, // Increased from 200 for better UX
};

// Import account settings routes
import accountSettingsRoutes from './router_account_settings';

const commonMistakePath = [
	"img",
	"public",
	"static",
	"staticfiles",
	"js",
	"css",
	"assets",
	"media",
	"auth",
];

// Add routes for common mistake paths to redirect to 404
const mistakePathRoutes = commonMistakePath.map((path) => ({
	path: `/${path}/:pathMatch(.*)`,
	name: `mistake-${path}`,
	component: () => import("@/view/Page404.vue"),
	meta: { title: "404" },
}));

const routes = [
	...accountSettingsRoutes,
	{
		path: "/",
		name: "home",
		component: HomeRouter,
		meta: { title: "Home" },
	},
	{
		path: "/home",
		name: "landing",
		component: () => import("@/view/brochure/BrochureHome.vue"),
		meta: { title: BRAND, menu: "brochure" },
	},
	{
		path: "/waitlist",
		name: "waitlist",
		component: () => import("@/view/WaitlistPage.vue"),
		meta: { title: "Join Waitlist", menu: "brochure" },
	},
	{
		path: "/new",
		name: "new",
		component: () => import("@/view/New.vue"),
		meta: { title: "New Project", menu: "project", footer: "app" },
	},
	{
		path: "/new/clone",
		name: "NewClone",
		component: () => import("@/view/NewClone.vue"),
		meta: { title: "New Project", menu: "none", footer: "app" },
	},
	{
		path: "/new/import",
		name: "NewImport",
		component: () => import("@/view/NewImport.vue"),
		meta: { title: "Import Repository", menu: "none", footer: "app" },
	},
	{
		path: "/pricing",
		component: () => import("@/view/Pricing.vue"),
		meta: { title: "Pricing" },
	},
	{
		path: "/upgrade",
		component: () => import("@/view/Pricing.vue"),
		meta: { title: "Upgrade" },
	},
	{
		path: "/templates",
		name: "BrochureTemplate",
		component: () => import("@/view/BrochureTemplate.vue"),
		meta: { title: "New Project" },
	},
	{
		path: "/new/:orgId/templates",
		name: "NewTemplate",
		component: () => import("@/view/NewTemplate.vue"),
		meta: { title: "New Project", menu: "none" },
	},
	{
		path: "/new/:orgId/templates/:templateId",
		name: "TemplateDetail1",
		component: () => import("@/view/TemplateDetail.vue"),
		meta: { title: "New Project", menu: "none" },
	},
	{
		path: "/templates/:templateId",
		name: "TemplateDetail2",
		component: () => import("@/view/TemplateDetail.vue"),
		meta: { title: "New Project" },
	},
	{
		path: "/site-demo/:templateId",
		name: "SiteDemos",
		component: () => import("@/view/SiteDemos.vue"),
		meta: { title: "Site Demo", menu: "none" },
	},
	{
		path: "/themes",
		name: "BrochureTheme",
		component: () => import("@/view/BrochureTheme.vue"),
		meta: { title: "New Theme" },
	},

	{
		path: "/themes/:themeId",
		name: "ThemeDetail2",
		component: () => import("@/view/ThemeDetail.vue"),
		meta: { title: "New Theme" },
	},
	{
		path: "/login",
		name: "login",
		component: () => import("@/components/auth/Auth.vue"),
		meta: { title: "Login" },
	},
	{
		path: "/signup",
		name: "signup",
		component: () => import("@/components/auth/Auth.vue"),
		meta: { title: "Sign up" },
	},
	{
		path: "/preview-login",
		name: "beta-login",
		component: () => import("@/components/auth/Auth.vue"),
		meta: { title: "Login", isBetaRoute: true },
	},
	{
		path: "/preview-signup",
		name: "beta-signup",
		component: () => import("@/components/auth/Auth.vue"),
		meta: { title: "Sign up", isBetaRoute: true },
	},

	///////// //  / / / / / //

	{
		path: "/styleguide",
		name: "convo",
		component: () => import("@/view/Styleguide.vue"),
		meta: { title: "s" },
	},

	{
		path: "/blog",
		name: "blogListing",
		component: () => import("@/view/Blogs.vue"),
		meta: { title: "Blog" }, // menu: "brochure"
	},

	{
		path: "/blog/:slug", // "/blog/:pathMatch(.*)*",
		name: "blogArticle",
		component: () => import("@/view/BlogArticle.vue"),
		meta: { title: "Blog" },
	},

	////////
	{
		path: "/auth",
		name: "auth",
		component: () => import("@/components/auth/Auth.vue"),
		meta: { title: "Authentication" },
	},
	///

	// Settings routes are now defined in accountSettingsRoutes

	{
		path: "/help",
		name: "help",
		component: () => import("@/view/Help.vue"),
		meta: { title: "Help" },
	},

	/// admin console
	{
		path: "/admin",
		name: "admin",
		component: () => import("@/view/admin/AdminConsole.vue"),
		meta: { title: "Admin", requiresAdmin: true },
		children: [
			{
				path: "supa",
				name: "supa2",
				component: () => import("@/view/SupaDebug.vue"),
				meta: { title: "Supa Debug", requiresAdmin: true },
			},

			{
				path: "media",
				name: "AdminMedias",
				component: () => import("@/view/admin/AdminMedias.vue"),
				meta: { title: "Admin - Medias", requiresAdmin: true },
			},
			{
				path: "db/:collection?",
				name: "AdminDb",
				component: () => import("@/view/admin/AdminDbData.vue"),
				meta: { title: "Admin - DB", requiresAdmin: true },
			},
			{
				path: "blocks",
				name: "AdminBlocks",
				component: () => import("@/view/admin/AdminBlockEditor.vue"),
				meta: { title: "Admin - Block Editor", requiresAdmin: true },
			},
			{
				path: "waitlist",
				name: "AdminWaitlist",
				component: () => import("@/view/admin/AdminWaitlist.vue"),
				meta: { title: "Admin - Waitlist", requiresAdmin: true },
			},
			// Management Routes
			{
				path: "users",
				name: "AdminUsers",
				component: () => import("@/view/admin/AdminUsers.vue"),
				meta: { title: "Admin - Users", requiresAdmin: true },
			},
			{
				path: "organizations",
				name: "AdminOrganizations",
				component: () => import("@/view/admin/AdminOrganizations.vue"),
				meta: { title: "Admin - Organizations", requiresAdmin: true },
			},
			{
				path: "projects",
				name: "AdminProjects",
				component: () => import("@/view/admin/AdminProjects.vue"),
				meta: { title: "Admin - Projects", requiresAdmin: true },
			},
			{
				path: "deployments",
				name: "AdminDeployments",
				component: () => import("@/view/admin/AdminDeployments.vue"),
				meta: { title: "Admin - Deployments", requiresAdmin: true },
			},
			// Content & Storage Routes
			{
				path: "r2-storage",
				name: "AdminR2Storage",
				component: () => import("@/view/admin/AdminR2Storage.vue"),
				meta: { title: "Admin - R2 Storage", requiresAdmin: true },
			},
			{
				path: "notes",
				name: "AdminNotes",
				component: () => import("@/view/admin/AdminNotes.vue"),
				meta: { title: "Admin - Notes", requiresAdmin: true },
			},
			// Technical Routes
			{
				path: "jobs",
				name: "AdminJobs",
				component: () => import("@/view/admin/AdminJobs.vue"),
				meta: { title: "Admin - Jobs", requiresAdmin: true },
			},
			{
				path: "git-events",
				name: "AdminGitEvents",
				component: () => import("@/view/admin/AdminGitEvents.vue"),
				meta: { title: "Admin - Git Events", requiresAdmin: true },
			},
			{
				path: "webhooks",
				name: "AdminWebhooks",
				component: () => import("@/view/admin/AdminWebhooks.vue"),
				meta: { title: "Admin - Webhooks", requiresAdmin: true },
			},
			// Overview Routes (placeholders for future)
			{
				path: "kpis",
				name: "AdminKPIs",
				component: () => import("@/view/admin/AdminKPIs.vue"),
				meta: { title: "Admin - KPIs", requiresAdmin: true },
			},
			{
				path: "revenue",
				name: "AdminRevenue",
				component: () => import("@/view/admin/AdminRevenue.vue"),
				meta: { title: "Admin - Revenue", requiresAdmin: true },
			},
			{
				path: "status",
				name: "AdminStatus",
				component: () => import("@/view/admin/AdminStatus.vue"),
				meta: { title: "Admin - Status", requiresAdmin: true },
			},

			{
				path: ":pathMatch(.*)*",
				name: "NotFoundAdmin",
				component: () => import("@/view/Page404.vue"),
				meta: { title: "Admin - 404", requiresAdmin: true },
			},
		],
	},

	{
		path: "/404",
		name: "404",
		component: () => import("@/view/Page404.vue"),
		meta: { title: "404" },
	},
	/// BROCHURE pages
	{
		path: "/products",
		redirect: "/home",
	},

	{
		path: "/solutions",
		redirect: "/home",
	},

	{
		path: "/products/:id",
		name: "ProductPage",
		component: () => import("@/view/brochure/BrochurePage.vue"),
		meta: { title: "Products", menu: "brochure" },
	},
	{
		path: "/solutions/:id",
		name: "SolutionPage",
		component: () => import("@/view/brochure/BrochurePage.vue"),
		meta: { title: "Solutions", menu: "brochure" },
	},

	{
		path: "/guides",
		name: "guidesListing",
		component: () => import("@/view/Guides.vue"),
		meta: { title: "Guides" },
	},
	{
		path: "/guides/:slug",
		name: "guideArticle",
		component: () => import("@/view/BlogArticle.vue"),
		meta: { title: "Guide Article" },
	},

	{
		path: "/docs",
		//name: "NotFound",
		component: () => import("@/view/Docs.vue"),
		meta: { title: "Docs", menu: "brochure" },
	},
	{
		path: "/docs/:pathMatch(.*)*",
		//name: "NotFound",@/view/Styleguide.vue
		component: () => import("@/view/Docs.vue"),
		meta: { title: "Docs", menu: "brochure" },
	},

	{
		path: "/contact",
		name: "contact",
		component: () => import("@/view/brochure/ContactPage.vue"),
		meta: { title: "Contact Us", menu: "brochure" },
	},
	{
		path: "/about",
		name: "about",
		component: () => import("@/view/brochure/AboutPage.vue"),
		meta: { title: "About Us", menu: "brochure" },
	},
	{
		path: "/careers",
		name: "careers",
		component: () => import("@/view/brochure/CareersPage.vue"),
		meta: { title: "Careers", menu: "brochure" },
	},
	{
		path: "/discord",
		name: "discord",
		component: () => import("@/view/DiscordRedirect.vue"),
		meta: { title: "Discord Redirect", menu: "brochure" },
	},
	{
		path: "/legal/:id",
		//name: "NotFound",
		component: () => import("@/view/Legal.vue"),
		//meta: { title: "Not found" },
	},

	/// TEAM + PROJECTS routes
	...mistakePathRoutes,
	// Standalone chat task route - not nested to avoid dashboard chrome
	{
		path: "/:orgId/:projectId/chat/:taskId",
		name: "ProjectChatTask",
		component: () => import("@/view/project/ChatTask.vue"),
		meta: { title: "Chat Task", menu: "none" },
	},
	// Standalone org chat task route - not nested to avoid dashboard chrome
	{
		path: "/:orgId/~/chat/:taskId",
		name: "OrgChatTask",
		component: () => import("@/view/project/ChatTask.vue"),
		meta: { title: "Org Chat Task", menu: "none" },
	},
	{
		path: "/:orgId",
		name: "Org",
		component: () => import("@/view/Org.vue"),
		meta: { title: "Projects", menu: "project" },
		children: [
			{
				//integrations
				path: "",
				name: "OrgHome",
				component: () => import("@/view/OrgHome.vue"),
			},
			{
				path: "~",
				name: "orgTild",
				component: () => import("@/view/OrgTild.vue"),
				meta: { title: "Org" },
				children: [
					{
						//integrations
						path: "settings/:section?",
						name: "OrgSettings",
						component: () => import("@/view/OrgSettings.vue"),
					},
					{
						path: "webhooks",
						name: "OrgWebhooks",
						component: () => import("@/view/OrgWebhooks.vue"),
					},
					{
						path: "chat",
						name: "OrgChat",
						component: () => import("@/view/OrgChat.vue"),
					},
					{
						//integrations
						path: "integrations",
						name: "OrgIntegrations",
						component: () => import("@/view/OrgHome.vue"),
					},
					{
						path: "integrations/slack",
						name: "OrgSlackIntegration",
						component: () => import("@/view/OrgSlackIntegration.vue"),
						meta: { title: "Slack Integration" },
					},
					{
						//integrations
						path: "activity",
						name: "OrgIntegrations2",
						component: () => import("@/view/OrgHome.vue"),
					},
					{
						path: ":notFound",
						name: "NotFoundOrg2",
						component: () => import("@/view/Page404.vue"),
						meta: { title: "Not found" },
					},
				],
			},
			// Project defailt page:
		],
	},
	{
		path: "/:orgId/:projectId",
		name: "Project",
		component: () => import("@/view/Project.vue"),
		meta: { title: "Project", menu: "project" },
		children: [
			{
				//integrations
				path: "",
				name: "ProjectHome",
				component: () => import("@/view/ProjectHome.vue"),
			},
			{
				path: "chat",
				name: "ProjectChat",
				component: () => import("@/view/project/ProjectChat.vue"),
			},
			{
				path: "editor-agent",
				name: "ProjectEditorAgent",
				component: () => import("@/view/project/EditorAgent.vue"),
				meta: { noFooter: true },
			},
			{
				path: "tasks",
				name: "ProjectTasks",
				component: () => import("@/view/project/Tasks.vue"),
			},
			{
				path: "deployments",
				name: "ProjectDeployments",
				component: () => import("@/view/ProjectDeployments.vue"),
			},
			{
				path: "webhooks",
				name: "ProjectWebhooks",
				component: () => import("@/view/ProjectWebhooks.vue"),
			},
			{
				path: "site",
				name: "Project54",
				component: () => import("@/view/ProjectSite.vue"),
			},
			{
				path: "mcp",
				name: "Project548",
				component: () => import("@/view/ProjectMcp.vue"),
			},
			{
				path: "agent",
				name: "Project5481223",
				component: () => import("@/view/ProjectAgent.vue"),
			},
			{
				path: "api",
				name: "Project5499",
				component: () => import("@/view/ProjectApi.vue"),
			},

			{
				path: "ai",
				name: "ProjectAI",
				component: () => import("@/view/ProjectAI.vue"),
			},
			{
				path: "db",
				name: "ProjectDB",
				component: () => import("@/view/ProjectDB.vue"),
			},
			{
				path: "source",
				name: "ProjectSourceEditor",
				component: () => import("@/view/project/ProjectSourceEditor.vue"),
				meta: { title: "Source Editor", menu: "project" },
			},
			{
				path: "code-editor",
				name: "ProjectCodeEditor",
				component: () => import("@/view/project/ProjectCodeEditor.vue"),
				meta: { title: "Code Editor", menu: "project" },
			},
			{
				//integrations
				path: "settings",
				name: "ProjectSettings",
				component: () => import("@/view/projectSettings/ProjectSettings.vue"),
				redirect: { name: "ProjectSettingsGeneral" },
				children: [
					{
						path: "general",
						name: "ProjectSettingsGeneral",
						component: () => import("@/view/projectSettings/tabs/GeneralTab.vue"),
					},
					{
						path: "theme",
						name: "ProjectSettingsTheme",
						component: () => import("@/view/projectSettings/tabs/SiteThemeTab.vue"),
					},
					{
						path: "media",
						name: "ProjectSettingsMedia",
						component: () => import("@/view/projectSettings/tabs/MediaTab.vue"),
					},
					{
						path: "formatting",
						name: "ProjectSettingsFormatting",
						component: () => import("@/view/projectSettings/tabs/FormattingTab.vue"),
					},
					{
						path: "variables",
						name: "ProjectSettingsFrontmatter",
						component: () => import("@/view/projectSettings/tabs/FrontmatterTab.vue"),
					},
					{
						path: "ai",
						name: "ProjectSettingsAI",
						component: () => import("@/view/projectSettings/tabs/AIAgentTab.vue"),
					},
					{
						path: "integrations",
						name: "ProjectSettingsIntegrations",
						component: () => import("@/view/projectSettings/tabs/IntegrationsTab.vue"),
					},
					{
						path: "secrets",
						name: "ProjectSettingsSecrets",
						component: () => import("@/view/projectSettings/tabs/SecretsTab.vue"),
					},
					{
						path: "build",
						name: "ProjectSettingsBuild",
						component: () => import("@/view/projectSettings/tabs/BuildDeployTab.vue"),
					},
					{
						path: "domains",
						name: "ProjectSettingsDomains",
						component: () => import("@/view/projectSettings/tabs/DomainsTab.vue"),
					},
					{
						path: "webhooks",
						name: "ProjectSettingsWebhooks",
						component: () => import("@/view/projectSettings/tabs/WebhooksTab.vue"),
					},
				],
			},

			/*
      {
        path: ":notFound",
        name: "NotFoundProj2",
        component: () => import("@/view/Page404.vue"),
        meta: { title: "Not found" },
      },*/

			//deployments
		],
	},
	{
		path: "/:orgId/:projectId/:deployId",
		name: "Deploy",
		component: () => import("@/view/Deploy.vue"),
		meta: { title: "Deployment", menu: "project" },
		children: [
			{
				//integrations
				path: "",
				name: "ProjectHome55555",
				component: () => import("@/view/DeployHome.vue"),
			},

			{
				path: "notes",
				name: "DeployNotes",
				component: () => import("@/view/DeployPosts.vue"),
			},
			{
				path: "posts",
				name: "DeployPosts",
				component: () => import("@/view/DeployPosts.vue"),
			},
			{
				path: "graph",
				name: "DeployGraph",
				component: () => import("@/view/DeployGraph.vue"),
			},
			{
				path: "medias",
				name: "DeployMedias",
				component: () => import("@/view/DeployMedias.vue"),
			},
			{
				path: "spec",
				name: "DeploySpec",
				component: () => import("@/view/DeploySpec.vue"),
			},
			{
				path: "source",
				name: "DeploySource",
				component: () => import("@/view/DeploySource.vue"),
			},
			{
				path: "logs",
				name: "DeployLogs",
				component: () => import("@/view/DeployLogs.vue"),
			},
			{
				path: "sqlite",
				name: "DeploySqlite",
				component: () => import("@/view/DeploySqlite.vue"),
			},
			{
				path: "issues",
				name: "DeployIssues",
				component: () => import("@/view/DeployIssues.vue"),
			},

			{
				path: ":notFound",
				name: "NotFoundProj25555",
				component: () => import("@/view/Page404.vue"),
				meta: { title: "Not found" },
			},

			//deployments
		],
	},
	{
		path: "/blitz",
		name: "BlitzEditorDemo",
		component: () => import("@/view/BlitzEditorDemo.vue"),
		meta: { title: "StackBlitz Demo" },
	},
	{
		path: "/:pathMatch(.*)*",
		name: "NotFound",
		component: () => import("@/view/Page404.vue"),
		meta: { title: "Not found" },
	},
];

const router = createRouter({
	history: createWebHistory(),
	routes,
	scrollBehavior(to, from, savedPosition) {
		// If there's a saved position (e.g., navigating back/forward), return it
		if (savedPosition) {
			return savedPosition;
		}

		// For settings pages, smart scroll when switching between tabs
		if (to.path.includes('/settings/') && from.path.includes('/settings/')) {
			// Check if we're just switching tabs within the same project settings
			const toBase = to.path.substring(0, to.path.lastIndexOf('/settings/'));
			const fromBase = from.path.substring(0, from.path.lastIndexOf('/settings/'));
			if (toBase === fromBase) {
				// We're switching tabs in the same settings page
				const currentScroll = window.scrollY || window.pageYOffset;
				
				// If we're within the dead zone, don't scroll at all
				// This prevents annoying small scrolls up or down
				if (currentScroll <= SCROLL_CONSTANTS.SCROLL_DEAD_ZONE) {
					return false;
				}
				
				// If we're scrolled down significantly, scroll to just below header
				// Use smooth behavior to make it less jarring
				return { 
					top: SCROLL_CONSTANTS.HEADER_HEIGHT, 
					behavior: 'smooth' 
				};
			}
		}

		// Always scroll to the top when navigating to a new route
		return { top: 0 };
	},
});

import { supabase } from "@/lib/supabaseClient";
import { isAdmin } from "@/lib/auth";

router.beforeEach(async (to, from, next) => {
	// Use our title utility directly in router for faster title updates
	// This happens before component is mounted, eliminating the delay
	/*
	usePageTitle({
		title: to.meta.title ? () => to.meta.title : () => null,
		brand: BRAND,
		titleFirst: true
	});
	*/

	// Check if in waitlist mode and trying to access login or signup pages
	// Allow homepage and beta routes to be visible in waitlist mode
	if (appConfigs.WAITLIST_MODE && to.path !== '/' && 
		!to.meta.isBetaRoute && // Skip check for beta routes
		(to.name === 'login' || to.name === 'signup')) {
		return next({ name: 'waitlist' });
	}

	// Check if the route requires authentication (has menu="project")
	if (to.meta.menu === "project") {
		try {
			// Get current session
			const { data } = await supabase.auth.getSession();
			const session = data.session;

			// If no session, redirect to login page
			if (!session) {
				console.log("Access denied: Authentication required for this route");
				return next({ 
					name: appConfigs.WAITLIST_MODE ? 'waitlist' : 'login',
					query: { redirect: to.fullPath } // Save the intended destination for after login
				});
			}
		} catch (error) {
			console.error("Error checking authentication status:", error);
			return next({ name: 'login' });
		}
	}

	// Check if the route requires admin access
	if (to.path.startsWith("/admin") || to.meta.requiresAdmin) {
		try {
			// Get current session
			const { data } = await supabase.auth.getSession();
			const session = data.session;

			// If no session, redirect to login or waitlist depending on mode
			if (!session) {
				console.log("Access denied: Not logged in");
				return next({ name: appConfigs.WAITLIST_MODE ? 'waitlist' : 'login' });
			}

			// Check if user is admin
			const user = session.user;
			const userIsAdmin = await isAdmin(user);

			if (!userIsAdmin) {
				// User is logged in but not an admin
				console.log("Access denied: Not an admin");
				return next({ name: 'home' });
			}
		} catch (error) {
			console.error("Error checking admin status:", error);
			return next({ name: 'home' });
		}
	}

	next();
});

export default router;
