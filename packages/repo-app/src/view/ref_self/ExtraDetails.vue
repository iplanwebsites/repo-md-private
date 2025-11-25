<!-- ExtraDetails.vue -->
<script setup>
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { formatDistance } from "date-fns";
import { fr } from "date-fns/locale";
import { useMeetingStore } from "@/store/meetingStore";

import trpc from "@/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	FileText,
	User,
	Calendar,
	Tag,
	ArrowLeft,
	Share,
	Edit,
	Trash2,
} from "lucide-vue-next";
import { useToast } from "@/components/ui/toast/use-toast";

const route = useRoute();
const router = useRouter();
const { toast } = useToast();

// State
const loading = ref(true);
const extra = ref(null);
const clients = ref([]);

// Modal state
const showShareModal = ref(false);
const selectedClient = ref("");
const customInstructions = ref("");
const processingRequest = ref(false);

// Methods
const fetchExtraDetails = async () => {
	try {
		loading.value = true;
		const extraId = route.params.id;
		// Replace with actual API call
		const data = await trpc.getExtraDetails.query({ extraId });
		extra.value = data;
	} catch (error) {
		console.error("Error fetching extra details:", error);
		toast({
			title: "Erreur",
			description: "Impossible de charger les détails de l'extra",
			variant: "destructive",
		});
	} finally {
		loading.value = false;
	}
};

const fetchClients = () => {
	try {
		const meetingStore = useMeetingStore();
		clients.value = meetingStore.patients;
	} catch (error) {
		console.error("Error getting clients from store:", error);
	}
};

const openShareModal = () => {
	selectedClient.value = "";
	customInstructions.value = "";
	showShareModal.value = true;
};

const closeModal = () => {
	showShareModal.value = false;
};

const shareExtra = async () => {
	if (!selectedClient.value) {
		toast({
			title: "Information requise",
			description: "Veuillez sélectionner un client",
			variant: "destructive",
		});
		return;
	}

	try {
		processingRequest.value = true;

		// Replace with actual API call
		const generated = await trpc.generateExtra.query({
			patientId: selectedClient.value,
			extraConfigId: extra.value.id,
			source: "mentor",
			customInstructions: customInstructions.value,
		});

		closeModal();

		toast({
			title: "Extra partagé",
			description: "L'extra a été partagé avec succès",
		});

		// Navigate to the generated extra
		if (generated) {
			router.push(`/client/${selectedClient.value}/extra/${generated?.id}`);
		}
	} catch (error) {
		console.error("Error sharing extra:", error);
		toast({
			title: "Erreur",
			description: "Impossible de partager l'extra",
			variant: "destructive",
		});
	} finally {
		processingRequest.value = false;
	}
};

const deleteExtra = async () => {
	if (!confirm("Êtes-vous sûr de vouloir supprimer cet extra ?")) {
		return;
	}

	try {
		await trpc.deleteExtra.mutate({ extraId: extra.value.id });

		toast({
			title: "Extra supprimé",
			description: "L'extra a été supprimé avec succès",
		});

		router.push("/extras");
	} catch (error) {
		console.error("Error deleting extra:", error);
		toast({
			title: "Erreur",
			description: "Impossible de supprimer l'extra",
			variant: "destructive",
		});
	}
};

const editExtra = () => {
	router.push(`/extras/edit/${extra.value.id}`);
};

const timeAgo = (date) => {
	return formatDistance(new Date(date), new Date(), {
		addSuffix: true,
		locale: fr,
	});
};

const goBack = () => {
	router.push("/extras");
};

// Lifecycle
onMounted(() => {
	fetchExtraDetails();
	fetchClients();
});
</script>

