<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useToast } from "@/components/ui/toast/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import PageHeadingBar from "@/components/PageHeadingBar.vue";
import JsonDebug from "@/components/JsonDebug.vue";
import VueJsonPretty from "vue-json-pretty";
import "vue-json-pretty/lib/styles.css";
import {
  Search,
  Database as DatabaseIcon,
  Play,
  Code,
  Copy,
  CheckCircle,
  FileText,
  ExternalLink,
  LayoutGrid,
  X,
  Loader2,
  Save,
  Book,
  Table as TableIcon,
  FileJson,
  RefreshCw,
  List,
} from "lucide-vue-next";
// No need to import RepoMD here anymore
import { isLocalhost } from "@/lib/utils/devUtils.js";
import { appConfigs } from "@/appConfigs.js";
import { useOrgStore } from "@/store/orgStore";
// Using sql.js for browser-based SQLite functionality
import initSqlJs from 'sql.js';

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

// Get the organization store
const orgStore = useOrgStore();

const { toast } = useToast();

// State
const loading = ref(false);
const sqliteUrl = ref(null);
const copiedUrl = ref(false);
const currentQuery = ref('SELECT * FROM posts LIMIT 10;');
const queryResults = ref(null);
const queryError = ref(null);
const queryStatus = ref({
  running: false,
  success: false,
  time: null,
  rowCount: 0,
});
const activeTab = ref('posts');

// SQL.js state
const sqljs = ref(null);
const db = ref(null);
const sqlInitialized = ref(false);
const sqlInitError = ref(null);

// UI state
const viewMode = ref('table'); // 'table' or 'json'
const savedQueries = ref([
  {
    id: 'posts',
    name: 'Posts',
    query: 'SELECT id, title, slug, published_at, excerpt, word_count FROM posts LIMIT 20;',
    description: 'Get the latest posts with basic information'
  },
  {
    id: 'medias',
    name: 'Media Files',
    query: 'SELECT id, file_name, file_path, file_size, mime_type, created_at FROM media LIMIT 20;',
    description: 'Retrieve media files with details'
  },
  {
    id: 'schema',
    name: 'Table Schema',
    query: `SELECT name, sql 
FROM sqlite_master 
WHERE type='table' 
ORDER BY name;`,
    description: 'View all tables and their schemas'
  },
  {
    id: 'tags',
    name: 'Posts with Tags',
    query: `SELECT p.title, p.slug, t.name as tag
FROM posts p
JOIN post_tags pt ON p.id = pt.post_id
JOIN tags t ON pt.tag_id = t.id
ORDER BY p.published_at DESC
LIMIT 20;`,
    description: 'Get posts with their associated tags'
  },
  {
    id: 'recent',
    name: 'Recent Content',
    query: `SELECT 'post' as content_type, id, title, published_at 
FROM posts 
UNION ALL 
SELECT 'media' as content_type, id, file_name as title, created_at as published_at 
FROM media 
ORDER BY published_at DESC 
LIMIT 20;`,
    description: 'Get recent content (posts and media) by date'
  },
  {
    id: 'custom',
    name: 'Custom Query',
    query: '',
    description: 'Create your own custom query'
  }
]);

// Methods
const fetchSqliteUrl = async () => {
  console.log("Starting fetchSqliteUrl()");
  try {
    if (!props.repoClient) {
      console.error("RepoClient is not initialized");
      toast({
        title: "Error",
        description: "SQLite client is not initialized",
        variant: "destructive",
      });
      return;
    }

    loading.value = true;
    // Reset database state
    db.value = null;

    // Call getSqliteUrl method from the RepoMD instance
    sqliteUrl.value = await props.repoClient.getSqliteUrl();
    console.log("SQLite URL received:", sqliteUrl.value);

    // After getting the URL, load the database
    if (sqliteUrl.value) {
      await loadSqliteDatabase();
    }
  } catch (error) {
    console.error("Error fetching SQLite URL:", error);
    toast({
      title: "Error",
      description: "Unable to load SQLite URL",
      variant: "destructive",
    });
    sqliteUrl.value = null;
  } finally {
    loading.value = false;
  }
};

