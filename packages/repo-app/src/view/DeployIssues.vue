<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  FileWarning,
  Search,
  ChevronDown,
  Filter,
  RefreshCw,
  FileText,
  Code,
  GitBranch,
  Clock,
  Layers,
  FolderTree,
  Package,
  Grid3X3,
  List
} from "lucide-vue-next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Props
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
    type: String,
    default: null,
  },
  repoClient: {
    type: Object,
    required: true,
  },
  project: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["refresh"]);

// Route info
const route = useRoute();
const projectId = computed(() => route.params.projectId);
const orgId = computed(() => route.params.orgId);
const deployId = computed(() => route.params.deployId);

// State
const searchQuery = ref("");
const selectedSeverity = ref("all");
const selectedType = ref("all");
const selectedGrouping = ref("file");
const viewMode = ref("card");
const issues = ref([]);
const isLoadingIssues = ref(false);
const issuesError = ref(null);
const issuesSummary = ref(null);

// Filter options
const severityOptions = [
  { value: "all", label: "All Severities" },
  { value: "error", label: "Errors", icon: AlertCircle, color: "text-red-500" },
  { value: "warning", label: "Warnings", icon: AlertTriangle, color: "text-yellow-500" },
  { value: "info", label: "Info", icon: Info, color: "text-blue-500" },
];

const typeOptions = [
  { value: "all", label: "All Categories" },
  { value: "broken-link", label: "Broken Links" },
  { value: "missing-media", label: "Missing Media" },
  { value: "media-processing", label: "Media Processing" },
  { value: "slug-conflict", label: "Slug Conflicts" },
  { value: "mermaid-error", label: "Mermaid Errors" },
  { value: "frontmatter-error", label: "Frontmatter Errors" },
  { value: "parse-error", label: "Parse Errors" },
  { value: "file-access", label: "File Access" },
  { value: "configuration", label: "Configuration" },
  { value: "other", label: "Other" },
];

// Grouping options
const groupingOptions = [
  { value: "all", label: "All Issues", icon: Layers },
  { value: "file", label: "By File", icon: FileText },
  { value: "module", label: "By Module", icon: Package },
  { value: "category", label: "By Category", icon: FolderTree },
  { value: "severity", label: "By Severity", icon: AlertCircle },
];

// Load processor issues
const loadIssues = async () => {
  if (!props.repoClient) {
    console.error("RepoClient not available");
    return;
  }

  isLoadingIssues.value = true;
  issuesError.value = null;

  try {
    // Load both processor-issues.json and worker-issues.json in parallel
    const [processorResult, workerResult] = await Promise.allSettled([
      loadIssuesFile("/processor-issues.json"),
      loadIssuesFile("/worker-issues.json")
    ]);

    // Combine issues from both files
    const allIssues = [];
    let combinedSummary = {
      totalIssues: 0,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0
    };

    // Process processor issues
    if (processorResult.status === 'fulfilled' && processorResult.value) {
      allIssues.push(...(processorResult.value.issues || []));
      if (processorResult.value.summary) {
        combinedSummary.totalIssues += processorResult.value.summary.totalIssues || 0;
        combinedSummary.errorCount += processorResult.value.summary.errorCount || 0;
        combinedSummary.warningCount += processorResult.value.summary.warningCount || 0;
        combinedSummary.infoCount += processorResult.value.summary.infoCount || 0;
      }
    }

    // Process worker issues
    if (workerResult.status === 'fulfilled' && workerResult.value) {
      allIssues.push(...(workerResult.value.issues || []));
      if (workerResult.value.summary) {
        combinedSummary.totalIssues += workerResult.value.summary.totalIssues || 0;
        combinedSummary.errorCount += workerResult.value.summary.errorCount || 0;
        combinedSummary.warningCount += workerResult.value.summary.warningCount || 0;
        combinedSummary.infoCount += workerResult.value.summary.infoCount || 0;
      }
    }

    issues.value = allIssues;
    issuesSummary.value = combinedSummary.totalIssues > 0 ? combinedSummary : null;
    
    console.log("Total issues loaded:", allIssues.length, "issues found");
    
  } catch (err) {
    console.error("Error loading issues:", err);
    issuesError.value = err.message || "Failed to load issues";
    issues.value = [];
  } finally {
    isLoadingIssues.value = false;
  }
};

