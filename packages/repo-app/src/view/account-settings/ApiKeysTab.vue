<script setup>
import { ref } from "vue";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Key,
  Save,
  Eye,
  EyeOff,
  Copy,
  ChevronRight,
} from "lucide-vue-next";

const props = defineProps({
  settingsStore: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['save-settings']);

// API key management
const standardApiKey = ref("");
const showStandardApiKey = ref(false);
const generateStandardApiKey = async () => {
  standardApiKey.value = "sk_" + Math.random().toString(36).substring(2, 15);
  // Here you would typically call an API to generate a real API key
};

// Secret API key management
const secretApiKey = ref("");
const showSecretApiKey = ref(false);
const generateSecretApiKey = async () => {
  secretApiKey.value =
    "sk_secret_" + Math.random().toString(36).substring(2, 15);
  // Here you would typically call an API to generate a real API key
};

// Function to save API key settings
async function saveApiKeySettings() {
  emit('save-settings', 'apikeys');
}

// Function to copy to clipboard
const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text);
};
</script>

<template>
  <Card class="shadow-md">
    <CardHeader>
      <CardTitle>API Keys</CardTitle>
      <CardDescription>
        Securely access our API with your private keys.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-6">
      <div class="space-y-6">
        <!-- Standard API Key -->
        <div>
          <h3 class="font-medium mb-3">Standard API Key</h3>
          <div class="space-y-4">
            <p class="text-sm text-muted-foreground">
              Use this API key for most operations. It has read-only
              access to your account data.
            </p>

            <div class="flex items-center space-x-2">
              <div class="relative flex-1">
                <input
                  :type="showStandardApiKey ? 'text' : 'password'"
                  :value="
                    standardApiKey || '••••••••••••••••••••••••••'
                  "
                  readonly
                  class="w-full px-3 py-2 border rounded-md text-sm"
                  placeholder="No API key generated"
                />
                <button
                  @click="showStandardApiKey = !showStandardApiKey"
                  class="absolute right-10 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <Eye v-if="!showStandardApiKey" class="h-4 w-4" />
                  <EyeOff v-else class="h-4 w-4" />
                </button>
              </div>
              <Button
                v-if="standardApiKey"
                variant="outline"
                size="sm"
                @click="copyToClipboard(standardApiKey)"
              >
                <Copy class="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                size="sm"
                @click="generateStandardApiKey"
              >
                <Key class="h-4 w-4 mr-1" />
                {{ standardApiKey ? "Regenerate" : "Generate" }}
              </Button>
            </div>
          </div>
        </div>

        <!-- Secret API Key -->
        <div class="pt-4 border-t">
          <h3 class="font-medium mb-3">Secret API Key</h3>
          <div class="space-y-4">
            <p class="text-sm text-muted-foreground">
              This key has full access to your account, including the
              ability to modify data and make purchases.
            </p>

            <div class="flex items-center space-x-2">
              <div class="relative flex-1">
                <input
                  :type="showSecretApiKey ? 'text' : 'password'"
                  :value="secretApiKey || '••••••••••••••••••••••••••'"
                  readonly
                  class="w-full px-3 py-2 border rounded-md text-sm"
                  placeholder="No API key generated"
                />
                <button
                  @click="showSecretApiKey = !showSecretApiKey"
                  class="absolute right-10 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <Eye v-if="!showSecretApiKey" class="h-4 w-4" />
                  <EyeOff v-else class="h-4 w-4" />
                </button>
              </div>
              <Button
                v-if="secretApiKey"
                variant="outline"
                size="sm"
                @click="copyToClipboard(secretApiKey)"
              >
                <Copy class="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                size="sm"
                @click="generateSecretApiKey"
              >
                <Key class="h-4 w-4 mr-1" />
                {{ secretApiKey ? "Regenerate" : "Generate" }}
              </Button>
            </div>
          </div>
        </div>

        <!-- API Security Notice -->
        <div class="pt-4 border-t">
          <div
            class="text-sm text-muted-foreground bg-muted p-4 rounded-md"
          >
            <p class="font-medium text-destructive mb-2">
              Important Security Information:
            </p>
            <ul class="list-disc pl-5 space-y-1">
              <li>
                API keys provide programmatic access to your account
              </li>
              <li>
                Do not share your API keys in public repositories or
                client-side code
              </li>
              <li>
                Immediately regenerate your keys if you suspect they've
                been compromised
              </li>
              <li>
                Store API keys securely using environment variables or a
                secrets manager
              </li>
              <li>
                All API activity is logged and can be monitored in your
                account dashboard
              </li>
            </ul>
          </div>
        </div>

        <!-- API Documentation Link -->
        <div class="pt-4 flex justify-end">
          <Button variant="outline" class="flex items-center gap-1">
            View API Documentation
            <ChevronRight class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </CardContent>
    <CardFooter class="flex justify-end">
      <Button
        @click="saveApiKeySettings"
        class="flex items-center gap-1"
        :disabled="settingsStore.isSaving"
      >
        <Save class="h-4 w-4" :class="{ 'animate-spin': settingsStore.isSaving }" />
        <span>Save changes</span>
      </Button>
    </CardFooter>
  </Card>
</template>