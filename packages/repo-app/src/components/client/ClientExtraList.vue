<!-- ClientExtraList.vue -->
<script setup>
import { ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { formatDistance } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Sprout, ChevronRight } from "lucide-vue-next";
import { useToast } from "@/components/ui/toast/use-toast";
import trpc from "@/trpc";
import CardTitle from "@/components/CardTitle.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuGroup,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import EmptyStateMsg from "@/components/EmptyStateMsg.vue";

const MAX_EXTRAS_SHOWN = 8;

const props = defineProps({
	patientId: {
		type: String,
		required: true,
	},
	patientDetails: {
		type: Object,
		required: true,
	},
});

const router = useRouter();
const route = useRoute();
const { toast } = useToast();

const selectedExtraTab = ref("suggere"); // Default tab
const showAllExtras = ref(false);
const generatingExtra = ref(false);

// Computed properties
const shownExtras = computed(() => {
	if (selectedExtraTab.value === "suggere") {
		// For suggested tab, show the extraConfigs (potential extras)
		return props.patientDetails.extraConfigs.slice(
			0,
			showAllExtras.value ? undefined : MAX_EXTRAS_SHOWN,
		);
	} else {
		// For utility tab, show the existing extras
		const ex = [...props.patientDetails.extras].reverse();
		return showAllExtras.value ? ex : ex.slice(0, MAX_EXTRAS_SHOWN);
	}
});

const hasMoreItems = computed(() => {
	if (selectedExtraTab.value === "suggere") {
		return props.patientDetails.extraConfigs.length > MAX_EXTRAS_SHOWN;
	} else {
		return props.patientDetails.extras.length > MAX_EXTRAS_SHOWN;
	}
});

// Methods
const timeAgo = function (date) {
	return formatDistance(new Date(date), new Date(), {
		addSuffix: true,
		locale: fr,
	});
};

const handleClickExtra = async (e) => {
	if (e.completed) {
		router.push(
			`/client/${props.patientId}/convo/${e?.lastCompletedConvo?.id}`,
		);
	} else {
		try {
			console.log("Copying invite link for activity:", e);

			toast({
				title: "Ça s'en vient!",
				description: "Création du contenu...",
			});
			generatingExtra.value = true;

			const generated = await trpc.generateExtra.query({
				patientId: props.patientId,
				extraConfigId: e.id,
				source: "mentor",
			});

			console.log("GENERATED", generated);
			generatingExtra.value = false;

			if (generated) {
				// well go to new extra url
				router.push(`/client/${props.patientId}/extra/${generated?.id}`);
			}
		} catch (err) {
			generatingExtra.value = false;
			toast({
				title: "Erreur",
				description: "Impossible de créer la ressource.",
				variant: "destructive",
			});
		}
	}
};

const handleCreateContent = () => {
	// Implementation for creating content
	console.log("Create content");
};

const handleViewExamples = () => {
	// Implementation for viewing examples
	console.log("View examples");
};

// Utility functions for PrettyContentListItem (similar to ClientActivityTable)
const getButtonText = () => {
	return "Créer";
};

const getButtonIcon = () => {
	return Plus;
};

const getStatus = () => {
	return "available";
};

const getTagColor = (item) => {
	return "putple"; // Default color
};

const getTagText = (item) => {
	return item.category;
};

const getTagIcon = () => {
	return null; // Default icon
};
</script>

<template>
  <div class="p-6 w-full">
    <CardTitle
      title="Guides et outils"
      :icon="Sprout"
      tooltipText="Les contenus que vous créez pour votre client, ou pour vous outiller"
    >
      <template #right>
        <div class="flex items-center gap-2">
          <Tabs v-model="selectedExtraTab" class="w-full">
            <TabsList>
              <TabsTrigger value="suggere">Suggéré</TabsTrigger>
              <TabsTrigger value="utilite">Utilité</TabsTrigger>
            </TabsList>
          </Tabs>

          <!-- Plus button -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button size="sm" class="flex items-center">
                <Plus class="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-56">
              <DropdownMenuLabel>Choisir un type d'extra</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  v-for="config in patientDetails.extraConfigs"
                  :key="config.id"
                  @click="handleClickExtra(config)"
                >
                  <FileText class="mr-2 h-4 w-4" />
                  <span>{{ config.name }}</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </template>
    </CardTitle>

    <!-- Added descriptive paragraph below CardTitle -->
    <p class="text-sm text-muted-foreground mt-2 mb-4">
      En lien avec la sensibilité émotionnelle de votre client et son besoin
      d’équilibre, ces outils peuvent favoriser l’ancrage, la régulation et
      l’écoute intérieure.
    </p>

    <div>
      <!-- Suggéré tab content - using PrettyContentListItem -->
      <div v-if="selectedExtraTab === 'suggere'" class="space-y-4">
        <PrettyContentListItem
          v-for="config in shownExtras"
          :key="config.id"
          :title="config.name"
          :img="config.img"
          :status="getStatus(config)"
          :tag-text="getTagText(config)"
          :tag-color="getTagColor(config)"
          :tag-icon="getTagIcon(config)"
          :button-text="getButtonText(config)"
          :button-icon="getButtonIcon(config)"
          :active="false"
          :disabled="false"
          @click="handleClickExtra(config)"
        />

        <Button
          size="sm"
          variant="secondary"
          v-if="hasMoreItems && !showAllExtras"
          @click="showAllExtras = !showAllExtras"
          class="w-full"
        >
          Voir tout...
        </Button>
      </div>

      <!-- Utilité tab content - existing grid layout -->
      <div v-if="selectedExtraTab === 'utilite'">
        <EmptyStateMsg
          v-if="!shownExtras.length"
          title="Partagez un extra pour Bob"
          description="Les petits partages font une grande différence. En quelques secondes seulement, vous pouvez partager une ressource qui pourrait être exactement ce dont Bob a besoin aujourd'hui. Un article intéressant, un exercice utile, ou même une simple idée peuvent avoir un impact significatif sur son parcours d'apprentissage."
          :primaryCta="{
            label: 'Créer un contenu',
            onClick: handleCreateContent,
          }"
          :secondaryCta="{
            label: 'Voir des exemples',
            onClick: handleViewExamples,
          }"
        />

        <div
          v-if="shownExtras.length"
          class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4"
        >
          <router-link
            v-for="extra in shownExtras"
            :key="extra.id"
            :to="`/client/${patientDetails.id}/extra/${extra.id}`"
            class="block"
          >
            <div
              class="p-4 rounded-lg border transition-all duration-200 hover:shadow-md cursor-pointer"
              :class="{
                'bg-primary/5 border-primary':
                  route.params.extraId === extra.id,
                'hover:bg-accent': route.params.extraId !== extra.id,
              }"
            >
              <div class="flex flex-col items-center text-center">
                <FileText
                  class="w-12 h-12 mb-2"
                  :class="
                    route.params.extraId === extra.id
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  "
                />
                <h3 class="font-medium text-sm line-clamp-2">
                  {{ extra.name }}
                </h3>
                <span class="text-xs text-muted-foreground mt-1">{{
                  timeAgo(extra.createdAt)
                }}</span>
              </div>
            </div>
          </router-link>
        </div>

        <div class="mt-4" v-if="hasMoreItems && !showAllExtras">
          <Button
            size="sm"
            variant="secondary"
            @click="showAllExtras = !showAllExtras"
            class="w-full"
          >
            Voir tous les extras
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
