<!-- ExtraContent.vue -->
<script setup>
import { ref, onMounted, watch } from "vue";
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

//import { TextToSpeech } from "@/components/TextToSpeech.vue";

import {
	FileText,
	ArrowLeft,
	Loader2,
	AlertTriangle,
	Link,
	Mail,
	Calendar,
	Clock,
	Tag,
	Share2,
} from "lucide-vue-next";

const route = useRoute();
const { toast } = useToast();

// State management with reactive references
const loading = ref(true);
const error = ref(null);
const extraContent = ref(null);

// Share functionality
const copyLink = async () => {
	try {
		await navigator.clipboard.writeText(window.location.href);
		toast({
			title: "Lien copié",
			description: "Le lien a été copié dans votre presse-papiers",
		});
	} catch (err) {
		toast({
			title: "Erreur",
			description: "Impossible de copier le lien",
			variant: "destructive",
		});
	}
};

const sendEmail = () => {
	const subject = encodeURIComponent(extraContent.value?.name || "");
	const body = encodeURIComponent(window.location.href);
	window.location.href = `mailto:?subject=${subject}&body=${body}`;
};

// Content fetching logic
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
	} finally {
		loading.value = false;
	}
};

// Route parameter watcher
watch(
	() => route.params.extraId,
	(newId) => {
		if (newId) {
			fetchExtraContent(newId);
		}
	},
);

onMounted(() => {
	fetchExtraContent(route.params.extraId);
});
</script>

<template>
  <!-- Main container with very dark background -->
  <div class="min-h-screen bg-[#99caca] py-16 px-4 sm:px-6">
    <!-- Centered content container with generous spacing -->
    <div class="max-w-4xl mx-auto">
      <!-- Loading state -->
      <div v-if="loading" class="flex items-center justify-center min-h-[60vh]">
        <Loader2 class="w-10 h-10 animate-spin text-white/80" />
      </div>

      <!-- Error state -->
      <div
        v-else-if="error"
        class="flex flex-col items-center justify-center min-h-[60vh]"
      >
        <AlertTriangle class="w-14 h-14 text-red-500 mb-6" />
        <p class="text-xl text-white/80">{{ error }}</p>
        <Button class="mt-6" @click="fetchExtraContent(route.params.extraId)">
          Réessayer
        </Button>
      </div>

      <!-- Content display -->
      <div v-else-if="extraContent" class="space-y-10">
        <json-debug :data="extraContent" :expanded="false" />
        <!-- Main content card -->
        <Card class="bg-white shadow-xl">
          <CardHeader class="p-8">
            <!-- Article metadata with improved spacing -->
            <div
              class="flex flex-wrap items-center gap-6 text-base text-gray-600 mb-8"
            >
              <span class="flex items-center gap-2">
                <Calendar class="w-5 h-5" />
                {{ formatDate(extraContent.createdAt) }}
              </span>
              <span class="flex items-center gap-2">
                <Tag class="w-5 h-5" />
                {{ extraContent.type }}
              </span>
              <span
                class="px-3 py-1 rounded-full text-sm font-medium"
                :class="{
                  'bg-emerald-100 text-emerald-800':
                    extraContent.status === 'active',
                  'bg-amber-100 text-amber-800':
                    extraContent.status === 'draft',
                  'bg-red-100 text-red-800': extraContent.status === 'archived',
                }"
              >
                {{ extraContent.status }}
              </span>
            </div>

            <!-- Title and description with enhanced typography -->
            <CardTitle
              class="text-5xl font-bold mb-6 text-gray-900 leading-tight"
            >
              {{ extraContent.name }}
            </CardTitle>
            <img
              v-if="extraContent?.img"
              :src="extraContent.img"
              :alt="extraContent.name"
              class="w-full h-auto object-cover rounded-lg mb-6"
            />
            <CardDescription class="text-2xl text-gray-600 leading-relaxed">
              {{ extraContent.description }}
            </CardDescription>
          </CardHeader>

          <!-- Main content with improved readability -->
          <CardContent class="p-8">
            <div v-if="extraContent.contentType === 'text'">
              <TextToSpeech :text="extraContent.content" />

              <Prose :html="extraContent.contentHtml" :max-height="0" />
            </div>

            <div
              v-else-if="extraContent.contentType === 'form'"
              class="space-y-6"
            >
              <p class="text-xl text-gray-600">Formulaire à implémenter</p>
            </div>
          </CardContent>
        </Card>

        <!-- Share buttons with refined styling -->
        <div class="flex justify-center gap-6">
          <Button
            size="lg"
            variant="outline"
            class="bg-white"
            @click="copyLink"
          >
            <Link class="w-5 h-5 mr-2" />
            Copier le lien
          </Button>
          <Button
            size="lg"
            variant="outline"
            class="bg-white"
            @click="sendEmail"
          >
            <Mail class="w-5 h-5 mr-2" />
            Partager par email
          </Button>
        </div>

        <!-- Metadata card with improved layout 
        <Card class="bg-white">
          <CardHeader class="p-8">
            <CardTitle class="text-2xl text-gray-900"
              >Informations additionnelles</CardTitle
            >
          </CardHeader>
          <CardContent class="p-8 pt-0">
            <dl class="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <dt class="text-base font-medium text-gray-600">Version</dt>
                <dd class="mt-2 text-lg text-gray-900">
                  {{ extraContent.metadata?.version || "1.0" }}
                </dd>
              </div>
              <div>
                <dt class="text-base font-medium text-gray-600">
                  Dernière modification
                </dt>
                <dd class="mt-2 text-lg text-gray-900">
                  {{ formatDate(extraContent.updatedAt) }}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        -->
      </div>

      <!-- Empty state -->
      <div
        v-else
        class="flex flex-col items-center justify-center min-h-[60vh]"
      >
        <p class="text-xl text-white/80">Aucun contenu trouvé</p>
      </div>
    </div>
    <PoweredBy />
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
