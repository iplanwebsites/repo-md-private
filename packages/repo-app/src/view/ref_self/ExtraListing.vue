<!-- ExtraListing.vue -->
<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { formatDistance } from "date-fns";
import { fr } from "date-fns/locale";
import { useMeetingStore } from "@/store/meetingStore";

import trpc from "@/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { FileText, Search, Filter, Plus, X } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast/use-toast";

const router = useRouter();
const { toast } = useToast();

// State
const loading = ref(true);
const extras = ref([]);
const categories = ref([]);
const clients = ref([]);
const searchQuery = ref("");
const selectedCategory = ref("all");

// Modal state
const showExtraModal = ref(false);
const selectedExtra = ref(null);
const selectedClient = ref("");
const customInstructions = ref("");
const processingRequest = ref(false);

// Filters and computed values
const filteredExtras = computed(() => {
	let filtered = extras.value;

	// Filter by category
	if (selectedCategory.value !== "all") {
		filtered = filtered.filter(
			(extra) => extra.category === selectedCategory.value,
		);
	}

	// Filter by search query
	if (searchQuery.value.trim()) {
		const query = searchQuery.value.toLowerCase();
		filtered = filtered.filter(
			(extra) =>
				extra.name.toLowerCase().includes(query) ||
				(extra.description &&
					extra.description.toLowerCase().includes(query)) ||
				(extra.tags &&
					extra.tags.some((tag) => tag.toLowerCase().includes(query))),
		);
	}

	return filtered;
});

// Methods
const fetchExtras = async () => {
	try {
		loading.value = true;
		// Replace with actual API call
		const data = await trpc.listExtras.query();
		extras.value = data;

		// Extract unique categories
		const uniqueCategories = [...new Set(data.map((extra) => extra.category))];
		categories.value = uniqueCategories;
	} catch (error) {
		console.error("Error fetching extras:", error);
		toast({
			title: "Erreur",
			description: "Impossible de charger les extras",
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

const openExtra = (extra) => {
	selectedExtra.value = extra;
	selectedClient.value = "";
	customInstructions.value = "";
	showExtraModal.value = true;
};

const closeModal = () => {
	showExtraModal.value = false;
	selectedExtra.value = null;
};

const sendExtra = async () => {
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
			extraConfigId: selectedExtra.value.id,
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
		console.error("Error sending extra:", error);
		toast({
			title: "Erreur",
			description: "Impossible de partager l'extra",
			variant: "destructive",
		});
	} finally {
		processingRequest.value = false;
	}
};

const timeAgo = (date) => {
	return formatDistance(new Date(date), new Date(), {
		addSuffix: true,
		locale: fr,
	});
};

const viewExtraDetails = (extraId) => {
	router.push(`/extras/${extraId}`);
};

// Lifecycle
onMounted(() => {
	fetchExtras();
	fetchClients();
});
</script>

<template>
  <div class="container mx-auto p-6">
    <!-- Page Header    <h1 class="text-3xl font-bold">Bibliothèque d'Extras ✨</h1> -->
    <div class="mb-7">
      <h2 class="text-2xl font-bold text-gray-900">
        Guides et ressources personnalisés
      </h2>
      <h3 class="text-lg text-gray-700 mt-2">
        Développez des plans d’action sur mesure pour soutenir la progression de
        vos clients.
      </h3>
      <p class="italic text-gray-600 mt-4 border-l-4 border-blue-500 pl-4">
        « Des documents prêts à générer, pensés pour accélérer la réussite de
        chacun. »
      </p>
      <p class="mt-2 text-gray-800">
        Choisissez un client et créez automatiquement des feuilles de route
        concrètes.
      </p>
    </div>

    <!-- Filters -->
    <div class="flex flex-col md:flex-row gap-4 mb-6">
      <div class="relative flex-grow">
        <Search
          class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
        />
        <Input
          v-model="searchQuery"
          placeholder="Rechercher par nom, description ou tags..."
          class="pl-10 w-full"
        />
      </div>

      <Select v-model="selectedCategory">
        <SelectTrigger class="w-full md:w-[200px]">
          <SelectValue placeholder="Toutes les catégories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes les catégories</SelectItem>
          <SelectItem
            v-for="category in categories"
            :key="category"
            :value="category"
          >
            {{ category }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-96">
      <div
        class="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"
      ></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredExtras.length === 0" class="text-center py-12">
      <FileText class="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">Aucun extra trouvé</h3>
      <p class="text-muted-foreground mt-2">
        Aucun extra ne correspond à vos critères de recherche.
      </p>
      <Button
        @click="
          searchQuery = '';
          selectedCategory = 'all';
        "
        variant="outline"
        class="mt-4"
      >
        Réinitialiser les filtres
      </Button>
    </div>

    <!-- Extras Grid -->
    <div
      v-else
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
    >
      <div
        v-for="extra in filteredExtras"
        :key="extra.id"
        class="cursor-pointer"
        @click="openExtra(extra)"
      >
        <Card
          class="overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer"
        >
          <div class="relative">
            <img
              v-if="extra.img"
              :src="extra.img"
              :alt="extra.name"
              class="w-full h-32 object-cover"
            />
            <div
              v-else
              class="w-full h-32 bg-gray-100 flex items-center justify-center"
            >
              <FileText class="w-12 h-12 text-gray-400" />
            </div>
            
            <div
              v-if="extra.category"
              class="absolute top-2 right-2"
            >
              <Badge
                class="text-xs font-normal"
              >
                {{ extra.category }}
              </Badge>
            </div>
          </div>
          
          <div class="p-4">
            <h3 class="font-medium line-clamp-1">
              {{ extra.name }}
            </h3>
            <p
              v-if="extra.description"
              class="text-sm text-muted-foreground mt-2 line-clamp-2"
            >
              {{ extra.description }}
            </p>
            <div
              v-if="extra.tags && extra.tags.length"
              class="flex flex-wrap gap-1 mt-3"
            >
              <span
                v-for="tag in extra.tags"
                :key="tag"
                class="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary"
              >
                {{ tag }}
              </span>
            </div>
            <span
              v-if="extra.createdAt"
              class="text-xs text-muted-foreground mt-2 block"
            >
              {{ timeAgo(extra.createdAt) }}
            </span>
          </div>
        </Card>
      </div>
    </div>

    <!-- Extra Modal -->
    <Dialog :open="showExtraModal" @update:open="showExtraModal = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Partager "{{ selectedExtra?.name }}"</DialogTitle>
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
            @click="sendExtra"
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
