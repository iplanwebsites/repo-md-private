<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useOrgStore } from "@/store/orgStore";
import { useThemeStore } from "@/store/themeStore";
import { getMCPServerUrl, getA2AServerUrl, getAgentUrl } from "@/lib/utils/repoUrlUtils";
import {
	Search,
	User,
	CreditCard,
	FileText,
	Users,
	Lock,
	Shield,
	Server,
	BadgeAlert,
	Save,
	Link,
	ClipboardCopy,
	ExternalLink,
	CornerLeftUp,
	RotateCw,
	Plus,
	Check,
	Image,
	Palette,
	Sun,
	Moon,
	MonitorSmartphone,
	Type,
	Bot,
	PlusCircle,
	Globe,
	Terminal,
	Edit,
	Trash2,
	AlertTriangle,
	Key,
	Puzzle,
	Mail,
	MessageSquare,
	Slack,
	CheckCircle2,
	Circle,
	Filter,
	Tag,
	LineChart,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter, useRoute } from "vue-router";
import PageHeadingBar from "@/components/PageHeadingBar.vue";
import SettingsCard from "@/components/SettingsCard.vue";
import SettingsHeading from "@/components/SettingsHeading.vue";
 
import { useToast } from "@/components/ui/toast/use-toast";
import trpc from "@/trpc";
import { integrationsConfig, categoryInfo } from "@/config/integrationsConfig";

// Props for project data passed from parent
const props = defineProps({
	project: {
		type: Object,
		default: null,
	},
});

// Get the organization store and theme store
const orgStore = useOrgStore();
const themeStore = useThemeStore();
const router = useRouter();
const route = useRoute();
const { toast } = useToast();

// Active section based on route parameter
const activeSection = computed(() => {
  // If section isn't in the params, default to 'general'
  return route.params.section || 'general';
});

// Parse recurring tasks
const parsedRecurringTasks = computed(() => {
  if (!editorAgentRecurringTasks.value) return [];
  
  const tasks = [];
  const lines = editorAgentRecurringTasks.value.split('\n').filter(line => line.trim());
  
  lines.forEach(line => {
    const parsed = {
      original: line,
      frequency: 'unknown',
      time: null,
      nextRun: null,
      description: line
    };
    
    // Parse daily tasks
    if (line.toLowerCase().includes('daily') || line.toLowerCase().includes('every day')) {
      parsed.frequency = 'daily';
      const timeMatch = line.match(/at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?|(\d{1,2})\s*(am|pm)/i);
      if (timeMatch) {
        parsed.time = timeMatch[0];
      }
      
      // Calculate next run
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      parsed.nextRun = `Tomorrow ${parsed.time || 'at scheduled time'}`;
    }
    
    // Parse weekly tasks
    else if (line.toLowerCase().includes('weekly') || line.toLowerCase().includes('every week')) {
      parsed.frequency = 'weekly';
      const dayMatch = line.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/i);
      if (dayMatch) {
        parsed.day = dayMatch[0];
        parsed.nextRun = `Next ${dayMatch[0]}`;
      }
    }
    
    // Parse time-based patterns
    const timePatterns = [
      /at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?/i,
      /(\d{1,2})\s*(am|pm)/i,
      /(\d{1,2})h/i
    ];
    
    for (const pattern of timePatterns) {
      const match = line.match(pattern);
      if (match && !parsed.time) {
        parsed.time = match[0];
        break;
      }
    }
    
    tasks.push(parsed);
  });
  
  return tasks;
});

// Integration categories from config
const integrationCategories = computed(() => {
  const categories = [
    { id: "all", name: "All Integrations", icon: Puzzle }
  ];
  
  Object.entries(categoryInfo).forEach(([id, info]) => {
    categories.push({ id, ...info });
  });
  
  return categories;
});

// Filtered integrations based on selected category
const filteredIntegrations = computed(() => {
  if (activeIntegrationFilter.value === "all") {
    return Object.entries(integrations.value);
  }
  return Object.entries(integrations.value).filter(
    ([key, config]) => config.category === activeIntegrationFilter.value
  );
});

// Get integration display info from config
const getIntegrationInfo = (key) => {
  const config = integrationsConfig[key];
  if (!config) {
    return { name: key, description: "", icon: Puzzle, color: "bg-gray-500" };
  }
  
  return {
    name: config.brandName || config.name,
    description: config.description,
    icon: config.icon,
    color: config.color,
    website: config.website,
    pricing: config.pricing,
    features: config.features
  };
};

// Handle integration connection
const connectIntegration = async (key) => {
  toast({
    title: "Connecting Integration",
    description: `Setting up ${getIntegrationInfo(key).name}...`,
  });
  
  // For now, just mark as connected
  // In production, this would handle OAuth flow or API key validation
  integrations.value[key].connected = true;
  
  toast({
    title: "Integration Connected",
    description: `${getIntegrationInfo(key).name} has been connected successfully.`,
  });
};

// Handle integration disconnection
const disconnectIntegration = async (key) => {
  integrations.value[key].connected = false;
  integrations.value[key].enabled = false;
  
  toast({
    title: "Integration Disconnected",
    description: `${getIntegrationInfo(key).name} has been disconnected.`,
  });
};

// Form data
const projectName = ref("");
const projectHandle = ref("");
const projectId = ref("");
const projectDomainKey = ref("");
const repositoryFolder = ref("");
const ignoreFiles = ref("");
const isSaving = ref(false);
const saveError = ref(null);

// Media settings
const imageSizes = ref({
  xs: false,
  sm: false,
  lg: true,
  xl: false,
  "2xl": false
});
const imageFormats = ref({
  jpg: true,
  webp: false
});
const enableYoutubeEmbeds = ref(false);
const enableAudioPlayer = ref(false);

// Code blocks settings
const codeBlockRender = ref("css"); // css (default) or iframe
const codeBlockTheme = ref("light"); // light or dark

// Diagrams (Mermaid) settings
const mermaidRender = ref("svg"); // keep-as-code, iframe, or svg (default)
const mermaidTheme = ref("light"); // light or dark

// Formatting settings
const defaultPageVisibility = ref("public"); // public, private, hidden
const parseFormulas = ref(false);
const removeDeadLinks = ref(true);
const syntaxHighlighting = ref(true);
const pageLinkPrefix = ref(""); // Can be empty, relative path like /blog, or full URL like https://blog.example.com/
const mediaPrefix = ref("_repo/medias"); // Default media folder for optimized images

// Theme settings
const selectedThemeId = ref("simple-blog-remix");
const siteName = ref("");
const footerText = ref("");
const preferredColorScheme = ref("auto"); // "light", "dark", or "auto"
const themes = computed(() => themeStore.getAllThemes);

// AI settings
const enableMCP = ref(true);
const enableA2A = ref(true);
const enableAIImageSearch = ref(true);
const enableAITextSearch = ref(true);
const enableAgent = ref(false);
const agentModel = ref("gpt-4o");
const agentSystemPrompt = ref("");
const projectSummary = ref("");

// Public Agent capabilities
const publicAgentCapabilities = ref({
  sendSupportRequest: false,
  sendCustomerFeedback: false,
  searchContent: true, // default true
  suggestNewContent: false,
  suggestEdits: false
});

// Public Agent integration settings
const publicAgentIntegrations = ref({
  enablePublicMCP: false,
  enableAskEndpoint: false
});

// Editor Agent settings
const editorAgentPermissions = ref({
  editPosts: false,
  createPosts: false,
  publishSchedulePosts: false,
  generateImages: false
});
const editorAgentSystemPrompt = ref("");
const editorAgentRecurringTasks = ref("");

// Integrations settings
const activeIntegrationFilter = ref("all");

// Initialize integrations from config
const initializeIntegrations = () => {
  const integrationsData = {};
  
  Object.entries(integrationsConfig).forEach(([key, config]) => {
    integrationsData[key] = {
      connected: false,
      enabled: false,
      category: config.category,
      fields: {}
    };
    
    // Initialize field values from config
    if (config.fields) {
      Object.entries(config.fields).forEach(([fieldKey, fieldConfig]) => {
        integrationsData[key].fields[fieldKey] = fieldConfig.default || "";
      });
    }
  });
  
  return integrationsData;
};

const integrations = ref(initializeIntegrations());

// OpenAI models for agent
const openAiModels = [
  "gpt-4o",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo",
];

// Build settings
const enableAutoDeployment = ref(true);

// Secrets (API Keys)
const apiKeys = ref({
  openai: "",
  anthropic: "",
  elevenlabs: "",
  google: "",
  replicate: "",
  huggingface: ""
});

// Computed properties
const currentOrg = computed(() => orgStore.currentOrg);
const orgHandle = computed(() => route.params.orgId);