// Helper function to load a single issues file
const loadIssuesFile = async (filePath) => {
  try {
    const fileUrl = await props.repoClient.getR2Url(filePath);
    console.log(`Loading ${filePath}:`, fileUrl);
    
    const response = await fetch(fileUrl);
    console.log(`Response status for ${filePath}:`, response.status);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`${filePath} not found in deployment`);
        return null;
      }
      throw new Error(`Failed to fetch ${filePath}: ${response.statusText}`);
    }
    
    const issueData = await response.json();
    console.log(`${filePath} loaded successfully:`, issueData.issues?.length || 0, "issues found");
    return issueData;
    
  } catch (err) {
    console.error(`Error loading ${filePath}:`, err);
    if (err.message?.includes("404") || err.message?.includes("not found")) {
      // File doesn't exist, which is normal
      return null;
    }
    // Re-throw for real errors
    throw err;
  }
};

// Filtered issues based on search and filters
const filteredIssues = computed(() => {
  let filtered = issues.value;

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(issue => 
      issue.message?.toLowerCase().includes(query) ||
      issue.filePath?.toLowerCase().includes(query) ||
      issue.category?.toLowerCase().includes(query) ||
      issue.module?.toLowerCase().includes(query)
    );
  }

  // Filter by severity
  if (selectedSeverity.value !== "all") {
    filtered = filtered.filter(issue => 
      issue.severity?.toLowerCase() === selectedSeverity.value
    );
  }

  // Filter by category
  if (selectedType.value !== "all") {
    filtered = filtered.filter(issue => 
      issue.category?.toLowerCase() === selectedType.value
    );
  }

  return filtered;
});

// Group issues based on selected grouping
const groupedIssues = computed(() => {
  if (selectedGrouping.value === "all") {
    // Return all issues in a single group
    return { "All Issues": filteredIssues.value };
  }
  
  const grouped = {};
  
  filteredIssues.value.forEach(issue => {
    let groupKey;
    
    switch (selectedGrouping.value) {
      case "file":
        groupKey = issue.filePath || "Unknown File";
        break;
      case "module":
        groupKey = issue.module || "Unknown Module";
        break;
      case "category":
        groupKey = issue.category || "Unknown Category";
        break;
      case "severity":
        groupKey = issue.severity || "Unknown Severity";
        break;
      default:
        groupKey = issue.filePath || "Unknown";
    }
    
    if (!grouped[groupKey]) {
      grouped[groupKey] = [];
    }
    grouped[groupKey].push(issue);
  });

  // Sort groups by number of issues (descending)
  return Object.entries(grouped)
    .sort((a, b) => b[1].length - a[1].length)
    .reduce((acc, [key, issues]) => {
      acc[key] = issues;
      return acc;
    }, {});
});

