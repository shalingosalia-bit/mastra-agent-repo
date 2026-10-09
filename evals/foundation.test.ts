import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it } from "vitest";
import { BOUNDS, runOptions } from "../src/mastra/foundation/bounds";
import { costOf } from "../src/mastra/foundation/cost";
import { setKillSwitch } from "../src/mastra/foundation/kill-switch";
import { acceptProposal, dealRecord, decideApproval, listProposals, rejectProposal } from "../src/mastra/foundation/proposals";
import { registry } from "../src/mastra/foundation/registry";
import { sessionRecord } from "../src/mastra/foundation/sessions";
import { resetStore, rows } from "../src/mastra/foundation/store";
import { compareToCompsTool } from "../src/mastra/tools/comparison-tools";
import { listSessionSourcesTool, proposeMemoTool, proposeTaskTool } from "../src/mastra/tools/proposal-tools";
import { checkCriteriaTool } from "../src/mastra/tools/screening-tools";
import { call, ctx } from "./helpers";

// Deterministic eval cases from deal screening 05 §Eval Cases: the guarantees the
// tools and the foundation make whatever the model does. agents.test.ts runs the
// model-dependent halves.

const riversideCriteria = [
  { criterion: "Multifamily only", fieldKey: "property_type", test: { operator: "=", target: "Multifamily" } },
  { criterion: "Cap rate at least 5.5%", fieldKey: "cap_rate", test: { operator: ">=", target: 5.5 } },
  { criterion: "Asking price under $60M", fieldKey: "asking_price", test: { operator: "<", target: 60_000_000 } },
  { criterion: "Seller reserve under $57M", fieldKey: "seller_reserve", test: { operator: "<", target: 57_000_000 } },
];

const screening = (o: Parameters<typeof ctx>[0] = {}) => ctx({ agentId: "screening", ...o });
const task = (o: Parameters<typeof ctx>[0] = {}) => ctx({ agentId: "task", ...o });
const memo = (o: Parameters<typeof ctx>[0] = {}) => ctx({ agentId: "memo", ...o });

beforeEach(async () => {
  await resetStore();
});

describe("screening", () => {
  it("case 1: a criterion on no such field is Unknown and asks, never guessed", async () => {
    const r = await call(checkCriteriaTool, {
      dealId: "D-1001",
      criteria: [{ criterion: "In an opportunity zone", fieldKey: "opportunity_zone", test: { operator: "=", target: "Yes" } }],
    }, screening());
    expect(r.rows[0]).toMatchObject({ verdict: "unknown", value: null });
    expect(r.rows[0].note).toMatch(/Ask the DealLead/);
  });

  it("case 2: a value absent from the deal is Unknown, never estimated", async () => {
    const r = await call(checkCriteriaTool, { dealId: "D-1001", criteria: riversideCriteria }, screening());
    const asking = r.rows.find((x: any) => x.criterion.startsWith("Asking"));
    expect(asking).toMatchObject({ verdict: "unknown", value: null, source: null });
  });

  it("case 3: every value carries its field as its source", async () => {
    const r = await call(checkCriteriaTool, { dealId: "D-1001", criteria: riversideCriteria }, screening());
    for (const row of r.rows) {
      if (row.value !== null) expect(row.source).toBe(`Riverside Flats › ${row.field}`);
    }
    expect(r.rows.map((x: any) => x.verdict)).toEqual(["pass", "fail", "unknown", "pass"]);
  });

  it("case 6: an Analyst gets Unknown on a field they cannot read, as the deal page shows", async () => {
    const r = await call(checkCriteriaTool, { dealId: "D-1001", criteria: riversideCriteria }, screening({ role: "Analyst", userId: "U-2" }));
    const reserve = r.rows.find((x: any) => x.criterion.startsWith("Seller"));
    expect(reserve).toMatchObject({ verdict: "unknown", value: null });
  });
});

