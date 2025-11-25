<!-- MeetCalendar.vue -->
<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	formatTime,
	formatDayDate,
	formatMonthYear,
	formatShortDate,
} from "@/lib/utils/dateUtils";
import {
	Calendar,
	Clock,
	ChevronLeft,
	ChevronRight,
	User,
	Video,
	Plus,
} from "lucide-vue-next";
import { RouterLink } from "vue-router";

const props = defineProps({
	meets: {
		type: Array,
		required: true,
		default: () => [],
	},
	showDummyMeets: {
		type: Boolean,
		default: false,
	},
});

const emit = defineEmits(["clickScheduleMeet"]);

// State for calendar
const currentDate = ref(new Date());
const selectedView = ref("week");
const selectedDate = ref(new Date());

// Generate dummy events for testing
const dummyEvents = [
	{
		id: "dummy1",
		title: "Consultation patient #4578",
		startTime: new Date(),
		duration: 60,
		patientId: "4578",
		type: "consultation",
	},
	{
		id: "dummy2",
		title: "Suivi post-opératoire",
		startTime: new Date(new Date().setHours(new Date().getHours() + 3)),
		duration: 60,
		patientId: "3215",
		type: "follow-up",
	},
	{
		id: "dummy3",
		title: "Consultation urgente",
		startTime: new Date(new Date().setDate(new Date().getDate() + 2)),
		duration: 45,
		patientId: "9876",
		type: "urgent",
	},
	{
		id: "dummy4",
		title: "Examen pré-opératoire",
		startTime: new Date(new Date().setDate(new Date().getDate() + 2)),
		duration: 45,
		patientId: "6543",
		type: "exam",
	},
];

// Combine real and dummy meets if needed, filter out past meetings
const allEvents = computed(() => {
	const now = new Date();

	const realEvents = props.meets
		.filter((meet) => {
			// Filter out past meetings
			const meetingStart = new Date(meet.startTime);
			return meetingStart >= now && meet.status !== "canceled";
		})
		.map((meet) => ({
			...meet,
			type: getEventType(meet.title),
		}));

	// Filter dummy events to also exclude past events
	const filteredDummyEvents = props.showDummyMeets
		? dummyEvents.filter((event) => {
				const eventStart = new Date(event.startTime);
				return eventStart >= now;
			})
		: [];

	return props.showDummyMeets
		? [...realEvents, ...filteredDummyEvents]
		: realEvents;
});

// Calendar calculations
const daysInMonth = computed(() => {
	const year = currentDate.value.getFullYear();
	const month = currentDate.value.getMonth();
	return new Date(year, month + 1, 0).getDate();
});

const firstDayOfMonth = computed(() => {
	const year = currentDate.value.getFullYear();
	const month = currentDate.value.getMonth();
	return new Date(year, month, 1).getDay();
});

const days = computed(() => {
	// Create array for all days in the month
	const daysArray = [];
	const year = currentDate.value.getFullYear();
	const month = currentDate.value.getMonth();

	// Add empty cells for days before the 1st of month
	const firstDay = firstDayOfMonth.value;
	for (let i = 0; i < firstDay; i++) {
		daysArray.push({ day: null, date: null, events: [] });
	}

	// Add actual days of the month with their events
	for (let i = 1; i <= daysInMonth.value; i++) {
		const date = new Date(year, month, i);
		const dayEvents = allEvents.value.filter((event) => {
			const eventDate = new Date(event.startTime);
			return (
				eventDate.getDate() === date.getDate() &&
				eventDate.getMonth() === date.getMonth() &&
				eventDate.getFullYear() === date.getFullYear()
			);
		});

		daysArray.push({
			day: i,
			date: date,
			events: dayEvents,
		});
	}

	return daysArray;
});

const monthName = computed(() => {
	return formatMonthYear(currentDate.value);
});

const weekDays = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const weekDates = computed(() => {
	const dates = [];
	// Get the current date
	const date = new Date(selectedDate.value);

	// Calculate the start of the week (Monday as first day of week)
	const dayOfWeek = date.getDay();
	const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
	const monday = new Date(date.setDate(diff));

	// Reset selectedDate to original
	selectedDate.value = new Date();

	// Create array of dates for the week
	for (let i = 0; i < 7; i++) {
		const currentDay = new Date(monday);
		currentDay.setDate(monday.getDate() + i);
		dates.push(currentDay);
	}

	return dates;
});

const dayEvents = computed(() => {
	return allEvents.value.filter((event) => {
		const eventDate = new Date(event.startTime);
		return (
			eventDate.getDate() === selectedDate.value.getDate() &&
			eventDate.getMonth() === selectedDate.value.getMonth() &&
			eventDate.getFullYear() === selectedDate.value.getFullYear()
		);
	});
});

