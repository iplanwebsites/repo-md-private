<!-- MeetingAgenda.vue -->
<script setup>
import { ref, computed, onMounted, watch } from "vue";
import {
	Calendar,
	Clock,
	Users,
	User,
	Plus,
	ChevronRight,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	formatTime,
	formatDayDate,
	formatDateTime,
	isToday,
	isPast,
} from "@/lib/utils/dateUtils";
import { useMeetingStore } from "@/store/meetingStore";
import JsonDebug from "@/components/JsonDebug.vue";

// Props definition with validation

const props = defineProps({
	meets: {
		type: Array,
		default: () => [],
	},
	patients: {
		type: Array,
		default: () => [],
	},
	showDummyMeets: {
		type: Boolean,
		default: false,
	},
	userName: {
		type: String,
		default: "",
	},
	patientId: {
		type: String,
		default: null,
	},
	viewAllButton: {
		type: Boolean,
		default: true,
	},
	showHeader: {
		type: Boolean,
		default: true,
	},
	className: {
		type: String,
		default: "",
	},
});

const emit = defineEmits(["clickScheduleMeet"]);

// Use the meeting store
const meetingStore = useMeetingStore();

// Add selected tab state
const selectedMeetingsTab = ref("upcoming");

// Reset showAllPastRdvs when switching tabs
watch(selectedMeetingsTab, () => {
	showAllPastRdvs.value = false;
});

// Mock data for meetings to show when showDummyMeets is true
const dummyMeetings = [
	{
		id: "dummy1",
		title: "Morning Check-up",
		startTime: new Date(new Date().setHours(9, 0)),
		duration: 30,
		patientId: "pat123",
		type: "first",
	},
	{
		id: "dummy2",
		title: "Physical Therapy Session",
		startTime: new Date(new Date().setHours(11, 30)),
		duration: 45,
		patientId: "pat456",
		type: "therapy",
	},
	{
		id: "dummy3",
		title: "Mental Health Consultation",
		startTime: new Date(new Date().setHours(14, 0)),
		duration: 60,
		patientId: "pat789",
		type: "consultation",
	},
];

// Patient lookup function using props.patients array and store
const getPatient = (patientId) => {
	// First check props.patients
	const patientFromProps = props.patients.find((p) => p.id === patientId);
	if (patientFromProps) return patientFromProps;

	// Then check store
	const patientFromStore = meetingStore.patients.find(
		(p) => p.id === patientId,
	);
	if (patientFromStore) return patientFromStore;

	// If patient is the currently specified one with userName, use that
	if (props.patientId === patientId && props.userName) {
		return {
			id: patientId,
			name: props.userName,
		};
	}

	// Default
	return {
		name: "Patient inconnu",
	};
};

// Load meetings from store if needed
const storeMeetings = computed(() => {
	// If a patientId is provided, filter by that patient
	if (props.patientId) {
		return meetingStore.meets.filter(
			(meet) =>
				meet.patientId === props.patientId && meet.status === "scheduled",
		);
	}
	// Otherwise return all scheduled meetings
	return meetingStore.meets.filter((meet) => meet.status === "scheduled");
});

// Combine real and dummy meets if needed
const allMeetings = computed(() => {
	if (props.showDummyMeets) {
		return [...props.meets, ...dummyMeetings];
	}
	if (props.meets && props.meets.length > 0) {
		return props.meets;
	}
	return storeMeetings.value;
});

// Filter meetings based on the selected tab
const filteredMeetings = computed(() => {
	const currentTime = new Date();

	return allMeetings.value.filter((meet) => {
		const meetingTime = new Date(meet.startTime);
		const isPastMeeting = meetingTime < currentTime;

		return selectedMeetingsTab.value === "past"
			? isPastMeeting
			: !isPastMeeting;
	});
});

// Limit for past meetings display
const limitPastRDV_SHOWN = 4;
const showAllPastRdvs = ref(false);

// Sort meetings by time (closest first for upcoming, most recent first for past)
const sortedMeetings = computed(() => {
	return [...filteredMeetings.value]
		.filter((meet) => meet.status === "scheduled")
		.sort((a, b) => {
			if (selectedMeetingsTab.value === "past") {
				// For past meetings, sort most recent first
				return new Date(b.startTime) - new Date(a.startTime);
			} else {
				// For upcoming meetings, sort closest first
				return new Date(a.startTime) - new Date(b.startTime);
			}
		});
});

// Limited past meetings for display
const shownPastMeetings = computed(() => {
	if (selectedMeetingsTab.value === "past" && !showAllPastRdvs.value) {
		return sortedMeetings.value.slice(0, limitPastRDV_SHOWN);
	}
	return sortedMeetings.value;
});

// Check if we have more past meetings than the limit
const hasMorePastMeetings = computed(() => {
	return (
		selectedMeetingsTab.value === "past" &&
		sortedMeetings.value.length > limitPastRDV_SHOWN &&
		!showAllPastRdvs.value
	);
});

// Group meetings by day
const meetingsByDay = computed(() => {
	const grouped = {};

	// Use shownPastMeetings instead of sortedMeetings when in past tab
	const meetingsToGroup = shownPastMeetings.value;

	meetingsToGroup.forEach((meeting) => {
		const dateStr = formatDayDate(meeting.startTime);

		if (!grouped[dateStr]) {
			grouped[dateStr] = [];
		}

		grouped[dateStr].push(meeting);
	});

	return grouped;
});

// Computed property to format today's date
const todayDate = computed(() => {
	return formatDateTime(new Date());
});

