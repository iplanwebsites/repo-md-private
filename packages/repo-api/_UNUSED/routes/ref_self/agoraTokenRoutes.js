// AgoraTokenRoutes.js
import express from "express";
import pkg from "agora-access-token";
const { RtcTokenBuilder, RtcRole, RtmTokenBuilder, RtmRole } = pkg;

const router = express.Router();

// Get Agora credentials from environment variables
const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

/**
 * Middleware to prevent caching of responses
 * This ensures tokens are always generated fresh
 */
const nocache = (_, resp, next) => {
  resp.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  resp.header("Expires", "-1");
  resp.header("Pragma", "no-cache");
  next();
};

/**
 * Simple health check endpoint
 */
const ping = (req, resp) => {
  resp.send({ message: "pong agora router repo-md.api" });
};

/**
 * Generate RTC token for video/audio communication
 * @param {string} channel - Channel name
 * @param {string} uid - User ID
 * @param {string} role - User role (publisher/audience)
 * @param {string} tokentype - Token type (userAccount/uid)
 * @param {number} expiry - Token expiry time in seconds
 */
const generateRTCToken = (req, resp) => {
  // set response header
  resp.header("Access-Control-Allow-Origin", "*");
  // get channel name
  const channelName = req.params.channel;
  if (!channelName) {
    return resp.status(400).json({ error: "channel is required" });
  }
  // get uid
  let uid = req.params.uid;
  if (!uid || uid === "") {
    return resp.status(400).json({ error: "uid is required" });
  }
  // get role
  let role;
  if (req.params.role === "publisher") {
    role = RtcRole.PUBLISHER;
  } else if (req.params.role === "audience") {
    role = RtcRole.SUBSCRIBER;
  } else {
    return resp.status(400).json({ error: "role is incorrect" });
  }
  // get the expire time
  let expireTime = req.query.expiry;
  if (!expireTime || expireTime === "") {
    expireTime = 3600;
  } else {
    expireTime = parseInt(expireTime, 10);
  }
  // calculate privilege expire time
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;
  // build the token
  let token;
  if (req.params.tokentype === "userAccount") {
    token = RtcTokenBuilder.buildTokenWithAccount(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      role,
      privilegeExpireTime
    );
  } else if (req.params.tokentype === "uid") {
    const numericUid = parseInt(uid, 10);
    if (isNaN(numericUid)) {
      return resp.status(400).json({
        error:
          "uid must be numeric for Agora RTC connections with tokentype=uid",
        providedUid: uid,
      });
    }
    uid = numericUid; // Use the numeric value
    token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      role,
      privilegeExpireTime
    );
  } else {
    return resp.status(400).json({ error: "token type is invalid" });
  }
  // return the token
  return resp.json({ rtcToken: token });
};

/**
 * Generate RTM token for real-time messaging
 * @param {string} uid - User ID
 * @param {number} expiry - Token expiry time in seconds
 */
const generateRTMToken = (req, resp) => {
  // set response header
  resp.header("Access-Control-Allow-Origin", "*");

  // get uid
  let uid = req.params.uid;
  if (!uid || uid === "") {
    return resp.status(400).json({ error: "uid is required" });
  }
  // get role
  let role = RtmRole.Rtm_User;
  // get the expire time
  let expireTime = req.query.expiry;
  if (!expireTime || expireTime === "") {
    expireTime = 3600;
  } else {
    expireTime = parseInt(expireTime, 10);
  }
  // calculate privilege expire time
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;
  // build the token
  const token = RtmTokenBuilder.buildToken(
    APP_ID,
    APP_CERTIFICATE,
    uid,
    role,
    privilegeExpireTime
  );

  /// show rtm token with key emoji, as well as type of uuid, number, or string, original uid
  console.log("RTM Token: ", token);
  console.log("RTM Token Type: ", typeof token);
  console.log("RTM Token UID: ", uid);
  console.log("RTM Token UID Type: ", typeof uid);
  console.log("RTM Token Expiry: ", expireTime);

  // return the token
  return resp.json({ rtmToken: token });
};

/**
 * Generate both RTC and RTM tokens in a single request
 * Useful for applications needing both video/audio and messaging capabilities
 * @param {string} channel - Channel name
 * @param {string} uid - User ID
 * @param {string} role - User role (publisher/audience)
 * @param {number} expiry - Token expiry time in seconds
 */
const generateRTEToken = (req, resp) => {
  // Set response header
  resp.header("Access-Control-Allow-Origin", "*");

  // Get channel name
  const channelName = req.params.channel;
  if (!channelName) {
    return resp.status(400).json({ error: "channel is required" });
  }

  // Get uid and strictly validate it's numeric
  let uid = req.params.uid;
  if (!uid || uid === "") {
    return resp.status(400).json({ error: "uid is required" });
  }

  // IMPORTANT: Validate the UID is numeric
  const numericUid = parseInt(uid, 10);
  if (isNaN(numericUid)) {
    return resp.status(400).json({
      error: "uid must be numeric for Agora RTC connections",
      providedUid: uid,
      providedType: typeof uid,
    });
  }

  // Log the validated UID for debugging
  console.log("🔑 Token generation for:", {
    channelName,
    originalUid: uid,
    numericUid,
    uidType: typeof numericUid,
  });

  // Get role
  let role;
  if (req.params.role === "publisher") {
    role = RtcRole.PUBLISHER;
  } else if (req.params.role === "audience") {
    role = RtcRole.SUBSCRIBER;
  } else {
    return resp.status(400).json({ error: "role is incorrect" });
  }

  // Get the expire time
  let expireTime = req.query.expiry;
  if (!expireTime || expireTime === "") {
    expireTime = 3600;
  } else {
    expireTime = parseInt(expireTime, 10);
  }

  // Calculate privilege expire time
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;

  // Build the tokens using the validated numeric UID
  const rtcToken = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    numericUid, // Use numeric UID for RTC
    role,
    privilegeExpireTime
  );

  const rtmToken = RtmTokenBuilder.buildToken(
    APP_ID,
    APP_CERTIFICATE,
    numericUid.toString(), // Convert to string for RTM
    role,
    privilegeExpireTime
  );

  // Return the tokens
  return resp.json({ rtcToken: rtcToken, rtmToken: rtmToken });
};

// Define API endpoints
router.get("/ping", nocache, ping);
router.get("/rtc/:channel/:role/:tokentype/:uid", nocache, generateRTCToken);
router.get("/rtm/:uid", nocache, generateRTMToken);
router.get("/rte/:channel/:role/:tokentype/:uid", nocache, generateRTEToken);

export default router;