// Actions
const nextMonth = () => {
	currentDate.value = new Date(
		currentDate.value.getFullYear(),
		currentDate.value.getMonth() + 1,
		1,
	);
};

const prevMonth = () => {
	currentDate.value = new Date(
		currentDate.value.getFullYear(),
		currentDate.value.getMonth() - 1,
		1,
	);
};

const selectDate = (date) => {
	if (date) {
		selectedDate.value = date;
		selectedView.value = "day";
	}
};

// Format time using utility function (already imported)

// Calculate end time based on start time and duration
const getEndTime = (startTime, duration) => {
	if (!startTime) return "";
	const start = new Date(startTime);
	const end = new Date(start);
	end.setMinutes(end.getMinutes() + duration);
	return formatTime(end);
};

// Determine event type based on title or other properties
const getEventType = (title) => {
	const titleLower = title.toLowerCase();
	if (titleLower.includes("urgent")) return "urgent";
	if (titleLower.includes("suivi")) return "follow-up";
	if (titleLower.includes("exam") || titleLower.includes("pré-op"))
		return "exam";
	return "consultation";
};

const getEventClass = (type) => {
	switch (type) {
		case "consultation":
			return "bg-blue-100 text-blue-800 border-blue-300";
		case "follow-up":
			return "bg-green-100 text-green-800 border-green-300";
		case "urgent":
			return "bg-red-100 text-red-800 border-red-300";
		case "exam":
			return "bg-purple-100 text-purple-800 border-purple-300";
		default:
			return "bg-gray-100 text-gray-800 border-gray-300";
	}
};

// Using formatDayDate from our utilities

const currentTime = ref("");

const updateCurrentTime = () => {
	const now = new Date();
	currentTime.value = formatTime(now);
};

// Emit schedule meeting event
const scheduleMeet = () => {
	emit("clickScheduleMeet");
};

onMounted(() => {
	updateCurrentTime();
	setInterval(updateCurrentTime, 60000); // Update every minute
});
</script>

