// githubAuthRoutes.js
import express from "express";
import fetch from "node-fetch";
import { Octokit } from "@octokit/rest";
import { db } from "../../db.js";
import { ObjectId } from "mongodb";
import asyncHandler from "../../utils/asyncHandler.js";

const router = express.Router();

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || "https://api.repo.md";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://repo.md";
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_APP_CLIENT_SECRET;
const GITHUB_APP_NAME = process.env.GITHUB_APP_NAME || "repo-md";
const REDIRECT_URI =
  process.env.GITHUB_REDIRECT_URI || `${BACKEND_URL}/auth/github/callback`;
const DEFAULT_SCOPES = ["read:user", "user:email", "repo"];

// Helper functions
const generateRandomState = () =>
  Math.random().toString(36).substring(2, 15) +
  Math.random().toString(36).substring(2, 15);

const encodeState = (data) =>
  Buffer.from(JSON.stringify(data)).toString("base64");

const parseState = (state) => {
  try {
    return JSON.parse(Buffer.from(state, "base64").toString());
  } catch (error) {
    return { csrfToken: state };
  }
};

const handleError = (res, error, errorMessage) => {
  console.error("❌ Error:", error.message);
  console.error("❌ Stack:", error.stack);
  const encodedError = encodeURIComponent(error.message || errorMessage);
  res.redirect(
    `${BACKEND_URL}/auth-error?provider=github&error=${encodedError}`
  );
};

const updateUser = async (userId, data) => {
  if (!userId) return null;

  try {
    const result = await db.users.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { ...data, updatedAt: new Date() } }
    );

    console.log(
      `✅ User update: matched=${result.matchedCount}, modified=${result.modifiedCount}`
    );
    return result;
  } catch (error) {
    console.error("❌ Database error:", error);
    return null;
  }
};

// GitHub API functions
const createAuthUrl = (options = {}) => {
  const scopes = options.scopes || DEFAULT_SCOPES;
  const stateData = {
    csrfToken: options.state || generateRandomState(),
    ...(options.userId && { userId: options.userId }),
    ...(options.next && { next: options.next }),
  };

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.append("client_id", GITHUB_CLIENT_ID);
  authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.append(
    "scope",
    Array.isArray(scopes) ? scopes.join(" ") : scopes
  );
  authUrl.searchParams.append("state", encodeState(stateData));

  return authUrl.toString();
};

const createAppInstallUrl = (options = {}) => {
  const stateData = {
    csrfToken: options.state || generateRandomState(),
    ...(options.userId && { userId: options.userId }),
    next: options.next || `${FRONTEND_URL}/github/installed`,
  };

  const installUrl = new URL(
    `https://github.com/apps/${GITHUB_APP_NAME}/installations/select_target`
  );
  installUrl.searchParams.append("state", encodeState(stateData));
  installUrl.searchParams.append("redirect_uri", REDIRECT_URI);

  return installUrl.toString();
};

const exchangeCodeForToken = async (code) => {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to exchange code for token: ${response.statusText}`
    );
  }

  return response.json();
};

const getGitHubUser = async (token) => {
  const octokit = new Octokit({ auth: token });
  const { data: user } = await octokit.users.getAuthenticated();

  if (!user.email) {
    try {
      const { data: emails } = await octokit.users.listEmailsForAuthenticated();
      const primaryEmail = emails.find((e) => e.primary)?.email;
      if (primaryEmail) user.email = primaryEmail;
    } catch (error) {
      console.error("Error fetching emails:", error.message);
    }
  }

  return user;
};

// Route handlers
router.get("/start", asyncHandler(async (req, res) => {
  console.log("\n🚀 STARTING GITHUB OAUTH FLOW");

  const { userId, next } = req.query;
  const scopes = req.query.scopes?.split(",") || [];

  console.log(`🔑 Auth for userId: ${userId || "none"}`);

  const authUrl = createAuthUrl({
    scopes: [...DEFAULT_SCOPES, ...scopes],
    userId,
    next,
  });

  res.redirect(authUrl);
}));

router.get("/manage-start", asyncHandler(async (req, res) => {
  console.log("\n🚀 STARTING GITHUB APP INSTALLATION");

  const { userId, next } = req.query;
  console.log(`🔑 App installation for userId: ${userId || "none"}`);

  const installUrl = createAppInstallUrl({ userId, next });
  res.redirect(installUrl);
}));

router.get("/callback", asyncHandler(async (req, res) => {
  console.log("\n🔄 GITHUB OAUTH CALLBACK RECEIVED");

  const { code, state } = req.query;
  if (!code) {
    return res.redirect(
      `${BACKEND_URL}/auth-error?provider=github&error=No+code+received`
    );
  }

  const parsedState = parseState(state);
  console.log("🔑 State:", parsedState);

  const tokenData = await exchangeCodeForToken(code);
  console.log("✅ Token received, scopes:", tokenData.scope);

  const githubUser = await getGitHubUser(tokenData.access_token);
  console.log("👤 User:", githubUser.login);

  if (parsedState.userId) {
    await updateUser(parsedState.userId, {
      githubId: githubUser.id,
      githubLogin: githubUser.login,
      githubToken: tokenData.access_token,
      githubTokenScopes: tokenData.scope.split(","),
      githubProfile: {
        name: githubUser.name,
        email: githubUser.email,
        avatarUrl: githubUser.avatar_url,
        htmlUrl: githubUser.html_url,
      },
    });
  }

  const redirectUrl =
    parsedState.next ||
    `${FRONTEND_URL}/auth-success?provider=github&userId=${
      parsedState.userId || ""
    }`;

  res.redirect(redirectUrl);
}));

router.get("/installed", asyncHandler(async (req, res) => {
  console.log("\n🔄 GITHUB APP INSTALLATION CALLBACK");

  const { installation_id, setup_action, state } = req.query;
  if (!installation_id) {
    return res.redirect(
      `${BACKEND_URL}/auth-error?provider=github&error=No+installation+id+received`
    );
  }

  const parsedState = parseState(state);
  console.log("🔑 State:", parsedState);

  if (parsedState.userId) {
    await updateUser(parsedState.userId, {
      githubAppInstallationId: installation_id,
      githubAppSetupAction: setup_action || "install",
    });
  }

  const redirectUrl =
    parsedState.next ||
    `${FRONTEND_URL}/github/installed?installation_id=${installation_id}`;

  res.redirect(redirectUrl);
}));

router.get("/user", asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
        message: "Bearer token required",
      });
    }

    const token = authHeader.split(" ")[1];
    const githubUser = await getGitHubUser(token);

    return res.json({
      success: true,
      user: {
        id: githubUser.id,
        login: githubUser.login,
        name: githubUser.name,
        email: githubUser.email,
        avatar_url: githubUser.avatar_url,
        html_url: githubUser.html_url,
      },
    });
    // Error will be caught by asyncHandler
}));

export default router;
