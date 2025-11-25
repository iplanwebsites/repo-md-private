<!-- RankingQuestion.vue -->
<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { ArrowUp, ArrowDown, GripVertical } from "lucide-vue-next";

const props = defineProps({
	lastQuestion: {
		type: Boolean,
		default: false,
	},
	question: {
		type: Object,
		required: true,
		validator: (value) => {
			return value.options && Array.isArray(value.options);
		},
	},
	value: {
		type: Array,
		default: () => [],
	},
});

const emit = defineEmits(["submit"]);

// Initialize the ranked items state
const rankedItems = ref([]);
const draggedItem = ref(null);
const dragOverItem = ref(null);
const listRef = ref(null);

// Watch for changes in the question options and initialize/update the ranking
watch(
	() => props.question.options,
	(newOptions) => {
		// If we have a saved value, use that order
		if (props.value && props.value.length > 0) {
			rankedItems.value = props.value.map((rankData, index) => {
				const option = newOptions.find((opt) => opt.id === rankData.id);
				return {
					...option,
					currentRank: rankData.rank || index + 1,
				};
			});
		} else {
			// Otherwise, initialize with default order
			rankedItems.value = newOptions.map((option, index) => ({
				...option,
				currentRank: index + 1,
			}));
		}
	},
	{ immediate: true },
);

// Computed property to check if the ranking is valid
const isValid = computed(() => {
	if (!props.question.required) return true;
	const ranks = rankedItems.value.map((item) => item.currentRank);
	const uniqueRanks = new Set(ranks);
	return uniqueRanks.size === rankedItems.value.length;
});

// Function to move an item up in the ranking
const moveUp = (index) => {
	if (index > 0) {
		const newItems = [...rankedItems.value];
		// Swap ranks
		const temp = newItems[index].currentRank;
		newItems[index].currentRank = newItems[index - 1].currentRank;
		newItems[index - 1].currentRank = temp;
		// Sort by rank
		rankedItems.value = newItems.sort((a, b) => a.currentRank - b.currentRank);
		emitUpdate();
	}
};

// Function to move an item down in the ranking
const moveDown = (index) => {
	if (index < rankedItems.value.length - 1) {
		const newItems = [...rankedItems.value];
		// Swap ranks
		const temp = newItems[index].currentRank;
		newItems[index].currentRank = newItems[index + 1].currentRank;
		newItems[index + 1].currentRank = temp;
		// Sort by rank
		rankedItems.value = newItems.sort((a, b) => a.currentRank - b.currentRank);
		emitUpdate();
	}
};

// Emit the updated ranking to the parent component
const emitUpdate = () => {
	const rankingData = rankedItems.value.map((item) => ({
		id: item.id,
		rank: item.currentRank,
	}));
	emit("submit", rankingData);
};

// Get background color based on rank position
const getBackgroundColor = (rank) => {
	if (!isValid.value) return "bg-gray-50";
	const intensity = Math.max(95 - rank * 5, 50); // Darker blue for higher ranks
	return `bg-blue-${intensity}`;
};

// Get text color based on validation state
const getTextColor = (isSelected) => {
	if (!isValid.value) return "text-gray-500";
	return isSelected ? "text-blue-700" : "text-gray-700";
};

// ===== Drag and Drop Functionality =====

// Handle drag start event
const handleDragStart = (e, item, index) => {
	// Set data transfer properties for drag and drop
	e.dataTransfer.effectAllowed = "move";
	// Required for Firefox to enable drag
	e.dataTransfer.setData("text/plain", index.toString());

	// Add styling to show item is being dragged
	setTimeout(() => {
		e.target.closest(".ranking-item").classList.add("dragging");
	}, 0);

	draggedItem.value = { item, index };
};

// Handle drag over event
const handleDragOver = (e, item, index) => {
	e.preventDefault();
	dragOverItem.value = { item, index };

	// Add visual indicator for drop target
	const items = document.querySelectorAll(".ranking-item");
	items.forEach((item) => item.classList.remove("drag-over"));
	e.target.closest(".ranking-item").classList.add("drag-over");
};

