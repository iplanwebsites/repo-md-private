<script setup>
import { ref, onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import { Copy, Clock } from "lucide-vue-next";
import trpc from "@/trpc";
import MeetingPreview from "@/components/videoconf/MeetingPreview.vue";
import MeetingAgenda from "@/components/MeetingAgenda.vue";
import JsonDebug from "@/components/JsonDebug.vue";
import { useMeetingStore } from "@/store/meetingStore";
import {
	formatMeetingDateTime,
	sortMeetingsByProximity,
	getMeetingCountdown,
} from "@/lib/utils/meetingUtils";

const route = useRoute();
const meetingStore = useMeetingStore();

// Props definition with validation
const props = defineProps({
	session: {
		type: Object,
		default: null,
	},
	roomId: {
		type: String,
		required: true,
	},
	isHost: {
		type: Boolean,
		default: false,
	},
});

// State Management
const patientDetails = ref({
	id: props.roomId || "loading.....",
	name: "",
	email: "",
	activities: [],
	notes: [],
	status: "",
	startDate: new Date().toISOString(),
});

const currentMeetingId = ref(null);
const hostName = ref("");
const joined = ref(false);
const left = ref(false);
const loading = ref(false);
const showCopySuccess = ref(false);

// Media preferences state with two-way binding
const mediaPreferences = ref({
	isVideoEnabled: true,
	isAudioEnabled: true,
});

// Computed invite URL
const inviteUrl = computed(() => {
	return `${window.location.origin}/meet/${props.roomId}`;
});

// Computed property for current meeting details
const currentMeeting = computed(() => {
	if (props.isHost) {
		if (!currentMeetingId.value) return null;
		return (
			meetingStore.meets.find((meet) => meet.id === currentMeetingId.value) ||
			null
		);
	} else {
		// For guest view, we use the ref directly
		return currentMeetingId.value;
	}
});

// Meeting time and formatting
const meetingTime = computed(() => {
	if (props.isHost) {
		return currentMeeting.value?.startTime || null;
	} else {
		return currentMeeting.value?.startTime || null;
	}
});

const formattedMeetingTime = computed(() => {
	return formatMeetingDateTime(meetingTime.value);
});

const countdownText = computed(() => {
	return getMeetingCountdown(meetingTime.value);
});

// Debug information object
const debugInfo = computed(() => {
	if (props.isHost) {
		return {
			patientId: props.roomId,
			currentMeetingId: currentMeetingId.value,
			currentMeeting: currentMeeting.value
				? {
						id: currentMeeting.value.id,
						title: currentMeeting.value.title,
						status: currentMeeting.value.status,
						startTime: currentMeeting.value.startTime,
						duration: currentMeeting.value.duration,
						formattedTime: formatMeetingDateTime(
							currentMeeting.value.startTime,
						),
					}
				: null,
			patientDetails: patientDetails.value,
			hasScheduledMeeting: !!currentMeetingId.value,
			availableMeetings: meetingStore.meets
				.filter((meet) => meet.patientId === props.roomId)
				.map((meet) => ({
					id: meet.id,
					startTime: meet.startTime,
					status: meet.status,
					title: meet.title,
				})),
		};
	} else {
		return {
			roomId: props.roomId,
			currentMeeting: currentMeeting.value,
			patientDetails: patientDetails.value,
			hasScheduledMeeting: !!currentMeeting.value,
		};
	}
});

// URL management
const copyInviteUrl = async () => {
	try {
		await navigator.clipboard.writeText(inviteUrl.value);
		showCopySuccess.value = true;
		setTimeout(() => {
			showCopySuccess.value = false;
		}, 3000);
	} catch (err) {
		console.error("Copy failed:", err);
	}
};

// Data fetching - Host version
const fetchHostData = async () => {
	try {
		loading.value = true;
		await Promise.all([fetchPatientDetails(), fetchCurrentMeeting()]);
	} catch (err) {
		console.error("Error fetching host data:", err);
	} finally {
		loading.value = false;
	}
};

// Get patient details from meetingStore using the new getPatient method
const fetchPatientDetails = async () => {
	try {
		loading.value = true;

		if (props.isHost) {
			// Host view - Get patient from store or API
			const patient = await meetingStore.getPatient(props.roomId);

			if (patient) {
				// Use patient from store
				patientDetails.value = patient;
			} else {
				// Fallback to API if not in store
				const data = await trpc.getPatientDetails.query({
					patientId: props.roomId,
					includeActivities: true,
				});
				patientDetails.value = data;
			}
		} else {
			// Guest view - use simple room info endpoint
			const response = await trpc.getRoomInfo.query({
				roomId: props.roomId,
			});

			if (response && response.success) {
				// Update meeting info
				currentMeetingId.value = response.meeting || null;
				hostName.value = response.hostName || "Coach";

				// Update patient info
				if (response.patientDetails) {
					patientDetails.value = {
						...patientDetails.value,
						...response.patientDetails,
					};
				}
			}
		}
	} catch (err) {
		console.error("Error getting details:", err);
	} finally {
		loading.value = false;
	}
};

// Fetch the current meeting for this patient - Host only
const fetchCurrentMeeting = async () => {
	if (!props.isHost) return;

	try {
		// First make sure we have meetings loaded
		if (meetingStore.meets.length === 0) {
			await meetingStore.fetchMeetings();
		}

		// Filter meetings for this patient
		const patientMeets = meetingStore.meets.filter((meet) => {
			return meet.patientId === props.roomId && meet.status === "scheduled";
		});

		// Sort by proximity to current time using the utility
		const sortedMeets = sortMeetingsByProximity(patientMeets);

		// Get the closest meeting ID
		if (sortedMeets.length > 0) {
			currentMeetingId.value = sortedMeets[0].id;
			console.log(
				`Found meeting for patient ${props.roomId}: ${currentMeetingId.value}`,
			);

			// Also try to share this information with the server for consistency between host and guest
			try {
				await trpc.setActiveRoomMeeting.mutate({
					roomId: props.roomId,
					meetingId: currentMeetingId.value,
				});
			} catch (err) {
				console.error("Could not set active room meeting:", err);
				// Continue anyway - this is just for better sync
			}
		} else {
			console.log(`No scheduled meetings found for patient ${props.roomId}`);
			currentMeetingId.value = null;
		}
	} catch (err) {
		console.error("Error fetching current meeting:", err);
		currentMeetingId.value = null;
	}
};

// Meeting management
const handleJoinMeeting = () => {
	joined.value = true;
	left.value = false;
};

const handleLeft = () => {
	joined.value = false;
	left.value = true;
};

// Lifecycle hooks
onMounted(async () => {
	if (props.isHost) {
		await fetchHostData();
	} else {
		await fetchPatientDetails();
	}
});
</script>

<template>
  <div class="min-h-screen bg-gray-100 py-8 px-4">
    <!-- Debug Information -->
    <div class="mb-4">
      <JsonDebug
        :data="debugInfo"
        :expanded="false"
        label="Meeting Debug Info"
      />

      <!-- Meeting Status Banner (Host only) -->
      <div
        v-if="props.isHost && currentMeeting"
        class="mb-4 p-3 bg-blue-600 text-white rounded-lg shadow-md"
      >
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-bold text-lg">
              Active Meeting: {{ currentMeeting.title }}
            </h2>
            <p class="text-blue-100">
              {{ formattedMeetingTime }}
            </p>
          </div>

          <div>
            <router-link :to="'/meets/' + currentMeetingId">
              <Button class="bg-white text-blue-600 hover:bg-blue-100">
                Voir le détail de la réunion
              </Button>
            </router-link>
          </div>

          <div class="text-right">
            <span
              class="inline-block px-3 py-1 rounded-full bg-blue-500 text-sm"
            >
              Patient: {{ patientDetails.name }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="max-w-4xl mx-auto" v-if="patientDetails">
      <template v-if="!joined">
        <!-- Meeting Room Header -->
        <div class="bg-white rounded-lg shadow p-6 mb-6">
          <!-- Host View -->
          <template v-if="props.isHost">
            <h2 class="text-2xl font-semibold text-gray-800 mb-4">
              Salle de réunion pour
              <router-link
                :to="{ name: 'client', params: { id: patientDetails.id } }"
                class="text-blue-600 hover:underline"
              >
                <strong>{{ patientDetails.name }}</strong>
              </router-link>
            </h2>

            <p class="text-gray-600 mb-4">
              Partagez ce lien pour inviter d'autres participants à votre
              réunion :
            </p>
          </template>

          <!-- Guest View -->
          <template v-else>
            <h2 class="text-2xl font-semibold text-gray-800 mb-4">
              Rencontre avec {{ hostName }}
            </h2>
          </template>

          <!-- Invite URL (Host only) -->
          <div v-if="props.isHost" class="flex items-center gap-4 mb-4">
            <input
              type="text"
              readonly
              :value="inviteUrl"
              class="flex-1 p-3 border rounded-lg bg-gray-50 text-gray-700"
            />
            <button
              @click="copyInviteUrl"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="Copier le lien"
            >
              <Copy class="w-5 h-5" />
            </button>
          </div>

          <p v-if="showCopySuccess" class="text-green-600 text-sm">
            Lien copié dans le presse-papiers !
          </p>

          <!-- Meeting Info (Host View) -->
          <div
            v-if="props.isHost && currentMeeting"
            class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg"
          >
            <h3 class="font-semibold text-blue-900 mb-2">Meeting Details</h3>
            <div class="space-y-1">
              <p class="text-sm text-blue-800">
                <span class="font-semibold">Meeting ID:</span>
                {{ currentMeetingId }}
              </p>
              <p class="text-sm text-blue-800">
                <span class="font-semibold">Title:</span>
                {{ currentMeeting.title }}
              </p>
              <p class="text-sm text-blue-800">
                <span class="font-semibold">Scheduled for:</span>
                {{ formattedMeetingTime }}
              </p>
              <p class="text-sm text-blue-800">
                <span class="font-semibold">Duration:</span>
                {{ currentMeeting.duration }} minutes
              </p>
              <p class="text-sm text-blue-800">
                <span class="font-semibold">Status:</span>
                <span
                  class="rounded-full px-2 py-0.5 text-xs"
                  :class="
                    currentMeeting.status === 'scheduled'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  "
                >
                  {{ currentMeeting.status }}
                </span>
              </p>
            </div>
          </div>

          <!-- Meeting Info (Guest View) -->
          <div
            v-else-if="!props.isHost && currentMeeting"
            class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg"
          >
            <h3 class="font-semibold text-blue-900 mb-2">
              Détails de la réunion
            </h3>
            <div class="space-y-1">
              <p class="text-sm text-blue-800">
                <span class="font-semibold">Title:</span>
                {{ currentMeeting.title || "Réunion" }}
              </p>
              <p class="text-sm text-blue-800">
                <span class="font-semibold">Date:</span>
                {{ formattedMeetingTime }}
              </p>
              <div
                v-if="countdownText"
                class="flex items-center gap-2 mt-3 text-blue-800"
              >
                <Clock class="w-4 h-4" />
                <span>{{ countdownText }}</span>
              </div>
            </div>
          </div>

          <!-- Available Meetings (Host only) -->
          <div
            v-else-if="
              props.isHost &&
              debugInfo.availableMeetings &&
              debugInfo.availableMeetings.length > 0
            "
            class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
          >
            <h3 class="font-semibold text-yellow-900 mb-2">
              Available Meetings
            </h3>
            <p class="text-xs text-yellow-700 mb-2">
              No active meeting selected. Available meetings:
            </p>
            <div class="space-y-2">
              <div
                v-for="meeting in debugInfo.availableMeetings"
                :key="meeting.id"
                class="p-2 bg-white rounded border border-yellow-200"
              >
                <p class="text-sm font-medium">{{ meeting.title }}</p>
                <p class="text-xs text-gray-600">
                  {{ formatMeetingDateTime(meeting.startTime) }}
                </p>
                <button
                  @click="currentMeetingId = meeting.id"
                  class="mt-1 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  Use this meeting
                </button>
              </div>
            </div>
          </div>

          <!-- No Meetings Message -->
          <div
            v-else
            class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
          >
            <p class="text-sm text-yellow-800">
              {{
                props.isHost
                  ? "No scheduled meetings found for this patient."
                  : "Informations de réunion non disponibles"
              }}
            </p>
          </div>
        </div>

        <!-- Meeting Preview Component with countdown -->
        <MeetingPreview
          v-model="mediaPreferences"
          @join="handleJoinMeeting"
          :meetingTime="meetingTime"
        />

        <!-- Meeting Agenda Component (Host only) -->
        <MeetingAgenda
          v-if="props.isHost"
          :patientId="props.roomId"
          :userName="patientDetails.name"
          class="m-5 p-5"
        />
      </template>

      <!-- Active Meeting Component -->
      <AgoraMeeting
        v-else
        :meetingId="props.isHost ? currentMeetingId : null"
        :channel="props.roomId"
        :enableCamera="mediaPreferences.isVideoEnabled"
        :enableMicrophone="mediaPreferences.isAudioEnabled"
        @left="handleLeft"
        :isHost="props.isHost"
        :user="props.isHost && props.session ? props.session.user : null"
      />
    </div>
  </div>
</template>
