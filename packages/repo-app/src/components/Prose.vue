<!-- Prose.vue -->
<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast/use-toast";

import { formatMdText } from "@/lib/utils/format.js";

// Initialize toast
const { toast } = useToast();

// Define props with validation
const props = defineProps({
	// HTML content to display
	html: {
		type: String,
		default: null,
	},
	// Markdown content to display
	md: {
		type: String,
		default: null,
	},
	// Maximum height before truncation (0 means no limit)
	maxHeight: {
		type: Number,
		default: 0,
	},
});

// Component state
const contentRef = ref(null);
const isExpanded = ref(false);
const hasOverflow = ref(false);
const containerHeight = ref("auto");
const displayContent = ref("");

// Computed style for the content container
const containerStyle = computed(() => ({
	maxHeight: isExpanded.value
		? "none"
		: props.maxHeight
			? `${props.maxHeight}px`
			: "none",
	overflow: "hidden",
	position: "relative",
}));

// Process content based on props
const processContent = () => {
	if (props.html !== null) {
		// If HTML is provided, use it directly
		displayContent.value = props.html;
	} else if (props.md !== null) {
		// If Markdown is provided, convert it to HTML
		displayContent.value = formatMdText(props.md);
	} else {
		// Log error if neither HTML nor Markdown is provided
		console.error("Prose component: Neither html nor md prop was provided");
		displayContent.value = "";
	}
};

// Check if content overflows and needs the "View more" button
const checkOverflow = () => {
	if (!contentRef.value || !props.maxHeight) {
		hasOverflow.value = false;
		return;
	}

	const element = contentRef.value;
	hasOverflow.value = element.scrollHeight > props.maxHeight;

	// Set initial container height
	containerHeight.value = isExpanded.value
		? "auto"
		: `${Math.min(element.scrollHeight, props.maxHeight)}px`;
};

// Toggle expanded state
const toggleExpand = () => {
	isExpanded.value = !isExpanded.value;

	if (isExpanded.value) {
		containerHeight.value = `${contentRef.value.scrollHeight}px`;
	} else {
		containerHeight.value = `${props.maxHeight}px`;
	}
};

// Watch for changes in content or maxHeight
watch(
	() => props.html,
	() => {
		processContent();
		checkOverflow();
	},
);

watch(
	() => props.md,
	() => {
		processContent();
		checkOverflow();
	},
);

watch(() => props.maxHeight, checkOverflow);

// Handle click on heading anchors to copy link
const handleHeadingClick = (event) => {
	// Check if the click is on a heading anchor or its ::after pseudo-element
	const target = event.target;
	const headingAnchor = target.closest('h1 a, h2 a, h3 a, h4 a, h5 a, h6 a');
	
	if (headingAnchor) {
		// Check if this is a heading with an ID (for anchor links)
		const heading = headingAnchor.closest('h1, h2, h3, h4, h5, h6');
		const headingId = heading?.id;
		
		if (headingId) {
			event.preventDefault();
			
			// Create current page URL with heading anchor
			const currentUrl = new URL(window.location.href);
			currentUrl.hash = `#${headingId}`;
			const linkToCopy = currentUrl.toString();
			
			// Copy the link to clipboard
			navigator.clipboard.writeText(linkToCopy).then(() => {
				// Show success toast
				toast({
					title: "Link copied!",
					description: "The heading link has been copied to your clipboard.",
				});
			}).catch(err => {
				console.error('Failed to copy link:', err);
				// Fallback: update URL hash and show fallback toast
				window.location.hash = `#${headingId}`;
				toast({
					title: "Link updated",
					description: "The page URL has been updated to include the heading anchor.",
				});
			});
		}
		// If it's not a heading with ID, let the normal link behavior proceed
	}
};

// Initialize on mount
onMounted(() => {
	processContent();
	checkOverflow();
	
	// Add click handler for heading anchors
	if (contentRef.value) {
		contentRef.value.addEventListener('click', handleHeadingClick);
	}
});

// Cleanup on unmount
onUnmounted(() => {
	if (contentRef.value) {
		contentRef.value.removeEventListener('click', handleHeadingClick);
	}
});
</script>

