<script setup>
import { ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { Loader2 } from "lucide-vue-next";
import trpc from "@/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { useForm } from "vee-validate";

const router = useRouter();
const route = useRoute();
const inviteToken = computed(() => route.params.id);

const objectifsOptions = [
	{ id: "productivite", label: "Productivité" },
	{ id: "stress", label: "Gestion du stress" },
	{ id: "developpement", label: "Développement personnel" },
	{ id: "leadership", label: "Leadership" },
	{ id: "communication", label: "Communication" },
];

const personaliteOptions = [
	{ id: "creatif", label: "Créatif" },
	{ id: "analytique", label: "Analytique" },
	{ id: "introverti", label: "Introverti" },
	{ id: "extraverti", label: "Extraverti" },
	{ id: "pratique", label: "Pratique" },
];

// Define validation using vee-validate's built-in validation
const { handleSubmit, isSubmitting, values, defineField } = useForm({
	initialValues: {
		name: "",
		ageRange: "",
		email: "",
		phone: "",
		job: "",
		localisation: "",
		education: "",
		spokenLang: "",
		objectifs: [],
		typePersonnalite: [],
		forces: "",
		opportunites: "",
	},
	// Validation using vee-validate's native validation functions
	validationSchema: {
		name: (value) => {
			if (!value || value.trim() === "") return "Le nom est requis";
			return true;
		},
		ageRange: (value) => {
			if (!value || value.trim() === "") return "La tranche d'âge est requise";
			return true;
		},
		email: (value) => {
			if (!value) return "L'email est requis";
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(value)) return "Email invalide";
			return true;
		},
		phone: (value) => {
			if (!value) return "Le numéro de téléphone est requis";
			const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
			if (!phoneRegex.test(value))
				return "Format de téléphone canadien invalide";
			return true;
		},
		job: (value) => {
			if (!value || value.trim() === "")
				return "Le statut professionnel est requis";
			return true;
		},
		localisation: (value) => {
			if (!value || value.trim() === "")
				return "Le lieu géographique est requis";
			return true;
		},
		education: (value) => {
			if (!value || value.trim() === "")
				return "Le niveau d'éducation est requis";
			return true;
		},
		spokenLang: (value) => {
			if (!value || value.trim() === "")
				return "Les langues parlées sont requises";
			return true;
		},
		objectifs: (value) => {
			if (!value || !Array.isArray(value) || value.length === 0)
				return "Sélectionnez au moins un objectif";
			return true;
		},
		typePersonnalite: (value) => {
			if (!value || !Array.isArray(value) || value.length === 0)
				return "Sélectionnez au moins un type de personnalité";
			return true;
		},
	},
});

const onSubmit = handleSubmit(async (formValues) => {
	try {
		const sending = {
			...formValues,
			inviteToken: inviteToken.value,
		};
		const res = await trpc.patientProgramSignup.query(sending);
		toast({
			title: "Succès!",
			description: "Votre profil a été envoyé avec succès.",
		});
		router.push("/debuter/merci");
	} catch (error) {
		toast({
			title: "Erreur",
			description: "Une erreur est survenue lors de l'envoi du formulaire.",
			variant: "destructive",
		});
		console.error("Erreur:", error);
	}
});
</script>

