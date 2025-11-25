// store/templateStore.js
import { defineStore } from "pinia";
import trpc from "@/trpc";

import { appConfigs } from "@/appConfigs.js";
const { BRAND } = appConfigs;

// Templates will be fetched from the backend API
// No hardcoded template data needed anymore

export const useTemplateStore = defineStore("templates", {
	state: () => ({
		templates: [],
		loading: false,
		error: null,
	}),

	getters: {
		// Get all templates
		getAllTemplates() {
			return this.templates;
		},

		// Get template by ID
		getTemplateById() {
			return (id) =>
				this.templates.find((template) => template.id === Number(id));
		},

		// Get templates by category
		getTemplatesByCategory() {
			return (category) =>
				this.templates.filter((template) =>
					template.categories.includes(category),
				);
		},

		// Get templates by framework
		getTemplatesByFramework() {
			return (framework) => {
				if (framework === "all") {
					return this.templates;
				}
				return this.templates.filter(
					(template) => template.framework === framework,
				);
			};
		},

		// Get related templates (excluding the current template)
		getRelatedTemplates() {
			return (templateId, limit = 4) => {
				const currentTemplate = this.getTemplateById(templateId);
				if (!currentTemplate) return [];

				// Find templates with similar categories
				return this.templates
					.filter(
						(template) =>
							template.id !== currentTemplate.id &&
							template.categories.some((category) =>
								currentTemplate.categories.includes(category),
							),
					)
					.slice(0, limit);
			};
		},
	},

	actions: {
		// Fetch templates from backend API
		async fetchTemplates(options = {}) {
			try {
				this.loading = true;
				this.error = null;

				// Call the backend API to get templates
				const response = await trpc.projects.listTemplates.query({
					owner: options.owner || 'repo-md',
					type: options.type || 'org',
					includeGithubData: options.includeGithubData || false
				});

				if (response.success) {
					// Update templates with data from backend
					// The backend response includes templateOwner and templateRepo fields
					this.templates = response.templates.map(template => ({
						...template,
						// Ensure backward compatibility with existing code
						githubRepo: template.githubRepo || `${template.templateOwner}/${template.templateRepo}`
					}));
					return { success: true };
				} else {
					throw new Error('Failed to fetch templates');
				}
			} catch (err) {
				console.error("Error fetching templates:", err);
				this.error = err.message || "Failed to load templates";
				
				// No fallback to local templates - templates must come from API
				console.warn("Failed to fetch templates from API");
				
				return { success: false, error: this.error };
			} finally {
				this.loading = false;
			}
		},
	},
});
