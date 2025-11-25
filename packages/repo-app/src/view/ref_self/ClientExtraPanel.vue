<!-- ExtraContent.vue -->
<script setup>
import { ref, onMounted, watch, computed } from "vue";
import { useRoute } from "vue-router";
import trpc from "@/trpc";
import { formatDate } from "@/lib/utils/dateUtils";

import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast/use-toast";
import {
	FileText,
	ArrowLeft,
	Loader2,
	AlertTriangle,
	Link,
	Mail,
} from "lucide-vue-next";

const route = useRoute();
const { toast } = useToast();

const patientId = computed(() => route.params.id);

// State management
const loading = ref(true);
const error = ref(null);
const extraContent = ref(null);

// First define the props
const props = defineProps({
	patientDetails: {
		type: Object,
		required: true,
	},
});

// Then create a ref from the prop value
const patientDetails = ref(props.patientDetails);

// Watch for changes in the prop to update the ref
watch(
	() => props.patientDetails,
	(newValue) => {
		patientDetails.value = newValue;
	},
);

// URL handling functions
const getShareUrl = () => {
	// Extract the extra ID from the full path
	const extraId = route.params.extraId;

	// Construct a clean public URL with just /extra/[id]
	const cleanPath = `/extra/${extraId}`;

	// Create the full URL with the clean path
	return new URL(cleanPath, window.location.origin).toString();
};

// Enhanced sharing functionality
const copyLink = async () => {
	try {
		// Build the complete URL for sharing
		const shareUrl = getShareUrl();

		// Use the Clipboard API to copy the URL
		await navigator.clipboard.writeText(shareUrl);

		// Show success toast
		toast({
			title: "Lien copié",
			description: "Le lien a été copié dans votre presse-papiers",
			variant: "success",
		});
	} catch (err) {
		// Handle errors (e.g., if clipboard access is denied)
		console.error("Error copying link:", err);
		toast({
			title: "Erreur",
			description: "Impossible de copier le lien. Veuillez réessayer.",
			variant: "destructive",
		});
	}
};

const sendEmail = () => {
	try {
		// Build the complete URL for sharing
		const shareUrl = getShareUrl();

		// Prepare email parameters
		const subject = encodeURIComponent(
			extraContent.value?.name || "Partage de contenu",
		);
		const body = encodeURIComponent(
			`${extraContent.value?.description || ""}\n\nLien: ${shareUrl}`,
		);

		// Create and open mailto link
		const mailtoUrl = `mailto:?to=${patientDetails.value.email}&subject=${subject}&body=${body}`;
		window.location.href = mailtoUrl;
	} catch (err) {
		console.error("Error opening email client:", err);
		toast({
			title: "Erreur",
			description: "Impossible d'ouvrir le client mail",
			variant: "destructive",
		});
	}
};

// Fetch the extra content
const fetchExtraContent = async (id) => {
	try {
		loading.value = true;
		error.value = null;

		const data = await trpc.getExtra.query(id);
		extraContent.value = data;
	} catch (err) {
		error.value = "Une erreur s'est produite lors du chargement du contenu";
		toast({
			title: "Erreur",
			description: "Impossible de charger le contenu",
			variant: "destructive",
		});
		console.error("Error fetching extra content:", err);
	} finally {
		loading.value = false;
	}
};

// Handle content update
const updateContent = async () => {
	try {
		await trpc.updateExtra.mutate({
			id: route.params.extraId,
			content: extraContent.value.content,
		});

		toast({
			title: "Succès",
			description: "Le contenu a été mis à jour",
		});
	} catch (err) {
		toast({
			title: "Erreur",
			description: "Impossible de mettre à jour le contenu",
			variant: "destructive",
		});
	}
};

// Watch for changes in the route parameter
watch(
	() => route.params.extraId,
	(newId) => {
		if (newId) {
			fetchExtraContent(newId);
		}
	},
);

// Lifecycle hooks
onMounted(() => {
	fetchExtraContent(route.params.extraId);
});
</script>