// Initialize SQL.js
const initializeSql = async () => {
  if (sqlInitialized.value) return sqljs.value;

  try {
    console.log("Initializing SQL.js...");
    // Initialize SQL.js with wasm location
    sqljs.value = await initSqlJs({
      // Locate the wasm file either from CDN or relative path
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}`
    });

    sqlInitialized.value = true;
    console.log("SQL.js initialized successfully");
    return sqljs.value;
  } catch (error) {
    console.error("Error initializing SQL.js:", error);
    sqlInitError.value = error.message || "Failed to initialize SQL.js";
    toast({
      title: "Error",
      description: "Failed to initialize SQLite engine",
      variant: "destructive",
    });
    throw error;
  }
};

// Load SQLite database from URL
const loadSqliteDatabase = async () => {
  if (!sqliteUrl.value) return;

  try {
    console.log("Loading SQLite database from URL:", sqliteUrl.value);

    // Make sure SQL.js is initialized
    const SQL = await initializeSql();

    // Fetch the database file
    const response = await fetch(sqliteUrl.value);
    if (!response.ok) {
      throw new Error(`Failed to fetch database: ${response.status} ${response.statusText}`);
    }

    // Get database as ArrayBuffer and convert to Uint8Array
    const arrayBuffer = await response.arrayBuffer();
    const uInt8Array = new Uint8Array(arrayBuffer);

    // Create a new database instance
    db.value = new SQL.Database(uInt8Array);

    console.log("SQLite database loaded successfully");
    toast({
      title: "Success",
      description: "Database loaded successfully",
    });

    return db.value;
  } catch (error) {
    console.error("Error loading SQLite database:", error);
    db.value = null;
    toast({
      title: "Error",
      description: "Failed to load SQLite database",
      variant: "destructive",
    });
    throw error;
  }
};

const copyToClipboard = (text) => {
  console.log("Copying to clipboard:", text);
  navigator.clipboard
    .writeText(text)
    .then(() => {
      copiedUrl.value = true;
      toast({
        title: "Copied!",
        description: "URL copied to clipboard",
      });
      
      setTimeout(() => {
        copiedUrl.value = false;
      }, 2000);
    })
    .catch((err) => {
      console.error("Unable to copy to clipboard", err);
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    });
};

const executeQuery = async () => {
  if (!currentQuery.value.trim()) {
    toast({
      title: "Error",
      description: "Please enter a query",
      variant: "destructive",
    });
    return;
  }

  if (!db.value) {
    // If database isn't loaded yet, try to load it
    if (sqliteUrl.value) {
      try {
        await loadSqliteDatabase();
      } catch (error) {
        toast({
          title: "Error",
          description: "Database not loaded. Please refresh and try again.",
          variant: "destructive",
        });
        return;
      }
    } else {
      toast({
        title: "Error",
        description: "Database URL not available",
        variant: "destructive",
      });
      return;
    }
  }

  // Reset state
  queryResults.value = null;
  queryError.value = null;
  queryStatus.value = {
    running: true,
    success: false,
    time: null,
    rowCount: 0,
  };

  const startTime = Date.now();

  try {
    console.log(`Executing query against SQLite database:`, currentQuery.value);

    // Determine if it's a SELECT query (to determine result format)
    const queryType = currentQuery.value.trim().split(' ')[0].toLowerCase();
    const isSelectQuery = queryType === 'select';

    if (isSelectQuery) {
      // Execute the query
      const results = db.value.exec(currentQuery.value);

      if (results.length > 0) {
        // Format results to match our expected format
        const formattedResults = {
          columns: results[0].columns,
          rows: results[0].values
        };

        queryResults.value = formattedResults;
        queryStatus.value.rowCount = formattedResults.rows.length;
        queryStatus.value.success = true;
      } else {
        // Query executed but returned no results
        queryResults.value = {
          columns: [],
          rows: []
        };
        queryStatus.value.rowCount = 0;
        queryStatus.value.success = true;
      }
    } else {
      // Non-select queries: run the query but don't expect results
      db.value.run(currentQuery.value);

      // For non-select queries, just return a success message
      queryResults.value = { message: "Query executed successfully" };
      queryStatus.value.success = true;
    }

  } catch (error) {
    console.error("Error executing query:", error);
    // Use the error handler to get user-friendly error message
    queryError.value = handleSqliteError(error);
    toast({
      title: "Query Failed",
      description: queryError.value,
      variant: "destructive",
    });
    queryStatus.value.success = false;
  } finally {
    queryStatus.value.running = false;
    queryStatus.value.time = ((Date.now() - startTime) / 1000).toFixed(2);
  }
};

const selectPredefinedQuery = (queryId) => {
  activeTab.value = queryId;
  const selectedQuery = savedQueries.value.find(q => q.id === queryId);
  if (selectedQuery) {
    currentQuery.value = selectedQuery.query;
  }
};

// Clean up database when component is unmounted
const cleanupDatabase = () => {
  if (db.value) {
    try {
      console.log('Closing SQLite database connection');
      db.value.close();
      db.value = null;
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }
};

// Handle SQLite errors
const handleSqliteError = (error) => {
  console.error('SQLite operation error:', error);

  // Map common SQLite errors to user-friendly messages
  const errorMessage = (() => {
    const message = error.message || String(error);

    if (message.includes('no such table')) {
      return 'Table not found. Please check table name and try again.';
    }
    if (message.includes('syntax error')) {
      return 'SQL syntax error. Please check your query.';
    }
    if (message.includes('constraint failed')) {
      return 'Constraint violation. Your query violates a database constraint.';
    }
    if (message.includes('readonly')) {
      return 'Database is in read-only mode. Modification operations are not allowed.';
    }

    // Default message for other errors
    return message;
  })();

  return errorMessage;
};

// Format cell value for display
const formatCellValue = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// Format query results as JSON for pretty display
const formatQueryResultsAsJson = (results) => {
  if (!results || !results.columns || !results.rows) return {};

  // Create an array of objects where each object represents a row
  // with properties named after the columns
  return results.rows.map(row => {
    const rowObject = {};
    results.columns.forEach((column, index) => {
      rowObject[column] = row[index];
    });
    return rowObject;
  });
};

// Watch for changes in the repoClient prop
watch(
  () => props.repoClient,
  () => {
    if (props.repoClient) {
      console.log("RepoClient changed, refreshing SQLite URL");
      fetchSqliteUrl();
    }
  },
  { immediate: false },
);

// Lifecycle
onMounted(() => {
  console.log("Component mounted, calling fetchSqliteUrl()");
  fetchSqliteUrl();
});

onBeforeUnmount(() => {
  console.log("Component will unmount, cleaning up database");
  cleanupDatabase();
});
</script>

<template>
  <PageHeadingBar
    title="SQLite Explorer"
    subtitle="Query and explore your project's SQLite database"
  >

  
    <template #actions>
        <Button
              variant="outline"
              size="sm"
              @click="copyToClipboard(sqliteUrl)"
              class="shrink-0"
            >
              <CheckCircle v-if="copiedUrl" class="w-4 h-4 text-green-500" />
              <Copy v-else class="w-4 h-4" />
              <span class="ml-2">{{ copiedUrl ? 'Copied!' : 'Copy Database URL' }}</span>
            </Button>
    </template>
    <Button @click="fetchSqliteUrl" variant="outline" class="mr-2">
      <RefreshCw class="mr-1 h-4 w-4" />
      Refresh
    </Button>
  </PageHeadingBar>

  <div class="container px-4 py-4">
    <!-- Loading State -->
    <div v-if="loading || props.isLoading" class="flex items-center justify-center h-64">
      <div
        class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"
      ></div>
    </div>

    <div v-else-if="error" class="py-4">
      <div class="bg-destructive/10 text-destructive p-4 rounded-md">
        <h3 class="font-medium mb-2">Error Loading Database</h3>
        <p>{{ error }}</p>
      </div>
    </div>

    <div v-else class="space-y-6">
      <!-- Database Info Card -->
 

      <!-- Error State -->
      <Card v-if="!loading && !sqliteUrl" class="shadow-sm bg-destructive/10">
        <CardHeader>
          <CardTitle class="text-destructive">Error Loading Database</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Unable to load the SQLite database URL. Please try again later.</p>
          <Button @click="fetchSqliteUrl" variant="outline" class="mt-4">
            <div class="flex items-center gap-2">
              <span>Retry</span>
            </div>
          </Button>
        </CardContent>
      </Card>

      <!-- Query Explorer -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <!-- Saved Queries Sidebar -->
        <Card class="shadow-sm md:col-span-1">
          <CardHeader class="pb-3">
            <div class="flex items-center gap-2">
              <Book class="h-5 w-5 text-primary" />
              <CardTitle class="text-base">Example Queries</CardTitle>
            </div>
          </CardHeader>
          <CardContent class="px-2">
            <ul class="space-y-1">
              <li
                v-for="query in savedQueries"
                :key="query.id"
                @click="selectPredefinedQuery(query.id)"
                class="cursor-pointer px-3 py-2 rounded-md hover:bg-accent"
                :class="{ 'bg-accent': activeTab === query.id }"
              >
                <div class="font-medium text-sm">{{ query.name }}</div>
                <div class="text-xs text-muted-foreground mt-1">
                  {{ query.description }}
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>

        <!-- Query Editor and Results -->
        <div class="md:col-span-3 space-y-6">
          <!-- Query Editor -->
          <Card class="shadow-sm">
            <CardHeader class="pb-3">
              <div class="flex items-center gap-2">
                <Code class="h-5 w-5 text-primary" />
                <CardTitle class="text-base">SQL Query</CardTitle>
              </div>
              <CardDescription>
                Write your SQL query to explore the database
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                v-model="currentQuery"
                placeholder="SELECT * FROM posts LIMIT 10;"
                class="font-mono text-sm min-h-[120px]"
              />
            </CardContent>
            <CardFooter class="flex justify-between items-center">
              <div class="text-sm text-muted-foreground">
                <span v-if="queryStatus.time">
                  Last query took {{ queryStatus.time }}s and returned
                  {{ queryStatus.rowCount }} rows
                </span>
              </div>
              <Button @click="executeQuery" :disabled="queryStatus.running || !sqliteUrl">
                <div class="flex items-center gap-2">
                  <Loader2 v-if="queryStatus.running" class="w-4 h-4 animate-spin" />
                  <Play v-else class="w-4 h-4" />
                  <span>Execute Query</span>
                </div>
              </Button>
            </CardFooter>
          </Card>

          <!-- Query Results -->
          <Card class="shadow-sm">
            <CardHeader class="pb-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TableIcon class="h-5 w-5 text-primary" />
                  <CardTitle class="text-base">Results</CardTitle>
                </div>
                <ToggleGroup type="single" size="sm" v-model="viewMode" class="mt-1">
                  <ToggleGroupItem value="table" aria-label="View as table" class="px-3">
                    <TableIcon class="h-4 w-4 mr-1" />
                    <span class="text-xs">Table</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="json" aria-label="View as JSON" class="px-3">
                    <FileJson class="h-4 w-4 mr-1" />
                    <span class="text-xs">JSON</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </CardHeader>
            <CardContent>
              <!-- Loading State -->
              <div
                v-if="queryStatus.running"
                class="flex items-center justify-center h-64"
              >
                <div class="flex flex-col items-center gap-3">
                  <div
                    class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"
                  ></div>
                  <span class="text-sm text-muted-foreground">
                    Executing query...
                  </span>
                </div>
              </div>

              <!-- Error State -->
              <div
                v-else-if="queryError"
                class="p-4 rounded-md bg-destructive/10 text-destructive"
              >
                <div class="flex items-start gap-2">
                  <X class="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <div class="font-medium">Query Error</div>
                    <div class="text-sm mt-1">{{ queryError }}</div>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else-if="!queryResults" class="text-center p-8">
                <FileJson class="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 class="mt-4 text-lg font-medium">No Query Results</h3>
                <p class="text-muted-foreground mt-2">
                  Execute a query to see results
                </p>
              </div>

              <!-- Results for SELECT Queries -->
              <template v-else-if="queryResults && queryResults.columns && queryResults.rows">
                <!-- Table View -->
                <div v-if="viewMode === 'table'" class="overflow-x-auto">
                  <table class="w-full border-collapse">
                    <thead>
                      <tr class="border-b">
                        <th
                          v-for="(column, idx) in queryResults.columns"
                          :key="idx"
                          class="text-left p-3 font-medium text-sm"
                        >
                          {{ column }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(row, rowIdx) in queryResults.rows"
                        :key="rowIdx"
                        class="border-b hover:bg-accent/20 transition-colors"
                      >
                        <td
                          v-for="(cell, cellIdx) in row"
                          :key="cellIdx"
                          class="p-3 text-sm"
                        >
                          <div class="truncate max-w-xs" :title="formatCellValue(cell)">
                            {{ formatCellValue(cell) }}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- JSON View -->
                <div v-else-if="viewMode === 'json'" class="overflow-x-auto">
                  <VueJsonPretty
                    :data="formatQueryResultsAsJson(queryResults)"
                    :deep="2"
                    :showDoubleQuotes="false"
                    :highlightMouseoverNode="true"
                    class="json-pretty-container"
                  />
                </div>
              </template>

              <!-- Message for non-SELECT Results -->
              <div v-else class="p-4 rounded-md bg-green-50 text-green-700">
                <div class="flex items-start gap-2">
                  <CheckCircle class="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <div class="font-medium">Query Executed Successfully</div>
                    <div class="text-sm mt-1">
                      {{ queryResults.message || "The query was executed successfully." }}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.text-muted-foreground {
  color: hsl(var(--muted-foreground));
}

.bg-accent {
  background-color: hsl(var(--accent));
}

.json-pretty-container {
  font-family: monospace;
  font-size: 0.9em;
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 0.375rem;
  overflow: auto;
  max-height: 500px;
}

:deep(.vjs-tree) {
  font-family: monospace !important;
}

:deep(.vjs-key) {
  color: hsl(var(--primary)) !important;
}

:deep(.vjs-value) {
  color: hsl(var(--foreground)) !important;
}
</style>