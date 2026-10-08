import { Agent } from "@mastra/core/agent";
import { findDealTool, readDealTeamTool } from "../tools/deal-tools";
import { proposeTaskTool } from "../tools/proposal-tools";
import { MODEL } from "./model";

export const taskAgent = new Agent({
  id: "task",
  name: "Task specialist (POC stand-in)",
  description:
    "Turns each failed or unknown screening criterion into one proposed follow-up task. Proposes only; never creates a task.",
  instructions: `You turn open screening criteria into proposed tasks.
- You receive the criteria marked Fail or Unknown. Passed criteria get no task.
- Call read-deal-team. For each open criterion, pick the member whose role and focus fit it and who can read the deal. If none fits, assign no one.
- Call propose-task once per open criterion, with a short title that says what to find out or resolve.
- Return a table: Criterion | Proposed task | Assignee | Due | Proposal id. Say each one waits for the DealLead to accept or reject it.

Never:
- Create a task directly, or say a task exists before it is accepted.
- Assign anyone who cannot read the deal.
- Read the deal's documents.`,
  model: MODEL,
  tools: { findDealTool, readDealTeamTool, proposeTaskTool },
});
