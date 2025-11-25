<script setup>
import { appConfigs } from "@/appConfigs";
import {
	computed,
	onBeforeUnmount,
	onMounted,
	onUnmounted,
	ref,
	nextTick,
} from "vue";
import AgoraRTC from "agora-rtc-sdk-ng";
import AgoraRTM from "agora-rtm-sdk";
import VideoElement from "./VideoElement.vue";
import UserVideo from "./UserVideo.vue";
import VideoContainer from "./VideoContainer.vue";
import VideoPreviewToolbar from "./VideoPreviewToolbar.vue";
import AgoraTokenClient from "@/lib/agoraTokenService";
import useCallControls from "../hooks/UseCallControls";
import VideoMosaic from "./VideoMosaic.vue";
import JoinMeeting from "./JoinMeeting.vue";
import MeetingToolbar from "./MeetingToolbar.vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import NavigationGuard from "../NavigationGuard.vue";
import { useSettingsStore } from "@/store/settingsStore";

// PROPS
const {
	appId,
	appKey,
	channel,
	session,
	meeting,
	meetingId,
	isHost,
	status,
	className,
} = defineProps({
	appId: {
		type: String,
		default: appConfigs.AGORA_APP_ID,
		required: false,
	},
	appKey: {
		type: String,
		default: appConfigs.AGORA_APP_KEY,
		required: false,
	},
	channel: {
		type: String,
		required: true,
	},
	session: {
		type: Object,
		required: false,
		default: null,
	},
	meeting: {
		type: Object,
		default: null,
	},
	meetingId: {
		type: String,
		required: false,
		default: null,
	},
	isHost: {
		type: Boolean,
		required: false,
		default: false,
	},
	status: {
		type: String,
		default: "preview",
		validator: (value) =>
			["preview", "loading", "ongoing", "ended"].includes(value),
	},
	className: {
		type: String,
		default: "",
	},
});

// EMITERS
const emit = defineEmits(["joining", "loading", "ending"]);
const router = useRouter();
const hostPreferenceEnableRecording = true; // <== Will be replaced by user setting
const settingsStore = useSettingsStore();
const uid = new Date().valueOf() % 10000; // Make sure to use same uid for message and call
const rtmClient = new AgoraRTM.RTM(appId, uid.toString());
const rtcClient = AgoraRTC.createClient({
	codec: "av1",
	mode: "rtc",
});

AgoraRTC.setLogLevel(appConfigs.AGORA_LOG_LEVEL);
const SERVER_URL = "https://api.repo.md";
const tokenService = new AgoraTokenClient(`${SERVER_URL}/agora/token`);
// const audioStorageService = new AudioStorageService(meetingId);

// REFS
const userAudioTrack = ref(null);
const userVideoTrack = ref(null);
const isRecordingReady = ref(false);
const enableLocalAudioRecording = ref(isHost && hostPreferenceEnableRecording);
const remoteUsers = ref({}); // { uid: { videoTrack, audioTrack, width, height, pinned }}
const rtmUsers = ref({}); // { uid: { name, role }}
const resizeTrigger = ref(false);
const fullscreenRef = ref(null);
const isNavGuardOpen = ref(false);
const isNavGuardActive = ref(false);
const navigationEvent = ref(null);
const {
	isMicrophoneMuted,
	isWebcamMuted,
	isFullscreen,
	toggleMicrophone,
	toggleWebcam,
	toggleFullscreen,
	isMicrophoneReady,
	isWebcamReady,
} = useCallControls(userAudioTrack, userVideoTrack, fullscreenRef);

async function requestMediaDevices() {
	try {
		const userTracks = await AgoraRTC.createMicrophoneAndCameraTracks();
		userAudioTrack.value = userTracks[0];
		userVideoTrack.value = userTracks[1];
		console.log("created audio and video tracks", userTracks);
	} catch (error) {
		console.error("Error accessing media devices:", error);
	}
}

async function fetchTokens(uid) {
	try {
		const tokens = await tokenService.fetchRTETokens(channel, uid);

		return tokens;
	} catch (error) {
		console.error("Could not fetch Agora tokens:", error);
		return {};
	}
}

async function joinRtcChannel(rtcToken) {
	return await rtcClient.join(appId, channel, rtcToken ?? null, uid);
}

