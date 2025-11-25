<!-- BibliLayout.vue -->
<script setup>
import { useRoute } from "vue-router";
import { HelpCircle, Brain, Sprout } from "lucide-vue-next";
import { computed } from "vue";
import PageHeadingBar from "@/components/PageHeadingBar.vue";
import { Button } from "@/components/ui/button";

const route = useRoute();

const isExtrasRoute = computed(() => {
	return route.path.includes("/bibli/extras");
});
</script>

<template>
  <div class="" style="background: #f6f5f3">
    <div class="container mx-auto p-6">
      <PageHeadingBar title="Bibliothèque  ">
        <Button variant="ghost" size="icon" class="ml-2">
          <HelpCircle class="h-5 w-5" />
        </Button>
      </PageHeadingBar>

      <div class="bg-white rounded-lg shadow p-6">
        <!-- Tab Navigation -->
        <div class="border-b mb-6">
          <div class="flex -mb-px">
            <router-link
              to="/bibli"
              class="py-2 px-4 font-medium text-sm flex items-center gap-2 border-b-2 mr-4"
              :class="
                !isExtrasRoute
                  ? 'text-primary border-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              "
            >
              <Brain class="h-4 w-4" />
              Explorations
              <span
                class="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-primary rounded-full"
                >8</span
              >
            </router-link>

            <router-link
              to="/bibli/extras"
              class="py-2 px-4 font-medium text-sm flex items-center gap-2 border-b-2"
              :class="
                isExtrasRoute
                  ? 'text-primary border-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              "
            >
              <Sprout class="h-4 w-4" />
              Guide et outils
              <span
                class="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-primary rounded-full"
                >50</span
              >
            </router-link>
          </div>
        </div>

        <!-- Router View for Sub-Pages -->
        <router-view />
      </div>
    </div>
  </div>
  <BrochureFooter class=" " />
</template>

<style scoped>
.text-muted-foreground {
  color: hsl(var(--muted-foreground));
}
.text-foreground {
  color: hsl(var(--foreground));
}
.text-primary {
  color: hsl(var(--primary));
}
.bg-primary {
  background-color: hsl(var(--primary));
}
.border-primary {
  border-color: hsl(var(--primary));
}
</style>
