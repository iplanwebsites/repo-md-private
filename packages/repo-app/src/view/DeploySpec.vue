<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useToast } from "@/components/ui/toast/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CodeBlock from "@/components/CodeBlock.vue";
import Prose from "@/components/Prose.vue";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion/index";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	AlertCircle,
	CheckCircle,
	XCircle,
	Info,
	Lightbulb,
	Zap,
	Target,
	Wrench,
	Bot,
	Calendar,
	FileJson,
	Copy,
	ExternalLink,
	TrendingUp,
	TrendingDown,
	Minus,
	FileText,
	Code,
} from "lucide-vue-next";
import { formatDistanceToNow } from "date-fns";

// Define props from parent
const props = defineProps({
	deployment: {
		type: Object,
		required: true,
	},
	isLoading: {
		type: Boolean,
		default: false,
	},
	error: {
		type: [String, Object, null],
		default: null,
	},
	repoClient: {
		type: Object,
		default: null,
	},
});

// Define emits to parent
const emit = defineEmits(["refresh"]);

const { toast } = useToast();

// State
const loading = ref(true);
const specData = ref(null);
const showJsonModal = ref(false);
const showMarkdownModal = ref(false);
const markdownModalTab = ref("source");
const currentTab = ref("summary");
const copiedText = ref(false);

// Quality score helpers
const getScoreColor = (score) => {
	if (score === "NA") return "secondary";
	if (score >= 8) return "success";
	if (score >= 6) return "warning";
	if (score >= 4) return "default";
	return "destructive";
};

const getScoreIcon = (score) => {
	if (score === "NA") return Minus;
	if (score >= 8) return CheckCircle;
	if (score >= 6) return AlertCircle;
	return XCircle;
};

const getScoreTrend = (score, avgScore) => {
	if (score === "NA" || !avgScore) return null;
	const diff = score - avgScore;
	if (Math.abs(diff) < 0.5) return null;
	return diff > 0 ? TrendingUp : TrendingDown;
};

// Format date helper
const formatDate = (dateString) => {
	if (!dateString) return "Unknown";
	try {
		const date = new Date(dateString);
		return formatDistanceToNow(date, { addSuffix: true });
	} catch {
		return dateString;
	}
};

// Copy to clipboard
const copyToClipboard = async (text) => {
	try {
		await navigator.clipboard.writeText(text);
		copiedText.value = true;
		toast({
			title: "Copied!",
			description: "Text copied to clipboard",
		});
		setTimeout(() => {
			copiedText.value = false;
		}, 2000);
	} catch (err) {
		console.error("Failed to copy:", err);
		toast({
			title: "Error",
			description: "Failed to copy to clipboard",
			variant: "destructive",
		});
	}
};

// Fetch spec data
const fetchSpecData = async () => {
	if (!props.repoClient) {
		console.error("RepoClient is not initialized");
		return;
	}

	loading.value = true;
	try {
		console.log("Fetching REPO.json from R2...");
		
		// Get the URL for REPO.json in the dist folder
		const filePath = "/REPO.json";
		const fileUrl = await props.repoClient.getR2Url(filePath);
		console.log("REPO.json URL:", fileUrl);
		
		// Fetch the file content
		const response = await fetch(fileUrl);
		console.log("Response status:", response.status);
		
		if (!response.ok) {
			if (response.status === 404) {
				console.log("REPO.json not found in deployment");
				specData.value = null;
				return;
			}
			throw new Error(`Failed to fetch REPO.json: ${response.statusText}`);
		}
		
		// Parse the JSON content
		const jsonData = await response.json();
		specData.value = jsonData;
		console.log("REPO.json loaded successfully:", specData.value);
		
	} catch (error) {
		console.error("Error fetching REPO.json:", error);
		if (error.message?.includes("404") || error.message?.includes("not found")) {
			// File doesn't exist, which is okay
			specData.value = null;
		} else {
			// Real error
			toast({
				title: "Error",
				description: "Failed to load specification file",
				variant: "destructive",
			});
		}
	} finally {
		loading.value = false;
	}
};

