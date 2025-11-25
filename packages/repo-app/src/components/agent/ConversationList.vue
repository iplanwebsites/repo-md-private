<script setup>
import { computed, ref, onMounted } from "vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
	ChevronRight,
	Plus,
	Users,
	User,
	ArrowLeft,
	ChevronDown,
	Trash2,
	Info,
	Link,
	Calendar,
	Clock,
} from "lucide-vue-next";
import { useConversationStore } from "@/store/conversationStore";
import { useMeetingStore } from "@/store/meetingStore";
import ElipsisMenu from "@/components/ElipsisMenu.vue";

const conversationStore = useConversationStore();
const meetingStore = useMeetingStore();

// Get patients from the meeting store
const patients = computed(() => meetingStore.patients);

// Get upcoming and completed meetings
const upcomingMeetings = computed(
	() =>
		meetingStore.upcomingMeetings?.slice(0, meetingsDisplayLimit.value) || [],
);
const pastMeetings = computed(() => {
	const now = new Date();
	return meetingStore.meets
		.filter((meet) => {
			const meetingEnd = new Date(meet.startTime);
			meetingEnd.setMinutes(meetingEnd.getMinutes() + (meet.duration || 60));
			return (
				meetingEnd < now &&
				meet.status !== "canceled" &&
				(meet.transcript || meet.notes)
			);
		})
		.slice(0, meetingsDisplayLimit.value);
});

// Track view state
const showPatientSelection = ref(false);
const showUpcomingMeetingsSelection = ref(false);
const showCompletedMeetingsSelection = ref(false);
const displayLimit = ref(3);
const meetingsDisplayLimit = ref(3);

// Fetch meetings on component mount
onMounted(async () => {
	if (meetingStore.meets.length === 0) {
		await meetingStore.fetchMeetings();
	}
	if (meetingStore.patients.length === 0) {
		await meetingStore.fetchPatients();
	}
});

// Using the store to get conversation starters and conversations
const starters = computed(() => conversationStore.conversationStarters);
const allConversations = computed(() =>
	conversationStore.conversations.filter(
		(convo) => convo.messages && convo.messages.length > 0,
	),
);
const visibleConversations = computed(() =>
	allConversations.value.slice(0, displayLimit.value),
);
const hasMoreConversations = computed(
	() => allConversations.value.length > displayLimit.value,
);

function loadMoreConversations() {
	displayLimit.value += 3;
}

// Use store actions
function startConversation(starter) {
	conversationStore.startNewConversation(starter);
}

function openConversation(conversation) {
	conversationStore.activeConversation = conversation;
}

function showPatients() {
	showPatientSelection.value = true;
}

function hidePatients() {
	showPatientSelection.value = false;
}

function hideUpcomingMeetings() {
	showUpcomingMeetingsSelection.value = false;
}

function hideCompletedMeetings() {
	showCompletedMeetingsSelection.value = false;
}

function showUpcomingMeetings() {
	showUpcomingMeetingsSelection.value = true;
}

function showCompletedMeetings() {
	showCompletedMeetingsSelection.value = true;
}

function selectPatient(patient) {
	// In a real implementation, we would load patient.memory and append it to the prompt
	conversationStore.startPatientConversation(patient);
}

function selectMeeting(meeting) {
	// Make sure patientName is set
	if (meeting.patientId && !meeting.patientName) {
		const patient = meetingStore.patients.find(
			(p) => p.id === meeting.patientId,
		);
		if (patient) {
			meeting.patientName = patient.name;
		}
	}

	conversationStore.startMeetingConversation(meeting);

	// Hide selection views
	showUpcomingMeetingsSelection.value = false;
	showCompletedMeetingsSelection.value = false;
}

function loadMoreMeetings() {
	meetingsDisplayLimit.value += 3;
}

function newGeneralConvo() {
	const generalStarter = {
		id: "general",
		title: "Discussion générale",
		description: "De tout et de rien (mais surtout de coaching)",
		icon: "💬",
	};
	conversationStore.startNewConversation(generalStarter);
}

// Ellipsis menu items and actions
function aboutWiso() {
	// Handle à propos action
	console.log("À propos de Wiso clicked");
}

function navigateToBlog() {
	// Navigate to blog/wiso
	window.location.href = "/blog/wiso";
}

function clearHistory() {
	// Clear conversation history
	conversationStore.clearAllConversations();
}

