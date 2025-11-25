//// WIP: CORS ISSUE

import OpenAI from "openai";

import { isLocalhost } from "@/lib/utils/devUtils.js";
import { appConfigs } from "@/appConfigs.js";
const { USE_DEV_API_IN_DEV, API_DOMAIN, DEV_API_DOMAIN } = appConfigs;

const getBaseUrl = () => {
	const isDev = isLocalhost();
	const base = appConfigs.apiUrl; //isDev && USE_DEV_API_IN_DEV ? DEV_API_DOMAIN : API_DOMAIN;
	return `${base}/openai`;
};
// Initialize the OpenAI client with the proxy URL
export const openai = new OpenAI({
	apiKey: "dummy-key", // This will be replaced by the server
	baseURL: getBaseUrl(),
	dangerouslyAllowBrowser: true,
	// Add custom fetch to include credentials (same as your tRPC client)

	/*
  fetch: (url, options = {}) => {
    return fetch(url, {
      ...options,
      credentials: "include", // Important for CORS with credentials
    });
  },*/
});

// Use normally
async function test() {
	try {
		const response = await openai.chat.completions.create({
			model: "gpt-4o",
			messages: [
				{ role: "system", content: "You are a helpful assistant." },
				{ role: "user", content: "Hello, how are you today?" },
			],
			temperature: 0.7,
			max_tokens: 500,
		});

		return response.choices[0].message.content;
	} catch (error) {
		console.error("Error calling OpenAI:", error);
		throw error;
	}

	const completion = await openai.chat.completions.create({
		model: "gpt-4o",
		messages: [{ role: "user", content: "Hello!" }],
	});
	console.log("OPENAIIIIIII completion", completion);
}
//test();
