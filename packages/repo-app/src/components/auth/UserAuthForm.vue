<script setup>
import { ref, onMounted, computed } from "vue";
import { useRoute } from "vue-router";
//import LucideSpinner from "~icons/lucide/loader-2";
//import GitHubLogo from "~icons/radix-icons/github-logo";

import { cn } from "@/lib/utils";

import { supabase } from "@/lib/supabaseClient";

import { loadScript } from "@/lib/utils/loadScript.js";

const route = useRoute();

// Control which authentication methods are enabled
const ENABLE_GOOGLE = false;
const ENABLE_EMAIL = false;
const ENABLE_GITHUB = true;

const loading = ref(false);
const completedEmailSignup = ref(false); // Ref to track email signup completion
const email = ref("");

const handleLogin = async () => {
	try {
		loading.value = true;
		// alert(email.value);
		const { error } = await supabase.auth.signInWithOtp(
			{
				email: email.value,
			},
			{
				redirectTo: window.location.origin,
			},
		);
		if (error) throw error;
		//  if (error) throw error;
		completedEmailSignup.value = true; // Show "check your email" message

		// alert("Check your email for the login link!");
	} catch (error) {
		if (error instanceof Error) {
			console.log(error);
			alert(error.message);
		}
	} finally {
		loading.value = false;
	}
};

/*
import { Button } from "@/lib/registry/new-york/ui/button";
import { Input } from "@/lib/registry/new-york/ui/input";
import { Label } from "@/lib/registry/new-york/ui/label";
*/

async function handleSignInWithGoogle(response) {
	loading.value = true;
	console.log(response);
	const { data, error } = await supabase.auth.signInWithIdToken({
		provider: "google",
		token: response.credential,
	});
	loading.value = false;
	console.log(data);
	if (error) {
		console.error(error);
		alert(error.message);
		return;
	}
	//  alert("done auth!");
}

function saveReturnedOrignalGithubTokenToServerForLaterUse(data) {
	//todo
}

// Handle GitHub sign in
const handleSignInWithGithub = async () => {
	try {
		loading.value = true;
		
		// Get the redirect URL from the route query params if available
		const redirectUrl = route.query.redirect 
			? `${window.location.origin}${route.query.redirect}`
			: window.location.origin;
		
		const { data, error } = await supabase.auth.signInWithOAuth({
			provider: "github",
			options: {
				//  scopes: "repo,read:user,user:email,read:org",
				scopes:
					//repo_deployment
					"repo,public_repo,user:email,repo:status,write:repo_hook,read:org",

				// https://supabase.com/docs/reference/javascript/auth-signinwithoauth
				redirectTo: redirectUrl,
				skipBrowserRedirect: false,
				queryParams: { force: true }, //not working, rando try
				//https://supabase.com/docs/reference/javascript/auth-signinwithoauth
			},
		});

		saveReturnedOrignalGithubTokenToServerForLaterUse(data);

		if (error) throw error;
	} catch (error) {
		if (error instanceof Error) {
			console.log(error);
			alert(error.message);
		}
	} finally {
		loading.value = false;
	}
};

window.handleSignInWithGoogle = handleSignInWithGoogle; //expose globally for goog.

const shouldShowLoginWithGooglePopup = computed(() => {
	return (route.name === "home" || route.path === "/") && ENABLE_GOOGLE;
});

// Check if any social auth method is enabled
const showSocialAuth = computed(() => {
	return ENABLE_GOOGLE || ENABLE_GITHUB;
});

onMounted(async () => {
	// Only load Google Sign-In if enabled and on the appropriate route
	if (ENABLE_GOOGLE && (route.name === "home" || route.path === "/")) {
		try {
			await loadScript("https://accounts.google.com/gsi/client");
			console.log("Google Sign-In script loaded successfully");
			// You can initialize Google Sign-In functionality here
		} catch (error) {
			console.error(error.message);
		}
	}
});
</script>

<template>
  <!-- Fullscreen message after email signup -->
  <div
    v-if="completedEmailSignup"
    class="fixed inset-0 flex items-center justify-center z-50"
    style="background: darkseagreen"
  >
    <div class="text-center">
      <p class="text-2xl mb-4">
        We've sent an email to
        {{ email }}. Check your inbox to log in.
      </p>
      <button @click="completedEmailSignup = false" class="text-xl">
        <icon icon="mdi:close" class="text-3xl" />
      </button>
    </div>
  </div>

  <!-- Scrim for loading state -->
  <div
    v-if="loading"
    class="fixed inset-0 bg-opacity-50 z-40 flex items-center justify-center"
    style="background: #888"
  >
    <div class="text-lg">Loading...</div>
  </div>

  <!-- Form content -->
  <div class="container mx-auto p-4">
    <form v-if="ENABLE_EMAIL" @submit.prevent="handleLogin" class="grid gap-6">
      <div></div>
      <div class="grid gap-2">
        <Input
          class="inputField border p-2"
          required
          type="email"
          placeholder="Your email"
          v-model="email"
          :disabled="loading"
          name="email"
        />
        <Button
          :disabled="loading"
          class="btn px-4 py-2"
          @click.native="handleLogin"
        >
          {{ loading ? "Loading..." : "Send login link" }}
        </Button>
      </div>
    </form>

    <div class="relative mt-6" v-if="ENABLE_EMAIL && showSocialAuth">
      <div class="absolute inset-0 flex items-center">
        <span class="w-full border-t" />
      </div>
      <div class="relative flex justify-center text-xs uppercase">
        <span class="px-2 mb-6 mt-6"> Or continue with </span>
      </div>
    </div>

    <!-- Social auth buttons -->
    <div v-if="showSocialAuth" class="socialAuth flex flex-col gap-4">
      <!-- GitHub login button -->
      <Button
        v-if="ENABLE_GITHUB"
        @click="handleSignInWithGithub"
        class="btn px-4 py-2 flex items-center justify-center gap-2"
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          aria-hidden="true"
          class="w-5 h-5"
        >
          <path
            fill="currentColor"
            d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
          ></path>
        </svg>
        Continue with GitHub
      </Button>

      <!-- Google login button -->
      <div
        v-if="ENABLE_GOOGLE && shouldShowLoginWithGooglePopup"
        id="g_id_onload"
        data-client_id="536601814961-vfeoht26arujkomjqi57mbv5bnksfrho.apps.googleusercontent.com"
        data-context="use"
        data-ux_mode="popup"
        data-callback="handleSignInWithGoogle"
        data-auto_select="true"
        data-close_on_tap_outside="false"
        data-itp_support="true"
      ></div>

      <div
        v-if="ENABLE_GOOGLE"
        class="g_id_signin"
        data-type="standard"
        data-shape="rectangular"
        data-theme="outline"
        data-text="continue_with"
        data-size="large"
        data-logo_alignment="left"
      ></div>
    </div>
  </div>
</template>
