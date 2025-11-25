<script setup>
import {
	navigationItems,
	topLevelLinks,
	hiddenSectionInNavbar,
} from "./navigationItems.js";

import { computed } from "vue";

// Compute visible navigation items and group them if applicable
const visibleNavigationItems = computed(() => {
	const result = {};

	for (const [category, items] of Object.entries(navigationItems)) {
		// Skip categories that are hidden in navbar
		if (hiddenSectionInNavbar.includes(category)) {
			continue;
		}

		// Filter out items with hiddenNavbar property set to true
		const visibleItems = items.filter((item) => !item.hiddenNavbar);

		// Only add the category if it has visible items
		if (visibleItems.length > 0) {
			// Handle special case for Solutions category with grouping
			if (category === "Solutions") {
				// Create a grouped structure instead of a flat array
				const groupedItems = {};

				visibleItems.forEach((item) => {
					const group = item.group || "Default";
					if (!groupedItems[group]) {
						groupedItems[group] = [];
					}
					groupedItems[group].push(item);
				});

				result[category] = groupedItems;
			} else {
				// For other categories, keep the flat array structure
				result[category] = visibleItems;
			}
		}
	}

	return result;
});

// Determine if a category has grouped items
const hasGroupedItems = (category) => {
	return category === "Solutions";
};
</script>

<template>
  <NavigationMenu>
    <NavigationMenuList>
      <NavigationMenuItem
        v-for="(items, category) in visibleNavigationItems"
        :key="category"
      >
        <NavigationMenuTrigger>{{ category }}</NavigationMenuTrigger>
        <NavigationMenuContent>
          <div class="grid gap-2 p-3 md:w-[500px] lg:w-[600px]">
            <h3 class="hidden font-medium text-lg mb-1">
              {{ category }}
            </h3>

            <!-- Special handling for Solutions with grouped items -->
            <template v-if="hasGroupedItems(category)">
              <div class="grid grid-cols-2 gap-4">
                <div
                  v-for="(groupItems, groupName) in items"
                  :key="groupName"
                >
                  <h4 class="font-medium text-sm mb-1 text-muted-foreground">
                    {{ groupName }}
                  </h4>
                  <div class="grid grid-cols-1 gap-2">
                    <NavigationMenuLink
                      v-for="item in groupItems"
                      :key="item.name"
                      as-child
                    >
                      <a
                        :href="item.href"
                        class="flex flex-col gap-0.5 p-2 hover:bg-muted rounded-md transition-colors"
                      >
                        <div class="flex items-center gap-1.5">
                          <component
                            :is="item.icon"
                            class="h-3.5 w-3.5 text-primary"
                          />
                          <span class="font-medium text-sm">{{ item.name }}</span>
                        </div>
                        <p class="text-xs text-muted-foreground">
                          {{ item.description }}
                        </p>
                      </a>
                    </NavigationMenuLink>
                  </div>
                </div>
              </div>
            </template>

            <!-- Standard rendering for non-grouped categories -->
            <template v-else>
              <div class="grid grid-cols-2 gap-2">
                <NavigationMenuLink
                  v-for="item in items"
                  :key="item.name"
                  as-child
                >
                  <a
                    :href="item.href"
                    class="flex flex-col gap-0.5 p-2 hover:bg-muted rounded-md transition-colors"
                  >
                    <div class="flex items-center gap-1.5">
                      <component
                        :is="item.icon"
                        class="h-3.5 w-3.5 text-primary"
                      />
                      <span class="font-medium text-sm">{{ item.name }}</span>
                    </div>
                    <p class="text-xs text-muted-foreground">
                      {{ item.description }}
                    </p>
                  </a>
                </NavigationMenuLink>
              </div>
            </template>
          </div>
        </NavigationMenuContent>
      </NavigationMenuItem>

      <!-- Top-level links without dropdowns -->
      <NavigationMenuItem v-for="link in topLevelLinks" :key="link.name">
        <NavigationMenuLink as-child>
          <router-link
            :to="link.href"
            class="inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground"
          >
            {{ link.name }}
          </router-link>
        </NavigationMenuLink>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
</template>
