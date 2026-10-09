import { createClient, type Client, type InValue } from "@libsql/client";
import { restoreFixtures, setFieldValue } from "../data/fixtures";

// The foundation's durable records: sessions and their activity, proposals and
// what accepting them produced, Flow approvals, the deal record, kill switches
// and each session's sourced values. Kept beside Mastra's own tables in the same
// LibSQL database, so a parked session and its proposals survive a restart (A10).

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS poc_sessions (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL,
    status TEXT NOT NULL, started_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    cost_usd REAL NOT NULL DEFAULT 0, tokens INTEGER NOT NULL DEFAULT 0, outcome TEXT)`,
  `CREATE TABLE IF NOT EXISTS poc_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, run_id TEXT, at TEXT NOT NULL,
    actor_type TEXT NOT NULL, actor_id TEXT NOT NULL, agent_version TEXT, kind TEXT NOT NULL,
    detail TEXT NOT NULL, cost_usd REAL, tokens INTEGER)`,
  `CREATE TABLE IF NOT EXISTS poc_proposals (
    id TEXT PRIMARY KEY, act_key TEXT NOT NULL, kind TEXT NOT NULL, deal_id TEXT NOT NULL,
    session_id TEXT NOT NULL, tenant_id TEXT NOT NULL, agent_id TEXT NOT NULL, agent_version TEXT NOT NULL,
    status TEXT NOT NULL, created_at TEXT NOT NULL, decided_by TEXT, decided_at TEXT,
    payload TEXT NOT NULL, result TEXT)`,
  `CREATE TABLE IF NOT EXISTS poc_work_items (
    id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL UNIQUE, deal_id TEXT NOT NULL, title TEXT NOT NULL,
    assignee_id TEXT, due_date TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS poc_files (
    id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL UNIQUE, deal_id TEXT NOT NULL, name TEXT NOT NULL,
    content TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS poc_approvals (
    id TEXT PRIMARY KEY, file_id TEXT NOT NULL UNIQUE, deal_id TEXT NOT NULL, approver_id TEXT NOT NULL,
    status TEXT NOT NULL, submitted_by TEXT NOT NULL, submitted_at TEXT NOT NULL,
    decided_at TEXT, comment TEXT, evidence TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS poc_deal_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT, deal_id TEXT NOT NULL, at TEXT NOT NULL,
    actor_id TEXT NOT NULL, event TEXT NOT NULL, detail TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS poc_kill_switches (
    tenant_id TEXT PRIMARY KEY, engaged INTEGER NOT NULL, changed_by TEXT NOT NULL, changed_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS poc_sources (
    session_id TEXT NOT NULL, source TEXT NOT NULL, label TEXT NOT NULL, value TEXT NOT NULL,
    PRIMARY KEY (session_id, source))`,
  `CREATE TABLE IF NOT EXISTS poc_field_values (
    deal_id TEXT NOT NULL, field_key TEXT NOT NULL, value TEXT NOT NULL, proposal_id TEXT NOT NULL,
    set_by TEXT NOT NULL, set_at TEXT NOT NULL, PRIMARY KEY (deal_id, field_key))`,
];

let client: Client | undefined;
let ready: Promise<Client> | undefined;

export function db(): Promise<Client> {
  ready ??= (async () => {
    client = createClient({ url: process.env.MASTRA_DB_URL ?? "file:./mastra.db" });
    for (const sql of SCHEMA) await client.execute(sql);
    // Accepted field values outlive a restart.
    for (const r of (await client.execute(`SELECT deal_id, field_key, value FROM poc_field_values`)).rows) {
      setFieldValue(String(r.deal_id), String(r.field_key), JSON.parse(String(r.value)));
    }
    return client;
  })();
  return ready;
}

export async function run(sql: string, args: InValue[] = []) {
  return (await db()).execute({ sql, args });
}

export async function rows<T>(sql: string, args: InValue[] = []): Promise<T[]> {
  const result = await run(sql, args);
  return result.rows.map((r) => ({ ...r }) as T);
}

export async function one<T>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  return (await rows<T>(sql, args))[0];
}

export const now = () => new Date().toISOString();

let seq = 0;
export function newId(prefix: string): string {
  seq = (seq + 1) % 1000;
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${String(seq).padStart(3, "0")}`;
}

// For tests: start from an empty database.
export async function resetStore() {
  const c = await db();
  for (const t of ["sessions", "activities", "proposals", "work_items", "files", "approvals", "deal_record", "kill_switches", "sources", "field_values"]) {
    await c.execute(`DELETE FROM poc_${t}`);
  }
  restoreFixtures();
}