async function joinRtmChannel(rtmToken) {
	return await rtmClient.login({ token: rtmToken }).then(() => {
		rtmClient.subscribe(channel).then(() => {
			rtmClient.presence.setState(channel, "MESSAGE", {
				state: {
					name: session?.user?.user_metadata?.full_name ?? "Invité",
					uid: uid.toString(),
					role: isHost ? "Coach" : "Participant",
				},
			});
		});
	});
}

function addRtmEventListeners() {
	rtmClient.addEventListener("presence", handlePresence);
}

function removeRtmEventListeners() {
	rtmClient.removeEventListener("presence", handlePresence);
}

function addRtcEventListeners() {
	rtcClient.on("user-published", handleUserPublished);
	rtcClient.on("user-unpublished", handleUserUnpublished);
	rtcClient.on("user-joined", handleUserJoined);
	rtcClient.on("user-left", handleUserLeft);
}

function removeRtcEventListeners() {
	rtcClient.off("user-published", handleUserPublished);
	rtcClient.off("user-unpublished", handleUserUnpublished);
	rtcClient.off("user-joined", handleUserJoined);
	rtcClient.off("user-left", handleUserLeft);
}

function publishTracks() {
	if (userVideoTrack.value) rtcClient.publish(userVideoTrack.value);
	if (userAudioTrack.value) rtcClient.publish(userAudioTrack.value);
}

function unpublishTracks() {
	const isPublishingVideo = rtcClient.localTracks.includes(
		userVideoTrack.value,
	);
	const isPublishingAudio = rtcClient.localTracks.includes(
		userAudioTrack.value,
	);

	if (userVideoTrack.value) {
		if (isPublishingVideo) {
			rtcClient.unpublish(userVideoTrack.value);
			console.log("unpublishing video track");
		}

		userVideoTrack.value.stop();
		userVideoTrack.value.close();
		console.log("released user video track");
	}

	if (userAudioTrack.value) {
		if (isPublishingAudio) {
			rtcClient.unpublish(userAudioTrack.value);
			console.log("unpublishing audio track");
		}

		userAudioTrack.value.stop();
		userAudioTrack.value.close();
		console.log("released user audio track");
	}

	// Reset tracks value
	userVideoTrack.value = null;
	userAudioTrack.value = null;
}

function isStateAvailable(state) {
	if (!state) return false;

	return (
		Object.keys(state).length > 0 && state.uid && state.uid !== uid.toString()
	);
}

function updateRemoteUsers(user = null, mediaType = null) {
	if (!user || !mediaType) return;

	// Get the new track from the user
	const uid = user.uid.toString();
	const trackName = mediaType === "video" ? "videoTrack" : "audioTrack";
	const track = user[trackName];

	// Create or append value to user
	if (!remoteUsers.value[uid]) remoteUsers.value[uid] = {};
	const remoteUser = remoteUsers.value[uid];
	remoteUser[trackName] = track;

	remoteUsers.value = { ...remoteUsers.value };
	console.log("updating remote users with new data", remoteUsers.value);
}

async function handlePresence(e) {
	try {
		// Retrieve list of connected users (AKA occupants)
		const { occupants } = await rtmClient.presence.getOnlineUsers(
			channel,
			"MESSAGE",
		);

		const states = await Promise.all(
			occupants.map(async (user) => {
				return await rtmClient.presence.getState(
					user.userId,
					channel,
					"MESSAGE",
				);
			}),
		);

		states.forEach(({ states }) => {
			const state = states.state;

			if (isStateAvailable(state)) {
				const users = rtmUsers.value;
				if (!users[state.uid]) users[state.uid] = {}; // Only add user if doesnt exist
				users[state.uid].name = state.name;
				users[state.uid].role = state.role;
			}
		});

		rtmUsers.value = { ...rtmUsers.value };
		console.log("updating rtm users with new data", rtmUsers.value);
	} catch (error) {
		console.error("Could not retrieve occupants details", error);
	}
}

async function handleUserPublished(user, mediaType) {
	try {
		await rtcClient.subscribe(user, mediaType);
		updateRemoteUsers(user, mediaType);
	} catch (error) {
		console.error("Could not connect with user", user, error);
	}
}

async function handleUserUnpublished(user, mediaType) {
	updateRemoteUsers(user, mediaType);
}

