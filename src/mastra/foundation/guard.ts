import { actorFrom, agentIdFrom, sessionIdFrom } from "../tools/context";
import { isKilled } from "./kill-switch";
import { registry, roleGrants, versionOf, type Grant } from "./registry";
import { ensureSession, recordActivity, type Actor } from "./sessions";

// Every tool call passes through here first. It runs only if the Tenant's kill
// switch is off and both the User and the calling agent hold the grant (A5),
// and it is recorded on the session either way.

type ToolCtx = Parameters<typeof actorFrom>[0];

export type Authorized = { ok: true; actor: Actor; agentId: string; agentVersion: string; sessionId: string };
export type Refused = { ok: false; refused: true; message: string };

export async function authorize(toolId: string, grant: Grant, context: ToolCtx): Promise<Authorized | Refused> {
  const actor = actorFrom(context);
  const sessionId = sessionIdFrom(context);
  const agentId = agentIdFrom(context) ?? "direct";
  const agentVersion = versionOf(agentId);
  await ensureSession(sessionId, actor);

  let reason: string | undefined;
  if (await isKilled(actor.tenantId)) {
    reason = `Agents are stopped in ${actor.tenantId}: the kill switch is engaged.`;
  } else if (!roleGrants[actor.role].includes(grant)) {
    reason = `A ${actor.role} cannot ${grant}.`;
  } else if (agentId !== "direct" && !registry[agentId]?.grants.includes(grant)) {
    reason = `The ${agentId} agent is not allowed to ${grant}.`;
  }

  await recordActivity({
    sessionId, actorType: "agent", actorId: agentId, agentVersion,
    kind: reason ? "tool.refused" : "tool.call",
    detail: { tool: toolId, grant, userId: actor.userId, role: actor.role, ...(reason ? { reason } : {}) },
  });

  if (reason) return { ok: false, refused: true, message: reason };
  return { ok: true, actor, agentId, agentVersion, sessionId };
}
