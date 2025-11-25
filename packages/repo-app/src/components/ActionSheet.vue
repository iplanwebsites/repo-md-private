<!-- ActionSheet.vue -->
<script setup>
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
	SheetClose,
} from "@/components/ui/sheet";
import { MoreVertical, MoreHorizontal } from "lucide-vue-next";
import { ref } from "vue";
import { useRouter } from "vue-router";

const props = defineProps({
	hori: {
		type: Boolean,
		default: false,
	},
	cancelLabel: {
		type: String,
		default: "Fermer",
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
	title: {
		type: String,
		default: "Actions",
	},
	description: {
		type: String,
		default: "Select an action from the list below",
	},
});

const emit = defineEmits(["select"]);

const isOpen = ref(false);
const router = useRouter();
</script>

<template>
  <div>
    <Sheet v-model:open="isOpen">
      <SheetTrigger as-child>
        <slot>
          <Button variant="ghost" size="icon">
            <MoreHorizontal v-if="hori" class="h-5 w-5" />
            <MoreVertical v-else class="h-5 w-5" />
          </Button>
        </slot>
      </SheetTrigger>
      <SheetContent side="bottom" class="sm:max-w-md mx-auto">
        <SheetHeader>
          <SheetTitle>{{ title }}</SheetTitle>
          <SheetDescription>
            {{ description }}
          </SheetDescription>
        </SheetHeader>
        <div class="grid gap-3 py-4">
          <template v-for="(item, index) in items" :key="index">
            <div v-if="item.sep" class="h-px bg-border my-1"></div>
            <Button
              v-else
              variant="outline"
              class="flex justify-start h-12"
              @click="() => {
                if (item.action) item.action();
                if (item.to) router.push(item.to);
                emit('select', item);
                isOpen.value = false;
              }"
            >
              <component
                v-if="item.icon"
                :is="item.icon"
                class="mr-2 h-5 w-5"
              />
              <span>{{ item.label }}</span>
            </Button>
          </template>
        </div>
        <SheetFooter>
          <Button variant="secondary" @click="isOpen = false">{{
            cancelLabel
          }}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  </div>
</template>
