import { registerApiRoute } from "@mastra/core/server";
import { isKilled, setKillSwitch } from "./kill-switch";
import { acceptProposal, decideApproval, dealRecord, DecisionError, listProposals, rejectProposal, type ProposalStatus } from "./proposals";
import { registry } from "./registry";
import { listSessions, sessionRecord } from "./sessions";
import { rows } from "./store";
import { APP_PAGE } from "./app-page";
import { REVIEW_PAGE } from "./review-page";
import { readBuyBox, saveBuyBox } from "./buy-box";
import { listUploads, saveUpload } from "./documents";
import { DEFAULT_TENANT } from "../tools/context";
import { dealpathStatus, finishSignIn, signOut, startSignIn } from "../data/dealpath/client";

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

  // Dealpath: one browser sign-in, then the agents read deals as that User.
  registerApiRoute("/poc/dealpath/status", { method: "GET", handler: async (c) => c.json(await dealpathStatus()) }),

  registerApiRoute("/poc/dealpath/connect", {
    method: "GET",
    handler: async (c) => {
      try {
        const url = await startSignIn();
        return c.redirect(url ? url.toString() : "/poc/app?dealpath=connected");
      } catch (e) {
        return c.html(`<p>Could not start the Dealpath sign-in: ${String(e instanceof Error ? e.message : e).replace(/</g, "&lt;")}</p><p><a href="/poc/app">Back</a></p>`, 502);
      }
    },
  }),

  registerApiRoute("/poc/dealpath/callback", {
    method: "GET",
    handler: async (c) => {
      const code = c.req.query("code");
      const error = c.req.query("error");
      if (!code) return c.html(`<p>Dealpath sign-in did not finish${error ? `: ${error.replace(/</g, "&lt;")}` : ""}.</p><p><a href="/poc/app">Back</a></p>`, 400);
      try {
        await finishSignIn(code);
        return c.redirect("/poc/app?dealpath=connected");
      } catch (e) {
        return c.html(`<p>Dealpath sign-in failed: ${String(e instanceof Error ? e.message : e).replace(/</g, "&lt;")}</p><p><a href="/poc/dealpath/connect">Try again</a></p>`, 502);
      }
    },
  }),

  registerApiRoute("/poc/dealpath/disconnect", {
    method: "POST",
    handler: async (c) => { signOut(); return c.json({ connected: false }); },
  }),

  // The saved buy box. Anyone may read it; only a DealLead changes it.
  registerApiRoute("/poc/buy-box", {
    method: "GET",
    handler: async (c) => c.json(await readBuyBox(c.req.query("tenantId") ?? DEFAULT_TENANT)),
  }),

  registerApiRoute("/poc/buy-box", {
    method: "PUT",
    handler: async (c) => {
      const { criteria } = await body(c);
      if (!Array.isArray(criteria)) return c.json({ error: "criteria must be a list" }, 400);
      try { return c.json(await saveBuyBox(c.req.query("tenantId") ?? DEFAULT_TENANT, userOf(c), criteria)); } catch (e) { return fail(c, e); }
    },
  }),

  // Documents a person uploads for the agents to read: PDFs, as base64 JSON.
  registerApiRoute("/poc/documents", {
    method: "GET",
    handler: async (c) => c.json({ documents: await listUploads(c.req.query("tenantId") ?? DEFAULT_TENANT) }),
  }),

  registerApiRoute("/poc/documents", {
    method: "POST",
    handler: async (c) => {
      const { name, data } = await body(c);
      if (typeof name !== "string" || typeof data !== "string") return c.json({ error: "name and data (base64) are required" }, 400);
      try { return c.json(await saveUpload(c.req.query("tenantId") ?? DEFAULT_TENANT, userOf(c), name, data)); } catch (e) { return fail(c, e); }
    },
  }),
];
