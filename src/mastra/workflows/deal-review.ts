import type { RequestContext } from "@mastra/core/request-context";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { listProposals } from "../foundation/proposals";
import { checkCriteria, confirmMapping, resolveCriteria, screeningResult, verdictRows } from "./screening-steps";
import { compare, comparisonResult, inSession, REVIEW_PANEL, taskProposal, taskProposals } from "./shared";

// The whole deal review as one workflow (brief §Agent Workflow, steps 1 to 10):
// screen, wait for the DealLead to confirm, check, then wait again for what they
// want next. Tasks, comps and the memo run only when the DealLead asks for them,
// in that order, so the memo can quote what the run sourced. Every write is a
// proposal the DealLead accepts in the review panel.

// Which next steps the reply asks for. Read in code, not by a model, so the
// workflow never starts a step the DealLead did not ask for.
export function readNextSteps(reply: string) {
  const r = reply.toLowerCase();
  const all = /\b(all|everything|all three|the lot|full review)\b/.test(r);
  const wants = (word: RegExp, noun: string) =>
    (all || word.test(r)) && !new RegExp(`\\b(skip|no|without|don't|dont|not)\\b[^.,;]{0,20}${noun}`).test(r);
  const decision = reply.match(/\bdecision(?:\s+is|\s*:)\s*([^.\n]+)/i)?.[1]?.trim() ?? null;
  return {
    tasks: wants(/\b(task|tasks|chase|follow[- ]?ups?|open criteria|open items)\b/, "(task|chase|follow)"),
    comps: wants(/\b(comp|comps|compare|comparison|market)\b/, "(comp|compar)"),
    memo: wants(/\b(memo|write[- ]?up)\b/, "(memo|write)"),
    decision,
  };
}