<template>
  <div class="calendar-container">
    <Card class="p-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold flex items-center gap-2">
          <Calendar class="h-6 w-6" />
          Calendrier
        </h2>
        <div class="flex items-center">
          <!-- 
          <Button @click="scheduleMeet" class="mr-4">
            <Plus class="h-4 w-4 mr-2" />
            Planifier un rendez-vous
          </Button>
           -->
          <p class="mr-4 text-sm text-muted-foreground">{{ currentTime }}</p>
          <Tabs v-model="selectedView" class="w-auto">
            <TabsList>
              <TabsTrigger value="day">Jour</TabsTrigger>
              <TabsTrigger value="week">Semaine</TabsTrigger>
              <TabsTrigger value="month">Mois</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <!-- Day View -->
      <div v-if="selectedView === 'day'" class="day-view">
        <div class="flex justify-between items-center mb-4">
          <Button
            variant="outline"
            size="sm"
            @click="
              selectedDate = new Date(
                selectedDate.setDate(selectedDate.getDate() - 1)
              )
            "
          >
            <ChevronLeft class="h-4 w-4" />
          </Button>
          <h3 class="text-xl font-medium">{{ formatDayDate(selectedDate) }}</h3>
          <Button
            variant="outline"
            size="sm"
            @click="
              selectedDate = new Date(
                selectedDate.setDate(selectedDate.getDate() + 1)
              )
            "
          >
            <ChevronRight class="h-4 w-4" />
          </Button>
        </div>

        <div class="day-schedule space-y-4 mt-6">
          <div
            v-if="dayEvents.length === 0"
            class="text-center py-12 text-muted-foreground"
          >
            Aucun rendez-vous programmé pour cette journée
          </div>

          <RouterLink
            v-for="event in dayEvents"
            :key="event.id"
            :to="`/meets/${event.id}`"
            class="block no-underline"
          >
            <div
              class="event-card p-4 border rounded-md hover:shadow-md transition-shadow"
              :class="getEventClass(event.type)"
            >
              <div class="flex justify-between items-start">
                <div>
                  <h4 class="font-medium">{{ event.title }}</h4>
                  <div class="flex items-center text-sm mt-1">
                    <Clock class="h-4 w-4 mr-1" />
                    <span>
                      {{ formatTime(event.startTime) }} -
                      {{ getEndTime(event.startTime, event.duration) }}
                      ({{ event.duration }} min)
                    </span>
                  </div>
                  <div class="flex items-center text-sm mt-1">
                    <User class="h-4 w-4 mr-1" />
                    <span>Patient #{{ event.patientId }}</span>
                  </div>
                </div>
                <Video class="h-5 w-5" />
              </div>
            </div>
          </RouterLink>
        </div>
      </div>

      <!-- Week View -->
      <div v-else-if="selectedView === 'week'" class="week-view">
        <div class="flex justify-between items-center mb-4">
          <Button
            variant="outline"
            size="sm"
            @click="
              selectedDate = new Date(
                selectedDate.setDate(selectedDate.getDate() - 7)
              )
            "
          >
            <ChevronLeft class="h-4 w-4" />
          </Button>
          <h3 class="text-lg font-medium">
            Semaine du
            {{ formatShortDate(weekDates[0]) }}
          </h3>
          <Button
            variant="outline"
            size="sm"
            @click="
              selectedDate = new Date(
                selectedDate.setDate(selectedDate.getDate() + 7)
              )
            "
          >
            <ChevronRight class="h-4 w-4" />
          </Button>
        </div>

        <div class="week-grid grid grid-cols-7 gap-2 mt-2">
          <div
            v-for="(date, index) in weekDates"
            :key="index"
            class="day-column border rounded-md p-2"
          >
            <div class="text-center mb-2 pb-2 border-b">
              <div class="text-sm font-medium">
                {{ weekDays[date.getDay()] }}
              </div>
              <div
                class="text-lg"
                :class="{
                  'text-blue-600 font-bold':
                    date.getDate() === new Date().getDate() &&
                    date.getMonth() === new Date().getMonth(),
                }"
              >
                {{ date.getDate() }}
              </div>
            </div>

            <div class="day-events space-y-2">
              <RouterLink
                v-for="event in allEvents.filter((e) => {
                  const eDate = new Date(e.startTime);
                  return (
                    eDate.getDate() === date.getDate() &&
                    eDate.getMonth() === date.getMonth() &&
                    eDate.getFullYear() === date.getFullYear()
                  );
                })"
                :key="event.id"
                :to="`/meets/${event.id}`"
                class="block no-underline"
              >
                <div
                  class="text-xs p-1 rounded border-l-4 hover:shadow-sm transition-shadow"
                  :class="getEventClass(event.type)"
                >
                  <div class="font-medium truncate">{{ event.title }}</div>
                  <div class="flex items-center mt-1">
                    <Clock class="h-3 w-3 mr-1" />
                    <span>{{ formatTime(event.startTime) }}</span>
                  </div>
                </div>
              </RouterLink>
            </div>
          </div>
        </div>
      </div>

      <!-- Month View -->
      <div v-else class="month-view">
        <div class="flex justify-between items-center mb-4">
          <Button variant="outline" size="sm" @click="prevMonth">
            <ChevronLeft class="h-4 w-4" />
          </Button>
          <h3 class="text-xl font-medium capitalize">{{ monthName }}</h3>
          <Button variant="outline" size="sm" @click="nextMonth">
            <ChevronRight class="h-4 w-4" />
          </Button>
        </div>

        <div class="month-grid">
          <div class="grid grid-cols-7 mb-2">
            <div
              v-for="day in weekDays"
              :key="day"
              class="text-center font-medium text-sm py-2"
            >
              {{ day }}
            </div>
          </div>

          <div class="grid grid-cols-7 gap-1">
            <div
              v-for="(day, index) in days"
              :key="index"
              class="day-cell min-h-[80px] p-1 border rounded-md"
              :class="{
                'bg-gray-50': !day.day,
                'cursor-pointer hover:bg-gray-100': day.day,
              }"
              @click="day.day && selectDate(day.date)"
            >
              <div v-if="day.day" class="flex flex-col h-full">
                <div
                  class="day-number text-right p-1"
                  :class="{
                    'font-bold text-blue-600 bg-blue-50 rounded-full w-7 h-7 flex items-center justify-center ml-auto':
                      day.date.getDate() === new Date().getDate() &&
                      day.date.getMonth() === new Date().getMonth() &&
                      day.date.getFullYear() === new Date().getFullYear(),
                  }"
                >
                  {{ day.day }}
                </div>
                <div class="events-list mt-1 flex-grow overflow-hidden">
                  <RouterLink
                    v-for="event in day.events.slice(0, 2)"
                    :key="event.id"
                    :to="`/meets/${event.id}`"
                    class="block no-underline"
                    @click.stop
                  >
                    <div
                      class="event-dot text-xs truncate mb-1 px-1 py-0.5 rounded hover:shadow-sm transition-shadow"
                      :class="getEventClass(event.type)"
                    >
                      {{ event.title }}
                    </div>
                  </RouterLink>
                  <div
                    v-if="day.events.length > 2"
                    class="text-xs text-gray-500 ml-1"
                  >
                    + {{ day.events.length - 2 }} plus
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.day-cell {
  aspect-ratio: 1.2;
}

.month-grid {
  user-select: none;
}

.event-dot {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
