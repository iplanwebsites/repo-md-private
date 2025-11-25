// middleware/auth.js
import { TRPCError } from "@trpc/server";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

// Helper to verify JWT token
const verifyToken = async (token) => {
  if (!token) throw new Error("No token provided");
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error("Token verification failed");
  }
};

// Create the base auth middleware
export const createAuthMiddleware = (t) => {
  return t.middleware(async ({ ctx, next }) => {
    const authHeader = ctx.req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authorized, no token",
      });
    }

    try {
      const token = authHeader.split(" ")[1];
      const decoded = verifyToken(token);

      // Replicate the Express behavior of excluding password
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not found",
        });
      }

      // Add user to context, similar to Express req.user
      return next({
        ctx: {
          ...ctx,
          user,
        },
      });
    } catch (error) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authorized, token failed",
      });
    }
  });
};

// Create admin middleware
export const createAdminMiddleware = (t) => {
  return t.middleware(({ ctx, next }) => {
    console.log(ctx.user, "AUTH.js ctx user");
    if (!ctx.user?.isAdmin) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authorized as an admin",
      });
    }
    return next({ ctx });
  });
};

export const admin = function (a) {
  //todo
  return true;
};

export const protect = function (a) {
  //todo
  return true;
};
