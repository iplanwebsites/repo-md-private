import { TRPCError } from "@trpc/server";
import { z } from "zod";
import chalk from "chalk";
import { router, procedure } from "../../lib/trpc/trpc.js";
import {
  protectedProcedure,
  adminProcedure,
  patientProcedure,
} from "../../lib/trpc/procedures.js";
import User from "../../models/userModel.js";
import bcrypt from "bcryptjs";

//import { allTools } from "../lib/chat/tools.js";
//import { getEphemeralOpenAiToken } from "../lib/chat/realtimeUtils.js";

//import { analyseConvo } from "../lib/chat/analyseUtils.js";
import { generateFiche } from "../../lib/chat/fiche.js";

import MemoryManager from "../../lib/chat/patientMemory.js";

import { formatMdText } from "../../lib/format.js";

import { db } from "../../db.js";

import { getBlogs, getBlog } from "../../lib/blog.js";

import {
  llm,
  getAiModelConfig,
  getAiPromptConfig,
} from "../../lib/chat/openaiClient.js";

// Routes for meets
import { meetRoutes } from "./meetRoutes.js";
import { textToSpeechRoutes } from "./textToSpeechRoutes.js";
import { adminRoutes } from "../adminRoutes.js";
// adminDbRoutes
import { adminDbRoutes } from "../adminDbRoutes.js";
// Memory routes
import { patientMemoryRoutes } from "./memoryRoutes.js";
// GitHub routes
import { githubRouter } from "../githubRoutes.js";
// Org and Project routes
import { orgRouter } from "../orgRoutes.js";
import { projectRouter } from "../projectRoutes.js";
// CloudRun routes
import { cloudRunRouter } from "../cloudRunRoutes.js";
// Import worker environment flag
const useDevWorker = process.env.USE_DEV_CLOUDRUN_WORKER === "true";

let vault;

const VAULT_PATH = process.env.USE_LOCAL_VAULT
  ? "../repo-md-wiki" // not thre inprod..
  : ".public"; //nope TEMP
// : "./node_modules/repo-md-wiki";

import {
  generateToken,
  generateInviteToken,
  verifyInviteToken,
} from "../../utils/jwt.js";

import {
  testReply,
  insertConvo,
  getConvo,
  getConvos,
  listConvos,
  replyToConvo,
  updateConvoById,
} from "../../lib/chat/convo.js";

import {
  insertPatient,
  getPatient,
  getPatientsByOwner,
  updatePatient,
  addPatientNote,
  archivePatient,
} from "../../lib/patient.js";

import {
  getOwnerPatientActivities,
  getActivity,
  generateActivityInvitation,
  verifyActivityInvitation,
  getActivityById,
  checkActivityAccess,
  getAllActivitiesConfig,
} from "../lib/activity.js";

import {
  getAllExtraConfigs,
  generateExtra,
  getExtra,
} from "../../lib/extras.js";

/*
const tools = [
  {
    name: "get_weather",
    type: "function",
    description: "Get current temperature for a given location.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City and country e.g. Bogotá, Colombia",
        },
      },
      required: ["location"],
      additionalProperties: false,
    },
  },
  send_convo_summary,
];
*/

const cinequizz = `Cinequizz    🧪 

`;
import EmailService from "../../lib/emailService.js";
// First, let's create an email service instance at the top level
let emailService = null;

import Brevo from "../../lib/brevo.js";
import { get } from "http";
const brevo = new Brevo(process.env.BREVO_API_KEY, "allo@repo.md", "PushMD");