// Watch for repoClient changes
watch(
	() => props.repoClient,
	() => {
		if (props.repoClient) {
			console.log("RepoClient changed, fetching spec data");
			fetchSpecData();
		}
	},
	{ immediate: false }
);

// Lifecycle
onMounted(() => {
	console.log("DeploySpec mounted");
	if (props.repoClient) {
		fetchSpecData();
	}
});

// Computed properties
const hasSpecData = computed(() => specData.value !== null);

const overallQuality = computed(() => {
	if (!specData.value?.validation?.overall_quality) return 0;
	return specData.value.validation.overall_quality;
});

const sectionScores = computed(() => {
	if (!specData.value?.validation?.section_scores) return {};
	return specData.value.validation.section_scores;
});

const recommendations = computed(() => {
	if (!specData.value?.feedback?.recommendations) return [];
	return specData.value.feedback.recommendations;
});

// Section visibility helpers
const hasActions = computed(() => specData.value?.actions?.length > 0);
const hasTools = computed(() => specData.value?.tools?.primary_tools?.length > 0);
const hasAutomation = computed(() => specData.value?.automation?.patterns?.length > 0);
const hasPublicPersona = computed(() => specData.value?.public_persona?.personality?.description);

// Gather all original markdown content
const originalMarkdown = computed(() => {
	if (!specData.value) return "";
	
	// Check if there's a single "original" field at the root that contains the entire markdown
	if (specData.value.original) {
		console.log("Found root original field");
		return specData.value.original;
	}
	
	// Otherwise, try to piece together from sections
	const sections = [];
	
	// Add summary original
	if (specData.value.summary?.original) {
		sections.push(specData.value.summary.original);
	}
	
	// Add content strategy originals
	if (specData.value.content_strategy?.voice?.original) {
		sections.push("\n\n## Voice & Tone\n\n" + specData.value.content_strategy.voice.original);
	}
	if (specData.value.content_strategy?.structure?.original) {
		sections.push("\n\n## Content Structure\n\n" + specData.value.content_strategy.structure.original);
	}
	if (specData.value.content_strategy?.visual_style?.original) {
		sections.push("\n\n## Visual Style\n\n" + specData.value.content_strategy.visual_style.original);
	}
	
	// Add actions originals
	if (specData.value.actions?.length > 0) {
		sections.push("\n\n## Actions");
		specData.value.actions.forEach(action => {
			if (action.original) {
				sections.push("\n\n### " + action.title + "\n\n" + action.original);
			}
		});
	}
	
	// Add tools original
	if (specData.value.tools?.original) {
		sections.push("\n\n## Tools\n\n" + specData.value.tools.original);
	}
	
	// Add automation original
	if (specData.value.automation?.original) {
		sections.push("\n\n## Automation\n\n" + specData.value.automation.original);
	}
	
	// Add public persona original
	if (specData.value.public_persona?.original) {
		sections.push("\n\n## Public Persona\n\n" + specData.value.public_persona.original);
	}
	
	// Log what we found for debugging
	console.log("Original markdown sections found:", sections.length);
	console.log("First section preview:", sections[0]?.substring(0, 100));
	
	return sections.join("\n");
});
</script>

