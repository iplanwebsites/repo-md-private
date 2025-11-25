# ClientBreadcrumb.vue
<script setup>
import { ref, computed } from "vue";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Users } from "lucide-vue-next";

import { ChevronDown, Home } from "lucide-vue-next";

const props = defineProps({
	clientName: {
		type: String,
		required: false,
		default: "",
	},
	programName: {
		type: String,
		required: false,
		default: "",
	},
	activityName: {
		type: String,
		required: false,
		default: "",
	},
	clientId: {
		type: [String, Number],
		required: false,
	},
	programId: {
		type: [String, Number],
		required: false,
	},
	activityId: {
		type: [String, Number],
		required: false,
	},
	clients: {
		type: Array,
		required: false,
		default: () => [],
		//default: () => [{ name: 234 }],
	},
});

const filteredClients = computed(() => props.clients.filter((c) => true));
</script>

<template>
  <div class="hidden md:block">
    <Breadcrumb>
      <BreadcrumbList>
        <!-- Home -->
        <BreadcrumbItem>
          <BreadcrumbLink href="/">
            <Home class="w-4 h-4" />
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        <!-- Clients -->
        <BreadcrumbItem>
          <BreadcrumbLink href="/client">
            <div>Clients</div>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <!-- Client Name -->
        <template v-if="clientName">
          <BreadcrumbSeparator />

          <!--  
        <BreadcrumbItem>
          <BreadcrumbLink :href="`/client/${clientId}`">
            {{ clientName }}
          </BreadcrumbLink>
        </BreadcrumbItem>
        -->

          <BreadcrumbItem>
            <div class="flex items-center gap-1">
              <BreadcrumbLink :href="`/client/${clientId}`">
                {{ clientName }}
              </BreadcrumbLink>
              <DropdownMenu v-if="filteredClients.length > 1">
                <DropdownMenuTrigger class="p-1 hover:bg-gray-100 rounded">
                  <ChevronDown class="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  class="max-h-64 overflow-y-auto"
                >
                  <DropdownMenuItem
                    v-for="c in filteredClients"
                    :key="c.id"
                    @click="$router.push(`/client/${c.id}`)"
                    class="cursor-pointer"
                  >
                    <div class="flex flex-col">
                      <span>{{ c.name }}</span>
                      <span class="text-xs text-gray-500">
                        {{ c.description }}
                      </span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </BreadcrumbItem>
        </template>

        <!-- Program Name 
      <template v-if="programName">
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink :href="`/client/${clientId}/${programId}`">
            {{ programName }}
          </BreadcrumbLink>
        </BreadcrumbItem>
      </template>
      -->

        <!-- Activity Name -->
        <template v-if="activityName">
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <span class="text-muted-foreground">{{ activityName }}</span>
          </BreadcrumbItem>
        </template>
      </BreadcrumbList>
    </Breadcrumb>

    <hr class="my-5" />
  </div>
</template>
