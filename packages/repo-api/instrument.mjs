import dotenv from "dotenv";
dotenv.config();

import * as Sentry from "@sentry/node"; //` if you are using ESM
//const Sentry = require("@sentry/node");
// const { nodeProfilingIntegration } = require("@sentry/profiling-node");
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const dns = process.env.SENTRY_DNS;
if (dns && !process.env.DISABLE_SENTRY) {
  Sentry.init({
    dsn: dns,
    integrations: [nodeProfilingIntegration()],
    // Tracing
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    environment: process.env.NODE_ENV || "no local NODE_ENV 😵‍💫",
  });
  // Manually call startProfiler and stopProfiler
  // to profile the code in between
  Sentry.profiler.startProfiler();

  // Starts a transaction that will also be profiled
  Sentry.startSpan(
    {
      name: "My First Transaction",
    },
    () => {
      // the code executing inside the transaction will be wrapped in a span and profiled
    }
  );

  // Calls to stopProfiling are optional - if you don't stop the profiler, it will keep profiling
  // your application until the process exits or stopProfiling is called.
  Sentry.profiler.stopProfiler();
}
