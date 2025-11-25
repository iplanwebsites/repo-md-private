import { ref, watch, onMounted, computed } from "vue";
import { useHead } from "@unhead/vue";

export function persistentRef(defaultValue, key) {
	const storedValue = localStorage.getItem(key);
	const value = ref(storedValue !== null ? storedValue : defaultValue);

	// Watch for changes and update localStorage
	watch(value, (newValue) => {
		localStorage.setItem(key, newValue);
	});

	return value;
}

/**
 * Create a dynamic page title with brand name
 * @param {Object} options
 * @param {import('vue').Ref<string> | Function} options.title - Reactive title or computed
 * @param {string} options.brand - Brand name
 * @param {boolean} options.titleFirst - Whether title should come before brand
 * @returns {Object} useHead return value
 */
export function usePageTitle({ title, brand = "repo.md", titleFirst = true }) {
	const SEP = "•"; //"|";

	// Create computed title based on the arrangement preference
	const fullTitle = computed(() => {
		const titleValue = typeof title === "function" ? title() : title.value;

		if (!titleValue) {
			return brand;
		}

		return titleFirst
			? `${titleValue} ${SEP} ${brand}`
			: `${brand} | ${titleValue}`;
	});

	// Apply the title using useHead
	return useHead({
		title: fullTitle,
		meta: [
			{
				property: "og:title",
				content: fullTitle,
			},
			{
				name: "twitter:title",
				content: fullTitle,
			},
		],
	});
}
