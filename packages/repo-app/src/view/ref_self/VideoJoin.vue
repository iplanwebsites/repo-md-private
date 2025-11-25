<script setup>
import { ref } from "vue";
import { useRoute } from "vue-router";
import VideoMeet from "@/components/videoconf/VideoMeet.vue";
import MeetingInvite from "@/components/videoconf/MeetingInvite.vue";

// Props definition with validation
const { session } = defineProps({
	session: {
		type: Object,
		required: false,
		default: null,
	},
});
const route = useRoute();
const status = ref("preview");
const loading = ref(false);

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

const ended = computed(() => {
	return status.value === "ended";
});

const ongoing = computed(() => {
	return status.value === "ongoing";
});
</script>

<template>
  <div class="min-h-screen bg-gray-100 py-8 px-4 flex flex-col items-center">
    <div class="container w-full flex flex-col gap-4">
      <VideoMeet
        v-if="!ended"
        className="px-8 py-4"
        :channel="route.params.roomId"
        :isHost="false"
        :status="status"
        @preview="handlePreview"
        @loading="handleLoading"
        @joining="handleJoining"
        @ending="handleEnding"
      />
    </div>
  </div>
</template>
