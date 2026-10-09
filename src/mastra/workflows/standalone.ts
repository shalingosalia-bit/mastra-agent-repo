import type { RequestContext } from "@mastra/core/request-context";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { findDeal } from "../data/fixtures";
import { compare, comparisonResult, inSession, REVIEW_PANEL, taskProposal, taskProposals } from "./shared";

// One specialist each, for running a step on its own. A memo has none: it may
// quote only what its own run sourced, so it is drafted at the end of
// deal-review.

const compareStep = createStep({
  id: "compare-comps",
  description: "Places the deal's price, cap rate and price per unit against the Tenant's comps in its market and property type. Needs at least three comps.",
  inputSchema: z.object({ deal: z.string().describe("The deal's name or id, e.g. Riverside Flats") }),
  outputSchema: comparisonResult.extend({ note: z.string() }),
  execute: async ({ inputData, requestContext, runId }) => {
    const deal = findDeal(inputData.deal);
    if (!deal) throw new Error(`No deal matches "${inputData.deal}".`);
    const result = await compare(deal.id, requestContext as RequestContext, runId);
    const compared = result.rows.some((r) => r.compared);
    return {
      ...result,
      note: compared
        ? "Flags mark a value outside the comps' range. This is not a price recommendation."
        : "Not compared: fewer than three comps match. No range or flag is given.",
    };
  },
});

export const compsComparisonWorkflow = createWorkflow({
  id: "comps-comparison",
  description: "Compare one deal's price, cap rate and price per unit with the Tenant's comps.",
  inputSchema: compareStep.inputSchema,
  outputSchema: compareStep.outputSchema,
})
  .then(compareStep)
  .commit();

const proposeStep = createStep({
  id: "propose-tasks",
  description: "The task specialist proposes one follow-up task per open criterion you describe, assigned to a deal team member who can read the deal.",
  inputSchema: z.object({
    request: z.string().describe("The deal and its open criteria, e.g. Riverside Flats: cap rate at least 5.5% failed at 5.4, and asking price under $60M is unknown"),
  }),
  outputSchema: z.object({ tasks: z.array(taskProposal), message: z.string(), next: z.string() }),
  execute: async ({ inputData, mastra, requestContext, runId }) => {
    const rc = inSession(requestContext as RequestContext, runId);
    const out = await mastra.getAgent("taskAgent").generate(
      `The DealLead asks, word for word:\n"""\n${inputData.request}\n"""\n` +
        "Find the deal, then propose follow-up tasks for the criteria they say failed or are unknown. Propose none for criteria that passed.",
      { requestContext: rc },
    );
    const tasks = await taskProposals(runId);
    return { tasks, message: out.text, next: tasks.length ? REVIEW_PANEL : "No tasks were proposed." };
  },
});

export const followUpTasksWorkflow = createWorkflow({
  id: "follow-up-tasks",
  description: "Propose one follow-up task per failed or unknown criterion you describe. Proposes only; you accept in the review panel.",
  inputSchema: proposeStep.inputSchema,
  outputSchema: proposeStep.outputSchema,
})
  .then(proposeStep)
  .commit();
