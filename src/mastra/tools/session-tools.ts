import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { BOUNDS } from "../foundation/bounds";
import { authorize } from "../foundation/guard";
import { isKilled } from "../foundation/kill-switch";
import { listProposals } from "../foundation/proposals";
import { listSources, sessionRecord } from "../foundation/sessions";

// The supervisor's view of its own session, so it can tell the DealLead where
// the review stands without re-running a specialist.
export const sessionStatusTool = createTool({
  id: "session-status",
  description:
    "Where this deal review stands: which specialists ran, how many values were sourced, every proposal with its status, the cost so far against the bound, and whether the kill switch is engaged. Reads only.",
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const auth = await authorize("session-status", "session.read", context);
    if (!auth.ok) return auth;
    const [record, proposals, sources, killed] = await Promise.all([
      sessionRecord(auth.sessionId),
      listProposals({ sessionId: auth.sessionId }),
      listSources(auth.sessionId),
      isKilled(auth.actor.tenantId),
    ]);
    const activities = record?.activities ?? [];
    const ran = [...new Set(activities.filter((a: any) => a.kind === "delegation.start").map((a: any) => a.actor_id))];
    const byStatus = (status: string) => proposals.filter((p) => p.status === status)
      .map((p) => ({ id: p.id, kind: p.kind, title: p.payload.title ?? p.payload.note ?? null }));
    return {
      specialistsRun: ran,
      runs: activities.filter((a: any) => a.kind === "run.end").length,
      sourcedValues: sources.length,
      proposals: { pending: byStatus("pending"), accepted: byStatus("accepted"), rejected: byStatus("rejected") },
      costUsd: Number(record?.session.cost_usd ?? 0),
      costBoundPerRunUsd: BOUNDS.costUsd,
      killSwitchEngaged: killed,
    };
  },
});
