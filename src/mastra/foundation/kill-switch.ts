import { recordActivity, setSessionStatus } from "./sessions";
import { now, one, run } from "./store";

// One kill switch per Tenant (DSN4). Engaging it aborts every running agent
// session in the Tenant at once, and every tool and delegation refuses while it
// stays engaged.

const running = new Map<string, Set<{ sessionId?: string; controller: AbortController }>>();

export function trackRun(tenantId: string, entry: { sessionId?: string; controller: AbortController }) {
  if (!running.has(tenantId)) running.set(tenantId, new Set());
  running.get(tenantId)!.add(entry);
  return () => running.get(tenantId)?.delete(entry);
}

export async function isKilled(tenantId: string): Promise<boolean> {
  const row = await one<{ engaged: number }>(`SELECT engaged FROM poc_kill_switches WHERE tenant_id = ?`, [tenantId]);
  return Boolean(row?.engaged);
}

export async function setKillSwitch(tenantId: string, engaged: boolean, by: string) {
  await run(
    `INSERT INTO poc_kill_switches (tenant_id, engaged, changed_by, changed_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(tenant_id) DO UPDATE SET engaged = excluded.engaged, changed_by = excluded.changed_by, changed_at = excluded.changed_at`,
    [tenantId, engaged ? 1 : 0, by, now()],
  );
  if (!engaged) return { stopped: 0 };

  const entries = [...(running.get(tenantId) ?? [])];
  for (const entry of entries) {
    entry.controller.abort(new Error(`Kill switch engaged for ${tenantId} by ${by}`));
    if (entry.sessionId) {
      await recordActivity({
        sessionId: entry.sessionId, actorType: "system", actorId: "kill-switch",
        kind: "session.killed", detail: { tenantId, by },
      });
      await setSessionStatus(entry.sessionId, "ended", "killed");
    }
  }
  running.delete(tenantId);
  return { stopped: entries.length };
}
