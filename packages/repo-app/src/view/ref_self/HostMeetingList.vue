// HostMeetingList.vue
<script setup>
import { ref, onMounted, computed } from "vue";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import DateTimePicker from "@/components/DateTimePicker.vue";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

import {
	Video,
	Calendar,
	Plus,
	Info,
	Trash2,
	MessageSquare,
	CalendarClock,
	Settings,
} from "lucide-vue-next";

import MeetingAgenda from "@/components/MeetingAgenda.vue";
import MeetCalendar from "@/components/MeetCalendar.vue";
import { useMeetingStore } from "@/store/meetingStore";

import { appConfigs } from "@/appConfigs.js";
const API_URL = appConfigs.apiUrl;

const SHOW_DUMMY_DATA = false;

// Use the Pinia store
const meetingStore = useMeetingStore();

// Define props with default values
const props = defineProps({
	session: {
		type: Object,
		default: () => ({}),
	},
});
const { session } = toRefs(props);
const user = computed(() => ({
	id: session.value?.user?.id || "",
	email: session.value?.user?.email || "",
	avatar: session.value?.user?.user_metadata?.avatar_url || "",
	name:
		session.value?.user?.user_metadata?.full_name ||
		session.value?.user?.email?.split("@")[0] ||
		"",
}));

// New schedule meeting modal
const showScheduleModal = ref(false);
const schedulingError = ref("");
const newMeeting = ref({
	patientId: "",
	title: "Consultation",
	description: "",
	startTime: new Date(
		Math.ceil(Date.now() / (30 * 60 * 1000)) * (30 * 60 * 1000) +
			60 * 60 * 1000,
	),
	duration: 30,
});

// Format date for datetime-local input
const formattedDateTime = computed(() => {
	const dt = new Date(newMeeting.value.startTime);
	return dt.toISOString().slice(0, 16);
});

// Load patients and their meetings
onMounted(async () => {
	// Load data from store
	await meetingStore.fetchPatients();
	await meetingStore.fetchMeetings();

	// If we have patients, set the default patient for the new meeting form
	if (meetingStore.patients.length > 0) {
		newMeeting.value.patientId = meetingStore.patients[0].id;
	}
});

// Open schedule meeting modal
const scheduleMeetModal = () => {
	// Reset form
	newMeeting.value = {
		patientId:
			meetingStore.patients.length > 0 ? meetingStore.patients[0].id : "",
		title: "Consultation",
		description: "",
		startTime: new Date(
			Math.ceil(Date.now() / (30 * 60 * 1000)) * (30 * 60 * 1000) +
				60 * 60 * 1000,
		),
		duration: 30,
		ownerName: user.value.name,
		ownerEmail: user.value.email,
	};
	schedulingError.value = "";
	showScheduleModal.value = true;
};

// Schedule a new meeting
const createMeeting = async () => {
	schedulingError.value = "";

	if (!newMeeting.value.patientId) {
		schedulingError.value = "Veuillez sélectionner un patient";
		return;
	}

	if (!newMeeting.value.title) {
		schedulingError.value = "Veuillez ajouter un titre";
		return;
	}

	// Use the store to schedule the meeting
	const result = await meetingStore.scheduleMeeting(newMeeting.value);

	if (result.success) {
		showScheduleModal.value = false;
	} else {
		schedulingError.value = result.error;
	}
};

const icalCalendarUrl = computed(() => {
	const url = API_URL + "/calendar/" + user.value.id;

	return url;
});

const menuItems = [
	{
		label: "À propos ",
		icon: Info,
		action: alert,
	},

	{
		label: "Discuter de mon horraire",
		icon: MessageSquare,
		action: alert,
	},
	{
		label: "Syncroniser mes calendriers",
		icon: CalendarClock,
		to: "/settings",
	},
	{
		label: "Préférences de rendez-vous",
		icon: Settings,
		to: "/settings",
		//action: alert,
	},

	{ sep: true },
	{
		label: "Supprimer l'historique",
		icon: Trash2,
		action: alert,
	},
];