// Get severity icon and color
const getSeverityIcon = (severity) => {
  switch (severity?.toLowerCase()) {
    case "error":
      return { icon: AlertCircle, color: "text-red-500", bg: "bg-red-100" };
    case "warning":
      return { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-100" };
    case "info":
      return { icon: Info, color: "text-blue-500", bg: "bg-blue-100" };
    default:
      return { icon: FileWarning, color: "text-gray-500", bg: "bg-gray-100" };
  }
};

// Get issue counts by severity
const issueCounts = computed(() => {
  // If we have summary data, use it
  if (issuesSummary.value) {
    return {
      total: issuesSummary.value.totalIssues || issues.value.length,
      error: issuesSummary.value.errorCount || 0,
      warning: issuesSummary.value.warningCount || 0,
      info: issuesSummary.value.infoCount || 0,
    };
  }

  // Otherwise calculate from issues array
  const counts = {
    total: issues.value.length,
    error: 0,
    warning: 0,
    info: 0,
  };

  issues.value.forEach(issue => {
    const severity = issue.severity?.toLowerCase();
    if (severity in counts) {
      counts[severity]++;
    }
  });

  return counts;
});

// Check if filters are active
const hasActiveFilters = computed(() => {
  return searchQuery.value !== "" || 
         selectedSeverity.value !== "all" || 
         selectedType.value !== "all";
});

// Clear all filters
const clearAllFilters = () => {
  searchQuery.value = "";
  selectedSeverity.value = "all";
  selectedType.value = "all";
};

// Refresh issues
const refreshIssues = () => {
  loadIssues();
  emit("refresh");
};

// Get icon for group header based on grouping type
const getGroupIcon = () => {
  const option = groupingOptions.find(opt => opt.value === selectedGrouping.value);
  return option?.icon || FileText;
};

// Load issues on mount
onMounted(() => {
  loadIssues();
});

// Get selected filter labels
const selectedSeverityLabel = computed(() => {
  const option = severityOptions.find(opt => opt.value === selectedSeverity.value);
  return option ? option.label : "All Severities";
});

const selectedTypeLabel = computed(() => {
  const option = typeOptions.find(opt => opt.value === selectedType.value);
  return option ? option.label : "All Types";
});

const selectedGroupingLabel = computed(() => {
  const option = groupingOptions.find(opt => opt.value === selectedGrouping.value);
  return option ? option.label : "All Issues";
});

// Get counts for severity options
const severityCounts = computed(() => {
  const counts = {
    all: issues.value.length,
    error: 0,
    warning: 0,
    info: 0,
  };
  
  issues.value.forEach(issue => {
    const severity = issue.severity?.toLowerCase();
    if (severity && counts.hasOwnProperty(severity)) {
      counts[severity]++;
    }
  });
  
  return counts;
});

// Get counts for category options
const categoryCounts = computed(() => {
  const counts = {
    all: issues.value.length,
  };
  
  // Initialize counts for all category options
  typeOptions.forEach(option => {
    if (option.value !== 'all') {
      counts[option.value] = 0;
    }
  });
  
  issues.value.forEach(issue => {
    const category = issue.category?.toLowerCase();
    if (category) {
      if (!counts.hasOwnProperty(category)) {
        counts[category] = 0;
      }
      counts[category]++;
    }
  });
  
  return counts;
});
</script>

<template>
  <div class="container mx-auto p-6">
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold">Deployment Issues</h1>
        <Button @click="refreshIssues" variant="outline" size="sm">
          <RefreshCw class="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm">Total Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">{{ issueCounts.total }}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm flex items-center">
              <AlertCircle class="w-4 h-4 mr-1 text-red-500" />
              Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold text-red-600">{{ issueCounts.error }}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm flex items-center">
              <AlertTriangle class="w-4 h-4 mr-1 text-yellow-500" />
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold text-yellow-600">{{ issueCounts.warning }}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm flex items-center">
              <Info class="w-4 h-4 mr-1 text-blue-500" />
              Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold text-blue-600">{{ issueCounts.info }}</div>
          </CardContent>
        </Card>
      </div>

      <!-- Grouping and Filters -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-4">
          <!-- Grouping Dropdown -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="outline" class="flex items-center gap-2">
                <component :is="groupingOptions.find(o => o.value === selectedGrouping)?.icon || Layers" class="w-4 h-4" />
                {{ selectedGroupingLabel }}
                <ChevronDown class="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Group Issues By</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                v-for="option in groupingOptions"
                :key="option.value"
                @click="selectedGrouping = option.value"
                class="cursor-pointer"
                :class="{ 'bg-gray-100': selectedGrouping === option.value }"
              >
                <component :is="option.icon" class="w-4 h-4 mr-2" />
                {{ option.label }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <!-- View Mode Toggle -->
          <div class="flex items-center border rounded-md">
            <Button
              variant="ghost"
              size="sm"
              @click="viewMode = 'card'"
              :class="{ 'bg-gray-100': viewMode === 'card' }"
              class="rounded-r-none"
            >
              <Grid3X3 class="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              @click="viewMode = 'table'"
              :class="{ 'bg-gray-100': viewMode === 'table' }"
              class="rounded-l-none"
            >
              <List class="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex gap-4 items-center">
        <div class="relative flex-1 max-w-md">
          <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search issues..."
            class="pl-10"
            v-model="searchQuery"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" class="flex items-center gap-2">
              <Filter class="w-4 h-4" />
              {{ selectedSeverityLabel }}
              <ChevronDown class="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Filter by Severity</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              v-for="option in severityOptions"
              :key="option.value"
              @click="selectedSeverity = option.value"
              class="cursor-pointer"
            >
              <div class="flex items-center justify-between w-full">
                <div class="flex items-center">
                  <component
                    v-if="option.icon"
                    :is="option.icon"
                    :class="['w-4 h-4 mr-2', option.color]"
                  />
                  {{ option.label }}
                </div>
                <span v-if="severityCounts[option.value] > 0" class="ml-auto text-sm text-muted-foreground">
                  {{ severityCounts[option.value] }}
                </span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" class="flex items-center gap-2">
              <FileText class="w-4 h-4" />
              {{ selectedTypeLabel }}
              <ChevronDown class="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              v-for="option in typeOptions"
              :key="option.value"
              @click="selectedType = option.value"
              class="cursor-pointer"
            >
              <div class="flex items-center justify-between w-full">
                <span>{{ option.label }}</span>
                <span v-if="categoryCounts[option.value] > 0" class="ml-auto text-sm text-muted-foreground">
                  {{ categoryCounts[option.value] }}
                </span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          v-if="hasActiveFilters"
          variant="ghost"
          size="sm"
          @click="clearAllFilters"
        >
          Clear filters
        </Button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoadingIssues" class="flex items-center justify-center p-12">
      <RefreshCw class="w-6 h-6 animate-spin text-blue-500 mr-3" />
      <span>Loading deployment issues...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="issuesError" class="p-8 bg-red-50 border border-red-200 rounded-md">
      <div class="flex items-center gap-2 text-red-700">
        <AlertCircle class="w-5 h-5" />
        <span>{{ issuesError }}</span>
      </div>
      <Button @click="loadIssues" variant="outline" class="mt-4">
        Retry
      </Button>
    </div>

    <!-- No Issues State -->
    <div v-else-if="issues.length === 0" class="text-center p-12 bg-white border rounded-lg">
      <div class="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
        <FileText class="w-8 h-8 text-green-500" />
      </div>
      <h3 class="text-lg font-medium mb-2">No deployment issues found</h3>
      <p class="text-gray-600 max-w-md mx-auto">
        Great! Your deployment completed without any issues.
      </p>
    </div>

    <!-- No Results State (filtered) -->
    <div v-else-if="filteredIssues.length === 0 && issues.length > 0" class="text-center p-12 bg-white border rounded-lg">
      <div class="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Search class="w-8 h-8 text-gray-400" />
      </div>
      <h3 class="text-lg font-medium mb-2">No issues match your filters</h3>
      <p class="text-gray-600 max-w-md mx-auto mb-4">
        Try adjusting your search criteria or clearing filters to see all issues.
      </p>
      <Button @click="clearAllFilters" variant="outline">
        Clear all filters
      </Button>
    </div>

    <!-- Issues Display -->
    <div v-else>
      <!-- Card View -->
      <div v-if="viewMode === 'card'" class="space-y-6">
        <div v-for="(fileIssues, fileName) in groupedIssues" :key="fileName" class="bg-white border rounded-lg overflow-hidden">
        <div class="bg-gray-50 px-4 py-3 border-b">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <component 
                :is="getGroupIcon()" 
                class="w-5 h-5 text-gray-600" 
              />
              <span class="font-medium">{{ fileName }}</span>
            </div>
            <Badge variant="secondary">
              {{ fileIssues.length }} issue{{ fileIssues.length !== 1 ? 's' : '' }}
            </Badge>
          </div>
        </div>

        <div class="divide-y">
          <div v-for="(issue, index) in fileIssues" :key="index" class="p-4 hover:bg-gray-50 transition-colors">
            <div class="flex items-start gap-3">
              <component
                :is="getSeverityIcon(issue.severity).icon"
                :class="['w-5 h-5 mt-0.5 flex-shrink-0', getSeverityIcon(issue.severity).color]"
              />
              
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <Badge :class="getSeverityIcon(issue.severity).bg" variant="secondary">
                    {{ issue.severity || 'Unknown' }}
                  </Badge>
                  <Badge variant="outline">
                    {{ issue.category || 'General' }}
                  </Badge>
                  <Badge variant="outline" class="text-xs">
                    {{ issue.module || 'Unknown Module' }}
                  </Badge>
                  <span v-if="issue.context?.line" class="text-sm text-gray-500">
                    Line {{ issue.context.line }}
                  </span>
                </div>
                
                <p class="text-gray-700 mb-2">{{ issue.message }}</p>
                
                <div v-if="issue.context" class="bg-gray-100 rounded p-3 text-sm text-gray-700">
                  <div v-if="issue.context.linkText" class="mb-1">
                    <strong>Link Text:</strong> {{ issue.context.linkText }}
                  </div>
                  <div v-if="issue.context.linkTarget">
                    <strong>Link Target:</strong> {{ issue.context.linkTarget }}
                  </div>
                  <div v-if="issue.context.linkType" class="text-xs text-gray-500 mt-1">
                    Type: {{ issue.context.linkType }}
                  </div>
                </div>

                <div v-if="issue.timestamp" class="mt-2 text-xs text-gray-500">
                  {{ new Date(issue.timestamp).toLocaleString() }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      <!-- Table View -->
      <div v-if="viewMode === 'table'" class="bg-white border rounded-lg overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Severity
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                File/Location
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Message
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Module
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <template v-for="(groupIssues, groupName) in groupedIssues" :key="groupName">
              <!-- Group Header Row (if not "all" grouping) -->
              <tr v-if="selectedGrouping !== 'all'" class="bg-gray-50">
                <td colspan="5" class="px-4 py-2 text-sm font-medium text-gray-700">
                  <div class="flex items-center gap-2">
                    <component :is="getGroupIcon()" class="w-4 h-4" />
                    {{ groupName }}
                    <Badge variant="secondary" class="ml-2">
                      {{ groupIssues.length }} issue{{ groupIssues.length !== 1 ? 's' : '' }}
                    </Badge>
                  </div>
                </td>
              </tr>
              
              <!-- Issue Rows -->
              <tr v-for="(issue, index) in groupIssues" 
                  :key="`${groupName}-${index}`"
                  class="hover:bg-gray-50 transition-colors"
              >
                <td class="px-4 py-3 whitespace-nowrap">
                  <div class="flex items-center">
                    <component
                      :is="getSeverityIcon(issue.severity).icon"
                      :class="['w-4 h-4 mr-2', getSeverityIcon(issue.severity).color]"
                    />
                    <Badge :class="getSeverityIcon(issue.severity).bg" variant="secondary" class="text-xs">
                      {{ issue.severity || 'Unknown' }}
                    </Badge>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-900">
                  <div class="truncate max-w-xs" :title="issue.filePath">
                    {{ issue.filePath || 'Unknown File' }}
                  </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-900">
                  <div class="truncate max-w-md" :title="issue.message">
                    {{ issue.message }}
                  </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {{ issue.category || 'General' }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {{ issue.module || 'Unknown' }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom styles if needed */
</style>