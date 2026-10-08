import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { comps, dealFields, findDeal, readValue } from "../data/fixtures";
import { authorize } from "../foundation/guard";
import { recordSources, type Sourced } from "../foundation/sessions";

const MIN_COMPS = 3;

const metrics = [
  { dealKey: "purchase_price", compKey: "sale_price", label: "Price" },
  { dealKey: "cap_rate", compKey: "cap_rate", label: "Cap rate" },
  { dealKey: "price_per_unit", compKey: "price_per_unit", label: "Price per unit" },
] as const;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// The arithmetic lives here, not in the model: the agent explains the result.
export const compareToCompsTool = createTool({
  id: "compare-to-comps",
  description:
    "Place a deal's price, cap rate and price per unit against the Tenant's comps in the same market and property type. Returns low, median, high, a flag when outside the range, and the comps used. Refuses with fewer than three comps.",
  inputSchema: z.object({ dealId: z.string() }),
  execute: async ({ dealId }, context) => {
    const auth = await authorize("compare-to-comps", "comps.read", context);
    if (!auth.ok) return auth;
    const role = auth.actor.role;
    const deal = findDeal(dealId);
    if (!deal) return { found: false as const, message: `No deal ${dealId}.` };
    const market = readValue(deal, "market", role);
    const type = readValue(deal, "property_type", role);
    const matching = comps.filter((c) => c.market === market && c.property_type === type);

    const rows = metrics.map(({ dealKey, compKey, label }) => {
      const dealValue = readValue(deal, dealKey, role);
      const values = matching.map((c) => c[compKey]).filter((v): v is number => typeof v === "number");
      if (values.length < MIN_COMPS) {
        return { metric: label, dealValue, compared: false as const, reason: `Only ${values.length} comps with this value; at least ${MIN_COMPS} needed` };
      }
      if (dealValue === null) {
        return { metric: label, dealValue, compared: false as const, reason: "The deal has no value for this" };
      }
      const low = Math.min(...values), high = Math.max(...values);
      const v = Number(dealValue);
      const flag = v < low ? "below range" : v > high ? "above range" : null;
      return { metric: label, dealValue: v, compared: true as const, low, median: median(values), high, flag, compCount: values.length };
    });

    // The deal's values and the comps' range become sourced values the memo may quote.
    const compsSource = `comps: ${matching.length} ${market} ${type}`;
    const sourced: Sourced[] = rows.flatMap((r, i): Sourced[] => {
      const fieldLabel = dealFields.find((f) => f.key === metrics[i].dealKey)?.label ?? r.metric;
      const dealValue: Sourced[] = r.dealValue === null ? [] : [{ label: fieldLabel, value: r.dealValue, source: `${deal.name} › ${fieldLabel}` }];
      if (!r.compared) return dealValue;
      return [
        ...dealValue,
        { label: `${r.metric}, comps low`, value: r.low, source: `${compsSource} › ${r.metric} low` },
        { label: `${r.metric}, comps median`, value: r.median, source: `${compsSource} › ${r.metric} median` },
        { label: `${r.metric}, comps high`, value: r.high, source: `${compsSource} › ${r.metric} high` },
      ];
    });
    await recordSources(auth.sessionId, sourced);

    return {
      found: true as const,
      deal: deal.name,
      compsSource,
      market,
      propertyType: type,
      compsUsed: matching.map(({ id, name, sale_date }) => ({ id, name, saleDate: sale_date })),
      rows,
    };
  },
});
