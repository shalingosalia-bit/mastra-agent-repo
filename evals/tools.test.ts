import { beforeEach, describe, expect, it } from "vitest";
import { findDeal, readValue } from "../src/mastra/data/fixtures";
import { acceptProposal, dealRecord, listProposals } from "../src/mastra/foundation/proposals";
import { APP_PAGE } from "../src/mastra/foundation/app-page";
import { REVIEW_PAGE } from "../src/mastra/foundation/review-page";
import { resetStore } from "../src/mastra/foundation/store";
import { compareToCompsTool, listCompsTool } from "../src/mastra/tools/comparison-tools";
import { listDealTasksTool, searchDealsTool } from "../src/mastra/tools/deal-tools";
import {
  listSessionProposalsTool, listSessionSourcesTool, proposeDealNoteTool, proposeFieldValueTool, proposeTaskChangeTool, proposeTaskTool,
} from "../src/mastra/tools/proposal-tools";
import { checkCriteriaTool } from "../src/mastra/tools/screening-tools";
import { sessionStatusTool } from "../src/mastra/tools/session-tools";
import { call, ctx } from "./helpers";

// The tools added beyond the first eval cases: reads that widen what each
// specialist can answer, and writes that stay proposals until the DealLead
// accepts them (05 §Authority and Proposals).

const as = (agentId: string, o: Parameters<typeof ctx>[0] = {}) => ctx({ agentId, ...o });

beforeEach(async () => {
  await resetStore();
});

describe("read tools", () => {
  it("search-deals finds deals by market, stage or part of a name", async () => {
    expect((await call(searchDealsTool, { market: "austin" }, as("screening"))).deals.map((d: any) => d.name)).toEqual(["Riverside Flats"]);
    expect((await call(searchDealsTool, { stage: "Screening" }, as("screening"))).count).toBe(2);
    expect((await call(searchDealsTool, { text: "lamar" }, as("screening"))).deals[0].id).toBe("D-1002");
  });

  it("list-comps lists a deal's comps, newest first, as sourced values", async () => {
    const r = await call(listCompsTool, { dealId: "D-1001" }, as("comparison"));
    expect(r.comps.map((c: any) => c.id)).toEqual(["C-204", "C-201", "C-202", "C-203", "C-205"]);
    const recent = await call(listCompsTool, { dealId: "D-1001", soldOnOrAfter: "2026-01-01" }, as("comparison"));
    expect(recent.count).toBe(3);
    const { sources } = await call(listSessionSourcesTool, {}, as("memo"));
    expect(sources).toContainEqual({ label: "Mueller Lofts price per unit", value: "195000", source: "comp: Mueller Lofts › Price per Unit" });
  });

  it("compare-to-comps can use recent comps only, and still needs three", async () => {
    const recent = await call(compareToCompsTool, { dealId: "D-1001", soldOnOrAfter: "2026-01-01" }, as("comparison"));
    expect(recent.compsSource).toBe("comps: 3 Austin Multifamily (sold on or after 2026-01-01)");
    expect(recent.rows.find((r: any) => r.metric === "Price per unit")).toMatchObject({ low: 195_000, high: 220_000, flag: "above range" });

    const tooFew = await call(compareToCompsTool, { dealId: "D-1001", soldOnOrAfter: "2026-03-01" }, as("comparison"));
    expect(tooFew.rows.every((r: any) => !r.compared)).toBe(true);

    const without = await call(compareToCompsTool, { dealId: "D-1001", excludeCompIds: ["C-203"] }, as("comparison"));
    expect(without.rows.find((r: any) => r.metric === "Price per unit").high).toBe(220_000);
  });

  it("list-deal-tasks shows created tasks and open proposals from any session", async () => {
    const a = await call(proposeTaskTool, { dealId: "D-1001", criterion: "Cap rate", title: "Confirm cap rate", assigneeId: "U-2" }, as("task", { sessionId: "S-1" }));
    await acceptProposal(a.proposal.id, "U-1");
    await call(proposeTaskTool, { dealId: "D-1001", criterion: "Asking price", title: "Get asking price", assigneeId: null }, as("task", { sessionId: "S-2" }));

    const r = await call(listDealTasksTool, { dealId: "Riverside Flats" }, as("task", { sessionId: "S-3" }));
    expect(r.workItems).toMatchObject([{ title: "Confirm cap rate", assignee: "Raj Patel" }]);
    expect(r.proposals.map((p: any) => p.status)).toEqual(["accepted", "pending"]);
  });

  it("list-session-proposals and session-status report this session only", async () => {
    await call(proposeTaskTool, { dealId: "D-1001", criterion: "Cap rate", title: "Confirm cap rate", assigneeId: null }, as("task", { sessionId: "S-a" }));
    await call(proposeDealNoteTool, { dealId: "D-1001", note: "Broker call Friday" }, as("task", { sessionId: "S-b" }));

    const mine = await call(listSessionProposalsTool, {}, as("memo", { sessionId: "S-a" }));
    expect(mine.proposals.map((p: any) => p.kind)).toEqual(["task"]);

    const status = await call(sessionStatusTool, {}, as("deal-review", { sessionId: "S-a" }));
    expect(status.proposals.pending).toHaveLength(1);
    expect(status).toMatchObject({ killSwitchEngaged: false, costBoundPerRunUsd: 2 });
  });
});

