import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { comparisonAgent } from "./agents/comparison";
import { memoAgent } from "./agents/memo";
import { screeningAgent } from "./agents/screening";
import { dealReviewSupervisor } from "./agents/supervisor";
import { taskAgent } from "./agents/task";
import { pocRoutes } from "./foundation/routes";
import { dealReviewWorkflow } from "./workflows/deal-review";
import { dealReviewMcpServer } from "./mcp/deal-review-server";

export const mastra = new Mastra({
  agents: { dealReviewSupervisor, screeningAgent, comparisonAgent, taskAgent, memoAgent },
  workflows: { dealReviewWorkflow },
  // The headless surface: Claude connects to /api/mcp/deal-review/mcp (card #23).
  mcpServers: { dealReview: dealReviewMcpServer },
  // One database for Mastra's threads and memory and the POC's records. A local
  // file by default; a hosted LibSQL (Turso) URL and token keep both across deploys.
  storage: new LibSQLStore({
    id: "deal-review",
    url: process.env.MASTRA_DB_URL ?? "file:./mastra.db",
    authToken: process.env.MASTRA_DB_AUTH_TOKEN || undefined,
  }),
  // An uploaded OM arrives as base64 JSON, up to 20 MB of PDF.
  server: { apiRoutes: pocRoutes, bodySizeLimit: 30 * 1024 * 1024 },
});