setTimeout(() => {
  /*
  brevo
    .sendTransacEmail(1, "felix.menard@gmail.com", "felixtest", {
      name: "felix",
      activity: 1245,
    })
    .then((r) => console.log(r));

  brevo
    .addContact({ email: "mclovin@hotmail.com" })
    .then((r) => console.log(r));


    // Original usage remains unchanged
await brevo.sendTransacEmail(
  1, 
  "user@example.com", 
  { welcomeMessage: "Hello!" },
  "John Doe"
);

// New usage with contact creation
await brevo.sendTransacEmail(
  1,
  "user@example.com",
  { welcomeMessage: "Hello!" },
  "John Doe",
  {
    addContact: true,
    contactAttributes: {
      signupDate: new Date().toISOString(),
      source: "program-signup"
    },
    contactDelay: 500 // Optional, defaults to 500ms
  }
);

await brevo.sendTransacEmail(
  1,
  "user@example.com",
  { welcomeMessage: "Hello!" },
  "John Doe",
  {
    addContact: true,
    contactAttributes: {
      signupDate: new Date().toISOString(),
      source: "program-signup"
    },
    contactDelay: 500 // Optional, defaults to 500ms
  }
);



    */
}, 5000);

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

const inviteTokenSchema = z.object({
  program: z.string(),
  activity: z.string(),
  patientEmail: z.string().email(),
});

async function sentTestEmail() {
  await emailService.sendEmail({
    templateId: "patientWelcomeEmail",
    to: "felix.menard@gmail.com", //input.email,
    data: {
      firstName: "bob", ////input.name.split(" ")[0],
      coachName: "bob",
    },
  });
}

setTimeout(() => {
  // sentTestEmail();
}, 5000);

async function triggerConvoAnalysis(convoId) {
  const convo = await getConvo(convoId);
  if (!convo) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Conversation not found",
    });
  }
  const analysisRes = await analyseConvo(convo);
  const analysis = analysisRes.analysis;
  const formResults = analysisRes.formResults;

  await updateConvoById(convo.id, { analysis, formResults });

  // Ingest the analysys into patient Memory
  /// This could be done async, no need to track it in the response
  const patient = await getPatient(convo.patientId);
  if (patient) {
    const memoryManager = new MemoryManager(patient);
    memoryManager.ingestActivityAnalysis(String(analysis));
  }

  return analysisRes;
}

