import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { RequestContext } from "@mastra/core/request-context";
import { LibSQLStore } from "@mastra/libsql";
import { beforeEach, describe, expect, it } from "vitest";
import { sessionRecord } from "../src/mastra/foundation/sessions";
import { resetStore } from "../src/mastra/foundation/store";
import { dealReviewWorkflow } from "../src/mastra/workflows/deal-review";

// The deal-review workflow's screening guarantees, whatever the model maps: nothing is
// checked before the DealLead resumes, a field the model names must exist and be
// readable, and verdicts come from the tool. A stub stands in for the screening
// specialist so these run without a model.

type Mapped = { criterion: string; fieldKey: string | null; operator: string | null; target: unknown; question?: string | null };
type Reply = { proceed: boolean; corrections?: { criterion: string; fieldKey: string; test: { operator: string; target: unknown } }[] };

// Answers RESOLVE with the given mapping and INTERPRET with the given reading of
// the DealLead's reply, as the screening specialist's structured output would.
function stubScreening(mapped: Mapped[], reply: Reply, deal = "Riverside Flats") {
  const agent = new Agent({ id: "screening", name: "Screening stub", instructions: "stub", model: "anthropic/claude-sonnet-5-5" });
  (agent as any).generate = async (prompt: string) => prompt.startsWith("INTERPRET")
    ? { object: { corrections: [], ...reply } }
    : { object: { deal, criteria: mapped.map((m) => ({ fieldLabel: null, question: null, ...m })) } };
  return agent;
}

function setup(mapped: Mapped[], reply: Reply = { proceed: true }, deal?: string) {
  const mastra = new Mastra({
    agents: { screeningAgent: stubScreening(mapped, reply, deal) },
    workflows: { dealReviewWorkflow },
    storage: new LibSQLStore({ id: "wf-test", url: ":memory:" }),
    logger: false,
  });
  return mastra.getWorkflow("dealReviewWorkflow");
}

function rc(role: "DealLead" | "Analyst" = "DealLead") {
  const r = new RequestContext();
  r.set("userRole", role);
  r.set("userId", role === "Analyst" ? "U-2" : "U-1");
  r.set("tenantId", "T-demo");
  return r;
}

const riverside = [
  { criterion: "Multifamily only", fieldKey: "property_type", operator: "=", target: "Multifamily" },
  { criterion: "Cap rate at least 5.5%", fieldKey: "cap_rate", operator: ">=", target: 5.5 },
  { criterion: "Asking price under $60M", fieldKey: "asking_price", operator: "<", target: 60_000_000 },
  { criterion: "Seller reserve under $57M", fieldKey: "seller_reserve", operator: "<", target: 57_000_000 },
];
const input = { request: "Screen Riverside Flats: multifamily only, cap rate at least 5.5%, asking under 60M, seller reserve under 57M." };

async function checks(sessionId: string) {
  const rec = await sessionRecord(sessionId);
  return (rec?.activities ?? []).filter((a: any) => a.kind === "tool.call" && a.detail.tool === "check-criteria");
}

beforeEach(async () => {
  await resetStore();
});

// What the check step returned; after it the run pauses again for what's next.
const checked = (res: any) => res.steps["check-criteria"].output;

