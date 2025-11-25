// store/orgStore.js
import { defineStore } from "pinia";
import trpc from "@/trpc";

// Flag to force using mock data during development
const USE_MOCK_DATA = false;

// Temporary mock data for development
const MOCK_ORGS = [
	{
		_id: "org_1",
		name: "Personal Workspace",
		handle: "felix",
		description: "Your personal workspace",
		is_personal: true,
		owner: "user_1",
		created_at: "2023-01-01T00:00:00.000Z",
		updated_at: "2023-01-01T00:00:00.000Z",
		members: [],
		settings: {
			default_visibility: "private",
		},
	},
	{
		_id: "org_2",
		name: "Repo.md",
		handle: "pushmd",
		description: "Repo.md organization",
		is_personal: false,
		owner: "user_1",
		created_at: "2023-02-01T00:00:00.000Z",
		updated_at: "2023-02-01T00:00:00.000Z",
		members: [
			{
				userId: "user_2",
				role: "admin",
				added_at: "2023-02-01T00:00:00.000Z",
			},
		],
		settings: {
			default_visibility: "private",
		},
	},
];

const MOCK_PROJECTS = [
	{
		id: "poprr-app",
		name: "porrr-app",
		domain: "repo.md",
		owner: "felix_m",
		repo: "felix_m/porrr-app",
		branch: "main",
		lastUpdated: "2h ago",
		status: "active",
		orgId: "org_2",
	},
	// ... other mock projects
];

