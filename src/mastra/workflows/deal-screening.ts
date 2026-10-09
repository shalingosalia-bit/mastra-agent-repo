import type { RequestContext } from "@mastra/core/request-context";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { findDeal, visibleFields } from "../data/fixtures";
import { roleFrom } from "../tools/context";
import { checkCriteriaTool } from "../tools/screening-tools";

// Screening as a workflow (deal screening 05 §Screening Flow, step 4): the run
// suspends durably after RESOLVE, and CHECK runs only on a mapping the DealLead
// resumed with. The supervisor's chat path asks for the same confirmation in
// its instructions; here the pause is enforced by the engine, not the model.

const operator = z.enum([">=", "<=", ">", "<", "=", "in", "between"]);
const target = z.union([z.number(), z.string(), z.array(z.union([z.number(), z.string()]))]);

const mappedCriterion = z.object({
  criterion: z.string(),
  fieldKey: z.string().nullable().describe("The Tenant field key, or null when no field fits"),
  fieldLabel: z.string().nullable(),
  operator: operator.nullable(),
  target: target.nullable(),
  question: z.string().nullable().describe("What to ask the DealLead when no field fits, else null"),
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

// The run's session is the workflow run, so its tool calls and sourced values
// land on /poc/sessions/<runId>, as a supervisor thread's do.
function inSession(rc: RequestContext, runId: string) {
  if (typeof rc.get("sessionId") !== "string") rc.set("sessionId", runId);
  return rc;
}

const resolveCriteria = createStep({
  id: "resolve-criteria",
  description: "The screening specialist maps each criterion to one of the Tenant's deal fields and a test. Reads no values.",
  inputSchema: z.object({
    deal: z.string().describe("Deal id or name, e.g. Riverside Flats"),
    criteria: z.array(z.string()).min(1).describe("Each criterion as the DealLead states it"),
  }),
  outputSchema: mapping,
  execute: async ({ inputData, mastra, requestContext, runId }) => {
    const deal = findDeal(inputData.deal);
    if (!deal) throw new Error(`No deal matches "${inputData.deal}".`);

    const rc = inSession(requestContext as RequestContext, runId);
    const out = await mastra.getAgent("screeningAgent").generate(
      `RESOLVE. Deal: ${deal.name} (${deal.id}). Criteria, word for word:\n${inputData.criteria.map((c) => `- ${c}`).join("\n")}\n` +
        "Return every criterion. Where no field fits, set fieldKey, operator and target to null and write the question to ask.",
      { requestContext: rc, structuredOutput: { schema: mapping } },
    );

    // A field the model names must exist and be readable by this User; anything
    // else becomes a question, never a guess (eval case 1).
    const readable = new Map(visibleFields(roleFrom({ requestContext: rc })).map((f) => [f.key, f.label]));
    const criteria = inputData.criteria.map((criterion) => {
      const m = out.object.criteria.find((c) => c.criterion === criterion);
      const label = m?.fieldKey ? readable.get(m.fieldKey) : undefined;
      if (!m || !m.fieldKey || !label || !m.operator || m.target === null) {
        return {
          criterion, fieldKey: null, fieldLabel: null, operator: null, target: null,
          question: m?.question ?? `No deal field fits "${criterion}". Which field do you mean?`,
        };
      }
      return { ...m, fieldLabel: label, question: null };
    });
    return { dealId: deal.id, dealName: deal.name, criteria };
  },
});

const confirmMapping = createStep({
  id: "confirm-mapping",
  description: "Waits for the DealLead to confirm or correct the mapping. Nothing is checked until they resume.",
  inputSchema: mapping,
  suspendSchema: mapping,
  resumeSchema: z.object({
    confirmed: z.boolean().describe("true to check the mapping (with any corrections), false to stop"),
    corrections: z.array(confirmedCriterion).optional()
      .describe("Criteria to remap, or to map where no field fit, matched by criterion text"),
  }),
  outputSchema: z.object({
    dealId: z.string(),
    confirmed: z.array(confirmedCriterion),
    unresolved: z.array(z.string()),
  }),
  execute: async ({ inputData, resumeData, suspend, bail }) => {
    if (!resumeData) return await suspend(inputData);
    if (!resumeData.confirmed) {
      return bail({ dealId: inputData.dealId, confirmed: [], unresolved: inputData.criteria.map((c) => c.criterion) });
    }

    const corrections = new Map((resumeData.corrections ?? []).map((c) => [c.criterion, c]));
    const confirmed: z.infer<typeof confirmedCriterion>[] = [];
    const unresolved: string[] = [];
    for (const c of inputData.criteria) {
      const fix = corrections.get(c.criterion);
      if (fix) confirmed.push(fix);
      else if (c.fieldKey && c.operator && c.target !== null) {
        confirmed.push({ criterion: c.criterion, fieldKey: c.fieldKey, test: { operator: c.operator, target: c.target } });
      } else unresolved.push(c.criterion);
    }
    return { dealId: inputData.dealId, confirmed, unresolved };
  },
});

const checkCriteria = createStep({
  id: "check-criteria",
  description: "Checks only the confirmed criteria. The tool reads each value and decides the verdict.",
  inputSchema: confirmMapping.outputSchema,
  outputSchema: z.object({
    deal: z.string(),
    rows: z.array(z.object({
      criterion: z.string(),
      field: z.string(),
      value: z.union([z.string(), z.number()]).nullable(),
      verdict: z.enum(["pass", "fail", "unknown"]),
      source: z.string().nullable(),
      note: z.string().optional(),
    })),
    unresolved: z.array(z.string()),
    note: z.string(),
  }),
  execute: async ({ inputData, requestContext, runId }) => {
    const note = "This is not a recommendation, and nothing on the deal has changed.";
    if (!inputData.confirmed.length) {
      return { deal: inputData.dealId, rows: [], unresolved: inputData.unresolved, note };
    }
    // Called as the screening specialist, so the guard applies its grants and
    // the session records its version.
    const rc = inSession(requestContext as RequestContext, runId);
    const r: any = await checkCriteriaTool.execute!(
      { dealId: inputData.dealId, criteria: inputData.confirmed },
      { requestContext: rc, agent: { agentId: "screening", threadId: runId } } as any,
    );
    if (r.refused) throw new Error(r.message);
    if (!r.found) throw new Error(r.message);
    return { deal: r.deal, rows: r.rows, unresolved: inputData.unresolved, note };
  },
});

export const dealScreeningWorkflow = createWorkflow({
  id: "deal-screening",
  description: "Screen one deal against the DealLead's criteria: map them to fields, wait for the DealLead to confirm, then check.",
  inputSchema: resolveCriteria.inputSchema,
  outputSchema: checkCriteria.outputSchema,
})
  .then(resolveCriteria)
  .then(confirmMapping)
  .then(checkCriteria)
  .commit();
