<!-- MeetingDetails.vue -->
<script setup>
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { usePageTitle } from "@/lib/utils/vueUtils";
import {
	Calendar,
	Clock,
	User,
	Video,
	FileText,
	Edit,
	CalendarPlus,
	MessageSquare,
	AlertCircle,
	CheckCircle2,
	XCircle,
	ArrowLeft,
	ChevronRight,
} from "lucide-vue-next";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription,
} from "@/components/ui/dialog";

///import isloalhe
import { isLocalhost } from "@/lib/utils/devUtils.js";
// Import our Pinia store
import { useMeetingStore } from "@/store/meetingStore";

const props = defineProps({
	id: {
		type: String,
		required: true,
	},
});
import { useConversationStore } from "@/store/conversationStore"; // Import conversation store

const conversationStore = useConversationStore();

function clickWiso() {
	console.log("Wiso clicked");
	conversationStore.startMeetingConversation(
		meetingStore.currentMeetingPatient,
	);
}

const router = useRouter();
const meetingStore = useMeetingStore();
const activeTab = ref("details");
const notes = ref("");
const showCancelDialog = ref(false);
const cancelReason = ref("");

const isDev = isLocalhost() && true;
// Navigate back
const goBack = () => {
	router.back();
};

// Join meeting room
const joinMeeting = () => {
	window.open(`/meet/${meetingStore.currentMeeting.patientId}`, "_self");
};

// Schedule follow-up meeting
const scheduleFollowUp = () => {
	router.push({
		name: "ScheduleMeeting",
		params: { patientId: meetingStore.currentMeeting.patientId },
		query: { followUp: meetingStore.currentMeeting.id },
	});
};

// Edit meeting
const editMeeting = () => {
	router.push({
		name: "EditMeeting",
		params: { id: meetingStore.currentMeeting.id },
	});
};

// Save meeting notes
const saveNotes = async () => {
	if (!meetingStore.currentMeeting) return;
	await meetingStore.saveNotes(meetingStore.currentMeeting.id, notes.value);
};

// Open cancel dialog
const openCancelDialog = () => {
	cancelReason.value = "";
	showCancelDialog.value = true;
};

// Cancel meeting
const cancelMeeting = async () => {
	if (!meetingStore.currentMeeting) return;

	const result = await meetingStore.cancelMeeting(
		meetingStore.currentMeeting.id,
		cancelReason.value,
	);

	if (result.success) {
		showCancelDialog.value = false;
	}
};

// On component mount, load data from store
onMounted(async () => {
	// Load patients if not already loaded
	if (meetingStore.patients.length === 0) {
		await meetingStore.fetchPatients();
	}

	// Load meeting details
	const meeting = await meetingStore.fetchMeetingById(props.id);

	// Initialize notes from meeting data
	if (meeting && meeting.notes) {
		notes.value = meeting.notes;
	}
});

///computed summary
const summary = computed(() => {
	if (!meetingStore.currentMeeting) return null;
	const meta = meetingStore.currentMeeting.metadata;
	if (!meta) return null;
	return {
		desc: meta.summary || "Aucune description disponible",
		date: meetingStore.formatDateTime(meta.summaryGeneratedAt) || null,
	};
});

// Page title
const pageTitle = computed(() => {
	if (!meetingStore.currentMeeting) return "Détails de la rencontre";
	let title = "";
	// Add patient name if available
	if (meetingStore.currentMeetingPatient) {
		title += `${meetingStore.currentMeetingPatient.name} - `;
	}

	title += meetingStore.currentMeeting.title;

	return title;
});

// Use our composable to set the page title
usePageTitle({
	title: pageTitle,
});
</script>

