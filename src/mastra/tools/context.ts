import type { Role } from "../data/fixtures";
import type { Actor } from "../foundation/sessions";

// Who is acting comes from the request context, so an Analyst sees what the deal
// page shows an Analyst (eval case 6). Playground defaults: Dana Kim, DealLead,
// in the demo Tenant.

type Ctx = {
  requestContext?: { get(key: string): unknown };
  agent?: { agentId?: string; threadId?: string };
} | undefined;

export const DEFAULT_TENANT = "T-demo";

export function roleFrom(context: Ctx): Role {
  const role = context?.requestContext?.get("userRole");
  return role === "Analyst" ? "Analyst" : "DealLead";
}

export function actorFrom(context: Ctx): Actor {
  const rc = context?.requestContext;
  return {
    tenantId: String(rc?.get("tenantId") ?? DEFAULT_TENANT),
    userId: String(rc?.get("userId") ?? "U-1"),
    role: roleFrom(context),
  };
}

// The supervisor's thread is the session. The supervisor puts its id on the
// request context it hands each specialist; a specialist run on its own uses
// its own thread.
export function sessionIdFrom(context: Ctx): string {
  const fromSupervisor = context?.requestContext?.get("sessionId");
  if (typeof fromSupervisor === "string") return fromSupervisor;
  return context?.agent?.threadId ?? "adhoc";
}

export function agentIdFrom(context: Ctx): string | undefined {
  return context?.agent?.agentId;
}
