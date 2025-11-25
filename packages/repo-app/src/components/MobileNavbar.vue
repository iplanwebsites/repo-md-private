<script setup>
import { Menu, Search, ArrowLeft } from "lucide-vue-next";
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import Logotype from "@/components/Logotype.vue";
import MobileMenu from "@/components/nav/MobileMenu.vue";

const isSearchActive = ref(false);
const searchQuery = ref("");
const isMenuOpen = ref(false);
const route = useRoute();
const router = useRouter();

const toggleSearch = () => {
	isSearchActive.value = !isSearchActive.value;
	if (!isSearchActive.value) {
		searchQuery.value = "";
	}
};

const goBack = () => {
	isSearchActive.value = false;
	searchQuery.value = "";
};

const search = () => {
	if (searchQuery.value.trim()) {
		// Implement search logic here
		// For example, navigate to search results page
		// router.push({ path: '/search', query: { q: searchQuery.value } });
		console.log("Searching for:", searchQuery.value);
	}
};

// Toggle menu state
const toggleMenu = () => {
	isMenuOpen.value = !isMenuOpen.value;
	// Prevent scrolling when menu is open
	if (isMenuOpen.value) {
		document.body.style.overflow = "hidden";
	} else {
		document.body.style.overflow = "";
	}
};

// Close menu
const closeMenu = () => {
	isMenuOpen.value = false;
	document.body.style.overflow = "";
};

// Close menu on route change
router.afterEach(() => {
	closeMenu();
});
</script>

<template>
  <div
    class="mobile-navbar w-full h-14 border-b flex items-center justify-between px-4 md:hidden"
  >
    <!-- Left section with burger menu or back button -->
    <div class="flex items-center">
      <button
        v-if="!isSearchActive"
        @click="toggleMenu"
        class="p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Toggle menu"
      >
        <Menu class="h-5 w-5" />
      </button>
      <button
        v-else
        @click="goBack"
        class="p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Go back"
      >
        <ArrowLeft class="h-5 w-5" />
      </button>
    </div>

    <!-- Center logo or search input -->
    <div class="flex items-center flex-1 justify-center">
      <div v-if="!isSearchActive" class="flex items-center">
        <Logotype variant="dark" :height="20" />
      </div>
      <div v-else class="w-full max-w-md mx-4">
        <form @submit.prevent="search" class="flex w-full">
          <Input
            v-model="searchQuery"
            type="text"
            placeholder="Search..."
            class="w-full px-3 py-1 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary"
            autofocus
          />
        </form>
      </div>
    </div>

    <!-- Right section with search button -->
    <div class="flex items-center">
      <button
        @click="toggleSearch"
        class="p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Search"
      >
        <Search class="h-5 w-5" />
      </button>
    </div>
  </div>

  <!-- Mobile Menu (fullscreen overlay) -->
  <Transition name="menu">
    <MobileMenu v-if="isMenuOpen" @close="closeMenu" />
  </Transition>
</template>

<style scoped>
.mobile-navbar {
  position: sticky;
  top: 0;
  z-index: 50;
  background-color: white;
}

/* Dark mode support */
:root.dark .mobile-navbar {
  background-color: hsl(var(--background));
  border-color: hsl(var(--border));
}

:root.dark .hover\:bg-gray-100:hover {
  background-color: hsl(var(--muted));
}

/* Menu transition */
.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.3s ease;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
}
</style>
