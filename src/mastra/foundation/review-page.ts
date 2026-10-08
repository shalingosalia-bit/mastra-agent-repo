// The review panel at /poc/review: the sandbox stand-in for the agent panel's
// proposal cards, Flow's approval inbox and the Tenant admin's kill switch.

export const REVIEW_PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Deal Review Panel</title>
<style>
  :root { --bg:#f7f7f5; --card:#fff; --ink:#1d1d1b; --muted:#6b6b66; --line:#e2e2dc; --accent:#1f5eff; --bad:#c2410c; --good:#15803d; }
  @media (prefers-color-scheme: dark) { :root { --bg:#141413; --card:#1f1f1d; --ink:#ecebe6; --muted:#a3a29b; --line:#33332f; --accent:#7aa2ff; --bad:#fb923c; --good:#4ade80; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.45 system-ui, sans-serif; }
  main { max-width: 980px; margin: 0 auto; padding: 24px 16px 64px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 28px 0 10px; }
  .muted { color: var(--muted); }
  .bar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin: 16px 0; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 16px; margin-bottom:10px; }
  .row { display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; align-items:baseline; }
  .tag { font-size:12px; padding:1px 8px; border-radius:99px; border:1px solid var(--line); color:var(--muted); }
  button { font:inherit; border:1px solid var(--line); background:var(--card); color:var(--ink); border-radius:8px; padding:5px 12px; cursor:pointer; }
  button.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
  button.danger { color:var(--bad); }
  select, input { font:inherit; padding:5px 8px; border-radius:8px; border:1px solid var(--line); background:var(--card); color:var(--ink); }
  pre { white-space:pre-wrap; word-break:break-word; font-size:13px; background:var(--bg); padding:10px; border-radius:8px; max-height:320px; overflow:auto; }
  .err { color: var(--bad); }
</style>
</head>
<body>
<main>
  <h1>Deal review panel</h1>
  <div class="muted">Proposals the agents made, waiting for the DealLead. Agents cannot act here.</div>
  <div class="bar">
    <label>Acting as <select id="user">
      <option value="U-1">Dana Kim (DealLead)</option>
      <option value="U-2">Raj Patel (Analyst)</option>
      <option value="U-9">Morgan Lee (Approver)</option>
    </select></label>
    <span id="kill"></span>
    <button onclick="load()">Refresh</button>
  </div>
  <div id="msg" class="err"></div>

  <h2>Pending proposals</h2>
  <div id="pending"></div>

  <h2>Approvals in Flow</h2>
  <div id="approvals"></div>

  <h2>Sessions</h2>
  <div id="sessions"></div>
</main>
<script>
const TENANT = "T-demo";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
const user = () => $("user").value;

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { "content-type": "application/json", "x-user-id": user(), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function act(fn) {
  $("msg").textContent = "";
  try { await fn(); } catch (e) { $("msg").textContent = e.message; }
  await load();
}

function proposalCard(p) {
  const body = p.kind === "task"
    ? \`<div><b>\${esc(p.payload.title)}</b></div><div class="muted">From: \${esc(p.payload.criterion)} · Assignee: \${esc(p.payload.assignee?.name ?? "none")} · Due \${esc(p.payload.dueDate)}</div>\`
    : \`<div><b>\${esc(p.payload.title)}</b></div><pre>\${esc(p.payload.body)}</pre>\`;
  return \`<div class="card"><div class="row"><span><span class="tag">\${p.kind}</span> \${esc(p.id)} · \${esc(p.dealId)}</span>
    <span class="muted">\${esc(p.agentId)} v\${esc(p.agentVersion)}</span></div>\${body}
    <div class="bar"><button class="primary" onclick="act(() => api('/poc/proposals/\${p.id}/accept', { method: 'POST' }))">Accept</button>
    <button class="danger" onclick="act(() => api('/poc/proposals/\${p.id}/reject', { method: 'POST', body: JSON.stringify({ reason: prompt('Why reject?') || null }) }))">Reject</button></div></div>\`;
}

function approvalCard(a) {
  const mine = a.approver_id === user() && a.status === "pending";
  return \`<div class="card"><div class="row"><span>\${esc(a.id)} · memo \${esc(a.file_id)} · \${esc(a.deal_id)}</span><span class="tag">\${esc(a.status)}</span></div>
    <div class="muted">Submitted by \${esc(a.submitted_by)} to \${esc(a.approver_id)}\${a.comment ? " · " + esc(a.comment) : ""}</div>
    \${mine ? \`<div class="bar"><button class="primary" onclick="act(() => api('/poc/approvals/\${a.id}/decide', { method: 'POST', body: JSON.stringify({ decision: 'approved' }) }))">Approve</button>
    <button class="danger" onclick="act(() => api('/poc/approvals/\${a.id}/decide', { method: 'POST', body: JSON.stringify({ decision: 'rejected', comment: prompt('Why?') || null }) }))">Reject</button></div>\` : ""}</div>\`;
}

async function showSession(id) {
  const r = await api('/poc/sessions/' + encodeURIComponent(id));
  $("s-" + CSS.escape(id)).innerHTML = '<pre>' + esc(r.activities.map((a) =>
    [a.at.slice(11, 19), a.actor_type, a.actor_id + (a.agent_version ? " v" + a.agent_version : ""), a.kind,
     a.cost_usd ? "$" + Number(a.cost_usd).toFixed(4) : "", JSON.stringify(a.detail)].join("  ")).join("\\n")) + '</pre>';
}

async function load() {
  const [pending, approvals, sessions, kill] = await Promise.all([
    api('/poc/proposals?status=pending'), api('/poc/approvals'), api('/poc/sessions'), api('/poc/tenants/' + TENANT + '/kill-switch'),
  ]);
  $("pending").innerHTML = pending.proposals.map(proposalCard).join("") || '<div class="muted">Nothing waiting.</div>';
  $("approvals").innerHTML = approvals.approvals.map(approvalCard).join("") || '<div class="muted">No memos submitted.</div>';
  $("sessions").innerHTML = sessions.sessions.map((s) => \`<div class="card"><div class="row"><span>\${esc(s.id)}</span>
    <span class="muted">\${esc(s.user_id)} · \${esc(s.status)}\${s.outcome ? " (" + esc(s.outcome) + ")" : ""} · $\${Number(s.cost_usd).toFixed(4)} · \${s.tokens} tokens</span></div>
    <button onclick="showSession('\${esc(s.id)}')">Show record</button><div id="s-\${esc(s.id)}"></div></div>\`).join("") || '<div class="muted">No sessions yet.</div>';
  $("kill").innerHTML = kill.engaged
    ? \`<span class="err">Kill switch engaged for \${TENANT}</span> <button onclick="act(() => api('/poc/tenants/\${TENANT}/kill-switch', { method: 'POST', body: JSON.stringify({ engaged: false }) }))">Release</button>\`
    : \`<button class="danger" onclick="confirm('Stop every agent in \${TENANT}?') && act(() => api('/poc/tenants/\${TENANT}/kill-switch', { method: 'POST', body: JSON.stringify({ engaged: true }) }))">Engage kill switch</button>\`;
}
$("user").addEventListener("change", load);
load().catch((e) => { $("msg").textContent = e.message; });
</script>
</body>
</html>`;