// MCP, A2A, and Agent server URLs based on projectId
const mcpServerUrl = ref("");
const a2aServerUrl = ref("");
const agentUrl = ref("");

// Update URL values when projectId changes
watch(projectId, (newProjectId) => {
  mcpServerUrl.value = getMCPServerUrl(newProjectId);
  a2aServerUrl.value = getA2AServerUrl(newProjectId);
  agentUrl.value = getAgentUrl(newProjectId);
}, { immediate: true });

// Load project data
const loadProjectData = () => {
	saveError.value = null;

	if (props.project) {
		// Use data from the project prop
		projectName.value = props.project?.name || "";
		projectHandle.value = props.project?.slug || "";
		projectId.value = props.project._id || "";
		projectDomainKey.value = props.project?.domainKey || "";
		repositoryFolder.value = props.project?.repositoryFolder || "";
		ignoreFiles.value = props.project?.ignoreFiles || "";

		// Load media settings if they exist
		if (props.project.media) {
			if (props.project.media.imageSizes) {
				imageSizes.value = { ...imageSizes.value, ...props.project.media.imageSizes };
			}
			if (props.project.media.imageFormats) {
				imageFormats.value = { ...imageFormats.value, ...props.project.media.imageFormats };
			}
			enableYoutubeEmbeds.value = props.project.media.enableYoutubeEmbeds || false;
			enableAudioPlayer.value = props.project.media.enableAudioPlayer || false;
			codeBlockRender.value = props.project.media.codeBlockRender || "css";
			codeBlockTheme.value = props.project.media.codeBlockTheme || "light";
			mermaidRender.value = props.project.media.mermaidRender || "svg";
			mermaidTheme.value = props.project.media.mermaidTheme || "light";
		}
		
		// Load formatting settings if they exist
		if (props.project.formatting) {
			defaultPageVisibility.value = props.project.formatting.defaultPageVisibility || "public";
			parseFormulas.value = props.project.formatting.parseFormulas !== undefined ? props.project.formatting.parseFormulas : false;
			removeDeadLinks.value = props.project.formatting.removeDeadLinks !== undefined ? props.project.formatting.removeDeadLinks : true;
			syntaxHighlighting.value = props.project.formatting.syntaxHighlighting !== undefined ? props.project.formatting.syntaxHighlighting : true;
			pageLinkPrefix.value = props.project.formatting.pageLinkPrefix || "";
			mediaPrefix.value = props.project.formatting.mediaPrefix || "_repo/medias";
		}
		
		// Load theme settings if they exist
		if (props.project.theme) {
			selectedThemeId.value = props.project.theme.themeId || "simple-blog-remix";
			siteName.value = props.project.theme.siteName || "";
			footerText.value = props.project.theme.footerText || "";
			preferredColorScheme.value = props.project.theme.preferredColorScheme || "auto";
		}
		
		// Load AI settings if they exist
		if (props.project.ai) {
			enableMCP.value = props.project.ai.enableMCP !== undefined ? props.project.ai.enableMCP : true;
			enableA2A.value = props.project.ai.enableA2A !== undefined ? props.project.ai.enableA2A : true;
			enableAgent.value = props.project.ai.enableAgent !== undefined ? props.project.ai.enableAgent : false;
			agentModel.value = props.project.ai.agentModel || "gpt-4o";
			agentSystemPrompt.value = props.project.ai.agentSystemPrompt || "";
			projectSummary.value = props.project.ai.projectSummary || "";
			
			// Load public agent capabilities if they exist
			if (props.project.ai.publicAgentCapabilities) {
				publicAgentCapabilities.value = {
					...publicAgentCapabilities.value,
					...props.project.ai.publicAgentCapabilities
				};
			}
			
			// Load public agent integrations if they exist
			if (props.project.ai.publicAgentIntegrations) {
				publicAgentIntegrations.value = {
					...publicAgentIntegrations.value,
					...props.project.ai.publicAgentIntegrations
				};
			}
			
			// Load editor agent settings if they exist
			if (props.project.ai.editorAgentPermissions) {
				editorAgentPermissions.value = {
					...editorAgentPermissions.value,
					...props.project.ai.editorAgentPermissions
				};
			}
			editorAgentSystemPrompt.value = props.project.ai.editorAgentSystemPrompt || "";
			editorAgentRecurringTasks.value = props.project.ai.editorAgentRecurringTasks || "";
		}
		
		// Load integrations if they exist
		if (props.project.integrations) {
			Object.keys(integrations.value).forEach(key => {
				if (props.project.integrations[key]) {
					integrations.value[key] = { 
						...integrations.value[key], 
						...props.project.integrations[key] 
					};
				}
			});
		}
		
		// Load build settings if they exist
		if (props.project.build) {
			enableAutoDeployment.value = props.project.build.enableAutoDeployment !== undefined ? props.project.build.enableAutoDeployment : true;
		}
		
		// Load secrets if they exist
		if (props.project.secrets) {
			apiKeys.value = {
				...apiKeys.value,
				...props.project.secrets
			};
		}
	} else {
		// Fallback to current organization data if available
		projectName.value = currentOrg.value?.name || "";
		projectHandle.value = currentOrg.value?.handle || "";
		projectId.value =
			route.params.projectId || "888888888";
	}
};

// Watch for project prop changes
watch(
	() => props.project,
	(newProject) => {
		if (newProject) {
			loadProjectData();
		}
	},
	{ immediate: true },
);

// Save project settings
const saveSettings = async () => {
	if (!projectId.value) {
		saveError.value = "No project data available";
		return;
	}

	isSaving.value = true;
	saveError.value = null;

	try {
		const updates = {
			name: projectName.value,
			slug: projectHandle.value,
			domainKey: projectDomainKey.value,
			repositoryFolder: repositoryFolder.value,
			ignoreFiles: ignoreFiles.value,
			media: {
				imageSizes: imageSizes.value,
				imageFormats: imageFormats.value,
				enableYoutubeEmbeds: enableYoutubeEmbeds.value,
				enableAudioPlayer: enableAudioPlayer.value,
				codeBlockRender: codeBlockRender.value,
				codeBlockTheme: codeBlockTheme.value,
				mermaidRender: mermaidRender.value,
				mermaidTheme: mermaidTheme.value
			},
			formatting: {
				defaultPageVisibility: defaultPageVisibility.value,
				parseFormulas: parseFormulas.value,
				removeDeadLinks: removeDeadLinks.value,
				syntaxHighlighting: syntaxHighlighting.value,
				pageLinkPrefix: pageLinkPrefix.value,
				mediaPrefix: mediaPrefix.value
			},
			theme: {
				themeId: selectedThemeId.value,
				siteName: siteName.value,
				footerText: footerText.value,
				preferredColorScheme: preferredColorScheme.value
			},
			ai: {
				enableMCP: enableMCP.value,
				enableA2A: enableA2A.value,
				enableAIImageSearch: enableAIImageSearch.value,
				enableAITextSearch: enableAITextSearch.value,
				enableAgent: enableAgent.value,
				agentModel: agentModel.value,
				agentSystemPrompt: agentSystemPrompt.value,
				projectSummary: projectSummary.value,
				publicAgentCapabilities: publicAgentCapabilities.value,
				publicAgentIntegrations: publicAgentIntegrations.value,
				editorAgentPermissions: editorAgentPermissions.value,
				editorAgentSystemPrompt: editorAgentSystemPrompt.value,
				editorAgentRecurringTasks: editorAgentRecurringTasks.value
			},
			build: {
				enableAutoDeployment: enableAutoDeployment.value
			},
			integrations: integrations.value,
			secrets: apiKeys.value
		};

		// Log usage for certain pro features
		if (parseFormulas.value) {
			console.log("Usage: Formula parsing feature enabled");
			// Here we would typically log to an analytics service
		}

		const response = await trpc.projects.updateSettings.mutate({
			projectId: projectId.value,
			updates,
		});

		if (response && response.success) {
			console.log("Project settings updated successfully");
			toast({
				title: "Success",
				description: "Project settings updated successfully",
				duration: 3000,
			});
		} else {
			throw new Error(response?.error || "Failed to update project settings");
		}
	} catch (err) {
		console.error("Error updating project settings:", err);
		saveError.value = err.message || "An error occurred while saving settings";
		toast({
			title: "Error",
			description: saveError.value,
			variant: "destructive",
			duration: 5000,
		});
	} finally {
		isSaving.value = false;
	}
};

// Copy project ID to clipboard
const copyProjectId = () => {
	navigator.clipboard.writeText(projectId.value);
	toast({
		title: "Copied",
		description: "Project ID copied to clipboard",
		duration: 3000,
	});
};

