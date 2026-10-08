import { dealTeams, deals, findUser } from "../data/fixtures";
import type { Authorized } from "./guard";
import { listSources, recordActivity } from "./sessions";
import { newId, now, one, rows, run } from "./store";

// Proposals (A11; deal screening 04 DS13 and DS19). Every agent write lands here
// as pending. Only a DealLead's acceptance turns one into a work item or a saved
// memo, and only Flow's approvers decide on a submitted memo (DD7).

export type ProposalKind = "task" | "memo";
export type ProposalStatus = "pending" | "accepted" | "rejected";

export interface Proposal {
  id: string;
  key: string;
  kind: ProposalKind;
  dealId: string;
  sessionId: string;
  tenantId: string;
  agentId: string;
  agentVersion: string;
  status: ProposalStatus;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  payload: Record<string, any>;
  result: Record<string, any> | null;
}

interface ProposalRow {
  id: string; act_key: string; kind: ProposalKind; deal_id: string; session_id: string; tenant_id: string;
  agent_id: string; agent_version: string; status: ProposalStatus; created_at: string;
  decided_by: string | null; decided_at: string | null; payload: string; result: string | null;
}

const toProposal = (r: ProposalRow): Proposal => ({
  id: r.id, key: r.act_key, kind: r.kind, dealId: r.deal_id, sessionId: r.session_id, tenantId: r.tenant_id,
  agentId: r.agent_id, agentVersion: r.agent_version, status: r.status, createdAt: r.created_at,
  decidedBy: r.decided_by, decidedAt: r.decided_at,
  payload: JSON.parse(r.payload), result: r.result ? JSON.parse(r.result) : null,
});

// One proposal per act: proposing the same act again returns the first one,
// unless that one was rejected.
export async function propose(kind: ProposalKind, dealId: string, key: string, payload: Record<string, unknown>, auth: Authorized) {
  const existing = await one<ProposalRow>(
    `SELECT * FROM poc_proposals WHERE act_key = ? AND tenant_id = ? AND status != 'rejected'`,
    [key, auth.actor.tenantId],
  );
  if (existing) return { proposal: toProposal(existing), duplicate: true };

  const id = newId("P");
  await run(
    `INSERT INTO poc_proposals (id, act_key, kind, deal_id, session_id, tenant_id, agent_id, agent_version, status, created_at, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [id, key, kind, dealId, auth.sessionId, auth.actor.tenantId, auth.agentId, auth.agentVersion, now(), JSON.stringify(payload)],
  );
  await recordActivity({
    sessionId: auth.sessionId, actorType: "agent", actorId: auth.agentId, agentVersion: auth.agentVersion,
    kind: "proposal.created", detail: { proposalId: id, kind, dealId },
  });
  return { proposal: (await getProposal(id))!, duplicate: false };
}

export async function getProposal(id: string) {
  const row = await one<ProposalRow>(`SELECT * FROM poc_proposals WHERE id = ?`, [id]);
  return row ? toProposal(row) : undefined;
}

export async function listProposals(filter: { dealId?: string; sessionId?: string; status?: ProposalStatus; tenantId?: string } = {}) {
  const where: string[] = [];
  const args: string[] = [];
  if (filter.dealId) { where.push("deal_id = ?"); args.push(filter.dealId); }
  if (filter.sessionId) { where.push("session_id = ?"); args.push(filter.sessionId); }
  if (filter.status) { where.push("status = ?"); args.push(filter.status); }
  if (filter.tenantId) { where.push("tenant_id = ?"); args.push(filter.tenantId); }
  const sql = `SELECT * FROM poc_proposals ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at, id`;
  return (await rows<ProposalRow>(sql, args)).map(toProposal);
}

export class DecisionError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404 | 409 = 400) { super(message); }
}

function requireDealLead(userId: string, dealId: string) {
  const user = findUser(userId);
  const member = dealTeams[dealId]?.find((m) => m.id === userId);
  if (!user || user.role !== "DealLead" || !member?.canReadDeal) {
    throw new DecisionError(`${userId} is not the deal's DealLead, so cannot decide on its proposals.`, 403);
  }
  return user;
}

async function recordOnDeal(dealId: string, actorId: string, event: string, detail: Record<string, unknown>) {
  await run(
    `INSERT INTO poc_deal_record (deal_id, at, actor_id, event, detail) VALUES (?, ?, ?, ?, ?)`,
    [dealId, now(), actorId, event, JSON.stringify(detail)],
  );
}

// Accepting is idempotent: accepting a proposal twice yields one work item or
// one saved memo (eval case 8).
export async function acceptProposal(id: string, userId: string) {
  const p = await getProposal(id);
  if (!p) throw new DecisionError(`No proposal ${id}.`, 404);
  requireDealLead(userId, p.dealId);
  if (p.status === "accepted") return { proposal: p, alreadyAccepted: true };
  if (p.status === "rejected") throw new DecisionError(`${id} was rejected; ask the agent for a new proposal.`, 409);

  const result = p.kind === "task" ? await createWorkItem(p, userId) : await saveAndSubmitMemo(p, userId);
  const t = now();
  await run(
    `UPDATE poc_proposals SET status = 'accepted', decided_by = ?, decided_at = ?, result = ? WHERE id = ? AND status = 'pending'`,
    [userId, t, JSON.stringify(result), id],
  );
  await recordActivity({
    sessionId: p.sessionId, actorType: "user", actorId: userId, kind: "proposal.accepted",
    detail: { proposalId: id, kind: p.kind, ...result },
  });
  return { proposal: (await getProposal(id))!, alreadyAccepted: false };
}

