<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useColorMode } from "@vueuse/core";
import {
	supabase,
	refreshSupaSession,
	getSupaUser,
} from "@/lib/supabaseClient";
import AgentBubble from "@/components/agent/AgentBubble.vue";
// import { useMeetingStore } from "@/store/meetingStore";
import trpc from "@/trpc";

const publicRoutes = [
	"home",
	"login",
	"signup",
	"startActivity",
	"realtimeActivity",
	"formActivity",

	"chatActivity",
	"activity",
	"faq",
	"landing",
	"privacy",
	"terms",
	"debuterInvite",
	"PatientSignupDone",
	"meetRoom",
	"convo",
	"styleguide",
	"realtime",
	"beta",
	"standaloneExtra",
	"meet",
	"meet1",
	"blogArticle",
	"blogListing",
	"404",
	"NotFound",
	"landing_guru",
	"meetDone",
];

const noSidebarRoute = [
	"meet",
	"meet1",
	"meetRoom",
	"host-room",
	// "convo",
	"standaloneExtra",
	"formActivity",
	"realtimeActivity",
	"beta",
	"realtime",
	"styleguide",
	"PatientSignupDone",
	"debuterInvite",
	"privacy",
	"terms",
	"faq",
	"activity",
	"startActivity",
	"landing",
	"landing_guru",
	"settings",
	// "help",

	//admins
	"admin",
	"NotFoundAdmin",
	"AdminMedias",
];

const authRoutes = ["login", "signup"];
const ALLOW_LOCALHOST_INCOGNINTO = false;

const route = useRoute();
const router = useRouter();
const mode = useColorMode({
	emitAuto: true,
	disableTransition: false,
});
mode.value = "light"; // HARDCODE the mode. Remove this line to use the system preference

import { usePageTitle } from "@/lib/utils/vueUtils";

import { appConfigs } from "@/appConfigs.js";
const { BRAND } = appConfigs;

// Default title from route meta
const routeTitle = computed(() => route.meta.title);

// Create global title with consistent format using our utility
usePageTitle({
	title: routeTitle,
	brand: BRAND,
	titleFirst: true,
});

const session = ref();
const loading = ref(true);
const initialized = ref(false);
const routeReady = ref(false);

// Compute if current route is public
const isPublicRoute = computed(() => {
	// Consider routes as public unless they have meta.menu="project"
	if (route.meta?.menu === "project") {
		return false;
	}

	// Otherwise, route is public
	return true;
});

// Compute if current route is auth route
const isAuthRoute = computed(() => {
	return authRoutes.includes(route.name);
});

// Set routeReady when we have a valid route object
watch(
	() => route.path, // we assume even the root route has a path...
	(newPath) => {
		if (newPath) {
			routeReady.value = true;
		}
	},
	{ immediate: true },
);

// Determine if auth page should be shown
const shouldShowAuthPage = computed(() => {
	if (loading.value || !initialized.value || !routeReady.value) return false;

	return (
		!session.value &&
		!isPublicRoute.value &&
		!(location.hostname === "localhost" && ALLOW_LOCALHOST_INCOGNINTO)
	);
});

// Watch for auth state changes and redirect if needed
watch([() => session.value, () => route.name], ([newSession, routeName]) => {
	if (!initialized.value) return;

	// Redirect logged-in users away from auth routes
	if (newSession && isAuthRoute.value) {
		router.replace({ name: "home" });
	}
});

// Get the meeting store
//const meetingStore = useMeetingStore();

// Get patients from the store
// const patients = computed(() => meetingStore.patients);

// Helper function to initialize all store data
async function initStoreData() {
	try {
		await Promise.all([
			// meetingStore.fetchPatients(),
			// meetingStore.fetchMeetings(),
		]);
		console.log("Store data initialized");
	} catch (error) {
		console.error("Failed to initialize store data:", error);
	}
}

onMounted(async () => {
	try {
		const { data } = await supabase.auth.getSession();
		// const res = await refreshSupaSession(1);
		session.value = data.session;

		const provider_token = session.value?.provider_token;
		if (provider_token) {
			// Set the provider token on the server
			console.log("Provider token:", provider_token);
			//alert(5543)
		  trpc.github.saveGithubSupaProviderToken.mutate({token:provider_token}).then((res) => {
				console.log("Github token result:", res);
			});
		
	 
		}
 
		if (session.value) {
			// Initialize store data for authenticated users
			await initStoreData();
		}
	} catch (error) {
		console.error("Error getting session:", error);
	} finally {
		loading.value = false;
		initialized.value = true;
	}

	supabase.auth.onAuthStateChange(async (event, _session) => {
		const previouslyLoggedIn = !!session.value;
		session.value = _session;

		// Check for provider token on session change
		const provider_token = _session?.provider_token;
		if (provider_token) {
			// Set the provider token on the server
			await trpc.github.saveGithubSupaProviderToken.mutate(provider_token);
		}

		// When user signs in, fetch data
		if (!previouslyLoggedIn && _session) {
			try {
				await initStoreData();
			} catch (error) {
				console.error("Error fetching data after auth change:", error);
			}
		}
	});
});

///compute show Sudebar // !noSidebarRoute.includes(route.name)
const showSidebar = computed(() => {
	// Access these properties to ensure reactivity
	const currentRoute = route.name;
	const currentPath = route.path;
	const currentSession = session.value;

	return (
		currentSession &&
		!currentPath.startsWith("/admin") &&
		!noSidebarRoute.includes(currentRoute)
	);
});
</script>

<template>

<!-- -->
	 <div
    v-motion
	hovered
    :initial="{ opacity: 0, y: 100 }"
    :enter="{ opacity: 1, y: 0, scale: 1 }"
    :variants="{ custom: { scale: 2 } }"
    
    :delay="200"
    :duration="1200"
  />


  <div v-if="initialized && routeReady">
    <!-- Show chat task and site demos without any wrappers for true 100vh -->
    <template v-if="route.name === 'ProjectChatTask' || route.name === 'OrgChatTask' || route.name === 'SiteDemos'">
      <Toaster />
      <router-view :session="session" />
    </template>
    
    <!-- Normal app layout for other routes -->
    <template v-else>
      <Toaster />
      <div class="md:block border-t">
        <div class="bg-background">
          <!-- Show auth page if needed -->
          <Auth v-if="shouldShowAuthPage" class="auth-container" />

          <!-- Show sidebar and content only when auth page is not shown -->
          <MainLayout v-else :session="session" :showSidebar="showSidebar">
            <router-view :session="session" />
          </MainLayout>
        </div>
      </div>
    </template>

    <!-- Add the AgentBubble component for conversations 
    <AgentBubble v-if="session" />
    -->
  </div>
  <!-- Show nothing while initializing or waiting for route -->
  <div v-else class="min-h-screen bg-background"></div>
</template>

<style scoped>
.content-no-sidebar {
  padding: 1.5rem;
  min-height: calc(100vh - 4rem);
}

.auth-container {
  position: fixed;
  z-index: 100;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--background);
  overflow: auto;
  width: 100vw;
  height: 100vh;
}
</style>
