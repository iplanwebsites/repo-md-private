<script setup>
import { ref, computed } from "vue";
import {
	Circle,
	Sun,
	Moon,
	RefreshCw,
	ChevronRight,
	ChevronDown,
} from "lucide-vue-next";

import { appConfigs } from "@/appConfigs.js";
const { BRAND } = appConfigs;

const currentYear = new Date().getFullYear();
const companyName = BRAND;
const darkMode = ref(false);
const legalDropdownOpen = ref(false);

const navigationLinks = [
	{ path: "/home", label: "Home" },
	{ path: "/docs", label: "Docs" },
	{ path: "/guides", label: "Guides" },
	{ path: "/help", label: "Help" },
	{ path: "/contact", label: "Contact" },
];

const legalLinks = [
	{ path: "/legal/terms", label: "Terms of Service" },
	{ path: "/legal/privacy", label: "Privacy Policy" },
	{ path: "/legal/cookies", label: "Cookie Policy" },
];

// Display copyright in the footer
const copyright = computed(() => {
	return `© ${currentYear}, ${companyName}`;
});

const toggleLegalDropdown = () => {
	legalDropdownOpen.value = !legalDropdownOpen.value;
};

const toggleTheme = () => {
	darkMode.value = !darkMode.value;
	// Add logic to actually change the theme
};

const refreshPage = () => {
	window.location.reload();
};
</script>

<template>
  <footer
    class="w-full py-4 px-6 bg-white border-t border-gray-200 flex items-center justify-between"
  >
    <div class="flex items-center space-x-4">
      <div class="mr-2">
        <Logotype to="/home" />
      </div>
      <router-link
        v-for="link in navigationLinks"
        :to="link.path"
        class="text-gray-700 hover:text-gray-900"
      >
        {{ link.label }}
      </router-link>
      <div class="relative">
        <button
          @click="toggleLegalDropdown"
          class="flex items-center text-gray-700 hover:text-gray-900"
        >
          Legal
          <ChevronRight v-if="!legalDropdownOpen" class="h-4 w-4 ml-1" />
          <ChevronDown v-else class="h-4 w-4 ml-1" />
        </button>
        <div
          v-if="legalDropdownOpen"
          class="absolute bottom-full mb-2 bg-white shadow-lg rounded py-2 min-w-40"
        >
          <router-link
            v-for="legalLink in legalLinks"
            :to="legalLink.path"
            class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            {{ legalLink.label }}
          </router-link>
        </div>
      </div>
    </div>

    <div class="flex items-center space-x-4">
      <a
        target="_blank"
        href="https://status.repo.md"
        class="flex items-center text-sm text-green-500"
      >
        <Circle class="h-3 w-3 mr-1 fill-current" />
        All systems normal
      </a>

      <!--
      <button @click="toggleTheme" class="text-gray-700 hover:text-gray-900">
        <Sun v-if="darkMode" class="h-5 w-5" />
        <Moon v-else class="h-5 w-5" />
      </button>

      <button @click="refreshPage" class="text-gray-700 hover:text-gray-900">
        <RefreshCw class="h-5 w-5" />
      </button>
       -->
    </div>
  </footer>
  <div class="text-xs text-gray-500 px-6 py-2">{{ copyright }}</div>
</template>
