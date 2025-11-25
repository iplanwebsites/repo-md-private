import { TRPCError } from "@trpc/server";
import { z } from "zod";
import chalk from "chalk";
import { router, procedure } from "../lib/trpc/trpc.js";
import {
  protectedProcedure,
  adminProcedure,
  // patientProcedure,
} from "../lib/trpc/procedures.js";
import User from "../models/userModel.js";
import bcrypt from "bcryptjs";

// Import utilities
import { formatMdText } from "../lib/format.js";
import { db } from "../db.js";
import { getBlogs, getBlog } from "../lib/blog.js";
import {
  llm,
  getAiModelConfig,
  generateAgentPrompt,
} from "../lib/chat/openaiClient.js";

import { getEphemeralOpenAiToken } from "../lib/chat/realtimeUtils.js";

// Routes
import { adminRoutes } from "./adminRoutes.js";
import { adminDbRoutes } from "./adminDbRoutes.js";
import { stripeRoutes } from "./stripeRoutes.js";
import { waitlistRoutes } from "./waitlistRoutes.js";
import { githubRouter } from "./githubRoutes.js";
import { orgRouter } from "./orgRoutes.js";
import { projectRouter } from "./projectRoutes.js";
import { cloudRunRouter } from "./cloudRunRoutes.js";
import { webhookRouter } from "./webhookRoutes.js";
import { projectWebhookRouter } from "./projectWebhookProcedures.js";
import { projectGenerationRouter } from "./projectGenerationRoutes.js";
import { llmRouter } from "./llmRouter.js";
import { slackRouter } from "./slackRoutes.js";
import editorChatRouter from "./trpc/editorChatRouter.js";
import { scheduleRouter } from "./scheduleRouter.js";

import { accountRoutes } from "./accountRoutes.js";

// Import JWT utilities
import {
  generateToken,
  generateInviteToken,
  verifyInviteToken,
} from "../utils/jwt.js";

// Email services
import EmailService from "../lib/emailService.js";
import Brevo from "../lib/brevo.js";

// Config constants
const useDevWorker = process.env.USE_DEV_CLOUDRUN_WORKER === "true";
const VAULT_PATH = process.env.USE_LOCAL_VAULT
  ? "../repo-md-wiki" // not there in prod
  : ".public"; // TEMP

// Default prompts
const defaultSystemPrompt = "You are a helpful assistant.";

// Initialize services
let vault;
let emailService = null;
const brevo = new Brevo(process.env.BREVO_API_KEY, "allo@repo.md", "PushMD");

// Initialize email service
const initializeEmailService = async () => {
  if (!emailService) {
    emailService = new EmailService();
    await emailService.initialize();
  }
  return emailService;
};
initializeEmailService();

// Input validation schemas
const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const updateProfileSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
});

async function sentTestEmail() {
  await emailService.sendEmail({
    templateId: "patientWelcomeEmail",
    to: "felix.menard@gmail.com", // input.email
    data: {
      firstName: "bob", // input.name.split(" ")[0]
      coachName: "bob",
    },
  });
}

setTimeout(() => {
  // sentTestEmail();
}, 5000);

