import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { canSee, coerceValue, dealFields, dealTeams, findDeal, readValue } from "../data/fixtures";
import { authorize } from "../foundation/guard";
import { listProposals, propose, threeBusinessDaysFrom } from "../foundation/proposals";
import { listSources, type Sourced } from "../foundation/sessions";
import { one } from "../foundation/store";

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

export const listSessionProposalsTool = createTool({
  id: "list-session-proposals",
  description:
    "List every proposal made in this session (tasks, field values, task changes, notes and memos) with its id, status and what it proposes. Use it to report the open items as they stand.",
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const auth = await authorize("list-session-proposals", "session.read", context);
    if (!auth.ok) return auth;
    const proposals = (await listProposals({ sessionId: auth.sessionId })).map((p) => ({
      id: p.id, kind: p.kind, status: p.status, dealId: p.dealId,
      summary: p.payload.title ?? p.payload.note ?? (p.payload.fieldKey ? `${p.payload.fieldKey} → ${p.payload.value}` : p.payload.workItemId),
      criterion: p.payload.criterion ?? null,
    }));
    return { proposals };
  },
});

// ---- Writes. Each is a proposal the DealLead accepts in the review panel;
// none changes anything on its own (05 §Authority and Proposals). ----

export const proposeFieldValueTool = createTool({
  id: "propose-field-value",
  description:
    "Propose setting one of the deal's fields to a value someone stated, e.g. the asking price a broker gave. Creates a pending proposal with the field's current value and the value's source; the DealLead accepts or rejects it. Never for stage, status or owner.",
  inputSchema: z.object({
    dealId: z.string(),
    fieldKey: z.string().describe("A field key from describe-deal-fields"),
    value: z.union([z.string(), z.number()]),
    source: z.string().describe("Who stated the value and where, e.g. 'The DealLead, from the broker's call on 9 Oct'. Never your own estimate."),
  }),
  execute: async ({ dealId, fieldKey, value, source }, context) => {
    const auth = await authorize("propose-field-value", "propose.field", context);
    if (!auth.ok) return auth;
    const deal = findDeal(dealId);
    if (!deal) return { created: false as const, message: `No deal ${dealId}.` };
    const field = dealFields.find((f) => f.key === fieldKey);
    // A field the caller cannot read answers as if it did not exist.
    if (!field || !canSee(field, auth.actor.role)) {
      return { created: false as const, message: `${fieldKey} is not a deal field you can set. Use describe-deal-fields.` };
    }
    const coerced = coerceValue(field, value);
    if (!coerced.ok) return { created: false as const, message: coerced.message };
    const previous = readValue(deal, fieldKey, auth.actor.role);
    if (previous !== null && String(previous) === String(coerced.value)) {
      return { created: false as const, message: `${field.label} is already ${previous}.` };
    }

    const { proposal, duplicate } = await propose("field_value", deal.id, `field:${deal.id}:${fieldKey}:${coerced.value}`, {
      title: `Set ${field.label} to ${coerced.value}`, fieldKey, fieldLabel: field.label, value: coerced.value, previous, source,
    }, auth);
    return { created: !duplicate, duplicate, proposal: { id: proposal.id, status: proposal.status, ...proposal.payload } };
  },
});

export const proposeTaskChangeTool = createTool({
  id: "propose-task-change",
  description:
    "Propose reassigning an existing task on the deal or moving its due date. Takes a task id from list-deal-tasks. Creates a pending proposal; the DealLead accepts or rejects it.",
  inputSchema: z.object({
    dealId: z.string(),
    workItemId: z.string().describe("The task's id, from list-deal-tasks' workItems"),
    assigneeId: z.string().nullable().optional().describe("The new assignee, a deal team member who can read the deal; null to unassign; omit to keep"),
    dueDate: z.string().optional().describe("The new due date, YYYY-MM-DD; omit to keep"),
    reason: z.string(),
  }),
  execute: async ({ dealId, workItemId, assigneeId, dueDate, reason }, context) => {
    const auth = await authorize("propose-task-change", "propose.task", context);
    if (!auth.ok) return auth;
    const deal = findDeal(dealId);
    if (!deal) return { created: false as const, message: `No deal ${dealId}.` };
    const item = await one<{ id: string; title: string }>(`SELECT id, title FROM poc_work_items WHERE id = ? AND deal_id = ?`, [workItemId, deal.id]);
    if (!item) return { created: false as const, message: `No task ${workItemId} on ${deal.name}. Use list-deal-tasks.` };
    if (assigneeId === undefined && !dueDate) return { created: false as const, message: "Nothing to change: give a new assignee or due date." };

    let assignee: { id: string; name: string } | null | undefined;
    if (assigneeId) {
      const member = dealTeams[deal.id]?.find((m) => m.id === assigneeId);
      if (!member || !member.canReadDeal) {
        return { created: false as const, message: `${assigneeId} cannot read this deal. Pick someone who can, or no one.` };
      }
      assignee = { id: member.id, name: member.name };
    } else if (assigneeId === null) assignee = null;
    if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate < new Date().toISOString().slice(0, 10))) {
      return { created: false as const, message: `Due date ${dueDate} must be YYYY-MM-DD and not in the past.` };
    }

    const { proposal, duplicate } = await propose("task_change", deal.id,
      `task-change:${workItemId}:${assignee === undefined ? "-" : assignee?.id ?? "none"}:${dueDate ?? "-"}`,
      { title: `Change "${item.title}"`, workItemId, assignee, dueDate, reason }, auth);
    return { created: !duplicate, duplicate, proposal: { id: proposal.id, status: proposal.status, ...proposal.payload } };
  },
});

export const proposeDealNoteTool = createTool({
  id: "propose-deal-note",
  description:
    "Propose adding a note to the deal's record, e.g. what a broker said on a call. Creates a pending proposal; the note is recorded only when the DealLead accepts it.",
  inputSchema: z.object({
    dealId: z.string(),
    note: z.string().min(1).max(2000).describe("The note, in the DealLead's words where they gave them"),
  }),
  execute: async ({ dealId, note }, context) => {
    const auth = await authorize("propose-deal-note", "propose.note", context);
    if (!auth.ok) return auth;
    const deal = findDeal(dealId);
    if (!deal) return { created: false as const, message: `No deal ${dealId}.` };
    const { proposal, duplicate } = await propose("note", deal.id, `note:${deal.id}:${note.trim().toLowerCase()}`, {
      title: "Add a note", note: note.trim(),
    }, auth);
    return { created: !duplicate, duplicate, proposal: { id: proposal.id, status: proposal.status, note: note.trim() } };
  },
});
