import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { deals, dealTeams, findDeal, readValue, visibleFields } from "../data/fixtures";
import { authorize } from "../foundation/guard";
import { listProposals } from "../foundation/proposals";
import { rows } from "../foundation/store";

export const findDealTool = createTool({
  id: "find-deal",
  description: "Find a deal by its id or name. Returns the deal's id, name and stage.",
  inputSchema: z.object({ query: z.string().describe("Deal id such as D-1001, or its name") }),
  execute: async ({ query }, context) => {
    const auth = await authorize("find-deal", "deal.read", context);
    if (!auth.ok) return auth;
    const deal = findDeal(query);
    if (!deal) return { found: false as const, message: `No deal matches "${query}".` };
    return { found: true as const, id: deal.id, name: deal.name, stage: deal.stage };
  },
});

export const describeDealFieldsTool = createTool({
  id: "describe-deal-fields",
  description:
    "List the Tenant's deal fields the caller can read: key, label, type and options. Use it to map each criterion to a field.",
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const auth = await authorize("describe-deal-fields", "fields.read", context);
    if (!auth.ok) return auth;
    return { fields: visibleFields(auth.actor.role).map(({ key, label, type, options }) => ({ key, label, type, options })) };
  },
});

export const readDealTool = createTool({
  id: "read-deal",
  description:
    "Read a deal's field values as the caller sees them. A null value means the field is empty or the caller cannot read it: report it as Unknown.",
  inputSchema: z.object({ dealId: z.string() }),
  execute: async ({ dealId }, context) => {
    const auth = await authorize("read-deal", "deal.read", context);
    if (!auth.ok) return auth;
    const deal = findDeal(dealId);
    if (!deal) return { found: false as const, message: `No deal ${dealId}.` };
    const values = visibleFields(auth.actor.role).map((f) => ({
      key: f.key,
      label: f.label,
      value: readValue(deal, f.key, auth.actor.role),
      source: `${deal.name} › ${f.label}`,
    }));
    return { found: true as const, id: deal.id, name: deal.name, values };
  },
});

export const readDealTeamTool = createTool({
  id: "read-deal-team",
  description:
    "Read the deal team: each member's role, focus areas and whether they can read the deal. Only members who can read the deal may be assigned.",
  inputSchema: z.object({ dealId: z.string() }),
  execute: async ({ dealId }, context) => {
    const auth = await authorize("read-deal-team", "team.read", context);
    if (!auth.ok) return auth;
    const team = dealTeams[findDeal(dealId)?.id ?? dealId];
    if (!team) return { found: false as const, message: `No deal team for ${dealId}.` };
    return { found: true as const, members: team };
  },
});

export const searchDealsTool = createTool({
  id: "search-deals",
  description:
    "Search the Tenant's deals by name, market, property type or stage. Returns each match's id, name, stage, market and property type. Use it when the DealLead names a deal loosely or asks which deals match.",
  inputSchema: z.object({
    text: z.string().optional().describe("Part of the deal's name"),
    market: z.string().optional(),
    propertyType: z.string().optional(),
    stage: z.string().optional(),
  }),
  execute: async ({ text, market, propertyType, stage }, context) => {
    const auth = await authorize("search-deals", "deal.read", context);
    if (!auth.ok) return auth;
    const role = auth.actor.role;
    const is = (a: unknown, b?: string) => !b || String(a ?? "").toLowerCase() === b.trim().toLowerCase();
    const matches = deals
      .filter((d) => !text || d.name.toLowerCase().includes(text.trim().toLowerCase()))
      .filter((d) => is(d.stage, stage) && is(readValue(d, "market", role), market) && is(readValue(d, "property_type", role), propertyType))
      .map((d) => ({ id: d.id, name: d.name, stage: d.stage, market: readValue(d, "market", role), propertyType: readValue(d, "property_type", role) }));
    return { count: matches.length, deals: matches };
  },
});

export const listDealTasksTool = createTool({
  id: "list-deal-tasks",
  description:
    "List the deal's follow-up work: tasks already created, and task proposals still pending or accepted, from any session. Call it before proposing, so an open item never gets a second task.",
  inputSchema: z.object({ dealId: z.string() }),
  execute: async ({ dealId }, context) => {
    const auth = await authorize("list-deal-tasks", "tasks.read", context);
    if (!auth.ok) return auth;
    const deal = findDeal(dealId);
    if (!deal) return { found: false as const, message: `No deal ${dealId}.` };
    const team = dealTeams[deal.id] ?? [];
    const nameOf = (id: string | null) => (id ? team.find((m) => m.id === id)?.name ?? id : null);
    const workItems = (await rows<{ id: string; title: string; assignee_id: string | null; due_date: string }>(
      `SELECT id, title, assignee_id, due_date FROM poc_work_items WHERE deal_id = ? ORDER BY created_at`, [deal.id],
    )).map((w) => ({ id: w.id, title: w.title, assignee: nameOf(w.assignee_id), dueDate: w.due_date }));
    const proposals = (await listProposals({ dealId: deal.id, tenantId: auth.actor.tenantId }))
      .filter((p) => p.kind === "task" && p.status !== "rejected")
      .map((p) => ({ id: p.id, criterion: p.payload.criterion, title: p.payload.title, status: p.status, assignee: p.payload.assignee?.name ?? null }));
    return { found: true as const, deal: deal.name, workItems, proposals };
  },
});
