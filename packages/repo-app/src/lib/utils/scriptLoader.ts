// utils/scriptLoader.ts

interface ScriptOptions {
	async?: boolean;
	defer?: boolean;
	crossOrigin?: string;
	integrity?: string;
	type?: string;
}

export const loadScript = (
	src: string,
	options: ScriptOptions = {},
): Promise<void> => {
	return new Promise((resolve, reject) => {
		// Check if script already exists
		if (document.querySelector(`script[src="${src}"]`)) {
			resolve();
			return;
		}

		const script = document.createElement("script");
		script.src = src;

		// Apply options
		if (options.async) script.async = true;
		if (options.defer) script.defer = true;
		if (options.crossOrigin) script.crossOrigin = options.crossOrigin;
		if (options.integrity) script.integrity = options.integrity;
		if (options.type) script.type = options.type;

		// Handle loading
		script.onload = () => resolve();
		script.onerror = (error) => reject(error);

		document.head.appendChild(script);
	});
};

/*


// Example usage in a Vue component:
import { defineComponent, onMounted } from 'vue';
import { loadScript } from '@/utils/scriptLoader';

export default defineComponent({
  name: 'StripePricingTable',
  props: {
    pricingTableId: {
      type: String,
      required: true
    },
    publishableKey: {
      type: String,
      required: true
    }
  },
  setup(props) {
    onMounted(async () => {
      try {
        await loadScript('https://js.stripe.com/v3/pricing-table.js', { async: true });
        // Script is now loaded and ready to use
      } catch (error) {
        console.error('Failed to load Stripe Pricing Table script:', error);
      }
    });

    return () => (
      <stripe-pricing-table
        pricing-table-id={props.pricingTableId}
        publishable-key={props.publishableKey}
      />
    );
  }
});*/