<template>
  <div class="container mx-auto p-6" style="background: #f9f4ff">
    <!-- Back button -->
    <Button variant="ghost" class="mb-4" @click="goBack">
      <ArrowLeft class="w-4 h-4 mr-2" />
      Retour à la bibliothèque
    </Button>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-96">
      <div
        class="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"
      ></div>
    </div>

    <!-- Error State -->
    <div v-else-if="!extra" class="text-center py-12">
      <FileText class="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">Extra introuvable</h3>
      <p class="text-muted-foreground mt-2">
        Cet extra n'existe pas ou a été supprimé.
      </p>
      <Button @click="goBack" variant="outline" class="mt-4">
        Retourner à la bibliothèque
      </Button>
    </div>

    <!-- Extra Details -->
    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Left Column: Main Info -->
      <div class="md:col-span-2">
        <Card>
          <CardHeader>
            <div class="flex justify-between items-start">
              <CardTitle class="text-2xl font-bold">{{ extra.name }}</CardTitle>
              <div class="flex gap-2">
                <Button variant="outline" size="icon" @click="editExtra">
                  <Edit class="h-4 w-4" />
                </Button>
                <Button variant="destructive" size="icon" @click="deleteExtra">
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <!-- Description -->
            <div class="mb-6">
              <h3 class="text-lg font-semibold mb-2">Description</h3>
              <p class="text-muted-foreground">
                {{ extra.description || "Aucune description disponible" }}
              </p>
            </div>

            <!-- Content Preview -->
            <div class="mb-6">
              <h3 class="text-lg font-semibold mb-2">Aperçu du contenu</h3>
              <div class="p-4 bg-accent rounded-lg">
                <div
                  v-if="extra.contentPreview"
                  v-html="extra.contentPreview"
                ></div>
                <p v-else class="text-muted-foreground italic">
                  Aperçu non disponible
                </p>
              </div>
            </div>

            <!-- Tags -->
            <div v-if="extra.tags && extra.tags.length" class="mb-6">
              <h3 class="text-lg font-semibold mb-2">Tags</h3>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="tag in extra.tags"
                  :key="tag"
                  class="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm"
                >
                  {{ tag }}
                </span>
              </div>
            </div>

            <!-- Share Button -->
            <Button class="w-full" @click="openShareModal">
              <Share class="w-4 h-4 mr-2" />
              Partager avec un client
            </Button>
          </CardContent>
        </Card>
      </div>

      <!-- Right Column: Metadata -->
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="space-y-4">
              <!-- Category -->
              <div class="flex items-center gap-3">
                <FileText class="w-5 h-5 text-muted-foreground" />
                <div>
                  <p class="text-sm text-muted-foreground">Catégorie</p>
                  <p class="font-medium">
                    {{ extra.category || "Non catégorisé" }}
                  </p>
                </div>
              </div>

              <!-- Created At -->
              <div class="flex items-center gap-3">
                <Calendar class="w-5 h-5 text-muted-foreground" />
                <div>
                  <p class="text-sm text-muted-foreground">Créé</p>
                  <p class="font-medium">{{ timeAgo(extra.createdAt) }}</p>
                </div>
              </div>

              <!-- Created By -->
              <div class="flex items-center gap-3">
                <User class="w-5 h-5 text-muted-foreground" />
                <div>
                  <p class="text-sm text-muted-foreground">Créé par</p>
                  <p class="font-medium">{{ extra.createdBy || "Système" }}</p>
                </div>
              </div>

              <!-- Usage Stats -->
              <div class="mt-6 pt-4 border-t">
                <h3 class="font-medium mb-2">Statistiques d'utilisation</h3>
                <div class="space-y-2">
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">Partagé</span>
                    <span class="font-medium"
                      >{{ extra.shareCount || 0 }} fois</span
                    >
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">Consultations</span>
                    <span class="font-medium">{{ extra.viewCount || 0 }}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- Share Modal -->
    <Dialog :open="showShareModal" @update:open="showShareModal = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Partager "{{ extra?.name }}"</DialogTitle>
          <DialogDescription>
            Choisissez le client avec qui vous souhaitez partager cet extra
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-4">
          <Select v-model="selectedClient">
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="client in clients"
                :key="client.id"
                :value="client.id"
              >
                {{ client.name }}
              </SelectItem>
            </SelectContent>
          </Select>

          <div>
            <p class="text-sm font-medium mb-2">
              Instructions personnalisées (optionnel)
            </p>
            <Textarea
              v-model="customInstructions"
              placeholder="Ajoutez des instructions spécifiques pour ce client..."
              class="w-full"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="closeModal"
            :disabled="processingRequest"
          >
            Annuler
          </Button>
          <Button
            @click="shareExtra"
            :disabled="processingRequest || !selectedClient"
          >
            <span v-if="processingRequest" class="flex items-center gap-2">
              <div
                class="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"
              ></div>
              Traitement...
            </span>
            <span v-else>Partager</span>
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

.bg-accent {
  background-color: hsl(var(--accent));
}
</style>