<template>
  <PageHeadingBar
    title="Repository Specification"
    subtitle="AI agent specification and configuration details"
  />

  <div class="container">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-96">
      <div class="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
    </div>

    <!-- No Spec File State -->
    <div v-else-if="!hasSpecData" class="text-center py-12">
      <FileJson class="mx-auto h-12 w-12 text-muted-foreground mb-4" />
      <h3 class="text-lg font-medium">No Specification Found</h3>
      <p class="text-muted-foreground mt-2 mb-4">
        No REPO.json file was found in this deployment.
      </p>
      <p class="text-sm text-muted-foreground max-w-2xl mx-auto">
        REPO.json files are automatically generated from REPO.md files during the build process.
        They contain structured metadata about AI agents and content specifications.
      </p>
    </div>

    <!-- Spec Data Display -->
    <div v-else class="space-y-6">
      <!-- Overview Card -->
      <Card>
        <CardHeader>
          <div class="flex items-start justify-between">
            <div>
              <CardTitle class="text-2xl">
                {{ specData.metadata?.project_name || "Unnamed Project" }}
              </CardTitle>
              <CardDescription class="mt-2">
                {{ specData.summary?.description || "No description available" }}
              </CardDescription>
            </div>
            <div class="flex flex-col items-end gap-2">
              <Badge :variant="getScoreColor(overallQuality)" class="text-lg px-3 py-1">
                <component :is="getScoreIcon(overallQuality)" class="w-4 h-4 mr-1" />
                Quality: {{ overallQuality }}/10
              </Badge>
              <div class="text-sm text-muted-foreground">
                Generated {{ formatDate(specData._metadata?.generatedAt) }}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div class="flex gap-2 flex-wrap">
            <Button 
              v-if="originalMarkdown && originalMarkdown.length > 0"
              variant="default" 
              size="sm" 
              @click="() => { markdownModalTab = 'rendered'; showMarkdownModal = true; }"
            >
              <FileText class="w-4 h-4 mr-2" />
              View REPO.md
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              @click="copyToClipboard(originalMarkdown || JSON.stringify(specData, null, 2))"
            >
              <Copy class="w-4 h-4 mr-2" />
              {{ copiedText ? "Copied!" : "Copy" }}
            </Button>
            <Button variant="ghost" size="sm" @click="showJsonModal = true">
              <FileJson class="w-4 h-4 mr-2" />
              View JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Main Content Tabs -->
      <Tabs v-model="currentTab" class="w-full">
        <TabsList class="grid w-full grid-cols-6">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="persona">Persona</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>

        <!-- Summary Tab -->
        <TabsContent value="summary" class="space-y-4">
          <!-- Section Scores -->
          <Card>
            <CardHeader>
              <CardTitle>Section Quality Scores</CardTitle>
              <CardDescription>Individual assessment of each specification section</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div v-for="(score, section) in sectionScores" :key="section" 
                     class="flex items-center justify-between p-3 border rounded-lg">
                  <div class="flex items-center gap-2">
                    <component :is="getScoreIcon(score)" 
                               :class="['w-5 h-5', score === 'NA' ? 'text-muted-foreground' : score >= 6 ? 'text-green-500' : 'text-red-500']" />
                    <span class="font-medium capitalize">{{ section.replace(/_/g, ' ') }}</span>
                  </div>
                  <Badge :variant="getScoreColor(score)">
                    {{ score === 'NA' ? 'N/A' : `${score}/10` }}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Strengths & Missing Elements -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle class="text-lg flex items-center gap-2">
                  <CheckCircle class="w-5 h-5 text-green-500" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul class="space-y-2">
                  <li v-for="(strength, idx) in specData.validation?.strengths" 
                      :key="idx" 
                      class="flex items-start gap-2">
                    <span class="text-green-500 mt-1">•</span>
                    <span class="text-sm">{{ strength }}</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle class="text-lg flex items-center gap-2">
                  <AlertCircle class="w-5 h-5 text-yellow-500" />
                  Missing Elements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul class="space-y-2">
                  <li v-for="(element, idx) in specData.validation?.missing_elements" 
                      :key="idx" 
                      class="flex items-start gap-2">
                    <span class="text-yellow-500 mt-1">•</span>
                    <span class="text-sm">{{ element }}</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <!-- Metadata -->
          <Card>
            <CardHeader>
              <CardTitle class="text-lg">Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <dl class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt class="text-sm font-medium text-muted-foreground">Specification Version</dt>
                  <dd class="mt-1 text-sm">{{ specData.metadata?.spec_version || "1.0" }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-muted-foreground">Processed Date</dt>
                  <dd class="mt-1 text-sm">{{ specData.metadata?.processed_date || "Unknown" }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-muted-foreground">Generated By</dt>
                  <dd class="mt-1 text-sm">{{ specData._metadata?.generatedBy || "Unknown" }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-muted-foreground">Model</dt>
                  <dd class="mt-1 text-sm">{{ specData._metadata?.model || "Unknown" }}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Content Strategy Tab -->
        <TabsContent value="content" class="space-y-4">
          <!-- Voice & Tone -->
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <CardTitle class="text-lg">Voice & Tone</CardTitle>
                <Badge :variant="getScoreColor(specData.content_strategy?.voice?.quality_score)">
                  {{ specData.content_strategy?.voice?.quality_score || 0 }}/10
                </Badge>
              </div>
            </CardHeader>
            <CardContent class="space-y-4">
              <p>{{ specData.content_strategy?.voice?.description }}</p>
              
              <div v-if="specData.content_strategy?.voice?.details">
                <div class="space-y-3">
                  <div>
                    <h4 class="font-medium text-sm text-muted-foreground mb-1">Tone</h4>
                    <p class="text-sm">{{ specData.content_strategy.voice.details.tone }}</p>
                  </div>
                  <div>
                    <h4 class="font-medium text-sm text-muted-foreground mb-1">Style</h4>
                    <p class="text-sm">{{ specData.content_strategy.voice.details.style }}</p>
                  </div>
                  <div v-if="specData.content_strategy.voice.details.principles?.length">
                    <h4 class="font-medium text-sm text-muted-foreground mb-1">Principles</h4>
                    <ul class="list-disc list-inside space-y-1">
                      <li v-for="(principle, idx) in specData.content_strategy.voice.details.principles" 
                          :key="idx"
                          class="text-sm">
                        {{ principle }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Content Structure -->
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <CardTitle class="text-lg">Content Structure</CardTitle>
                <Badge :variant="getScoreColor(specData.content_strategy?.structure?.quality_score)">
                  {{ specData.content_strategy?.structure?.quality_score || 0 }}/10
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p class="mb-4">{{ specData.content_strategy?.structure?.description }}</p>
              
              <div v-if="specData.content_strategy?.structure?.content_types?.length" class="space-y-3">
                <h4 class="font-medium text-sm text-muted-foreground">Content Types</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div v-for="(type, idx) in specData.content_strategy.structure.content_types" 
                       :key="idx"
                       class="border rounded-lg p-3">
                    <h5 class="font-medium">{{ type.name }}</h5>
                    <p class="text-sm text-muted-foreground">{{ type.path }}</p>
                    <div v-if="type.includes?.length" class="mt-2">
                      <p class="text-xs text-muted-foreground">Includes:</p>
                      <div class="flex flex-wrap gap-1 mt-1">
                        <Badge v-for="(inc, i) in type.includes" :key="i" variant="secondary" class="text-xs">
                          {{ inc }}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Visual Style -->
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <CardTitle class="text-lg">Visual Style</CardTitle>
                <Badge :variant="getScoreColor(specData.content_strategy?.visual_style?.quality_score)">
                  {{ specData.content_strategy?.visual_style?.quality_score || 0 }}/10
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p class="mb-4">{{ specData.content_strategy?.visual_style?.description }}</p>
              
              <div v-if="specData.content_strategy?.visual_style?.details" class="space-y-3">
                <div v-if="specData.content_strategy.visual_style.details.formats?.length">
                  <h4 class="font-medium text-sm text-muted-foreground mb-2">Supported Formats</h4>
                  <div class="flex flex-wrap gap-2">
                    <Badge v-for="format in specData.content_strategy.visual_style.details.formats" 
                           :key="format" 
                           variant="outline">
                      {{ format }}
                    </Badge>
                  </div>
                </div>
                
                <div v-if="specData.content_strategy.visual_style.details.technical_requirements?.length">
                  <h4 class="font-medium text-sm text-muted-foreground mb-2">Technical Requirements</h4>
                  <ul class="list-disc list-inside space-y-1">
                    <li v-for="(req, idx) in specData.content_strategy.visual_style.details.technical_requirements" 
                        :key="idx"
                        class="text-sm">
                      {{ req }}
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Actions Tab -->
        <TabsContent value="actions" class="space-y-4">
          <div v-if="!hasActions" class="text-center py-12">
            <Target class="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 class="text-lg font-medium">No Actions Defined</h3>
            <p class="text-muted-foreground mt-2">
              No agent actions have been specified for this project.
            </p>
          </div>

          <Accordion v-else type="single" collapsible class="w-full">
            <AccordionItem v-for="(action, idx) in specData.actions" :key="idx" :value="`action-${idx}`">
              <AccordionTrigger>
                <div class="flex items-center justify-between w-full pr-4">
                  <div class="flex items-center gap-3">
                    <Zap class="w-5 h-5" />
                    <span class="font-medium">{{ action.title }}</span>
                  </div>
                  <Badge :variant="getScoreColor(action.quality_score)" class="ml-2">
                    {{ action.quality_score }}/10
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent class="space-y-4">
                <div>
                  <h4 class="font-medium text-sm text-muted-foreground mb-1">Summary</h4>
                  <p class="text-sm">{{ action.summary }}</p>
                </div>
                
                <div>
                  <h4 class="font-medium text-sm text-muted-foreground mb-1">Detailed Description</h4>
                  <p class="text-sm whitespace-pre-wrap">{{ action.detailed_description }}</p>
                </div>
                
                <div v-if="action.phases?.length">
                  <h4 class="font-medium text-sm text-muted-foreground mb-2">Phases</h4>
                  <div class="space-y-3">
                    <div v-for="(phase, pidx) in action.phases" 
                         :key="pidx"
                         class="border rounded-lg p-3">
                      <h5 class="font-medium mb-2">{{ phase.name }}</h5>
                      <div class="space-y-2">
                        <div>
                          <p class="text-xs text-muted-foreground">Tasks:</p>
                          <ul class="list-disc list-inside">
                            <li v-for="(task, tidx) in phase.tasks" 
                                :key="tidx"
                                class="text-sm">
                              {{ task }}
                            </li>
                          </ul>
                        </div>
                        <div v-if="phase.output">
                          <p class="text-xs text-muted-foreground">Output:</p>
                          <p class="text-sm">{{ phase.output }}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        <!-- Tools Tab -->
        <TabsContent value="tools" class="space-y-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <CardTitle class="text-lg flex items-center gap-2">
                  <Wrench class="w-5 h-5" />
                  Available Tools
                </CardTitle>
                <Badge :variant="getScoreColor(specData.tools?.quality_score)">
                  {{ specData.tools?.quality_score || 0 }}/10
                </Badge>
              </div>
              <CardDescription>
                {{ specData.tools?.description || "Tools and capabilities available to the agent" }}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div v-if="!hasTools" class="text-center py-8">
                <p class="text-muted-foreground">No tools have been specified.</p>
              </div>
              
              <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div v-for="(tool, idx) in specData.tools.primary_tools" 
                     :key="idx"
                     class="border rounded-lg p-4">
                  <h4 class="font-medium mb-2 flex items-center gap-2">
                    <Wrench class="w-4 h-4" />
                    {{ tool.name }}
                  </h4>
                  <p class="text-sm text-muted-foreground">{{ tool.usage }}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Automation Patterns -->
          <Card v-if="hasAutomation">
            <CardHeader>
              <CardTitle class="text-lg flex items-center gap-2">
                <Bot class="w-5 h-5" />
                Automation Patterns
              </CardTitle>
              <CardDescription>
                {{ specData.automation?.description || "Self-management and automation configurations" }}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div class="space-y-4">
                <div v-for="(pattern, idx) in specData.automation.patterns" 
                     :key="idx"
                     class="border rounded-lg p-4">
                  <h4 class="font-medium mb-3">{{ pattern.name }}</h4>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p class="text-muted-foreground mb-1">Trigger</p>
                      <p>{{ pattern.trigger }}</p>
                    </div>
                    <div>
                      <p class="text-muted-foreground mb-1">Action</p>
                      <p>{{ pattern.action }}</p>
                    </div>
                    <div>
                      <p class="text-muted-foreground mb-1">Output</p>
                      <p>{{ pattern.output }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Public Persona Tab -->
        <TabsContent value="persona" class="space-y-4">
          <div v-if="!hasPublicPersona" class="text-center py-12">
            <Bot class="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 class="text-lg font-medium">No Public Persona Defined</h3>
            <p class="text-muted-foreground mt-2">
              No public-facing persona has been configured for this agent.
            </p>
          </div>

          <div v-else class="space-y-4">
            <!-- Personality -->
            <Card>
              <CardHeader>
                <div class="flex items-center justify-between">
                  <CardTitle class="text-lg">Personality</CardTitle>
                  <Badge :variant="getScoreColor(specData.public_persona?.personality?.quality_score)">
                    {{ specData.public_persona?.personality?.quality_score || 'NA' }}
                    {{ specData.public_persona?.personality?.quality_score !== 'NA' ? '/10' : '' }}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent class="space-y-4">
                <p>{{ specData.public_persona?.personality?.description }}</p>
                
                <div v-if="specData.public_persona?.personality?.traits?.length">
                  <h4 class="font-medium text-sm text-muted-foreground mb-2">Character Traits</h4>
                  <div class="flex flex-wrap gap-2">
                    <Badge v-for="trait in specData.public_persona.personality.traits" 
                           :key="trait" 
                           variant="secondary">
                      {{ trait }}
                    </Badge>
                  </div>
                </div>
                
                <div v-if="specData.public_persona?.personality?.example_responses?.length">
                  <h4 class="font-medium text-sm text-muted-foreground mb-2">Example Responses</h4>
                  <div class="space-y-2">
                    <div v-for="(response, idx) in specData.public_persona.personality.example_responses" 
                         :key="idx"
                         class="border-l-4 border-primary/20 pl-4 py-2">
                      <p class="text-sm italic">{{ response }}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <!-- Boundaries -->
            <Card v-if="specData.public_persona?.boundaries">
              <CardHeader>
                <div class="flex items-center justify-between">
                  <CardTitle class="text-lg">Interaction Boundaries</CardTitle>
                  <Badge :variant="getScoreColor(specData.public_persona.boundaries.quality_score)">
                    {{ specData.public_persona.boundaries.quality_score || 'NA' }}
                    {{ specData.public_persona.boundaries.quality_score !== 'NA' ? '/10' : '' }}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 class="font-medium text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <CheckCircle class="w-4 h-4 text-green-500" />
                      Agent Handles
                    </h4>
                    <ul class="space-y-1">
                      <li v-for="(item, idx) in specData.public_persona.boundaries.handles" 
                          :key="idx"
                          class="text-sm flex items-start gap-2">
                        <span class="text-green-500 mt-0.5">•</span>
                        {{ item }}
                      </li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 class="font-medium text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <XCircle class="w-4 h-4 text-red-500" />
                      Agent Deflects
                    </h4>
                    <ul class="space-y-1">
                      <li v-for="(item, idx) in specData.public_persona.boundaries.deflects" 
                          :key="idx"
                          class="text-sm flex items-start gap-2">
                        <span class="text-red-500 mt-0.5">•</span>
                        {{ item }}
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <!-- System Prompt -->
            <Card v-if="specData.public_persona?.system_prompt">
              <CardHeader>
                <CardTitle class="text-lg">Generated System Prompt</CardTitle>
                <CardDescription>
                  The system prompt that defines the agent's behavior
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div class="relative">
                  <pre class="bg-slate-50 p-4 rounded-lg text-sm whitespace-pre-wrap overflow-x-auto">{{ specData.public_persona.system_prompt }}</pre>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    class="absolute top-2 right-2"
                    @click="copyToClipboard(specData.public_persona.system_prompt)"
                  >
                    <Copy class="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <!-- Feedback Tab -->
        <TabsContent value="feedback" class="space-y-4">
          <!-- Overall Feedback -->
          <Card>
            <CardHeader>
              <CardTitle class="text-lg flex items-center gap-2">
                <Lightbulb class="w-5 h-5" />
                Overall Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p class="text-sm leading-relaxed">
                {{ specData.feedback?.overall_feedback || "No overall feedback available." }}
              </p>
            </CardContent>
          </Card>

          <!-- Recommendations -->
          <Card v-if="recommendations.length > 0">
            <CardHeader>
              <CardTitle class="text-lg">Improvement Recommendations</CardTitle>
              <CardDescription>
                Specific suggestions to enhance the specification quality
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div class="space-y-4">
                <div v-for="(rec, idx) in recommendations" 
                     :key="idx"
                     class="border rounded-lg p-4">
                  <div class="flex items-start gap-3">
                    <Info class="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div class="flex-1">
                      <h4 class="font-medium mb-1 capitalize">
                        {{ rec.section.replace(/_/g, ' ') }}
                      </h4>
                      <p class="text-sm text-red-600 mb-2">Issue: {{ rec.issue }}</p>
                      <p class="text-sm text-green-600">Suggestion: {{ rec.suggestion }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>

    <!-- JSON Modal -->
    <Dialog :open="showJsonModal" @update:open="showJsonModal = $event">
      <DialogContent class="sm:max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>REPO.json - Full Specification</DialogTitle>
          <DialogDescription>
            Complete JSON structure of the repository specification
          </DialogDescription>
        </DialogHeader>
        
        <div class="flex-1 min-h-0 overflow-hidden">
          <CodeBlock 
            :code="JSON.stringify(specData, null, 2)"
            language="json"
            class="h-full"
          />
        </div>
        
        <DialogFooter class="mt-4">
          <Button variant="outline" @click="showJsonModal = false">
            Close
          </Button>
          <Button @click="copyToClipboard(JSON.stringify(specData, null, 2))">
            <Copy class="w-4 h-4 mr-2" />
            Copy JSON
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- REPO.md Modal with Tabs -->
    <Dialog :open="showMarkdownModal" @update:open="showMarkdownModal = $event">
      <DialogContent class="sm:max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>REPO.md</DialogTitle>
          <DialogDescription>
            Repository specification markdown file
          </DialogDescription>
        </DialogHeader>
        
        <Tabs v-model="markdownModalTab" class="flex-1 flex flex-col min-h-0">
          <TabsList class="grid w-full grid-cols-2">
            <TabsTrigger value="rendered">Rendered</TabsTrigger>
            <TabsTrigger value="source">Source Code</TabsTrigger>
          </TabsList>
          
          <TabsContent value="rendered" class="flex-1 mt-4 flex flex-col min-h-0">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 flex-shrink-0">
              <h4 class="font-medium text-blue-900 text-sm mb-1">How to Edit REPO.md</h4>
              <ul class="space-y-0.5 text-xs text-blue-800">
                <li>• Edit locally using your favorite editor (VS Code, Obsidian, vim, etc.)</li>
                <li>• Edit on GitHub directly in your browser</li>
                <li>• Ask the repo.md AI agent to make changes for you</li>
                <li>• Push changes to Git and they'll be processed automatically on the next build</li>
              </ul>
            </div>
            
            <div class="flex-1 overflow-y-auto border rounded-lg bg-white">
              <div class="p-6">
                <Prose :md="originalMarkdown" />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="source" class="flex-1 mt-4 flex flex-col min-h-0">
            <div class="flex-1 overflow-y-auto border rounded-lg bg-white">
              <CodeBlock 
                :code="originalMarkdown"
                language="markdown"
                :noScroll="true"
              />
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter class="mt-4 flex-shrink-0">
          <Button variant="outline" @click="showMarkdownModal = false">
            Close
          </Button>
          <Button @click="copyToClipboard(originalMarkdown)">
            <Copy class="w-4 h-4 mr-2" />
            Copy Markdown
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.text-muted-foreground {
  color: hsl(var(--muted-foreground));
}

/* Ensure proper spacing for accordion content */
:deep(.accordion-content) {
  padding-top: 1rem;
}

/* Badge color variants */
.badge-success {
  background-color: hsl(var(--success));
  color: hsl(var(--success-foreground));
}

.badge-warning {
  background-color: hsl(var(--warning));
  color: hsl(var(--warning-foreground));
}

/* Improve code block appearance in the modal */
:deep(.hljs) {
  background: transparent !important;
}
</style>