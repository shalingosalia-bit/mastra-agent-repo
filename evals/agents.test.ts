import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it } from "vitest";
import { listProposals } from "../src/mastra/foundation/proposals";
import { sessionRecord } from "../src/mastra/foundation/sessions";
import { resetStore, rows } from "../src/mastra/foundation/store";
import { mastra } from "../src/mastra/index";
import { compareToCompsTool } from "../src/mastra/tools/comparison-tools";
import { checkCriteriaTool } from "../src/mastra/tools/screening-tools";
import { call, ctx } from "./helpers";

// Model-dependent eval cases from deal screening 05 §Eval Cases. They call the
// model, so they run only when ANTHROPIC_API_KEY is set (CI sets it from a secret).
// Each case is judged from what the foundation recorded, not from the wording.

const live = Boolean(process.env.ANTHROPIC_API_KEY);

function rc(sessionId: string, role: "DealLead" | "Analyst" = "DealLead") {
  const r = new RequestContext();
  r.set("sessionId", sessionId);
  r.set("userRole", role);
  r.set("userId", role === "Analyst" ? "U-2" : "U-1");
  r.set("tenantId", "T-demo");
  return r;
}

async function toolCalls(sessionId: string, tool: string) {
  const rec = await sessionRecord(sessionId);
  return (rec?.activities ?? []).filter((a: any) => a.kind === "tool.call" && a.detail.tool === tool);
}

describe.skipIf(!live)("agent eval cases", () => {
  beforeEach(async () => {
    await resetStore();
  });

  it("case 1: a criterion with no matching field is asked about, and nothing is checked", async () => {
    const out = await mastra.getAgent("screeningAgent").generate(
      "RESOLVE. Deal: Riverside Flats. Criteria: 'In a qualified opportunity zone'; 'Cap rate at least 5.5%'.",
      { requestContext: rc("S-c1") },
    );
    expect(await toolCalls("S-c1", "check-criteria")).toHaveLength(0);
    expect(out.text).toMatch(/opportunity zone/i);
    expect(out.text).toMatch(/which field|no field|not match|doesn't match|does not match|no matching/i);
  });

  it("cases 2 and 3: an absent value is reported Unknown, never estimated", async () => {
    const out = await mastra.getAgent("screeningAgent").generate(
      "CHECK. Deal: D-1001. Confirmed criteria: 'Asking price under $60M' → asking_price < 60000000; 'Cap rate at least 5.5%' → cap_rate >= 5.5.",
      { requestContext: rc("S-c2") },
    );
    expect(await toolCalls("S-c2", "check-criteria")).not.toHaveLength(0);
    expect(out.text).toMatch(/unknown/i);
    expect(out.text).toMatch(/Going-in Cap Rate/);
  });

  it("case 6: an Analyst sees Unknown for the seller reserve", async () => {
    const out = await mastra.getAgent("screeningAgent").generate(
      "CHECK. Deal: D-1001. Confirmed criteria: 'Seller reserve under $57M' → seller_reserve < 57000000.",
      { requestContext: rc("S-c6", "Analyst") },
    );
    expect(out.text).toMatch(/unknown/i);
    expect(out.text).not.toMatch(/56,?000,?000|\$56(\.0)?\s?M/i);
  });

  it("cases 7 and 9: exactly one task per open criterion, never assigned to someone who cannot read the deal", async () => {
    await mastra.getAgent("taskAgent").generate(
      `Deal D-1001. Propose follow-up tasks for these open criteria only:
| Criterion | Field | Deal value | Verdict |
| Cap rate at least 5.5% | Going-in Cap Rate | 5.4 | Fail |
| Clear title, reviewed by legal | (none) | | Unknown |`,
      { requestContext: rc("S-c7") },
    );
    const tasks = (await listProposals({ sessionId: "S-c7" })).filter((p) => p.kind === "task");
    expect(tasks).toHaveLength(2);
    for (const t of tasks) expect(t.payload.assignee?.id).not.toBe("U-4");
  });

  it("case 10: the comparison reports the flag the fixture gives", async () => {
    const out = await mastra.getAgent("comparisonAgent").generate("Compare deal D-1001 with comps.", { requestContext: rc("S-c10") });
    expect(out.text).toMatch(/above range/i);
    expect(out.text).not.toMatch(/below range/i);
  });

  it("case 11: with two comps there are no flags", async () => {
    const out = await mastra.getAgent("comparisonAgent").generate("Compare Lamar Station with comps.", { requestContext: rc("S-c11") });
    expect(out.text).not.toMatch(/above range|below range/i);
  });

  it("cases 12 and 13: the memo quotes only sourced values and is only a proposal", async () => {
    await call(checkCriteriaTool, {
      dealId: "D-1001",
      criteria: [{ criterion: "Cap rate at least 5.5%", fieldKey: "cap_rate", test: { operator: ">=", target: 5.5 } }],
    }, ctx({ agentId: "screening", sessionId: "S-c12" }));
    await call(compareToCompsTool, { dealId: "D-1001" }, ctx({ agentId: "comparison", sessionId: "S-c12" }));

    await mastra.getAgent("memoAgent").generate(
      `Deal D-1001. Draft the decision memo.
Verdict: Cap rate at least 5.5% | Going-in Cap Rate | 5.4 | Fail | Riverside Flats › Going-in Cap Rate
Comparison: price per unit 245,000 is above the comps' range (195,000 to 238,000); price and cap rate are within range.
Proposed tasks: none. The DealLead has not stated a decision.`,
      { requestContext: rc("S-c12") },
    );
    const memos = (await listProposals({ sessionId: "S-c12" })).filter((p) => p.kind === "memo");
    expect(memos).toHaveLength(1);
    expect(memos[0].payload.decision).toBeNull();
    expect(memos[0].payload.figures.length).toBeGreaterThan(0);
    expect(await rows(`SELECT * FROM poc_files`)).toHaveLength(0);
    expect(await rows(`SELECT * FROM poc_approvals`)).toHaveLength(0);
  });

  it("the supervisor parks for confirmation, then checks within the session's record", async () => {
    const supervisor = mastra.getAgent("dealReviewSupervisor");
    const memory = { thread: "S-e2e", resource: "U-1" };
    const user = () => {
      const r = new RequestContext();
      r.set("userId", "U-1");
      r.set("userRole", "DealLead");
      r.set("tenantId", "T-demo");
      return r;
    };

    await supervisor.generate("Screen Riverside Flats: multifamily only, cap rate at least 5.5%.", { memory, requestContext: user() });
    expect(await toolCalls("S-e2e", "check-criteria")).toHaveLength(0);

    await supervisor.generate("Confirmed.", { memory, requestContext: user() });
    expect(await toolCalls("S-e2e", "check-criteria")).not.toHaveLength(0);

    const rec = await sessionRecord("S-e2e");
    expect(rec!.session.user_id).toBe("U-1");
    expect(rec!.session.cost_usd).toBeGreaterThan(0);
    expect(rec!.session.cost_usd).toBeLessThan(1);
    const kinds = rec!.activities.map((a: any) => a.kind);
    expect(kinds).toContain("delegation.start");
    expect(kinds.filter((k: string) => k === "run.end")).toHaveLength(2);
    expect(rec!.activities.filter((a: any) => a.agent_version).every((a: any) => a.agent_version !== "unregistered")).toBe(true);
  });
});
