<script lang="ts" setup>
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";
import { Slash } from "lucide-vue-next";
//ChevronRight
const props = defineProps<{
	class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <li
    role="presentation"
    aria-hidden="true"
    :class="cn('[&>svg]:w-3.5 [&>svg]:h-3.5', props.class)"
  >
    <slot>
      <Slash style="opacity: 0.2" />
    </slot>
  </li>
</template>
