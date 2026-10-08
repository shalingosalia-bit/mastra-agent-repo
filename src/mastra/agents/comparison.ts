import { Agent } from "@mastra/core/agent";
import { findDealTool } from "../tools/deal-tools";
import { compareToCompsTool } from "../tools/comparison-tools";
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

Never:
- Compare with fewer than three comps, or flag anything when the tool did not compare.
- Estimate a missing value.
- Recommend a price or a decision.`,
  model: MODEL,
  tools: { findDealTool, compareToCompsTool },
});
