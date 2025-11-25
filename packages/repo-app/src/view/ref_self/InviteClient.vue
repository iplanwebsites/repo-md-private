// InviteClient.vue
<script setup>
import { ref, onMounted } from "vue";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Check, RefreshCw } from "lucide-vue-next";
import { useToast } from "@/components/ui/toast/use-toast";
import trpc from "@/trpc";

const inviteLink = ref("");
const hasCopied = ref(false);
const isLoading = ref(false);
const { toast } = useToast();

async function createInviteToken() {
	try {
		isLoading.value = true;
		const token = await trpc.createInviteToken.query({
			program: "general",
			activity: null,
			patientEmail: null,
		});

		return `${window.location.origin}/debuter/${token}`;
	} catch (error) {
		console.error("Error generating token:", error);
		toast({
			title: "Erreur",
			description: "Impossible de générer le lien. Veuillez réessayer.",
			variant: "destructive",
		});
		return null;
	} finally {
		isLoading.value = false;
	}
}

// Initialize the invite link when component mounts
onMounted(async () => {
	const link = await createInviteToken();
	if (link) {
		inviteLink.value = link;
	}
});

async function copyLink() {
	try {
		await navigator.clipboard.writeText(inviteLink.value);
		hasCopied.value = true;

		toast({
			title: "Lien copié !",
			description:
				"Le lien d'invitation a été copié dans votre presse-papiers.",
			duration: 3000,
		});

		setTimeout(() => {
			hasCopied.value = false;
		}, 3000);
	} catch (err) {
		toast({
			title: "Erreur",
			description: "Impossible de copier le lien. Veuillez réessayer.",
			variant: "destructive",
		});
	}
}

// Updated to use token-based generation
async function generateNewLink() {
	const newLink = await createInviteToken();
	if (newLink) {
		inviteLink.value = newLink;
		toast({
			title: "Nouveau lien généré",
			description: "Un nouveau lien d'invitation a été créé.",
		});
	}
}
</script>

<template>
  <div class="container mx-auto py-8 px-4">
    <div class="max-w-2xl mx-auto space-y-8">
      <ClientBread :invite="1" />
      <!-- En-tête de la page -->
      <div class="space-y-4">
        <h1 class="text-3xl font-bold tracking-tight">Ajouter un client</h1>
        <p class="text-muted-foreground">
          Invitez vos clients à rejoindre votre espace de coaching en leur
          partageant un lien d'inscription personnalisé.
        </p>
      </div>

      <!-- Carte principale avec le lien d'invitation -->
      <Card class="shadow-lg">
        <CardHeader>
          <CardTitle>Lien d'invitation</CardTitle>
          <CardDescription>
            Partagez ce lien avec votre client pour lui permettre de remplir le
            formulaire d'inscription.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="flex gap-2">
            <div class="relative flex-grow">
              <Input
                readonly
                :value="inviteLink"
                class="pr-24 font-mono text-sm"
                placeholder="Génération du lien..."
                :disabled="isLoading"
              />
              <Button
                variant="ghost"
                size="sm"
                class="absolute right-0 top-0 h-full px-3 hover:bg-muted"
                @click="copyLink"
                :disabled="isLoading || !inviteLink"
              >
                <Check v-if="hasCopied" class="h-4 w-4" />
                <Copy v-else class="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="icon"
              @click="generateNewLink"
              :disabled="isLoading"
              title="Générer un nouveau lien"
            >
              <RefreshCw
                class="h-4 w-4"
                :class="{ 'animate-spin': isLoading }"
              />
            </Button>
          </div>

          <div class="rounded-lg bg-muted p-4 space-y-3">
            <h3 class="font-semibold">Comment ça marche ?</h3>
            <div class="space-y-2 text-sm text-muted-foreground">
              <p>1. Partagez ce lien unique avec votre client.</p>
              <p>
                2. Votre client remplira le formulaire d'inscription en ligne.
              </p>
              <p>
                3. Vous recevrez une notification par email dès que le
                formulaire sera complété.
              </p>
              <p>
                4. Accédez directement au profil de votre client depuis votre
                tableau de bord pour :
              </p>
              <ul class="list-disc pl-6 space-y-1">
                <li>Suivre sa progression</li>
                <li>Partager des activités personnalisées</li>
                <li>Gérer ses programmes de coaching</li>
              </ul>
            </div>
          </div>

          <!-- Astuce de sécurité -->
          <div class="text-sm text-muted-foreground flex items-start gap-2">
            <span class="text-yellow-500">ℹ️</span>
            <span>
              Pour des raisons de sécurité, ce lien est à usage unique et expire
              après 7 jours. Vous pouvez générer un nouveau lien à tout moment
              en cliquant sur le bouton de rafraîchissement.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
}

/* Animation pour l'icône de copie */
@keyframes checkmark {
  0% {
    transform: scale(0.8);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

.check-animation {
  animation: checkmark 0.3s ease-in-out;
}
</style>