// Create the router with all user-related procedures
const userRouter = router({
  // ...textToSpeechRoutes,
  //...meetRoutes,
  ...adminRoutes,
  ...adminDbRoutes,

  github: githubRouter,
  orgs: orgRouter,
  projects: projectRouter,
  cloudRun: cloudRunRouter,

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
      //    ctx,
    };
  }),
  testAdmin: adminProcedure.input(z.any()).query(({ input }) => {
    return { success: true, message: "Admin route works!" };
  }),

  getBlog: procedure.input(z.any()).query(({ input }) => {
    // console.log(input, "input");
    const id = input || "not-found";
    const decoded = decodeURIComponent(id);
    const b = getBlog(decoded);
    if (!b) return null;

    return { ...b, originalRouteInput: id };
    // return vault.getBlog();
    //return { success: true, message: "Public route works!", date: new Date() };
  }),

  getBlogs: procedure.input(z.any()).query(({ input }) => {
    console.log("BLOOG");
    // console.log(input, "input");
    const id = input || "not-found";
    const decoded = decodeURIComponent(id);
    const b = getBlogs();
    const limit = 10;
    const maxed = b.slice(0, limit);
    //todo; sort by featured? or date?
    // filter cateory. etd
    return { blogs: b };
    // return vault.getBlog();
    //return { success: true, message: "Public route works!", date: new Date() };
  }),
  listExtras: procedure.input(z.any()).query(({ input }) => {
    console.log("all extras");
    const all = getAllExtraConfigs();
    // const filtered = all.filter((e) => !e.active && e.activityId);
    return all;
  }),
  listActivities: procedure.input(z.any()).query(({ input }) => {
    console.log("all getAllActivitiesConfig");
    const all = getAllActivitiesConfig();
    const filtered = all.filter((e) => e.active && e.activityId);
    return filtered;
  }),

  getOpenAiConvoById: procedure.input(z.string()).query(({ input }) => {
    const id = "conv_Aw8vflSpumnEIioqrQ8TE";
    /// à propos de la tortue.

    // sess_Aw9DQmGvExTPrZRu6fupG

    /// just dont workkkk, no endpoint to retrive it...
    // we need to save it at the end.

    return `Hello ${input}`;
  }),

  saveConvoTranscript: procedure
    // .input(z.object())
    .input(z.any()) // Accept any input
    .mutation(async ({ input }) => {
      console.log("Type of input:", typeof input);
      console.log("saveFullTranscript:", input);
      console.log("Type of input:", typeof input);
      console.log("SAVED TRANSCRIPT TO CONVERSION");
      // console.log("Full input object:", JSON.stringify(input, null, 2));

      const { convoId, transcript } = input;

      const updated = await updateConvoById(convoId, {
        transcript: transcript,
        completedAt: new Date(),
        completed: true,
      });

      console.log(updated, "updated convo");
      void triggerConvoAnalysis(convoId); //
      return { success: true, receivedInput: input, updated };
    }),
  saveFormActivityAnswers: procedure
    .input(z.any())
    .mutation(async ({ input }) => {
      const { convoId, formAnswers } = input;

      const updated = await updateConvoById(convoId, {
        formAnswers,
        completedAt: new Date(),
        completed: true,
      });

      console.log(updated, "updated convo");
      void triggerConvoAnalysis(convoId); //
      return { success: true, receivedInput: input, updated };
    }),
  ///vanilla version
  getEphemeralOpenAiToken: procedure
    .input(z.string().optional())
    .query(async ({ input }) => {
      return await getEphemeralOpenAiToken({
        systemPrompt: input || cinequizz,
      });
    }),

  /////
  // Add these routes within userRouter

  // Modified existing route

  initializeMentor: protectedProcedure
    .input(z.any())
    .query(async ({ input, ctx }) => {
      const user = ctx.user;

      //check if user xist in Db
      const existing = await db.mentors.findOne({ id: user.id });
      const firstLogin = !existing || !existing.receivedWelcomeEmail;

      const updated = await db.mentors.updateOne(
        { id: ctx.user.id, receivedWelcomeEmail: { $ne: true } },
        {
          $set: {
            ...user.metadata,
            ...user,
            receivedWelcomeEmail: true,
            lastSeen: new Date(),
          },
          //upsert yes
        },
        { upsert: true }
      );

      console.log("updated --++-+-  ", updated);

      if (firstLogin) {
        await brevo.sendTransacEmail(
          1, //mentorWelcomeEmail
          user.email,
          { NAME: user?.metadata?.full_name },
          user.metadata.full_name, // "John Doe",
          {
            addContact: true,
          }
        );
        console.log("INITIIIII", user);
      }

      return user;
    }),

  getExtra: procedure.input(z.string()).query(async ({ input }) => {
    const extra = await getExtra(input);
    if (!extra) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Extra content not foun 4854",
      });
    }
    return extra;
  }),
  generateExtra: protectedProcedure
    .input(
      z.object({
        patientId: z.string(),
        extraConfigId: z.string(),
        customData: z.object({}).optional(),
        source: z.string({}).optional(),
        customInstructions: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return await generateExtra({
        ownerId: ctx.user.id,
        patientId: input.patientId,
        extraConfigId: input.extraConfigId,
        customData: input.customData,
        source: input.source,
        customInstructions: input.customInstructions,
      });
    }),

  getPatientDetails: protectedProcedure
    .input(
      z.object({
        patientId: z.string(),
        includeActivities: z.boolean().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const patient = await getPatient(input.patientId, ctx.user.id, {
        includeActivities: input.includeActivities,
      });

      //   console.log("getPatientDetails", patient, input);
      const activities = await getOwnerPatientActivities(
        ctx.user.id,
        input.patientId
      );

      if (!patient || patient.ownerId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Patient not found 12358",
        });
      }

      //  patient.activities = activities;
      patient.input = input || 3333;
      return patient;
    }),
  /*;
    getPatientDetails: protectedProcedure
    .input(z.object({ patientId: z.string() }))
    .query(async ({ input, ctx }) => {
      const client = {}; // get client from db

      const activities = await getOwnerPatientActivities(
        ctx.user.id,
        input.patientId
      );

      // supplement with client notes, personal details, contact infos, etc
      // we group activities by program, compute start date, last update, we show most recent active program first.
      // unstarted program at bottom...
      const programs = []; ///todo
      return { activities, programs };
      return "SAVED";
    }),
*/

  // New routes to add
  createPatient: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        email: z.string().email(),
        phone: z.string().optional(),
        status: z.enum(["active", "archived"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const patientId = await insertPatient({
        ...input,
        ownerId: ctx.user.id,
      });
      return patientId;
    }),

  updatePatientDetails: protectedProcedure
    .input(
      z.object({
        patientId: z.string(),
        updates: z.object({
          name: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          status: z.enum(["active", "archived"]).optional(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify ownership
      const patient = await getPatient(input.patientId);
      if (!patient || patient.ownerId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Patient not found",
        });
      }

      return await updatePatient(input.patientId, input.updates);
    }),

  addPatientNote: protectedProcedure
    .input(
      z.object({
        patientId: z.string(),
        content: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify ownership
      const patient = await getPatient(input.patientId);
      if (!patient || patient.ownerId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Patient not found",
        });
      }

      return await addPatientNote(input.patientId, input.content);
    }),

  listMyPatients: protectedProcedure
    .input(
      z.object({
        includeActivities: z.boolean().optional(),
        status: z.enum(["active", "archived"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const filters = input.status ? { status: input.status } : {};
      return await getPatientsByOwner(ctx.user.id, {
        includeActivities: input.includeActivities,
        ...filters,
      });
    }),

  archivePatientRecord: protectedProcedure
    .input(z.object({ patientId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Verify ownership
      const patient = await getPatient(input.patientId);
      if (!patient || patient.ownerId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Patient not found",
        });
      }

      return await archivePatient(input.patientId);
    }),

  ////
  /// agent chat - use in bubble, standalone implementaiotn of completion API
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

        // Validate messages array (extra safety check)
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

        // Call OpenAI API with explicit messages parameter
        const completion = await llm.chat.completions.create({
          //odel: "gpt-4.1-mini", // or your preferred model
          ...getAiModelConfig("wiso"),
          messages: messages, // Ensure this is passed correctly
          //   temperature: 0.7,
          //    max_tokens: 16384,
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

  getPatientSuggestedPills: patientProcedure
    .input(
      z.object({
        patientId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { patientId } = input;
        const patient = ctx.patient; /// loaded via procedure
        console.log(`Fetching suggested pills for patient: ${patientId}`);

        const defaultPills = [
          {
            id: `patient-${patientId}-progress`,
            title: "Progrès Récents",
            text: "Quels sont les progrès récents de ce client ?",
            icon: "📈",
          },
          {
            id: `patient-${patientId}-challenges`,
            title: "Défis Actuels",
            text: "Quels défis ce client rencontre-t-il actuellement ?",
            icon: "🚧",
          },
          {
            id: `patient-${patientId}-next`,
            title: "Prochaines Étapes",
            text: "Quelles devraient être les prochaines étapes pour ce client ?",
            icon: "👣",
          },
          {
            id: `patient-${patientId}-goals`,
            title: "Objectifs",
            text: "Quels sont les objectifs à long terme de ce client ?",
            icon: "🎯",
          },
          {
            id: `patient-${patientId}-resources`,
            title: "Ressources",
            text: "Quelles ressources pourraient être utiles pour ce client ?",
            icon: "📚",
          },
        ];
        const modelConf = getAiModelConfig("chatAgentConvoStarters");
        console.log("modelConf", modelConf);
        const completion = await llm.chat.completions.create({
          //model: "gpt-4.1-mini", // or your preferred model
          ...modelConf,
          messages: getAiPromptConfig("chatAgentConvoStarters", {
            memory: patient.memory,
            name: patient.name,
          }),

          //messages: messages, // Ensure this is passed correctly
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "patient_pills_response",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  pills: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                          description: "Unique identifier for the pill",
                        },
                        title: {
                          type: "string",
                          description: "Short summary title for the pill",
                        },
                        text: {
                          type: "string",
                          description: "Full question or suggestion text",
                        },
                        icon: {
                          type: "string",
                          description: "Emoji icon representing the pill",
                        },
                      },
                      required: ["id", "title", "text", "icon"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["pills"],
                additionalProperties: false,
              },
            },
          },
          //temperature: 0.7,
          //max_tokens: 16384,
        });

        // Extract the response
        const pillsResponse = JSON.parse(
          completion.choices[0]?.message?.content || "{}"
        );
        console.log("pills:", pillsResponse);
        return { pills: pillsResponse.pills || defaultPills };
      } catch (error) {
        console.error("Error fetching patient pills:", error);
        throw new Error(
          "Failed to fetch suggested pills: " +
            (error.message || "Unknown error")
        );
      }
    }),

  getMeetingSuggestedPills: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { meetingId } = input;
        console.log(`Fetching suggested pills for meeting: ${meetingId}`);

        // Get meeting data if needed (optional)
        // const meeting = await ctx.prisma.meeting.findUnique({
        //   where: { id: meetingId },
        //   include: { patient: true },
        // });

        // Here you would ideally generate dynamic pills based on the meeting data
        // For example, determine if the meeting is in the past or future

        // Mock pills for now - you can replace this with AI-generated or database-driven pills
        const pills = [
          {
            id: `meeting-${meetingId}-prepare`,
            text: "Comment puis-je préparer efficacement cette consultation ?",
            icon: "📝",
          },
          {
            id: `meeting-${meetingId}-review`,
            text: "Pouvez-vous m'aider à analyser cette consultation ?",
            icon: "🔍",
          },
          {
            id: `meeting-${meetingId}-follow`,
            text: "Quels points de suivi recommandez-vous après cette consultation ?",
            icon: "📋",
          },
          {
            id: `meeting-${meetingId}-notes`,
            text: "Aidez-moi à rédiger des notes structurées pour cette consultation",
            icon: "✏️",
          },
          {
            id: `meeting-${meetingId}-insights`,
            text: "Quels insights clés puis-je tirer de cette consultation ?",
            icon: "💡",
          },
        ];

        return { pills };
      } catch (error) {
        console.error("Error fetching meeting pills:", error);
        throw new Error(
          "Failed to fetch suggested pills: " +
            (error.message || "Unknown error")
        );
      }
    }),

  ///////

  generateFiche: procedure.input(z.string()).query(async ({ input }) => {
    const convos = await getConvos({ patientId: input });
    ///NOTE: this may include dupe activities.
    const anals = convos.map((c) => c.analysis);
    if (!anals.length) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Patient activities not counts not found",
      });
    }

    const patient = await getPatient(input);

    console.log(anals, "anals3333");
    const fiche = await generateFiche({ anals, patient });

    // Update patient record with fiche
    // await updateConvoById(convo.id, { analysis });
    try {
      const obj = JSON.parse(fiche);
      console.log(obj, "fiche");

      ///let's update user!
      await updatePatient(input, { fiche: obj });

      return obj;
    } catch (e) {
      console.log(e, "error parsing fiche JSON response from gtp");
      return null;
    }
  }),

  analyseConvo: procedure.input(z.string()).query(async ({ input }) => {
    /*
    const convo = await getConvo(input);
    if (!convo) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      });
    }
    const analysisRes = await analyseConvo(convo);
    const analysis = analysisRes.analysis;
    const formResults = analysisRes.formResults;

    await updateConvoById(convo.id, { analysis, formResults });
*/

    const { formResults, analysis } = await triggerConvoAnalysis(input);

    return { formResults, analysis, analysisHtml: formatMdText(analysis) };
  }),

  getConvoById: procedure
    .input(function (input) {
      return input;
    })
    .query(async ({ input }) => {
      // Example 1: Initial conversation fetch response
      // This represents what getConvoByToken.query() might return

      const convo = await getConvo(input.token);
      if (!convo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }
      const activity = convo.activity;
      const isRealtime = true; ///default
      let ephemeralToken = null;

      const nextActivityId = activity.nextActivityToSuggest;
      let nextActivityInviteUrl = null;
      let nextActivityParams;
      //  const owner = getA;

      if (nextActivityId) {
        /*  id: 'twgWFbwGuvJgYKzwiDl0efMc6jGulJN2',
  patientId: 'CFn2i3inFjd8Ug3Yu2NyTDY6X9yxNi2F',
  ownerId: 'b1acfc99-360f-45cb-a2ea-a19f5bd5642d',
  activityId: 'big5',
  programId: 'general',
  createdAt: 2025-02-19T17:53:22.451Z,
  updatedAt: 2025-02-19T23:42:11.038Z,
  messages: [],
  status: 'active',*/

        nextActivityParams = {
          userId: convo.ownerId, //owner
          program: convo.programId,
          activity: nextActivityId,
          patientId: convo.patientId,
        };

        console.log(convo, "CONVOO", nextActivityParams, "nextActivityParams");
        const nextActivityInviteToken = await generateActivityInvitation(
          nextActivityParams
          /*  activity.ownerId,
        activity.programId,
        nextActivityId, ///might need chopping...
        activity.patientId ///for same dude!*/
        );
        nextActivityInviteUrl = `/start-activity/${nextActivityInviteToken}`;
      }

      let tools = [];
      if (isRealtime) {
        if (activity.tools && activity.tools.length > 0) {
          console.log("activity.tools", activity.tools);
          const allToolsIds = allTools.map((t) => t.name);
          console.log(allToolsIds);
          tools = allTools.filter((t) => activity.tools.includes(t.name));
          console.log("tools", tools);
        }
        ephemeralToken = await getEphemeralOpenAiToken({
          systemPrompt:
            activity.systemPrompt +
            "  ===== At the end of conversation, call saveFullTranscript",
          tools: tools || [],
          // systemPrompt: input || cinequizz,
        });
      }

      const obj = {
        ...convo,
        ephemeralToken,
        input_original: input,
        tools,
        //  nextActivityInviteToken,
        nextActivityInviteUrl,
        nextActivityParams, //dev only...
      };
      return obj;
    }),

  replyConvo: procedure
    .input(function (input) {
      return input;
    })
    .query(async ({ input }) => {
      /// WIP
      const messageSendResponse = {
        message: {
          id: "msg_4",
          role: "assistant",
          content:
            "Project management involves several key areas including scope management, time management, and resource allocation. Which of these would you like to explore first?",
          timestamp: "2025-01-26T10:02:15Z",
        },
        metadata: {
          conversation_id: "conv_123456",
          tokens_used: 48,
          model: "gpt-4.1-mini",
          processing_time: 1.2,
        },
      };

      // Example 4: Error response structure
      // This shows how errors might be structured
      const errorResponse = {
        error: {
          code: "CONVERSATION_NOT_FOUND",
          message: "The specified conversation token is invalid or expired",
          details: {
            token: "invalid_token_123",
            timestamp: "2025-01-26T15:00:00Z",
          },
        },
      };

      // Example 5: Rate limit error
      const rateLimitError = {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message:
            "Too many requests. Please wait before sending more messages",
          details: {
            retry_after: 60, // seconds
            current_usage: {
              requests: 100,
              limit: 100,
              reset_at: "2025-01-26T15:05:00Z",
            },
          },
        },
      };

      // Example 6: Streaming message response
      // If implementing streaming responses
      const streamingMessageChunk = {
        id: "msg_5",
        role: "assistant",
        content: "Project management ", // Partial content
        is_complete: false,
        chunk_index: 1,
        timestamp: "2025-01-26T10:03:00Z",
      };

      // Example 7: Message with additional features
      // Shows how the structure might be extended for rich features
      const enhancedMessageResponse = {
        message: {
          id: "msg_6",
          role: "assistant",
          content: "Here's a breakdown of project management methodologies:",
          timestamp: "2025-01-26T10:04:00Z",
          features: {
            has_markdown: true,
            has_code: false,
            suggested_actions: [
              "Learn more about Agile",
              "Explore Waterfall methodology",
              "View PM tools comparison",
            ],
            references: [
              {
                text: "PMI Guide",
                url: "https://example.com/pmi",
              },
            ],
          },
        },
      };

      console.log(input);

      const messages = [{ role: "user", content: "Say this is a test" }];

      const res = await testReply(messages);
      console.log(res);
      return res;

      return messageSendResponse;
      return `Hello ${input}`;
    }),

  createInviteToken: protectedProcedure
    .input(function (input) {
      return input;
    })
    .query(({ ctx, input }) => {
      console.log("createInviteToken input", input, ctx.user);
      const token = generateInviteToken(
        ctx.user.id,
        input.program,
        input.activity,
        input.patientEmail
      );
      return token;
    }),

  patientProgramSignup: procedure
    /*  .input(function (input) {
      return input;
    })*/
    // .input(z.object({ inviteToken: z.string() }))
    .input(function (input) {
      return input;
    })
    .query(async ({ input, ctx }) => {
      const decoded = verifyInviteToken(input.inviteToken);
      console.log("SAVE TO DB:", input);

      const patientId = await insertPatient({
        name: input.name,
        ownerId: decoded.owner,
        email: input.email,
        phone: input.phone,
        signupForm: input,
        //...input,

        inviteToken: decoded,
      });

      // Or create a contact with attributes and add to lists
      // brevo.addContact({ email: input.email }).then((r) => console.log(r));

      void brevo.sendTransacEmail(
        3,
        input.email,
        {
          //  mentorName: "Hello!"
        },
        input.name, // "John Doe",
        {
          addContact: true,
        }
      );

      return patientId;
    }),
  /*
    .query(({ input }) => {
      // console.log("patientProgramSignup:", input);
       const decoded = verifyInviteToken(input.inviteToken);
      console.log("SAVE TO DB:", input);
      return "SAVED";
    }),*/

  getActivityInfoFromInviteToken: procedure
    .input(z.object({ inviteToken: z.string() }))
    .query(({ input }) => {
      const decoded = verifyInviteToken(input.inviteToken);
      console.log("SAVE TO DB:", input, decoded);
      const dummy = {
        activityName: "Méditation Guidée",
        activityDescription:
          "Une séance de méditation de 15 minutes pour développer la pleine conscience",
        introImg:
          "https://raw.githubusercontent.com/PushMD/big5chart/main/public/MidiMama.png",
        invite: {
          senderName: "Bob",
          created: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        },
        token: decoded,
      };
      return dummy;
      return "SAVED";
    }),
  getActivityInfoFromInviteToken: procedure
    .input(z.object({ inviteToken: z.string() }))
    .query(async ({ input }) => {
      const decoded = verifyInviteToken(input.inviteToken);
      console.log("SAVE TO DB:", input, decoded);

      const activity = await getActivity({
        ownerId: decoded.owner,
        activityId: decoded.activity,
        patientId: decoded.patientId,
        programId: decoded.program,
      });

      const dummy = {
        activityName: "Méditation Guidée333 yesss dummy",
        activityDescription:
          "Une séance de méditation de 15 minutes pour développer la pleine conscience",
        introImg:
          "https://raw.githubusercontent.com/PushMD/big5chart/main/public/MidiMama.png",
        invite: {
          senderName: "Bob",
          created: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        },
        token: decoded,
        activity,
      };

      return dummy;
      return "SAVED";
    }),
  startActivityInfoFromInviteToken: procedure
    .input(z.object({ inviteToken: z.string() }))
    .query(async ({ input }) => {
      const decoded = verifyInviteToken(input.inviteToken);
      console.log("create activity in db TO DB:", input, decoded);

      const activity = await getActivity({
        ownerId: decoded.owner,
        activityId: decoded.activity,
        patientId: decoded.patientId,
        programId: decoded.program,
      });

      // add activity to DB
      const inserted = await insertConvo({
        activityId: activity.activityId,
        date: new Date(),
        patientId: decoded.patientId,
        programId: decoded.program,
        ownerId: decoded.owner, //supabase ID
        activity: activity, //can be repopulated easily. it's just a static ref of config used.
      });
      return { conversationId: inserted, activityType: activity.type };

      return "Dummy-convo id"; //we'll redirect to that url
    }),

  // client handling

  // CLIENT COACH (OWNER ROUTES)

  /// DUMMY stuff bellow... to be removed
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