const menuItems = [
	{
		label: "À propos de Wiso",
		icon: Info,
		action: navigateToBlog,
	},

	{ sep: true },
	{
		label: "Supprimer l'historique",
		icon: Trash2,
		action: clearHistory,
	},
];
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-emerald-700">Wiso</h1>
      <ElipsisMenu :items="menuItems" />
    </div>
    <!-- New Conversation Button

    <div class="mb-6" v-if="!showPatientSelection">
      <Button
        class="w-full flex items-center justify-center gap-2"
        size="lg"
        @click="showPatients"
      >
        <Plus class="h-4 w-4" />
        <span>Nouvelle conversation</span>
      </Button>
    </div> -->
    <!-- Patient Selection View -->
    <div v-if="showPatientSelection" class="space-y-4">
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="icon" @click="hidePatients">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <h3 class="font-semibold text-lg">Sélectionner un client</h3>
      </div>

      <div class="space-y-2">
        <div
          v-for="patient in patients"
          :key="patient.id"
          @click="selectPatient(patient)"
          class="w-full p-3 flex items-center gap-3 rounded-lg hover:bg-muted transition-colors text-left border border-gray-200 cursor-pointer"
        >
          <div class="bg-blue-100 p-2 rounded-full">
            <User class="h-5 w-5 text-blue-600" />
          </div>
          <div class="flex-1">
            <div class="font-medium">{{ patient.name }}</div>
            <div class="text-sm text-muted-foreground">
              {{
                patient.nextMeeting
                  ? meetingStore.formatDate(patient.nextMeeting)
                  : "Aucun rendez-vous"
              }}
            </div>
          </div>
          <ChevronRight class="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </div>
    
    <!-- Upcoming Meetings Selection View -->
    <div v-else-if="showUpcomingMeetingsSelection" class="space-y-4">
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="icon" @click="hideUpcomingMeetings">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <h3 class="font-semibold text-lg">Consultations à venir</h3>
      </div>

      <div v-if="upcomingMeetings.length > 0" class="space-y-2">
        <div
          v-for="meeting in upcomingMeetings"
          :key="meeting.id"
          @click="selectMeeting(meeting)"
          class="w-full p-3 flex items-center gap-3 rounded-lg hover:bg-muted transition-colors text-left border border-gray-200 cursor-pointer"
        >
          <div class="bg-blue-100 p-2 rounded-full">
            <Calendar class="h-5 w-5 text-blue-600" />
          </div>
          <div class="flex-1">
            <div class="font-medium">{{ meeting.title }}</div>
            <div class="text-sm text-muted-foreground">
              {{ meetingStore.formatDateTime(meeting.startTime) }}
            </div>
          </div>
          <ChevronRight class="h-4 w-4 text-muted-foreground" />
        </div>
        
        <!-- Load More Button -->
        <button
          v-if="meetingStore.upcomingMeetings && meetingStore.upcomingMeetings.length > meetingsDisplayLimit"
          @click="loadMoreMeetings"
          class="w-full py-2 flex items-center justify-center gap-1 text-sm text-emerald-700 hover:text-emerald-800 transition-colors"
        >
          <span>Voir plus</span>
          <ChevronDown class="h-4 w-4" />
        </button>
      </div>
      
      <div v-else class="text-center py-4 text-muted-foreground">
        Aucune consultation à venir
      </div>
    </div>
    
    <!-- Completed Meetings Selection View -->
    <div v-else-if="showCompletedMeetingsSelection" class="space-y-4">
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="icon" @click="hideCompletedMeetings">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <h3 class="font-semibold text-lg">Consultations terminées</h3>
      </div>

      <div v-if="pastMeetings.length > 0" class="space-y-2">
        <div
          v-for="meeting in pastMeetings"
          :key="meeting.id"
          @click="selectMeeting(meeting)"
          class="w-full p-3 flex items-center gap-3 rounded-lg hover:bg-muted transition-colors text-left border border-gray-200 cursor-pointer"
        >
          <div class="bg-gray-100 p-2 rounded-full">
            <Clock class="h-5 w-5 text-blue-600" />
          </div>
          <div class="flex-1">
            <div class="font-medium">{{ meeting.title }}</div>
            <div class="text-sm text-muted-foreground">
              {{ meetingStore.formatDateTime(meeting.startTime) }}
            </div>
          </div>
          <ChevronRight class="h-4 w-4 text-muted-foreground" />
        </div>
        
        <!-- Load More Button -->
        <button
          v-if="pastMeetings.length >= meetingsDisplayLimit"
          @click="loadMoreMeetings"
          class="w-full py-2 flex items-center justify-center gap-1 text-sm text-emerald-700 hover:text-emerald-800 transition-colors"
        >
          <span>Voir plus</span>
          <ChevronDown class="h-4 w-4" />
        </button>
      </div>
      
      <div v-else class="text-center py-4 text-muted-foreground">
        Aucune consultation terminée avec des notes ou transcription
      </div>
    </div>

    <!-- Main Conversation List View -->
    <div v-else>
      <!-- Previous Conversations Section -->
      <div v-if="allConversations.length > 0">
        <h3 class="font-semibold mb-3 text-lg">Conversations récentes</h3>
        <div class="space-y-2">
          <button
            v-for="conversation in visibleConversations"
            :key="conversation.id"
            @click="openConversation(conversation)"
            class="w-full p-3 flex flex-col gap-1 rounded-lg hover:bg-muted transition-colors text-left border border-gray-200"
          >
            <div class="flex items-center justify-between">
              <div class="font-medium">{{ conversation.title }}</div>
              <div class="text-xs text-muted-foreground">
                {{ conversationStore.formatDate(conversation.timestamp) }}
              </div>
            </div>
            <div
              class="text-sm text-muted-foreground truncate max-w-full line-clamp-2"
            >
              {{ conversation.lastMessage || "Pas encore de messages" }}
            </div>
          </button>

          <!-- Load More Button -->
          <button
            v-if="hasMoreConversations"
            @click="loadMoreConversations"
            class="w-full py-2 flex items-center justify-center gap-1 text-sm text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            <span>Voir plus</span>
            <ChevronDown class="h-4 w-4" />
          </button>
        </div>
      </div>

      <!-- Conversation Options Section -->
      <div>
        <h3 class="font-semibold mb-3 text-lg mt-7">
          Démarrer une nouvelle conversation
        </h3>
        <div class="space-y-2">
          <!-- Client Discussion Option -->

          <button
            @click="newGeneralConvo"
            class="w-full p-3 flex items-center gap-3 rounded-lg hover:bg-muted transition-colors text-left border border-gray-200"
          >
            <div class="bg-blue-100 p-2 rounded-full">
              <Plus class="h-5 w-5 text-blue-600" />
            </div>
            <div class="flex-1">
              <div class="font-medium">Discussion générale</div>
              <div class="text-sm text-muted-foreground line-clamp-1">
                De tout et de rien (mais surtout de coaching)
              </div>
            </div>
            <ChevronRight class="h-4 w-4 text-muted-foreground" />
          </button>

          <button
            @click="showPatients"
            class="w-full p-3 flex items-center gap-3 rounded-lg hover:bg-muted transition-colors text-left border border-gray-200"
          >
            <div class="bg-blue-100 p-2 rounded-full">
              <Users class="h-5 w-5 text-blue-600" />
            </div>
            <div class="flex-1">
              <div class="font-medium">Discuter d'un client</div>
              <div class="text-sm text-muted-foreground line-clamp-1">
                Sélectionnez un client pour discuter de son cas
              </div>
            </div>
            <ChevronRight class="h-4 w-4 text-muted-foreground" />
          </button>
          
          <!-- Upcoming Meetings Button -->
          <button
            @click="showUpcomingMeetings"
            class="w-full p-3 flex items-center gap-3 rounded-lg hover:bg-muted transition-colors text-left border border-gray-200"
          >
            <div class="bg-blue-100 p-2 rounded-full">
              <Calendar class="h-5 w-5 text-blue-600" />
            </div>
            <div class="flex-1">
              <div class="font-medium">Préparer une consultation</div>
              <div class="text-sm text-muted-foreground line-clamp-1">
                Sélectionnez une consultation à venir pour la préparer
              </div>
            </div>
            <ChevronRight class="h-4 w-4 text-muted-foreground" />
          </button>
          
          <!-- Past Meetings Button -->
          <button
            @click="showCompletedMeetings"
            class="w-full p-3 flex items-center gap-3 rounded-lg hover:bg-muted transition-colors text-left border border-gray-200"
          >
            <div class="bg-gray-100 p-2 rounded-full">
              <Clock class="h-5 w-5 text-blue-600" />
            </div>
            <div class="flex-1">
              <div class="font-medium">Analyser une consultation passée</div>
              <div class="text-sm text-muted-foreground line-clamp-1">
                Sélectionnez une consultation terminée pour l'analyser
              </div>
            </div>
            <ChevronRight class="h-4 w-4 text-muted-foreground" />
          </button>

          <!-- Conversation Starters -->
          <button
            v-for="starter in starters"
            :key="starter.id"
            @click="startConversation(starter)"
            class="w-full p-3 flex items-center gap-3 rounded-lg hover:bg-muted transition-colors text-left border border-gray-200"
          >
            <span class="text-2xl">{{ starter.icon }}</span>
            <div class="flex-1">
              <div class="font-medium">{{ starter.title }}</div>
              <div class="text-sm text-muted-foreground line-clamp-1">
                {{ starter.description }}
              </div>
            </div>
            <ChevronRight class="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
