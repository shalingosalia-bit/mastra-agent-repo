import type { Role } from "../data/fixtures";
import { now, one, rows, run } from "./store";

// One session per deal review: who acted, which agent version, at what cost,
// and how it ended. A session spans the DealLead's turns; each turn is a run.

export interface Actor {
  tenantId: string;
  userId: string;
  role: Role;
}

export interface SessionRow {
  id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  status: "active" | "parked" | "ended";
  started_at: string;
  updated_at: string;
  cost_usd: number;
  tokens: number;
  outcome: string | null;
}

export async function ensureSession(id: string, actor: Actor) {
  const t = now();
  await run(
    `INSERT INTO poc_sessions (id, tenant_id, user_id, role, status, started_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?)
     ON CONFLICT(id) DO UPDATE SET status = CASE WHEN status = 'ended' THEN status ELSE 'active' END, updated_at = excluded.updated_at`,
    [id, actor.tenantId, actor.userId, actor.role, t, t],
  );
}

export async function getSession(id: string) {
  return one<SessionRow>(`SELECT * FROM poc_sessions WHERE id = ?`, [id]);
}

export interface Activity {
  sessionId: string;
  runId?: string;
  actorType: "user" | "agent" | "system";
  actorId: string;
  agentVersion?: string;
  kind: string;
  detail?: Record<string, unknown>;
  costUsd?: number;
  tokens?: number;
}

export async function recordActivity(a: Activity) {
  await run(
    `INSERT INTO poc_activities (session_id, run_id, at, actor_type, actor_id, agent_version, kind, detail, cost_usd, tokens)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [a.sessionId, a.runId ?? null, now(), a.actorType, a.actorId, a.agentVersion ?? null, a.kind,
      JSON.stringify(a.detail ?? {}), a.costUsd ?? null, a.tokens ?? null],
  );
  if (a.costUsd || a.tokens) {
    await run(
      `UPDATE poc_sessions SET cost_usd = cost_usd + ?, tokens = tokens + ?, updated_at = ? WHERE id = ?`,
      [a.costUsd ?? 0, a.tokens ?? 0, now(), a.sessionId],
    );
  }
}

export async function setSessionStatus(id: string, status: SessionRow["status"], outcome?: string) {
  await run(
    `UPDATE poc_sessions SET status = ?, outcome = COALESCE(?, outcome), updated_at = ? WHERE id = ? AND status != 'ended'`,
    [status, outcome ?? null, now(), id],
  );
}

export async function sessionRecord(id: string) {
  const session = await getSession(id);
  if (!session) return undefined;
  const activities = await rows<Record<string, unknown>>(
    `SELECT at, run_id, actor_type, actor_id, agent_version, kind, detail, cost_usd, tokens
     FROM poc_activities WHERE session_id = ? ORDER BY id`,
    [id],
  );
  return {
    session,
    activities: activities.map((a) => ({ ...a, detail: JSON.parse(String(a.detail)) })),
  };
}

export async function listSessions(tenantId?: string) {
  return tenantId
    ? rows<SessionRow>(`SELECT * FROM poc_sessions WHERE tenant_id = ? ORDER BY updated_at DESC`, [tenantId])
    : rows<SessionRow>(`SELECT * FROM poc_sessions ORDER BY updated_at DESC`);
}

// ---- The session's sourced values: the only figures a memo may quote (eval case 12). ----

export interface Sourced {
  label: string;
  value: string | number;
  source: string;
}

export async function recordSources(sessionId: string, values: Sourced[]) {
  for (const v of values) {
    await run(
      `INSERT INTO poc_sources (session_id, source, label, value) VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id, source) DO UPDATE SET label = excluded.label, value = excluded.value`,
      [sessionId, v.source, v.label, String(v.value)],
    );
  }
}

export async function listSources(sessionId: string): Promise<Sourced[]> {
  return rows<Sourced>(`SELECT label, value, source FROM poc_sources WHERE session_id = ? ORDER BY source`, [sessionId]);
}
