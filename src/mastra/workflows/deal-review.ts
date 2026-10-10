import type { RequestContext } from "@mastra/core/request-context";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { listProposals } from "../foundation/proposals";
import { proposeDealNoteTool } from "../tools/proposal-tools";
import { checkCriteria, confirmMapping, resolveCriteria, screeningResult, verdictRows } from "./screening-steps";
import { compare, comparisonResult, inSession, REVIEW_PANEL, taskProposal, taskProposals } from "./shared";

// The whole deal review as one workflow (brief §Agent Workflow, steps 1 to 10):
// screen, wait for the DealLead to confirm, check, then two decisions the
// verdict drives, then wait for what they want next.
//   - Out of the buy box: a must-have criterion failed, so ask whether to go on.
//   - Missing data: a criterion is Unknown, so ask whether to request it.
// Each is a yes/no question to the DealLead, never an action taken for them.
// Tasks, comps and the memo run only when the DealLead asks for them, in that
// order, so the memo can quote what the run sourced. Every write is a proposal
// the DealLead accepts in the review panel.

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

// A yes or a no, read in code. Anything else gets the question again.
export function readYesNo(reply: string): "yes" | "no" | null {
  const r = reply.toLowerCase();
  const no = /\b(no|nope|stop|don't|dont|skip|end|halt|pass on it)\b/.test(r);
  const yes = /\b(yes|yep|yeah|sure|ok|okay|continue|go ahead|proceed|keep going|do it|please)\b/.test(r);
  return yes === no ? null : yes ? "yes" : "no";
}

// Criteria whose failure puts a deal outside the buy box, by the field checked.
const MUST_HAVE = new Set(["Property Type", "Market"]);
type Rows = z.infer<typeof verdictRows>;
const outsideBuyBox = (rows: Rows) => rows.filter((r) => r.verdict === "fail" && MUST_HAVE.has(r.field));
const missing = (rows: Rows) => rows.filter((r) => r.verdict === "unknown");

const yesNo = z.object({ reply: z.string().describe("yes or no, in your own words") });

const buyBoxGate = createStep({
  id: "buy-box-gate",
  description: "A must-have criterion (property type or market) failed. Asks the DealLead whether to continue; on no, ends the review and proposes a note saying why.",
  inputSchema: screeningResult,
  suspendSchema: z.object({ outside: verdictRows, message: z.string() }),
  resumeSchema: yesNo,
  outputSchema: z.object({ stopped: z.boolean(), outside: z.array(z.string()) }),
  execute: async ({ inputData, resumeData, suspend, requestContext, runId }) => {
    const outside = outsideBuyBox(inputData.rows);
    const what = outside.map((r) => `${r.field} is ${r.value}`).join(" and ");
    if (!resumeData) {
      return await suspend({ outside, message: `${inputData.deal} is outside your buy box: ${what}. Continue the review anyway? Reply yes to continue, or no to stop here.` });
    }
    const answer = readYesNo(resumeData.reply);
    if (!answer) return await suspend({ outside, message: `Please answer yes to continue the review of ${inputData.deal}, or no to stop here.` });
    if (answer === "no") {
      // The task specialist holds the note grant; the note is a proposal, as any write is.
      await proposeDealNoteTool.execute!(
        { dealId: inputData.dealId, note: `Screened out: outside the buy box (${what}).` },
        { requestContext: inSession(requestContext as RequestContext, runId), agent: { agentId: "task", threadId: runId } } as any,
      );
    }
    return { stopped: answer === "no", outside: outside.map((r) => r.criterion) };
  },
});

const withinBuyBox = createStep({
  id: "within-buy-box",
  description: "Every must-have criterion passed or could not be checked, so the review goes on.",
  inputSchema: screeningResult,
  outputSchema: z.object({ stopped: z.boolean(), outside: z.array(z.string()) }),
  execute: async () => ({ stopped: false, outside: [] }),
});

const gateOutcome = z.object({}).passthrough();
const stoppedAtGate = (get: (id: string) => any) => Boolean(get("buy-box-gate")?.stopped);

const requestMissingData = createStep({
  id: "request-missing-data",
  description: "Some criteria are Unknown. Asks the DealLead whether to request the missing values; on yes, the task specialist proposes a request for each.",
  inputSchema: gateOutcome,
  suspendSchema: z.object({ missing: verdictRows, message: z.string() }),
  resumeSchema: yesNo,
  outputSchema: z.object({ requested: z.array(taskProposal) }),
  execute: async ({ resumeData, suspend, getStepResult, mastra, requestContext, runId }) => {
    const checked = getStepResult(checkCriteria);
    const gaps = missing(checked.rows);
    const list = gaps.map((r) => r.criterion).join("; ");
    if (!resumeData) {
      return await suspend({ missing: gaps, message: `${gaps.length} value${gaps.length > 1 ? "s are" : " is"} missing on ${checked.deal}: ${list}. Shall I propose requests for ${gaps.length > 1 ? "them" : "it"}? Reply yes or no.` });
    }
    const answer = readYesNo(resumeData.reply);
    if (!answer) return await suspend({ missing: gaps, message: `Please answer yes to propose requests for: ${list}, or no to skip.` });
    if (answer === "no") return { requested: [] };
    await mastra.getAgent("taskAgent").generate(
      `Deal ${checked.dealId}. These values are missing from the deal. Propose one task per row to request the value, from the broker unless someone on the deal team holds it:\n` +
        "| Criterion | Field | Deal value | Verdict |\n" +
        gaps.map((r) => `| ${r.criterion} | ${r.field} | | Unknown |`).join("\n"),
      { requestContext: inSession(requestContext as RequestContext, runId) },
    );
    return { requested: await taskProposals(runId) };
  },
});

const skipMissingData = createStep({
  id: "no-missing-data",
  description: "Nothing is Unknown, or the review stopped at the buy box, so there is nothing to request.",
  inputSchema: gateOutcome,
  outputSchema: z.object({ requested: z.array(taskProposal) }),
  execute: async () => ({ requested: [] }),
});

const chooseNext = createStep({
  id: "choose-next",
  description: "Shows the verdict and waits for the DealLead to say what's next: chase open criteria, compare with comps, draft the memo, or stop.",
  inputSchema: gateOutcome,
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
  execute: async ({ resumeData, suspend, getStepResult }) => {
    const checked = getStepResult(checkCriteria);
    const nothing = { dealId: checked.dealId, rows: checked.rows, tasks: false, comps: false, memo: false, decision: null };
    if (!checked.rows.length || stoppedAtGate((id) => getStepResult(id))) return nothing;
    if (!resumeData) {
      const open = checked.rows.filter((r) => r.verdict !== "pass").length;
      return await suspend({
        deal: checked.deal,
        rows: checked.rows,
        message: `${checked.note} ${open} of ${checked.rows.length} criteria are open.\n\n` +
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
    outsideBuyBox: z.array(z.string()),
    stoppedAtBuyBox: z.boolean(),
    tasks: z.array(taskProposal),
    comparison: comparisonResult.nullable(),
    memo: memoProposal.nullable(),
    memoText: z.string().nullable(),
    next: z.string(),
  }),
  execute: async ({ inputData, getStepResult, runId }) => {
    const checked = getStepResult(checkCriteria);
    const gate = (getStepResult("buy-box-gate") as any) ?? { stopped: false, outside: [] };
    const { comparison } = getStepResult(compareComps);
    const tasks = await taskProposals(runId);
    const waiting = (await listProposals({ sessionId: runId, status: "pending" })).length;
    return {
      deal: checked.deal,
      verdict: checked.rows,
      unresolved: checked.unresolved,
      outsideBuyBox: gate.outside,
      stoppedAtBuyBox: gate.stopped,
      tasks,
      comparison,
      memo: inputData.memo,
      memoText: inputData.memoText,
      next: waiting
        ? `${waiting} proposal${waiting > 1 ? "s" : ""} wait for you. ${REVIEW_PANEL} An accepted memo goes to Flow, where Morgan Lee approves or rejects it.`
        : `${gate.stopped ? "Stopped at the buy box. " : ""}${checked.note} Nothing waits for you.`,
    };
  },
});

export const dealReviewWorkflow = createWorkflow({
  id: "deal-review",
  description: "The whole deal review: screen against your criteria and confirm the mapping; decide on a deal outside the buy box and on missing values; then chase open criteria, compare with comps and draft the memo, as you ask.",
  inputSchema: resolveCriteria.inputSchema,
  outputSchema: summarize.outputSchema,
})
  .then(resolveCriteria)
  .then(confirmMapping)
  .then(checkCriteria)
  .branch([
    [async ({ inputData }) => outsideBuyBox(inputData.rows).length > 0, buyBoxGate],
    [async ({ inputData }) => outsideBuyBox(inputData.rows).length === 0, withinBuyBox],
  ])
  .branch([
    [async ({ getStepResult }) => !stoppedAtGate((id) => getStepResult(id)) && missing(getStepResult(checkCriteria).rows).length > 0, requestMissingData],
    [async ({ getStepResult }) => stoppedAtGate((id) => getStepResult(id)) || missing(getStepResult(checkCriteria).rows).length === 0, skipMissingData],
  ])
  .then(chooseNext)
  .then(proposeTasks)
  .then(compareComps)
  .then(draftMemo)
  .then(summarize)
  .commit();