async function handleUserJoined(user) {
	const uid = user.uid;
	if (remoteUsers.value[uid]) return;
	remoteUsers.value[uid] = {};
	remoteUsers.value = { ...remoteUsers.value };
}

async function handleUserLeft(user) {
	const uid = user.uid;
	if (!remoteUsers.value[uid]) return;
	delete remoteUsers.value[uid];
	remoteUsers.value = { ...remoteUsers.value };
}

async function joinMeeting() {
	emit("loading");
	const { rtcToken, rtmToken } = await fetchTokens(uid);

	try {
		await Promise.all([joinRtcChannel(rtcToken), joinRtmChannel(rtmToken)]);

		publishTracks();
		emit("joining");
		isNavGuardActive.value = true;
		console.log("meeting started");
	} catch (error) {
		console.error("Could not join meeting", error);
		emit("preview");
	}
}

async function leaveMeeting() {
	try {
		unpublishTracks();
		await Promise.all([rtcClient.leave(), rtmClient.logout()]);

		console.log("successfully left meeting");
	} catch (error) {
		console.error("could not leave meeting properly", error);
	}

	isRecordingReady.value = false;
	remoteUsers.value = {};
}

async function meetingEndedView() {
	await nextTick(() => {
		router.push({
			name: "meetDone",
			query: {
				meetingId: meetingId,
				roomId: channel,
			},
		});
	});
}

// EVENT LISTENERS
async function handleJoinMeeting() {
	emit("joining");
}

function handleLeave() {
	isNavGuardActive.value = false;
	emit("ending");
}

function handleVideoResize(e) {
	const users = remoteUsers.value;
	const grid = e.grid;
	const xOffset = e.xOffset;
	let counter = 0;

	Object.values(users).forEach((user) => {
		let width;
		let height;

		if (user.pinned) {
			width = e.pinnedWidth ?? e.width;
			height = e.pinnedHeight ?? e.height;
		} else {
			width = e.width;
			height = e.height;
		}

		let top;
		let left;

		if (user.pinned) {
			const xPosition = counter % grid.w;
			const yPosition = Math.floor(counter / grid.w);
			left = width * xPosition + xOffset;
			top = height * yPosition;
			counter += 1;
		}

		user.videoSize = {
			left: left,
			top: top,
			width: width,
			height: height,
		};
	});

	remoteUsers.value = { ...users };
}

function handleVideoPinned(uid) {
	const users = remoteUsers.value;
	const user = users[uid];

	if (!user) return;
	user.pinned = !user.pinned;
	resizeTrigger.value = !resizeTrigger.value;
}

function handleNavigationAttempted(e) {
	isNavGuardOpen.value = true;
	navigationEvent.value = e;
}

function handleNavigationCancelled() {
	isNavGuardOpen.value = false;
	navigationEvent.value = null;
}

async function handleNavigationConfirmed() {
	isNavGuardActive.value = false;
	if (
		navigationEvent.value &&
		typeof navigationEvent.value.action === "function"
	) {
		emit("loading");
		navigationEvent.value.action();
	} else {
		emit("ending");
		console.warn(
			"No action to perform on navigation event",
			navigationEvent.value,
		);
	}
}

function formatUserName({ name, role } = {}) {
	if (!name) return "Invité";
	return name;
}

const preview = computed(() => {
	return status === "preview";
});

const ongoing = computed(() => {
	return status === "ongoing";
});

const loading = computed(() => {
	return status === "loading";
});

const ended = computed(() => {
	return status === "ended";
});

const meetingTime = computed(() => {
	return meeting?.startTime;
});

const fullname = computed(() => {
	if (!session?.user?.user_metadata.full_name) return "Moi";

	return `${session.user.user_metadata.full_name} (Moi)`;
});

const pinnedUsersCount = computed(() => {
	return Object.values(remoteUsers.value).filter((user) => user.pinned).length;
});

const users = computed(() => {
	const usersList = Object.entries(remoteUsers.value).map(([uid, data]) => {
		return { uid, ...data };
	});

	return usersList;
});

const audioTracks = computed(() => {
	const tracks = Object.values(remoteUsers.value).map(
		(user) => user.audioTrack,
	);
	tracks.push(userAudioTrack.value);
	return tracks
		.filter((tracks) => tracks)
		.map((track) => track.getMediaStreamTrack());
});

