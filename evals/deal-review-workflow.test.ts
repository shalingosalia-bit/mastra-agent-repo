import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { RequestContext } from "@mastra/core/request-context";
import { LibSQLStore } from "@mastra/libsql";
import { beforeEach, describe, expect, it } from "vitest";
import { listProposals } from "../src/mastra/foundation/proposals";
import { resetStore, rows } from "../src/mastra/foundation/store";
import { listSessionSourcesTool, proposeMemoTool, proposeTaskTool } from "../src/mastra/tools/proposal-tools";
import { dealReviewWorkflow, readNextSteps } from "../src/mastra/workflows/deal-review";
import { compsComparisonWorkflow, followUpTasksWorkflow } from "../src/mastra/workflows/standalone";

// The deal-review workflow and the standalone ones, with stubs in place of the
// model. The task and memo stubs call the real proposal tools, so the guard,
// the dedupe and the memo's source check all run as they do live.

const toolCtx = (requestContext: RequestContext, agentId: string) =>
  ({ requestContext, agent: { agentId, threadId: "unused" } }) as any;

function stub(id: string, generate: (prompt: string, opts: any) => Promise<any>) {
  const agent = new Agent({ id, name: `${id} stub`, instructions: "stub", model: "anthropic/claude-sonnet-5-5" });
  (agent as any).generate = generate;
  return agent;
}

const riverside = [
  { criterion: "multifamily only", fieldKey: "property_type", operator: "=", target: "Multifamily" },
  { criterion: "cap rate at least 5.5%", fieldKey: "cap_rate", operator: ">=", target: 5.5 },
  { criterion: "asking price under $60M", fieldKey: "asking_price", operator: "<", target: 60_000_000 },
];

const screeningAgent = stub("screening", async (prompt) => prompt.startsWith("INTERPRET")
  ? { object: { proceed: true, corrections: [] } }
  : { object: { deal: "Riverside Flats", criteria: riverside.map((m) => ({ fieldLabel: null, question: null, ...m })) } });

// One proposal per open criterion named in the prompt's table.
const taskAgent = stub("task", async (prompt, { requestContext }) => {
  const open = [...prompt.matchAll(/^\| (.+?) \|.*\| (Fail|Unknown) \|$/gm)].map((m) => m[1]);
  for (const criterion of open) {
    await proposeTaskTool.execute!({ dealId: "D-1001", criterion, title: `Resolve: ${criterion}`, assigneeId: "U-2" }, toolCtx(requestContext, "task"));
  }
  return { text: `Proposed ${open.length} tasks.` };
});

