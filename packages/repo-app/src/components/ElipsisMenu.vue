<!-- ElipsisMenu.vue -->
<script setup>
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, MoreHorizontal } from "lucide-vue-next";
import ActionSheet from "./ActionSheet.vue";
import { isMobile } from "@/lib/utils/isMobileUtil";
import { useRouter } from "vue-router";

const props = defineProps({
	hori: {
		type: Boolean,
		default: false,
	},
	items: {
		type: Array,
		required: true,
		validator: (items) => {
			return items.every((item) => {
				if (item.sep) return true;
				return (
					typeof item.label === "string" &&
					(typeof item.action === "function" || typeof item.to === "string") &&
					(item.icon === undefined || typeof item.icon === "object")
				);
			});
		},
	},
	align: {
		type: String,
		default: "end",
		validator: (value) => ["start", "end", "center"].includes(value),
	},
	menuWidth: {
		type: String,
		default: "w-48",
	},
	title: {
		type: String,
		default: "Options",
	},
	info: {
		type: String,
		default: "",
	},
	mobile: {
		type: Boolean,
		default: isMobile(),
	},
});

const emit = defineEmits(["select"]);
const router = useRouter();
</script>

<template>
  <!-- Use ActionSheet for mobile devices -->
  <ActionSheet
    v-if="mobile && items.length"
    :items="items"
    :hori="hori"
    :title="title"
    :description="info"
    @select="(item) => emit('select', item)"
  >
    <slot>
      <Button variant="ghost" size="icon">
        <MoreHorizontal v-if="hori" class="h-5 w-5" />
        <MoreVertical v-else class="h-5 w-5" />
      </Button>
    </slot>
  </ActionSheet>

  <!-- Use DropdownMenu for desktop -->
  <DropdownMenu v-else-if="items.length">
    <DropdownMenuTrigger as-child>
      <slot>
        <Button variant="ghost" size="icon">
          <MoreHorizontal v-if="hori" class="h-5 w-5" />
          <MoreVertical v-else class="h-5 w-5" />
        </Button>
      </slot>
    </DropdownMenuTrigger>

    <DropdownMenuContent :class="menuWidth" :align="align">
      <template v-for="(item, index) in items" :key="index">
        <DropdownMenuSeparator v-if="item.sep" />
        <DropdownMenuItem
          v-else
          @click="
            () => {
              if (item.action) item.action();
              if (item.to) router.push(item.to);
              emit('select', item);
            }
          "
          class="cursor-pointer"
        >
          <component v-if="item.icon" :is="item.icon" class="mr-2 h-4 w-4" />
          <span>{{ item.label }}</span>
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