<template>
  <json-debug :data="meetingStore.currentMeeting" />

  <div class="container mx-auto py-8 px-4 md:px-6">
    <!-- Loading state -->
    <div
      v-if="meetingStore.meetingLoading"
      class="flex justify-center items-center h-64"
    >
      <div
        class="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"
      ></div>
      <span class="ml-3">Chargement des détails du rendez-vous...</span>
    </div>

    <!-- Error state -->
    <div v-else-if="meetingStore.error" class="text-center p-8">
      <AlertCircle class="h-12 w-12 text-red-500 mx-auto mb-4" />
      <h2 class="text-2xl font-semibold text-red-700 mb-2">Erreur</h2>
      <p class="text-gray-700 mb-4">{{ meetingStore.error }}</p>
      <Button @click="goBack">Retour</Button>
    </div>

    <!-- Meeting details -->
    <div v-else-if="meetingStore.currentMeeting" class="space-y-6">
      <!-- Back button -->
      <Button variant="outline" size="sm" @click="goBack" class="mb-4">
        <ArrowLeft class="h-4 w-4 mr-2" />
        Retour
      </Button>

      <!-- Meeting header -->
      <div class="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 class="text-3xl font-bold flex items-center gap-2">
            <Video class="h-8 w-8 text-blue-500" />
            {{ meetingStore.currentMeeting.title }}
          </h1>
          <div class="flex items-center gap-2 mt-2">
            <Badge :class="meetingStore.statusBadgeClass">{{
              meetingStore.formattedStatus
            }}</Badge>
            <span
              v-if="
                meetingStore.meetingStatus === 'imminent' ||
                meetingStore.meetingStatus === 'upcoming'
              "
              class="text-sm font-medium text-blue-600"
            >
              {{ meetingStore.timeUntilMeeting }}
            </span>
          </div>
        </div>

        <!-- Context-sensitive buttons -->
        <div class="flex gap-2">
          <!-- Upcoming meeting actions -->
          <template v-if="meetingStore.meetingStatus === 'upcoming'">
            <Button variant="outline" @click="editMeeting">
              <Edit class="h-4 w-4 mr-2" />
              Modifier
            </Button>
            <Button variant="destructive" @click="openCancelDialog">
              <XCircle class="h-4 w-4 mr-2" />
              Annuler
            </Button>
          </template>

          <!-- Imminent or in-progress meeting actions -->
          <template
            v-if="
              meetingStore.meetingStatus === 'imminent' ||
              meetingStore.meetingStatus === 'in-progress'
            "
          >
            <router-link :to="'/meet/' + meetingStore.currentMeetingPatient.id">
              <Button class="bg-green-600 hover:bg-green-700">
                <Video class="h-4 w-4 mr-2" />
                Rejoindre maintenant
              </Button>
            </router-link>
          </template>

          <!-- Past or completed meeting actions -->
          <template
            v-if="
              meetingStore.meetingStatus === 'past' ||
              meetingStore.meetingStatus === 'completed'
            "
          >
            <Button @click="scheduleFollowUp">
              <CalendarPlus class="h-4 w-4 mr-2" />
              Planifier un suivi
            </Button>
          </template>
        </div>
      </div>

      <!-- Meeting info cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Date and time card -->
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-lg flex items-center">
              <Calendar class="h-5 w-5 mr-2" />
              Date et heure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="font-medium">
              {{
                meetingStore.formatDateTime(
                  meetingStore.currentMeeting.startTime
                )
              }}
            </p>
            <p class="text-sm text-muted-foreground mt-1">
              {{
                meetingStore.formatTime(meetingStore.currentMeeting.startTime)
              }}
              - {{ meetingStore.meetingEndTime }} ({{
                meetingStore.currentMeeting.duration
              }}
              minutes)
            </p>

            <!-- Countdown for upcoming meetings -->
            <div
              v-if="
                meetingStore.meetingStatus === 'upcoming' ||
                meetingStore.meetingStatus === 'imminent'
              "
              class="mt-3 text-sm text-blue-600 font-medium"
            >
              {{ meetingStore.timeUntilMeeting }}
            </div>
          </CardContent>
        </Card>

        <!-- Patient info card -->
        <Card v-if="meetingStore.currentMeetingPatient">
          <CardHeader class="pb-2">
            <CardTitle class="text-lg flex items-center">
              <User class="h-5 w-5 mr-2" />
              Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="flex items-center space-x-4">
              <Avatar>
                <AvatarFallback>{{
                  meetingStore.currentMeetingPatient.name.charAt(0)
                }}</AvatarFallback>
              </Avatar>
              <div>
                <p class="font-medium">
                  {{ meetingStore.currentMeetingPatient.name }}
                </p>
                <p class="text-sm text-muted-foreground">
                  ID: {{ meetingStore.currentMeetingPatient.id }}
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <router-link
              :to="'/client/' + meetingStore.currentMeetingPatient.id"
            >
              <Button variant="ghost" size="sm">
                Voir le profil
                <ChevronRight class="h-4 w-4 ml-1" />
              </Button>
            </router-link>

            <router-link :to="'/meet/' + meetingStore.currentMeetingPatient.id">
              <Button size="sm">
                Rejoindre la salle vidéo
                <Video class="h-4 w-4 ml-1" />
              </Button>
            </router-link>

            <Button size="sm" @click="clickWiso"> Wiso </Button>
          </CardFooter>
        </Card>

        <!-- Meeting status card -->
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-lg">Statut</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="flex items-center space-x-2">
              <CheckCircle2
                v-if="meetingStore.meetingStatus === 'completed'"
                class="h-5 w-5 text-green-500"
              />
              <Clock
                v-else-if="meetingStore.meetingStatus === 'in-progress'"
                class="h-5 w-5 text-green-500"
              />
              <Calendar
                v-else-if="meetingStore.meetingStatus === 'upcoming'"
                class="h-5 w-5 text-blue-500"
              />
              <AlertCircle
                v-else-if="meetingStore.meetingStatus === 'imminent'"
                class="h-5 w-5 text-yellow-500"
              />
              <XCircle
                v-else-if="meetingStore.meetingStatus === 'canceled'"
                class="h-5 w-5 text-red-500"
              />
              <FileText v-else class="h-5 w-5 text-gray-500" />

              <span class="font-medium">{{
                meetingStore.formattedStatus
              }}</span>
            </div>

            <!-- Cancellation reason -->
            <div
              v-if="
                meetingStore.meetingStatus === 'canceled' &&
                meetingStore.currentMeeting.cancelReason
              "
              class="mt-3 text-sm"
            >
              <p class="font-medium">Raison d'annulation:</p>
              <p class="text-muted-foreground">
                {{ meetingStore.currentMeeting.cancelReason }}
              </p>
            </div>

            <!-- Join button for imminent/in-progress meetings -->
            <div
              v-if="
                meetingStore.meetingStatus === 'imminent' ||
                meetingStore.meetingStatus === 'in-progress'
              "
              class="mt-4"
            >
              <Button
                @click="joinMeeting"
                class="w-full bg-green-600 hover:bg-green-700"
              >
                <Video class="h-4 w-4 mr-2" />
                Rejoindre la consultation
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Tabs for meeting details, transcript, notes -->
      <Tabs v-model="activeTab" class="w-full">
        <TabsList class="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="details">Détails</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger
            value="transcript"
            :disabled="!meetingStore.currentMeeting.transcript"
            >Transcription</TabsTrigger
          >
        </TabsList>

        <!-- Details tab -->
        <TabsContent value="details" class="space-y-4 pt-4">
          <Card v-if="summary">
            <CardHeader>
              <CardTitle>Sommaire</CardTitle>
            </CardHeader>
            <CardContent>
              <Prose :md="summary.desc" :max-height="0" class="mb-2" />
              <!-- 
              <p>
                {{ summary.desc }}
              </p>-->
              <p class="text-muted-foreground text-xs">
                Transcription de la rencontre du {{ summary.date }}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p v-if="meetingStore.currentMeeting.description">
                {{ meetingStore.currentMeeting.description }}
              </p>
              <p v-else class="text-muted-foreground">
                Aucune description disponible
              </p>
            </CardContent>
          </Card>

          <!-- Meeting metadata -->
          <Card
            v-if="
              isDev &&
              meetingStore.currentMeeting.metadata &&
              Object.keys(meetingStore.currentMeeting.metadata).length > 0
            "
          >
            <CardHeader>
              <CardTitle>Informations supplémentaires 🧪</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                v-for="(value, key) in meetingStore.currentMeeting.metadata"
                :key="key"
                class="mb-2"
              >
                <p class="font-medium">{{ key }}</p>
                <p class="text-sm text-muted-foreground">{{ value }}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Notes tab -->
        <TabsContent value="notes" class="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <CardDescription>
                Prenez des notes avant, pendant ou après la consultation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                v-model="notes"
                placeholder="Ajoutez vos notes ici..."
                rows="8"
                class="w-full mb-4"
              ></Textarea>

              <div class="flex items-center justify-between">
                <Button
                  @click="saveNotes"
                  :disabled="meetingStore.saveNoteStatus === 'saving'"
                >
                  <span v-if="meetingStore.saveNoteStatus === 'saving'"
                    >Enregistrement...</span
                  >
                  <span v-else-if="meetingStore.saveNoteStatus === 'success'"
                    >Enregistré ✓</span
                  >
                  <span v-else-if="meetingStore.saveNoteStatus === 'error'"
                    >Erreur ✗</span
                  >
                  <span v-else>Enregistrer les notes</span>
                </Button>

                <p
                  v-if="meetingStore.saveNoteStatus === 'success'"
                  class="text-sm text-green-600"
                >
                  Notes enregistrées avec succès
                </p>
                <p
                  v-if="meetingStore.saveNoteStatus === 'error'"
                  class="text-sm text-red-600"
                >
                  Erreur lors de l'enregistrement
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Transcript tab -->
        <TabsContent value="transcript" class="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Transcription</CardTitle>
              <CardDescription>
                Transcription automatique de la consultation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div v-if="meetingStore.currentMeeting.transcript">
                <div class="prose max-w-none">
                  <!-- TODO: format neatly with speakers, use a compute prop.
                    -->
                  <p>{{ meetingStore.currentMeeting.transcript }}</p>
                </div>
              </div>
              <div v-else class="text-center py-6 text-muted-foreground">
                Aucune transcription disponible
              </div>
            </CardContent>
          </Card>

          <!-- Summary section -->
          <Card v-if="meetingStore.currentMeeting.summary">
            <CardHeader>
              <CardTitle>Résumé</CardTitle>
            </CardHeader>
            <CardContent>
              <div class="prose max-w-none">
                <p>{{ meetingStore.currentMeeting.summary }}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>

    <!-- Cancel meeting dialog -->
    <Dialog :open="showCancelDialog" @update:open="showCancelDialog = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler le rendez-vous</DialogTitle>
          <DialogDescription>
            Êtes-vous sûr de vouloir annuler ce rendez-vous ? Cette action ne
            peut pas être annulée.
          </DialogDescription>
        </DialogHeader>

        <div class="mt-4 mb-6">
          <label for="cancelReason" class="text-sm font-medium mb-2 block">
            Raison de l'annulation (optionnelle)
          </label>
          <Textarea
            id="cancelReason"
            v-model="cancelReason"
            placeholder="Indiquez la raison de l'annulation..."
            rows="3"
          ></Textarea>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showCancelDialog = false"
            >Annuler</Button
          >
          <Button variant="destructive" @click="cancelMeeting">
            Confirmer l'annulation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