describe("deal-review workflow: screening", () => {
  it("suspends after mapping and checks nothing until the DealLead replies", async () => {
    const run = await setup(riverside).createRun();
    const res: any = await run.start({ inputData: input, requestContext: rc() });

    expect(res.status).toBe("suspended");
    const shown = res.steps["confirm-mapping"].suspendPayload;
    expect(shown.criteria.map((c: any) => c.fieldLabel)).toEqual(["Property Type", "Going-in Cap Rate", "Asking Price", "Seller Reserve Price"]);
    expect(shown.message).toMatch(/Nothing is checked until you reply/);
    expect(await checks(run.runId)).toHaveLength(0);

    const done: any = await run.resume({ step: "confirm-mapping", resumeData: { reply: "Looks good, go ahead." }, requestContext: rc() });
    expect(done.status).toBe("suspended");
    expect(checked(done).rows.map((r: any) => [r.verdict, r.value])).toEqual([
      ["pass", "Multifamily"], ["fail", 5.4], ["unknown", null], ["pass", 56_000_000],
    ]);
    expect(checked(done).rows[1].source).toBe("Riverside Flats › Going-in Cap Rate");
    expect(await checks(run.runId)).toHaveLength(1);
  });

  it("stops without checking when the DealLead says stop", async () => {
    const run = await setup(riverside, { proceed: false }).createRun();
    await run.start({ inputData: input, requestContext: rc() });
    const done: any = await run.resume({ step: "confirm-mapping", resumeData: { reply: "Actually, hold off." }, requestContext: rc() });
    expect(done.status).toBe("success");
    expect(checked(done)).toMatchObject({ rows: [], note: expect.stringMatching(/Nothing was checked/) });
    expect(await checks(run.runId)).toHaveLength(0);
  });

  it("applies the DealLead's corrections before checking", async () => {
    const fix = { criterion: "Price under $60M", fieldKey: "purchase_price", test: { operator: "<", target: 60_000_000 } };
    const run = await setup([{ criterion: "Price under $60M", fieldKey: "asking_price", operator: "<", target: 60_000_000 }], { proceed: true, corrections: [fix] }).createRun();
    await run.start({ inputData: { request: "Screen Riverside Flats, price under 60M." }, requestContext: rc() });
    const done: any = await run.resume({ step: "confirm-mapping", resumeData: { reply: "Price means purchase price. Go ahead." }, requestContext: rc() });
    expect(checked(done).rows[0]).toMatchObject({ field: "Purchase Price", value: 58_800_000, verdict: "pass" });
  });

  it("ignores a correction to a field that does not exist", async () => {
    const bad = { criterion: "Cap rate at least 5.5%", fieldKey: "made_up_field", test: { operator: ">=", target: 5.5 } };
    const run = await setup([riverside[1]], { proceed: true, corrections: [bad] }).createRun();
    await run.start({ inputData: { request: "Screen Riverside Flats, cap rate at least 5.5%." }, requestContext: rc() });
    const done: any = await run.resume({ step: "confirm-mapping", resumeData: { reply: "Use the made up field." }, requestContext: rc() });
    expect(checked(done).rows[0]).toMatchObject({ field: "Going-in Cap Rate", verdict: "fail" });
  });

  it("turns a field that does not exist into a question, never a guess", async () => {
    const run = await setup([
      { criterion: "In an opportunity zone", fieldKey: "opportunity_zone", operator: "=", target: "Yes" },
      { criterion: "Cap rate at least 5.5%", fieldKey: "cap_rate", operator: ">=", target: 5.5 },
    ], { proceed: true }, "D-1001").createRun();
    const res: any = await run.start({ inputData: { request: "Screen D-1001: in an opportunity zone, cap rate at least 5.5%." }, requestContext: rc() });
    const shown = res.steps["confirm-mapping"].suspendPayload;
    expect(shown.criteria[0]).toMatchObject({ fieldKey: null, question: expect.stringMatching(/Which field/) });

    const done: any = await run.resume({ step: "confirm-mapping", resumeData: { reply: "Fine, check what you can." }, requestContext: rc() });
    expect(checked(done).rows).toHaveLength(1);
    expect(checked(done).unresolved).toEqual(["In an opportunity zone"]);
  });

  it("does not map an Analyst's criterion to a field they cannot read", async () => {
    const run = await setup([riverside[3]]).createRun();
    const res: any = await run.start({ inputData: { request: "Screen Riverside Flats, seller reserve under 57M." }, requestContext: rc("Analyst") });
    expect(res.steps["confirm-mapping"].suspendPayload.criteria[0].fieldKey).toBeNull();
    expect(JSON.stringify(res)).not.toMatch(/56000000/);
  });

  it("fails clearly when the request names no known deal", async () => {
    const run = await setup(riverside, { proceed: true }, "Maple Court").createRun();
    const res: any = await run.start({ inputData: { request: "Screen Maple Court, multifamily only." }, requestContext: rc() });
    expect(res.status).toBe("failed");
    expect(JSON.stringify(res.error ?? res)).toMatch(/No deal matches/);
  });
});
