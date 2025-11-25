<script setup>
import { ref, computed, onMounted } from "vue";
import trpc from "@/trpc";
import { useRouter, useRoute } from "vue-router";
import { formatDistance } from "date-fns";
import { fr } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const router = useRouter();
const route = useRoute();
const loading = ref(true);
const error = ref(null);

// Get activity ID from route params
const inviteToken = computed(() => route.params.id);

// Activity data state
/*
const activityData = ref({
  activityName: "",
  activityDescription: "",
  introImg: "",
  invite: {
    senderName: "",
    created: new Date(),
  },
});
*/
// Format the time ago string
const timeAgo = computed(() => {
	const c = activityDetails.value?.token?.inviteTokenCreated;
	if (!c) return "";
	return formatDistance(c, new Date(), {
		addSuffix: true,
		locale: fr,
	});
});

// Fetch activity data on component mount
onMounted(async () => {
	try {
		loading.value = true;
		const data = await trpc.getActivityInfoFromInviteToken.query({
			inviteToken: inviteToken.value,
		});
		activityData.value = data;
	} catch (err) {
		error.value = "Une erreur s'est produite lors du chargement de l'activité";
		console.error("Error fetching activity:", err);
	} finally {
		loading.value = false;
	}
});

const handleStart = async () => {
	try {
		loading.value = true;
		// Get conversation ID from server
		const { conversationId, activityType } =
			await trpc.startActivityInfoFromInviteToken.query({
				inviteToken: inviteToken.value,
			});

		// Navigate to conversation page
		// router.push(`/convo/${conversationId}`);
		router.push(`/${activityType}-activity/${conversationId}`);
	} catch (err) {
		error.value = "Une erreur s'est produite lors du démarrage de l'activité";
		console.error("Error starting activity:", err);
	} finally {
		loading.value = false;
	}
};

// Get activity ID from route params

// Fetch activity data on component mount
const activityDetails = ref({});
onMounted(async () => {
	try {
		loading.value = true;
		const data = await trpc.getActivityInfoFromInviteToken.query({
			inviteToken: inviteToken.value,
		});
		activityDetails.value = data;
	} catch (err) {
		error.value = "Une erreur s'est produite lors du chargement de l'activité";
		console.error("Error fetching activity:", err);
	} finally {
		loading.value = false;
	}
});

const activityData = computed(() => activityDetails.value.activity);
</script>

<template>
  <JsonDebug :data="activityDetails" :expanded="false" />

  <div class="container mx-auto py-8">
    <Card class="max-w-2xl mx-auto">
      <!-- Loading State -->
      <div v-if="loading" class="p-6 text-center">
        <div
          class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"
        ></div>
        <p class="mt-4 text-gray-600">Chargement de l'activité...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="p-6 text-center">
        <p class="text-red-600">{{ error }}</p>
        <Button @click="router.go(0)" variant="outline" class="mt-4">
          Réessayer
        </Button>
      </div>

      <!-- Content -->
      <div v-else class="space-y-6 p-6">
        <!-- Activity Image -->
        <img
          v-if="activityData.introImg"
          :src="activityData.introImg"
          :alt="activityData.activityName"
          class="w-full rounded-lg object-cover h-48"
        />

        <!-- Activity Title -->
        <h1 class="text-3xl font-bold text-center">
          {{ activityData.activityName }}
        </h1>

        <!-- Invite Information -->
        <p class="text-center text-gray-600">
          Cette invitation vous a été envoyée par
          <span class="font-semibold">{{ "votre coach" }}</span
          >,
          {{ timeAgo }}
        </p>

        <!-- Activity Description -->
        <p class="text-lg text-center text-gray-700">
          {{ activityData.activityDesc }}
        </p>

        <!-- Start Button -->
        <div class="flex justify-center pt-4">
          <Button
            @click="handleStart"
            size="lg"
            class="px-8 py-4 text-lg"
            :disabled="loading"
          >
            {{ loading ? "Démarrage..." : "Commencer l'activité" }}
          </Button>
        </div>
      </div>
    </Card>
  </div>

  <Card
    class="max-w-2xl mx-auto mt-6 p-4 text-sm text-gray-600 bg-gray-100 border border-gray-300"
  >
    <p>
      <strong>Note importante :</strong> Repo.md vous guide dans votre parcours,
      mais ne remplace pas un professionnel de santé qualifié. En cas de
      détresse psychologique, composez immédiatement le <strong>811</strong>, un
      service <strong>psychosocial et confidentiel</strong>, accessible
      <strong>24 heures sur 24, 7 jours sur 7</strong>.
    </p>
    <p class="mt-2">
      Pour clavarder ou texter avec un intervenant, d’autres ressources sont
      aussi disponibles sur
      <a
        href="https://suicide.ca/fr"
        target="_blank"
        class="text-blue-600 underline"
      >
        suicide.ca</a
      >.
    </p>
  </Card>

  <PoweredBy />
</template>