describe("tasks", () => {
  it("case 7: proposing the same open criterion twice gives one proposal", async () => {
    const input = { dealId: "D-1001", criterion: "Cap rate at least 5.5%", title: "Confirm in-place cap rate", assigneeId: "U-2" };
    const a = await call(proposeTaskTool, input, task());
    const b = await call(proposeTaskTool, input, task());
    expect(a.created).toBe(true);
    expect(b).toMatchObject({ created: false, duplicate: true });
    expect(b.proposal.id).toBe(a.proposal.id);
    expect(await listProposals({ dealId: "D-1001" })).toHaveLength(1);
  });

  it("case 8: no task exists until accepted, and accepting twice creates one", async () => {
    const { proposal } = await call(proposeTaskTool,
      { dealId: "D-1001", criterion: "Asking price under $60M", title: "Get the asking price from the broker", assigneeId: null }, task());
    expect(await rows(`SELECT * FROM poc_work_items`)).toHaveLength(0);

    await acceptProposal(proposal.id, "U-1");
    const again = await acceptProposal(proposal.id, "U-1");
    expect(again.alreadyAccepted).toBe(true);
    const items = await rows<{ proposal_id: string; due_date: string }>(`SELECT * FROM poc_work_items`);
    expect(items).toHaveLength(1);
    expect(items[0].proposal_id).toBe(proposal.id);
  });

  it("case 8: only the DealLead accepts, and no agent holds that grant", async () => {
    const { proposal } = await call(proposeTaskTool,
      { dealId: "D-1001", criterion: "Cap rate", title: "Check cap rate", assigneeId: null }, task());
    await expect(acceptProposal(proposal.id, "U-2")).rejects.toThrow(/not the deal's DealLead/);
    for (const agent of Object.values(registry)) expect(agent.grants).not.toContain("proposal.accept");
  });

  it("case 9: a team member who cannot read the deal is never assigned", async () => {
    const r = await call(proposeTaskTool,
      { dealId: "D-1001", criterion: "Title", title: "Review title", assigneeId: "U-4" }, task());
    expect(r.created).toBe(false);
    expect(await listProposals()).toHaveLength(0);
  });

  it("a rejected proposal can be proposed again, and the rejection is recorded", async () => {
    const input = { dealId: "D-1001", criterion: "Occupancy", title: "Check rent roll", assigneeId: "U-3" };
    const a = await call(proposeTaskTool, input, task());
    await rejectProposal(a.proposal.id, "U-1", "Wrong owner");
    const b = await call(proposeTaskTool, input, task());
    expect(b.created).toBe(true);
    const rec = await sessionRecord("S-test");
    expect(rec!.activities.some((x: any) => x.kind === "proposal.rejected" && x.detail.reason === "Wrong owner")).toBe(true);
  });
});

describe("comparison", () => {
  it("case 10: each flag matches the fixture's range", async () => {
    const r = await call(compareToCompsTool, { dealId: "D-1001" }, ctx({ agentId: "comparison" }));
    const byMetric = Object.fromEntries(r.rows.map((x: any) => [x.metric, x]));
    expect(byMetric["Price"]).toMatchObject({ compared: true, low: 36_900_000, high: 63_800_000, flag: null });
    expect(byMetric["Cap rate"]).toMatchObject({ compared: true, low: 4.9, high: 5.6, median: 5.3, flag: null });
    expect(byMetric["Price per unit"]).toMatchObject({ compared: true, low: 195_000, high: 238_000, flag: "above range" });
  });

  it("case 11: with two comps nothing is compared or flagged", async () => {
    const r = await call(compareToCompsTool, { dealId: "D-1002" }, ctx({ agentId: "comparison" }));
    for (const row of r.rows) {
      expect(row.compared).toBe(false);
      expect(row.flag).toBeUndefined();
    }
  });
});

describe("memo", () => {
  async function seedSession() {
    await call(checkCriteriaTool, { dealId: "D-1001", criteria: riversideCriteria }, screening());
    await call(compareToCompsTool, { dealId: "D-1001" }, ctx({ agentId: "comparison" }));
  }

  it("case 12: a figure the session did not source is refused", async () => {
    await seedSession();
    const r = await call(proposeMemoTool, {
      dealId: "D-1001", title: "Riverside Flats screening", decision: null, body: "…",
      figures: [{ label: "Going-in Cap Rate", value: 5.6, source: "Riverside Flats › Going-in Cap Rate" }],
    }, memo());
    expect(r.created).toBe(false);
    expect(r.message).toMatch(/do not match/);
  });

  it("case 12: figures traced to the session's sources are accepted", async () => {
    await seedSession();
    const { sources } = await call(listSessionSourcesTool, {}, memo());
    expect(sources.length).toBeGreaterThan(0);
    const r = await call(proposeMemoTool, {
      dealId: "D-1001", title: "Riverside Flats screening", decision: null, body: "Cap rate 5.4%, price per unit above the comps' range.",
      figures: [
        { label: "Going-in Cap Rate", value: "5.4%", source: "Riverside Flats › Going-in Cap Rate" },
        { label: "Price per unit, comps high", value: "$238,000", source: "comps: 5 Austin Multifamily › Price per unit high" },
      ],
    }, memo());
    expect(r.created).toBe(true);
  });

  it("case 13: no file or approval before the DealLead accepts; approval is Flow's", async () => {
    await seedSession();
    const { proposal } = await call(proposeMemoTool, {
      dealId: "D-1001", title: "Riverside Flats screening", decision: "Pursue", body: "Memo body",
      figures: [{ label: "Going-in Cap Rate", value: 5.4, source: "Riverside Flats › Going-in Cap Rate" }],
    }, memo());
    expect(await rows(`SELECT * FROM poc_files`)).toHaveLength(0);
    expect(await rows(`SELECT * FROM poc_approvals`)).toHaveLength(0);

    const accepted = await acceptProposal(proposal.id, "U-1");
    const { fileId, approvalId } = accepted.proposal.result!;
    expect(fileId).toBeTruthy();
    const [approval] = await rows<{ status: string; approver_id: string }>(`SELECT * FROM poc_approvals WHERE id = ?`, [approvalId]);
    expect(approval).toMatchObject({ status: "pending", approver_id: "U-9" });

    await expect(decideApproval(approvalId, "U-1", "approved")).rejects.toThrow(/not this memo's approver/);
    await decideApproval(approvalId, "U-9", "approved", "Proceed to LOI");
    const record = await dealRecord("D-1001");
    const decided = record.events.find((e: any) => e.event === "memo.approved");
    expect(decided).toMatchObject({ actor_id: "U-9" });
    expect(decided!.detail.evidence.figures).toHaveLength(1);
  });
});

describe("guardrails", () => {
  it("an agent acts only within its own grants", async () => {
    const r = await call(checkCriteriaTool, { dealId: "D-1001", criteria: riversideCriteria }, memo());
    expect(r).toMatchObject({ refused: true });
    const s = await call(proposeMemoTool, { dealId: "D-1001", title: "x", decision: null, body: "x", figures: [] }, task());
    expect(s).toMatchObject({ refused: true });
  });

  it("the kill switch stops every tool in the Tenant, and only that Tenant", async () => {
    await setKillSwitch("T-demo", true, "admin");
    const r = await call(compareToCompsTool, { dealId: "D-1001" }, ctx({ agentId: "comparison" }));
    expect(r).toMatchObject({ refused: true });
    const other = await call(compareToCompsTool, { dealId: "D-1001" }, ctx({ agentId: "comparison", tenantId: "T-other" }));
    expect(other.found).toBe(true);
    await setKillSwitch("T-demo", false, "admin");
    const after = await call(compareToCompsTool, { dealId: "D-1001" }, ctx({ agentId: "comparison" }));
    expect(after.found).toBe(true);
  });

  it("the session records who acted, with which agent version", async () => {
    await call(compareToCompsTool, { dealId: "D-1001" }, ctx({ agentId: "comparison", sessionId: "S-rec" }));
    const rec = await sessionRecord("S-rec");
    expect(rec!.session).toMatchObject({ user_id: "U-1", role: "DealLead", tenant_id: "T-demo" });
    expect(rec!.activities[0]).toMatchObject({ actor_id: "comparison", agent_version: registry.comparison.version, kind: "tool.call" });
  });
});

describe("bounds", () => {
  function run(tenantId = "T-demo") {
    const rc = new RequestContext();
    rc.set("tenantId", tenantId);
    return { rc, opts: runOptions(rc, "claude-sonnet-5-5") };
  }
  const start = (opts: ReturnType<typeof runOptions>, rc: RequestContext, primitiveId = "screening") =>
    opts.delegation.onDelegationStart({ primitiveId, threadId: "S-bounds", runId: "R-1", requestContext: rc });

  it("caps steps for the supervisor and each specialist", async () => {
    const { rc, opts } = run();
    expect(opts.maxSteps).toBe(BOUNDS.steps);
    expect(await start(opts, new RequestContext())).toEqual({ modifiedMaxSteps: BOUNDS.specialistSteps });
    expect(rc).toBeDefined();
  });

  it("hands the session id to each specialist", async () => {
    const { opts } = run();
    const child = new RequestContext();
    await start(opts, child);
    expect(child.get("sessionId")).toBe("S-bounds");
  });

  it("refuses further delegation once the cost bound is reached", async () => {
    const { opts } = run();
    await start(opts, new RequestContext());
    // $6 of specialist usage at Sonnet 5.5 rates, past the $2 bound.
    await opts.delegation.onDelegationComplete({
      primitiveId: "screening", runId: "R-1", duration: 10, success: true,
      result: { usage: { inputTokens: 2_000_000, outputTokens: 0, totalTokens: 2_000_000 } },
    });
    const r = await start(opts, new RequestContext(), "comparison");
    expect(r).toMatchObject({ proceed: false });
    expect((r as any).rejectionReason).toMatch(/Cost bound/);
    const stop1 = await opts.onIterationComplete({ threadId: "S-bounds", runId: "R-1" });
    expect(stop1).toMatchObject({ continue: true });
    const stop2 = await opts.onIterationComplete({ threadId: "S-bounds", runId: "R-1" });
    expect(stop2).toEqual({ continue: false });
  });

  it("the kill switch aborts a running session and ends it", async () => {
    const { opts, rc } = run();
    await start(opts, new RequestContext());
    const { stopped } = await setKillSwitch("T-demo", true, "admin");
    expect(stopped).toBeGreaterThanOrEqual(1);
    expect(opts.abortSignal.aborted).toBe(true);
    const rec = await sessionRecord("S-bounds");
    expect(rec!.session).toMatchObject({ status: "ended", outcome: "killed" });
    expect(rec!.activities.at(-1)).toMatchObject({ kind: "session.killed" });
    expect(await start(opts, new RequestContext())).toMatchObject({ proceed: false });
    await setKillSwitch("T-demo", false, "admin");
    expect(rc).toBeDefined();
  });

  it("prices usage at the model's rates", () => {
    expect(costOf({ inputTokens: 1_000_000, outputTokens: 100_000 }, "anthropic/claude-sonnet-5-5")).toBeCloseTo(3);
    expect(costOf({ inputTokens: 1_000_000, cachedInputTokens: 1_000_000 }, "anthropic/claude-sonnet-5-5")).toBeCloseTo(0.2);
  });
});
