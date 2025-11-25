# Event.vue
<script setup>
import { ref } from "vue";
import { ArrowUp, ArrowDown } from "lucide-vue-next";

const props = defineProps({
	event: {
		type: Object,
		required: true,
	},
	timestamp: {
		type: String,
		required: true,
	},
});

const isExpanded = ref(false);
const isClient = computed(
	() => props.event.event_id && !props.event.event_id.startsWith("event_"),
);
</script>

<template>
  <div class="flex flex-col gap-2 p-2 rounded-md bg-gray-50">
    <div
      class="flex items-center gap-2 cursor-pointer"
      @click="isExpanded = !isExpanded"
    >
      <ArrowDown v-if="isClient" class="text-blue-400" />
      <ArrowUp v-else class="text-green-400" />
      <div class="text-sm text-gray-500">
        {{ isClient ? "client:" : "server:" }}
        &nbsp;{{ event.type }} | {{ timestamp }}
      </div>
    </div>
    <div
      class="text-gray-500 bg-gray-200 p-2 rounded-md overflow-x-auto"
      :class="{ hidden: !isExpanded }"
    >
      <pre class="text-xs">{{ JSON.stringify(event, null, 2) }}</pre>
    </div>
  </div>
</template>

# EventLog.vue
<script setup>
import { computed } from "vue";
import Event from "./Event.vue";

const props = defineProps({
  events: {
    type: Array,
    required: true,
    default: () => [],
  },
});

const eventsToDisplay = computed(() => {
  const deltaEvents = {};
  return props.events.filter((event) => {
    if (event.type.endsWith("delta")) {
      if (deltaEvents[event.type]) {
        // for now just log a single event per render pass
        return false;
      } else {
        deltaEvents[event.type] = event;
        return true;
      }
    }
    return true;
  });
});
</script>

<template>
  <div class="flex flex-col gap-2 overflow-x-auto">
    <div v-if="events.length === 0" class="text-gray-500">
      Awaiting events...
    </div>
    <template v-else>
      <Event
        v-for="event in eventsToDisplay"
        :key="event.event_id"
        :event="event"
        :timestamp="new Date().toLocaleTimeString()"
      />
    </template>
  </div>
</template>