const infoTooltip = computed(() => {
	return "Planifiez vos séances, orientez vos objectifs et assurez-vous de ne rien oublier.";
});
</script>

<template>
  <div class="bg-crazy img5" style="background: #f6f5e3">
    <div style="z-index: 1; position: relative" class="px-4 py-6 lg:px-8">
      <PageHeadingBar title=" Rendez-vous " :info="infoTooltip">
        <Button class="w-full mt-4" @click="scheduleMeetModal" variant="">
          <Plus class="mr-2 h-4 w-4" />
          Planifier
        </Button>
        <ElipsisMenu
          :items="menuItems"
          hori
          :info="infoTooltip"
          title="Rendez-vous"
        />
      </PageHeadingBar>

      <!-- Meeting calendar and agenda -->
      <div v-if="!meetingStore.meetsLoading">
        <!-- Meeting Agenda Component -->
        <MeetingAgenda
          class="m-5 p-5 mt-12"
          :meets="meetingStore.meets"
          @clickScheduleMeet="scheduleMeetModal"
          :showDummyMeets="SHOW_DUMMY_DATA"
          :patients="meetingStore.patients"
          :viewAllButton="false"
          :showHeader="false"
        />
      </div>
      <div v-else class="text-center my-12">
        <p>Chargement des rendez-vous...</p>
      </div>

      <MeetCalendar
        class="m-5 p-5 mt-12"
        :meets="meetingStore.meets"
        @clickScheduleMeet="scheduleMeetModal"
        :showDummyMeets="SHOW_DUMMY_DATA"
        :patients="meetingStore.patients"
      />
      <json-debug :data="meetingStore.meets" label="meets" />

      <PageHeadingBar
        title="Survol client et statut des rendez-vous"
        subtitle="Un aperçu instantané de la progression, des prochains créneaux et de vos priorités du moment."
      ></PageHeadingBar>
      <div class="container mx-auto">
        <!-- Header



      <a :href="icalCalendarUrl" target="_blank" class="text-blue-500">
        <Calendar class="mr-2 h-4 w-4" />
        Ajouter à mon calendrier (ical / google cal)
      </a>

      
      <div class="text-center my-16">
        <h1 class="text-4xl font-bold mb-4">Rendez-vous</h1>
        <p class="text-xl text-muted-foreground mb-8">
          Accédez aux salles de consultation virtuelles de vos patients
        </p>
      </div>

       -->

        <!-- Error message -->
        <div v-if="meetingStore.error" class="text-center mb-8 text-red-600">
          {{ meetingStore.error }}
        </div>

        <div class="flex flex-row gap-4">
          <!-- Patient rooms list -->
          <div class="flex-none w-full md:w-2/3">
            <!-- Loading state -->
            <div v-if="meetingStore.patientsLoading" class="grid gap-6">
              <Card v-for="i in 3" :key="i" class="p-6">
                <div class="animate-pulse">
                  <div class="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                  <div class="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                  <div class="h-4 bg-gray-200 rounded w-1/5"></div>
                </div>
              </Card>
            </div>

            <!-- Loaded patient rooms list -->
            <div v-else class="grid gap-6">
              <router-link
                v-for="patient in meetingStore.patients"
                :key="patient.id"
                :to="'/meet/' + patient.id"
              >
                <Card class="p-6 transition-shadow hover:shadow-lg">
                  <div class="flex justify-between items-start">
                    <div>
                      <h2 class="text-2xl font-semibold mb-2">
                        <Video />
                        {{ patient.roomName }}
                      </h2>
                      <p class="text-muted-foreground">
                        ID Patient : {{ patient.id }}
                      </p>
                      <p class="text-sm mt-2">
                        Prochaine consultation :
                        {{ meetingStore.formatDate(patient.nextMeeting) }}
                      </p>
                      <p v-if="patient.agenda" class="text-sm mt-1">
                        Agenda : {{ patient.agenda }}
                      </p>
                      <p class="text-sm mt-1">
                        Activités terminées : {{ patient.completedActivities }}
                      </p>
                    </div>
                    <Badge
                      :class="meetingStore.getBadgeClass(patient.roomStatus)"
                    >
                      {{ meetingStore.formatStatus(patient.roomStatus) }}
                    </Badge>
                  </div>
                </Card>
              </router-link>
            </div>
          </div>

          <!-- Agenda Sidebar -->
          <div class="rightPane flex-none w-1/3 hidden md:block">
            <!-- Next Meeting Card -->
            <Card class="p-6">
              <h3 class="font-semibold mb-4">Prochaine Consultation</h3>
              <div v-if="meetingStore.nextScheduledPatient" class="space-y-2">
                <p class="text-lg font-medium">
                  {{ meetingStore.nextScheduledPatient.meetingTime }}
                </p>
                <p class="text-sm text-muted-foreground">
                  Salle : {{ meetingStore.nextScheduledPatient.roomName }}
                </p>
                <p class="text-sm text-muted-foreground">
                  ID Patient : {{ meetingStore.nextScheduledPatient.id }}
                </p>
                <div class="mt-4">
                  <h4 class="font-medium mb-2">Ordre du jour</h4>
                  <p class="text-sm">
                    {{ meetingStore.nextScheduledPatient.agenda }}
                  </p>
                </div>
              </div>
              <p v-else class="text-sm text-muted-foreground">
                Aucune consultation programmée
              </p>
            </Card>

            <!-- Summary Card -->
            <Card class="p-6 mt-4">
              <h3 class="font-semibold mb-4">Résumé</h3>
              <div class="space-y-2">
                <p class="text-sm text-muted-foreground">
                  Total patients : {{ meetingStore.patients.length }}
                </p>
                <p class="text-sm text-muted-foreground">
                  Consultations à venir :
                  {{ meetingStore.upcomingMeetingsCount }}
                </p>
                <p class="text-sm text-muted-foreground">
                  Salles disponibles : {{ meetingStore.availableRoomsCount }}
                </p>
              </div>
            </Card>

            <!-- Schedule meeting button -->
            <Button class="w-full mt-4" @click="scheduleMeetModal">
              <Calendar class="mr-2 h-4 w-4" />
              Planifier un rendez-vous
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Schedule Meeting Modal -->
    <Dialog :open="showScheduleModal" @update:open="showScheduleModal = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Planifier un rendez-vous</DialogTitle>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="patient">Patient</Label>
            <Select v-model="newMeeting.patientId">
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un patient" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="patient in meetingStore.patients"
                  :key="patient.id"
                  :value="patient.id"
                >
                  {{ patient.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="title">Titre</Label>
            <Input
              id="title"
              v-model="newMeeting.title"
              placeholder="Titre du rendez-vous"
            />
          </div>

          <div class="space-y-2">
            <Label for="description">Description (optionnelle)</Label>
            <Textarea
              id="description"
              v-model="newMeeting.description"
              placeholder="Description du rendez-vous"
              rows="3"
            />
          </div>

          <div class="space-y-2">
            <Label for="startDate">Date et heure</Label>
            <DateTimePicker
              v-model="newMeeting.startTime"
              placeholder="Sélectionner date et heure du rendez-vous"
            />
          </div>

          <div class="space-y-2">
            <Label for="duration">Durée (minutes)</Label>
            <Select v-model="newMeeting.duration">
              <SelectTrigger>
                <SelectValue placeholder="Durée du rendez-vous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="15">15 minutes</SelectItem>
                <SelectItem :value="30">30 minutes</SelectItem>
                <SelectItem :value="45">45 minutes</SelectItem>
                <SelectItem :value="60">1 heure</SelectItem>
                <SelectItem :value="90">1 heure 30 minutes</SelectItem>
                <SelectItem :value="120">2 heures</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div v-if="schedulingError" class="text-red-500 text-sm mt-2">
            {{ schedulingError }}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showScheduleModal = false"
            >Annuler</Button
          >
          <Button @click="createMeeting">
            Planifier
            <Calendar class="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <json-debug :data="meetingStore.meets" label="meets" />

    <BrochureFooter class=" " />
  </div>
</template>

<style scoped>
.bg-surface {
  background-color: hsl(var(--background));
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