const participants = computed(() => {
	const user = {
		name: session.user.user_metadata.full_name ?? "Invité",
		uid: uid.toString(),
		role: isHost ? "Coach" : "Participant",
	};

	const connectedUsers = users.value.map((user) => {
		const uid = user.uid;
		return rtmUsers.value[uid] ?? {};
	});

	return [user, ...connectedUsers];
});

const participantsCount = computed(() => {
	return Object.keys(remoteUsers.value).length;
});

const overlayType = computed(() => {
	if (preview.value) return "none";
	return participantsCount.value === 0 ? "normal" : "small";
});

watch(
	() => status,
	async () => {
		if (ended.value) {
			await meetingEndedView();
		} else if (ongoing.value && rtcClient.connectionState !== "CONNECTED") {
			await joinMeeting();
		}
	},
	{ immediate: true },
);

onMounted(async () => {
	addRtcEventListeners();
	addRtmEventListeners();
	await requestMediaDevices();
});

onBeforeUnmount(async () => {
	removeRtcEventListeners();
	removeRtmEventListeners();
	await leaveMeeting();
});
</script>
<template>
  <div
    class="flex flex-col gap-4 w-full bg-white rounded-lg shadow"
    :class="className"
  >
    <div class="flex flex-col md:flex-row gap-8 items-center">
      <VideoContainer
        v-if="!ended"
        :status="status"
        ref="fullscreenRef"
        :className="`
          ${ongoing || loading ? 'aspect-[10/16] md:aspect-[16/10]' : ''} 
          ${preview ? 'h-full' : ''}
        `"
      >
        <!-- Remote users video mosaic -->
        <VideoMosaic
          :isFullscreen="isFullscreen"
          :participantsCount="participantsCount"
          :pinnedUsersCount="pinnedUsersCount"
          :resizeTrigger="resizeTrigger"
          :className="`
            ${!ongoing ? 'lg:basis-1/2' : ''} 
          `"
          @video-resize="handleVideoResize"
        >
          <VideoElement
            v-for="user in users"
            :key="user.uid"
            :uid="user.uid"
            :name="formatUserName(rtmUsers[user.uid])"
            :audioTrack="user.audioTrack"
            :videoTrack="user.videoTrack"
            :videoSize="user.videoSize"
            :isPinned="user.pinned"
            :participantsCount="participantsCount"
            overlayType="normal"
            :className="`
              border border-black/50
              ${user.pinned ? 'order-first w-full' : ''}
            `"
            @pinned="handleVideoPinned"
          />

          <UserVideo
            :status="status"
            :participantsCount="participantsCount"
            :isFullscreen="isFullscreen"
          >
            <VideoElement
              :audioTrack="userAudioTrack"
              :videoTrack="userVideoTrack"
              :isLocal="true"
              :overlayType="overlayType"
              :name="fullname"
            >
              <VideoPreviewToolbar
                v-if="preview"
                :isMicrophoneMuted="isMicrophoneMuted"
                :isWebcamMuted="isWebcamMuted"
                :isMicrophoneReady="isMicrophoneReady"
                :isWebcamReady="isWebcamReady"
                @toggleMicrophone="toggleMicrophone"
                @toggleWebcam="toggleWebcam"
              />
            </VideoElement>
          </UserVideo>
        </VideoMosaic>

        <JoinMeeting
          v-if="preview"
          className="justify-center lg:basis-1/3"
          :meetingTime="meetingTime"
          @joinMeeting="handleJoinMeeting"
        />

        <!-- Local user preview with controls -->
        <MeetingToolbar
          v-if="ongoing"
          :isMicrophoneMuted="isMicrophoneMuted"
          :isWebcamMuted="isWebcamMuted"
          :isMicrophoneReady="isMicrophoneReady"
          :isWebcamReady="isWebcamReady"
          :isFullscreen="isFullscreen"
          :isHost="isHost"
          @toggleMicrophone="toggleMicrophone"
          @toggleWebcam="toggleWebcam"
          @toggleFullscreen="toggleFullscreen"
          @leave="handleLeave"
        />
      </VideoContainer>

      <NavigationGuard
        v-if="isNavGuardActive"
        :isOpen="isNavGuardOpen"
        @navigationAttempted="handleNavigationAttempted"
        @navigationCancelled="handleNavigationCancelled"
        @navigationConfirmed="handleNavigationConfirmed"
      />
    </div>
  </div>
</template>