<template>
  <div class="prose-container">
    <!-- Content container with dynamic height -->
    <div
      ref="contentRef"
      class="prose"
      :style="containerStyle"
      :class="{ 'has-fade': hasOverflow && !isExpanded }"
    >
      <div v-html="displayContent"></div>
    </div>

    <!-- View more button -->
    <div
      v-if="hasOverflow"
      class="view-more-container"
      :class="{ 'with-fade': !isExpanded }"
    >
      <Button
        variant="secondary"
        class="view-more-button"
        @click="toggleExpand"
      >
        {{ isExpanded ? "Voir moins" : "Voir plus" }}
      </Button>
    </div>
  </div>
</template>

<style scoped>
.prose-container {
  position: relative;
  width: 100%;
}

.prose {
  transition: max-height 0.3s ease-in-out;
}

/* Fade effect for truncated content */
.has-fade::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100px;

  /*  background: linear-gradient(to bottom, transparent, rgb(var(--bg)));
*/
  background: linear-gradient(to bottom, transparent, rgb(255, 255, 255));

  pointer-events: none;
}

.view-more-container {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
  position: relative;
}

.with-fade {
  margin-top: -60px;
  position: relative;
  z-index: 10;
}

/* Inherit prose styles from the parent component */
:deep(.prose) {
  max-width: none;
  font-size: 1.125rem;
  line-height: 1.8;
}

:deep(.prose p) {
  margin-bottom: 1.5em;
}

:deep(.prose h1) {
  font-size: 2.5rem;
  margin-top: 2em;
  margin-bottom: 1em;
}

:deep(.prose h2) {
  font-size: 2rem;
  margin-top: 1.8em;
  margin-bottom: 0.8em;
}

:deep(.prose h3) {
  font-size: 1.5rem;
  margin-top: 1.6em;
  margin-bottom: 0.6em;
}

/* Links in paragraphs - keep blue with underline */
:deep(.prose p a) {
  @apply text-primary underline decoration-2 underline-offset-2;
}

/* Heading anchor links - no underline, show copy icon on hover */
:deep(.prose h1 a),
:deep(.prose h2 a), 
:deep(.prose h3 a),
:deep(.prose h4 a),
:deep(.prose h5 a),
:deep(.prose h6 a) {
  @apply text-inherit no-underline relative;
  position: relative;
}

/* Copy link icon for heading anchors (desktop only) */
@media (min-width: 768px) {
  :deep(.prose h1 a)::after,
  :deep(.prose h2 a)::after,
  :deep(.prose h3 a)::after,
  :deep(.prose h4 a)::after,
  :deep(.prose h5 a)::after,
  :deep(.prose h6 a)::after {
    content: "";
    position: absolute;
    left: -1.5em;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    opacity: 0;
    transition: opacity 0.2s ease;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/%3E%3Cpath d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71'/%3E%3C/svg%3E");
    background-size: contain;
    background-repeat: no-repeat;
    cursor: pointer;
  }

  :deep(.prose h1:hover a)::after,
  :deep(.prose h2:hover a)::after,
  :deep(.prose h3:hover a)::after,
  :deep(.prose h4:hover a)::after,
  :deep(.prose h5:hover a)::after,
  :deep(.prose h6:hover a)::after {
    opacity: 1;
  }
}

/* Fallback for other links not in paragraphs or headings */
:deep(.prose a:not(h1 a):not(h2 a):not(h3 a):not(h4 a):not(h5 a):not(h6 a):not(p a)) {
  @apply text-primary underline decoration-2 underline-offset-2;
}

:deep(.prose code) {
  @apply bg-muted px-2 py-1 rounded-md text-sm;
}

:deep(.prose pre) {
  /** 
  //@apply bg-muted border p-4 rounded-lg overflow-x-auto;
    */
}
/* not for docs, but for blogs and etc */
     :deep(code.hljs) {
            display: block;
            border-radius: 4px;
            padding: 10px;
             @apply   p-4 rounded-lg
        }

:deep(.prose blockquote) {
  @apply border-l-4 border-muted pl-4 italic text-muted-foreground;
}

:deep(.prose ul) {
  @apply list-disc pl-6;
}

:deep(.prose ol) {
  @apply list-decimal pl-6;
}

:deep(.prose li) {
  @apply my-2;
}
</style>