// Copy MCP URL to clipboard
const copyMCPUrl = () => {
	navigator.clipboard.writeText(mcpServerUrl.value);
	toast({
		title: "Copied",
		description: "MCP Server URL copied to clipboard",
		duration: 3000,
	});
};

// Copy A2A URL to clipboard
const copyA2AUrl = () => {
	navigator.clipboard.writeText(a2aServerUrl.value);
	toast({
		title: "Copied",
		description: "A2A Server URL copied to clipboard",
		duration: 3000,
	});
};

// Copy Agent URL to clipboard
const copyAgentUrl = () => {
	navigator.clipboard.writeText(agentUrl.value);
	toast({
		title: "Copied",
		description: "Agent URL copied to clipboard",
		duration: 3000,
	});
};

// Delete project
const isDeletingProject = ref(false);
const deleteProjectError = ref(null);

const deleteProject = async () => {
  if (!projectId.value) {
    deleteProjectError.value = "No project ID available";
    return;
  }

  isDeletingProject.value = true;
  deleteProjectError.value = null;

  try {
    const response = await trpc.projects.deleteProject.mutate({
      projectId: projectId.value
    });

    if (response && response.success) {
      toast({
        title: "Success",
        description: "Project deleted successfully",
        duration: 3000,
      });

      // Redirect to org home
      router.push(`/${route.params.orgId}`);
    } else {
      throw new Error(response?.error || "Failed to delete project");
    }
  } catch (err) {
    console.error("Error deleting project:", err);
    deleteProjectError.value = err.message || "An error occurred while deleting the project";
    toast({
      title: "Error",
      description: deleteProjectError.value,
      variant: "destructive",
      duration: 5000,
    });
  } finally {
    isDeletingProject.value = false;
  }
};

// Change active section by updating route
const setActiveSection = (section) => {
  router.push(`/${route.params.orgId}/${route.params.projectId}/settings/${section}`);
};

// Navigation sections
const navSections = [
	{ id: "general", name: "General", icon: User },
	{ id: "theme", name: "Site Theme", icon: Globe },
  { id: "media", name: "Media", icon: Image },
  { id: "formatting", name: "Formatting", icon: Edit },
  { id: "variables", name: "Frontmatter", icon: Terminal },
	{ id: "ai", name: "AI Agent Editor Behavior", icon: Bot },
	{ id: "integrations", name: "Integrations", icon: Puzzle },
	{ id: "secrets", name: "Secrets", icon: Key },
	{ id: "build", name: "Build and Deployment", icon: Server },
  { id: "domains", name: "Domains", icon: Link },


//	{ id: "environments", name: "Environments", icon: Server },
//	{ id: "envVariables", name: "Environment Variables", icon: FileText },
//	{ id: "git", name: "Git", icon: BadgeAlert },
//	{ id: "integrations", name: "Integrations", icon: Users },
	//{ id: "deployment", name: "Deployment Protection", icon: Shield },
//	{ id: "functions", name: "Functions", icon: Server },
//	{ id: "dataCache", name: "Data Cache", icon: Server },
];

 

// Load data on component mount
onMounted(() => {
	loadProjectData();
});

// Navigation back
const back = () => {
	router.back();
};
</script>

<template>

