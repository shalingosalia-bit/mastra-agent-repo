import { findUser } from "../data/fixtures";
import { DecisionError } from "./proposals";
import { now, rows, run } from "./store";

// The Tenant's saved buy box: criteria in the DealLead's own words. Screening
// "against the buy box" reads these and maps each to a deal field, and the
// DealLead still confirms the mapping before anything is checked. Only a
// DealLead edits it. A must-have criterion that fails asks whether to go on.

export interface BuyBoxCriterion {
  criterion: string;
  mustHave: boolean;
}

export const DEFAULT_BUY_BOX: BuyBoxCriterion[] = [
  { criterion: "Multifamily only", mustHave: true },
  { criterion: "Cap rate at least 5.5%", mustHave: false },
  { criterion: "Asking price under $60M", mustHave: false },
  { criterion: "Seller reserve under $57M", mustHave: false },
];

export async function readBuyBox(tenantId: string): Promise<{ criteria: BuyBoxCriterion[]; updatedBy: string | null; updatedAt: string | null }> {
  const saved = await rows<{ criterion: string; must_have: number; updated_by: string; updated_at: string }>(
    `SELECT criterion, must_have, updated_by, updated_at FROM poc_buy_box WHERE tenant_id = ? ORDER BY position`, [tenantId],
  );
  if (saved.length === 0) return { criteria: DEFAULT_BUY_BOX, updatedBy: null, updatedAt: null };
  return {
    criteria: saved.map((r) => ({ criterion: r.criterion, mustHave: Boolean(r.must_have) })),
    updatedBy: saved[0].updated_by,
    updatedAt: saved[0].updated_at,
  };
}

export async function saveBuyBox(tenantId: string, userId: string, criteria: BuyBoxCriterion[]) {
  const user = findUser(userId);
  if (user?.role !== "DealLead") throw new DecisionError("Only a DealLead can change the buy box.", 403);
  const cleaned = criteria
    .map((c) => ({ criterion: String(c.criterion ?? "").trim(), mustHave: Boolean(c.mustHave) }))
    .filter((c) => c.criterion.length > 0);
  if (cleaned.length === 0) throw new DecisionError("A buy box needs at least one criterion.", 400);
  if (cleaned.length > 25) throw new DecisionError("A buy box holds at most 25 criteria.", 400);
  const t = now();
  await run(`DELETE FROM poc_buy_box WHERE tenant_id = ?`, [tenantId]);
  for (const [i, c] of cleaned.entries()) {
    await run(
      `INSERT INTO poc_buy_box (tenant_id, position, criterion, must_have, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [tenantId, i, c.criterion, c.mustHave ? 1 : 0, userId, t],
    );
  }
  return readBuyBox(tenantId);
}
