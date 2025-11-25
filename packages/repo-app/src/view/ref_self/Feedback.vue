// Feedback.vue
<script setup>
import { ref } from "vue";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	Mail,
	Send,
	ChevronLeft,
	ThumbsUp,
	Star,
	MessageSquare,
} from "lucide-vue-next";
import { useRouter } from "vue-router";

const router = useRouter();

// Form data
const feedbackForm = ref({
	name: "",
	email: "",
	category: "general",
	rating: 0,
	message: "",
});

const isSubmitting = ref(false);
const isSubmitted = ref(false);
const formError = ref("");

// Categories for feedback
const feedbackCategories = ref([
	{ id: "general", label: "Général" },
	{ id: "coaching", label: "Sessions de Coaching" },
	{ id: "platform", label: "Plateforme & Interface" },
	{ id: "billing", label: "Facturation" },
	{ id: "suggestion", label: "Suggestion d'Amélioration" },
]);

// Rating hover state
const hoverRating = ref(0);

// Set rating
const setRating = (rating) => {
	feedbackForm.value.rating = rating;
};

// Submit form handler
const submitFeedback = () => {
	// Form validation
	if (!feedbackForm.value.email) {
		formError.value = "Veuillez fournir votre email.";
		return;
	}

	if (!feedbackForm.value.message) {
		formError.value = "Veuillez fournir un message.";
		return;
	}

	// Reset error
	formError.value = "";

	// Mock form submission
	isSubmitting.value = true;

	// Simulate API call
	setTimeout(() => {
		isSubmitting.value = false;
		isSubmitted.value = true;

		// Reset form
		feedbackForm.value = {
			name: "",
			email: "",
			category: "general",
			rating: 0,
			message: "",
		};
	}, 1000);
};

// Back button functionality
const back = () => {
	router.back();
};
</script>

