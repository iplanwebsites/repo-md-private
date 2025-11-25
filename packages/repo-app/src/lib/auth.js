import { supabase } from "@/lib/supabaseClient";

/*
export async function signInWithEmail() {
  const { data, error } = await supabase.auth.signInWithOtp({
    email: "felix.menard@gmail.com",
    options: {
      // set this to false if you do not want the user to be automatically signed up
      shouldCreateUser: true,
      emailRedirectTo: "http://localhost:5173/",
    },
  });
}

*/

// Admin emails that are allowed to access admin routes
const ADMIN_EMAILS = [
  "felix.menard@gmail.com",
  // Add other admin emails as needed
];

/**
 * Check if a user is an admin based on their email
 * @param {Object} user - Supabase user object
 * @returns {boolean} - Whether the user is an admin
 */
export async function isAdmin(user) {
  if (!user) return false;
  
  // Check if user's email is in the admin list
  return ADMIN_EMAILS.includes(user.email);
}

/// WIP
export async function setIpProfile(userId) {
	try {
		// 1. Get the full IP profile
		const response = await fetch("https://ipapi.co/json/");
		const ipProfile = await response.json();

		console.log("IP profile:", ipProfile);
		// 2. Save the full IP profile to the user's metadata
		const { data, error } = await supabase.from("user_ip_profiles").insert({
			user_id: userId,
			ip_profile: ipProfile,
			created_at: new Date().toISOString(),
		});

		if (error) throw error;

		console.log("IP profile saved successfully");
	} catch (error) {
		console.error("Error setting IP profile:", error.message);
		throw error;
	}
}
