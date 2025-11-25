# Button.vue
<script setup>
defineProps({
	onClick: {
		type: Function,
		required: true,
	},
	icon: {
		type: Object,
		required: true,
	},
	className: {
		type: String,
		default: "bg-gray-600",
	},
});
</script>

<template>
  <button
    @click="onClick"
    class="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90"
    :class="className"
  >
    <component :is="icon" :size="16" />
    <slot></slot>
  </button>
</template>

# SessionStopped.vue
<script setup>
import { ref } from "vue";
import { CloudLightning } from "lucide-vue-next";
import Button from "./Button.vue";

const props = defineProps({
  startSession: {
    type: Function,
    required: true,
  },
});

const isActivating = ref(false);

const handleStartSession = () => {
  if (isActivating.value) return;
  isActivating.value = true;
  props.startSession();
};
</script>

<template>
  <div class="flex items-center justify-center w-full h-full">
    <Button
      :onClick="handleStartSession"
      :className="isActivating ? 'bg-gray-600' : 'bg-red-600'"
      :icon="CloudLightning"
    >
      {{ isActivating ? "starting session..." : "start session" }}
    </Button>
  </div>
</template>

# SessionActive.vue
<script setup>
import { ref } from "vue";
import { CloudOff, MessageSquare } from "lucide-vue-next";
import Button from "./Button.vue";

const props = defineProps({
  stopSession: {
    type: Function,
    required: true,
  },
  sendTextMessage: {
    type: Function,
    required: true,
  },
});

const message = ref("");

const handleSendClientEvent = () => {
  if (!message.value.trim()) return;
  props.sendTextMessage(message.value);
  message.value = "";
};
</script>

<template>
  <div class="flex items-center justify-center w-full h-full gap-4">
    <input
      type="text"
      placeholder="send a text message..."
      class="border border-gray-200 rounded-full p-4 flex-1"
      v-model="message"
      @keydown.enter="handleSendClientEvent"
    />
    <Button
      :onClick="handleSendClientEvent"
      :icon="MessageSquare"
      className="bg-blue-400"
    >
      send text
    </Button>
    <Button :onClick="stopSession" :icon="CloudOff"> disconnect </Button>
  </div>
</template>

# SessionControls.vue
<script setup>
import SessionActive from "./SessionActive.vue";
import SessionStopped from "./SessionStopped.vue";

defineProps({
  startSession: {
    type: Function,
    required: true,
  },
  stopSession: {
    type: Function,
    required: true,
  },
  sendClientEvent: {
    type: Function,
    required: true,
  },
  sendTextMessage: {
    type: Function,
    required: true,
  },
  serverEvents: {
    type: Array,
    required: true,
  },
  isSessionActive: {
    type: Boolean,
    required: true,
  },
});
</script>

<template>
  <div class="flex gap-4 border-t-2 border-gray-200 h-full rounded-md">
    <SessionActive
      v-if="isSessionActive"
      :stop-session="stopSession"
      :send-client-event="sendClientEvent"
      :send-text-message="sendTextMessage"
      :server-events="serverEvents"
    />
    <SessionStopped v-else :start-session="startSession" />
  </div>
</template>
