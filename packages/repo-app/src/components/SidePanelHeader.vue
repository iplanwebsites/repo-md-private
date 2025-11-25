<script setup>
import { ref, computed } from "vue";

import {
	MoreVertical,
	X,
	MessageSquare,
	FileText,
	AlertCircle,
	CheckCircle,
	CheckCircle2,
} from "lucide-vue-next";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";

const props = defineProps({
	title: {
		type: String,
		default: "",
	},
	backLink: {
		type: String,
		default: "",
	},
	completed: {
		type: Boolean,
		default: false,
	},
	elipsis: {
		type: Array,
		default: () => [],
	},
});
</script>

<template>
  <div class="flex items-center justify-between p-6 py-3">
    <h2 class="text-md font-semibold">
      {{ title }}
      <CheckCircle2
        v-if="props.completed"
        class="inline ml-2 w-5 h-5 text-green-500"
      />
    </h2>

    <div class="flex items-center gap-2">
      <ElipsisMenu :items="elipsis" v-if="elipsis.length" />

      <!--
      <DropdownMenu v-if="elipsis.length">
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon">
            <MoreVertical class="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-48" align="end">
          <template v-for="(item, index) in elipsis" :key="index">
            <DropdownMenuSeparator v-if="item.sep" />
            <DropdownMenuItem
              v-else
              @click="item.action"
              class="cursor-pointer"
            >
              <component :is="item.icon" class="mr-2 h-4 w-4" />
              <span>{{ item.label }}</span>
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
  -->
      <router-link :to="backLink">
        <Button variant="ghost" size="icon">
          <X class="h-5 w-5" />
        </Button>
      </router-link>
    </div>
  </div>

  <hr />
</template>
