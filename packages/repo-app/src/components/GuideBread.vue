# GuideBread.vue
<script setup>
import { ref, computed } from "vue";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { BookOpen, Home } from "lucide-vue-next";

const props = defineProps({
	title: {
		type: String,
		required: false,
		default: "",
	},
});
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

        <!-- Guides -->
        <BreadcrumbItem>
          <BreadcrumbLink href="/guides">
            Guides
          </BreadcrumbLink>
        </BreadcrumbItem>

        <!-- Guide Title -->
        <template v-if="title">
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <span class="text-muted-foreground">{{ title }}</span>
          </BreadcrumbItem>
        </template>
      </BreadcrumbList>
    </Breadcrumb>

    <hr class="my-5" />
  </div>
</template>