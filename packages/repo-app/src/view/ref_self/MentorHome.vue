<!-- HomePage.vue -->
<script setup>
import { ref } from "vue";
import { Book, User, BookOpen, ChevronRight, Rocket } from "lucide-vue-next";
import { Card } from "@/components/ui/card";
import { useRouter } from "vue-router";
import { useConversationStore } from "@/store/conversationStore";

// Props (if needed from parent)
const props = defineProps({
	session: Object,
	click: Function,
	patients: Array, // Add this line
});

const router = useRouter();

// Function to handle step click
const clickStep = (step) => {
	if (step.link) {
		router.push(step.link);
	} else if (step.click) {
		step.click(step);
	}
};

// Resources data
const resources = ref([
	{
		id: 1,
		title: "Guide de Bienvenue",
		link: "/blog/guide-de-bienvenue-et-d-utilisation-de-pushmd",
	},
	{
		id: 2,
		title: "Analyse émotionnelle ",
		link: "/blog/analyse-emotionnelle-avec-seflwise",
	},
	{
		id: 3,
		title: "L’Ère du Coaching Hybride",
		link: "/blog/l-ere-du-coaching-hybride",
	},
]);

// Steps data
const steps = ref([
	{
		id: 1,
		title: "Aperçu d’un client démo",
		description:
			"Découvrez un exemple de suivi réel et voyez comment Repo.md s’intègre à votre méthode.",
		action: "Découvrir",
		link: "/client",
		img: "https://static.repo.md/wiki/assets/img/Images-illustrations/Illustration-Repo.md-20-sm.jpeg",
	},
	{
		id: 2,
		title: "Consultez les activités personnalisées",
		description:
			"Initiez votre première action en proposant une activité sur mesure à un client.",
		action: "Découvrir",
		link: "/bibli",
		img: "https://static.repo.md/wiki/assets/img/Images-illustrations/Illustration-Repo.md-20-sm.jpeg",
	},
	{
		id: 3,
		title: "Découvrez l’IA Wiso de Repo.md",
		description:
			"Expérimentez le soutien quotidien de Wiso dans votre pratique.",
		action: "Découvrir",
		//  link: "/wiso",
		img: "https://static.repo.md/wiki/assets/img/Images-illustrations/Illustration-Repo.md-20-sm.jpeg",
		click: () => {
			// Open the chat bubble using toggleBubble from conversation store
			const conversationStore = useConversationStore();
			conversationStore.toggleBubble();
		},
	},
]);
</script>

<template>
  <div class="min-h-screen bg-crazy img1">
    <div class="container mx-auto px-4 py-8">
      <!-- Main content -->
      <!-- Header -->
      <div class="mb-8" style="max-width: 700px">
        <h1 class="text-3xl font-bold text-whiteNO mb-2">
          Bienvenue sur Repo.md
        </h1>
        <p class="text-xl">
          Unissez votre expertise humaine à la force d’une IA au service d’un
          coaching plus percutant.
        </p>
      </div>

      <div class="flex flex-col lg:flex-row gap-8">
        <!-- Left column -->
        <div class="w-full lg:w-2/3">
          <!-- Get started card -->
          <Card class="p-6 mb-8 shadow-sm">
            <h2 class="text-2xl font-semibold mb-2">
              Lancez votre premier accompagnement
            </h2>
            <p class="text-gray-500 mb-6">
              Invitez dès maintenant votre premier client et découvrez toute la
              puissance de Repo.md.
            </p>
            <router-link to="invite-client">
              <Button
                size="lg"
                class="text-xl flex items-center justify-center gap-2 w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-8 px-4 rounded-md transition-colors"
              >
                <Rocket class="w-5 h-5" />
                Démarrer un accompagnement
              </Button>
            </router-link>
          </Card>

          <Card class="p-6 mb-8 shadow-sm">
            <!-- Steps section -->
            <div class="mb-8">
              <h2 class="text-xl font-semibold mb-4">
                Prenez en main Repo.md en 3 étapes
              </h2>
              <p class="text-gray-500 mb-6">
                En trois étapes rapides, apprenez à suivre un client, découvrir
                les fonctions phares et explorer la puissance de Wiso.
              </p>

              <!-- Steps timeline -->
              <div class="relative">
                <div
                  class="absolute left-4 top-2 h-full w-0.5 bg-purple-200"
                ></div>

                <div
                  v-for="(step, index) in steps"
                  :key="step.id"
                  class="relative mb-8 pl-12"
                >
                  <div
                    class="absolute left-0 top-0 flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white"
                  >
                    <div class="w-3 h-3 rounded-full bg-white"></div>
                  </div>

                  <div class="p-6 border border-gray-200 rounded-lg bg-white">
                    <img
                      :src="step.img"
                      alt="Step image"
                      class="float-right"
                      style="wifth: 100px; height: 100px"
                    />
                    <div class="font-medium text-gray-500">
                      ÉTAPE {{ index + 1 }}
                    </div>
                    <h3 class="text-lg font-semibold mt-2">{{ step.title }}</h3>
                    <p class="text-gray-500 mt-1 mb-4">
                      {{ step.description }}
                    </p>
                    <Button
                      @click="clickStep(step)"
                      :href="step.link"
                      class="inline-block px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800 transition-colors"
                    >
                      {{ step.action }}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <!-- Right column - Resources -->
        <div class="w-full lg:w-1/3">
          <Card class="p-6 shadow-sm bg-white">
            <h2 class="text-xl font-semibold mb-2">Ressources</h2>
            <p class="text-gray-500 mb-6">
              Découvrez comment Repo.md révolutionne le coaching professionnel
            </p>

            <div class="space-y-4">
              <a
                v-for="resource in resources"
                :key="resource.id"
                :href="resource.link"
                class="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div class="flex items-center">
                  <BookOpen class="w-5 h-5 text-purple-600 mr-3" />
                  <span class="font-medium">{{ resource.title }}</span>
                </div>
                <ChevronRight class="w-5 h-5 text-gray-400" />
              </a>
            </div>
          </Card>

          <Card class="p-6 shadow-sm bg-white mt-9">
            <h2 class="text-xl font-semibold mb-2">
              Guide d’utilisation de Repo.md
            </h2>
            <p class="text-gray-500 mb-6">Visionnez la vidéo d’introduction</p>

            <div class="space-y-4">
              <YouTubePlayer
                videoId="xxx"
                title=""
                :controls="{
                  autoplay: false,
                  playsInline: true,
                  modestBranding: true,
                  showRelated: false,
                }"
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  </div>
  <BrochureFooter class=" " />
</template>

<style scoped>
/*
styles moved to styles.css for BG 
*/
</style>
