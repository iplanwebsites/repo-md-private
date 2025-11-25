<script setup>
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
	SidebarMenuSub,
	SidebarMenuSubItem,
	SidebarMenuSubButton,
	SidebarProvider,
} from "@/components/ui/sidebar";
import {
	Bug,
	Gift,
	Square,
	Box,
	Video,
	Boxes,
	Map,
	Database,
	Bike,
	Command,
	ChevronsUpDown,
	Plus,
	Phone,
	Calendar,
	BadgeCheck,
	Bell,
	CreditCard,
	LogOut,
	ChevronRight,
	Target,
	Flame,
	BookOpen,
	Upload,
	Book,
	RefreshCw,
	Trophy,
	Heart,
	Brain,
	Timer,
	Grid,
	User,
	Cog,
	Home,
	Users,
	MessageSquare,
	LayoutDashboard,
	HelpCircle,
	Lock,
	Shield,
	ListMinus,
} from "lucide-vue-next";
import { computed, ref, toRefs } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { isLocalhost } from "@/lib/utils/devUtils.js";

// Teams data
const teams = [
	{
		name: "Coach Wiso",
		logo: Book,
		plan: "Essai Repo.md",
	},
	{
		name: "Personnel",
		logo: Command,
		plan: "Gratuit",
	},
];

const activeTeam = ref(teams[0]);

// Props and Authentication
const props = defineProps(["session"]);
const { session } = toRefs(props);
const loading = ref(false);

import { supabase, clearSupaToken, signOutSupa } from "@/lib/supabaseClient";

// User data
const user = computed(() => ({
	email: session.value?.user?.email || "",
	avatar: session.value?.user?.user_metadata?.avatar_url || "",
	name:
		session.value?.user?.user_metadata?.full_name ||
		session.value?.user?.email?.split("@")[0] ||
		"",
}));

function setActiveTeam(team) {
	activeTeam.value = team;
}

// Router integration for active state detection
const route = useRoute();
const router = useRouter();

// Check if a route is active (enhanced version)
const isRouteActive = (url) => {
	// Exact match for the home route
	if (url === "/" && route.path === "/") {
		return true;
	}
	// For other routes, check if the current path starts with the url (to handle nested routes)
	return url !== "/" && route.path.startsWith(url);
};

// Navigation items with concept IDs and custom URLs
const navItems = {
	explore: {
		title: " ",
		items: [
			{
				title: " Accueil",
				icon: Home,
				url: "/",
				standalone: true,
			},
			{
				title: " Tableau de bord",
				icon: LayoutDashboard,
				url: "/dashboard",
				standalone: true,
			},
			{
				title: "Bibliothèque",
				icon: ListMinus,
				url: "/bibli",
				standalone: true,
			},
			{
				title: "Rendez-vous",
				icon: Calendar,
				url: "/meet",
				standalone: true,
			},
			/*
      {
        title: " Clients",
        icon: Users,
        url: "/client",
        standalone: true,
      },*/

			/*
      {
        title: "Activités",
        icon: Bike,
        url: "/activities",
        standalone: true,
      },
      {
        title: "Extras",
        icon: Gift,
        url: "/extras",
        standalone: true,
      },
*/
			{
				title: "Blog",
				icon: Book,
				url: "/blog",
				standalone: true,
			},
			{
				title: "Aide",
				icon: HelpCircle,
				url: "/help",
				standalone: true,
			},
			{
				title: "Admin",
				icon: Shield,
				url: "/admin/media",
				standalone: true,
				hidden: !isLocalhost(),
			},
			{
				title: "Auth debug",
				icon: Bug,
				url: "/supa",
				standalone: true,
				hidden: !isLocalhost(),
			},
			{
				title: "Styleguide web",
				icon: Bug,
				url: "/styleguide",
				standalone: true,
				hidden: !isLocalhost(),
			},
		],
	},
};

function getItemLink(i) {
	if (i.url) return i.url;
	if (i.blogId) return `/blog/${i.blogId}`;
	if (i.dataset) return `/dataset/${i.dataset}`;
	return "bientôt-🚧";
}

// Sign out function
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
</script>

<template>
  <SidebarProvider>
    <Sidebar collapsible="icon">
      <!-- Teams Header -->
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div class="logo">
              <RouterLink to="/" class=" ">
                <Logotype
                  variant="dark"
                  style="margin-top: 40px"
                  class="m-2 mt-1 block"
                  :height="22"
                  :withIcon="true"
                />
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
            <template
              v-for="item in section.items.filter((i) => !i.hidden)"
              :key="item.title"
            >
              <!-- Standalone items with active state -->
              <SidebarMenuItem
                v-if="item.standalone"
                :class="
                  isRouteActive(item.url)
                    ? 'py-1 isActive rounded-lg'
                    : 'py-1 notactive'
                "
              >
                <RouterLink :to="item.url" custom v-slot="{ navigate }">
                  <SidebarMenuButton :tooltip="item.title" @click="navigate">
                    <component :is="item.icon" class="size-4" />
                    <span>{{ item.title }} </span>
                  </SidebarMenuButton>
                </RouterLink>
              </SidebarMenuItem>

              <!-- Collapsible items with potential active sub-items -->
              <Collapsible v-else as-child class="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger as-child>
                    <SidebarMenuButton :tooltip="item.title">
                      <component :is="item.icon" class="size-4" />
                      <span>{{ item.title }}</span>
                      <ChevronRight
                        class="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem
                        v-for="subItem in item.items"
                        :key="subItem.title"
                      >
                        <RouterLink
                          :to="getItemLink(subItem)"
                          custom
                          v-slot="{ navigate }"
                        >
                          <SidebarMenuSubButton
                            @click="navigate"
                            :class="
                              isRouteActive(getItemLink(subItem))
                                ? 'isActive'
                                : ''
                            "
                          >
                            <span>{{ subItem.title }}</span>
                            <Lock
                              v-if="subItem.locked"
                              class="mr-auto w-2 h-2 text-muted-foreground"
                            />
                          </SidebarMenuSubButton>
                        </RouterLink>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </template>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <!-- 
          <ProUpgradeBox class="mt-8" />
           -->
          <router-link to="/feedback">
            <Button variant="outline"> Partagez vos commentaires </Button>
          </router-link>
        </SidebarGroup>

        <!-- Background Image Element -->
        <div class="sidebar-bg-image"></div>
      </SidebarContent>

      <!-- User Footer with enhanced dropdown menu -->
      <SidebarFooter v-if="false">
        <SidebarMenu v-if="session">
          <SidebarMenuItem>
            <UserDropDownMenu
              popDirection="up"
              :session="session"
              :notificationsCount="5"
            />
            <hr />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  </SidebarProvider>
</template>

<style scoped>
/* We can remove these styles as we're now applying classes directly */
/* Keep as a fallback but they shouldn't be needed anymore */
.active-nav-item,
.isActive {
  background-color: var(--sidebar-accent);
  background: #f1f1f1;
  color: var(--sidebar-accent-foreground);
}

/* Background image styling */
.sidebar-bg-image {
  background-image: url("https://static.repo.md/wiki/assets/img/b1/13_pushmd-sm.webp");
  background-repeat: no-repeat;
  background-position: bottom center;
  background-size: 100% auto;
  width: 100%;
  height: 180px; /* Adjust based on your image proportions */
  position: absolute;
  bottom: 56px; /* Adjust based on your footer's height */
  left: 0;
  pointer-events: none; /* So it doesn't interfere with clicks */
  z-index: -10; /* Place it behind other content */
}
</style>
