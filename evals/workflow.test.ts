import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { RequestContext } from "@mastra/core/request-context";
import { LibSQLStore } from "@mastra/libsql";
import { beforeEach, describe, expect, it } from "vitest";
import { sessionRecord } from "../src/mastra/foundation/sessions";
import { resetStore } from "../src/mastra/foundation/store";
import { dealScreeningWorkflow } from "../src/mastra/workflows/deal-screening";

// The deal-screening workflow's guarantees, whatever the model maps: nothing is
// checked before the DealLead resumes, a field the model names must exist and be
// readable, and verdicts come from the tool. A stub stands in for the screening
// specialist so these run without a model.

type Mapped = { criterion: string; fieldKey: string | null; operator: string | null; target: unknown; question?: string | null };

function stubScreening(mapped: Mapped[]) {
  const agent = new Agent({ id: "screening", name: "Screening stub", instructions: "stub", model: "anthropic/claude-sonnet-5-5" });
  (agent as any).generate = async () => ({
    object: {
      dealId: "D-1001", dealName: "Riverside Flats",
      criteria: mapped.map((m) => ({ fieldLabel: null, question: null, ...m })),
    },
  });
  return agent;
}

function setup(mapped: Mapped[]) {
  const mastra = new Mastra({
    agents: { screeningAgent: stubScreening(mapped) },
    workflows: { dealScreeningWorkflow },
    storage: new LibSQLStore({ id: "wf-test", url: ":memory:" }),
    logger: false,
  });
  return mastra.getWorkflow("dealScreeningWorkflow");
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
const input = { deal: "Riverside Flats", criteria: riverside.map((c) => c.criterion) };

async function checks(sessionId: string) {
  const rec = await sessionRecord(sessionId);
  return (rec?.activities ?? []).filter((a: any) => a.kind === "tool.call" && a.detail.tool === "check-criteria");
}

beforeEach(async () => {
  await resetStore();
});

describe("deal-screening workflow", () => {
  it("suspends after mapping and checks nothing until the DealLead resumes", async () => {
    const run = await setup(riverside).createRun();
    const res: any = await run.start({ inputData: input, requestContext: rc() });

    expect(res.status).toBe("suspended");
    const shown = res.steps["confirm-mapping"].suspendPayload;
    expect(shown.criteria.map((c: any) => c.fieldLabel)).toEqual(["Property Type", "Going-in Cap Rate", "Asking Price", "Seller Reserve Price"]);
    expect(await checks(run.runId)).toHaveLength(0);

    const done: any = await run.resume({ step: "confirm-mapping", resumeData: { confirmed: true }, requestContext: rc() });
    expect(done.status).toBe("success");
    expect(done.result.rows.map((r: any) => [r.verdict, r.value])).toEqual([
      ["pass", "Multifamily"], ["fail", 5.4], ["unknown", null], ["pass", 56_000_000],
    ]);
    expect(done.result.rows[1].source).toBe("Riverside Flats › Going-in Cap Rate");
    expect(await checks(run.runId)).toHaveLength(1);
  });

  it("stops without checking when the DealLead does not confirm", async () => {
    const run = await setup(riverside).createRun();
    await run.start({ inputData: input, requestContext: rc() });
    const done: any = await run.resume({ step: "confirm-mapping", resumeData: { confirmed: false }, requestContext: rc() });
    expect(done.status).toBe("success");
    expect(await checks(run.runId)).toHaveLength(0);
  });

  it("applies the DealLead's corrections before checking", async () => {
    const run = await setup([{ criterion: "Price under $60M", fieldKey: "asking_price", operator: "<", target: 60_000_000 }]).createRun();
    await run.start({ inputData: { deal: "Riverside Flats", criteria: ["Price under $60M"] }, requestContext: rc() });
    const done: any = await run.resume({
      step: "confirm-mapping",
      resumeData: { confirmed: true, corrections: [{ criterion: "Price under $60M", fieldKey: "purchase_price", test: { operator: "<", target: 60_000_000 } }] },
      requestContext: rc(),
    });
    expect(done.result.rows[0]).toMatchObject({ field: "Purchase Price", value: 58_800_000, verdict: "pass" });
  });

  it("turns a field that does not exist into a question, never a guess", async () => {
    const run = await setup([
      { criterion: "In an opportunity zone", fieldKey: "opportunity_zone", operator: "=", target: "Yes" },
      { criterion: "Cap rate at least 5.5%", fieldKey: "cap_rate", operator: ">=", target: 5.5 },
    ]).createRun();
    const res: any = await run.start({ inputData: { deal: "D-1001", criteria: ["In an opportunity zone", "Cap rate at least 5.5%"] }, requestContext: rc() });
    const shown = res.steps["confirm-mapping"].suspendPayload;
    expect(shown.criteria[0]).toMatchObject({ fieldKey: null, question: expect.stringMatching(/Which field/) });

    const done: any = await run.resume({ step: "confirm-mapping", resumeData: { confirmed: true }, requestContext: rc() });
    expect(done.result.rows).toHaveLength(1);
    expect(done.result.unresolved).toEqual(["In an opportunity zone"]);
  });

  it("does not map an Analyst's criterion to a field they cannot read", async () => {
    const run = await setup([riverside[3]]).createRun();
    const res: any = await run.start({ inputData: { deal: "Riverside Flats", criteria: [riverside[3].criterion] }, requestContext: rc("Analyst") });
    expect(res.steps["confirm-mapping"].suspendPayload.criteria[0].fieldKey).toBeNull();
    expect(JSON.stringify(res)).not.toMatch(/56000000/);
  });
});