// Handle drop event
const handleDrop = (e) => {
	e.preventDefault();

	if (draggedItem.value !== null && dragOverItem.value !== null) {
		const draggedIndex = draggedItem.value.index;
		const dropIndex = dragOverItem.value.index;

		if (draggedIndex !== dropIndex) {
			// Create a copy of the array
			const newItems = [...rankedItems.value];

			// Get the item being dragged
			const draggedItemValue = newItems[draggedIndex];

			// Remove the item from its original position
			newItems.splice(draggedIndex, 1);

			// Insert the item at the new position
			newItems.splice(dropIndex, 0, draggedItemValue);

			// Update ranks based on new positions
			newItems.forEach((item, index) => {
				item.currentRank = index + 1;
			});

			// Update the state
			rankedItems.value = newItems;
			emitUpdate();
		}
	}

	// Reset drag state
	draggedItem.value = null;
	dragOverItem.value = null;

	// Remove all drag-related styling
	const items = document.querySelectorAll(".ranking-item");
	items.forEach((item) => {
		item.classList.remove("dragging");
		item.classList.remove("drag-over");
	});
};

// Handle drag end event (cleanup)
const handleDragEnd = () => {
	// Reset drag state
	draggedItem.value = null;
	dragOverItem.value = null;

	// Remove all drag-related styling
	const items = document.querySelectorAll(".ranking-item");
	items.forEach((item) => {
		item.classList.remove("dragging");
		item.classList.remove("drag-over");
	});
};

// ===== Touch Support for Mobile =====
const touchStartY = ref(0);
const touchedItem = ref(null);
const isTouching = ref(false);

// Handle touch start
const handleTouchStart = (e, item, index) => {
	touchStartY.value = e.touches[0].clientY;
	touchedItem.value = { item, index };
	isTouching.value = true;

	// Add visual feedback
	setTimeout(() => {
		if (isTouching.value) {
			e.target.closest(".ranking-item").classList.add("touching");
		}
	}, 200); // Small delay to prevent flicker on scroll
};

// Handle touch move
const handleTouchMove = (e) => {
	if (!touchedItem.value) return;

	const touchY = e.touches[0].clientY;
	const touchedElement = e.target.closest(".ranking-item");
	const container = listRef.value;

	if (!touchedElement || !container) return;

	// Get all ranking items
	const items = [...container.querySelectorAll(".ranking-item")];
	const touchedIndex = items.indexOf(touchedElement);

	// Find the item we're hovering over
	const itemHeight = touchedElement.offsetHeight;
	const hoverIndex = Math.floor(
		(touchY - container.getBoundingClientRect().top) / itemHeight,
	);

	if (
		hoverIndex >= 0 &&
		hoverIndex < items.length &&
		hoverIndex !== touchedIndex
	) {
		// Visual feedback for the potential drop target
		items.forEach((item) => item.classList.remove("drag-over"));
		items[hoverIndex]?.classList.add("drag-over");
		dragOverItem.value = {
			item: rankedItems.value[hoverIndex],
			index: hoverIndex,
		};
	}
};

// Handle touch end
const handleTouchEnd = (e) => {
	isTouching.value = false;

	if (touchedItem.value && dragOverItem.value) {
		const touchedIndex = touchedItem.value.index;
		const dropIndex = dragOverItem.value.index;

		if (touchedIndex !== dropIndex) {
			// Create a copy of the array
			const newItems = [...rankedItems.value];

			// Get the item being touched/dragged
			const touchedItemValue = newItems[touchedIndex];

			// Remove the item from its original position
			newItems.splice(touchedIndex, 1);

			// Insert the item at the new position
			newItems.splice(dropIndex, 0, touchedItemValue);

			// Update ranks based on new positions
			newItems.forEach((item, index) => {
				item.currentRank = index + 1;
			});

			// Update the state
			rankedItems.value = newItems;
			emitUpdate();
		}
	}

	// Reset touch state
	touchedItem.value = null;
	dragOverItem.value = null;

	// Remove all touch-related styling
	const items = document.querySelectorAll(".ranking-item");
	items.forEach((item) => {
		item.classList.remove("touching");
		item.classList.remove("drag-over");
	});
};
</script>