<template>
  <div style="background: #f1d7f7">
    <div class="container py-8 px-4">
      <div class="max-w-4xl mx-auto space-y-8">
        <!-- Header    <Button variant="outline" class="min-w-[150px]" @click="back">
            <ChevronLeft class="h-4 w-4 mr-2" />
            Retour
          </Button>-->
        <div class="space-y-4">
          <h1 class="text-3xl font-bold tracking-tight">Vos Commentaires</h1>
          <p class="text-muted-foreground">
            Nous apprécions vos retours d'expérience pour améliorer nos services
            et mieux répondre à vos besoins.
          </p>
        </div>

        <!-- Feedback Form -->
        <Card class="shadow-md" v-if="!isSubmitted">
          <CardHeader>
            <CardTitle>Partagez votre expérience</CardTitle>
            <CardDescription>
              Tous les champs marqués d'un * sont obligatoires.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form @submit.prevent="submitFeedback" class="space-y-6">
              <!-- Name & Email -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label for="name" class="text-sm font-medium">Nom</label>
                  <Input
                    id="name"
                    v-model="feedbackForm.name"
                    placeholder="Votre nom"
                  />
                </div>
                <div class="space-y-2">
                  <label for="email" class="text-sm font-medium">Email *</label>
                  <Input
                    id="email"
                    type="email"
                    v-model="feedbackForm.email"
                    placeholder="Votre email"
                    required
                  />
                </div>
              </div>

              <!-- Feedback Category -->
              <div class="space-y-2">
                <label for="category" class="text-sm font-medium"
                  >Catégorie</label
                >
                <select
                  id="category"
                  v-model="feedbackForm.category"
                  class="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option
                    v-for="category in feedbackCategories"
                    :key="category.id"
                    :value="category.id"
                  >
                    {{ category.label }}
                  </option>
                </select>
              </div>

              <!-- Rating -->
              <div class="space-y-2">
                <label class="text-sm font-medium">Évaluation</label>
                <div class="flex items-center gap-2">
                  <div
                    v-for="i in 5"
                    :key="i"
                    @mouseenter="hoverRating = i"
                    @mouseleave="hoverRating = 0"
                    @click="setRating(i)"
                    class="cursor-pointer p-1"
                  >
                    <Star
                      class="h-6 w-6"
                      :class="
                        i <= (hoverRating || feedbackForm.rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      "
                    />
                  </div>
                  <span class="text-sm text-muted-foreground ml-2">
                    {{
                      feedbackForm.rating > 0
                        ? `${feedbackForm.rating}/5`
                        : "Sélectionnez une note"
                    }}
                  </span>
                </div>
              </div>

              <!-- Message -->
              <div class="space-y-2">
                <label for="message" class="text-sm font-medium"
                  >Message *</label
                >
                <Textarea
                  id="message"
                  v-model="feedbackForm.message"
                  placeholder="Partagez vos commentaires, suggestions ou questions..."
                  rows="6"
                  required
                />
              </div>

              <!-- Error Message -->
              <div v-if="formError" class="text-red-500 text-sm">
                {{ formError }}
              </div>

              <!-- Submit Button -->
              <Button type="submit" class="w-full" :disabled="isSubmitting">
                <Send class="h-4 w-4 mr-2" />
                {{
                  isSubmitting
                    ? "Envoi en cours..."
                    : "Envoyer vos commentaires"
                }}
              </Button>
            </form>
          </CardContent>
        </Card>

        <!-- Success Message -->
        <Card class="shadow-md" v-if="isSubmitted">
          <CardContent class="pt-6 text-center">
            <div
              class="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4"
            >
              <ThumbsUp class="h-6 w-6 text-green-600" />
            </div>
            <h2 class="text-xl font-semibold mb-2">
              Merci pour vos commentaires!
            </h2>
            <p class="text-muted-foreground mb-6">
              Nous avons bien reçu votre message et nous vous répondrons dans
              les plus brefs délais.
            </p>
            <Button @click="isSubmitted = false"
              >Envoyer un autre commentaire</Button
            >
          </CardContent>
        </Card>

        <!-- Contact Information -->
        <Card class="shadow-md">
          <CardHeader>
            <CardTitle>Nous contacter directement</CardTitle>
            <CardDescription>
              Notre équipe est disponible pour répondre à vos questions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Mail class="h-6 w-6 text-primary" />
              <div>
                <h3 class="font-medium">Par email</h3>
                <p class="text-sm text-muted-foreground">
                  Envoyez-nous un email à
                  <a
                    href="mailto:feedback@repo.md"
                    class="text-primary font-medium"
                  >
                    feedback@repo.md
                  </a>
                </p>
              </div>
              <a href="mailto:feedback@repo.md" class="ml-auto">
                <Button variant="outline"> Envoyer un email </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        <!-- Additional Contact -->
        <Card class="shadow-md">
          <CardHeader>
            <CardTitle>Autres moyens de nous contacter</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="border rounded-lg p-4">
                <h3 class="font-medium mb-1 flex items-center gap-2">
                  <MessageSquare class="h-4 w-4 text-primary" />
                  Support Technique
                </h3>
                <p class="text-sm text-muted-foreground mb-2">
                  Pour toute question technique ou problème avec la plateforme
                </p>
                <a
                  href="mailto:support@repo.md"
                  class="text-primary text-sm font-medium"
                >
                  support@repo.md
                </a>
              </div>
              <div class="border rounded-lg p-4">
                <h3 class="font-medium mb-1 flex items-center gap-2">
                  <Star class="h-4 w-4 text-primary" />
                  Amélioration du Service
                </h3>
                <p class="text-sm text-muted-foreground mb-2">
                  Pour proposer de nouvelles fonctionnalités ou améliorations
                </p>
                <a
                  href="mailto:suggestions@repo.md"
                  class="text-primary text-sm font-medium"
                >
                  suggestions@repo.md
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- FAQ Section -->
        <Card class="shadow-md">
          <CardHeader>
            <CardTitle
              >Questions fréquentes sur les retours d'expérience</CardTitle
            >
          </CardHeader>
          <CardContent>
            <div class="space-y-4">
              <div class="border-b pb-3">
                <h3 class="font-medium mb-1">
                  Comment mon feedback sera-t-il utilisé?
                </h3>
                <p class="text-sm text-muted-foreground">
                  Vos commentaires nous aident à améliorer nos services et à
                  développer de nouvelles fonctionnalités. Nous les analysons
                  régulièrement pour identifier les points d'amélioration.
                </p>
              </div>
              <div class="border-b pb-3">
                <h3 class="font-medium mb-1">
                  Combien de temps avant d'obtenir une réponse?
                </h3>
                <p class="text-sm text-muted-foreground">
                  Nous nous efforçons de répondre à tous les messages dans un
                  délai de 48 heures ouvrables.
                </p>
              </div>
              <div>
                <h3 class="font-medium mb-1">
                  Mes informations personnelles sont-elles protégées?
                </h3>
                <p class="text-sm text-muted-foreground">
                  Oui, vos données sont traitées confidentiellement conformément
                  à notre politique de confidentialité et au RGPD.
                </p>
              </div>
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
</style>
