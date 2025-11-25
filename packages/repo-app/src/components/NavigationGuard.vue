<!-- NavigationGuard.vue -->

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { onBeforeRouteLeave } from "vue-router";

const props = defineProps({
	// Message to display when user tries to navigate away
	message: {
		type: String,
		default:
			"This action cannot be undone. Are you sure you want to leave this page?",
	},
	// Title for the alert dialog
	title: {
		type: String,
		default: "Are you sure you want to leave?",
	},
	// Confirm button text
	confirmText: {
		type: String,
		default: "Leave Page",
	},
	// Cancel button text
	cancelText: {
		type: String,
		default: "Stay on Page",
	},
	// Whether the popup is open
	isOpen: {
		type: Boolean,
		required: true,
		default: false,
	},
	// Whether to intercept browser back button
	interceptBackButton: {
		type: Boolean,
		default: true,
	},
	// Whether to intercept page refresh/close
	interceptPageClose: {
		type: Boolean,
		default: false,
	},
	// Whether to intercept navigation using menu
	interceptNavigation: {
		type: Boolean,
		default: true,
	},
});

const emit = defineEmits([
	"navigationAttempted",
	"navigationCancelled",
	"navigationConfirmed",
]);

// Function for browser refresh/close
function handleBeforeUnload(e) {
	if (props.interceptPageClose) {
		// <== UNSURE IF THIS IS GOOD UX
		// Browser's built-in dialog (cannot be prevented in modern browsers)
		e.preventDefault();
		e.returnValue = props.message;
		return props.message;
	}
}

// Handle popstate (back button)
function handlePopState(e) {
	if (props.interceptBackButton) {
		// Prevent the default navigation
		e.preventDefault();

		// Emit event
		emit("navigationAttempted", {
			type: "back",
			action: () => window.history.go(-2),
		});

		// Prevent navigation by pushing a new state
		window.history.pushState(
			window.history.state,
			document.title,
			window.location.href,
		);
	}
}

// Handle dialog confirmation
function confirmNavigation() {
	// Emit confirmation event
	emit("navigationConfirmed");
}

// Handle dialog cancellation
function cancelNavigation() {
	emit("navigationCancelled");
}

onMounted(() => {
	// Set up back button interception
	if (props.interceptBackButton) {
		window.history.pushState(null, document.title, window.location.href);
		window.addEventListener("popstate", handlePopState);
	}

	// Set up page close/refresh interception
	if (props.interceptPageClose) {
		window.addEventListener("beforeunload", handleBeforeUnload);
	}
});

onBeforeUnmount(() => {
	// Clean up event listeners
	if (props.interceptBackButton) {
		window.removeEventListener("popstate", handlePopState);
	}

	if (props.interceptPageClose) {
		window.removeEventListener("beforeunload", handleBeforeUnload);
	}
});

// This will unmount itself by default
onBeforeRouteLeave((to, _from, next) => {
	if (props.interceptNavigation) {
		emit("navigationAttempted", {
			type: "navigation",
			action: () => next(to.fullPath),
		});
	} else {
		next();
	}
});
</script>

<template>
  <!-- Using the provided AlertDialog component -->
  <AlertDialog :open="isOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ title }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ message }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="cancelNavigation">{{
          cancelText
        }}</AlertDialogCancel>
        <AlertDialogAction @click="confirmNavigation">{{
          confirmText
        }}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
