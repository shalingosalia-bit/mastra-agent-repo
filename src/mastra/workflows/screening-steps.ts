import type { RequestContext } from "@mastra/core/request-context";
import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { findDeal, visibleFields } from "../data/fixtures";
import { roleFrom } from "../tools/context";
import { checkCriteriaTool } from "../tools/screening-tools";
import { inSession } from "./shared";

// The screening steps of the deal-review workflow (deal screening 05 §Screening
// Flow, steps 2 to 4): the run suspends durably after RESOLVE, and CHECK runs
// only once the DealLead replies. The supervisor's chat path asks for the same
// confirmation in its instructions; here the pause is enforced by the engine, not
// the model. The DealLead writes the request and the reply in their own words.

const operator = z.enum([">=", "<=", ">", "<", "=", "in", "between"]);
const target = z.union([z.number(), z.string(), z.array(z.union([z.number(), z.string()]))]);

const mappedCriterion = z.object({
  criterion: z.string().describe("The criterion in the DealLead's words"),
  fieldKey: z.string().nullable().describe("The Tenant field key, or null when no field fits"),
  fieldLabel: z.string().nullable(),
  operator: operator.nullable(),
  target: target.nullable(),
  question: z.string().nullable().describe("What to ask the DealLead when no field fits, else null"),
});

const resolved = z.object({
  deal: z.string().describe("The deal id or name the DealLead named"),
  criteria: z.array(mappedCriterion),
});

const mapping = z.object({
  dealId: z.string(),
  dealName: z.string(),
  criteria: z.array(mappedCriterion),
});

const confirmedCriterion = z.object({
  criterion: z.string(),
  fieldKey: z.string(),
  test: z.object({ operator, target }),
});

const interpretation = z.object({
  proceed: z.boolean().describe("true if the DealLead wants the criteria checked now, false if they want to stop"),
  corrections: z.array(confirmedCriterion).describe("Criteria the DealLead remapped or newly mapped, by criterion text; empty if none"),
});

function readableFields(rc: RequestContext) {
  return new Map(visibleFields(roleFrom({ requestContext: rc })).map((f) => [f.key, f.label]));
}

function describe(m: z.infer<typeof mapping>) {
  const lines = m.criteria.map((c) =>
    c.fieldKey ? `- ${c.criterion} → ${c.fieldLabel} ${c.operator} ${JSON.stringify(c.target)}` : `- ${c.criterion} → no field. ${c.question}`);
  return `Here's how I read your criteria for ${m.dealName}:\n${lines.join("\n")}\n\n` +
    "Reply to confirm (\"looks good, go ahead\"), correct any of them (\"price means purchase price\"), or stop. Nothing is checked until you reply.";
}

export const resolveCriteria = createStep({
  id: "resolve-criteria",
  description: "The screening specialist reads the DealLead's request and maps each criterion to one of the Tenant's deal fields and a test. Reads no values.",
  inputSchema: z.object({
    request: z.string().describe("Your screening request, e.g. Screen Riverside Flats: multifamily only, cap rate at least 5.5%, asking price under $60M"),
  }),
  outputSchema: mapping,
  execute: async ({ inputData, mastra, requestContext, runId }) => {
    const rc = inSession(requestContext as RequestContext, runId);
    const out = await mastra.getAgent("screeningAgent").generate(
      `RESOLVE. The DealLead's request, word for word:\n"""\n${inputData.request}\n"""\n` +
        "Identify the deal they named and list every criterion they stated, in their words. " +
        "Where no field fits a criterion, set fieldKey, operator and target to null and write the question to ask.",
      { requestContext: rc, structuredOutput: { schema: resolved } },
    );

    const deal = findDeal(out.object.deal);
    if (!deal) throw new Error(`No deal matches "${out.object.deal}". Start a new run naming the deal.`);

    // A field the model names must exist and be readable by this User; anything
    // else becomes a question, never a guess (eval case 1).
    const readable = readableFields(rc);
    const criteria = out.object.criteria.map((m) => {
      const label = m.fieldKey ? readable.get(m.fieldKey) : undefined;
      if (!m.fieldKey || !label || !m.operator || m.target === null) {
        return {
          criterion: m.criterion, fieldKey: null, fieldLabel: null, operator: null, target: null,
          question: m.question ?? `No deal field fits "${m.criterion}". Which field do you mean?`,
        };
      }
      return { ...m, fieldLabel: label, question: null };
    });
    return { dealId: deal.id, dealName: deal.name, criteria };
  },
});

