<script setup>
import { computed } from "vue";
import {
	User,
	Baby,
	Users,
	Coffee,
	Heart,
	Star,
	Zap,
	MessageCircle,
} from "lucide-vue-next";

const props = defineProps({
	plainTranscript: {
		type: String,
		required: true,
	},
	speakers: {
		type: Array,
		required: true,
	},
	summary: {
		type: String,
		default: "",
	},
});

// Predefined colors array
const colors = [
	"#3B82F6", // blue
	"#EC4899", // pink
	"#10B981", // green
	"#F59E0B", // amber
	"#8B5CF6", // purple
	"#EF4444", // red
	"#6366F1", // indigo
	"#F97316", // orange
];

// Predefined icons array
const icons = [User, Baby, Users, Coffee, Heart, Star, Zap, MessageCircle];

const processedMessages = computed(() => {
	// Split the transcript into lines and filter out empty lines
	const lines = props.plainTranscript
		.split("\n")
		.filter((line) => line.trim() !== "");

	// Process each line to extract speaker and text
	return lines.map((line) => {
		// Find the colon that separates speaker from message
		const colonIndex = line.indexOf(":");

		if (colonIndex === -1) {
			// If no colon found, treat the whole line as text with unknown speaker
			return {
				name: "Unknown",
				text: line,
				role: "participant",
				color: colors[0],
				icon: User,
			};
		}

		// Extract speaker name and message text
		const speakerName = line.substring(0, colonIndex).trim();
		const text = line.substring(colonIndex + 1).trim();

		// Find matching speaker in the provided speakers array
		const speaker = props.speakers.find((s) => s.name === speakerName);

		if (speaker) {
			// Determine the color and icon based on speaker id
			const colorIndex = (speaker.id - 1) % colors.length;
			const iconIndex = (speaker.id - 1) % icons.length;

			// Special icon for Speaker 2 (baby)
			const icon = speaker.name === "Speaker 2" ? Baby : icons[iconIndex];

			return {
				name: speaker.name,
				text,
				role: speaker.role || "participant",
				color: colors[colorIndex],
				icon,
			};
		}

		// Fallback for speakers not found in the speakers array
		return {
			name: speakerName,
			text,
			role: "participant",
			color: colors[0],
			icon: User,
		};
	});
});
</script>

<template>
  <div class="max-w-2xl mx-auto p-4">
    <!-- Summary box if provided -->
    <div v-if="summary" class="bg-gray-100 p-4 rounded-lg mb-6 shadow">
      <h3 class="text-lg font-medium mb-2 pre">Summary</h3>
      <p class="text-gray-700 pre">
        <pre> {{ summary }}
        </pre>
        </p>
    </div>

    <!-- Messages list -->
    <ul class="space-y-3">
      <li
        v-for="(message, index) in processedMessages"
        :key="index"
        class="flex items-start p-3 rounded-lg"
        :style="{ backgroundColor: `${message.color}10` }"
      >
        <div
          class="flex items-center justify-center w-10 h-10 rounded-full mr-3 flex-shrink-0"
          :style="{ backgroundColor: message.color }"
        >
          <component :is="message.icon" class="w-5 h-5 text-white" />
        </div>
        <div class="flex-1">
          <div class="flex items-center mb-1">
            <span class="font-medium mr-2">{{ message.name }}</span>
            <span class="text-xs text-gray-500">{{ message.role }}</span>
          </div>
          <p class="text-gray-800">{{ message.text }}</p>
        </div>
      </li>
    </ul>
  </div>
</template>