export async function rejectProposal(id: string, userId: string, reason?: string) {
  const p = await getProposal(id);
  if (!p) throw new DecisionError(`No proposal ${id}.`, 404);
  requireDealLead(userId, p.dealId);
  if (p.status !== "pending") throw new DecisionError(`${id} is already ${p.status}.`, 409);
  await run(
    `UPDATE poc_proposals SET status = 'rejected', decided_by = ?, decided_at = ?, result = ? WHERE id = ?`,
    [userId, now(), JSON.stringify({ reason: reason ?? null }), id],
  );
  // The owning POD reviews rejections; a wrong agent output becomes an eval case (05 §Feedback Loop).
  await recordActivity({
    sessionId: p.sessionId, actorType: "user", actorId: userId, kind: "proposal.rejected",
    detail: { proposalId: id, kind: p.kind, agentId: p.agentId, agentVersion: p.agentVersion, reason: reason ?? null },
  });
  return (await getProposal(id))!;
}

async function createWorkItem(p: Proposal, userId: string) {
  const existing = await one<{ id: string }>(`SELECT id FROM poc_work_items WHERE proposal_id = ?`, [p.id]);
  if (existing) return { workItemId: existing.id };
  const workItemId = newId("W");
  await run(
    `INSERT INTO poc_work_items (id, proposal_id, deal_id, title, assignee_id, due_date, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [workItemId, p.id, p.dealId, p.payload.title, p.payload.assignee?.id ?? null, p.payload.dueDate, userId, now()],
  );
  await recordOnDeal(p.dealId, userId, "task.created", { workItemId, proposalId: p.id, title: p.payload.title });
  return { workItemId };
}

async function saveAndSubmitMemo(p: Proposal, userId: string) {
  const user = findUser(userId)!;
  const existing = await one<{ id: string }>(`SELECT id FROM poc_files WHERE proposal_id = ?`, [p.id]);
  const fileId = existing?.id ?? newId("F");
  if (!existing) {
    const deal = deals.find((d) => d.id === p.dealId);
    await run(
      `INSERT INTO poc_files (id, proposal_id, deal_id, name, content, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [fileId, p.id, p.dealId, `${deal?.name ?? p.dealId} - ${p.payload.title}.md`, p.payload.body, userId, now()],
    );
    await recordOnDeal(p.dealId, userId, "memo.saved", { fileId, proposalId: p.id });
  }

  // Flow §Approvals: the DealLead's manager, as one approver, in the demo Tenants.
  const approverId = user.managerId;
  if (!approverId) return { fileId, approvalId: null };
  const approval = await one<{ id: string }>(`SELECT id FROM poc_approvals WHERE file_id = ?`, [fileId]);
  if (approval) return { fileId, approvalId: approval.id };

  const approvalId = newId("A");
  const evidence = {
    sessionId: p.sessionId,
    proposalId: p.id,
    figures: p.payload.figures,
    sessionSources: await listSources(p.sessionId),
  };
  await run(
    `INSERT INTO poc_approvals (id, file_id, deal_id, approver_id, status, submitted_by, submitted_at, evidence)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [approvalId, fileId, p.dealId, approverId, userId, now(), JSON.stringify(evidence)],
  );
  await recordOnDeal(p.dealId, userId, "memo.submitted", { fileId, approvalId, approverId });
  return { fileId, approvalId };
}

// Flow's approvers decide, never an agent. The deal records who decided on which evidence.
export async function decideApproval(id: string, approverId: string, decision: "approved" | "rejected", comment?: string) {
  const a = await one<{ id: string; deal_id: string; approver_id: string; status: string; file_id: string; evidence: string }>(
    `SELECT * FROM poc_approvals WHERE id = ?`, [id],
  );
  if (!a) throw new DecisionError(`No approval ${id}.`, 404);
  if (a.approver_id !== approverId) throw new DecisionError(`${approverId} is not this memo's approver.`, 403);
  if (a.status !== "pending") throw new DecisionError(`${id} is already ${a.status}.`, 409);
  await run(`UPDATE poc_approvals SET status = ?, decided_at = ?, comment = ? WHERE id = ?`, [decision, now(), comment ?? null, id]);
  await recordOnDeal(a.deal_id, approverId, `memo.${decision}`, {
    approvalId: id, fileId: a.file_id, comment: comment ?? null, evidence: JSON.parse(a.evidence),
  });
  return one(`SELECT * FROM poc_approvals WHERE id = ?`, [id]);
}

export async function dealRecord(dealId: string) {
  const [workItems, files, approvals, events] = await Promise.all([
    rows(`SELECT * FROM poc_work_items WHERE deal_id = ? ORDER BY created_at`, [dealId]),
    rows(`SELECT id, proposal_id, name, created_by, created_at FROM poc_files WHERE deal_id = ? ORDER BY created_at`, [dealId]),
    rows(`SELECT id, file_id, approver_id, status, submitted_by, submitted_at, decided_at, comment FROM poc_approvals WHERE deal_id = ?`, [dealId]),
    rows<{ detail: string }>(`SELECT at, actor_id, event, detail FROM poc_deal_record WHERE deal_id = ? ORDER BY id`, [dealId]),
  ]);
  return { workItems, files, approvals, events: events.map((e) => ({ ...e, detail: JSON.parse(e.detail) })) };
}

// Three business days after the request (deal screening 04, DD5).
export function threeBusinessDaysFrom(from = new Date()): string {
  const d = new Date(from);
  let added = 0;
  while (added < 3) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}
