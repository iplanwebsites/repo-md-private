<script setup>
import { Github } from "lucide-vue-next";
import { computed, defineProps, defineEmits } from "vue";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const props = defineProps({
	modelValue: {
		type: String,
		default: "",
	},
	availableScopes: {
		type: Array,
		default: () => [],
	},
	loading: {
		type: Boolean,
		default: false,
	},
	label: {
		type: String,
		default: "Git Scope",
	},
});

const emit = defineEmits(["update:modelValue"]);

const selectedScope = computed({
	get: () => props.modelValue,
	set: (value) => emit("update:modelValue", value),
});
</script>

<template>
  <div>
    <label class="block text-sm text-muted-foreground mb-2">{{ label }}</label>
    <div class="relative">
      <!-- Loading state for git scopes -->
      <div
        v-if="loading"
        class="flex items-center justify-between bg-muted border border-border rounded-md px-4 py-2 w-full h-[42px]"
      >
        <div class="flex items-center">
          <div
            class="w-6 h-6 flex items-center justify-center bg-primary/30 rounded-full mr-2 animate-pulse"
          ></div>
          <div
            class="h-4 bg-primary/20 rounded w-20 animate-pulse"
          ></div>
        </div>
      </div>

      <!-- Git scope selector -->
      <Select
        v-else
        v-model="selectedScope"
        @update:modelValue="$emit('update:modelValue', $event)"
      >
        <SelectTrigger
          class="flex items-center justify-between bg-muted border border-border rounded-md px-4 py-2 w-full"
        >
          <div class="flex items-center">
            <template
              v-if="
                availableScopes.find(
                  (scope) => scope.value === selectedScope
                )?.avatar
              "
            >
              <img
                :src="
                  availableScopes.find(
                    (scope) => scope.value === selectedScope
                  )?.avatar
                "
                class="w-6 h-6 rounded-full mr-2"
                alt="Git scope avatar"
              />
            </template>
            <span
              v-else
              class="w-6 h-6 flex items-center justify-center bg-primary rounded-full text-xs mr-2 text-primary-foreground"
            >
              <Github size="12" />
            </span>
            {{ selectedScope }}
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="scope in availableScopes"
            :key="scope.value"
            :value="scope.value"
          >
            <div class="flex items-center">
              <template v-if="scope.avatar">
                <img
                  :src="scope.avatar"
                  class="w-6 h-6 rounded-full mr-2"
                  alt="Git scope avatar"
                />
              </template>
              <span
                v-else
                class="w-6 h-6 flex items-center justify-center bg-primary rounded-full text-xs mr-2 text-primary-foreground"
              >
                <Github size="12" />
              </span>
              {{ scope.label }}
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
</template>