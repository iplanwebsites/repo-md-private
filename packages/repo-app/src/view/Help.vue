// Help.vue
<script setup>
import { ref, computed } from "vue";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Mail,
	BookOpen,
	Search,
	ArrowRight,
	ChevronLeft,
	CreditCard,
	Video,
	Bell,
	HelpCircle,
} from "lucide-vue-next";

// Import router
import { useRouter } from "vue-router";
import { formatDateCustom } from "@/lib/utils/dateUtils";
const router = useRouter();

// Mock blog articles data (in JSON structure as requested)
const helpArticles = ref([
	{
		id: 1,
		title: "Hello Repo.md",
		description:
			"The Markdown Publishing Revolution in the Era of Technical Documentation",
		url: "/blog/hello-pushmd",
		date: "2025-02-15",
	},
	{
		id: 3,
		title: "Welcome and Usage Guide for Repo.md",
		description: "Tips to get the most out of your Repo.md subscription",
		url: "/blog/welcome-and-usage-guide-for-pushmd",
		date: "2025-03-10",
	},
	{
		id: 2,
		title: "Setting Up Your Markdown Workflow",
		description:
			"Creating an Efficient Markdown Publishing Pipeline: Practical and Inspiring Guide 🚀",
		url: "/blog/setting-up-your-markdown-workflow",
		date: "2025-03-02",
	},
]);

// Mock help categories
const helpCategories = ref([
	{
		title: "Account & Billing",
		icon: CreditCard,
		url: "/help/account-billing",
	},
	{
		title: "Publishing Workflow",
		icon: Video,
		url: "/help/publishing-workflow",
	},
	{
		title: "Git Integration",
		icon: Bell,
		url: "/help/git-integration",
	},
	{
		title: "FAQ",
		icon: HelpCircle,
		url: "/help/faq",
	},
]);

// Using imported formatDateCustom function from dateUtils.js

// Search functionality (mock)
const searchQuery = ref("");
const isSearching = ref(false);

const performSearch = () => {
	if (searchQuery.value.trim() !== "") {
		isSearching.value = true;
		// Mock search functionality
		setTimeout(() => {
			isSearching.value = false;
		}, 1000);
	}
};

// Back button functionality
const back = () => {
	router.back();
};
</script>

<template>
  <div style="background: #d6f5f3" class="bg-crazy img3">
    <div class="container py-8 px-4">
      <div class="max-w-4xl mx-auto space-y-8">
        <!--
        
            <Button variant="outline" class="min-w-[150px]" @click="back">
        <ChevronLeft class="h-4 w-4 mr-2" />
        Back
      </Button>Header -->

        <div class="space-y-4">
          <h1 class="text-3xl font-bold tracking-tight">Help Center</h1>
          <p class=" ">
            Find answers to your questions and learn how to get the most out of
            Repo.md.
          </p>
        </div>

        <!-- Search Box -->
        <Card class="shadow-md">
          <CardContent class="pt-6">
            <div class="flex gap-3">
              <div class="relative flex-1">
                <Input
                  v-model="searchQuery"
                  placeholder="Search for a question or topic..."
                  class="pr-10"
                  @keyup.enter="performSearch"
                />
                <Search
                  class="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
                />
              </div>
              <Button @click="performSearch" :disabled="isSearching">
                {{ isSearching ? "Searching..." : "Search" }}
              </Button>
            </div>
          </CardContent>
        </Card>

        <!-- Contact Support -->
        <Card class="shadow-md">
          <CardHeader>
            <CardTitle>Need additional help?</CardTitle>
            <CardDescription>
              Our support team is available to assist you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Mail class="h-6 w-6 text-primary" />
              <div>
                <h3 class="font-medium">Contact our support</h3>
                <p class="text-sm text-muted-foreground">
                  Send us an email at
                  <a
                    href="mailto:support@repo.md"
                    class="text-primary font-medium"
                  >
                    support@repo.md
                  </a>
                </p>
              </div>
              <a href="mailto:support@repo.md" class="ml-auto">
                <Button variant="outline"> Contact support </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        <!-- Help Categories -->
        <Card class="shadow-md">
          <CardHeader>
            <CardTitle>Help Categories</CardTitle>
            <CardDescription>
              Browse our help resources by topic.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-for="category in helpCategories"
                :key="category.title"
                class="border rounded-lg p-4 hover:bg-muted cursor-pointer transition-colors"
              >
                <h3 class="font-medium mb-1 flex items-center gap-2">
                  <component :is="category.icon" class="h-4 w-4 text-primary" />
                  {{ category.title }}
                </h3>
                <p class="text-sm text-muted-foreground">Browse articles</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Featured Articles -->
        <Card class="shadow-md">
          <CardHeader>
            <CardTitle>Recent Articles</CardTitle>
            <CardDescription>
              Check out our guides and articles to help you get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-4">
              <router-link
                v-for="article in helpArticles"
                :key="article.id"
                class="border rounded-lg p-4 hover:bg-muted cursor-pointer transition-colors block"
                :to="article.url"
              >
                <div class="flex justify-between items-start gap-4">
                  <div>
                    <h3 class="font-medium mb-1">{{ article.title }}</h3>
                    <p class="text-sm text-muted-foreground mb-2">
                      {{ article.description }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      Published on {{ formatDateCustom(article.date) }}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 flex items-center justify-center"
                  >
                    <ArrowRight class="h-4 w-4" />
                  </Button>
                </div>
              </router-link>
            </div>
          </CardContent>
          <CardFooter>
            <router-link to="/blog">
              <Button variant="outline" class="w-full">
                View all articles
                <BookOpen class="ml-2 h-4 w-4" />
              </Button>
            </router-link>
          </CardFooter>
        </Card>

        <!-- Coming Soon -->
        <Card class="shadow-md">
          <CardHeader>
            <CardTitle>Content in development</CardTitle>
            <CardDescription>
              More help resources will be available soon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="text-center py-6">
              <p class="text-muted-foreground">
                Our help center is under development. Feel free to contact us at
                <a
                  href="mailto:support@repo.md"
                  class="text-primary font-medium"
                >
                  support@repo.md
                </a>
                for any questions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
}
</style>