export const useOrgStore = defineStore("orgs", {
	state: () => ({
		orgs: [],
		currentOrg: null,
		projects: [],
		orgsLoading: false,
		orgLoading: false,
		projectsLoading: false,
		error: null,
		gitScope: null,

		// GitHub data
		profileData: null,
		userOrganizations: [],
		namespaces: [],

		// Track which orgs we've already fetched projects for
		loadedOrgProjects: new Set(),
		// Track orgs that failed to load projects (to prevent retry spam)
		failedOrgProjects: new Set(),
	}),

	getters: {
		userOrgs: (state) => state.orgs || [],

		personalOrg: (state) => state.orgs.find((org) => org.is_personal) || null,

		activeProjects: (state) =>
			state.projects.filter((project) => project.status === "active"),

		currentOrgProjects(state) {
			if (!state.currentOrg) return [];
			return state.projects.filter(
				(project) => project.orgId === state.currentOrg.handle,
			);
		},

		getOrgByHandle: (state) => (handle) =>
			state.orgs.find((org) => org.handle === handle) || null,

		getUserTeam(state) {
			const org = state.currentOrg || state.orgs[0];
			if (!org) return {};

			return {
				name: org.name,
				type: org.is_personal ? "Hobby" : "Team",
				_id: org._id,
				handle: org.handle,
			};
		},

		getGitScope(state) {
			// Setup default scope if not already set
			if (!state.gitScope) {
				state.gitScope =
					state.profileData?.login ||
					state.namespaces[0]?.value ||
					state.orgs[0]?.handle ||
					state.orgs[0]?.name ||
					"default";
			}
			return state.gitScope;
		},

		getAvailableGitScopes(state) {
			if (state.namespaces.length > 0) {
				return state.namespaces;
			}

			// Fallback to Repo.md orgs
			const scopes = [];

			// Add user's personal scope
			if (state.currentOrg?.is_personal) {
				scopes.push({
					value: state.currentOrg.handle || state.currentOrg.name,
					label: state.currentOrg.name,
					type: "user",
					avatar: "/placeholder.svg",
				});
			}

			// Add non-personal orgs
			state.orgs.forEach((org) => {
				if (!org.is_personal) {
					scopes.push({
						value: org.handle || org.name,
						label: org.name,
						type: "organization",
						avatar: "/placeholder.svg",
					});
				}
			});

			return scopes.length
				? scopes
				: [
						{
							value: state.gitScope,
							label: state.gitScope,
							type: "user",
							avatar: "/placeholder.svg",
						},
					];
		},
	},

	actions: {
		// Helper to find org by ID or handle
		findOrg(orgId) {
			return (USE_MOCK_DATA ? MOCK_ORGS : this.orgs).find(
				(o) => o._id === orgId || o.handle === orgId,
			);
		},

		// Helper to simulate network delay in mock mode
		async mockDelay(ms = 500) {
			if (USE_MOCK_DATA) {
				await new Promise((resolve) => setTimeout(resolve, ms));
			}
		},

		// Helper to set default git scope
		setDefaultGitScope() {
			if (!this.gitScope && this.orgs.length > 0) {
				const personalOrg = this.orgs.find((org) => org.is_personal);
				this.gitScope = personalOrg
					? personalOrg.handle || personalOrg.name
					: this.orgs[0].handle || this.orgs[0].name;
			}
		},

		// Helper to handle API calls with mock support
		async withApiCall(mockFn, apiFn) {
			try {
				if (USE_MOCK_DATA) {
					await this.mockDelay();
					return await mockFn();
				} else {
					return await apiFn();
				}
			} catch (err) {
				console.error("API call error:", err);
				this.error = err.message || "An error occurred";
				throw err;
			}
		},

		async fetchOrgs() {
			if (this.orgsLoading) return;

			try {
				this.orgsLoading = true;
				this.error = null;

				const result = await this.withApiCall(
					// Mock function
					() => {
						this.orgs = MOCK_ORGS;
						return { success: true, orgs: MOCK_ORGS };
					},
					// API function
					async () => {
						const response = await trpc.orgs.list.query();
						if (response.success) {
							this.orgs = response.orgs;
						}
						return response;
					},
				);

				if (result.success) {
					this.setDefaultGitScope();
					console.log("Loaded organizations:", this.orgs);
				} else {
					this.error = "Failed to load organizations";
				}
			} finally {
				this.orgsLoading = false;
			}
		},

		async fetchOrgById(orgId) {
			try {
				this.orgLoading = true;
				this.error = null;

				const result = await this.withApiCall(
					// Mock function
					() => {
						const org = this.findOrg(orgId);
						if (org) {
							this.currentOrg = org;
							return { success: true, org };
						}
						return { success: false, error: "Organization not found" };
					},
					// API function
					async () => {
						const response = await trpc.orgs.get.query({ orgId });
						if (response.success) {
							this.currentOrg = response.org;
						}
						return response;
					},
				);

				if (!result.success) {
					this.error = result.error || "Failed to load organization details";
				}

				return result.success ? result.org : null;
			} finally {
				this.orgLoading = false;
			}
		},

		async fetchProjects(orgId) {
			// Skip if already loading or if we've already fetched this org's projects
			if (this.projectsLoading || this.loadedOrgProjects.has(orgId)) {
				return;
			}

			// Skip if we previously failed to load this org's projects
			if (this.failedOrgProjects.has(orgId)) {
				console.warn(
					`Skipping fetch for org ${orgId} - previous attempt failed`,
				);
				return;
			}

			try {
				this.projectsLoading = true;
				this.error = null;

				const result = await this.withApiCall(
					// Mock function
					() => {
						const org = this.findOrg(orgId);
						if (org) {
							const orgProjects = MOCK_PROJECTS.filter(
								(p) => p.orgId === org._id,
							);
							// Only update projects for this org, don't overwrite all projects
							this.projects = this.projects
								.filter((p) => p.orgId !== org._id)
								.concat(orgProjects);
							return { success: true, projects: orgProjects };
						}
						return { success: false, error: "Organization not found" };
					},
					// API function
					async () => {
						const response = await trpc.projects.list.query({
							orgId,
							includeCollaborations: true,
						});

						if (response.success) {
							// Only update projects for this org, don't overwrite all projects
							const orgProjects = response.projects;
							this.projects = this.projects
								.filter((p) => p.orgId !== orgId)
								.concat(orgProjects);
							return { success: true, projects: orgProjects };
						}
						return response;
					},
				);

				if (result.success) {
					// Mark this org as loaded
					this.loadedOrgProjects.add(orgId);
				} else {
					// Mark this org as failed to prevent retry spam
					this.failedOrgProjects.add(orgId);
					this.error = result.error || "Failed to load projects";
				}
			} finally {
				this.projectsLoading = false;
			}
		},

		async fetchAllProjects() {
			if (this.projectsLoading) return;

			try {
				this.projectsLoading = true;
				this.error = null;

				const result = await this.withApiCall(
					// Mock function
					() => {
						this.projects = MOCK_PROJECTS;
						return { success: true, projects: this.projects };
					},
					// API function
					async () => {
						const response = await trpc.projects.list.query({
							includeCollaborations: true,
						});

						if (response.success) {
							this.projects = response.projects;
							// Mark all orgs with projects as loaded
							const orgIds = new Set(response.projects.map((p) => p.orgId));
							orgIds.forEach((id) => this.loadedOrgProjects.add(id));
						}
						return response;
					},
				);

				if (!result.success) {
					this.error = result.error || "Failed to load projects";
				}
			} finally {
				this.projectsLoading = false;
			}
		},

		// Force refresh projects for an org, bypassing cache
		async refreshOrgProjects(orgId) {
			this.loadedOrgProjects.delete(orgId);
			this.failedOrgProjects.delete(orgId);
			return this.fetchProjects(orgId);
		},

		// Reset project fetch status (for retrying failed fetches)
		resetProjectFetchStatus(orgId) {
			this.failedOrgProjects.delete(orgId);
		},

		async createOrg(orgData) {
			return await this.withApiCall(
				// Mock function
				() => {
					const newOrg = {
						_id: `org_${Date.now()}`,
						...orgData,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
						owner: "user_1",
						members: [],
					};

					MOCK_ORGS.push(newOrg);
					this.orgs.push(newOrg);

					return { success: true, org: newOrg };
				},
				// API function
				async () => {
					const result = await trpc.orgs.create.mutate(orgData);
					if (result.success) {
						this.orgs.push(result.org);
					}
					return result;
				},
			);
		},

		async updateOrg(orgId, updates) {
			return await this.withApiCall(
				// Mock function
				() => {
					const mockOrg = MOCK_ORGS.find((o) => this.findOrg(orgId));
					if (mockOrg) {
						Object.assign(mockOrg, updates, {
							updated_at: new Date().toISOString(),
						});

						// Update local state
						const localOrg = this.orgs.find((o) => this.findOrg(orgId));
						if (localOrg) {
							Object.assign(localOrg, updates);
						}

						if (
							this.currentOrg?._id === orgId ||
							this.currentOrg?.handle === orgId
						) {
							Object.assign(this.currentOrg, updates);
						}

						return { success: true };
					}

					return { success: false, error: "Organization not found" };
				},
				// API function
				async () => {
					const result = await trpc.orgs.update.mutate({ orgId, updates });

					if (result.success) {
						const orgIndex = this.orgs.findIndex((o) => o._id === orgId);
						if (orgIndex >= 0) {
							Object.assign(this.orgs[orgIndex], updates);
						}

						if (this.currentOrg?._id === orgId) {
							Object.assign(this.currentOrg, updates);
						}
					}

					return result;
				},
			);
		},

		async addOrgMember(orgId, userEmail, role = "member") {
			return await this.withApiCall(
				// Mock function
				() => {
					const mockOrg = MOCK_ORGS.find((o) => this.findOrg(orgId));
					if (mockOrg) {
						const newMember = {
							userId: `user_${Date.now()}`,
							role,
							added_at: new Date().toISOString(),
						};

						mockOrg.members = mockOrg.members || [];
						mockOrg.members.push(newMember);
						mockOrg.updated_at = new Date().toISOString();

						if (
							this.currentOrg?._id === orgId ||
							this.currentOrg?.handle === orgId
						) {
							this.currentOrg = { ...mockOrg };
						}

						return { success: true };
					}

					return { success: false, error: "Organization not found" };
				},
				// API function
				async () => {
					const result = await trpc.orgs.addMember.mutate({
						orgId,
						userEmail,
						role,
					});

					if (result.success && this.currentOrg?._id === orgId) {
						await this.fetchOrgById(orgId);
					}

					return result;
				},
			);
		},

		async removeOrgMember(orgId, userId) {
			return await this.withApiCall(
				// Mock function
				() => {
					const mockOrg = MOCK_ORGS.find((o) => this.findOrg(orgId));
					if (mockOrg) {
						if (mockOrg.owner === userId) {
							return {
								success: false,
								error: "Cannot remove the organization owner",
							};
						}

						if (mockOrg.members) {
							mockOrg.members = mockOrg.members.filter(
								(m) => m.userId !== userId,
							);
							mockOrg.updated_at = new Date().toISOString();
						}

						if (
							this.currentOrg?._id === orgId ||
							this.currentOrg?.handle === orgId
						) {
							this.currentOrg = { ...mockOrg };
						}

						return { success: true };
					}

					return { success: false, error: "Organization not found" };
				},
				// API function
				async () => {
					const result = await trpc.orgs.removeMember.mutate({ orgId, userId });

					if (result.success && this.currentOrg?._id === orgId) {
						await this.fetchOrgById(orgId);
					}

					return result;
				},
			);
		},

		async deleteOrg(orgId) {
			return await this.withApiCall(
				// Mock function
				() => {
					const org = this.findOrg(orgId);
					if (!org) {
						return { success: false, error: "Organization not found" };
					}

					if (org.is_personal) {
						return {
							success: false,
							error: "Cannot delete your personal organization",
						};
					}

					// Remove from mock data and local state
					const mockIndex = MOCK_ORGS.findIndex(
						(o) => o._id === orgId || o.handle === orgId,
					);
					if (mockIndex >= 0) {
						MOCK_ORGS.splice(mockIndex, 1);
					}

					this.orgs = this.orgs.filter(
						(o) => o._id !== orgId && o.handle !== orgId,
					);

					if (
						this.currentOrg?._id === orgId ||
						this.currentOrg?.handle === orgId
					) {
						this.currentOrg = null;
					}

					// Remove associated projects
					MOCK_PROJECTS.forEach((project, index) => {
						if (project.orgId === org._id) {
							MOCK_PROJECTS.splice(index, 1);
						}
					});

					return { success: true };
				},
				// API function
				async () => {
					const result = await trpc.orgs.delete.mutate({ orgId });

					if (result.success) {
						this.orgs = this.orgs.filter((o) => o._id !== orgId);

						if (this.currentOrg?._id === orgId) {
							this.currentOrg = null;
						}
					}

					return result;
				},
			);
		},

		updateGitScope(scope) {
			this.gitScope = scope;
		},

		async loadGitHubProfile() {
			try {
				console.log("Loading GitHub profile data");
				const result = await trpc.github.getProfile.query();

				if (!result?.profile) {
					throw new Error("Invalid profile data received");
				}

				this.profileData = result.profile;
				this.updateNamespacesWithProfile();

				return this.profileData;
			} catch (error) {
				console.error("Failed to load GitHub profile:", error);
				return null;
			}
		},

		async loadGitHubOrganizations() {
			try {
				console.log("Loading GitHub organizations");
				const result = await trpc.github.listOrganizations.query();

				if (result.success && result.organizations) {
					this.userOrganizations = result.organizations;
					this.updateNamespacesWithOrganizations();
					return this.userOrganizations;
				}

				return [];
			} catch (error) {
				console.error("Failed to load GitHub organizations:", error);
				return [];
			}
		},

		// Helper to update/add namespace
		updateNamespace(namespace) {
			const existingIndex = this.namespaces.findIndex(
				(n) => n.value === namespace.value,
			);

			if (existingIndex >= 0) {
				this.namespaces[existingIndex] = namespace;
			} else {
				this.namespaces.push(namespace);
			}
		},

		updateNamespacesWithProfile() {
			if (!this.profileData) return;

			this.updateNamespace({
				value: this.profileData.login,
				label: this.profileData.login,
				type: "user",
				avatar: this.profileData.avatar_url || "/placeholder.svg",
			});

			if (!this.gitScope) {
				this.gitScope = this.profileData.login;
			}
		},

		updateNamespacesWithOrganizations() {
			if (!this.userOrganizations?.length) return;

			this.userOrganizations.forEach((org) => {
				this.updateNamespace({
					value: org.login,
					label: org.login,
					type: "organization",
					avatar: org.avatar_url || "/placeholder.svg",
				});
			});
		},

		async initializeGitHubData() {
			await Promise.all([
				this.loadGitHubProfile(),
				this.loadGitHubOrganizations(),
			]);

			console.log("GitHub data initialized with namespaces:", this.namespaces);
			return this.namespaces;
		},
	},
});
