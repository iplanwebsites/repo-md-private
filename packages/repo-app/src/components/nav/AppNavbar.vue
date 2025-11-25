<script setup>
import { ref, computed, toRefs, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useDeploymentStatus } from "@/store/deploymentStore";
import {
	Bell,
	ChevronsUpDown,
	BadgeCheck,
	CreditCard,
	Cog,
	LogOut,
} from "lucide-vue-next";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

// Import ProjectBreadcrumb instead of search component
//import ProjectBreadcrumb from "./ProjectBread.vue";

// Import supabase client
import { signOutSupa } from "@/lib/supabaseClient";

// Get route params
const route = useRoute();

// Props from parent
const props = defineProps(["session"]);
const { session } = toRefs(props);

// User data
const user = computed(() => ({
	email: session.value?.user?.email || "",
	avatar: session.value?.user?.user_metadata?.avatar_url || "",
	name:
		session.value?.user?.user_metadata?.full_name ||
		session.value?.user?.email?.split("@")[0] ||
		"",
}));

// Route params for ProjectBreadcrumb
const orgId = computed(() => route.params.orgId);
const projectId = computed(() => route.params.projectId);
const deployId = computed(() => route.params.deployId);

const orgName = ref("");
const projectName = ref("");

// Get deployment status color from store
const { deploymentStatusColor } = useDeploymentStatus();
const deployStatus = computed(() => deploymentStatusColor.value);

// User menu items
const userMenuItems = [
	{
		title: "Account",
		icon: BadgeCheck,
		action: "link",
		url: "/account",
	},
	{
		title: "Billing",
		icon: CreditCard,
		action: "link",
		url: "/billing",
	},
	{
		title: "Settings",
		icon: Cog,
		action: "link",
		url: "/settings",
	},
	{
		title: "Notifications",
		icon: Bell,
		action: "link",
		url: "/notifications",
	},
	{
		type: "separator",
	},
	{
		title: "Sign Out",
		icon: LogOut,
		action: "function",
		handler: signOut,
	},
];

// Notification system
const hasUnreadNotifications = ref(true);
const notificationCount = ref(3);
const notificationOpen = ref(false);

// Sample notifications for project deployments
const notifications = ref([
	{
		id: 1,
		title: "New Deployment",
		message: "Project 'Marketing Website' has been successfully deployed",
		time: "10 minutes ago",
		read: false,
		type: "deployment",
	},
	{
		id: 2,
		title: "Build Failed",
		message: "Project 'Dashboard App' deployment failed due to build errors",
		time: "2 hours ago",
		read: false,
		type: "error",
	},
	{
		id: 3,
		title: "Version Published",
		message: "Version 2.4.0 of 'API Service' has been published",
		time: "Yesterday, 15:42",
		read: false,
		type: "version",
	},
	{
		id: 4,
		title: "Deployment Reminder",
		message: "Scheduled deployment for 'E-commerce Platform' tomorrow at 2PM",
		time: "Yesterday, 09:30",
		read: true,
		type: "reminder",
	},
	{
		id: 5,
		title: "System Update",
		message: "New features available in your deployment environment",
		time: "3 days ago",
		read: true,
		type: "system",
	},
]);

// Notification functions
function markNotificationAsRead(notif) {
	const notification = notifications.value.find((n) => n.id === notif.id);
	if (notification) {
		notification.read = true;
	}
	updateNotificationCount();
}

function markAllNotificationsAsRead() {
	notifications.value.forEach((notification) => {
		notification.read = true;
	});
	updateNotificationCount();
}

function updateNotificationCount() {
	const unreadCount = notifications.value.filter((n) => !n.read).length;
	notificationCount.value = unreadCount;
	hasUnreadNotifications.value = unreadCount > 0;
}

// Sign out function
const loading = ref(false);
async function signOut() {
	try {
		loading.value = true;
		await signOutSupa();
	} catch (error) {
		console.log(error);
	} finally {
		loading.value = false;
	}
}

// Mock org data for example - in a real app, you would fetch this
const orgs = ref([
	{ id: 1, name: "Organization 1", description: "Main organization" },
	{ id: 2, name: "Organization 2", description: "Secondary organization" },
]);

// Initialize
onMounted(() => {
	updateNotificationCount();

	// In a real app, you would fetch org and project names based on IDs
	// For now, we'll use a simple mock lookup
	if (orgId.value) {
		const org = orgs.value.find(
			(o) => o.id.toString() === orgId.value.toString(),
		);
		if (org) {
			orgName.value = org.name;
		}
	}

	// Similarly for project name, you would fetch it from an API
	if (projectId.value) {
		projectName.value = `${projectId.value}`;
	}
});
</script>

<template>
  <header
    class="relative z-50 flex h-16 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
  >
    <div class="containerNo flex items-center justify-between h-full px-4">
      <!-- ProjectBreadcrumb Component (replaces search bar) -->
      <div class="flex-1 flex items-center">
        <ProjectBread
          v-if="orgId"
          :session="session"
          :orgId="orgId"
          :projectId="projectId"
          :orgName="orgName"
          :projectName="projectName"
          :orgs="orgs"
          :deployId="deployId"
          :deployStatus="deployStatus"
        />
        <logotype v-else class="text-2xl font-bold text-primary" />
      </div>
    </div>
  </header>
</template>
