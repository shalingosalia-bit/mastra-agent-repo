import { randomUUID } from "node:crypto";
import { RequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { MCPServer } from "@mastra/mcp";
import { z } from "zod";
import { dealReviewSupervisor } from "../agents/supervisor";
import { findUser } from "../data/fixtures";
import { dealpathStatus } from "../data/dealpath/client";
import { readBuyBox } from "../foundation/buy-box";
import { listProposals } from "../foundation/proposals";
import { DEFAULT_TENANT } from "../tools/context";

// The headless surface (card #23): Claude talks to the deal review supervisor
// through these tools, and the conversation lives in Claude. Nothing here
// accepts, rejects, resumes or submits: a proposal is the DealLead's act
// (agentic FR51). Where they accept is card #24; until it is decided, every
// answer links the sandbox's review panel.
//
// The server has no sign-in of its own, so it runs on localhost only and acts
// as one sandbox User, set by POC_MCP_USER_ID (default U-1, Dana Kim).

const APP_ORIGIN = process.env.POC_APP_ORIGIN ?? "http://localhost:4111";
const REVIEW_URL = `${APP_ORIGIN}/poc/review`;

function actingUser() {
  const id = process.env.POC_MCP_USER_ID ?? "U-1";
  const user = findUser(id);
  const role = user?.role === "Analyst" ? "Analyst" : "DealLead";
  return { id, name: user?.name ?? id, role };
}

async function pending(tenantId: string) {
  return (await listProposals({ status: "pending", tenantId })).map((p) => ({
    id: p.id,
    kind: p.kind,
    dealId: p.dealId,
    title: p.payload.title ?? p.payload.criterion ?? p.kind,
  }));
}

const dealReviewTool = createTool({
  id: "deal_review",
  description:
    "Talk to Dealpath's deal review agent: screen a deal against stated criteria or the saved buy box, confirm or correct the field mapping, chase open criteria, compare with comps, or draft a decision memo. " +
    "Pass the DealLead's words as message, unchanged. For every later turn of the same review, pass the conversationId this tool returned, or the agent loses the mapping it is waiting on. " +
    "Show the reply's tables as they are. The agent only proposes: never tell the DealLead something was accepted or changed. If the reply lists proposals waiting, give the DealLead the review link to accept or reject them there.",
  inputSchema: z.object({
    message: z.string().min(1).describe("The DealLead's request or reply, word for word"),
    conversationId: z.string().optional().describe("The conversationId from this review's previous turn; omit to start a new review"),
  }),
  execute: async ({ message, conversationId }) => {
    const user = actingUser();
    const thread = conversationId ?? randomUUID();
    const requestContext = new RequestContext();
    requestContext.set("userId", user.id);
    requestContext.set("userRole", user.role);
    requestContext.set("tenantId", DEFAULT_TENANT);
    try {
      const out = await dealReviewSupervisor.generate(message, {
        memory: { thread, resource: user.id },
        requestContext,
      });
      const waiting = await pending(DEFAULT_TENANT);
      return {
        conversationId: thread,
        actingAs: `${user.name} (${user.role})`,
        reply: out.text || "(No reply text.)",
        proposalsWaiting: waiting.length,
        ...(waiting.length ? { reviewUrl: REVIEW_URL, note: "Accept or reject these in the review panel. Where the DealLead accepts in the POC is still open (card #24)." } : {}),
      };
    } catch (err) {
      return { conversationId: thread, error: err instanceof Error ? err.message : String(err) };
    }
  },
});

const buyBoxTool = createTool({
  id: "get_buy_box",
  description: "Read the Tenant's saved buy box: each criterion in the DealLead's words, and whether it is a must-have. Read only.",
  inputSchema: z.object({}),
  execute: async () => {
    const box = await readBuyBox(DEFAULT_TENANT);
    return { criteria: box.criteria, savedBy: box.updatedBy, savedAt: box.updatedAt };
  },
});

const pendingTool = createTool({
  id: "list_pending_proposals",
  description: "List the proposals waiting for the DealLead: field values, tasks, notes and memos. Read only; they are accepted or rejected in the review panel.",
  inputSchema: z.object({}),
  execute: async () => ({ proposals: await pending(DEFAULT_TENANT), reviewUrl: REVIEW_URL }),
});

const dealpathTool = createTool({
  id: "dealpath_connection",
  description: "Say whether the agent can read deals from Dealpath, and where to connect it if not. Read only.",
  inputSchema: z.object({}),
  execute: async () => {
    const status = await dealpathStatus();
    return status.connected ? status : { ...status, connectUrl: `${APP_ORIGIN}/poc/dealpath/connect` };
  },
});

export const dealReviewMcpServer = new MCPServer({
  id: "deal-review",
  name: "Dealpath deal review (POC sandbox)",
  version: "0.1.0",
  description: "Headless deal screening for the agentic foundation POC: screen against the buy box, chase open criteria, compare with comps and draft a memo. Every change is a proposal the DealLead accepts.",
  instructions:
    "Use deal_review for everything the DealLead asks about a deal, passing their words unchanged and the conversationId for follow-ups. " +
    "The agent confirms its reading of the criteria before it checks anything: show the mapping and wait for the DealLead's reply. " +
    "Never accept, reject or submit on the DealLead's behalf; this server has no tool for it.",
  tools: { deal_review: dealReviewTool, get_buy_box: buyBoxTool, list_pending_proposals: pendingTool, dealpath_connection: dealpathTool },
});
