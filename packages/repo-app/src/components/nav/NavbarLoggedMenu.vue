<script setup>
import { ref, computed, toRefs, onMounted } from "vue";
import { useRoute } from "vue-router";
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

// Import supabase client and orgStore
import { signOutSupa } from "@/lib/supabaseClient";
import { useOrgStore } from "@/store/orgStore";

const props = defineProps({
	menu: {
		type: String,
		required: true,
	},
	session: {
		type: Object,
	},
});

// Get route params
const route = useRoute();
const orgStore = useOrgStore();

// Props from parent
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

// Initialize
onMounted(async () => {
	updateNotificationCount();

	// Fetch orgs if needed
	if (orgStore.orgs.length === 0) {
		await orgStore.fetchOrgs();
	}

	// Get org data from orgStore
	if (orgId.value) {
		const org = orgStore.orgs.find(
			(o) =>
				o._id?.toString() === orgId.value.toString() ||
				o.id?.toString() === orgId.value.toString() ||
				o.handle === orgId.value,
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

const showNotificationsBt = computed(() => {
	return (
		session.value &&
		//real
		props.menu === "project"
	);
});

const currentMenu = computed(() => props.menu);
</script>

<template>
  <div class="flex items-center gap-3">
    <!-- Right side controls: Help, Docs, Notifications and User Profile -->
    <div class="flex items-center gap-4">
      <!-- Help & Docs Buttons -->

      <template v-if="currentMenu === 'brochure'">
        <!--
        <Button to="/help" variant="ghost" size="sm" class="font-medium"
          >Help</Button
        >  -->
        <Button to="/" variant="outline" size="sm" class="font-medium"
          >Dashboard</Button
        >
      </template>
      <template v-else>
        <Button to="/help" variant="ghost" size="sm" class="font-medium"
          >Help</Button
        >

        <Button to="/docs" variant="ghost" size="sm" class="font-medium"
          >Docs</Button
        >
      </template>

      <!-- Notifications with Popover -->
      <Popover v-model:open="notificationOpen" v-if="showNotificationsBt">
        <PopoverTrigger as-child>
          <button
            class="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-accent"
          >
            <Bell class="w-5 h-5" />
            <Badge
              v-if="hasUnreadNotifications"
              class="absolute -top-1 -right-1 px-1 min-w-5 h-5 flex items-center justify-center"
            >
              {{ notificationCount }}
            </Badge>
          </button>
        </PopoverTrigger>
        <PopoverContent class="w-80 p-0" align="end">
          <div class="flex items-center justify-between p-3 border-b">
            <span class="font-medium">Notifications</span>
            <button
              class="text-xs text-primary hover:underline"
              @click="markAllNotificationsAsRead"
            >
              Mark all as read
            </button>
          </div>
          <div class="max-h-80 overflow-y-auto">
            <div
              v-for="notification in notifications"
              :key="notification.id"
              class="relative"
            >
              <div
                @click="markNotificationAsRead(notification)"
                class="flex flex-col items-start gap-1 cursor-pointer p-3"
                :class="{ 'bg-accent/50': !notification.read }"
              >
                <div class="flex items-center justify-between w-full">
                  <span class="font-medium">{{ notification.title }}</span>
                  <span class="text-xs text-muted-foreground">{{
                    notification.time
                  }}</span>
                </div>
                <p class="text-sm text-muted-foreground">
                  {{ notification.message }}
                </p>
                <div
                  v-if="!notification.read"
                  class="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary"
                ></div>
              </div>
              <div
                v-if="
                  notification.id !== notifications[notifications.length - 1].id
                "
                class="border-t mx-3"
              ></div>
            </div>
          </div>
          <div class="p-3 border-t">
            <RouterLink
              to="/notifications"
              class="flex justify-center w-full text-sm font-medium"
            >
              View all notifications
            </RouterLink>
          </div>
        </PopoverContent>
      </Popover>

      <UserDropDownMenu
        popDirection="down"
        :session="session"
        :notificationsCount="5"
      />
    </div>
  </div>
</template>