describe("write tools are proposals", () => {
  it("propose-field-value changes nothing until the DealLead accepts", async () => {
    const r = await call(proposeFieldValueTool,
      { dealId: "D-1001", fieldKey: "asking_price", value: "$61,000,000", source: "The DealLead, from the broker's call" }, as("screening"));
    expect(r).toMatchObject({ created: true, proposal: { status: "pending", value: 61_000_000, previous: null } });
    expect(readValue(findDeal("D-1001")!, "asking_price", "DealLead")).toBeNull();

    await acceptProposal(r.proposal.id, "U-1");
    expect(readValue(findDeal("D-1001")!, "asking_price", "DealLead")).toBe(61_000_000);
    const event = (await dealRecord("D-1001")).events.find((e: any) => e.event === "field.updated");
    expect(event).toMatchObject({ actor_id: "U-1", detail: { fieldKey: "asking_price", previous: null, value: 61_000_000 } });

    // The accepted value is what screening now reads.
    const check = await call(checkCriteriaTool, {
      dealId: "D-1001", criteria: [{ criterion: "Asking under $60M", fieldKey: "asking_price", test: { operator: "<", target: 60_000_000 } }],
    }, as("screening"));
    expect(check.rows[0]).toMatchObject({ value: 61_000_000, verdict: "fail" });
  });

  it("propose-field-value refuses hidden, unknown and ill-typed fields", async () => {
    const hidden = await call(proposeFieldValueTool, { dealId: "D-1001", fieldKey: "seller_reserve", value: 1, source: "x" }, as("screening", { role: "Analyst", userId: "U-2" }));
    expect(hidden).toMatchObject({ created: false });
    const stage = await call(proposeFieldValueTool, { dealId: "D-1001", fieldKey: "stage", value: "Closed", source: "x" }, as("screening"));
    expect(stage).toMatchObject({ created: false });
    const option = await call(proposeFieldValueTool, { dealId: "D-1001", fieldKey: "market", value: "Miami", source: "x" }, as("screening"));
    expect(option.message).toMatch(/must be one of/);
    const same = await call(proposeFieldValueTool, { dealId: "D-1001", fieldKey: "cap_rate", value: "5.4%", source: "x" }, as("screening"));
    expect(same.message).toMatch(/already/);
    expect(await listProposals()).toHaveLength(0);
  });

  it("an agent without the grant cannot propose a field value", async () => {
    const r = await call(proposeFieldValueTool, { dealId: "D-1001", fieldKey: "asking_price", value: 1, source: "x" }, as("comparison"));
    expect(r).toMatchObject({ refused: true });
  });

  it("propose-task-change reassigns or reschedules only after acceptance, and never to a non-reader", async () => {
    const t = await call(proposeTaskTool, { dealId: "D-1001", criterion: "Occupancy", title: "Check rent roll", assigneeId: "U-2" }, as("task"));
    const { proposal } = await acceptProposal(t.proposal.id, "U-1");
    const workItemId = proposal.result!.workItemId;

    const toSam = await call(proposeTaskChangeTool, { dealId: "D-1001", workItemId, assigneeId: "U-4", reason: "Legal" }, as("task"));
    expect(toSam.created).toBe(false);
    const past = await call(proposeTaskChangeTool, { dealId: "D-1001", workItemId, dueDate: "2020-01-01", reason: "x" }, as("task"));
    expect(past.created).toBe(false);

    const change = await call(proposeTaskChangeTool, { dealId: "D-1001", workItemId, assigneeId: "U-3", dueDate: "2099-01-15", reason: "Ana owns occupancy" }, as("task"));
    expect(change.created).toBe(true);
    let [item] = (await call(listDealTasksTool, { dealId: "D-1001" }, as("task"))).workItems;
    expect(item.assignee).toBe("Raj Patel");

    await acceptProposal(change.proposal.id, "U-1");
    [item] = (await call(listDealTasksTool, { dealId: "D-1001" }, as("task"))).workItems;
    expect(item).toMatchObject({ assignee: "Ana Ortiz", dueDate: "2099-01-15" });
  });

  it("propose-deal-note is recorded on the deal only when accepted", async () => {
    const n = await call(proposeDealNoteTool, { dealId: "D-1001", note: "Broker expects best and final by the 20th." }, as("task"));
    expect((await dealRecord("D-1001")).events).toHaveLength(0);
    await acceptProposal(n.proposal.id, "U-1");
    expect((await dealRecord("D-1001")).events[0]).toMatchObject({ event: "note.added", detail: { note: "Broker expects best and final by the 20th." } });
  });

  it("resetting the store restores the fixtures", async () => {
    const r = await call(proposeFieldValueTool, { dealId: "D-1001", fieldKey: "occupancy", value: 95, source: "x" }, as("screening"));
    await acceptProposal(r.proposal.id, "U-1");
    await resetStore();
    expect(readValue(findDeal("D-1001")!, "occupancy", "DealLead")).toBe(93);
  });
});

it.each([["review panel", REVIEW_PAGE], ["deal review app", APP_PAGE]])("the %s's script parses", (_name, page) => {
  const script = page.match(/<script>([\s\S]*)<\/script>/)![1];
  expect(() => new Function(script)).not.toThrow();
});