<template>
  <div class="w-full max-w-2xl mx-auto">
    <!-- Description and Instructions 
    <div class="mb-4">
      <p v-if="question.description" class="text-gray-600 mb-2">
        {{ question.description }}
      </p>
      <p class="text-sm text-gray-500">
        Drag items or use the arrow buttons to arrange them in your preferred
        order.
      </p>
    </div>
    -->

    <!-- Ranking List -->
    <div ref="listRef" class="space-y-2">
      <div
        v-for="(item, index) in rankedItems"
        :key="item.id"
        class="ranking-item flex items-center p-4 rounded-lg border-2 transition-all duration-200 shadow-sm hover:shadow-md"
        :class="[
          getBackgroundColor(item.currentRank),
          item.currentRank === 1 ? 'border-blue-500' : 'border-transparent',
        ]"
        draggable="true"
        @dragstart="handleDragStart($event, item, index)"
        @dragover="handleDragOver($event, item, index)"
        @drop="handleDrop"
        @dragend="handleDragEnd"
        @touchstart="handleTouchStart($event, item, index)"
        @touchmove="handleTouchMove($event)"
        @touchend="handleTouchEnd"
      >
        <!-- Drag Handle -->
        <div class="flex items-center mr-2 cursor-grab touch-manipulation">
          <GripVertical class="w-6 h-6 text-gray-400" />
        </div>

        <!-- Rank Number -->
        <div
          class="flex items-center justify-center w-12 h-12 rounded-full bg-white shadow-sm"
        >
          <span
            class="text-xl font-bold"
            :class="getTextColor(item.currentRank === 1)"
          >
            {{ item.currentRank }}
          </span>
        </div>

        <!-- Item Content -->
        <div class="flex-grow px-4">
          <h4 class="font-medium" :class="getTextColor(item.currentRank === 1)">
            {{ item.text }}
          </h4>
        </div>

        <!-- Control Buttons -->
        <div class="flex flex-col gap-1">
          <button
            @click="moveUp(index)"
            :disabled="index === 0"
            class="p-2 rounded-full hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
            :class="{ 'text-gray-400': index === 0 }"
            :aria-label="'Move ' + item.text + ' up'"
          >
            <ArrowUp class="w-5 h-5" />
          </button>
          <button
            @click="moveDown(index)"
            :disabled="index === rankedItems.length - 1"
            class="p-2 rounded-full hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
            :class="{ 'text-gray-400': index === rankedItems.length - 1 }"
            :aria-label="'Move ' + item.text + ' down'"
          >
            <ArrowDown class="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Validation Message -->
    <div v-if="question.required && !isValid" class="mt-4 text-sm text-red-500">
      Please rank all items to continue
    </div>
  </div>
</template>

<style>
/* Drag and drop styles */
.ranking-item {
  cursor: pointer;
  user-select: none;
  /* Improve touch handling */
  touch-action: none;
}

.ranking-item.dragging {
  opacity: 0.5;
  border: 2px dashed #3b82f6 !important;
  background-color: rgba(59, 130, 246, 0.05) !important;
}

.ranking-item.drag-over {
  border: 2px solid #3b82f6 !important;
  position: relative;
}

.ranking-item.drag-over::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: -4px;
  height: 4px;
  background-color: #3b82f6;
  border-radius: 2px;
}

.ranking-item.touching {
  opacity: 0.8;
  transform: scale(1.02);
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
  z-index: 10;
  border: 2px dashed #3b82f6 !important;
}
</style>
