import { TRPCError } from "@trpc/server";
import { middleware } from "../lib/trpc/trpc.js";
import { createValidator } from "../lib/supaAuth.js";
import { db } from "../db.js";

import "dotenv/config";

// console.log(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");
const tokenValidator = createValidator({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  enableCache: true,
  cacheTTL: 300,
});

const adminEmails = [
  "felix.menard@gmail.com",
  //
];

const editorEmails = [
  "cx@gmail.com", //should have acess to images only
];

/// nasty

function isAdmin(email) {
  return adminEmails.includes(email);
}
function isEditor(email) {
  return adminEmails.includes(email) || editorEmails.includes(email);
}

export const authMiddleware = middleware(async ({ ctx, next }) => {
  const authHeader = ctx.req.headers.authorization;

  //console.log(authHeader, "++ authHeader of user...");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Missing or invalid authorization header [auth.js server 58748]",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const user = await tokenValidator.checkToken(token);

    //   console.log("TOKEN VALIDATOR RESPONSE: ", user);

    // Get full user data from MongoDB including GitHub handle
    const fullUser = await db.users.findOne({ id: user.id });

    if (fullUser) {
      // Merge Supabase user data with MongoDB user data
      Object.assign(user, fullUser);
    }

    // Then get GitHub access token
    // const githubToken = await tokenValidator.getGitHubAccessToken(user.id);
    // console.log("githubToken:", githubToken);

    return next({
      ctx: {
        ...ctx,
        user: {
          ...user,
          isAdmin: isAdmin(user.email), //. === "admin", // Add isAdmin for compatibility with your existing code
          isEditor: isEditor(user.email),
          // githubToken: githubToken,
        },
      },
    });
  } catch (error) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message:
        error.message + "---- Authentication failed [auth.js server 47414122]",
    });
  }
});
