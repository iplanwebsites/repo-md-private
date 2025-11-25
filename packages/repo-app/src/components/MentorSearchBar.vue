<script setup>
import { ref, computed, watch } from "vue";
import { Search, Calendar, Users, FileText } from "lucide-vue-next";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

// Search state
const searchOpen = ref(false);
const searchQuery = ref("");

// Sample data
const searchData = {
	clients: [
		{ id: 1, name: "Marie Dupont", email: "marie.dupont@example.com" },
		{ id: 2, name: "Jean Martin", email: "jean.martin@example.com" },
		{ id: 3, name: "Sophie Moreau", email: "sophie.moreau@example.com" },
		{ id: 4, name: "Thomas Bernard", email: "thomas.bernard@example.com" },
		{ id: 5, name: "Lucie Petit", email: "lucie.petit@example.com" },
	],
	appointments: [
		{ id: 1, name: "Session coaching", date: "14 mars, 14:00" },
		{ id: 2, name: "Bilan mensuel", date: "20 mars, 10:30" },
		{ id: 3, name: "Consultation initiale", date: "16 mars, 09:00" },
		{ id: 4, name: "Suivi hebdomadaire", date: "18 mars, 15:30" },
		{ id: 5, name: "Atelier de groupe", date: "22 mars, 18:00" },
	],
	articles: [
		{
			id: 1,
			name: "Comment améliorer votre productivité",
			date: "10 mars 2025",
		},
		{ id: 2, name: "5 astuces pour mieux dormir", date: "5 mars 2025" },
		{ id: 3, name: "Nutrition et performance", date: "28 février 2025" },
		{ id: 4, name: "Gérer le stress au quotidien", date: "15 février 2025" },
		{ id: 5, name: "Mindfulness pour débutants", date: "1 février 2025" },
	],
};

// Filtered results based on search query
const filteredClients = computed(() => {
	if (!searchQuery.value.trim()) return searchData.clients.slice(0, 3);

	return searchData.clients.filter(
		(client) =>
			client.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
			client.email.toLowerCase().includes(searchQuery.value.toLowerCase()),
	);
});

const filteredAppointments = computed(() => {
	if (!searchQuery.value.trim()) return searchData.appointments.slice(0, 3);

	return searchData.appointments.filter(
		(appointment) =>
			appointment.name
				.toLowerCase()
				.includes(searchQuery.value.toLowerCase()) ||
			appointment.date.toLowerCase().includes(searchQuery.value.toLowerCase()),
	);
});

const filteredArticles = computed(() => {
	if (!searchQuery.value.trim()) return searchData.articles.slice(0, 3);

	return searchData.articles.filter(
		(article) =>
			article.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
			article.date.toLowerCase().includes(searchQuery.value.toLowerCase()),
	);
});

// Handle item selection
function handleSelectItem(item, type) {
	searchQuery.value = "";
	searchOpen.value = false;

	// In a real app, you would navigate to the selected item
	console.log(`Selected ${type}:`, item);
	// router.push({ name: `${type}-details`, params: { id: item.id } });
}

// Close popover when clicking outside
function onPopoverClose() {
	// Reset search after a delay to prevent flicker during transition
	setTimeout(() => {
		if (!searchOpen.value) {
			searchQuery.value = "";
		}
	}, 300);
}
</script>

<template>
  <div class="relative w-full max-w-xl">
    <Popover
      v-model:open="searchOpen"
      @update:open="!searchOpen && onPopoverClose()"
    >
      <PopoverTrigger as-child>
        <div class="flex items-center relative w-full">
          <Search class="absolute left-3 w-4 h-4 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            type="search"
            placeholder="Rechercher clients, rendez-vous, articles..."
            class="pl-10 w-full border-0 focus:ring-0 focus-visible:ring-0 bg-accent/30 focus:bg-accent/50"
            @focus="searchOpen = true"
          />
        </div>
      </PopoverTrigger>

      <!-- Command UI for search results -->
      <PopoverContent class="p-0 w-full" align="start">
        <Command class="rounded-lg border shadow-md">
          <CommandInput
            v-model="searchQuery"
            placeholder="Rechercher clients, rendez-vous, articles..."
            class="h-9"
          />
          <CommandList>
            <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>

            <!-- Clients section -->
            <CommandGroup heading="Clients" v-if="filteredClients.length">
              <CommandItem
                v-for="client in filteredClients"
                :key="`client-${client.id}`"
                :value="`client-${client.name}`"
                @select="() => handleSelectItem(client, 'client')"
              >
                <Users class="mr-2 h-4 w-4" />
                <div class="flex flex-col">
                  <span>{{ client.name }}</span>
                  <span class="text-xs text-muted-foreground">{{
                    client.email
                  }}</span>
                </div>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator
              v-if="
                filteredClients.length &&
                (filteredAppointments.length || filteredArticles.length)
              "
            />

            <!-- Appointments section -->
            <CommandGroup
              heading="Rendez-vous"
              v-if="filteredAppointments.length"
            >
              <CommandItem
                v-for="appointment in filteredAppointments"
                :key="`appointment-${appointment.id}`"
                :value="`appointment-${appointment.name}`"
                @select="() => handleSelectItem(appointment, 'appointment')"
              >
                <Calendar class="mr-2 h-4 w-4" />
                <div class="flex flex-col">
                  <span>{{ appointment.name }}</span>
                  <span class="text-xs text-muted-foreground">{{
                    appointment.date
                  }}</span>
                </div>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator
              v-if="filteredAppointments.length && filteredArticles.length"
            />

            <!-- Articles section -->
            <CommandGroup heading="Articles" v-if="filteredArticles.length">
              <CommandItem
                v-for="article in filteredArticles"
                :key="`article-${article.id}`"
                :value="`article-${article.name}`"
                @select="() => handleSelectItem(article, 'article')"
              >
                <FileText class="mr-2 h-4 w-4" />
                <div class="flex flex-col">
                  <span>{{ article.name }}</span>
                  <span class="text-xs text-muted-foreground">{{
                    article.date
                  }}</span>
                </div>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>
</template>
