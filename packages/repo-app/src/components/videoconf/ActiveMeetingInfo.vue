<script setup>
import { formatMeetingDateTime } from "@/lib/utils/meetingUtils";
import Button from "../ui/button/Button.vue";

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

// FORMATTING METHODS
const isComponentVisible = computed(() => {
	return patientDetails && meeting && meetingId;
});
</script>

<template v-if="isComponentVisible">
  <div v-if="meeting"
    class="bg-blue-600 text-white rounded-lg shadow-md p-3"
    :class="className"
  >
    <div class="flex items-center justify-between">
      <div class="flex flex-col gap-4">
        <div>
          <h2 class="font-bold text-lg">
            Active Meeting: {{ meeting.title }}
          </h2>

          <p class="text-blue-100">
            {{ formatMeetingDateTime(meeting.startTime) }}
          </p>
        </div>
        
        <div class="px-3 py-1 rounded-full bg-blue-500 text-sm w-fit">
          Patient: {{ patientDetails.name }}
        </div>
      </div>

      <div>
        <router-link :to="'/meets/' + meetingId">
          <Button class="bg-white text-blue-600 hover:bg-blue-100">
            Voir le détail de la réunion
          </Button>
        </router-link>
      </div>
    </div>
  </div>
</template>