export const confirmMapping = createStep({
  id: "confirm-mapping",
  description: "Shows the mapping and waits for the DealLead's reply. Nothing is checked until they reply.",
  inputSchema: mapping,
  suspendSchema: mapping.extend({ message: z.string() }),
  resumeSchema: z.object({
    reply: z.string().describe("Your reply, e.g. looks good, go ahead / price means purchase price / stop"),
  }),
  outputSchema: z.object({
    dealId: z.string(),
    confirmed: z.array(confirmedCriterion),
    unresolved: z.array(z.string()),
    stopped: z.boolean(),
  }),
  execute: async ({ inputData, resumeData, suspend, mastra, requestContext, runId }) => {
    if (!resumeData) return await suspend({ ...inputData, message: describe(inputData) });

    const rc = inSession(requestContext as RequestContext, runId);
    const out = await mastra.getAgent("screeningAgent").generate(
      `INTERPRET. You showed the DealLead this mapping for ${inputData.dealName}:\n${JSON.stringify(inputData.criteria, null, 2)}\n\n` +
        `They replied, word for word:\n"""\n${resumeData.reply}\n"""\n` +
        "Do they want the criteria checked now, or to stop? List any criterion they remapped or newly mapped, using the criterion text exactly as shown above. " +
        "Call describe-deal-fields if you need a field key. Check nothing in this mode.",
      { requestContext: rc, structuredOutput: { schema: interpretation } },
    );
    if (!out.object.proceed) {
      return { dealId: inputData.dealId, confirmed: [], unresolved: inputData.criteria.map((c) => c.criterion), stopped: true };
    }

    const readable = readableFields(rc);
    const corrections = new Map(out.object.corrections.filter((c) => readable.has(c.fieldKey)).map((c) => [c.criterion, c]));
    const confirmed: z.infer<typeof confirmedCriterion>[] = [];
    const unresolved: string[] = [];
    for (const c of inputData.criteria) {
      const fix = corrections.get(c.criterion);
      if (fix) confirmed.push(fix);
      else if (c.fieldKey && c.operator && c.target !== null) {
        confirmed.push({ criterion: c.criterion, fieldKey: c.fieldKey, test: { operator: c.operator, target: c.target } });
      } else unresolved.push(c.criterion);
    }
    return { dealId: inputData.dealId, confirmed, unresolved, stopped: false };
  },
});

export const verdictRows = z.array(z.object({
  criterion: z.string(),
  field: z.string(),
  value: z.union([z.string(), z.number()]).nullable(),
  verdict: z.enum(["pass", "fail", "unknown"]),
  source: z.string().nullable(),
  note: z.string().optional(),
}));

export const screeningResult = z.object({
  dealId: z.string(),
  deal: z.string(),
  rows: verdictRows,
  unresolved: z.array(z.string()),
  note: z.string(),
});

export const checkCriteria = createStep({
  id: "check-criteria",
  description: "Checks only the confirmed criteria. The tool reads each value and decides the verdict.",
  inputSchema: confirmMapping.outputSchema,
  outputSchema: screeningResult,
  execute: async ({ inputData, requestContext, runId }) => {
    if (inputData.stopped) {
      return { dealId: inputData.dealId, deal: inputData.dealId, rows: [], unresolved: inputData.unresolved, note: "Stopped at your request. Nothing was checked." };
    }
    const note = "This is not a recommendation, and nothing on the deal has changed.";
    if (!inputData.confirmed.length) {
      return { dealId: inputData.dealId, deal: inputData.dealId, rows: [], unresolved: inputData.unresolved, note };
    }
    // Called as the screening specialist, so the guard applies its grants and
    // the session records its version.
    const rc = inSession(requestContext as RequestContext, runId);
    const r: any = await checkCriteriaTool.execute!(
      { dealId: inputData.dealId, criteria: inputData.confirmed },
      { requestContext: rc, agent: { agentId: "screening", threadId: runId } } as any,
    );
    if (r.refused || !r.found) throw new Error(r.message);
    return { dealId: inputData.dealId, deal: r.deal, rows: r.rows, unresolved: inputData.unresolved, note };
  },
});
