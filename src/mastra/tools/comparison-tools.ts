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
    "Place a deal's price, cap rate and price per unit against the Tenant's comps in the same market and property type. Returns low, median, high, a flag when outside the range, and the comps used. Optionally only comps sold on or after a date, or without some comps. Refuses with fewer than three comps.",
  inputSchema: z.object({
    dealId: z.string(),
    soldOnOrAfter: z.string().optional().describe("Only comps sold on or after this date, YYYY-MM-DD, when the DealLead asks for recent comps"),
    excludeCompIds: z.array(z.string()).optional().describe("Comp ids the DealLead asked to leave out"),
  }),
  execute: async ({ dealId, soldOnOrAfter, excludeCompIds }, context) => {
    const auth = await authorize("compare-to-comps", "comps.read", context);
    if (!auth.ok) return auth;
    const role = auth.actor.role;
    const deal = findDeal(dealId);
    if (!deal) return { found: false as const, message: `No deal ${dealId}.` };
    const market = readValue(deal, "market", role);
    const type = readValue(deal, "property_type", role);
    const excluded = new Set(excludeCompIds ?? []);
    const matching = comps.filter((c) => c.market === market && c.property_type === type
      && (!soldOnOrAfter || c.sale_date >= soldOnOrAfter) && !excluded.has(c.id));

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
    const filters = [soldOnOrAfter && `sold on or after ${soldOnOrAfter}`, excluded.size && `excluding ${[...excluded].join(", ")}`].filter(Boolean);
    const compsSource = `comps: ${matching.length} ${market} ${type}${filters.length ? ` (${filters.join("; ")})` : ""}`;
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

export const listCompsTool = createTool({
  id: "list-comps",
  description:
    "List the Tenant's comps with their sale price, units, price per unit, cap rate and sale date. Filter by market, property type and sale date, or pass a deal id to list the comps in its market and property type. Values listed become sourced, so a memo may quote them.",
  inputSchema: z.object({
    dealId: z.string().optional().describe("List the comps matching this deal's market and property type"),
    market: z.string().optional(),
    propertyType: z.string().optional(),
    soldOnOrAfter: z.string().optional().describe("YYYY-MM-DD"),
  }),
  execute: async ({ dealId, market, propertyType, soldOnOrAfter }, context) => {
    const auth = await authorize("list-comps", "comps.read", context);
    if (!auth.ok) return auth;
    let m = market, t = propertyType;
    if (dealId) {
      const deal = findDeal(dealId);
      if (!deal) return { found: false as const, message: `No deal ${dealId}.` };
      m ??= String(readValue(deal, "market", auth.actor.role) ?? "");
      t ??= String(readValue(deal, "property_type", auth.actor.role) ?? "");
    }
    const is = (a: string, b?: string) => !b || a.toLowerCase() === b.trim().toLowerCase();
    const listed = comps
      .filter((c) => is(c.market, m) && is(c.property_type, t) && (!soldOnOrAfter || c.sale_date >= soldOnOrAfter))
      .sort((a, b) => b.sale_date.localeCompare(a.sale_date));

    await recordSources(auth.sessionId, listed.flatMap((c): Sourced[] => [
      { label: `${c.name} sale price`, value: c.sale_price, source: `comp: ${c.name} › Sale Price` },
      { label: `${c.name} cap rate`, value: c.cap_rate, source: `comp: ${c.name} › Cap Rate` },
      ...(c.price_per_unit === null ? [] : [{ label: `${c.name} price per unit`, value: c.price_per_unit, source: `comp: ${c.name} › Price per Unit` }]),
    ]));

    return {
      found: true as const,
      count: listed.length,
      comps: listed.map((c) => ({
        id: c.id, name: c.name, market: c.market, propertyType: c.property_type, salePrice: c.sale_price,
        units: c.units, pricePerUnit: c.price_per_unit, capRate: c.cap_rate, saleDate: c.sale_date,
      })),
    };
  },
});
