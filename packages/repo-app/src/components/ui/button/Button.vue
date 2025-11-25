<script setup lang="ts">
import { Primitive, type PrimitiveProps } from "reka-ui";
import { buttonVariants } from ".";
import { cn } from "@/lib/utils";
import { RouterLink } from "vue-router";
import { computed, useAttrs } from "vue";

interface Props extends PrimitiveProps {
	variant?: NonNullable<Parameters<typeof buttonVariants>[0]>["variant"];
	size?: NonNullable<Parameters<typeof buttonVariants>[0]>["size"];
	as?: string;
	to?: string;
	href?: string;
}

const props = withDefaults(defineProps<Props>(), {
	as: "button",
});

const $attrs = useAttrs();

const attrsWithoutClass = computed(() =>
	Object.fromEntries(Object.entries($attrs).filter(([k]) => k !== "class")),
);

const baseClass = computed(() =>
	cn(
		buttonVariants({ variant: props.variant, size: props.size }),
		$attrs.class as string,
	),
);
</script>

<template>
  <RouterLink v-if="to" :to="to">
    <Primitive
      :as="as"
      v-bind="attrsWithoutClass"
      :class="baseClass"
      role="link"
      tabindex="0"
    >
      <slot />
    </Primitive>
  </RouterLink>

  <a v-else-if="href" :href="href" target="_blank" rel="noopener noreferrer">
    <Primitive :as="as" v-bind="attrsWithoutClass" :class="baseClass">
      <slot />
    </Primitive>
  </a>

  <Primitive v-else :as="as" v-bind="attrsWithoutClass" :class="baseClass">
    <slot />
  </Primitive>
</template>