<template>
  <div class="container mx-auto py-8">
    <Card class="max-w-2xl mx-auto p-6">
      <!-- Logo component at the top -->
      <div class="flex justify-center mb-6">
        <Logotype />
      </div>

      <h1 class="text-2xl font-bold mb-3">Inscription Préliminaire</h1>

      <!-- Short disclaimer about data security -->
      <div class="bg-blue-50 p-4 rounded-md mb-6">
        <p class="text-sm text-blue-800">
          <strong>Protection de vos données:</strong> Toutes les informations
          fournies sont sécurisées et traitées confidentiellement selon les
          normes canadiennes de protection des données. Vos renseignements ne
          seront jamais partagés avec des tiers sans votre consentement
          explicite.
        </p>
      </div>

      <form @submit="onSubmit" class="space-y-6">
        <div class="space-y-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField name="name" v-slot="{ value, handleChange, errors }">
              <FormItem>
                <FormLabel>Nom complet</FormLabel>
                <FormControl>
                  <Input
                    :value="value"
                    @update:modelValue="handleChange"
                    placeholder="Alex Dupont"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField name="ageRange" v-slot="{ value, handleChange }">
              <FormItem>
                <FormLabel>Tranche d'âge</FormLabel>
                <FormControl>
                  <Input
                    :value="value"
                    @update:modelValue="handleChange"
                    placeholder="25-34 ans"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField name="email" v-slot="{ value, handleChange }">
              <FormItem>
                <FormLabel>Courriel</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    :value="value"
                    @update:modelValue="handleChange"
                    placeholder="moi@email.com"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField name="phone" v-slot="{ value, handleChange }">
              <FormItem>
                <FormLabel>Téléphone</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    :value="value"
                    @update:modelValue="handleChange"
                    placeholder="514-123-4567"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>

          <FormField name="job" v-slot="{ value, handleChange }">
            <FormItem>
              <FormLabel>Statut professionnel</FormLabel>
              <FormControl>
                <Input
                  :value="value"
                  @update:modelValue="handleChange"
                  placeholder="Entrepreneur"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField name="localisation" v-slot="{ value, handleChange }">
            <FormItem>
              <FormLabel>Lieu géographique</FormLabel>
              <FormControl>
                <Input
                  :value="value"
                  @update:modelValue="handleChange"
                  placeholder="Montréal, Québec"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField name="education" v-slot="{ value, handleChange }">
            <FormItem>
              <FormLabel>Niveau d'éducation</FormLabel>
              <FormControl>
                <Input
                  :value="value"
                  @update:modelValue="handleChange"
                  placeholder="Baccalauréat en Administration des Affaires"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField name="spokenLang" v-slot="{ value, handleChange }">
            <FormItem>
              <FormLabel>Langues parlées</FormLabel>
              <FormControl>
                <Input
                  :value="value"
                  @update:modelValue="handleChange"
                  placeholder="Français, Anglais"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <!-- Objectifs -->
          <FormField name="objectifs">
            <FormItem>
              <div class="mb-4">
                <FormLabel class="text-base"
                  >Objectifs principaux avec Repo.md</FormLabel
                >
                <FormDescription>
                  Sélectionnez vos objectifs principaux.
                </FormDescription>
              </div>
              <FormField
                v-for="objectif in objectifsOptions"
                v-slot="{ value, handleChange }"
                :key="objectif.id"
                type="checkbox"
                :value="objectif.id"
                :unchecked-value="false"
                name="objectifs"
              >
                <FormItem class="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      :checked="value.includes(objectif.id)"
                      @update:checked="handleChange"
                    />
                  </FormControl>
                  <FormLabel class="font-normal">
                    {{ objectif.label }}
                  </FormLabel>
                </FormItem>
              </FormField>
              <FormMessage />
            </FormItem>
          </FormField>

          <!-- Type de personnalité -->
          <FormField name="typePersonnalite">
            <FormItem>
              <div class="mb-4">
                <FormLabel class="text-base">Type de personnalité</FormLabel>
                <FormDescription>
                  Sélectionnez les traits qui vous correspondent.
                </FormDescription>
              </div>
              <FormField
                v-for="type in personaliteOptions"
                v-slot="{ value, handleChange }"
                :key="type.id"
                type="checkbox"
                :value="type.id"
                :unchecked-value="false"
                name="typePersonnalite"
              >
                <FormItem class="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      :checked="value.includes(type.id)"
                      @update:checked="handleChange"
                    />
                  </FormControl>
                  <FormLabel class="font-normal">
                    {{ type.label }}
                  </FormLabel>
                </FormItem>
              </FormField>
              <FormMessage />
            </FormItem>
          </FormField>

          <!-- Forces -->
          <FormField name="forces" v-slot="{ value, handleChange }">
            <FormItem>
              <FormLabel>Forces</FormLabel>
              <FormControl>
                <Textarea
                  :value="value"
                  @update:modelValue="handleChange"
                  placeholder="Décrivez vos principales forces..."
                  rows="3"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <!-- Opportunités -->
          <FormField name="opportunites" v-slot="{ value, handleChange }">
            <FormItem>
              <FormLabel>Opportunités</FormLabel>
              <FormControl>
                <Textarea
                  :value="value"
                  @update:modelValue="handleChange"
                  placeholder="Décrivez les opportunités de développement..."
                  rows="3"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>

        <Button type="submit" class="w-full" :disabled="isSubmitting">
          <Loader2 v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" />
          {{ isSubmitting ? "Envoi en cours..." : "Envoyer le profil" }}
        </Button>
      </form>
    </Card>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
