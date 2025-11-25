<script setup>
import { onMounted, onUnmounted } from "vue";
import { Clock } from "lucide-vue-next";

// PROPS
const { status, meetingTime, className } = defineProps({
	status: {
		type: String,
		default: "preview",
	},
	meetingTime: {
		type: [String, Date, null],
		default: null,
	},
	className: {
		type: String,
		default: "",
	},
});

// REFS
const interval = ref(null);

// EMITERS
const emit = defineEmits(["joinMeeting"]);

// EVENT MANAGERS
function handleClick() {
	emit("joinMeeting");
}

// FORMATTING METHODS
const formattedMeetingTime = computed(() => {
	if (!meetingTime) return null;

	const meetingDate = new Date(meetingTime);
	return new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		day: "numeric",
		month: "long",
		hour: "2-digit",
		minute: "2-digit",
	}).format(meetingDate);
});

const countdownText = computed(() => {
	if (!meetingTime) return null;

	const meetingDate = new Date(meetingTime);
	const now = new Date();

	// If meeting is in the past
	if (meetingDate < now) {
		return "La réunion a déjà commencé";
	}

	// Calculate time difference
	const diff = meetingDate - now;
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

	// Format countdown text
	if (days > 0) {
		return `Démarre dans ${days} jour${days > 1 ? "s" : ""} et ${hours}h`;
	} else if (hours > 0) {
		return `Démarre dans ${hours}h${minutes > 0 ? ` ${minutes}min` : ""}`;
	} else if (minutes > 0) {
		return `Démarre dans ${minutes} minute${minutes > 1 ? "s" : ""}`;
	} else {
		return "Démarre maintenant";
	}
});

onMounted(() => {
	interval.value = setInterval(() => {
		// Force computed property to reevaluate
		// We just need to access it to trigger the reevaluation
		return countdownText;
	}, 1000);
});

onUnmounted(() => {
	if (interval.value) clearInterval(interval.value);
});
</script>
<template>
  <div class="flex flex-col items-center gap-8" :class="className">
    <div v-if="meetingTime" class="w-full flex flex-col items-center">
      <div class="flex items-center gap-2 text-blue-600 font-medium">
        <Clock class="size-5" />
        <span>{{ countdownText }}</span>
      </div>
      <div class="ps-7 text-sm text-gray-500">
        {{ formattedMeetingTime }}
      </div>
    </div>

    <div class="flex flex-col items-center justify-center gap-4">
      <button
        @click="handleClick"
        class="w-full py-4 px-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
      >
        Démarrer la réunion
      </button>
      <p class="text-gray-600 text-sm text-center">
        Votre vidéo et audio seront activés lorsque vous rejoindrez la réunion
      </p>
    </div>
  </div>
</template>
