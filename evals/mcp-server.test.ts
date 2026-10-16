import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_BUY_BOX } from "../src/mastra/foundation/buy-box";
import { resetStore } from "../src/mastra/foundation/store";
import { dealReviewMcpServer } from "../src/mastra/mcp/deal-review-server";

// The headless surface Claude connects to (card #23). It reads and converses,
// and offers no act that is the DealLead's: accept, reject, resume or submit
// (agentic FR51). No test here calls the model.

beforeEach(async () => {
  await resetStore();
});

describe("the deal review MCP server", () => {
  it("offers the conversation and three reads, and nothing that accepts, rejects, resumes or submits", async () => {
    const { tools } = await dealReviewMcpServer.getToolListInfo();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(["deal_review", "dealpath_connection", "get_buy_box", "list_pending_proposals"]);
    expect(names.filter((n) => /accept|reject|resume|submit|approve/i.test(n))).toEqual([]);
  });

  it("tells Claude to carry the conversation id, so the confirmed mapping is not lost", async () => {
    const info = dealReviewMcpServer.getToolInfo("deal_review");
    expect(info?.description).toMatch(/conversationId/);
  });

  it("reads the saved buy box without the model", async () => {
    const out = await dealReviewMcpServer.getToolInfo("get_buy_box");
    expect(out).toBeDefined();
    const { readBuyBox } = await import("../src/mastra/foundation/buy-box");
    expect((await readBuyBox("T-demo")).criteria).toEqual(DEFAULT_BUY_BOX);
  });
});
