/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import { createClient } from "@supabase/supabase-js";
import NodeCache from "node-cache";

class TokenValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "TokenValidationError";
    this.code = code;
  }
}

class SupabaseTokenValidator {
  constructor({
    supabaseUrl,
    supabaseServiceKey,
    enableCache = true,
    cacheTTL = 300,
  }) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.cache = enableCache ? new NodeCache({ stdTTL: cacheTTL }) : null;
  }

  async checkToken(token) {
    if (!token) {
      throw new TokenValidationError("No token provided", "UNAUTHORIZED");
    }

    // Check cache first if enabled
    if (this.cache) {
      const cachedUser = this.cache.get(token);
      if (cachedUser) return cachedUser;
    }

    try {
      const {
        data: { user },
        error,
      } = await this.supabase.auth.getUser(token);

      if (error || !user) {
        throw new TokenValidationError(
          error?.message || "Invalid token",
          "INVALID_TOKEN"
        );
      }

      const validatedUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        metadata: user.user_metadata,
        user_raw: user,
        identities: user.identities,
        identity1: user.identities[0],
      };

      // Cache the result if caching is enabled
      if (this.cache) {
        this.cache.set(token, validatedUser);
      }

      return validatedUser;
    } catch (error) {
      if (error instanceof TokenValidationError) {
        throw error;
      }
      throw new TokenValidationError(
        "Failed to validate token",
        "SERVER_ERROR"
      );
    }
  }
  async getGitHubAccessToken(userId) {
    try {
      // Use the supabase-js function getSession or getUserById
      const { data, error } = await this.supabase.auth.admin.getUserById(
        userId
      );

      if (error) {
        throw new TokenValidationError(
          error.message || "Failed to retrieve user data",
          "USER_ERROR"
        );
      }

      // Find the GitHub identity in the user's identities
      /*
      const identities = data?.identities || [];
      const githubIdentity = identities.find((id) => id.provider === "github");

      if (!githubIdentity) {
        throw new TokenValidationError(
          "No GitHub identity found for this user",
          "NO_GITHUB_IDENTITY"
        );
      }

      const accessToken = githubIdentity.identity_data?.access_token;

      if (!accessToken) {
        throw new TokenValidationError(
          "GitHub access token not found in identity data",
          "NO_GITHUB_TOKEN"
        );
      }*/

      return accessToken;
    } catch (error) {
      if (error instanceof TokenValidationError) {
        throw error;
      }
      throw new TokenValidationError(
        `Error retrieving GitHub access token: ${error.message}`,
        "GITHUB_TOKEN_ERROR"
      );
    }
  }

  clearCache() {
    if (this.cache) {
      this.cache.flushAll();
    }
  }

  invalidateToken(token) {
    if (this.cache && token) {
      this.cache.del(token);
    }
  }
}

export const createValidator = (config) => new SupabaseTokenValidator(config);
