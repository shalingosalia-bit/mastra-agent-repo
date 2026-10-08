import type { Role } from "../data/fixtures";

// The agent registry (A2, A21): every agent the POC runs, versioned, with the
// grants it holds. A session records the version that acted, and a tool runs
// only if both the agent and the User hold its grant (A5).

export type Grant =
  | "deal.read"
  | "fields.read"
  | "comps.read"
  | "team.read"
  | "session.read"
  | "propose.task"
  | "propose.memo";

export interface AgentEntry {
  id: string;
  version: string;
  pillar: "Pipeline" | "Analysis" | "Audit and Decisions" | "Foundation";
  pod: string;
  grants: Grant[];
  // A POC stand-in for an agent another POD is specifying.
  standIn?: string;
}

export const registry: Record<string, AgentEntry> = {
  "deal-review": { id: "deal-review", version: "0.2.0", pillar: "Foundation", pod: "AI Platform", grants: [] },
  screening: {
    id: "screening", version: "0.2.0", pillar: "Pipeline", pod: "Connect & Pipeline",
    grants: ["deal.read", "fields.read"],
  },
  comparison: {
    id: "comparison", version: "0.2.0", pillar: "Analysis", pod: "Deal & Portfolio",
    grants: ["deal.read", "comps.read"],
  },
  task: {
    id: "task", version: "0.2.0", pillar: "Audit and Decisions", pod: "Workflow & Collaboration",
    grants: ["deal.read", "team.read", "propose.task"], standIn: "Henderson Beck's task agent",
  },
  memo: {
    id: "memo", version: "0.2.0", pillar: "Audit and Decisions", pod: "Workflow & Collaboration",
    grants: ["session.read", "propose.memo"], standIn: "Henderson Beck's memo agent",
  },
};

// What each role may do on a deal, as the deal page allows it. Accepting a
// proposal is a person's act and is never granted to an agent.
export const roleGrants: Record<Role, (Grant | "proposal.accept")[]> = {
  DealLead: ["deal.read", "fields.read", "comps.read", "team.read", "session.read", "propose.task", "propose.memo", "proposal.accept"],
  Analyst: ["deal.read", "fields.read", "comps.read", "team.read", "session.read", "propose.task", "propose.memo"],
};

export function versionOf(agentId: string): string {
  return registry[agentId]?.version ?? "unregistered";
}
