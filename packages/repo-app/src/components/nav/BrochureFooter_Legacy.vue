<script setup>
import { ref } from "vue";
import Logotype from "@/components/Logotype.vue";
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


const currentYear = new Date().getFullYear();

const footerLinks = ref([
	{ name: "Guides", href: "/blog" },
	{ name: "Docs", href: "/docs" },
	{ name: "Templates", href: "/templates" },

	// { name: "Conditions d'utilisation", href: "/terms" },
	//{ name: "Politique de confidentialité", href: "/privacy" },
]);

const socialLinks = ref([
	{
		name: "GitHub",
		href: "https://github.com/repo-md",
		icon: Github,
	},
	/*
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/repo.md",
    icon: Linkedin,
  },
  {
    name: "Twitter",
    href: "https://x.com/Repo.mdio",
    icon: XIcon, // Twitter,
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/@Repo.mdio",
    icon: Youtube,
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@pushmd_io",
    icon: Video,
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/repo.md/",
    icon: Instagram,
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61573882709562",
    icon: Facebook,
  },*/
]);
</script>

<template>
  <footer
    class="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
  >
    <div class="container mx-auto px-4 py-12">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
        <!-- Logo and Copyright -->
        <div class="space-y-4">
          <Logotype />
          <p class="text-sm text-muted-foreground">
            © {{ currentYear }} Repo.md.
          </p>
        </div>

        <!-- Legal Links -->
        <div>
          <h4 class="font-semibold mb-4">Getting started</h4>
          <ul class="space-y-2">
            <li v-for="link in footerLinks" :key="link.name">
              <router-link
                :to="link.href"
                class="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {{ link.name }}
              </router-link>
            </li>
          </ul>
        </div>

        <!-- Contact -->
        <div>
          <h4 class="font-semibold mb-4">Contact</h4>
          <a
            href="mailto:support@repo.md"
            class="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            hi@repo.md
          </a>
        </div>

        <!-- Social Links -->
        <div>
          <h4 class="font-semibold mb-4">Elsewhere</h4>
          <ul class="flex flex-wrap gap-4">
            <li v-for="link in socialLinks" :key="link.name">
              <a
                :href="link.href"
                target="_blank"
                rel="noopener noreferrer"
                class="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                :title="link.name"
              >
                <component :is="link.icon" class="h-5 w-5" />
                <span class="sr-only">{{ link.name }}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </footer>
</template>
