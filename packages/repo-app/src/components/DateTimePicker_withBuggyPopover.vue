<script setup>
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, Clock } from "lucide-vue-next";
import { computed, ref, watch, nextTick } from "vue";
import { cn } from "@/lib/utils";
import {
	CalendarDate,
	CalendarDateTime,
	getLocalTimeZone,
	today,
	toZoned,
	DateFormatter,
} from "@internationalized/date";
import { toDate } from "reka-ui/date";

const props = defineProps({
	modelValue: {
		type: Object,
		default: () => {
			// Create a default CalendarDateTime with current time
			const now = new Date();
			const todayDate = today(getLocalTimeZone());
			return new CalendarDateTime(
				todayDate.year,
				todayDate.month,
				todayDate.day,
				now.getHours(),
				Math.floor(now.getMinutes() / 15) * 15, // Round to nearest 15 min
			);
		},
	},
	disabled: {
		type: Boolean,
		default: false,
	},
	placeholder: {
		type: String,
		default: "Sélectionner une date et heure",
	},
});

const emit = defineEmits(["update:modelValue"]);

// Create date formatter for display
const dateFormatter = new DateFormatter("en-US", {
	dateStyle: "long",
	timeStyle: "short",
});

// State for selected date
const selectedDate = ref(null);

// Control popover open state
const isOpen = ref(false);

// We need to track hours and minutes separately since CalendarDate doesn't include time
const selectedHour = ref("12");
const selectedMinute = ref("00");

// Flag to prevent recursive updates
const isUpdating = ref(false);

// Generate hours options (00-23)
const hours = Array.from({ length: 24 }, (_, i) =>
	i.toString().padStart(2, "0"),
);

// Generate minutes options (00, 15, 30, 45)
const minutes = ["00", "15", "30", "45"];

// Format the selected date and time for display
const formattedDateTime = computed(() => {
	try {
		// If we have a complete date time value
		if (props.modelValue) {
			// Convert to JavaScript Date for formatting
			return dateFormatter.format(
				toDate(toZoned(props.modelValue, getLocalTimeZone())),
			);
		}
		return props.placeholder;
	} catch (error) {
		console.error("Error formatting date:", error);
		return props.placeholder;
	}
});

// Initialize component state from props
const initializeFromModelValue = () => {
	if (isUpdating.value) return;

	try {
		if (props.modelValue) {
			// Set selected date from model value (extract date part only)
			selectedDate.value = new CalendarDate(
				props.modelValue.year,
				props.modelValue.month,
				props.modelValue.day,
			);

			// Set time components
			selectedHour.value = props.modelValue.hour.toString().padStart(2, "0");
			selectedMinute.value = props.modelValue.minute
				.toString()
				.padStart(2, "0");
		} else {
			// Default to today
			selectedDate.value = today(getLocalTimeZone());

			// Default time
			const now = new Date();
			selectedHour.value = now.getHours().toString().padStart(2, "0");
			selectedMinute.value = (Math.floor(now.getMinutes() / 15) * 15)
				.toString()
				.padStart(2, "0");
		}
	} catch (error) {
		console.error("Error initializing from model value:", error);
		// Reset to defaults on error
		selectedDate.value = today(getLocalTimeZone());
		selectedHour.value = "12";
		selectedMinute.value = "00";
	}
};

// Update the full date/time when components change
const updateDateTime = () => {
	if (isUpdating.value || !selectedDate.value) return;

	try {
		isUpdating.value = true;

		// Create a new CalendarDateTime object
		const newDateTime = new CalendarDateTime(
			selectedDate.value.year,
			selectedDate.value.month,
			selectedDate.value.day,
			parseInt(selectedHour.value, 10),
			parseInt(selectedMinute.value, 10),
		);

		// Emit the updated value
		emit("update:modelValue", newDateTime);

		// Reset update flag after a small delay
		nextTick(() => {
			isUpdating.value = false;
		});
	} catch (error) {
		console.error("Error updating date time:", error);
		isUpdating.value = false;
	}
};

// Watch for model value changes
watch(
	() => props.modelValue,
	() => {
		if (!isUpdating.value) {
			isUpdating.value = true;
			initializeFromModelValue();
			nextTick(() => {
				isUpdating.value = false;
			});
		}
	},
	{ immediate: true, deep: true },
);

// Watch for date changes
watch(
	selectedDate,
	() => {
		if (!isUpdating.value && selectedDate.value) {
			updateDateTime();
		}
	},
	{ deep: true },
);

// Watch for time changes
watch(
	[selectedHour, selectedMinute],
	() => {
		if (!isUpdating.value && selectedDate.value) {
			updateDateTime();
		}
	},
	{ deep: true },
);

// Handle date selection - ensure popover stays open
const handleDateSelect = (date) => {
	if (date) {
		selectedDate.value = date;
		// Force popover to stay open
		isOpen.value = true;
	}
};

// Confirm and close handler
const handleConfirm = () => {
	isOpen.value = false;
};

// Initialize component on mount
initializeFromModelValue();
</script>

<template>
  <Popover v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button
        :disabled="disabled"
        variant="outline"
        :class="
          cn(
            'w-full justify-start text-left font-normal',
            !props.modelValue ? 'text-muted-foreground' : ''
          )
        "
      >
        <CalendarIcon class="mr-2 h-4 w-4" />
        <span>{{ formattedDateTime }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0" align="start">
      <Calendar
        v-model="selectedDate"
        :weekday-format="'short'"
        calendar-label="Date selection"
        mode="single"
        class="p-3 rounded-t-md border-b"
        @update:model-value="handleDateSelect"
      />
      <div class="p-3 border-t">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <Clock class="h-4 w-4 text-muted-foreground" />
            <span class="text-sm text-muted-foreground">Heure</span>
          </div>
          <div class="flex space-x-2">
            <Select v-model="selectedHour">
              <SelectTrigger class="w-[70px]">
                <SelectValue :placeholder="selectedHour" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="hour in hours" :key="hour" :value="hour">
                  {{ hour }}
                </SelectItem>
              </SelectContent>
            </Select>
            <span class="flex items-center text-muted-foreground">:</span>
            <Select v-model="selectedMinute">
              <SelectTrigger class="w-[70px]">
                <SelectValue :placeholder="selectedMinute" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="minute in minutes"
                  :key="minute"
                  :value="minute"
                >
                  {{ minute }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div class="p-3 border-t">
        <Button variant="outline" class="w-full" @click="handleConfirm">
          Confirmer
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
