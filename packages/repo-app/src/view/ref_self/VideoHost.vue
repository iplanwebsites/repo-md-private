<script setup>
import { ref, onMounted, computed, onUnmounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Copy } from "lucide-vue-next";
import trpc from "@/trpc";
import MeetingPreview from "@/components/videoconf/MeetingPreview.vue";
import MeetingAgenda from "@/components/MeetingAgenda.vue";
import JsonDebug from "@/components/JsonDebug.vue";
import { useMeetingStore } from "@/store/meetingStore";
import {
	formatMeetingDateTime,
	sortMeetingsByProximity,
} from "@/lib/utils/meetingUtils";
import VideoMeet from "@/components/videoconf/VideoMeet.vue";
import MeetingInfo from "@/components/videoconf/ActiveMeetingInfo.vue";
import MeetingDetails from "../components/videoconf/MeetingDetails.vue";
import MeetingInvite from "@/components/videoconf/MeetingInvite.vue";

const route = useRoute();
const router = useRouter();
const meetingStore = useMeetingStore();

// Props definition with validation
const { session } = defineProps({
	session: {
		type: Object,
		required: true,
	},
});

// State Management
const patientDetails = ref({
	id: "loading.....",
	name: "",
	email: "",
	activities: [],
	notes: [],
	status: "",
	startDate: new Date().toISOString(),
});

const isAutoStart = true; // <== THIS WILL BE A SETTING
const videoMeet = ref(null);
const currentMeetingId = ref(null);
const status = ref("preview"); // "preview", "loading", "ongoing", "ended"
const loading = ref(false);

// Computed property for current meeting details
const currentMeeting = computed(() => {
	if (!currentMeetingId.value) return null;
	return (
		meetingStore.meets.find((meet) => meet.id === currentMeetingId.value) ||
		null
	);
});

// Get patient details from meetingStore using the new getPatient method
const fetchPatientDetails = async () => {
	try {
		loading.value = true;

		// Get patient from store with the new helper method
		const patient = await meetingStore.getPatient(route.params.roomId);

		if (patient) {
			// Use patient from store
			patientDetails.value = patient;
		} else {
			// Fallback to API if not in store
			const data = await trpc.getPatientDetails.query({
				patientId: route.params.roomId,
				includeActivities: true,
			});
			patientDetails.value = data;
		}
	} catch (err) {
		console.error("Error getting patient details:", err);
	} finally {
		loading.value = false;
	}
};

// Fetch the current meeting for this patient
const fetchCurrentMeeting = async () => {
	try {
		// First make sure we have meetings loaded
		if (meetingStore.meets.length === 0) {
			await meetingStore.fetchMeetings();
		}

		const patientId = route.params.roomId;

		// Filter meetings for this patient
		const patientMeets = meetingStore.meets.filter((meet) => {
			return meet.patientId === patientId && meet.status === "scheduled";
		});

		// Sort by proximity to current time using the utility
		const sortedMeets = sortMeetingsByProximity(patientMeets);

		// Get the closest meeting ID
		if (sortedMeets.length > 0) {
			currentMeetingId.value = sortedMeets[0].id;
			console.log(
				`Found meeting for patient ${patientId}: ${currentMeetingId.value}`,
			);

			// Also try to share this information with the server for consistency between host and guest
			try {
				//TODO: Implement setActiveRoomMeeting mutation

				await trpc.setActiveRoomMeeting.mutate({
					roomId: patientId,
					meetingId: currentMeetingId.value,
				});
			} catch (err) {
				console.error("Could not set active room meeting:", err);
				// Continue anyway - this is just for better sync
			}
		} else {
			console.log(`No scheduled meetings found for patient ${patientId}`);
			currentMeetingId.value = null;
		}
	} catch (err) {
		console.error("Error fetching current meeting:", err);
		currentMeetingId.value = null;
	}
};

// Meeting management
function handleLoading() {
	status.value = "loading";
}

function handleJoining() {
	status.value = "ongoing";
}

function handleEnding() {
	status.value = "ended";
}

function handlePreview() {
	status.value = "preview";
}

const preview = computed(() => {
	return status.value === "preview";
});

const ongoing = computed(() => {
	return status.value === "ongoing";
});

const ended = computed(() => {
	return status.value === "ended";
});

const recordingReady = computed(() => {
	return ongoing.value;
});

// Lifecycle hooks
onMounted(async () => {
	await Promise.all([fetchPatientDetails(), fetchCurrentMeeting()]);
});
</script>

<template>
  <div class="min-h-screen bg-gray-100 py-8 px-4 flex flex-col items-center">
    <div class="container flex flex-col gap-4">
      <ActiveMeetingInfo
        v-if="preview"
        :meeting="currentMeeting"
        :patientDetails="patientDetails"
        :meetingId="currentMeetingId"
        className="px-8 py-4"
      />

      <MeetingInvite
        v-if="preview"
        :patientDetails="patientDetails"
        :path="route.fullPath"
        className="px-8 py-4"
      />

      <VideoMeet
        ref="videoMeet"
        className="px-8 py-4"
        :channel="route.params.roomId"
        :isHost="true"
        :session="session || null"
        :status="status"
        :meeting="currentMeeting"
        :meetingId="currentMeetingId"
        @preview="handlePreview"
        @loading="handleLoading"
        @joining="handleJoining"
        @ending="handleEnding"
      />

      <MeetingDetails
        v-if="preview"
        :meeting="currentMeeting"
        :meetingId="currentMeetingId"
        :patientDetails="patientDetails"
        className="px-8 py-4"
      />

      <MeetingAgenda
        v-if="preview"
        :patientId="route.params.roomId"
        :userName="patientDetails.name"
        className="px-8 py-4"
      />
    </div>
  </div>
</template>
