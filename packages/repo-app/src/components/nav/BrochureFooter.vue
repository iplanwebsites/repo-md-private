<script setup>
import { ref, computed } from "vue";
import Logotype from "@/components/Logotype.vue";
import { navigationItems, topLevelLinks } from "./navigationItems.js";
import {
	Linkedin,
	Twitter,
	Youtube,
	Facebook,
	Instagram,
	Video,
	Github,
} from "lucide-vue-next";
import { XIcon } from "@/lib/MyIcons.js";

// Flag to control icon display in footer
const useIcons = false;


const currentYear = new Date().getFullYear();

// Process Product links for footer
const productLinks = computed(() => {
	return (navigationItems.Product || []).filter((item) => !item.hiddenFooter);
});

// Process Resources links for footer
const resourceLinks = computed(() => {
	// Include links that are not hidden in footer (different rules from navbar)
	return (navigationItems.Resources || []).filter((item) => !item.hiddenFooter);
});

// Process Company links for footer
const companyLinks = computed(() => {
	// Include company links that are not hidden in footer
	return (navigationItems.Company || []).filter((item) => !item.hiddenFooter);
});

// Use Social links from navigation items
const socialLinks = computed(() => {
	return (navigationItems.Social || []).filter((item) => !item.hiddenFooter);
});
</script>

<template>
  <footer
    class="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
  >
    <div class="container mx-auto px-4 py-12">
      <div class="grid grid-cols-1 md:grid-cols-5 gap-8">
        <!-- Logo, Copyright and Social Links -->
        <div class="space-y-4">
          <Logotype />
          <p class="text-sm text-muted-foreground">
            © {{ currentYear }} Repo.md.
          </p>

          <!-- Social Links -->
          <div class="mt-4">
            <ul class="flex flex-wrap gap-4">
              <li v-for="link in socialLinks" :key="link.name">
                <a
                  :href="link.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                  :title="link.name"
                >
                  <component :is="link.icon" class="h-5 w-5" v-if="true" />
                  <span v-if="false">{{ link.name }}</span>
                  <span v-else class="sr-only">{{ link.name }}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <!-- Product Links -->
        <div>
          <h4 class="font-semibold mb-4">Products</h4>
          <ul class="space-y-2">
            <li v-for="link in productLinks" :key="link.name">
              <router-link
                :to="link.href"
                class="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                <component
                  :is="link.icon"
                  class="h-3.5 w-3.5"
                  v-if="useIcons && link.icon"
                />
                {{ link.name }}
              </router-link>
            </li>
          </ul>
        </div>

        <!-- Resources Links -->
        <div>
          <h4 class="font-semibold mb-4">Resources</h4>
          <ul class="space-y-2">
            <li v-for="link in resourceLinks" :key="link.name">
              <router-link
                :to="link.href"
                class="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                <component
                  :is="link.icon"
                  class="h-3.5 w-3.5"
                  v-if="useIcons && link.icon"
                />
                {{ link.name }}
              </router-link>
            </li>
          </ul>
        </div>

        <!-- Company Links with Legal at the end -->
        <div>
          <h4 class="font-semibold mb-4">Company</h4>
          <ul class="space-y-2">
            <!-- Main company links -->
            <li v-for="link in companyLinks.slice(0, 7)" :key="link.name">
              <router-link
                :to="link.href"
                class="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                <component
                  :is="link.icon"
                  class="h-3.5 w-3.5"
                  v-if="useIcons && link.icon"
                />
                {{ link.name }}
              </router-link>
            </li>

            <!-- Contact -->
            <li>
              <a
                href="mailto:hi@repo.md"
                class="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                hi@repo.md
              </a>
            </li>

            <!-- Separator -->
            <li class="py-1">
              <div class="border-t w-10 border-muted"></div>
            </li>

            <!-- Legal links at the end -->
            <li v-for="link in companyLinks.slice(-2)" :key="link.name">
              <router-link
                :to="link.href"
                class="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                <component
                  :is="link.icon"
                  class="h-3.5 w-3.5"
                  v-if="useIcons && link.icon"
                />
                {{ link.name }}
              </router-link>
            </li>
          </ul>
        </div>

        <div class="space-y-4">
          <Logotype />
        </div>
      </div>
    </div>
  </footer>
</template>
