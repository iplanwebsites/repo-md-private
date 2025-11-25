<template>
  <div class="contact-form-block py-16">
    <div class="container mx-auto px-4">
      <h2 v-if="block.title" class="text-3xl font-bold text-center mb-4">
        {{ block.title }}
      </h2>
      <p
        v-if="block.subtitle"
        class="text-lg text-center text-muted-foreground mb-10 max-w-2xl mx-auto"
      >
        {{ block.subtitle }}
      </p>

      <div v-if="formSubmitted" class="max-w-md mx-auto text-center py-8">
        <div class="bg-green-50 border border-green-200 rounded-md p-6">
          <CheckCircle class="w-12 h-12 text-green-500 mx-auto mb-4" />
          <p class="text-lg font-medium text-green-800">
            {{
              block.successMessage ||
              "Thanks! Your message has been sent successfully."
            }}
          </p>
        </div>
      </div>

      <form v-else @submit.prevent="submitForm" class="max-w-md mx-auto">
        <div class="mb-4">
          <label for="name" class="block mb-2 font-medium">
            {{ block.nameLabel || "Your Name" }}
          </label>
          <Input
            type="text"
            id="name"
            v-model="formData.name"
            class="w-full p-3 border rounded-md"
            :placeholder="block.namePlaceholder || 'John Doe'"
            required
          />
        </div>

        <div class="mb-4">
          <label for="email" class="block mb-2 font-medium">
            {{ block.emailLabel || "Your Email" }}
          </label>
          <Input
            type="email"
            id="email"
            v-model="formData.email"
            class="w-full p-3 border rounded-md"
            :placeholder="block.emailPlaceholder || 'your@email.com'"
            required
          />
        </div>

        <div class="mb-4">
          <label for="subject" class="block mb-2 font-medium">
            {{ block.subjectLabel || "Subject" }}
          </label>
          <Input
            type="text"
            id="subject"
            v-model="formData.subject"
            class="w-full p-3 border rounded-md"
            :placeholder="block.subjectPlaceholder || 'How can we help you?'"
          />
        </div>

        <div class="mb-4">
          <label for="message" class="block mb-2 font-medium">
            {{ block.messageLabel || "Message" }}
          </label>
          <Textarea
            id="message"
            rows="4"
            v-model="formData.message"
            class="w-full p-3 border rounded-md"
            :placeholder="block.messagePlaceholder || 'Your message here...'"
            required
          />
        </div>

        <button
          type="submit"
          class="w-full px-6 py-3 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          :disabled="isSubmitting"
        >
          <Loader2
            v-if="isSubmitting"
            class="w-4 h-4 mr-2 inline animate-spin"
          />
          {{ block.buttonText || "Send Message" }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";
import { CheckCircle, Loader2 } from "lucide-vue-next";

const props = defineProps({
	block: {
		type: Object,
		required: true,
	},
});

const formData = reactive({
	name: "",
	email: "",
	subject: "",
	message: "",
});

const isSubmitting = ref(false);
const formSubmitted = ref(false);

const submitForm = async () => {
	isSubmitting.value = true;

	try {
		// In a real implementation, you would send this data to an API endpoint
		// For now, we'll simulate a successful submission after a delay
		await new Promise((resolve) => setTimeout(resolve, 1500));

		// Reset form
		formData.name = "";
		formData.email = "";
		formData.subject = "";
		formData.message = "";

		// Show success message
		formSubmitted.value = true;

		// Optional: Log for development purposes
		console.log("Form submitted:", formData);
	} catch (error) {
		console.error("Error submitting form:", error);
		// In a real implementation, you would show an error message
	} finally {
		isSubmitting.value = false;
	}
};
</script>