const chooseNext = createStep({
  id: "choose-next",
  description: "Shows the verdict and waits for the DealLead to say what's next: chase open criteria, compare with comps, draft the memo, or stop.",
  inputSchema: screeningResult,
  suspendSchema: z.object({ deal: z.string(), rows: verdictRows, message: z.string() }),
  resumeSchema: z.object({
    reply: z.string().describe("What next, e.g. chase the open criteria and compare with comps / all of it, my decision: pursue to LOI / stop"),
  }),
  outputSchema: z.object({
    dealId: z.string(),
    rows: verdictRows,
    tasks: z.boolean(),
    comps: z.boolean(),
    memo: z.boolean(),
    decision: z.string().nullable(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const nothing = { dealId: inputData.dealId, rows: inputData.rows, tasks: false, comps: false, memo: false, decision: null };
    if (!inputData.rows.length) return nothing;
    if (!resumeData) {
      const open = inputData.rows.filter((r) => r.verdict !== "pass").length;
      return await suspend({
        deal: inputData.deal,
        rows: inputData.rows,
        message: `${inputData.note} ${open} of ${inputData.rows.length} criteria are open.\n\n` +
          "What next? You can chase the open criteria, compare with comps, draft the memo, or ask for all of it. " +
          "Include your decision if you've made one (\"my decision: pursue to LOI\"). Say \"stop\" to end here.",
      });
    }
    return { ...nothing, ...readNextSteps(resumeData.reply) };
  },
});

const proposeTasks = createStep({
  id: "propose-tasks",
  description: "The task specialist proposes one follow-up task per failed or unknown criterion. Runs only if the DealLead asked.",
  inputSchema: chooseNext.outputSchema,
  outputSchema: z.object({ tasks: z.array(taskProposal) }),
  execute: async ({ inputData, mastra, requestContext, runId }) => {
    const open = inputData.rows.filter((r) => r.verdict !== "pass");
    if (!inputData.tasks || !open.length) return { tasks: [] };
    const rc = inSession(requestContext as RequestContext, runId);
    await mastra.getAgent("taskAgent").generate(
      `Deal ${inputData.dealId}. Propose follow-up tasks for these open criteria only:\n` +
        "| Criterion | Field | Deal value | Verdict |\n" +
        open.map((r) => `| ${r.criterion} | ${r.field} | ${r.value ?? ""} | ${r.verdict === "fail" ? "Fail" : "Unknown"} |`).join("\n"),
      { requestContext: rc },
    );
    return { tasks: await taskProposals(runId) };
  },
});

const compareComps = createStep({
  id: "compare-comps",
  description: "Places price, cap rate and price per unit against the Tenant's comps. Runs only if the DealLead asked.",
  inputSchema: proposeTasks.outputSchema,
  outputSchema: z.object({ comparison: comparisonResult.nullable() }),
  execute: async ({ getStepResult, requestContext, runId }) => {
    const choice = getStepResult(chooseNext);
    if (!choice.comps) return { comparison: null };
    return { comparison: await compare(choice.dealId, requestContext as RequestContext, runId) };
  },
});

const memoProposal = z.object({ id: z.string(), title: z.string(), decision: z.string().nullable(), status: z.string() });

const draftMemo = createStep({
  id: "draft-memo",
  description: "The memo specialist drafts the decision memo from what this run found, as a proposal. Runs only if the DealLead asked.",
  inputSchema: compareComps.outputSchema,
  outputSchema: z.object({ memo: memoProposal.nullable(), memoText: z.string().nullable() }),
  execute: async ({ inputData, getStepResult, mastra, requestContext, runId }) => {
    const choice = getStepResult(chooseNext);
    if (!choice.memo) return { memo: null, memoText: null };
    const { tasks } = getStepResult(proposeTasks);
    const rc = inSession(requestContext as RequestContext, runId);
    const comparison = inputData.comparison;

    const out = await mastra.getAgent("memoAgent").generate(
      `Deal ${choice.dealId}. Draft the decision memo.\n` +
        `Verdict:\n${choice.rows.map((r) => `${r.criterion} | ${r.field} | ${r.value ?? "Unknown"} | ${r.verdict} | ${r.source ?? "no source"}`).join("\n")}\n` +
        `Comparison: ${comparison
          ? comparison.rows.map((r) => r.compared ? `${r.metric} ${r.dealValue} (comps ${r.low} to ${r.high}, median ${r.median})${r.flag ? `, ${r.flag}` : ""}` : `${r.metric} not compared: ${r.reason}`).join("; ")
          : "not run."}\n` +
        `Proposed tasks: ${tasks.length ? tasks.map((t) => `${t.id} ${t.title} (${t.criterion})`).join("; ") : "none."}\n` +
        (choice.decision ? `The DealLead's decision: ${choice.decision}` : "The DealLead has not stated a decision."),
      { requestContext: rc },
    );
    const memo = (await listProposals({ sessionId: runId })).filter((p) => p.kind === "memo").at(-1);
    return {
      memo: memo ? { id: memo.id, title: memo.payload.title, decision: memo.payload.decision ?? null, status: memo.status } : null,
      memoText: out.text,
    };
  },
});

const summarize = createStep({
  id: "summarize",
  description: "Gathers the run's results and what waits for the DealLead.",
  inputSchema: draftMemo.outputSchema,
  outputSchema: z.object({
    deal: z.string(),
    verdict: verdictRows,
    unresolved: z.array(z.string()),
    tasks: z.array(taskProposal),
    comparison: comparisonResult.nullable(),
    memo: memoProposal.nullable(),
    memoText: z.string().nullable(),
    next: z.string(),
  }),
  execute: async ({ inputData, getStepResult }) => {
    const checked = getStepResult(checkCriteria);
    const { tasks } = getStepResult(proposeTasks);
    const { comparison } = getStepResult(compareComps);
    const waiting = tasks.length + (inputData.memo ? 1 : 0);
    return {
      deal: checked.deal,
      verdict: checked.rows,
      unresolved: checked.unresolved,
      tasks,
      comparison,
      memo: inputData.memo,
      memoText: inputData.memoText,
      next: waiting
        ? `${waiting} proposal${waiting > 1 ? "s" : ""} wait for you. ${REVIEW_PANEL} An accepted memo goes to Flow, where Morgan Lee approves or rejects it.`
        : `${checked.note} Nothing waits for you.`,
    };
  },
});

export const dealReviewWorkflow = createWorkflow({
  id: "deal-review",
  description: "The whole deal review: screen against your criteria, confirm the mapping, then chase open criteria, compare with comps and draft the memo, as you ask.",
  inputSchema: resolveCriteria.inputSchema,
  outputSchema: summarize.outputSchema,
})
  .then(resolveCriteria)
  .then(confirmMapping)
  .then(checkCriteria)
  .then(chooseNext)
  .then(proposeTasks)
  .then(compareComps)
  .then(draftMemo)
  .then(summarize)
  .commit();
