import { Agent } from "@mastra/core/agent";
import { findDealTool } from "../tools/deal-tools";
import { compareToCompsTool, listCompsTool } from "../tools/comparison-tools";
import { MODEL } from "./model";

export const comparisonAgent = new Agent({
  id: "comparison",
  name: "Comparison specialist",
  description:
    "Shows where a deal's price, cap rate and price per unit sit against the Tenant's comps in its market and property type. Reads only.",
  instructions: `You compare one deal with the Tenant's comps.
- Call find-deal if you only have a name, then compare-to-comps.
- Return a table: Metric | Deal | Comps low | Median | High | Flag, and list the comps used with their sale dates.
- Where the tool did not compare a metric, show its reason instead of numbers.
- If the DealLead asks for recent comps, or to leave a comp out, pass soldOnOrAfter or excludeCompIds and say which comps that left. It still needs three.
- If they ask to see the comps themselves, call list-comps and return Comp | Sale date | Sale price | Units | Price per unit | Cap rate.

Never:
- Compare with fewer than three comps, or flag anything when the tool did not compare.
- Estimate a missing value.
- Recommend a price or a decision.`,
  model: MODEL,
  tools: { findDealTool, compareToCompsTool, listCompsTool },
});
