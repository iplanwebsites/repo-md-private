<!-- StyleGuide.vue -->
<script setup>
import { ref } from "vue";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, AlertCircle, User, Mail, Settings } from "lucide-vue-next";

const sampleText = ref("Example text");

const logos = [
	"logo_purple.svg",
	"logo_black.svg",
	"logo_white.svg",
	"md_purple.svg",
	// "logo1_white.svg",
];
</script>

<template>
  <div class="container mx-auto p-8 space-y-8">
    <Iridescence />

    <!-- Logo Section -->
    <Card class="p-6">
      <h2 class="text-2xl font-bold mb-6">Logo</h2>
      <div class="space-y-6">
        <!-- Primary Logo -->
        <div>
          <h3 class="text-xl font-semibold mb-4">Logotype + Icon</h3>
          <div class="bg-white p-6 rounded-lg border"></div>

          <div
            class="bg-white p-6 rounded-lg border"
            style="background: #aaa"
            v-for="logo in logos"
          >
            <img :src="`/brand/repo/${logo}`" alt="Logo" class="h-12" />
          </div>
        </div>
        <!-- Logo on Dark
        <div>
          <h3 class="text-xl font-semibold mb-4">Logo on Dark Background</h3>
          <div class="bg-primary p-6 rounded-lg">
            <img src="../../public/favicon1.svg" alt="Logo" class="h-12" />
          </div>
          <div class="bg-primary p-6 rounded-lg">
            <img src="../../public/favicon1.svg" alt="Logo" class="h-12" />
          </div>
        </div> -->
      </div>
    </Card>

    <!-- Typography with General sans -->
    <Card class="p-6">
      <h2 class="text-2xl font-bold mb-6">Typography</h2>

      <div class="space-y-8">
        <!-- Font Weights -->
        <div>
          <h3 class="text-xl font-semibold mb-4">General sans - Weights</h3>
          <div class="space-y-4">
            <p class="font-light">General sans Light (300)</p>
            <p class="font-normal">General sans Regular (400)</p>
            <p class="font-medium">General sans Medium (500)</p>
            <p class="font-semibold">General sans Semibold (600)</p>
            <p class="font-bold">General sans Bold (700)</p>
          </div>
        </div>

        <!-- Headings -->
        <div>
          <h3 class="text-xl font-semibold mb-4">Headings</h3>
          <div class="space-y-4">
            <h1 class="text-4xl font-bold">Heading 1 (text-4xl)</h1>
            <h2 class="text-3xl font-bold">Heading 2 (text-3xl)</h2>
            <h3 class="text-2xl font-bold">Heading 3 (text-2xl)</h3>
            <h4 class="text-xl font-bold">Heading 4 (text-xl)</h4>
            <h5 class="text-lg font-bold">Heading 5 (text-lg)</h5>
          </div>
        </div>

        <!-- Body Text -->
        <div class="space-y-2">
          <p class="text-base">
            Base text (text-base): Regular paragraph text. Lorem ipsum dolor sit
            amet, consectetur adipiscing elit.
          </p>
          <p class="text-sm text-muted-foreground">
            Small text (text-sm): Secondary information or helper text
          </p>
        </div>
      </div>
    </Card>

    <!-- Colors Section -->
    <Card class="p-6">
      <h2 class="text-2xl font-bold mb-6">Colors</h2>

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <div
            class="h-20 bg-primary rounded-lg flex items-center justify-center text-primary-foreground"
          >
            Primary
          </div>

          <div
            class="h-20 rounded-lg flex items-center justify-center"
            style="background: #2713e1; color: white"
          >
            #2713e1
          </div>
        </div>

        <div class="space-y-2">
          <div
            class="h-20 bg-background border rounded-lg flex items-center justify-center"
          >
            Background
          </div>
          <div
            class="h-20 bg-muted rounded-lg flex items-center justify-center"
          >
            Muted
          </div>
          <div
            class="h-20 bg-destructive rounded-lg flex items-center justify-center text-destructive-foreground"
          >
            Destructive
          </div>
        </div>
      </div>
    </Card>

    <!-- Components Section -->
    <Card class="p-6">
      <h2 class="text-2xl font-bold mb-6">Components</h2>

      <div class="space-y-8">
        <!-- Buttons -->
        <div class="space-y-4">
          <h3 class="text-xl font-semibold">Buttons</h3>
          <div class="flex flex-wrap gap-4">
            <Button>Default Button</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        </div>

        <!-- Icons with Buttons -->
        <div class="space-y-4">
          <h3 class="text-xl font-semibold">Buttons with Icons</h3>
          <div class="flex flex-wrap gap-4">
            <Button>
              <Check class="w-4 h-4 mr-2" />
              With Icon
            </Button>
            <Button variant="outline">
              <Settings class="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        <!-- Input Fields -->
        <div class="space-y-4">
          <h3 class="text-xl font-semibold">Input Fields</h3>
          <div class="max-w-sm space-y-4">
            <Input v-model="sampleText" placeholder="Enter text..." />
            <Input disabled placeholder="Disabled field" />
          </div>
        </div>

        <!-- Cards -->
        <div class="space-y-4">
          <h3 class="text-xl font-semibold">Card Variations</h3>
          <div class="grid grid-cols-2 gap-4">
            <Card class="p-4">
              <h4 class="font-semibold">Basic Card</h4>
              <p class="text-sm text-muted-foreground">
                Simple card with padding
              </p>
            </Card>

            <Card class="p-4 border-primary">
              <div class="flex items-center gap-3">
                <User class="w-5 h-5 text-primary" />
                <div>
                  <h4 class="font-semibold">Card with Icon</h4>
                  <p class="text-sm text-muted-foreground">
                    With primary border
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <!-- Status Indicators -->
        <div class="space-y-4">
          <h3 class="text-xl font-semibold">Status Indicators</h3>
          <div class="flex gap-4">
            <span
              class="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm"
            >
              Active
            </span>
            <span
              class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm"
            >
              Pending
            </span>
            <span
              class="px-2 py-1 bg-red-100 text-red-800 rounded-full text-sm"
            >
              Inactive
            </span>
          </div>
        </div>
      </div>
    </Card>

    <!-- Lists Section -->
    <Card class="p-6">
      <h2 class="text-2xl font-bold mb-6">Lists</h2>

      <div class="grid grid-cols-2 gap-8">
        <!-- Unordered List -->
        <div>
          <h3 class="text-xl font-semibold mb-4">Unordered List</h3>
          <ul class="list-disc ml-6 space-y-2">
            <li>First list item</li>
            <li>Second item with additional text for demo</li>
            <li>Third list item</li>
          </ul>
        </div>

        <!-- Ordered List -->
        <div>
          <h3 class="text-xl font-semibold mb-4">Ordered List</h3>
          <ol class="list-decimal ml-6 space-y-2">
            <li>First numbered item</li>
            <li>Second numbered item</li>
            <li>Third numbered item</li>
          </ol>
        </div>
      </div>
    </Card>
  </div>
</template>

<style scoped>
/* Importing General sans font - Make sure to add this to your main CSS file or index.html */

.text-muted-foreground {
  color: hsl(var(--muted-foreground));
}

.bg-accent {
  background-color: hsl(var(--accent));
}

/* Apply Poppins to all text in the component */
.container {
}
</style>
