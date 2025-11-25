<!-- MatrixLikert.vue -->
<script setup>
import { ref, computed } from "vue";
import { CheckCircle } from "lucide-vue-next";

const props = defineProps({
	lastQuestion: {
		type: Boolean,
		default: false,
	},
	question: {
		type: Object,
		required: true,
		validator: (value) => {
			return (
				value.statements &&
				Array.isArray(value.statements) &&
				value.scale &&
				typeof value.scale.min === "number" &&
				typeof value.scale.max === "number" &&
				value.scale.labels
			);
		},
	},
	selected: {
		type: Object,
		default: () => ({}),
	},
});

const emit = defineEmits(["select"]);

const responses = ref({ ...props.selected });

const scalePoints = computed(() => {
	return Array.from(
		{ length: props.question.scale.max - props.question.scale.min + 1 },
		(_, i) => {
			const value = props.question.scale.min + i;
			return { value, label: props.question.scale.labels[value.toString()] };
		},
	);
});

const handleSelection = (statementId, value) => {
	responses.value = {
		...responses.value,
		[statementId]: value,
	};
	emit("select", responses.value);
};

const getStyles = (statementId, value) => {
	const isSelected = responses.value[statementId] === value;
	return {
		background: isSelected ? "bg-blue-50" : "bg-gray-50 hover:bg-gray-100",
		text: isSelected ? "text-blue-700" : "text-gray-700",
		border: isSelected ? "border-blue-500" : "border-transparent",
	};
};

const isComplete = computed(() => {
	return props.question.statements.every(
		(statement) => responses.value[statement.id] !== undefined,
	);
});
</script>

<template>
  <div class="w-full">
    <div class="overflow-x-auto">
      <table class="min-w-full border-collapse">
        <thead>
          <tr>
            <th class="w-1/3 p-4 border-b text-left"></th>
            <th
              v-for="point in scalePoints"
              :key="point.value"
              class="p-4 border-b text-center font-medium text-sm"
            >
              <div class="flex flex-col items-center">
                <span class="text-lg mb-1">{{ point.value }}</span>
                <span class="text-xs">{{ point.label }}</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="statement in question.statements"
            :key="statement.id"
            class="border-b hover:bg-gray-50"
          >
            <td class="p-4 text-left">
              {{ statement.text }}
            </td>
            <td
              v-for="point in scalePoints"
              :key="`${statement.id}-${point.value}`"
              class="p-2 text-center"
            >
              <button
                @click="handleSelection(statement.id, point.value)"
                class="w-full h-12 relative flex items-center justify-center rounded-lg border-2 transition-all duration-200"
                :class="[
                  getStyles(statement.id, point.value).background,
                  getStyles(statement.id, point.value).text,
                  getStyles(statement.id, point.value).border,
                ]"
                :aria-label="`Rate '${statement.text}' as ${point.label}`"
              >
                <CheckCircle
                  v-if="responses[statement.id] === point.value"
                  class="w-6 h-6 text-blue-500 absolute"
                />
                <span
                  v-if="responses[statement.id] === point.value"
                  class="text-lg font-semibold"
                >
                  {{ point.value }}
                </span>
                <span class="sr-only">{{ point.label }}</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      class="mt-4 text-sm"
      :class="isComplete ? 'text-green-600' : 'text-gray-600'"
    >
      {{ isComplete ? "Complété" : "Complétez toutes les lignes" }}
    </div>
  </div>
</template>
