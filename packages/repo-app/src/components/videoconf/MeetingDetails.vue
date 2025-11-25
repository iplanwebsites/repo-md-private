<script setup>
import { formatMeetingDateTime } from "@/lib/utils/meetingUtils";

// PROPS
const { patientDetails, meeting, meetingId, className } = defineProps({
	patientDetails: {
		type: {},
		default: null,
	},
	meeting: {
		type: {},
		default: null,
	},
	meetingId: {
		type: String,
		default: "",
	},
	className: {
		type: String,
		default: "",
	},
});
</script>

<template>
  <div
    v-if="meeting"
    class="p-3 bg-blue-50 border border-blue-200 rounded-lg"
    :class="className"
  >
    <h3 class="font-semibold text-blue-900 mb-2">Meeting Details</h3>
    <div class="space-y-1">
      <p class="text-sm text-blue-800">
        <span class="font-semibold">Meeting ID:</span>
        {{ meetingId }}
      </p>
      <p class="text-sm text-blue-800">
        <span class="font-semibold">Title:</span>
        {{ meeting.title }}
      </p>
      <p class="text-sm text-blue-800">
        <span class="font-semibold">Scheduled for:</span>
        {{ formatMeetingDateTime(meeting.startTime) }}
      </p>
      <p class="text-sm text-blue-800">
        <span class="font-semibold">Duration:</span>
        {{ meeting.duration }} minutes
      </p>
      <p class="text-sm text-blue-800">
        <span class="font-semibold">Status:</span>
        <span
          class="rounded-full px-2 py-0.5 text-xs"
          :class="
            meeting.status === 'scheduled'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          "
        >
          {{ meeting.status }}
        </span>
      </p>
    </div>
  </div>
</template>
