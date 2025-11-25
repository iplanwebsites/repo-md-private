<script setup>
import { ref, computed } from "vue";
import {
	ChevronDown,
	ChevronUp,
	Settings,
	LogOut,
	User,
	Bell,
	HelpCircle,
	Sparkles,
	Home,
	Shield,
	LayoutGrid,
	Store,
	BookUp,
} from "lucide-vue-next";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase, clearSupaToken, signOutSupa } from "@/lib/supabaseClient";
import { RouterLink } from "vue-router";

import { isLocalhost } from "@/lib/utils/devUtils.js";

const props = defineProps({
	popDirection: {
		type: String,
		default: "down",
		validator: (value) => ["up", "down"].includes(value),
	},
	session: {
		type: Object,
		required: true,
	},
	notificationsCount: {
		type: Number,
		default: 0,
	},
	showNotif: {
		type: Boolean,
		default: false,
	},
});

const isOpen = ref(false);
const loading = ref(false);

// Computed properties for user data
const user = computed(() => ({
	email: props.session?.user?.email || "",
	avatar: props.session?.user?.user_metadata?.avatar_url || "",
	name:
		props.session?.user?.user_metadata?.full_name ||
		props.session?.user?.email?.split("@")[0] ||
		"",
}));

// User initials from name
const userInitials = computed(() => {
	return user.value.name.substring(0, 2).toUpperCase();
});

// Computed properties for UI
const dropdownSide = computed(() => {
	return props.popDirection === "up" ? "top" : "bottom";
});

const chevronIcon = computed(() => {
	return isOpen.value
		? props.popDirection === "up"
			? ChevronDown
			: ChevronUp
		: props.popDirection === "up"
			? ChevronUp
			: ChevronDown;
});

// Menu items defined as an array
const menuItems = [
	/*
  {
    id: "profile",
    label: "Mon profil",
    icon: User,
    to: "/profile",
    divider: false,
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    to: "/notifications",
    showBadge: true,
    divider: false,
  },*/
	{
		id: "dashboard",
		label: "Dashboard",
		icon: LayoutGrid,
		to: "/dashboard",
		divider: false,
	},
	/*
  {
    id: "help",
    label: "Support",
    icon: HelpCircle,
    to: "/help",
    divider: false,
  },*/
	{
		id: "pro",
		label: "Upgrade to Pro",
		icon: Sparkles,
		to: "/upgrade",
		divider: false,
	},
	{
		id: "settings",
		label: "Account Settings",
		icon: Settings,
		to: "/settings",
		divider: true,
	},
	{
		id: "homepage",
		label: "Home Page",
		icon: Store,
		to: "/home",
		divider: false,
	},
	{
		label: "Admin",
		icon: Shield,
		to: "/admin/db",

		hidden: !isLocalhost(),
	},
	{
		id: "logout",
		label: "Log Out",
		icon: LogOut,
		action: "logout",
		divider: false,
	},
];

// Emit events when menu items are selected
const emit = defineEmits([
	"select-profile",
	"select-notifications",
	"select-settings",
	"select-help",
]);

// Handle menu item selection
function handleSelectItem(id) {
	isOpen.value = false;
	emit(`select-${id}`);
}

// Sign out function
async function handleLogout() {
	try {
		loading.value = true;
		await signOutSupa();
	} catch (error) {
		console.log(error);
	} finally {
		loading.value = false;
		isOpen.value = false;
	}
}
</script>

<template>
  <DropdownMenu v-model:open="isOpen" :side="dropdownSide">
    <DropdownMenuTrigger class="focus:outline-none">
      <Avatar class="h-8 w-8 rounded-full">
        <AvatarImage v-if="user.avatar" :src="user.avatar" :alt="user.name" />
        <AvatarFallback class="bg-primary/10 text-primary rounded-lg">
          {{ userInitials }}
        </AvatarFallback>
      </Avatar>

      <!--  

      <div
        class="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 transition-colors"
      >
        <Avatar class="h-8 w-8 rounded-lg">
          <AvatarImage v-if="user.avatar" :src="user.avatar" :alt="user.name" />
          <AvatarFallback class="bg-primary/10 text-primary rounded-lg">
            {{ userInitials }}
          </AvatarFallback>
        </Avatar>
        <div class="hidden sm:block text-left">
          <p class="text-sm font-medium truncate">{{ user.name }}</p>
          <p class="text-xs text-muted-foreground truncate">{{ user.email }}</p>
        </div>
        <div class="relative">
          <component :is="chevronIcon" class="h-4 w-4 text-muted-foreground" />
          <Badge
            v-if="showNotif && notificationsCount > 0"
            class="absolute -top-2 -right-2 h-4 min-w-4 flex items-center justify-center p-0 text-[10px]"
          >
            {{ notificationsCount > 99 ? "99+" : notificationsCount }}
          </Badge>
        </div>
      </div>
-->
    </DropdownMenuTrigger>

    <DropdownMenuContent class="w-56">
      <DropdownMenuLabel>
        <div class="flex flex-col space-y-1">
          <p class="text-sm font-medium">{{ user.name }}</p>
          <p class="text-xs text-muted-foreground">{{ user.email }}</p>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />

      <template v-for="(item, index) in menuItems" :key="item.id">
        <!-- Router link items -->
        <RouterLink v-if="item.to" :to="item.to" custom v-slot="{ navigate }">
          <DropdownMenuItem
            @click="
              navigate();
              isOpen = false;
            "
          >
            <div class="flex justify-between items-center w-full">
              <div class="flex items-center">
                <component :is="item.icon" class="mr-2 h-4 w-4" />
                <span>{{ item.label }}</span>
              </div>
              <Badge
                v-if="showNotif && item.showBadge && notificationsCount > 0"
                variant="secondary"
                class="ml-2 h-5 min-w-5 flex items-center justify-center p-0"
              >
                {{ notificationsCount > 99 ? "99+" : notificationsCount }}
              </Badge>
            </div>
          </DropdownMenuItem>
        </RouterLink>

        <!-- Action items (like logout) -->
        <DropdownMenuItem
          v-if="item.action"
          @click="item.action === 'logout' ? handleLogout() : null"
        >
          <div class="flex justify-between items-center w-full">
            <div class="flex items-center">
              <component :is="item.icon" class="mr-2 h-4 w-4" />
              <span>{{ item.label }}</span>
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator v-if="item.divider" />
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