<template>
  <SidePanelHeader
    title="Extra"
    :backLink="`/client/${patientId}`"
    :completed="false"
    :elipsis="[]"
  />

  <div class="container mx-auto p-6">
    <!-- Action buttons with hover effects and loading states -->
    <div class="flex gap-4 mb-6">
      <Button
        variant="outline"
        @click="copyLink"
        class="hover:bg-primary/10 transition-colors"
      >
        <Link class="w-4 h-4 mr-2" />
        Copier le lien
      </Button>
      <Button
        variant="outline"
        @click="sendEmail"
        class="hover:bg-primary/10 transition-colors"
      >
        <Mail class="w-4 h-4 mr-2" />
        Envoyer par email
      </Button>
    </div>

    <!-- Rest of the template remains the same -->
    <div v-if="loading" class="flex items-center justify-center h-64">
      <Loader2 class="w-8 h-8 animate-spin text-primary" />
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      class="flex flex-col items-center justify-center h-64"
    >
      <AlertTriangle class="w-12 h-12 text-destructive mb-4" />
      <p class="text-lg text-destructive">{{ error }}</p>
      <Button class="mt-4" @click="fetchExtraContent(route.params.extraId)">
        Réessayer
      </Button>
    </div>

    <!-- Content display -->
    <div v-else-if="extraContent" class="space-y-6">
      <!-- Header card -->
      <Card>
        <CardHeader>
          <div class="flex items-start justify-between">
            <div>
              <CardTitle class="text-2xl font-bold">
                {{ extraContent.name }}
              </CardTitle>
              <CardDescription>
                Créé le {{ formatDate(extraContent.createdAt) }}
              </CardDescription>
            </div>
            <FileText class="w-6 h-6 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <p class="text-muted-foreground">
            {{ extraContent.description }}
          </p>

          <!-- Content display based on type -->
          <div
            v-if="extraContent.contentType === 'text'"
            class="prose prose-sm md:prose-base lg:prose-lg max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80 prose-img:rounded-lg prose-p:text-base prose-p:leading-relaxed prose-ul:list-disc prose-ul:pl-6 prose-ol:list-decimal prose-ol:pl-6 prose-li:marker:text-primary prose-blockquote:border-l-4 prose-blockquote:border-primary/50 prose-blockquote:pl-4 prose-hr:border-primary/20 prose prose-sm md:prose-base lg:prose-lg max-w-none prose-headings:font-bold prose-a:text-primary prose-img:rounded-lg"
          >
            <Prose :html="extraContent.contentHtml" :max-height="0" />

            <!-- Add content renderer based on type
            <div v-html="extraContent.contentHtml"></div>
             -->
          </div>

          <div
            v-else-if="extraContent.contentType === 'form'"
            class="space-y-4"
          >
            <!-- Add form renderer -->
            <p class="text-muted-foreground">Formulaire à implémenter</p>
          </div>

          <div v-else class="text-muted-foreground">
            Type de contenu non pris en charge
          </div>
        </CardContent>
      </Card>

      <!-- Metadata card -->
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent>
          <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt class="text-sm font-medium text-muted-foreground">Status</dt>
              <dd class="mt-1">
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="{
                    'bg-green-100 text-green-800':
                      extraContent.status === 'active',
                    'bg-yellow-100 text-yellow-800':
                      extraContent.status === 'draft',
                    'bg-red-100 text-red-800':
                      extraContent.status === 'archived',
                  }"
                >
                  {{ extraContent.status }}
                </span>
              </dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-muted-foreground">
                Dernière modification
              </dt>
              <dd class="mt-1">{{ formatDate(extraContent.updatedAt) }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-muted-foreground">Type</dt>
              <dd class="mt-1">{{ extraContent.type }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-muted-foreground">Version</dt>
              <dd class="mt-1">
                {{ extraContent.metadata?.version || "1.0" }}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>

    <!-- Empty state -->
    <div v-else class="flex flex-col items-center justify-center h-64">
      <p class="text-lg text-muted-foreground">Aucun contenu trouvé</p>
    </div>
    <JsonDebug :data="patientDetails" :expanded="false" />
  </div>
</template>

<style scoped>
/* Enhanced typography for prose content */
:deep(.prose) {
  max-width: none;
  font-size: 1.125rem;
  line-height: 1.8;
}

:deep(.prose p) {
  margin-bottom: 1.5em;
}

:deep(.prose h1) {
  font-size: 2.5rem;
  margin-top: 2em;
  margin-bottom: 1em;
}

:deep(.prose h2) {
  font-size: 2rem;
  margin-top: 1.8em;
  margin-bottom: 0.8em;
}

:deep(.prose h3) {
  font-size: 1.5rem;
  margin-top: 1.6em;
  margin-bottom: 0.6em;
}

:deep(.prose a) {
  color: #2563eb;
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 2px;
}

:deep(.prose code) {
  background-color: #f3f4f6;
  padding: 0.2em 0.4em;
  border-radius: 0.375rem;
  font-size: 0.875em;
}

:deep(.prose pre) {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 1.25em;
  border-radius: 0.5rem;
  overflow-x: auto;
}

:deep(.prose blockquote) {
  border-left-width: 4px;
  border-left-color: #e2e8f0;
  padding-left: 1.5em;
  font-style: italic;
  color: #4b5563;
}

:deep(.prose ul) {
  list-style-type: disc;
  padding-left: 1.5em;
}

:deep(.prose ol) {
  list-style-type: decimal;
  padding-left: 1.5em;
}

:deep(.prose li) {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}
</style>
