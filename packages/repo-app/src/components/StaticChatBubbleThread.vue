<script setup>
import { ref, computed } from "vue";

const props = defineProps({
	messages: {
		type: Array,
		required: true,
		// Each message should have: role (user/assistant/system), content, timestamp
	},
	currentUserColor: {
		type: String,
		default: "rgb(249, 115, 22)", // Default orange color
	},
});

// State for managing which bubbles show timestamps
const showTimestamps = ref({});

// Helper function to format date to HH:mm
const formatMessageDate = (date) => {
	if (!date) return "";
	return new Date(date).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
};

// Helper function to calculate minutes between messages
const getMinutesDifference = (date1, date2) => {
	if (!date1 || !date2) return 0;
	return Math.floor((new Date(date1) - new Date(date2)) / (1000 * 60));
};

// Computed property to process messages and add time gaps and styling info
const processedMessages = computed(() => {
	return props.messages.map((message, index) => {
		const previousMessage = props.messages[index - 1];
		let timeGap = null;

		// Calculate time gap if both messages have timestamps
		if (previousMessage?.timestamp && message.timestamp) {
			const minutesDiff = getMinutesDifference(
				message.timestamp,
				previousMessage.timestamp,
			);
			if (minutesDiff > 1) {
				timeGap = `${minutesDiff} minutes later`;
			}
		}

		// Determine message styling based on role
		const isCurrentUser = message.role === "user";
		const isSystem = message.role === "system";

		// Add styling information
		const styles = {
			container: {
				justifyContent: isSystem
					? "center"
					: isCurrentUser
						? "flex-end"
						: "flex-start",
			},
			bubble: {
				backgroundColor: isSystem
					? "#f0f0f0"
					: isCurrentUser
						? props.currentUserColor
						: "#f3f4f6",
				color: isCurrentUser ? "white" : "black",
				maxWidth: isSystem ? "90%" : "70%",
			},
			timestamp: {
				color: isCurrentUser ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)",
			},
		};

		return {
			...message,
			timeGap,
			isCurrentUser,
			isSystem,
			styles,
		};
	});
});

// Method to toggle timestamp visibility
const toggleTimestamp = (index) => {
	showTimestamps.value = {
		...showTimestamps.value,
		[index]: !showTimestamps.value[index],
	};
};
</script>

<template>
  <div class="flex flex-col space-y-4 p-4">
    <div
      v-for="(message, index) in processedMessages"
      :key="index"
      class="flex flex-col"
    >
      <!-- Time gap indicator -->
      <div
        v-if="message.timeGap"
        class="text-center text-sm text-gray-500 my-2"
      >
        {{ message.timeGap }}
      </div>

      <!-- Message bubble container -->
      <div class="flex" :style="message.styles.container">
        <!-- Message bubble -->
        <div
          class="rounded-2xl px-4 py-2 cursor-pointer"
          :class="{
            'text-center': message.isSystem,
            'italic text-gray-600': message.isSystem,
          }"
          :style="message.styles.bubble"
          @click="toggleTimestamp(index)"
        >
          <!-- Role indicator for system messages -->
          <div
            v-if="message.isSystem"
            class="text-xs uppercase tracking-wide mb-1 opacity-50"
          >
            System Message
          </div>

          <!-- Message content -->
          <div class="break-words" style="white-space: pre-wrap">
            {{ message.content }}
          </div>

          <!-- Timestamp (shown when clicked) -->
          <div
            v-if="showTimestamps[index]"
            class="text-xs mt-1"
            :style="message.styles.timestamp"
          >
            {{ formatMessageDate(message.timestamp) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