// Create the router with all user-related procedures
const userRouter = router({
  // Routes from other files
  ...adminRoutes,
  ...adminDbRoutes,
  ...accountRoutes,
  ...stripeRoutes,
  ...waitlistRoutes,
  github: githubRouter,
  orgs: orgRouter,
  projects: projectRouter,
  cloudRun: cloudRunRouter,
  webhooks: webhookRouter,
  projectWebhooks: projectWebhookRouter,
  projectGeneration: projectGenerationRouter,
  llm: llmRouter,
  slack: slackRouter,
  editorChat: editorChatRouter,
  schedule: scheduleRouter,

  // Basic test endpoints

  ok: procedure.input(z.any().optional()).query(({ input }) => {
    return `ok!!! yes!! ${input}`;
  }),

  hello: procedure.input(z.string()).query(({ input }) => {
    return `Hello ${input}`;
  }),

  testPublic: procedure.input(z.any()).query(({ input }) => {
    return { success: true, message: "Public route works!", date: new Date() };
  }),

  testProtected: protectedProcedure.input(z.any()).query(({ input, ctx }) => {
    return {
      success: true,
      message: "Protected route works!",
      user: ctx.user,
      date: new Date(),
    };
  }),

  testAdmin: adminProcedure.input(z.any()).query(({ input }) => {
    return { success: true, message: "Admin route works!" };
  }),

  // Blog related endpoints
  getBlog: procedure.input(z.any()).query(async ({ input }) => {
    const id = input || "not-found";
    const decoded = decodeURIComponent(id);
    const b = await getBlog(decoded);
    if (!b) return null;

    return { ...b, originalRouteInput: id };
  }),

  getBlogs: procedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(10),
      }).optional().default({})
    )
    .query(async ({ input }) => {
      const { page = 1, limit = 10 } = input;
      const allBlogs = await getBlogs();
      
      // Calculate pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedBlogs = allBlogs.slice(startIndex, endIndex);
      
      return {
        blogs: paginatedBlogs,
        pagination: {
          page,
          limit,
          total: allBlogs.length,
          totalPages: Math.ceil(allBlogs.length / limit),
          hasNext: endIndex < allBlogs.length,
          hasPrev: page > 1,
        },
      };
    }),

  getEphemeralOpenAiToken: procedure
    .input(z.string().optional())
    .query(async ({ input }) => {
      return await getEphemeralOpenAiToken({
        systemPrompt: input || defaultSystemPrompt,
      });
    }),

  // Agent chat implementation
  openAiCompletion: protectedProcedure
    .input(z.any())
    .mutation(async ({ input }) => {
      try {
        console.log(input, "input LLLLMMMMM");
        const { messages, conversationId, patientId, systemPrompt } = input;

        // Debug log
        console.log(
          `Processing conversation: ${conversationId}, patientId: ${
            patientId || "none"
          }`
        );
        console.log("Messages array:", JSON.stringify(messages));

        // Validate messages array
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          throw new Error("Messages array is empty or invalid");
        }

        // Ensure there's at least a system message
        if (!messages.some((msg) => msg.role === "system")) {
          console.log("No system message found, adding default system message");
          messages.unshift({
            role: "system",
            content: "You are a helpful assistant.",
          });
        }

        // Call OpenAI API
        const completion = await llm.chat.completions.create({
          ...getAiModelConfig("wiso"),
          messages: messages,
        });

        // Extract the response
        const responseContent = completion.choices[0]?.message?.content || "";

        console.log(
          "Received response:",
          responseContent.substring(0, 100) + "..."
        );

        return {
          content: responseContent,
          conversationId,
        };
      } catch (error) {
        // Detailed error logging
        console.error("OpenAI API error:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));

        throw new Error(
          "Failed to get AI response: " + (error.message || "Unknown error")
        );
      }
    }),

  // User authentication endpoints
  register: procedure.input(registerSchema).mutation(async ({ input }) => {
    const { name, email, password } = input;

    const userExists = await User.findOne({ email });
    if (userExists) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "User already exists",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const token = generateToken(user._id);

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      token,
    };
  }),

  login: procedure.input(loginSchema).mutation(async ({ input }) => {
    const { email, password } = input;
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      const token = generateToken(user._id);

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        token,
      };
    }

    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid email or password",
    });
  }),

  getUsers: adminProcedure.query(async () => {
    const users = await User.find({}).select("-password");
    return users;
  }),

  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await User.findById(ctx.user.id);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (input.name) user.name = input.name;
      if (input.email) user.email = input.email;
      if (input.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(input.password, salt);
      }

      const updatedUser = await user.save();

      return {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        isAdmin: updatedUser.isAdmin,
      };
    }),
});

export default userRouter;
