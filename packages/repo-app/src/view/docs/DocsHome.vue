<script setup>
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Book, LifeBuoy, Code, FileText, Palette, Lightbulb, Globe, Beaker,


  //test-tube-diagonal
TestTubeDiagonal, } from "lucide-vue-next";
 
import { appConfigs } from "@/appConfigs";

// Doc home page feature cards
const features = [
	{
		title: "Quick start",
		description: "Get started with Repo.md",
		icon: Zap,
		url: "/docs/quick-start",
	},
	{
		title: "Content",
		description: "Create and edit content using flat files",
		icon: FileText,
		url: "/docs/markdown-basics",
	},
	{
		title: "Themes & sites",
		description: "Publish your content in a fast website. No coding required",
		icon: Globe,
		url: "/docs/using-themes",
	},
	{
		title: "Developers",
		description: "Plug in your content quickly, anywhere. API references and integration guides",
		icon: Code,
		url: "/docs/api-reference",
	},
	{
		title: "API Playground",
		description: "Try our API interactively with live examples and test your integration",
		icon: TestTubeDiagonal,
		url: appConfigs.JS_SDK_PLAYGROUND_URL,
		external: true
	},
  /*
	{
		title: "Use Cases",
		description: "Learn how to use RepoMD for blogs, docs and more",
		icon: Lightbulb,
		url: "/docs/blog-setup",
	},
	{
		title: "Troubleshooting",
		description: "Solutions to common issues and FAQs",
		icon: FileText,
		url: "/docs/common-issues",
	},*/
];
</script>

<template>
  <div>
    <!-- Hero section -->
    <div class="mb-12"  >
      <h1 class="text-4xl font-bold mb-6">Repo.md documentation</h1>
      <p class="text-lg text-gray-600 mb-8 max-w-3xl">
        Welcome to our comprehensive documentation. Find everything you need to
        build, deploy, and manage your projects effectively.
      </p>
<!--  
      <div
    v-motion
    :initial="{ opacity: 0, y: 100 }"
    :enter="{ opacity: 1, y: 0, scale: 1 }"
    :variants="{ custom: { scale: 2 } }"
    :hovered="{ scale: 1.2 }"
    :delay="200"
    :duration="1200"
  />-->



      <!-- Quick search or CTA -->
      <div class="flex">
        <router-link
          to="/docs/quick-start"
          class="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition"
        >
          <Zap class="w-5 h-5 mr-2" />
          <span>Quick Start Guide</span>
      </router-link>
      </div>
    </div>

    <!-- Feature cards grid - Updated for 6 cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-12">
      <Card
        v-for="(feature, index) in features"
        :key="index"
        class="hover:shadow-md transition"
      >
        <CardContent class="flex p-6">
          <div class="mr-4 mt-1">
            <component :is="feature.icon" class="w-8 h-8 text-blue-500" />
          </div>
          <div>
            <h3 class="text-lg font-semibold mb-2">
              <router-link v-if="!feature.external" :to="feature.url" class="hover:text-blue-600 transition">
                {{ feature.title }}
              </router-link>
              <a v-else :href="feature.url" target="_blank" rel="noopener noreferrer" class="hover:text-blue-600 transition flex items-center">
                {{ feature.title }}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </h3>
            <p class="text-gray-600">{{ feature.description }}</p>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Recent updates section -->
    <h2 class="text-2xl font-bold mb-6">Recent Updates</h2>
    <Card>
      <CardContent class="p-0">
        <ul class="divide-y">
          <li class="p-4 hover:bg-gray-50">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-medium">OpenAI Integration Guide</h3>
                <p class="text-sm text-gray-600 mt-1">
                  New documentation on integrating RepoMD with OpenAI models
                </p>
              </div>
              <span class="text-sm text-gray-500">May 8, 2024</span>
            </div>
          </li>
          <li class="p-4 hover:bg-gray-50">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-medium">JavaScript Library v2.0</h3>
                <p class="text-sm text-gray-600 mt-1">
                  Updated docs for the latest API with new examples and features
                </p>
              </div>
              <span class="text-sm text-gray-500">April 25, 2024</span>
            </div>
          </li>
          <li class="p-4 hover:bg-gray-50">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-medium">Performance Optimization Guide</h3>
                <p class="text-sm text-gray-600 mt-1">
                  New troubleshooting article about optimizing site performance
                </p>
              </div>
              <span class="text-sm text-gray-500">April 12, 2024</span>
            </div>
          </li>
          <li class="p-4 hover:bg-gray-50">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-medium">WordPress Migration Guide</h3>
                <p class="text-sm text-gray-600 mt-1">
                  Step-by-step tutorial for moving from WordPress to RepoMD
                </p>
              </div>
              <span class="text-sm text-gray-500">March 29, 2024</span>
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
