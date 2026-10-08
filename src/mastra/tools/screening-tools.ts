import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { dealFields, findDeal, readValue, visibleFields } from "../data/fixtures";
import { authorize } from "../foundation/guard";
import { recordSources } from "../foundation/sessions";

// The agent maps each criterion to a field and a test. This tool reads the value
// and decides the verdict, so the model can neither invent a value nor misjudge
// a comparison (eval cases 2 and 3).

const test = z.object({
  operator: z.enum([">=", "<=", ">", "<", "=", "in", "between"]),
  target: z.union([z.number(), z.string(), z.array(z.union([z.number(), z.string()]))])
    .describe("A number or option for >=, <=, >, <, =; a list for 'in'; [low, high] for 'between'"),
});

const criterionInput = z.object({
  criterion: z.string().describe("The criterion as the DealLead stated it"),
  fieldKey: z.string().describe("The Tenant field key it maps to, from describe-deal-fields"),
  test,
});

type Test = z.infer<typeof test>;

function judge(value: string | number, { operator, target }: Test): "pass" | "fail" {
  const eq = (a: unknown, b: unknown) => String(a).toLowerCase() === String(b).toLowerCase();
  switch (operator) {
    case "=": return eq(value, target) ? "pass" : "fail";
    case "in": return (Array.isArray(target) ? target : [target]).some((t) => eq(value, t)) ? "pass" : "fail";
    case "between": {
      const [lo, hi] = (Array.isArray(target) ? target : []).map(Number);
      return Number(value) >= lo && Number(value) <= hi ? "pass" : "fail";
    }
    case ">=": return Number(value) >= Number(target) ? "pass" : "fail";
    case "<=": return Number(value) <= Number(target) ? "pass" : "fail";
    case ">": return Number(value) > Number(target) ? "pass" : "fail";
    case "<": return Number(value) < Number(target) ? "pass" : "fail";
  }
}

export const checkCriteriaTool = createTool({
  id: "check-criteria",
  description:
    "Check confirmed criteria against a deal. Give each criterion's field and test; the tool reads each value and returns pass, fail or unknown with its source. Call only after the DealLead has confirmed the mapping.",
  inputSchema: z.object({ dealId: z.string(), criteria: z.array(criterionInput).min(1) }),
  execute: async ({ dealId, criteria }, context) => {
    const auth = await authorize("check-criteria", "fields.read", context);
    if (!auth.ok) return auth;
    const role = auth.actor.role;
    const deal = findDeal(dealId);
    if (!deal) return { found: false as const, message: `No deal ${dealId}.` };
    const readable = new Set(visibleFields(role).map((f) => f.key));

    const rows = criteria.map(({ criterion, fieldKey, test }) => {
      const def = dealFields.find((f) => f.key === fieldKey);
      if (!def) {
        return { criterion, field: fieldKey, value: null, verdict: "unknown" as const, source: null, note: "No such field. Ask the DealLead which field this criterion means." };
      }
      // A field the caller cannot read answers exactly as an empty one does.
      const value = readable.has(fieldKey) ? readValue(deal, fieldKey, role) : null;
      if (value === null) {
        return { criterion, field: def.label, value: null, verdict: "unknown" as const, source: null, note: "No value on the deal" };
      }
      return { criterion, field: def.label, value, verdict: judge(value, test), source: `${deal.name} › ${def.label}` };
    });

    // Each value read becomes a sourced value the memo may quote (eval case 12).
    await recordSources(auth.sessionId, rows.flatMap((r) =>
      r.value === null || r.source === null ? [] : [{ label: r.field, value: r.value, source: r.source }]));

    return { found: true as const, deal: deal.name, rows };
  },
});