// Check if a date string matches today's formatted date
const isTodayString = (dateStr) => {
	const today = formatDayDate(new Date());
	return dateStr === today;
};

// Determine the meeting type based on title or other properties
const getMeetingType = (meeting) => {
	const titleLower = meeting.title.toLowerCase();

	if (titleLower.includes("premier") || titleLower.includes("initial")) {
		return "first";
	} else if (titleLower.includes("thérapie") || titleLower.includes("suivi")) {
		return "therapy";
	} else if (titleLower.includes("mental") || titleLower.includes("consult")) {
		return "consultation";
	}

	return "consultation";
};

// Format duration as string
const formatDuration = (minutes) => {
	if (minutes < 60) {
		return `${minutes} minutes`;
	} else {
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;

		if (remainingMinutes === 0) {
			return hours === 1 ? "1 heure" : `${hours} heures`;
		} else {
			return `${hours}h${remainingMinutes}`;
		}
	}
};

// Emit schedule meeting event
const scheduleMeet = () => {
	emit("clickScheduleMeet");
};

// Fetch meetings on mount if needed
onMounted(async () => {
	if (meetingStore.meets.length === 0) {
		await meetingStore.fetchMeetings();
	}
	if (meetingStore.patients.length === 0) {
		await meetingStore.fetchPatients();
	}
});
</script>

<template>
  <div class="bg-white rounded-lg shadow-lg p-6 mt-8" :class="className">
    <!-- Header section -->
    <div v-if="showHeader" class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-semibold text-gray-800">
          Agenda des rendez-vous
          <span v-if="props.userName" class="text-lg font-medium text-gray-500">
            avec

            <router-link :to="'/client/' + props.patientId">
              {{ props.userName }}
            </router-link>
          </span>
        </h2>
        <p class="text-gray-600 mt-1 flex items-center gap-2">
          <Calendar class="w-4 h-4" />
          {{ todayDate }}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <router-link
          v-if="viewAllButton"
          to="/meet"
          class="text-blue-600 hover:underline flex items-center gap-1 text-sm"
        >
          Voir tous <ChevronRight class="w-4 h-4" />
        </router-link>
        <Button @click="scheduleMeet" class="flex items-center gap-2">
          <Plus class="h-4 w-4" />
          Planifier
        </Button>
      </div>
    </div>

    <!-- Tabs for filtering -->
    <div class="mb-6">
      <Tabs v-model="selectedMeetingsTab" class="w-full">
        <TabsList>
          <TabsTrigger value="upcoming">À venir</TabsTrigger>
          <TabsTrigger value="past">Passé</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming"></TabsContent>
        <TabsContent value="past"></TabsContent>
      </Tabs>
    </div>

    <!-- Group meetings by day -->
    <div v-if="Object.keys(meetingsByDay).length > 0">
      <div
        v-for="(meetings, day, index) in meetingsByDay"
        :key="day"
        class="mb-8"
      >
        <!-- Day header -->
        <div class="flex items-center mb-3">
          <h3 class="font-semibold text-gray-800 text-lg">{{ day }}</h3>
          <span
            v-if="isTodayString(day)"
            class="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full"
          >
            Aujourd'hui
          </span>
        </div>

        <!-- Meetings for this day -->
        <div class="space-y-3">
          <router-link
            v-for="meeting in meetings"
            :key="meeting.id"
            :to="'/meets/' + meeting.id"
            class="border rounded-lg p-4 transition-all hover:border-blue-300 block"
            :class="{
              'bg-blue-50 text-blue-600':
                !isPast(meeting.startTime) &&
                selectedMeetingsTab === 'upcoming',
              'bg-gray-100 text-gray-600':
                isPast(meeting.startTime) || selectedMeetingsTab === 'past',
            }"
          >
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-semibold text-gray-800">{{ meeting.title }}</h3>
                <div class="flex items-center gap-4 mt-2">
                  <span class="flex items-center gap-1 text-sm text-gray-600">
                    <Clock class="w-4 h-4" />
                    {{ formatTime(meeting.startTime) }} ({{
                      formatDuration(meeting.duration)
                    }})
                  </span>
                  <span class="flex items-center gap-1 text-sm text-gray-600">
                    <User class="w-4 h-4" />
                    {{ getPatient(meeting.patientId).name }}
                  </span>
                </div>
                <div
                  v-if="meeting.description"
                  class="mt-2 text-sm text-gray-700"
                >
                  {{ meeting.description }}
                </div>
              </div>
              <div
                class="px-3 py-1 rounded-full text-xs font-medium"
                :class="{
                  'bg-blue-100 text-blue-700':
                    getMeetingType(meeting) === 'first',
                  'bg-green-100 text-green-700':
                    getMeetingType(meeting) === 'therapy',
                  'bg-purple-100 text-purple-700':
                    getMeetingType(meeting) === 'consultation',
                }"
              >
                {{ getMeetingType(meeting) }}
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Show more past meetings button -->
    <div v-if="hasMorePastMeetings" class="text-center mt-4 mb-8">
      <Button @click="showAllPastRdvs = true" variant="outline" class=" ">
        Voir tous ({{ sortedMeetings.length }})
      </Button>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="Object.keys(meetingsByDay).length === 0"
      class="text-center py-8 text-gray-500"
    >
      <span v-if="selectedMeetingsTab === 'upcoming'">
        Aucun rendez-vous à venir
      </span>
      <span v-else> Aucun rendez-vous passé </span>
    </div>
  </div>
</template>
