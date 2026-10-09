import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { comparisonAgent } from "./agents/comparison";
import { memoAgent } from "./agents/memo";
import { screeningAgent } from "./agents/screening";
import { dealReviewSupervisor } from "./agents/supervisor";
import { taskAgent } from "./agents/task";
import { pocRoutes } from "./foundation/routes";
import { dealReviewWorkflow } from "./workflows/deal-review";

export const mastra = new Mastra({
  agents: { dealReviewSupervisor, screeningAgent, comparisonAgent, taskAgent, memoAgent },
  workflows: { dealReviewWorkflow },
  // One database for Mastra's threads and memory and the POC's records. A local
  // file by default; a hosted LibSQL (Turso) URL and token keep both across deploys.
  storage: new LibSQLStore({
    id: "deal-review",
    url: process.env.MASTRA_DB_URL ?? "file:./mastra.db",
    authToken: process.env.MASTRA_DB_AUTH_TOKEN || undefined,
  }),
  server: { apiRoutes: pocRoutes },
});
