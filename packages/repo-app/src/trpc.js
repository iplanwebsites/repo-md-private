import { createTRPCProxyClient, httpBatchLink, loggerLink } from "@trpc/client";

/*
TODO: add toast support for ERROR

import { useToast } from "@/components/ui/toast/use-toast";

const { toast } = useToast();
//import { ToastAction } from "@/components/ui/toast";
//import { h } from "vue";
toast({
  title: "Uh oh! Something went wrong.",
  description: "There was a problem with your request.",
  variant: "destructive",
});
*/

import { getLocalSession } from "@/lib/supabaseClient";
import { appConfigs } from "@/appConfigs.js";
import { isLocalhost } from "@/lib/utils/devUtils.js";

const { USE_DEV_API_IN_DEV, API_DOMAIN, DEV_API_DOMAIN } = appConfigs;

const getBaseUrl = () => {
	//const isDev = isLocalhost();
	//const base = isDev && USE_DEV_API_IN_DEV ? DEV_API_DOMAIN : API_DOMAIN;
	const base = appConfigs.apiUrl;

	return `${base}/trpc`;
};

// Create a function to get the current auth headers
const getAuthHeaders = () => {
	const session = getLocalSession(); // JSON.parse(localStorage.getItem(SUPA_LOCAL_STORAGE) || "{}");

	let Authorization = "";
	if (session?.access_token) {
		Authorization = `Bearer ${session.access_token}`;
	}

	return { Authorization };
};

// Create the tRPC client with a link that always gets fresh headers
const trpc = createTRPCProxyClient({
	links: [
		// Add the logger link before the httpBatchLink
		loggerLink({
			enabled: (opts) =>
				(isLocalhost() && typeof window !== "undefined") ||
				(opts.direction === "down" && opts.result instanceof Error),
		}),
		httpBatchLink({
			url: getBaseUrl(),
			headers: getAuthHeaders, // Pass the function directly - it will be called on each request
			fetch(url, options) {
				return fetch(url, {
					...options,
					credentials: "include", // Important for CORS with credentials
				});
			},
		}),
	],
});

// Optional: Create a wrapper to force refresh the client
export const refreshTrpcAuth = () => {
	// The next request will automatically use the new token
	console.log("tRPC auth refreshed - next request will use new token");
};

window.trpc = trpc; // For debugging purposes
// test it: trpc.ok.query().then(console.log)

export default trpc;
