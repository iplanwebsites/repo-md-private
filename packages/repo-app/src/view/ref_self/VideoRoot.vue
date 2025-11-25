<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import VideoHost from "@/view/VideoHost.vue";
import VideoJoin from "@/view/VideoJoin.vue";
//import VideoConf from "@/view/VideoConf_BADIDEA.vue";

// import { getAgoraService } from "@/lib/agoraService";
// Props definition
const { session } = defineProps({
	session: {
		type: Object,
		default: null,
	},
});

const route = useRoute();

// Determine if the user is a host based on session
const isHost = computed(() => {
	// Check if there's a valid session and user
	return session && session.user;
});

// Pass the roomId from the route params
const roomId = computed(() => {
	return route.params.roomId;
});
</script>

<template>
  <div>
    <!-- Conditional rendering based on session
       <VideoConf :roomId="roomId" :session="session" isHost="isHost" />
  -->
    <VideoHost v-if="isHost" :session="session" :roomId="roomId" />
    <VideoJoin v-else :roomId="roomId" :session="session" />
  </div>
</template>
