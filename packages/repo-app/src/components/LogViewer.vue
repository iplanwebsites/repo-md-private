<script setup>
import { ref, computed } from "vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, ChevronDown, ChevronUp } from "lucide-vue-next";
import JsonDebug from "@/components/JsonDebug.vue";

const props = defineProps({
	logs: {
		type: Array,
		default: () => [],
	},
	jobInfo: {
		type: Object,
		default: () => ({}),
	},
	title: {
		type: String,
		default: "Logs",
	},
	subtitle: {
		type: String,
		default: "Process logs",
	},
	showInfo: {
		type: Boolean,
		default: true,
	},
	maxHeight: {
		type: String,
		default: "5400px",
	},
});

const expanded = ref(true);
const infoExpanded = ref(true);

// Use computed to format job info data
const formattedDate = (dateString) => {
	if (!dateString) return "N/A";
	try {
		return new Date(dateString).toLocaleString();
	} catch (e) {
		return dateString;
	}
};

const getStatusClass = (status) => {
	return {
		"text-red-600": status === "failed",
		"text-green-600": status === "completed",
		"text-yellow-600": status === "pending" || status === "processing",
	};
};

const getLogClass = (type) => {
	return {
		"text-blue-400": type === "info",
		"text-yellow-400": type === "warning",
		"text-red-400": type === "error",
	};
};
</script>

<template>
  <Card class="w-full">
    <CardHeader class="pb-3">
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="text-xl">{{ title }}</CardTitle>
          <p class="text-sm text-muted-foreground">{{ subtitle }}</p>
        </div>
        <Button variant="ghost" size="sm" @click="expanded = !expanded">
          <span class="sr-only">{{ expanded ? "Collapse" : "Expand" }}</span>
          <ChevronUp v-if="expanded" class="h-4 w-4" />
          <ChevronDown v-else class="h-4 w-4" />
        </Button>
      </div>
    </CardHeader>
    <CardContent v-if="expanded">
      <!-- Error message if job failed -->
      <div v-if="jobInfo.error" class="mb-6">
        <div
          class="bg-red-100 border border-red-300 text-red-900 px-4 py-3 rounded relative"
        >
          <strong class="font-bold">Failed:</strong>
          <span class="block mt-1">{{ jobInfo.error }}</span>
        </div>
      </div>

      <!-- No logs available -->
      <div
        v-if="!logs || logs.length === 0"
        class="py-8 text-center text-gray-500"
      >
        <Terminal class="mx-auto h-12 w-12 mb-3" />
        <p class="text-lg font-medium">No logs available</p>
        <p class="text-sm mt-1">This process does not have any logs yet.</p>
      </div>

      <!-- Logs display -->
      <div v-else>
        <div class="bg-gray-900 rounded-md overflow-hidden">
          <ScrollArea
            class="w-full"
            :style="{ maxHeight }"
          >
            <div class="p-4">
              <table class="w-full text-gray-200 font-mono text-sm border-collapse">
                <thead>
                  <tr class="text-left border-b border-gray-700">
                    <th class="py-2 pr-4 w-20">Level</th>
                    <th class="py-2 pr-4 w-44">Timestamp</th>
                    <th class="py-2">Message</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(log, index) in logs" :key="index">
                    <td class="py-2 pr-4 align-top whitespace-nowrap" :class="getLogClass(log.type)">
                      [{{ log.type }}]
                    </td>
                    <td class="py-2 pr-4 align-top text-gray-400 whitespace-nowrap">
                      {{ formattedDate(log.timestamp) }}
                    </td>
                    <td class="py-2 align-top break-words whitespace-pre-wrap">
                      {{ log.message }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </div>
      </div>

      <!-- Job info -->
      <div v-if="showInfo && jobInfo" class="mt-8">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-medium">Job Information</h3>
          <Button
            variant="ghost"
            size="sm"
            @click="infoExpanded = !infoExpanded"
          >
            <span class="sr-only">{{
              infoExpanded ? "Collapse" : "Expand"
            }}</span>
            <ChevronUp v-if="infoExpanded" class="h-4 w-4" />
            <ChevronDown v-else class="h-4 w-4" />
          </Button>
        </div>

        <div
          v-if="infoExpanded"
          class="bg-gray-50 rounded-md p-4 border border-gray-200"
        >
          <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div class="flex" v-if="jobInfo._id || jobInfo.id">
              <dt class="w-32 font-medium text-gray-500">ID:</dt>
              <dd>{{ jobInfo._id || jobInfo.id }}</dd>
            </div>
            <div class="flex" v-if="jobInfo.type">
              <dt class="w-32 font-medium text-gray-500">Type:</dt>
              <dd>{{ jobInfo.type }}</dd>
            </div>
            <div class="flex" v-if="jobInfo.status">
              <dt class="w-32 font-medium text-gray-500">Status:</dt>
              <dd :class="getStatusClass(jobInfo.status)">
                {{ jobInfo.status }}
              </dd>
            </div>
            <div class="flex" v-if="jobInfo.created || jobInfo.createdAt">
              <dt class="w-32 font-medium text-gray-500">Created At:</dt>
              <dd>
                {{
                  jobInfo.created?.time ||
                  formattedDate(jobInfo.created) ||
                  formattedDate(jobInfo.createdAt)
                }}
              </dd>
            </div>
            <div class="flex" v-if="jobInfo.updatedAt">
              <dt class="w-32 font-medium text-gray-500">Updated At:</dt>
              <dd>{{ formattedDate(jobInfo.updatedAt) }}</dd>
            </div>
            <div class="flex" v-if="jobInfo.userId">
              <dt class="w-32 font-medium text-gray-500">User ID:</dt>
              <dd>{{ jobInfo.userId }}</dd>
            </div>
            <div class="flex" v-if="jobInfo.projectId">
              <dt class="w-32 font-medium text-gray-500">Project ID:</dt>
              <dd>{{ jobInfo.projectId }}</dd>
            </div>
          </dl>
        </div>

        <!-- Input data -->
        <div
          v-if="jobInfo.input"
          class="mt-6 bg-gray-50 rounded-md p-4 border border-gray-200"
        >
          <h3 class="text-sm font-medium mb-3">Input Data</h3>
          <JsonDebug :data="jobInfo.input" :expanded="false" />
        </div>
      </div>
    </CardContent>
  </Card>
</template>
