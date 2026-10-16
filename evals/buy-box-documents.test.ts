import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { deals, findDeal, readValue } from "../src/mastra/data/fixtures";
import { normalize } from "../src/mastra/data/dealpath/deals";
import { DEFAULT_BUY_BOX, readBuyBox, saveBuyBox } from "../src/mastra/foundation/buy-box";
import { listUploads, saveUpload } from "../src/mastra/foundation/documents";
import { resetStore } from "../src/mastra/foundation/store";
import { findDealTool } from "../src/mastra/tools/deal-tools";
import { readBuyBoxTool, readDocumentTool } from "../src/mastra/tools/document-tools";
import { checkCriteriaTool } from "../src/mastra/tools/screening-tools";
import { call, ctx } from "./helpers";

// The saved buy box, Dealpath deals and uploaded OMs. No test reaches Dealpath:
// a Dealpath deal is placed in the deal table as data/dealpath/deals.ts would.

beforeAll(() => {
  process.env.DEALPATH_OAUTH_FILE = join(tmpdir(), `no-dealpath-${process.pid}.json`);
  process.env.POC_UPLOAD_DIR = join(tmpdir(), `poc-uploads-${process.pid}`);
});

beforeEach(async () => {
  await resetStore();
});

describe("the saved buy box", () => {
  it("starts as the four Riverside criteria, property type a must-have", async () => {
    const box = await readBuyBox("T-demo");
    expect(box.criteria).toEqual(DEFAULT_BUY_BOX);
    expect(box.criteria.filter((c) => c.mustHave).map((c) => c.criterion)).toEqual(["Multifamily only"]);
  });

  it("a DealLead adds a criterion, and the screening agent reads it back", async () => {
    await saveBuyBox("T-demo", "U-1", [...DEFAULT_BUY_BOX, { criterion: "Occupancy at least 90%", mustHave: false }]);
    const read = await call(readBuyBoxTool, {}, ctx({ agentId: "screening" }));
    expect(read.criteria.map((c: any) => c.criterion)).toContain("Occupancy at least 90%");
    expect(read.savedBy).toBe("U-1");
  });

  it("only a DealLead can change it, and an empty box is refused", async () => {
    await expect(saveBuyBox("T-demo", "U-2", DEFAULT_BUY_BOX)).rejects.toThrow(/Only a DealLead/);
    await expect(saveBuyBox("T-demo", "U-1", [{ criterion: "  ", mustHave: false }])).rejects.toThrow(/at least one/);
  });

  it("an agent without the grant cannot read it", async () => {
    const refused = await call(readBuyBoxTool, {}, ctx({ agentId: "memo" }));
    expect(refused.refused).toBe(true);
  });
});

describe("Dealpath values", () => {
  it("reads Dealpath's formatted values as numbers, and an empty list as no value", () => {
    expect(normalize("$4721126")).toEqual({ value: 4721126, type: "currency" });
    expect(normalize("100.0%")).toEqual({ value: 100, type: "percent" });
    expect(normalize("499590 sqft")).toEqual({ value: 499590, type: "number" });
    expect(normalize([])).toEqual({ value: null, type: "option" });
    expect(normalize("Industrial")).toEqual({ value: "Industrial", type: "text" });
  });

  it("checks a Dealpath deal's fields by their Dealpath names, citing Dealpath", async () => {
    deals.push({
      id: "DP-22830395", name: "Shady Grove Logistics Crossing Bldg A - Acquisition", stage: "Prelim Review",
      fields: { "Property Type": "Industrial", "Occupancy (%)": 100 },
      origin: { system: "dealpath", id: 22830395 },
      fieldDefs: [
        { key: "Property Type", label: "Property Type", type: "text" },
        { key: "Occupancy (%)", label: "Occupancy (%)", type: "percent" },
      ],
    });
    const out = await call(checkCriteriaTool, {
      dealId: "DP-22830395",
      criteria: [
        { criterion: "Multifamily only", fieldKey: "Property Type", test: { operator: "=", target: "Multifamily" } },
        { criterion: "Occupancy at least 90%", fieldKey: "Occupancy (%)", test: { operator: ">=", target: 90 } },
      ],
    }, ctx({ agentId: "screening" }));
    expect(out.rows.map((r: any) => r.verdict)).toEqual(["fail", "pass"]);
    expect(out.rows[1].source).toBe("Dealpath › Shady Grove Logistics Crossing Bldg A - Acquisition › Occupancy (%)");
    expect(readValue(findDeal("DP-22830395")!, "occupancy (%)", "Analyst")).toBe(100);
  });

  it("says Dealpath is not connected rather than guessing a deal", async () => {
    const out = await call(findDealTool, { query: "Shady Grove" }, ctx({ agentId: "screening" }));
    expect(out.found).toBe(false);
    expect(out.message).toMatch(/Dealpath is not connected/);
  });
});

describe("uploaded OMs", () => {
  it("refuses a file that is not a PDF", async () => {
    await expect(saveUpload("T-demo", "U-1", "om.txt", Buffer.from("hello").toString("base64"))).rejects.toThrow(/Only PDF/);
    expect(await listUploads("T-demo")).toEqual([]);
  });

  it("an unknown document id is a plain answer, not a crash", async () => {
    const out = await call(readDocumentTool, { documentId: "DOC-NOPE" }, ctx({ agentId: "screening" }));
    expect(out).toEqual({ found: false, message: "No document DOC-NOPE." });
  });
});
