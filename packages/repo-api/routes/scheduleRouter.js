import { router } from "../lib/trpc/trpc.js";
import { protectedProcedure } from "../lib/trpc/procedures.js";
import { createScheduleProcedures } from "../lib/schedule/trpcProcedures.js";

/**
 * Schedule router for tRPC
 * Provides all scheduling functionality through tRPC procedures
 */
export const scheduleRouter = router(
  createScheduleProcedures(
    { router }, // Pass the router creator
    protectedProcedure // Pass the protected procedure
  )
);