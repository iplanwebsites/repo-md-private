import { createClient } from "@supabase/supabase-js";

import { appConfigs } from "@/appConfigs.js";

const SUPA_ID = appConfigs.SUPA_ID;

const SUPA_LOCAL_STORAGE = `sb-${SUPA_ID}-auth-token`;
// "sb-opyimzzocrxtrrklxaay-auth-token";

const supaDashboardUrl = `https://supabase.com/dashboard/project/${SUPA_ID}/settings/general`;
console.log("EDIT SUPABASE settings: ", supaDashboardUrl);

// Repo.md
// safari
// https://supabase.com/dashboard/project/opyimzzocrxtrrklxaay/settings/general
export const supabase = createClient(
	`https://${SUPA_ID}.supabase.co/`,

	//"https://opyimzzocrxtrrklxaay.supabase.co/", //  "https://<project>.supabase.co",
	//"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbWZxdHZiaXl3aWF0cXpsYnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgzMzMxODksImV4cCI6MjA1MzkwOTE4OX0.rtSc6nIy1fhFxOtjIGaepxzpjZHOEkMMAtXPY2ljmUg"

	appConfigs.SUPA_CLIENTTOKEN_URL,
);

export const getLocalSession = function () {
	return JSON.parse(localStorage.getItem(SUPA_LOCAL_STORAGE) || "{}");
};

export const getSupaUser = async function () {
	const { data, error: fetchError } = await supabase.auth.getUser();
	if (fetchError) throw fetchError;
	console.log("REFRESHED SUPA USER: ", data);
	return data.user;
	return 55;
};

export const getSession = async function () {
	const { data, error: fetchError } = await supabase.auth.getSession();
	if (fetchError) throw fetchError;
	console.log("GET SUPA SESSION: ", data);

	// session.value = data.session;
	return data.session;
	return data.user;
	return 55;
};

export const getSessioUser = async function () {
	const { data, error: fetchError } = await supabase.auth.getSession();
	if (fetchError) throw fetchError;
	console.log("GET SUPA SESSION: ", data);

	// session.value = data.session;
	return data.user;
	return data.session;

	return 55;
};

export const clearSupaToken = () => {
	localStorage.removeItem(SUPA_LOCAL_STORAGE);
};

export const signOutSupa = async () => {
	try {
		const { error } = await supabase.auth.signOut();

		if (error) throw error;
	} catch (error) {
		console.log(error);
	} finally {
		clearSupaToken();
		window.location = "/";
	}
};

export const getRefreshToken = async function () {
	const session = getLocalSession();
	if (!session?.access_token) return null;
	return session.refresh_token;
	/*
  const { data, error: fetchError } = await supabase.auth.refreshAccessToken(
    session.refresh_token
  );

  if (fetchError) throw fetchError;
*/
	console.log("REFRESHED TOKEN: ", data);
	return data;
};

export const refreshSupaSession = async function (withRefresh = false) {
	try {
		let res = null;
		if (withRefresh) {
			const refresh_token = await getRefreshToken();
			// console.log("refresh_token::", refresh_token);
			const res = await supabase.auth.refreshSession({
				refresh_token,
			});
		} else {
			const res = await supabase.auth.refreshSession();
		}
		if (!res) {
			console.log("EMPTY RES, but you can see local storage token updated...");
		}
		return res;
		console.log("res::", res);
		const { error } = res;
		if (error) throw error;
		console.log("res::", res);
	} catch (err) {
		console.log(err);
		return null;
	}
};
