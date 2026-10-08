import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { dealTeams, findDeal } from "../data/fixtures";
import { authorize } from "../foundation/guard";
import { listProposals, propose, threeBusinessDaysFrom } from "../foundation/proposals";
import { listSources, type Sourced } from "../foundation/sessions";

export const proposeTaskTool = createTool({
  id: "propose-task",
  description:
    "Propose one follow-up task for one open criterion. Creates a pending proposal, never a task. The DealLead accepts or rejects it.",
  inputSchema: z.object({
    dealId: z.string(),
    criterion: z.string().describe("The failed or unknown criterion this task follows from"),
    title: z.string(),
    assigneeId: z.string().nullable().describe("A deal team member who can read the deal, or null for no one"),
  }),
  execute: async ({ dealId, criterion, title, assigneeId }, context) => {
    const auth = await authorize("propose-task", "propose.task", context);
    if (!auth.ok) return auth;
    const deal = findDeal(dealId);
    if (!deal) return { created: false as const, message: `No deal ${dealId}.` };

    let assignee: { id: string; name: string } | null = null;
    if (assigneeId) {
      const member = dealTeams[deal.id]?.find((m) => m.id === assigneeId);
      // Eval case 9: never assign someone who cannot read the deal.
      if (!member || !member.canReadDeal) {
        return { created: false as const, message: `${assigneeId} cannot read this deal. Pick someone who can, or no one.` };
      }
      assignee = { id: member.id, name: member.name };
    }

    const { proposal, duplicate } = await propose("task", deal.id, `task:${deal.id}:${criterion.trim().toLowerCase()}`, {
      title,
      criterion,
      assignee,
      dueDate: threeBusinessDaysFrom(),
    }, auth);
    return { created: !duplicate, duplicate, proposal: { id: proposal.id, status: proposal.status, ...proposal.payload } };
  },
});

export const listSessionSourcesTool = createTool({
  id: "list-session-sources",
  description:
    "List every value this session has already sourced (screening checks and the comps comparison), each with its exact value and source. These are the only figures a memo may quote.",
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const auth = await authorize("list-session-sources", "session.read", context);
    if (!auth.ok) return auth;
    return { sources: await listSources(auth.sessionId) };
  },
});

// Numbers match whatever their formatting; text matches case-insensitively.
function sameValue(a: string | number, b: string | number): boolean {
  const num = (v: string | number) => (typeof v === "number" ? v : Number(String(v).replace(/[$,%\s]/g, "")));
  const [x, y] = [num(a), num(b)];
  if (!Number.isNaN(x) && !Number.isNaN(y)) return Math.abs(x - y) < 1e-9;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

const sourced = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  source: z.string().describe("The source exactly as list-session-sources gives it"),
});

export const proposeMemoTool = createTool({
  id: "propose-memo",
  description:
    "Propose a decision memo for the DealLead to accept. Every figure must match a value and source from list-session-sources. Creates a pending proposal; nothing is saved or sent for approval.",
  inputSchema: z.object({
    dealId: z.string(),
    title: z.string(),
    decision: z.string().nullable().describe("The DealLead's stated decision, or null if they have not made one"),
    figures: z.array(sourced),
    body: z.string().describe("The memo text in markdown. Quote only the figures listed above."),
  }),
  execute: async ({ dealId, title, decision, figures, body }, context) => {
    const auth = await authorize("propose-memo", "propose.memo", context);
    if (!auth.ok) return auth;
    const deal = findDeal(dealId);
    if (!deal) return { created: false as const, message: `No deal ${dealId}.` };

    // Eval case 12: every figure traces to a value this session sourced.
    const known = await listSources(auth.sessionId);
    const untraced = figures.filter((f: Sourced) => !known.some((k) => k.source === f.source && sameValue(k.value, f.value)));
    if (untraced.length) {
      return {
        created: false as const,
        message: `These figures do not match a value the session sourced: ${untraced.map((f) => `${f.label} (${f.value}, ${f.source})`).join("; ")}. Use list-session-sources and quote values exactly, or remove them.`,
      };
    }

    const openTasks = (await listProposals({ dealId: deal.id, sessionId: auth.sessionId }))
      .filter((p) => p.kind === "task" && p.status !== "rejected")
      .map((p) => ({ id: p.id, title: p.payload.title, status: p.status }));
    const { proposal, duplicate } = await propose("memo", deal.id, `memo:${auth.sessionId}:${title.trim().toLowerCase()}`, {
      title, decision, figures, body, openTasks,
    }, auth);
    return { created: !duplicate, duplicate, proposal: { id: proposal.id, status: proposal.status, title } };
  },
});
