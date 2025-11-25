// Import the necessary modules from Vue and other dependencies
import { createApp } from "vue";
import { createPinia } from "pinia";
import * as Sentry from "@sentry/vue";

import piniaPluginPersistedstate from "pinia-plugin-persistedstate";

import { logStyledMessage } from "./plugins/crazyLog.js";
import { isLocalhost } from "@/lib/utils/devUtils.js";
logStyledMessage();

import "./style.css";
import "./assets/index.css";
// @ts-ignore: Ignore module declaration error for router.js
import router from "./router.js";
import { createHead } from "@unhead/vue";

import { MotionPlugin } from '@vueuse/motion'



// Import the main App component
import App from "./App.vue";

// Import the Iconify plugin directly
import { Icon } from "@iconify/vue";

import { appConfigs } from "@/appConfigs.js";

const { USE_SENTRY_IN_DEV, SENTRY_DSN } = appConfigs;

import "./assets/font/general/css/general-sans.css";
//  import './assets/font/poppins/poppins.css'

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

// Create a new Vue app instance
const app = createApp(App);

if (SENTRY_DSN && USE_SENTRY_IN_DEV && !isLocalhost()) {
	Sentry.init({
		app,
		dsn: SENTRY_DSN,
		integrations: [],
		environment: isLocalhost() ? "dev 🧪🧑‍💻" : "production",
	});
}
// myUndefinedFunction();

app.use(pinia);
app.use(MotionPlugin)
// Register the Iconify component globally
app.component("Icon", Icon);

const head = createHead();
app.use(head);

// Use the router
app.use(router);

// import 'html-midi-player'

// Mount the app to the DOM element with the id 'app'
app.mount("#app");
