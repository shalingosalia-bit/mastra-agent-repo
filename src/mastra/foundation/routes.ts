import { registerApiRoute } from "@mastra/core/server";
import { isKilled, setKillSwitch } from "./kill-switch";
import { acceptProposal, decideApproval, dealRecord, DecisionError, listProposals, rejectProposal, type ProposalStatus } from "./proposals";
import { registry } from "./registry";
import { listSessions, sessionRecord } from "./sessions";
import { rows } from "./store";
import { APP_PAGE } from "./app-page";
import { REVIEW_PAGE } from "./review-page";

// The people's side of the foundation: the DealLead accepts or rejects
// proposals, Flow's approvers decide on memos, and an admin engages the kill
// switch. No agent can reach these. In the sandbox the acting person comes from
// the x-user-id header; in Neuro it is the signed-in User.

type C = { req: { header(name: string): string | undefined; json(): Promise<any> }; json(body: unknown, status?: any): Response };

const userOf = (c: C) => c.req.header("x-user-id") ?? "U-1";

async function body(c: C): Promise<Record<string, any>> {
  try { return await c.req.json(); } catch { return {}; }
}

function fail(c: C, err: unknown) {
  if (err instanceof DecisionError) return c.json({ error: err.message }, err.status);
  throw err;
}

export const pocRoutes = [
  registerApiRoute("/poc/app", { method: "GET", handler: async (c) => c.html(APP_PAGE) }),

  registerApiRoute("/poc/review", { method: "GET", handler: async (c) => c.html(REVIEW_PAGE) }),

  registerApiRoute("/poc/agents", { method: "GET", handler: async (c) => c.json({ agents: Object.values(registry) }) }),

  registerApiRoute("/poc/proposals", {
    method: "GET",
    handler: async (c) => c.json({
      proposals: await listProposals({
        dealId: c.req.query("dealId"),
        sessionId: c.req.query("sessionId"),
        status: c.req.query("status") as ProposalStatus | undefined,
      }),
    }),
  }),

  registerApiRoute("/poc/proposals/:id/accept", {
    method: "POST",
    handler: async (c) => {
      try { return c.json(await acceptProposal(c.req.param("id"), userOf(c))); } catch (e) { return fail(c, e); }
    },
  }),

  registerApiRoute("/poc/proposals/:id/reject", {
    method: "POST",
    handler: async (c) => {
      const { reason } = await body(c);
      try { return c.json(await rejectProposal(c.req.param("id"), userOf(c), reason)); } catch (e) { return fail(c, e); }
    },
  }),

  registerApiRoute("/poc/approvals", {
    method: "GET",
    handler: async (c) => {
      const approverId = c.req.query("approverId");
      const approvals = approverId
        ? await rows(`SELECT * FROM poc_approvals WHERE approver_id = ? ORDER BY submitted_at DESC`, [approverId])
        : await rows(`SELECT * FROM poc_approvals ORDER BY submitted_at DESC`);
      return c.json({ approvals });
    },
  }),

  registerApiRoute("/poc/approvals/:id/decide", {
    method: "POST",
    handler: async (c) => {
      const { decision, comment } = await body(c);
      if (decision !== "approved" && decision !== "rejected") return c.json({ error: "decision must be approved or rejected" }, 400);
      try { return c.json(await decideApproval(c.req.param("id"), userOf(c), decision, comment)); } catch (e) { return fail(c, e); }
    },
  }),

  registerApiRoute("/poc/sessions", { method: "GET", handler: async (c) => c.json({ sessions: await listSessions(c.req.query("tenantId")) }) }),

  registerApiRoute("/poc/sessions/:id", {
    method: "GET",
    handler: async (c) => {
      const record = await sessionRecord(c.req.param("id"));
      return record ? c.json(record) : c.json({ error: "No such session" }, 404);
    },
  }),

  registerApiRoute("/poc/deals/:id/record", { method: "GET", handler: async (c) => c.json(await dealRecord(c.req.param("id"))) }),

  registerApiRoute("/poc/tenants/:id/kill-switch", {
    method: "GET",
    handler: async (c) => c.json({ tenantId: c.req.param("id"), engaged: await isKilled(c.req.param("id")) }),
  }),

  registerApiRoute("/poc/tenants/:id/kill-switch", {
    method: "POST",
    handler: async (c) => {
      const { engaged } = await body(c);
      if (typeof engaged !== "boolean") return c.json({ error: "engaged must be true or false" }, 400);
      const result = await setKillSwitch(c.req.param("id"), engaged, userOf(c));
      return c.json({ tenantId: c.req.param("id"), engaged, ...result });
    },
  }),
];
