<script setup>
import { computed, toRefs, ref } from "vue";
import { useRoute } from "vue-router";
import { useColorMode } from "@vueuse/core";
import MobileNavbar from "@/components/MobileNavbar.vue";

const props = defineProps(["session", "showSidebar"]);
const { session, showSidebar } = toRefs(props);

// Define the routes where the bg-grid class should be excluded
const excludedRoutes = ["/", "/archetypes"];

const DEFAULT_MENU = "brochure";

// Access the current route
const route = useRoute();

// Mobile menu state
const isMobileMenuOpen = ref(false);

// Toggle mobile menu
const toggleMobileMenu = () => {
	isMobileMenuOpen.value = !isMobileMenuOpen.value;
};

// Computed property for menu based on route meta
const menuType = computed(() => route.meta.menu || DEFAULT_MENU);

/*
// Compute whether to apply the bg-grid class based on the current route
const shouldApplyBgGrid = computed(() => {
  return !excludedRoutes.includes(route.path);
});

// Initialize the color mode using @vueuse/core
const mode = useColorMode({
  emitAuto: true, // Automatically detects the preferred color scheme
  disableTransition: false, // Enable transition when changing modes
});

// Computed property to apply the dark or light background image

const backgroundImageClass = computed(() => {
  if (!shouldApplyBgGrid.value) return ""; // Return an empty string if bg-grid should not be applied

  return mode.value === "dark" ? "bg-grid-dark" : "bg-grid-light";
});
*/

const footerToShow = computed(() => {
	// Check if route explicitly disables footer
	if (route.meta.noFooter) return "none";
	
	if (route.meta.footer) return route.meta.footer;
	if (
		menuType.value === "brochure" ||
		(menuType.value === "none" && !session.value)
	)
		return "brochure";
	if (menuType.value === "project" && session.value) return "app";
	return "none";
});
</script>

<template>
  <div class="layout">
    <!-- Sidebar Section -->
    <div style="padding-top: 0px">
      <MySidebar
        v-if="false && session && showSidebar"
        :session="session"
        class="hidden lg:block sidebar"
        v-show="true"
      />
    </div>
    <!--  
    <div class="sidebarNO">
      <slot name="sidebar"> </slot>
    </div>-->

    <!-- Main Content Section -->
    <div class="content w-full">
      <!-- Mobile Navbar (shown on mobile only) -->
      <MobileNavbar v-if="menuType !== 'none' && ((session && showSidebar) || menuType === 'brochure')" />

      <!-- Desktop Navbar (hidden on mobile)
        <AppNavbar :session="session" class="hidden md:block" />
        -->
      <Navbar v-if="menuType !== 'none'" :menu="menuType" class="hidden md:block" />

      <slot></slot>
      <!-- 
      {{ footerToShow }} / {{ menuType }} -->
      <BrochureFooter v-if="footerToShow === 'brochure'" />
      <AppFooter v-if="footerToShow === 'app'" />
    </div>
  </div>
</template>

<style scoped>
/* CSS for the sidebar with max-width */
.sidebar {
  max-width: 300px;
  width: 20%;
  padding-top: 200px;
  transition: transform 0.3s ease;
}

/* Main layout */
.layout {
  display: flex;
}

/* Content area styling */
.content2 {
  flex: 1;
  border-left: 1px solid hsl(var(--border));
}

/* Inner content styling */
.content-inner {
  height: 100%;

  /*-moz-animation: ;
  padding: 1.5rem 2rem;
  */
}

/* Mobile sidebar support */
@media (max-width: 1023px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 100;
    width: 280px;
    max-width: 280px;
    transform: translateX(-100%);
    padding-top: 0;
  }

  .sidebar.mobile-open {
    transform: translateX(0);
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
  }
}

/* Background styles for light mode */
.bg-grid-light {
  background-image: url("@/assets/gridBanner.jpg");
  background-size: contain;
  background-repeat: no-repeat;
}

/* Background styles for dark mode */
.bg-grid-dark {
  background-image: url("@/assets/gridBanner_dark.jpg");
  background-size: contain;
  background-repeat: no-repeat;
}

/* Hover effects for logos */
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
