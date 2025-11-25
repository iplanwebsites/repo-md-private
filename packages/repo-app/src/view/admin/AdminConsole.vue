<script setup>
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
	SidebarProvider,
} from "@/components/ui/sidebar";
import {
	Settings,
	Image,
	Bike,
	Gift,
	Users,
	Bug,
	Activity,
	BarChart,
	LogOut,
	File,
	User,
	CreditCard,
	Home,
	Shield,
	ArrowLeft,
	Calendar,
	Database,
	LayoutTemplate,
	Blocks,
	ClipboardList,
	Cloud,
	Building,
	FolderKanban,
	Rocket,
	Briefcase,
	GitBranch,
	Webhook,
	FileText,
} from "lucide-vue-next";
import { computed, ref, toRefs } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { Button } from "@/components/ui/button";

// Props and Authentication
const props = defineProps(["session"]);
const { session } = toRefs(props);
const loading = ref(false);

// User data
const user = computed(() => ({
	email: session.value?.user?.email || "",
	avatar: session.value?.user?.user_metadata?.avatar_url || "",
	name:
		session.value?.user?.user_metadata?.full_name ||
		session.value?.user?.email?.split("@")[0] ||
		"",
}));

// Router integration for active state detection
const route = useRoute();

// Check if a route is active
const isRouteActive = (url) => {
	// Exact match for the admin route
	if (url === "/admin" && route.path === "/admin") {
		return true;
	}
	// For other routes, check if the current path starts with the url
	return url !== "/admin" && route.path.startsWith(url);
};

// Navigation items with admin sections
const navItems = {
	overview: {
		title: "Overview",
		items: [
			{
				title: "Dashboard",
				icon: Shield,
				url: "/admin",
				standalone: true,
			},
			{
				title: "KPIs",
				icon: BarChart,
				url: "/admin/kpis",
				standalone: true,
			},
			{
				title: "Revenue",
				icon: CreditCard,
				url: "/admin/revenue",
				standalone: true,
			},
			{
				title: "Status",
				icon: Activity,
				url: "/admin/status",
				standalone: true,
			},
		],
	},
	management: {
		title: "Management",
		items: [
			{
				title: "Users",
				icon: Users,
				url: "/admin/users",
				standalone: true,
			},
			{
				title: "Organizations",
				icon: Building,
				url: "/admin/organizations",
				standalone: true,
			},
			{
				title: "Projects",
				icon: FolderKanban,
				url: "/admin/projects",
				standalone: true,
			},
			{
				title: "Deployments",
				icon: Rocket,
				url: "/admin/deployments",
				standalone: true,
			},
			{
				title: "Waitlist",
				icon: ClipboardList,
				url: "/admin/waitlist",
				standalone: true,
			},
		],
	},
	content: {
		title: "Content & Storage",
		items: [
			{
				title: "Media Files",
				icon: Image,
				url: "/admin/media",
				standalone: true,
			},
			{
				title: "R2 Storage",
				icon: Cloud,
				url: "/admin/r2-storage",
				standalone: true,
			},
			{
				title: "Notes",
				icon: FileText,
				url: "/admin/notes",
				standalone: true,
			},
			{
				title: "Block Editor",
				icon: LayoutTemplate,
				url: "/admin/blocks",
				standalone: true,
			},
		],
	},
	technical: {
		title: "Technical",
		items: [
			{
				title: "Jobs",
				icon: Briefcase,
				url: "/admin/jobs",
				standalone: true,
			},
			{
				title: "Git Events",
				icon: GitBranch,
				url: "/admin/git-events",
				standalone: true,
			},
			{
				title: "Webhooks",
				icon: Webhook,
				url: "/admin/webhooks",
				standalone: true,
			},
			{
				title: "DB Explorer",
				icon: Database,
				url: "/admin/db",
				standalone: true,
			},
			{
				title: "Auth Debug",
				icon: Bug,
				url: "/admin/supa",
				standalone: true,
			},
		],
	},
};

// Sign out function
async function signOut() {
	try {
		loading.value = true;
		// Replace with your signout function
		console.log("Signing out");
	} catch (error) {
		console.log(error);
	} finally {
		loading.value = false;
	}
}
</script>

<template>
  <div class="admin-layout">
    <!-- Sidebar -->
    <div class="sidebarCol">
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <!-- Header -->
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <div class="logo">
                  <RouterLink to="/admin" class="block p-4">
                    <h2 class="text-xl font-bold mt-9">Admin Console</h2>
                  </RouterLink>
                </div>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <!-- Main Navigation Content -->
          <SidebarContent>
            <SidebarGroup
              v-for="(section, sectionKey) in navItems"
              :key="sectionKey"
            >
              <SidebarGroupLabel>{{ section.title }}</SidebarGroupLabel>
              <SidebarMenu>
                <template v-for="item in section.items" :key="item.title">
                  <!-- Menu items with active state -->
                  <SidebarMenuItem
                    :class="
                      isRouteActive(item.url)
                        ? 'py-1 isActive rounded-lg'
                        : 'py-1 notactive'
                    "
                  >
                    <RouterLink :to="item.url" custom v-slot="{ navigate }">
                      <SidebarMenuButton
                        :tooltip="item.title"
                        @click="navigate"
                      >
                        <component :is="item.icon" class="size-4" />
                        <span>{{ item.title }}</span>
                      </SidebarMenuButton>
                    </RouterLink>
                  </SidebarMenuItem>
                </template>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>

          <!-- User Footer -->
          <router-link to="/" class="block p-4">
            <Button>
              <ArrowLeft class="size-4 mr-3" />
              <span>Quit admin console</span>
            </Button>
          </router-link>
        </Sidebar>
      </SidebarProvider>
    </div>

    <!-- Main Content -->
    <div class="admin-content">
      <router-view />

      <div class="admin-header">
        <h1 class="text-2xl font-bold">Admin ...</h1>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebarCol {
  width: 200px1important;
  background-color: #f9fafb;
}
.admin-layout {
  display: flex;
  min-height: 100vh;
}

.admin-content {
  flex: 1;
  padding: 1rem;
  border-left: 1px solid #e5e7eb;
}

.admin-header {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 1rem;
}

.admin-main {
  padding: 1rem;
}

.isActive {
  background-color: #f1f1f1;
  color: #333;
}

/* Logo styling */
.logo {
  padding: 1rem;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 1em rgba(100, 108, 255, 0.6));
}
</style>
