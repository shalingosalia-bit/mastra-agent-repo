import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { dealTeams, findDeal, readValue, visibleFields } from "../data/fixtures";
import { authorize } from "../foundation/guard";

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
