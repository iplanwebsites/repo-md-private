// LegalDocument.vue
<script setup>
import { ref, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { marked } from "marked";
import DOMPurify from "dompurify";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
	ChevronLeft,
	Clock,
	Calendar,
	FileText,
	AlertCircle,
	Printer,
} from "lucide-vue-next";
import { formatDateCustom } from "@/lib/utils/dateUtils";

const route = useRoute();
const router = useRouter();
const legalDocument = ref(null);
const isLoading = ref(true);
const error = ref(null);
const htmlContent = ref("");

// Document metadata
const documentMeta = ref({
	title: "",
	lastUpdated: "",
	effectiveDate: "",
	version: "",
});

// Legal documents registry - in a real app, this might come from an API
const legalDocuments = {
	terms: {
		path: "/legal/terms.md",
		title: "Terms of Service",
		lastUpdated: "2025-04-01",
		effectiveDate: "2025-04-15",
		version: "2.1",
	},
	"privacy-policy": {
		path: "/legal/privacy-policy.md",
		title: "Privacy Policy",
		lastUpdated: "2025-03-20",
		effectiveDate: "2025-04-01",
		version: "3.0",
	},
	"cookie-policy": {
		path: "/legal/cookie-policy.md",
		title: "Cookie Policy",
		lastUpdated: "2025-02-10",
		effectiveDate: "2025-02-25",
		version: "1.2",
	},
	"acceptable-use": {
		path: "/legal/acceptable-use.md",
		title: "Acceptable Use Policy",
		lastUpdated: "2025-01-15",
		effectiveDate: "2025-02-01",
		version: "2.0",
	},
};

// Function to load the markdown file based on route param
const loadLegalDocument = async () => {
	isLoading.value = true;
	error.value = null;

	const docId = route.params.id;

	if (!legalDocuments[docId]) {
		error.value = "Legal document not found";
		isLoading.value = false;
		return;
	}

	try {
		// Update metadata first
		documentMeta.value = legalDocuments[docId];

		// Fetch the markdown file from the server
		const response = await fetch(legalDocuments[docId].path);

		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`);
		}

		legalDocument.value = await response.text();

		// Convert markdown to HTML and sanitize
		htmlContent.value = DOMPurify.sanitize(marked(legalDocument.value));
	} catch (err) {
		error.value = "Failed to load document. Please try again later.";
		console.error("Error loading legal document:", err);
	} finally {
		isLoading.value = false;
	}
};

// Navigation back function
const goBack = () => {
	router.back();
};

// Print document function
const printDocument = () => {
	window.print();
};

// Watch for route changes to reload document when navigating between legal pages
watch(
	() => route.params.id,
	(newId) => {
		if (newId) {
			loadLegalDocument();
		}
	},
);

// Load document on component mount
onMounted(() => {
	loadLegalDocument();
});
</script>

<template>
  <div class="bg-slate-50 min-h-screen">
    <div class="container py-8 px-4">
      <div class="max-w-4xl mx-auto space-y-6">
        <!-- Navigation -->
        <div class="flex justify-between items-center">
          <Button variant="outline" @click="goBack">
            <ChevronLeft class="h-4 w-4 mr-2" />
            Back
          </Button>

          <Button variant="outline" @click="printDocument">
            <Printer class="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>

        <!-- Legal Document -->
        <Card class="shadow-md">
          <CardHeader v-if="!isLoading && !error">
            <div class="flex justify-between items-start">
              <div>
                <CardTitle class="text-2xl">{{ documentMeta.title }}</CardTitle>
                <CardDescription>
                  <div class="flex flex-wrap gap-4 mt-2">
                    <div class="flex items-center gap-1 text-sm">
                      <Calendar class="h-4 w-4 text-primary" />
                      <span
                        >Effective:
                        {{ formatDateCustom(documentMeta.effectiveDate) }}</span
                      >
                    </div>
                    <div class="flex items-center gap-1 text-sm">
                      <Clock class="h-4 w-4 text-primary" />
                      <span
                        >Last Updated:
                        {{ formatDateCustom(documentMeta.lastUpdated) }}</span
                      >
                    </div>
                    <div class="flex items-center gap-1 text-sm">
                      <FileText class="h-4 w-4 text-primary" />
                      <span>Version {{ documentMeta.version }}</span>
                    </div>
                  </div>
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <!-- Loading state -->
            <div v-if="isLoading" class="flex justify-center py-12">
              <div class="animate-pulse flex flex-col items-center">
                <div class="h-8 w-2/3 bg-slate-200 rounded mb-4"></div>
                <div class="h-4 w-full bg-slate-200 rounded mb-2"></div>
                <div class="h-4 w-5/6 bg-slate-200 rounded mb-2"></div>
                <div class="h-4 w-4/6 bg-slate-200 rounded"></div>
              </div>
            </div>

            <!-- Error state -->
            <div v-else-if="error" class="text-center py-12">
              <AlertCircle class="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 class="text-xl font-medium text-red-500">{{ error }}</h3>
              <p class="mt-2 text-slate-600">
                Please try again or contact support for assistance.
              </p>
              <Button variant="outline" class="mt-4" @click="loadLegalDocument">
                Retry
              </Button>
            </div>

            <!-- Content -->
            <div v-else class="prose prose-slate max-w-none">
              <div v-html="htmlContent"></div>
            </div>
          </CardContent>

          <CardFooter v-if="!isLoading && !error">
            <p class="text-sm text-muted-foreground">
              For questions about this document, please contact
              <a href="mailto:legal@repo.md" class="text-primary"
                >legal@repo.md</a
              >
            </p>
          </CardFooter>
        </Card>

        <!-- Related Legal Documents -->
        <Card class="shadow-md" v-if="!isLoading && !error">
          <CardHeader>
            <CardTitle>Related Legal Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <router-link
                v-for="(doc, id) in legalDocuments"
                :key="id"
                :to="`/legal/${id}`"
                v-show="id !== route.params.id"
                class="border rounded-lg p-4 hover:bg-muted cursor-pointer transition-colors"
              >
                <h3 class="font-medium mb-1">{{ doc.title }}</h3>
                <p class="text-xs text-muted-foreground">
                  Version {{ doc.version }} • Updated
                  {{ formatDateCustom(doc.lastUpdated) }}
                </p>
              </router-link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
}

/* Print styles */
@media print {
  .no-print {
    display: none;
  }

  .prose {
    font-size: 12pt;
  }
}

/* Add some styling for the markdown content */
:deep(.prose) {
  h1 {
    color: #334155;
    margin-top: 0;
  }

  h2 {
    color: #475569;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.5rem;
    margin-top: 1.5rem;
  }

  ul,
  ol {
    padding-left: 1.5rem;
  }

  a {
    color: #2563eb;
    text-decoration: underline;
  }
}
</style>