<json-debug :data="project" label="project" />


  <PageHeadingBar title="Project Settings">
    <template #secondary>
      <div>
        <router-link :to="currentOrg && currentOrg.handle ? `/${currentOrg.handle}/~/settings` : '/settings'">
          <Button class="flex items-center" size="sm" variant="ghost">
            <CornerLeftUp class="w-4 h-4 mr-2" />
            Go to Team settings
          </Button>
        </router-link>
      </div>
    </template>
  </PageHeadingBar>

  <div class="flex container" v-if="project">
    <div class="flex">
      <!-- Sidebar navigation -->
      <div class="w-64 border-r min-h-screen">
        <div class="p-4">
          <div class="relative mb-6">
            <Search
              class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4"
            />
            <Input placeholder="Search..." class="pl-10 w-full text-sm" />
          </div>

          <div class="space-y-1">
            <div class="flex items-center p-2 mb-4">
              <div
                class="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs mr-2"
              >
                {{ projectName?.charAt(0) || "P" }}
              </div>
              <span class="font-medium text-sm">{{
                projectName || "Project"
              }}</span>
            </div>

            <router-link
              v-for="section in navSections"
              :key="section.id"
              class="flex items-center w-full p-2 rounded-md text-sm transition-colors"
              :class="
                activeSection === section.id
                  ? 'bg-background font-medium'
                  : 'hover:bg-accent'
              "
              :to="{
                path: `/${route.params.orgId}/${route.params.projectId}/settings/${section.id}`
              }"
            >
              <component :is="section.icon" class="h-4 w-4 mr-2" />
              {{ section.name }}
            </router-link>
          </div>
        </div>
      </div>

      <!-- Content area -->
      <div class="flex-1 p-6 w-full max-w-[800px]">
   

        <!-- General Settings Section -->
        <div v-if="activeSection === 'general'">
          <!-- Project ID Card -->
          <SettingsCard
            title="Project ID"
            description="Used when interacting with the API."
            :save="false"
          >
            <div class="flex items-center max-w-full">
              <Input v-model="projectId" disabled class="flex-1" />
              <Button variant="outline" class="ml-2" @click="copyProjectId">
                <ClipboardCopy class="h-4 w-4" />
              </Button>
            </div>
          </SettingsCard>

          <!-- Project URL Card -->
          <SettingsCard
            title="Project URL"
            description="The URL slug for your project. This defines how your project will be accessed."
            :isSaving="isSaving"
            @save="saveSettings"
            more="/docs/project-urls"
            moreText="project URLs"
          >
            <div class="flex items-center max-w-full">
              <span
                class="px-3 py-2 bg-muted border border-r-0 rounded-l-md text-muted-foreground text-sm"
              >
                repo.md/{{ currentOrg?.handle || 'orgname' }}/
              </span>
              <Input v-model="projectHandle" class="rounded-l-none" />
            </div>
            <div v-if="saveError" class="mt-2 text-sm text-red-500">{{ saveError }}</div>
          </SettingsCard>

          <!-- Domain Key Card -->
          <SettingsCard
            title="Project Domain Key"
            description="Custom identifier for domain configuration."
            :isSaving="isSaving"
            @save="saveSettings"
          >
            <div class="flex items-center max-w-full">
              <Input v-model="projectDomainKey" placeholder="Enter domain key" />
            </div>
            <p class="text-xs text-muted-foreground mt-2">
              Used for custom domain configuration and routing.
            </p>
          </SettingsCard>


          <!-- Danger Zone Card -->
          <SettingsCard
            title="Danger Zone"
            description="Destructive actions that cannot be undone."
            :save="false"
          >
            <div class="border border-red-200 dark:border-red-900 rounded-md bg-red-50 dark:bg-red-950/30 p-4">
              <div class="flex justify-between items-center">
                <div>
                  <p class="font-medium text-red-700 dark:text-red-400 mb-1">Delete Project</p>
                  <p class="text-sm text-red-600 dark:text-red-300">
                    Once you delete a project, there is no going back. This action cannot be undone.
                  </p>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger as-child>
                    <Button variant="destructive" class="flex items-center" :disabled="isDeletingProject">
                      <Trash2 class="h-4 w-4 mr-2" />
                      Delete Project
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the
                        <span class="font-medium">{{ projectName }}</span> project and all of its data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        @click="deleteProject"
                        class="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Delete Project
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div v-if="deleteProjectError" class="mt-2 text-sm text-red-600">{{ deleteProjectError }}</div>
            </div>
          </SettingsCard>
        </div>

        <!-- Other sections -->
   
        
        <div v-else-if="activeSection === 'domains'">
          <SettingsHeading
            title="Domain Management"
            subtitle="Configure and manage your project's domains."
          >
            <Button size="sm" class="flex items-center">
              <PlusCircle class="h-4 w-4 mr-2" />
              Add Domain
            </Button>
          </SettingsHeading>

          <!-- Default Domain Card -->
          <SettingsCard
            title="Site Domains"
            description="Manage default and custom domains for your site."
            :save="false"
          >
            <ul class="space-y-4">
              <!-- Default Domain -->
              <li class="p-4 border rounded-md bg-muted/20">
                <div class="flex justify-between items-center">
                  <div>
                    <p class="font-medium text-sm mb-1">Default Domain</p>
                    <p class="text-primary text-sm font-medium">
                      {{ `https://${projectHandle || '[project-handle]'}.repo.md` }}
                    </p>
                    <p class="text-xs text-muted-foreground mt-1">
                      Available immediately
                    </p>
                  </div>
                  <Button variant="outline" size="sm" class="h-8">
                    <ClipboardCopy class="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
              </li>

              <!-- Add Custom Domain Form -->
              <li class="p-4 border rounded-md bg-muted/20">
                <p class="font-medium text-sm mb-3">Add Custom Domain</p>
                <div class="space-y-4">
                  <div>
                    <Input placeholder="example.com" class="w-full" />
                    <p class="text-xs text-muted-foreground mt-1">
                      Enter your custom domain without http:// or https://
                    </p>
                  </div>
                  <div class="flex justify-end">
                    <Button size="sm" class="h-8">Add Domain</Button>
                  </div>
                </div>
              </li>

              <!-- Domain Settings Note -->
              <li class="p-4 border rounded-md bg-muted/10 flex items-start gap-3">
                <Link class="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p class="text-sm font-medium mb-1">DNS Configuration</p>
                  <p class="text-xs text-muted-foreground">
                    To connect your custom domain, you'll need to configure your DNS settings. Point your domain to our servers using a CNAME record. <a href="/docs/domains" class="text-primary hover:underline">Learn more</a>
                  </p>
                </div>
              </li>
            </ul>
          </SettingsCard>

          <!-- Domain Verification Card -->
          <SettingsCard
            title="SSL & Verification"
            description="Manage SSL certificates and domain verification."
            :save="false"
          >
            <div class="p-4 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-800 text-sm flex items-center gap-3">
              <Shield class="h-5 w-5" />
              <span>SSL certificates are provisioned automatically for all domains. Verification status will appear here after you add a custom domain.</span>
            </div>
          </SettingsCard>
        </div>

        <!-- AI Settings Section -->
        <div v-else-if="activeSection === 'ai'">
          <SettingsHeading
            title="AI Settings"
            subtitle="Configure AI capabilities and provide context about your project for AI interactions."
          />

          <!-- AI Search Card -->
          <SettingsCard
            title="AI Search"
            description="Configure AI-powered search capabilities for your content."
            :isSaving="isSaving"
            @save="saveSettings"
            more="/docs/ai-search"
          >
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">Enable AI Image Search</p>
                  <p class="text-sm text-muted-foreground">
                    Find images by describing their content (e.g., "lovely furry things" will return kitten pictures)
                  </p>
                </div>
                <Switch
                  id="enable-ai-image-search"
                  v-model:checked="enableAIImageSearch"
                />
              </div>

              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">Enable AI Text Search</p>
                  <p class="text-sm text-muted-foreground">
                    Used for similarity ranking and finding documents by asking questions
                  </p>
                </div>
                <Switch
                  id="enable-ai-text-search"
                  v-model:checked="enableAITextSearch"
                />
              </div>
            </div>
          </SettingsCard>

          <!-- AI Integration Card -->
          <SettingsCard
            title="AI Integration"
            description="Enable or disable AI capabilities for your project."
            :isSaving="isSaving"
            @save="saveSettings"
          >
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">Enable MCP (Model Context Protocol)</p>
                  <p class="text-sm text-muted-foreground">
                    Allow AI to process and understand your project's context
                  </p>
                </div>
                <Switch
                  id="enable-mcp"
                  v-model:checked="enableMCP"
                />
              </div>

              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">Enable A2A (Agent-to-Agent Communication)</p>
                  <p class="text-sm text-muted-foreground">
                    Allow AI agents to communicate with each other about your project
                  </p>
                </div>
                <Switch
                  id="enable-a2a"
                  v-model:checked="enableA2A"
                />
              </div>

              <!-- MCP Server URL -->
              <div v-if="enableMCP && mcpServerUrl" class="mt-2 pl-6 border-l-2 border-l-muted mb-4">
                <div class="flex items-center">
                  <Input
                    v-model="mcpServerUrl"
                    disabled
                    class="flex-1 bg-muted/30"
                    readonly
                  />
                  <Button
                    variant="outline"
                    class="ml-2"
                    @click="copyMCPUrl"
                  >
                    <ClipboardCopy class="h-4 w-4 mr-2" />
                    Copy MCP URL
                  </Button>
                </div>
              </div>

              <!-- A2A Server URL -->
              <div v-if="enableA2A && a2aServerUrl" class="mt-2 pl-6 border-l-2 border-l-muted">
                <div class="flex items-center">
                  <Input
                    v-model="a2aServerUrl"
                    disabled
                    class="flex-1 bg-muted/30"
                    readonly
                  />
                  <Button
                    variant="outline"
                    class="ml-2"
                    @click="copyA2AUrl"
                  >
                    <ClipboardCopy class="h-4 w-4 mr-2" />
                    Copy A2A URL
                  </Button>
                </div>
              </div>
            </div>
          </SettingsCard>

          <!-- Public Agent Card -->
          <SettingsCard
            title="Public Agent"
            description="Configure your public-facing agent that answers questions from visitors to your site."
            :isSaving="isSaving"
            @save="saveSettings"
          >
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">Enable Public Agent</p>
                  <p class="text-sm text-muted-foreground">
                    Allow visitors to interact with your content through an AI assistant
                  </p>
                </div>
                <Switch
                  id="enable-agent"
                  v-model:checked="enableAgent"
                />
              </div>

              <template v-if="true">
                <!-- Agent URL -->
                <div v-if="agentUrl" class="mt-2 pl-6 border-l-2 border-l-muted mb-4">
                  <div class="flex items-center">
                    <Input
                      v-model="agentUrl"
                      disabled
                      class="flex-1 bg-muted/30"
                      readonly
                    />
                    <Button
                      variant="outline"
                      class="ml-2"
                      @click="copyAgentUrl"
                    >
                      <ClipboardCopy class="h-4 w-4 mr-2" />
                      Copy Agent URL
                    </Button>
                  </div>
                </div>

                <!-- Agent Model Selection -->
                <div class="mt-2 pl-6 border-l-2 border-l-muted mb-4">
                  <p class="font-medium mb-2">Agent Model</p>
                  <Select v-model="agentModel">
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="model in openAiModels" :key="model" :value="model">
                        {{ model }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <!-- Public Agent System Prompt -->
                <div class="mt-2 pl-6 border-l-2 border-l-muted">
                  <p class="font-medium mb-2">Public Agent System Prompt</p>
                  <Textarea
                    v-model="agentSystemPrompt"
                    placeholder="For example: A friendly assistant that helps visitors find information about our products and services. Always be helpful and direct users to relevant content."
                    class="min-h-32"
                  />
                  <p class="text-xs text-muted-foreground mt-2">
                    Configure how your public agent interacts with visitors. This agent will answer questions from the general public visiting your site.
                  </p>
                </div>

                <!-- Public Agent Capabilities -->
                <div class="mt-4 pl-6 border-l-2 border-l-muted space-y-3">
                  <p class="font-medium mb-2">Agent Capabilities</p>
                  <p class="text-sm text-muted-foreground mb-3">
                    Enable specific features your public agent can use when interacting with visitors.
                  </p>

                  <!-- Search Content -->
                  <div class="flex items-center space-x-3">
                    <Checkbox 
                      id="search-content"
                      v-model:checked="publicAgentCapabilities.searchContent"
                    />
                    <div class="grid gap-1.5 leading-none">
                      <Label 
                        for="search-content" 
                        class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Search content
                      </Label>
                      <p class="text-sm text-muted-foreground">
                        Allow the agent to search and reference your published content
                      </p>
                    </div>
                  </div>

                  <!-- Send Support Request -->
                  <div class="flex items-center space-x-3">
                    <Checkbox 
                      id="send-support"
                      v-model:checked="publicAgentCapabilities.sendSupportRequest"
                    />
                    <div class="grid gap-1.5 leading-none">
                      <Label 
                        for="send-support" 
                        class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Send support requests
                      </Label>
                      <p class="text-sm text-muted-foreground">
                        Allow visitors to submit support tickets through the agent
                      </p>
                    </div>
                  </div>

                  <!-- Send Customer Feedback -->
                  <div class="flex items-center space-x-3">
                    <Checkbox 
                      id="send-feedback"
                      v-model:checked="publicAgentCapabilities.sendCustomerFeedback"
                    />
                    <div class="grid gap-1.5 leading-none">
                      <Label 
                        for="send-feedback" 
                        class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Send customer feedback
                      </Label>
                      <p class="text-sm text-muted-foreground">
                        Allow visitors to submit feedback and suggestions
                      </p>
                    </div>
                  </div>

                  <!-- Suggest New Content -->
                  <div class="flex items-center space-x-3">
                    <Checkbox 
                      id="suggest-new-content"
                      v-model:checked="publicAgentCapabilities.suggestNewContent"
                    />
                    <div class="grid gap-1.5 leading-none">
                      <Label 
                        for="suggest-new-content" 
                        class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Suggest new content
                      </Label>
                      <p class="text-sm text-muted-foreground">
                        Allow visitors to request new content topics
                      </p>
                    </div>
                  </div>

                  <!-- Suggest Edits -->
                  <div class="flex items-center space-x-3">
                    <Checkbox 
                      id="suggest-edits"
                      v-model:checked="publicAgentCapabilities.suggestEdits"
                    />
                    <div class="grid gap-1.5 leading-none">
                      <Label 
                        for="suggest-edits" 
                        class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Suggest edits
                      </Label>
                      <p class="text-sm text-muted-foreground">
                        Allow visitors to suggest corrections or improvements to content
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Public Agent Integrations -->
                <div class="mt-4 pl-6 border-l-2 border-l-muted space-y-3">
                  <p class="font-medium mb-2">Integration Settings</p>
                  <p class="text-sm text-muted-foreground mb-3">
                    Configure how external services can interact with your public agent.
                  </p>

                  <!-- Enable Public MCP -->
                  <div class="flex items-center space-x-3">
                    <Checkbox 
                      id="public-mcp"
                      v-model:checked="publicAgentIntegrations.enablePublicMCP"
                    />
                    <div class="grid gap-1.5 leading-none">
                      <Label 
                        for="public-mcp" 
                        class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Enable public MCP server connections
                      </Label>
                      <p class="text-sm text-muted-foreground">
                        Allow external tools to connect to your agent via Model Context Protocol
                      </p>
                    </div>
                  </div>

                  <!-- Enable /ask Endpoint -->
                  <div class="flex items-center space-x-3">
                    <Checkbox 
                      id="ask-endpoint"
                      v-model:checked="publicAgentIntegrations.enableAskEndpoint"
                    />
                    <div class="grid gap-1.5 leading-none">
                      <Label 
                        for="ask-endpoint" 
                        class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Enable /ask endpoint
                      </Label>
                      <p class="text-sm text-muted-foreground">
                        Expose the NLWeb /ask endpoint for Microsoft's natural language query specification
                      </p>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </SettingsCard>

          <!-- Editor Agent Card -->
          <SettingsCard
            title="Editor Agent"
            description="Configure AI assistance for content editing and creation."
            :isSaving="isSaving"
            @save="saveSettings"
          >
            <div class="space-y-4">
              <div class="p-4 bg-muted/50 rounded-lg">
                <p class="text-sm text-muted-foreground">
                  Your Editor Agent is a private AI assistant that only you can access. It can be integrated into your development tools or accessed directly through your project's agent endpoints.
                </p>
              </div>

              <div class="space-y-3">
                <Label>Agent Permissions</Label>
                <p class="text-sm text-muted-foreground mb-3">
                  Control what actions your Editor Agent can perform on your content.
                </p>

                <!-- Edit Posts Permission -->
                <div class="flex items-center space-x-3">
                  <Checkbox 
                    id="edit-posts"
                    v-model:checked="editorAgentPermissions.editPosts"
                  />
                  <div class="grid gap-1.5 leading-none">
                    <Label 
                      for="edit-posts" 
                      class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Make edits to posts
                    </Label>
                    <p class="text-sm text-muted-foreground">
                      Allow the agent to modify existing content
                    </p>
                  </div>
                </div>

                <!-- Create Posts Permission -->
                <div class="flex items-center space-x-3">
                  <Checkbox 
                    id="create-posts"
                    v-model:checked="editorAgentPermissions.createPosts"
                  />
                  <div class="grid gap-1.5 leading-none">
                    <Label 
                      for="create-posts" 
                      class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Create new posts
                    </Label>
                    <p class="text-sm text-muted-foreground">
                      Allow the agent to create new content from scratch
                    </p>
                  </div>
                </div>

                <!-- Publish/Schedule Permission -->
                <div class="flex items-center space-x-3">
                  <Checkbox 
                    id="publish-schedule"
                    v-model:checked="editorAgentPermissions.publishSchedulePosts"
                  />
                  <div class="grid gap-1.5 leading-none">
                    <Label 
                      for="publish-schedule" 
                      class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Publish and schedule posts
                    </Label>
                    <p class="text-sm text-muted-foreground">
                      Allow the agent to publish content immediately or schedule for later
                    </p>
                  </div>
                </div>

                <!-- Generate Images Permission -->
                <div class="flex items-center space-x-3">
                  <Checkbox 
                    id="generate-images"
                    v-model:checked="editorAgentPermissions.generateImages"
                  />
                  <div class="grid gap-1.5 leading-none">
                    <Label 
                      for="generate-images" 
                      class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Generate images
                    </Label>
                    <p class="text-sm text-muted-foreground">
                      Allow the agent to create images using AI generation
                    </p>
                  </div>
                </div>
              </div>

              <!-- Editor Agent System Prompt -->
              <div class="space-y-3 mt-6">
                <Label>Editor Agent System Prompt</Label>
                <Textarea
                  v-model="editorAgentSystemPrompt"
                  placeholder="For example: You are an expert content editor for my blog. Help me improve my writing, suggest better titles, fix grammar, and ensure consistency across all posts. Focus on clarity and engagement."
                  class="min-h-32"
                />
                <p class="text-sm text-muted-foreground">
                  Configure how your Editor Agent assists you with content creation and editing. This prompt shapes the agent's behavior and expertise.
                </p>
              </div>

              <!-- Recurring Tasks -->
              <div class="space-y-3 mt-6">
                <Label>Recurring Tasks</Label>
                <Textarea
                  v-model="editorAgentRecurringTasks"
                  placeholder="Write a new blog post daily at 10am&#10;Plan weekly content roadmap every Monday at 9am&#10;Generate monthly analytics report on the 1st at 8am&#10;Review and update documentation weekly"
                  class="min-h-32 font-mono text-sm"
                />
                <p class="text-sm text-muted-foreground">
                  Define recurring tasks in natural language. Each line should describe one task with its frequency and timing.
                </p>

                <!-- Parsed Tasks Display -->
                <div v-if="parsedRecurringTasks.length > 0" class="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
                  <p class="text-sm font-medium text-muted-foreground mb-3">Interpreted Tasks:</p>
                  <div v-for="(task, index) in parsedRecurringTasks" :key="index" class="p-3 bg-background rounded-md shadow-sm">
                    <div class="text-sm space-y-1">
                      <div class="font-medium">{{ task.description }}</div>
                      <div class="flex items-center gap-4 text-xs text-muted-foreground">
                        <span class="capitalize">
                          <span class="font-medium">Frequency:</span> {{ task.frequency }}
                          <span v-if="task.day"> ({{ task.day }})</span>
                        </span>
                        <span v-if="task.time">
                          <span class="font-medium">Time:</span> {{ task.time }}
                        </span>
                        <span v-if="task.nextRun">
                          <span class="font-medium">Next run:</span> {{ task.nextRun }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SettingsCard>

          <!-- Project Summary Card -->
          <SettingsCard
            title="Project Summary for AI"
            description="Describe what your project is about and what AIs can do with its content. This helps AIs understand the purpose and context of your project."
            :isSaving="isSaving"
            @save="saveSettings"
          >
            <Textarea
              v-model="projectSummary"
              placeholder="This project is a blog about technology and science. It contains articles on AI, machine learning, and quantum computing. AIs can help users find related articles, summarize content, and generate new article ideas based on existing content."
              class="min-h-32"
            />
            <p class="text-xs text-muted-foreground mt-2">
              Be specific about what your project contains and how AI should interact with it. This helps AI better understand and serve your project's needs.
            </p>
          </SettingsCard>
        </div>
        
        <!-- Theme Settings Section -->
        <div v-else-if="activeSection === 'theme'">
          <SettingsHeading
            title="Site Theme Settings"
            subtitle="Configure theme, content, and appearance preferences for your project."
          >           <Button
          variant="outline"
          to="/themes" size="sm" class="flex items-center">
          <!-- 
             -->
              View site
              <ExternalLink class="h-4 w-4 ml-2" />
            </Button>
            </SettingsHeading>

          <!-- Theme Selection Card -->
          <SettingsCard
            title="Theme Selection"
            description="Choose a theme for your website."
            :isSaving="isSaving"
            @save="saveSettings"
            more="/themes"
            moreText="available themes"
          >
            <Select v-model="selectedThemeId">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select a theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="theme in themes" :key="theme.id" :value="theme.id">
                  {{ theme.name }}
                </SelectItem>
              </SelectContent>
            </Select>

            <div v-if="selectedThemeId" class="mt-4 p-4 bg-muted rounded-md">
              <div class="flex items-center gap-3">
                <div class="w-16 h-16 bg-background rounded overflow-hidden">
                  <img
                    :src="themes.find(t => t.id === selectedThemeId)?.image || '/placeholder.svg'"
                    alt="Theme preview"
                    class="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 class="font-medium">{{ themes.find(t => t.id === selectedThemeId)?.name }}</h4>
                  <p class="text-sm text-muted-foreground">
                    {{ themes.find(t => t.id === selectedThemeId)?.description }}
                  </p>
                </div>
              </div>
            </div>
          </SettingsCard>

          <!-- Content Settings Card -->
          <SettingsCard
            title="Content Settings"
            description="Configure site name and footer content."
            :isSaving="isSaving"
            @save="saveSettings"
          >
            <div class="space-y-6">
              <!-- Site Name -->
              <div>
                <h3 class="text-md font-medium mb-2">Site Name</h3>
                <p class="text-sm text-muted-foreground mb-3">
                  Enter the name of your site as it will appear in the header and title.
                </p>
                <Input v-model="siteName" placeholder="My Awesome Site" />
              </div>

              <!-- Footer Text -->
              <div>
                <h3 class="text-md font-medium mb-2">Footer Text</h3>
                <p class="text-sm text-muted-foreground mb-3">
                  Customize the text displayed in the footer of your site.
                </p>
                <Input v-model="footerText" placeholder="© 2025 My Company. All rights reserved." />
              </div>
            </div>
          </SettingsCard>

          <!-- Appearance Settings Card -->
          <SettingsCard
            title="Appearance Settings"
            description="Configure color scheme preferences."
            :isSaving="isSaving"
            @save="saveSettings"
          >
            <h3 class="text-md font-medium mb-3">Color Scheme</h3>
            <p class="text-sm text-muted-foreground mb-4">
              Choose your preferred color scheme for your site.
            </p>

            <RadioGroup v-model="preferredColorScheme" class="space-y-3">
              <div class="flex items-center space-x-2">
                <RadioGroupItem id="scheme-light" value="light" />
                <Label for="scheme-light" class="flex items-center">
                  <Sun class="h-4 w-4 mr-2" />
                  <span>Light</span>
                </Label>
              </div>

              <div class="flex items-center space-x-2">
                <RadioGroupItem id="scheme-dark" value="dark" />
                <Label for="scheme-dark" class="flex items-center">
                  <Moon class="h-4 w-4 mr-2" />
                  <span>Dark</span>
                </Label>
              </div>

              <div class="flex items-center space-x-2">
                <RadioGroupItem id="scheme-auto" value="auto" />
                <Label for="scheme-auto" class="flex items-center">
                  <MonitorSmartphone class="h-4 w-4 mr-2" />
                  <span>Auto (follow system preference)</span>
                </Label>
              </div>
            </RadioGroup>
          </SettingsCard>
        </div>
        
        <!-- Secrets Section -->
        <div v-else-if="activeSection === 'secrets'">
          <SettingsHeading
            title="API Keys & Secrets"
            subtitle="Manage third-party service API keys used to power AI agents and other features."
          />

          <!-- API Keys Card -->
          <SettingsCard
            title="Third-Party Service Keys"
            description="Enter your API keys for various services. These keys are encrypted and stored securely."
            :isSaving="isSaving"
            @save="saveSettings"
          >
            <div class="space-y-6">
              <div class="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p class="text-sm text-amber-800">
                  <strong>Security Note:</strong> API keys are optional. If not provided, the default repo.md keys will be used with rate limits. Your keys are encrypted and never exposed to end users.
                </p>
              </div>

              <!-- OpenAI API Key -->
              <div class="space-y-2">
                <Label for="openai-key">OpenAI API Key</Label>
                <Input
                  id="openai-key"
                  v-model="apiKeys.openai"
                  type="password"
                  placeholder="sk-..."
                  class="font-mono"
                />
                <p class="text-xs text-muted-foreground">
                  Powers GPT models for your agents. Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" class="text-blue-600 hover:underline">platform.openai.com</a>
                </p>
              </div>

              <!-- Anthropic API Key -->
              <div class="space-y-2">
                <Label for="anthropic-key">Anthropic API Key</Label>
                <Input
                  id="anthropic-key"
                  v-model="apiKeys.anthropic"
                  type="password"
                  placeholder="sk-ant-..."
                  class="font-mono"
                />
                <p class="text-xs text-muted-foreground">
                  Powers Claude models for advanced AI capabilities. Get your key from <a href="https://console.anthropic.com" target="_blank" class="text-blue-600 hover:underline">console.anthropic.com</a>
                </p>
              </div>

              <!-- ElevenLabs API Key -->
              <div class="space-y-2">
                <Label for="elevenlabs-key">ElevenLabs API Key</Label>
                <Input
                  id="elevenlabs-key"
                  v-model="apiKeys.elevenlabs"
                  type="password"
                  placeholder="..."
                  class="font-mono"
                />
                <p class="text-xs text-muted-foreground">
                  Enables text-to-speech functionality. Get your key from <a href="https://elevenlabs.io" target="_blank" class="text-blue-600 hover:underline">elevenlabs.io</a>
                </p>
              </div>

              <!-- Google API Key -->
              <div class="space-y-2">
                <Label for="google-key">Google API Key</Label>
                <Input
                  id="google-key"
                  v-model="apiKeys.google"
                  type="password"
                  placeholder="AIza..."
                  class="font-mono"
                />
                <p class="text-xs text-muted-foreground">
                  Powers Google AI services like Gemini. Get your key from <a href="https://makersuite.google.com/app/apikey" target="_blank" class="text-blue-600 hover:underline">Google AI Studio</a>
                </p>
              </div>

              <!-- Replicate API Key -->
              <div class="space-y-2">
                <Label for="replicate-key">Replicate API Key</Label>
                <Input
                  id="replicate-key"
                  v-model="apiKeys.replicate"
                  type="password"
                  placeholder="r8_..."
                  class="font-mono"
                />
                <p class="text-xs text-muted-foreground">
                  Access to various AI models for image generation and more. Get your key from <a href="https://replicate.com/account/api-tokens" target="_blank" class="text-blue-600 hover:underline">replicate.com</a>
                </p>
              </div>

              <!-- Hugging Face API Key -->
              <div class="space-y-2">
                <Label for="huggingface-key">Hugging Face API Key</Label>
                <Input
                  id="huggingface-key"
                  v-model="apiKeys.huggingface"
                  type="password"
                  placeholder="hf_..."
                  class="font-mono"
                />
                <p class="text-xs text-muted-foreground">
                  Access to open-source AI models. Get your key from <a href="https://huggingface.co/settings/tokens" target="_blank" class="text-blue-600 hover:underline">huggingface.co</a>
                </p>
              </div>
            </div>
          </SettingsCard>
        </div>
        
        <!-- Build and Deployment Section -->
        <div v-else-if="activeSection === 'build'">
          <SettingsHeading
            title="Build and Deployment"
            subtitle="Configure how your project is built and deployed."
          />

          <!-- Deploy Settings Card -->
          <SettingsCard
            title="Deployment Settings"
            description="Configure automatic deployment options."
            :isSaving="isSaving"
            @save="saveSettings"
          >
            <!-- Auto Deployment -->
            <div class="flex justify-between items-center mb-6">
              <div>
                <p class="font-medium">Auto Deployment</p>
                <p class="text-sm text-muted-foreground">
                  Automatically deploy when changes are pushed to the production branch
                </p>
              </div>
              <Switch
                id="auto-deployment"
                v-model:checked="enableAutoDeployment"
              />
            </div>

            <!-- Production Branch -->
            <div>
              <div class="flex justify-between items-center">
                <div>
                  <p class="font-medium">Production Branch</p>
                  <p class="text-sm text-muted-foreground">
                    Select which branch deploys to production
                  </p>
                </div>
                <div class="w-48">
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="main" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main">main</SelectItem>
                      <SelectItem value="master">master</SelectItem>
                      <SelectItem value="production">production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </SettingsCard>

          <!-- Repository Folder Card -->
          <SettingsCard
            title="Repository Folder"
            description="Specify a specific folder to use for markdown files and images (useful for monorepos)."
            :isSaving="isSaving"
            @save="saveSettings"
          >
            <div class="flex items-center max-w-full">
              <Input v-model="repositoryFolder" placeholder="docs/" />
            </div>
            <p class="text-xs text-muted-foreground mt-2">
              Leave empty to use the entire repository. Specify a folder path like "docs/" or "content/" to only process files from that directory.
            </p>
          </SettingsCard>

          <!-- Ignore Files Card -->
          <SettingsCard
            title="Ignore Files"
            description="Specify files and folders to ignore when processing your repository."
            :isSaving="isSaving"
            @save="saveSettings"
          >
            <Textarea
              v-model="ignoreFiles"
              placeholder="README.md&#10;.github/&#10;node_modules/&#10;*.log&#10;**/.DS_Store"
              class="min-h-32"
            />
            <p class="text-xs text-muted-foreground mt-2">
              List files and folders to ignore, one per line. You can also create a <code>.repoignore</code> file directly in your repository for the same effect. Supports glob patterns like <code>*.log</code> and <code>**/.DS_Store</code>.
            </p>
          </SettingsCard>

          <!-- Build Settings Card -->
          <SettingsCard
            title="Build Configuration"
            description="Customize build options and optimizations."
            :isSaving="isSaving"
            @save="saveSettings"
            more="/docs/build-options"
            moreText="build options"
          >
            <div class="p-4 bg-muted/50 rounded-md border text-sm text-muted-foreground flex items-center gap-3">
              <Server class="h-5 w-5 text-muted-foreground/70" />
              <span>Build settings are automatically optimized based on your project configuration. Additional build options will be available in a future update.</span>
            </div>
          </SettingsCard>
        </div>
        
        <!-- Media Settings Section -->
        <div v-else-if="activeSection === 'media'">
          <SettingsHeading
            title="Media Settings"
            subtitle="Configure image sizes, formats, and media embed options for your project."
          />

          <!-- Images Card -->
          <SettingsCard
            title="Images"
            description="Configure how images are processed and stored in your project."
            :isSaving="isSaving"
            @save="saveSettings"
          >
            <!-- Image Sizes -->
            <div class="mb-6">
              <h3 class="text-md font-medium mb-3"> Sizes</h3>
              <p class="text-sm text-muted-foreground mb-4">
                Select which image sizes should be generated for your project.
              </p>

              <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div v-for="(checked, size) in imageSizes" :key="size" class="flex items-center space-x-2">
                  <Checkbox :id="`size-${size}`" v-model:checked="imageSizes[size]" />
                  <label :for="`size-${size}`" class="text-sm font-medium">{{ size }}</label>
                </div>
              </div>
            </div>

            <!-- Image Formats -->
            <div>
              <h3 class="text-md font-medium mb-3"> Formats</h3>
              <p class="text-sm text-muted-foreground mb-4">
                Select which image formats should be supported.
              </p>

              <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div v-for="(checked, format) in imageFormats" :key="format" class="flex items-center space-x-2">
                  <Checkbox :id="`format-${format}`" v-model:checked="imageFormats[format]" />
                  <label :for="`format-${format}`" class="text-sm font-medium">{{ format }}</label>
                </div>
              </div>
            </div>
          </SettingsCard>

          <!-- Video & Audio Card -->
          <SettingsCard
            title="Video & Audio"
            description="Configure embedded media players and audio options."
            :isSaving="isSaving"
            @save="saveSettings"
            more="/docs/media-embedding"
            moreText="media embedding"
          >
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">YouTube Embeds</p>
                  <p class="text-sm text-muted-foreground">
                    Allow embedding YouTube videos in your content
                  </p>
                </div>
                <Switch
                  id="youtube-embeds"
                  v-model:checked="enableYoutubeEmbeds"
                />
              </div>

              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">Audio Player <span class="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Experimental</span></p>
                  <p class="text-sm text-muted-foreground">
                    Enable audio player for audio files
                  </p>
                </div>
                <Switch
                  id="audio-player"
                  v-model:checked="enableAudioPlayer"
                />
              </div>
            </div>
          </SettingsCard>

          <!-- Code Blocks Settings -->
          <SettingsCard
            title="Code Blocks"
            description="Configure how code blocks are rendered on your site."
            :isSaving="isSaving"
            @save="saveSettings"
          >
            <div class="space-y-6">
              <div class="space-y-3">
                <Label>Rendering Method</Label>
                <RadioGroup v-model="codeBlockRender">
                  <div class="flex items-center space-x-2">
                    <RadioGroupItem value="css" id="code-css" />
                    <Label for="code-css" class="font-normal cursor-pointer">
                      CSS (Default)
                      <span class="text-sm text-muted-foreground block">Faster rendering with native styling</span>
                    </Label>
                  </div>
                  <div class="flex items-center space-x-2 mt-2">
                    <RadioGroupItem value="iframe" id="code-iframe" />
                    <Label for="code-iframe" class="font-normal cursor-pointer">
                      iFrame
                      <span class="text-sm text-muted-foreground block">Isolated rendering with copy button</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div class="space-y-3">
                <Label>Theme</Label>
                <RadioGroup v-model="codeBlockTheme">
                  <div class="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="code-light" />
                    <Label for="code-light" class="font-normal cursor-pointer">Light</Label>
                  </div>
                  <div class="flex items-center space-x-2 mt-2">
                    <RadioGroupItem value="dark" id="code-dark" />
                    <Label for="code-dark" class="font-normal cursor-pointer">Dark</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </SettingsCard>

          <!-- Diagrams (Mermaid) Settings -->
          <SettingsCard
            title="Diagrams"
            description="Configure how Mermaid diagrams are rendered on your site."
            :isSaving="isSaving"
            @save="saveSettings"
          >
            <div class="space-y-6">
              <div class="space-y-3">
                <Label>Rendering Method</Label>
                <RadioGroup v-model="mermaidRender">
                  <div class="flex items-center space-x-2">
                    <RadioGroupItem value="svg" id="mermaid-svg" />
                    <Label for="mermaid-svg" class="font-normal cursor-pointer">
                      SVG (Default)
                      <span class="text-sm text-muted-foreground block">Vector graphics with best quality</span>
                    </Label>
                  </div>
                  <div class="flex items-center space-x-2 mt-2">
                    <RadioGroupItem value="iframe" id="mermaid-iframe" />
                    <Label for="mermaid-iframe" class="font-normal cursor-pointer">
                      iFrame
                      <span class="text-sm text-muted-foreground block">Isolated rendering environment</span>
                    </Label>
                  </div>
                  <div class="flex items-center space-x-2 mt-2">
                    <RadioGroupItem value="keep-as-code" id="mermaid-code" />
                    <Label for="mermaid-code" class="font-normal cursor-pointer">
                      Keep as Code Block
                      <span class="text-sm text-muted-foreground block">Display as plain code without rendering</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div class="space-y-3">
                <Label>Theme</Label>
                <RadioGroup v-model="mermaidTheme">
                  <div class="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="mermaid-light" />
                    <Label for="mermaid-light" class="font-normal cursor-pointer">Light</Label>
                  </div>
                  <div class="flex items-center space-x-2 mt-2">
                    <RadioGroupItem value="dark" id="mermaid-dark" />
                    <Label for="mermaid-dark" class="font-normal cursor-pointer">Dark</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </SettingsCard>
        </div>
        
        <!-- Formatting Settings Section -->
        <div v-else-if="activeSection === 'formatting'">
          <SettingsHeading
            title="Markdown Formatting"
            subtitle="Configure how markdown content is parsed and displayed in your project."
          />


          <!-- Links & Paths Card -->
          <SettingsCard
            title="Links & Paths Configuration"
            description="Configure how links and media paths are structured in your project."
            :isSaving="isSaving"
            @save="saveSettings"
          >
            <div class="space-y-6">
              <div>
                <p class="font-medium mb-2">Page Link Prefix</p>
                <p class="text-sm text-muted-foreground mb-3">
                  Add a prefix to all your page links. Can be empty, a relative path like "/blog", or a full URL like "https://blog.example.com/".
                </p>
                <Input
                  v-model="pageLinkPrefix"
                  placeholder="e.g., /blog or https://blog.example.com/"
                />
                <p class="text-xs text-muted-foreground mt-1">
                  This allows your content to be consumed from different domains or paths.
                </p>
              </div>

              <div>
                <p class="font-medium mb-2">Media Prefix</p>
                <p class="text-sm text-muted-foreground mb-3">
                  Set the folder path for your optimized media files.
                </p>
                <Input
                  v-model="mediaPrefix"
                  placeholder="_repo/medias"
                />
                <p class="text-xs text-muted-foreground mt-1">
                  This magic folder will contain your optimized images with the selected sizes and formats.
                  If you use content from different repo.md projects on the same domain, set a different prefix for each to properly routes assets.
                </p>
              </div>
            </div>
          </SettingsCard>

          <!-- Advanced Parsing Options Card -->
          <SettingsCard
            title="Advanced Parsing Options"
            description="Configure special markdown parsing features."
            :isSaving="isSaving"
            @save="saveSettings"
            more="/docs/markdown"
            moreText="markdown features"
          >
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">Parse Formulas <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Pro</span></p>
                  <p class="text-sm text-muted-foreground">
                    Enable LaTeX-style formula parsing and rendering (e.g., $E=mc^2$)
                  </p>
                </div>
                <Switch
                  id="parse-formulas"
                  v-model:checked="parseFormulas"
                />
              </div>

              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">Remove Dead Links</p>
                  <p class="text-sm text-muted-foreground">
                    Automatically handle wiki-style links to pages that don't exist yet
                  </p>
                </div>
                <Switch
                  id="remove-dead-links"
                  v-model:checked="removeDeadLinks"
                />
              </div>

              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium">Syntax Highlighting</p>
                  <p class="text-sm text-muted-foreground">
                    Enable syntax highlighting for code blocks
                  </p>
                </div>
                <Switch
                  id="syntax-highlighting"
                  v-model:checked="syntaxHighlighting"
                />
              </div>
            </div>
          </SettingsCard>
        </div>

        <!-- Variables Section -->
        <div v-else-if="activeSection === 'variables'">
          <SettingsHeading
            title="Frontmatter Variables"
            subtitle="Configure default variables for frontmatter in markdown files."
          />

          <!-- Page Visibility Card -->
          <SettingsCard
            title="Page Visibility"
            description="Set the default visibility for new pages created in your project."
            :isSaving="isSaving"
            @save="saveSettings"
          >
            <RadioGroup v-model="defaultPageVisibility" class="space-y-3">
              <div class="flex items-center space-x-2">
                <RadioGroupItem id="visibility-public" value="public" />
                <Label for="visibility-public" class="flex items-center">
                  <span>Public</span>
                  <span class="ml-2 text-xs text-muted-foreground">(Visible to everyone)</span>
                </Label>
              </div>

              <div class="flex items-center space-x-2">
                <RadioGroupItem id="visibility-private" value="private" />
                <Label for="visibility-private" class="flex items-center">
                  <span>Private</span>
                  <span class="ml-2 text-xs text-muted-foreground">(Visible only to authenticated users)</span>
                </Label>
              </div>

              <div class="flex items-center space-x-2">
                <RadioGroupItem id="visibility-hidden" value="hidden" />
                <Label for="visibility-hidden" class="flex items-center">
                  <span>Hidden</span>
                  <span class="ml-2 text-xs text-muted-foreground">(Not listed but accessible with direct link)</span>
                </Label>
              </div>
            </RadioGroup>
          </SettingsCard>

          <!-- Frontmatter Default Values Card -->
          <SettingsCard
            title="Frontmatter Default Values"
            description="Configure default variables for markdown frontmatter that will be applied to new pages."
            :isSaving="isSaving"
            @save="saveSettings"
            more="/docs/frontmatter"
            moreText="frontmatter variables"
          >
            <div class="p-4 bg-muted/50 rounded-md border text-sm text-muted-foreground flex items-center gap-3">
              <FileText class="h-5 w-5 text-muted-foreground/70" />
              <span>Frontmatter variables are key-value pairs at the top of markdown files that control page behavior and metadata. Common variables include title, date, author, and tags.</span>
            </div>
          </SettingsCard>
        </div>

        <!-- Integrations Settings Section -->
        <div v-else-if="activeSection === 'integrations'">
          <SettingsHeading
            title="Integrations"
            subtitle="Connect third-party services to extend your project's capabilities"
          />

          <!-- Integration Services Title -->
          <SettingsCard
            title="Available Integrations"
            description="Connect your favorite tools and services to automate workflows and enhance your project"
            :hideSave="true"
          >
            <div class="space-y-6">
              <!-- Category Filter -->
              <div class="flex flex-wrap gap-2">
                <Button
                  v-for="category in integrationCategories"
                  :key="category.id"
                  :variant="activeIntegrationFilter === category.id ? 'default' : 'outline'"
                  size="sm"
                  @click="activeIntegrationFilter = category.id"
                  class="flex items-center gap-2"
                >
                  <component :is="category.icon" class="w-4 h-4" />
                  {{ category.name }}
                </Button>
              </div>

              <!-- Integration Cards -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card 
              v-for="[key, config] in filteredIntegrations" 
              :key="key"
              :class="{ 'ring-2 ring-primary': config.enabled }"
            >
              <CardHeader>
                <div class="flex items-start justify-between">
                  <div class="flex items-center gap-3">
                    <div :class="[getIntegrationInfo(key).color, 'w-10 h-10 rounded-lg flex items-center justify-center text-white']">
                      <component :is="getIntegrationInfo(key).icon" class="w-5 h-5" />
                    </div>
                    <div class="flex-1">
                      <CardTitle class="text-lg">{{ getIntegrationInfo(key).name }}</CardTitle>
                      <CardDescription class="text-sm">
                        {{ getIntegrationInfo(key).description }}
                      </CardDescription>
                      <div v-if="getIntegrationInfo(key).pricing" class="text-xs text-muted-foreground mt-1">
                        {{ getIntegrationInfo(key).pricing }}
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <Button
                      v-if="!config.connected"
                      size="sm"
                      @click="connectIntegration(key)"
                    >
                      <Plus class="w-4 h-4 mr-1" />
                      Connect
                    </Button>
                    <Button
                      v-else-if="config.connected && !config.enabled"
                      size="sm"
                      variant="outline"
                      @click="disconnectIntegration(key)"
                    >
                      Disconnect
                    </Button>
                    <div v-if="config.connected" class="flex items-center gap-2">
                      <Check class="w-4 h-4 text-green-600" />
                      <Switch
                        v-model:checked="config.enabled"
                        :id="`${key}-enabled`"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent v-if="config.connected" class="space-y-4">
                <!-- Show connection status message if not enabled -->
                <div v-if="!config.enabled" class="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  Connected. Enable the integration to configure settings.
                </div>
                
                <!-- Show configuration fields when enabled -->
                <template v-else-if="config.enabled">
                  <!-- Configuration Title -->
                  <div class="border-b pb-3 mb-4">
                    <h4 class="font-medium text-sm">Configure {{ getIntegrationInfo(key).name }}</h4>
                    <p class="text-xs text-muted-foreground mt-1">
                      Set up your {{ getIntegrationInfo(key).name }} integration settings below
                    </p>
                  </div>
                  
                  <!-- Dynamic field rendering based on config -->
                  <div v-for="(fieldConfig, fieldKey) in integrationsConfig[key].fields" :key="fieldKey" class="space-y-2">
                    <!-- Text/Password/URL inputs -->
                    <template v-if="fieldConfig.type === 'text' || fieldConfig.type === 'password' || fieldConfig.type === 'url'">
                      <Label :for="`${key}-${fieldKey}`">{{ fieldConfig.label }}</Label>
                      <Input
                        :id="`${key}-${fieldKey}`"
                        v-model="config.fields[fieldKey]"
                        :type="fieldConfig.type"
                        :placeholder="fieldConfig.placeholder"
                      />
                      <p v-if="fieldConfig.help" class="text-xs text-muted-foreground">
                        {{ fieldConfig.help }}
                      </p>
                    </template>
                    
                    <!-- Checkbox inputs -->
                    <template v-else-if="fieldConfig.type === 'checkbox'">
                      <div class="flex items-center space-x-3">
                        <Checkbox
                          :id="`${key}-${fieldKey}`"
                          v-model:checked="config.fields[fieldKey]"
                        />
                        <Label :for="`${key}-${fieldKey}`" class="cursor-pointer">
                          {{ fieldConfig.label }}
                        </Label>
                      </div>
                      <p v-if="fieldConfig.help" class="text-xs text-muted-foreground ml-6">
                        {{ fieldConfig.help }}
                      </p>
                    </template>
                    
                    <!-- Select inputs -->
                    <template v-else-if="fieldConfig.type === 'select'">
                      <Label :for="`${key}-${fieldKey}`">{{ fieldConfig.label }}</Label>
                      <Select v-model="config.fields[fieldKey]">
                        <SelectTrigger :id="`${key}-${fieldKey}`">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            v-for="option in fieldConfig.options"
                            :key="option.value || option"
                            :value="option.value || option"
                          >
                            {{ option.label || option }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p v-if="fieldConfig.help" class="text-xs text-muted-foreground">
                        {{ fieldConfig.help }}
                      </p>
                    </template>
                  </div>
                  
                  <!-- Help link -->
                  <div v-if="getIntegrationInfo(key).website" class="pt-2">
                    <a
                      :href="getIntegrationInfo(key).website"
                      target="_blank"
                      class="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      Learn more about {{ getIntegrationInfo(key).name }}
                      <ExternalLink class="w-3 h-3" />
                    </a>
                  </div>
                </template>
                
              </CardContent>
            </Card>
              </div>
            </div>
          </SettingsCard>

          <!-- Save Button -->
          <div class="mt-6 flex justify-end">
            <Button @click="saveSettings" :disabled="isSaving">
              <Save class="w-4 h-4 mr-2" />
              {{ isSaving ? "Saving..." : "Save Integrations" }}
            </Button>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>