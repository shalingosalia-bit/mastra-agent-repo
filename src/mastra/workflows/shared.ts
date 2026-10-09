import type { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";
import { listProposals } from "../foundation/proposals";
import { compareToCompsTool } from "../tools/comparison-tools";

// What the workflows share: a run is its own session, so its tool calls and
// sourced values land on /poc/sessions/<runId>, as a supervisor thread's do,
// and a memo drafted in the run can quote what the run sourced.

export function inSession(rc: RequestContext, runId: string) {
  if (typeof rc.get("sessionId") !== "string") rc.set("sessionId", runId);
  return rc;
}

export const REVIEW_PANEL = "Accept or reject each proposal in the review panel at /poc/review. Nothing is created until you do.";

export const taskProposal = z.object({
  id: z.string(),
  criterion: z.string(),
  title: z.string(),
  assignee: z.string().nullable(),
  dueDate: z.string(),
  status: z.string(),
});

export async function taskProposals(sessionId: string): Promise<z.infer<typeof taskProposal>[]> {
  return (await listProposals({ sessionId }))
    .filter((p) => p.kind === "task")
    .map((p) => ({
      id: p.id, criterion: p.payload.criterion, title: p.payload.title,
      assignee: p.payload.assignee?.name ?? null, dueDate: p.payload.dueDate, status: p.status,
    }));
}

export const comparisonResult = z.object({
  deal: z.string(),
  compsSource: z.string(),
  compsUsed: z.array(z.object({ id: z.string(), name: z.string(), saleDate: z.string() })),
  rows: z.array(z.object({
    metric: z.string(),
    dealValue: z.union([z.number(), z.string()]).nullable(),
    compared: z.boolean(),
    low: z.number().optional(),
    median: z.number().optional(),
    high: z.number().optional(),
    flag: z.string().nullable().optional(),
    compCount: z.number().optional(),
    reason: z.string().optional(),
  })),
});

// Called as the comparison specialist, so the guard applies its grants and the
// session records its version. The tool does the arithmetic and the flags.
export async function compare(dealId: string, rc: RequestContext, runId: string): Promise<z.infer<typeof comparisonResult>> {
  const r: any = await compareToCompsTool.execute!(
    { dealId },
    { requestContext: inSession(rc, runId), agent: { agentId: "comparison", threadId: runId } } as any,
  );
  if (r.refused || !r.found) throw new Error(r.message);
  return { deal: r.deal, compsSource: r.compsSource, compsUsed: r.compsUsed, rows: r.rows };
}
