<!-- Blog404.vue -->
<script setup>
import { Button } from "@/components/ui/button";
import { useRouter } from "vue-router";
import { ref, onMounted } from "vue";
import lottie from "lottie-web";

// Define props with default values
const props = defineProps({
	title: {
		type: String,
		default: "Oops! Not found",
	},
	description: {
		type: String,
		default:
			" The page you are looking for does not exist. Please check the URL or return to the homepage.",
	},
});

const router = useRouter();
const animationContainer = ref(null);
let animation = null;

// Function to navigate to home page
const goToHome = () => {
	router.push("/home");
};

// Load the Lottie animation when component is mounted
onMounted(() => {
	if (animationContainer.value) {
		// Initialize Lottie animation with animationData directly instead of path
		// This avoids the XHR loading issues
		fetch("/404.json")
			.then((response) => {
				if (response.ok) {
					return response.json();
				}
				throw new Error("Network response was not ok");
			})
			.then((animationData) => {
				animation = lottie.loadAnimation({
					container: animationContainer.value,
					renderer: "svg",
					loop: true,
					autoplay: true,
					animationData: animationData, // Use the pre-loaded animation data
				});
			})
			.catch((error) => {
				console.error("Failed to load Lottie animation:", error);
				// Fallback to a simple SVG animation
				useFallbackAnimation();
			});

		// Clean up animation when component is destroyed
		return () => {
			if (animation) {
				animation.destroy();
			}
		};
	}
});

// Fallback animation if Lottie fails to load
const useFallbackAnimation = () => {
	if (animationContainer.value) {
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("viewBox", "0 0 200 200");
		svg.classList.add("w-full", "h-full");

		// Create sad face elements
		const circle = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"circle",
		);
		circle.setAttribute("cx", "100");
		circle.setAttribute("cy", "100");
		circle.setAttribute("r", "90");
		circle.setAttribute("fill", "#f0f9ff");

		const leftEye = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"circle",
		);
		leftEye.setAttribute("cx", "70");
		leftEye.setAttribute("cy", "80");
		leftEye.setAttribute("r", "10");
		leftEye.setAttribute("fill", "#3b82f6");

		const rightEye = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"circle",
		);
		rightEye.setAttribute("cx", "130");
		rightEye.setAttribute("cy", "80");
		rightEye.setAttribute("r", "10");
		rightEye.setAttribute("fill", "#3b82f6");

		const mouth = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"path",
		);
		mouth.setAttribute("d", "M70,130 Q100,110 130,130");
		mouth.setAttribute("stroke", "#3b82f6");
		mouth.setAttribute("stroke-width", "5");
		mouth.setAttribute("fill", "none");

		// Append elements to SVG
		svg.appendChild(circle);
		svg.appendChild(leftEye);
		svg.appendChild(rightEye);
		svg.appendChild(mouth);

		// Clear container and append SVG
		animationContainer.value.innerHTML = "";
		animationContainer.value.appendChild(svg);
	}
};
</script>

<template>
  <div
    class="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 text-center"
  >
    <!-- Animation container - will hold either Lottie or fallback SVG -->
    <div ref="animationContainer" class="w-80 h-80 mb-8"></div>

    <h1 class="text-4xl font-bold text-gray-900 mb-4">
      {{ title }}
    </h1>
    <p class="text-xl text-gray-600 mb-8 max-w-md">
      {{ description }}
    </p>

    <div class="flex gap-4">
      <Button @click="goToHome" size="lg" variant="outline"
        >Go to the home page
      </Button>
    </div>
  </div>
</template>
