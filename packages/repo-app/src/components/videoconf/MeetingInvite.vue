<script setup>
import { Copy } from "lucide-vue-next";

// PROPS
const { patientDetails, path, className } = defineProps({
	patientDetails: {
		type: {},
		default: null,
	},
	path: {
		type: String,
		default: "",
	},
	className: {
		type: String,
		default: "",
	},
});

// REF
const showCopySuccess = ref(false);

// EVENT MANAGEMENT
async function copyInviteUrl() {
	try {
		await navigator.clipboard.writeText(meetingInviteUrl.value);
		showCopySuccess.value = true;
	} catch (err) {
		console.error("Copy failed:", err);
	}
}

function hideCopySuccessMessage() {
	showCopySuccess.value = false;
}

// FORMATTING METHODS
const meetingInviteUrl = computed(() => {
	return window.location.origin + path;
});
</script>

<template v-if="patientDetails">
  <div
    @mouseleave="hideCopySuccessMessage"
    class="bg-white rounded-lg shadow p-6"
    :class="className"
  >
    <h2 class="text-2xl font-semibold text-gray-800 mb-4">
      Salle de réunion pour
      <router-link
        :to="{ name: 'client', params: { id: patientDetails.id } }"
        class="text-blue-600 hover:underline"
      >
        <strong>{{ patientDetails.name }}</strong>
      </router-link>
    </h2>

    <p class="text-gray-600 mb-4">
      Partagez ce lien pour inviter d'autres participants à votre réunion :
    </p>

    <div class="flex items-center gap-4 mb-4">
      <input
        readonly
        :value="meetingInviteUrl"
        type="text"
        class="flex-1 px-3 border rounded-lg bg-gray-50 text-gray-700 h-9"
      />
      <button
        @click="copyInviteUrl"
        class="px-4 h-9 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        title="Copier le lien"
      >
        <Copy class="w-5 h-5" />
      </button>
    </div>

    <p v-if="showCopySuccess" class="text-green-600 text-sm">
      Lien copié dans le presse-papiers !
    </p>
  </div>
</template>
