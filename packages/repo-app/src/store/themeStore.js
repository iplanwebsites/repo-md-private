// store/themeStore.js
import { defineStore } from "pinia";

import { appConfigs } from "@/appConfigs.js";
const { BRAND } = appConfigs;

// Theme data
export const THEMES = [
	{
		// id: 3,
		id: "simple-blog-remix",
		slug: "simple-blog-remix",
		name: "Simple blog",
		icon: "/api/placeholder/24/24",
		image: "/api/placeholder/400/220",
		description: "A simple blog website.",

		//    description: "Get started with Next.js and React in seconds.",
		githubRepo: "repo-md/simple-blog-remix",
		demo: "https://simple-blog-remix.repo.md",
		categories: ["Starter", "Blog", "Remix", "React", "Cloudflare"],
		author: "Repo.md",
		framework: ["react", "remix"],
		stars: 45,
	},

	/*

   {
    id: 2,
    slug: "portfolio",
    name: "Minimal Portfolio theme",
    icon: "/api/placeholder/24/24",
    image: "/api/placeholder/400/220",
    description: "A simple and clean Portfolio website.",

    //    description: "Get started with Next.js and React in seconds.",
    githubRepo: "repo-md/portfolio",
    categories: ["Starter", "Portfolio"],
    author: "Repo.md",
    framework: "repo",
    stars: 45,
  },
  {
    id: 2,
    name: "Image Gallery Starter",
    icon: "/api/placeholder/24/24",
    image: "/api/placeholder/400/220",
    description: "An image gallery built on Next.js and Cloudinary.",
    githubRepo: "pushmd/next.js",
    categories: ["Starter", "Image Gallery"],
    author: "Repo.md",
    framework: "react",
    stars: 32,
  },
  {
    id: 3,
    name: "Next.js AI Chatbot",
    icon: "/api/placeholder/24/24",
    image: "/api/placeholder/400/220",
    description:
      "A full-featured, hackable Next.js AI chatbot built by Repo.md",
    githubRepo: "vercel/ai-chatbot",
    categories: ["AI", "Next.js"],
    author: "Repo.md",
    framework: "next",
    stars: 40,
  },
  {
    id: 4,
    name: "Next.js MDX Blog",
    icon: "/api/placeholder/24/24",
    image: "/api/placeholder/400/220",
    description: "Beautiful websites with Next.js & MDX.",
    githubRepo: "vercel/next.js",
    categories: ["Blog", "MDX"],
    author: "Repo.md",
    framework: "next",
    stars: 37,
  },
  {
    id: 5,
    name: "E-commerce Store",
    icon: "/api/placeholder/24/24",
    image: "/api/placeholder/400/220",
    description: "Full-featured e-commerce site with Next.js and Stripe",
    githubRepo: "vercel/commerce",
    categories: ["Ecommerce", "Next.js"],
    author: "Repo.md",
    framework: "next",
    stars: 28,
  },
  {
    id: 6,
    name: "Portfolio Template",
    icon: "/api/placeholder/24/24",
    image: "/api/placeholder/400/220",
    description: "Professional portfolio site with Next.js",
    githubRepo: "vercel/portfolio",
    categories: ["Portfolio", "Next.js"],
    author: "Repo.md",
    framework: "next",
    stars: 22,
  },
  {
    id: 7,
    name: "Vite + React Starter",
    icon: "/api/placeholder/24/24",
    image: "/api/placeholder/200/120",
    description: "Modern frontend development with Vite and React",
    githubRepo: "vitejs/vite",
    categories: ["Starter", "React"],
    author: "Vite",
    framework: "react",
    stars: 60,
  },

  */
];

export const useThemeStore = defineStore("themes", {
	state: () => ({
		themes: THEMES,
		loading: false,
		error: null,
	}),

	getters: {
		// Get all themes
		getAllThemes() {
			return this.themes;
		},

		// Get theme by ID
		getThemeById() {
			return (id) => this.themes.find((theme) => theme.id === String(id));
		},

		// Get themes by category
		getThemesByCategory() {
			return (category) =>
				this.themes.filter((theme) => theme.categories.includes(category));
		},

		// Get themes by framework
		getThemesByFramework() {
			return (framework) => {
				if (framework === "all") {
					return this.themes;
				}
				return this.themes.filter((theme) => theme.framework === framework);
			};
		},

		// Get related themes (excluding the current theme)
		getRelatedThemes() {
			return (themeId, limit = 4) => {
				const currentTheme = this.getThemeById(themeId);
				if (!currentTheme) return [];

				// Find themes with similar categories
				return this.themes
					.filter(
						(theme) =>
							theme.id !== currentTheme.id &&
							theme.categories.some((category) =>
								currentTheme.categories.includes(category),
							),
					)
					.slice(0, limit);
			};
		},
	},

	actions: {
		// Actions to fetch themes from API could be added here in the future
		async fetchThemes() {
			try {
				this.loading = true;
				this.error = null;

				// In a real implementation, this would be an API call
				// For now, we just use the mock data
				await new Promise((resolve) => setTimeout(resolve, 300));

				// Themes are already in state, no need to update
				return { success: true };
			} catch (err) {
				console.error("Error fetching themes:", err);
				this.error = err.message || "Failed to load themes";
				return { success: false, error: this.error };
			} finally {
				this.loading = false;
			}
		},
	},
});