// Quotes every sourced value, as list-session-sources gives them.
const memoAgent = stub("memo", async (prompt, { requestContext }) => {
  const { sources }: any = await listSessionSourcesTool.execute!({}, toolCtx(requestContext, "memo"));
  const decision = prompt.match(/The DealLead's decision: (.+)/)?.[1] ?? null;
  const r: any = await proposeMemoTool.execute!(
    { dealId: "D-1001", title: "Riverside Flats review", decision, figures: sources, body: "Memo body" },
    toolCtx(requestContext, "memo"),
  );
  if (!r.created) throw new Error(r.message);
  return { text: "Memo drafted." };
});

function mastra() {
  return new Mastra({
    agents: { screeningAgent, taskAgent, memoAgent },
    workflows: { dealReviewWorkflow, compsComparisonWorkflow, followUpTasksWorkflow },
    storage: new LibSQLStore({ id: "wf-review-test", url: ":memory:" }),
    logger: false,
  });
}

function rc() {
  const r = new RequestContext();
  r.set("userRole", "DealLead");
  r.set("userId", "U-1");
  r.set("tenantId", "T-demo");
  return r;
}

async function toChooseNext() {
  const run = await mastra().getWorkflow("dealReviewWorkflow").createRun();
  await run.start({ inputData: { request: "Screen Riverside Flats: multifamily only, cap rate at least 5.5%, asking under 60M." }, requestContext: rc() });
  const res: any = await run.resume({ step: "confirm-mapping", resumeData: { reply: "Looks good." }, requestContext: rc() });
  return { run, res };
}

beforeEach(async () => {
  await resetStore();
});

describe("deal-review workflow", () => {
  it("pauses again after the verdict and does nothing more until the DealLead says what's next", async () => {
    const { run, res } = await toChooseNext();
    expect(res.status).toBe("suspended");
    const shown = res.steps["choose-next"].suspendPayload;
    expect(shown.rows.map((r: any) => r.verdict)).toEqual(["pass", "fail", "unknown"]);
    expect(shown.message).toMatch(/2 of 3 criteria are open/);
    expect(await listProposals({ sessionId: run.runId })).toHaveLength(0);
  });

  it("runs tasks, comps and the memo when asked for all of it", async () => {
    const { run } = await toChooseNext();
    const done: any = await run.resume({ step: "choose-next", resumeData: { reply: "All of it. My decision: pursue to LOI." }, requestContext: rc() });

    expect(done.status).toBe("success");
    const out = done.result;
    expect(out.tasks.map((t: any) => t.criterion)).toEqual(["cap rate at least 5.5%", "asking price under $60M"]);
    expect(out.comparison.rows.find((r: any) => r.metric === "Price per unit")).toMatchObject({ flag: "above range", high: 238_000 });
    expect(out.memo).toMatchObject({ decision: "pursue to LOI", status: "pending" });
    expect(out.next).toMatch(/3 proposals wait for you/);
    // Proposals only: nothing created, saved or submitted.
    expect(await rows(`SELECT * FROM poc_work_items`)).toHaveLength(0);
    expect(await rows(`SELECT * FROM poc_files`)).toHaveLength(0);
    expect(await rows(`SELECT * FROM poc_approvals`)).toHaveLength(0);
  });

  it("runs only what the DealLead asked for", async () => {
    const { run } = await toChooseNext();
    const done: any = await run.resume({ step: "choose-next", resumeData: { reply: "Just compare it with comps." }, requestContext: rc() });
    expect(done.result).toMatchObject({ tasks: [], memo: null });
    expect(done.result.comparison.rows).toHaveLength(3);
    expect(await listProposals({ sessionId: run.runId })).toHaveLength(0);
  });

  it("ends without proposing anything when the DealLead says stop", async () => {
    const { run } = await toChooseNext();
    const done: any = await run.resume({ step: "choose-next", resumeData: { reply: "Stop here, thanks." }, requestContext: rc() });
    expect(done.result).toMatchObject({ tasks: [], comparison: null, memo: null, next: expect.stringMatching(/Nothing waits for you/) });
  });
});

describe("reading what's next", () => {
  it.each([
    ["Chase the open criteria and compare with comps", { tasks: true, comps: true, memo: false, decision: null }],
    ["Do everything but skip the memo", { tasks: true, comps: true, memo: false }],
    ["No comps, just write the memo. Decision: pass", { tasks: false, comps: false, memo: true, decision: "pass" }],
    ["set up follow-ups", { tasks: true, comps: false, memo: false }],
    ["stop", { tasks: false, comps: false, memo: false }],
  ])("%s", (reply, expected) => {
    expect(readNextSteps(reply)).toMatchObject(expected);
  });
});

describe("standalone workflows", () => {
  it("comps-comparison flags price per unit for Riverside Flats", async () => {
    const run = await mastra().getWorkflow("compsComparisonWorkflow").createRun();
    const done: any = await run.start({ inputData: { deal: "Riverside Flats" }, requestContext: rc() });
    expect(done.result.rows.map((r: any) => r.flag)).toEqual([null, null, "above range"]);
  });

  it("comps-comparison refuses to compare Lamar Station's two comps", async () => {
    const run = await mastra().getWorkflow("compsComparisonWorkflow").createRun();
    const done: any = await run.start({ inputData: { deal: "Lamar Station" }, requestContext: rc() });
    expect(done.result.rows.every((r: any) => !r.compared)).toBe(true);
    expect(done.result.note).toMatch(/fewer than three comps/);
  });

  it("follow-up-tasks returns the proposals the task specialist made", async () => {
    const run = await mastra().getWorkflow("followUpTasksWorkflow").createRun();
    const done: any = await run.start({
      inputData: { request: "Riverside Flats.\n| cap rate at least 5.5% | Going-in Cap Rate | 5.4 | Fail |" },
      requestContext: rc(),
    });
    expect(done.result.tasks).toHaveLength(1);
    expect(done.result.tasks[0]).toMatchObject({ assignee: "Raj Patel", status: "pending" });
    expect(done.result.next).toMatch(/review panel/);
  });
});
