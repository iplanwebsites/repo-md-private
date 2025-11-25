<script setup>
import { ref, computed } from "vue";
import {
	supabase,
	getLocalSession,
	clearSupaToken,
	getSupaUser,
	getRefreshToken,
	refreshSupaSession,
} from "@/lib/supabaseClient";
import { Loader2, AlertTriangle } from "lucide-vue-next";
import { useToast } from "@/components/ui/toast/use-toast";
import trpc from "@/trpc";

const user = ref({});
const cookie = ref({});
const publicResult = ref(null);
const privateResult = ref(null);
const loading = ref(false);
const error = ref(null);
const { toast } = useToast();

const sess = ref(null);
async function getSession() {
	const { data, error } = await supabase.auth.getSession();
	if (error) throw error;
	sess.value = data;
	return data;
}

const newSession = ref(null);
const retrieveNewSupaSession = async (withRefresh = false) => {
	try {
		let res = await refreshSupaSession(withRefresh);
		if (!res) {
			console.log("EMPTY RES, but you can see local storage token updated...");
		}
		console.log("res::", res);
		const { error } = res;
		if (error) throw error;
		console.log("res::", res);
		const data = res.data;
		const { session, user } = data;
		toast({
			title: "Succès",
			description: "Nouvelle session récupérée avec succès!",
		});
		user.value = user;
		cookie.value = session;
	} catch (err) {
		console.log(err);
		error.value = "Erreur lors de la récupération de la session.";
		toast({
			title: "Erreur",
			description: error.value,
			variant: "destructive",
		});
	}
};

const fetchUser = async () => {
	loading.value = true;
	error.value = null;
	try {
		// const { data, error: fetchError } = await supabase.auth.getUser();
		// if (fetchError) throw fetchError;
		user.value = await getSupaUser();
		toast({
			title: "Succès",
			description: "Utilisateur récupéré avec succès!",
		});
	} catch (err) {
		error.value = "Erreur lors de la récupération de l'utilisateur.";
		toast({
			title: "Erreur",
			description: error.value,
			variant: "destructive",
		});
	} finally {
		loading.value = false;
	}
};

const fetchLocalSession = async () => {
	cookie.value = await getLocalSession();
};

const testPublicRoute = async () => {
	try {
		publicResult.value = await trpc.testPublic.query();
		toast({ title: "Succès", description: "Appel public réussi!" });
	} catch (err) {
		toast({
			title: "Erreur",
			description: "Échec de l'appel public.",
			variant: "destructive",
		});
	}
};

const testPrivateCall = async () => {
	try {
		privateResult.value = await trpc.testProtected.query();
		toast({ title: "Succès", description: "Appel privé réussi!" });
	} catch (err) {
		toast({
			title: "Erreur",
			description: err.message,
			variant: "destructive",
		});
	}
};

const expirationInfo = computed(() => {
	if (!cookie.value?.expires_at) return null;

	const expirationDate = new Date(cookie.value.expires_at * 1000);
	const now = new Date();
	const hoursRemaining =
		Math.round(((expirationDate - now) / (1000 * 60 * 60)) * 10) / 10;

	const minutesRemaining =
		Math.round(((expirationDate - now) / (1000 * 60)) * 10) / 10;

	return {
		friendly: expirationDate.toLocaleString(),
		hoursLeft: hoursRemaining,
		minutesRemaining,
	};
});
</script>

<template>
  <div class="container mx-auto p-6">
    <Card>
      <CardHeader>
        <CardTitle>Tests Supabase et TRPC</CardTitle>
      </CardHeader>
      <CardContent>
        <table class="w-full border-collapse border border-gray-300">
          <thead>
            <tr>
              <th class="border p-2">Action</th>
              <th class="border p-2">Résultat</th>
              <th class="border p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="border p-2">Sess</td>
              <td class="border p-2">
                <json-debug
                  :showInProd="true"
                  :data="sess"
                  :expanded="false"
                  label="Session Locale"
                />
              </td>

              <td class="border p-2">
                <Button @click="getSession">getSession</Button>
              </td>
            </tr>

            <tr>
              <td class="border p-2">Session Locale</td>
              <td class="border p-2">
                <json-debug
                  :showInProd="true"
                  :data="cookie"
                  :expanded="false"
                  label="Session Locale"
                />
                <div
                  v-if="expirationInfo"
                  class="mt-2 text-sm text-muted-foreground"
                >
                  Expire le: {{ expirationInfo.friendly }}<br />
                  ({{ expirationInfo.hoursLeft }} heures restantes) - ({{
                    expirationInfo.minutesRemaining
                  }}
                  minutes restantes)
                </div>
              </td>

              <td class="border p-2">
                <Button @click="fetchLocalSession">Voir / re-load</Button>
              </td>
            </tr>
            <tr>
              <td class="border p-2">Utilisateur Supabase</td>
              <td class="border p-2">
                <json-debug
                  :data="user"
                  :expanded="false"
                  label=" returned sesion"
                  :showInProd="true"
                />
              </td>
              <td class="border p-2">
                <Button @click="fetchUser">Récupérer</Button>
              </td>
            </tr>

            <tr>
              <td class="border p-2">
                Refresh Session Supabase (with current token)
              </td>
              <td class="border p-2">
                <json-debug
                  :data="newSession"
                  :expanded="false"
                  label="newSession"
                  :showInProd="true"
                />
              </td>
              <td class="border p-2">
                <Button @click="retrieveNewSupaSession"
                  >retrieveNewSupaSession</Button
                >
              </td>
            </tr>

            <tr>
              <td class="border p-2">
                Refresh Session Supabase (with REFRESH - longterm token)
              </td>
              <td class="border p-2">
                <json-debug
                  :data="newSession"
                  :expanded="false"
                  label="newSession"
                  :showInProd="true"
                />
              </td>
              <td class="border p-2">
                <Button @click="retrieveNewSupaSession(1)"
                  >With refresh token</Button
                >
              </td>
            </tr>

            <tr>
              <td class="border p-2">backend - Appel Public</td>
              <td class="border p-2">
                <json-debug
                  :data="publicResult"
                  :expanded="false"
                  label="Résultat Public"
                  :showInProd="true"
                />
              </td>
              <td class="border p-2">
                <Button @click="testPublicRoute">Tester</Button>
              </td>
            </tr>
            <tr>
              <td class="border p-2">backend - Appel Privé</td>
              <td class="border p-2">
                <json-debug
                  :data="privateResult"
                  :expanded="false"
                  label="Résultat Privé"
                  :showInProd="true"
                />
              </td>
              <td class="border p-2">
                <Button @click="testPrivateCall">Tester</Button>
              </td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
.container {
  max-width: 800px;
}
.text-muted-foreground {
  color: hsl(var(--muted-foreground));
}
</style>
