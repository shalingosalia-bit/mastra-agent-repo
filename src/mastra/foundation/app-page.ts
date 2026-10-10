// The deal review app at /poc/app: one page to test the agents as a business
// user would. Chat with the supervisor on the left; on the right, what waits for
// the acting person (proposals, or approvals for an approver), what the agents
// did on each turn, and the kill switch. It calls Mastra's own agent and memory
// API and the /poc routes, so it needs nothing beyond the running server.
//
// The client script avoids template literals so this file can hold it as one.

export const APP_PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Deal Review</title>
<style>
  :root {
    --bg:#f6f6f3; --panel:#ffffff; --ink:#1c1c1a; --muted:#6b6b65; --line:#e3e3dd; --soft:#f0f0eb;
    --accent:#2457d6; --accent-ink:#ffffff; --bad:#b4410f; --good:#1a7a3c; --warn:#9a6700; --user:#eaf0ff;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#131312; --panel:#1c1c1b; --ink:#ecebe5; --muted:#a2a19a; --line:#33332f; --soft:#252523;
      --accent:#7ea3ff; --accent-ink:#0d0d0c; --bad:#f39a6a; --good:#5fd38a; --warn:#e3b341; --user:#1f2a44; }
  }
  * { box-sizing:border-box; }
  html, body { height:100%; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14.5px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  button, select, textarea, input { font:inherit; color:inherit; }
  button { border:1px solid var(--line); background:var(--panel); border-radius:8px; padding:5px 11px; cursor:pointer; }
  button:hover { border-color:var(--muted); }
  button.primary { background:var(--accent); border-color:var(--accent); color:var(--accent-ink); }
  button.danger { color:var(--bad); }
  button:disabled { opacity:.5; cursor:default; }
  select { border:1px solid var(--line); background:var(--panel); border-radius:8px; padding:5px 8px; }
  .muted { color:var(--muted); }
  .small { font-size:12.5px; }

  header { display:flex; flex-wrap:wrap; gap:10px 16px; align-items:center; justify-content:space-between;
    padding:10px 16px; border-bottom:1px solid var(--line); background:var(--panel); }
  header h1 { font-size:16px; margin:0; }
  header .right { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
  .pill { font-size:12px; border:1px solid var(--line); border-radius:99px; padding:1px 8px; color:var(--muted); white-space:nowrap; }
  .pill.bad { color:var(--bad); border-color:var(--bad); }

  .layout { display:grid; grid-template-columns: 220px minmax(0,1fr) 360px; height:calc(100% - 53px); }
  @media (max-width: 1100px) { .layout { grid-template-columns: minmax(0,1fr) 340px; } .threads { display:none; } }
  @media (max-width: 760px) { .layout { display:block; height:auto; } .side { border-left:0; border-top:1px solid var(--line); } }

  .threads { border-right:1px solid var(--line); overflow:auto; padding:12px; }
  .threads button.new { width:100%; margin-bottom:10px; }
  .thread { display:block; width:100%; text-align:left; border:0; background:none; padding:7px 8px; border-radius:8px; }
  .thread.on { background:var(--soft); }
  .thread .t { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

  .chat { display:flex; flex-direction:column; min-height:0; }
  .messages { flex:1; overflow:auto; padding:18px 18px 8px; }
  .msg { max-width:860px; margin:0 auto 14px; }
  .msg .who { font-size:12px; color:var(--muted); margin-bottom:3px; }
  .msg.user .bubble { background:var(--user); border-radius:12px; padding:9px 13px; display:inline-block; }
  .msg.user { text-align:right; }
  .msg.user .bubble { text-align:left; }
  .msg.agent .bubble { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:10px 14px; overflow-x:auto; }
  .msg.err .bubble { border-color:var(--bad); color:var(--bad); }
  .bubble p { margin:0 0 8px; } .bubble p:last-child { margin-bottom:0; }
  .bubble h3, .bubble h4 { margin:10px 0 6px; font-size:14.5px; }
  .bubble ul, .bubble ol { margin:4px 0 8px; padding-left:20px; }
  .bubble table { border-collapse:collapse; margin:6px 0 10px; font-size:13.5px; }
  .bubble th, .bubble td { border:1px solid var(--line); padding:4px 8px; text-align:left; vertical-align:top; }
  .bubble th { background:var(--soft); }
  .bubble code { background:var(--soft); padding:0 4px; border-radius:4px; font-size:12.5px; }
  .v-pass { color:var(--good); font-weight:600; } .v-fail { color:var(--bad); font-weight:600; } .v-unknown { color:var(--warn); font-weight:600; }

  .empty { max-width:640px; margin:40px auto; text-align:center; }
  .chips { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-top:14px; }
  .chip { border-radius:99px; font-size:13px; }

  .composer { border-top:1px solid var(--line); padding:10px 16px 14px; background:var(--panel); }
  .composer form { max-width:860px; margin:0 auto; display:flex; gap:8px; align-items:flex-end; }
  .composer textarea { flex:1; resize:none; min-height:44px; max-height:180px; border:1px solid var(--line); border-radius:10px; padding:10px 12px; background:var(--bg); }
  .working { max-width:860px; margin:0 auto 6px; font-size:12.5px; color:var(--muted); min-height:18px; }

  .side { border-left:1px solid var(--line); overflow:auto; padding:12px; background:var(--bg); }
  .side h2 { font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); margin:14px 2px 8px; }
  .side h2:first-child { margin-top:2px; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:10px 12px; margin-bottom:8px; }
  .card .row { display:flex; justify-content:space-between; gap:8px; align-items:baseline; }
  .card .actions { display:flex; gap:6px; margin-top:8px; }
  .card pre { white-space:pre-wrap; word-break:break-word; font:12.5px/1.45 ui-monospace, monospace; background:var(--soft); padding:8px; border-radius:6px; max-height:220px; overflow:auto; margin:6px 0 0; }
  .timeline { list-style:none; margin:6px 0 0; padding:0; font-size:13px; }
  .timeline li { padding:3px 0 3px 14px; position:relative; }
  .timeline li::before { content:""; position:absolute; left:3px; top:11px; width:5px; height:5px; border-radius:50%; background:var(--muted); }
  .timeline li.deleg::before { background:var(--accent); }
  .timeline li.refused::before, .timeline li.rejected::before { background:var(--bad); }
  .timeline li.proposal::before { background:var(--good); }
  .flash { color:var(--bad); font-size:13px; margin:4px 2px 8px; min-height:1px; }
</style>
</head>
<body>
<header>
  <h1>Deal Review <span class="muted small">· agent test bench</span></h1>
  <div class="right">
    <label class="small">Acting as
      <select id="persona">
        <option value="U-1|DealLead">Dana Kim · DealLead</option>
        <option value="U-2|Analyst">Raj Patel · Analyst</option>
        <option value="U-9|Approver">Morgan Lee · Approver</option>
      </select>
    </label>
    <span id="kill"></span>
    <a class="small muted" href="/" target="_blank" rel="noopener">Open Studio</a>
  </div>
</header>

<div class="layout">
  <nav class="threads">
    <button class="new primary" id="newThread">+ New review</button>
    <div id="threadList" class="small"></div>
  </nav>

  <section class="chat">
    <div class="messages" id="messages"></div>
    <div class="composer">
      <div class="working" id="working"></div>
      <form id="form">
        <textarea id="input" rows="1" placeholder="Ask the deal review agent... (Enter to send, Shift+Enter for a new line)"></textarea>
        <button class="primary" id="send" type="submit">Send</button>
      </form>
    </div>
  </section>

  <aside class="side">
    <div class="flash" id="flash"></div>
    <h2 id="waitingTitle">Waiting for you</h2>
    <div id="waiting"></div>
    <h2>What the agents did</h2>
    <div id="activity"><div class="muted small">Send a message to see each turn's handoffs and tools.</div></div>
  </aside>
</div>

<script>
var AGENT = "deal-review";
var TENANT = "T-demo";
var SUGGESTIONS = [
  "What deals do we have in screening right now?",
  "Screen Riverside Flats: multifamily only, cap rate at least 5.5%, asking price under $60M, seller reserve under $57M.",
  "How does Riverside stack up against recent sales in Austin?",
  "Where are we on this review?"
];

var state = { thread: null, busy: false, startedAt: 0, timer: null };
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]; }); }
function persona() { var p = $("persona").value.split("|"); return { id: p[0], role: p[1] }; }
function store(key, val) { try { if (val === undefined) return JSON.parse(localStorage.getItem(key) || "null"); localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; } }
function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); }
function money(n) { return "$" + Number(n || 0).toFixed(4); }

async function api(path, opts) {
  opts = opts || {};
  var headers = Object.assign({ "content-type": "application/json", "x-user-id": persona().id }, opts.headers || {});
  var res = await fetch(path, Object.assign({}, opts, { headers: headers }));
  var data = await res.json().catch(function () { return {}; });
  if (!res.ok) throw new Error(data.error || data.message || res.statusText);
  return data;
}

// ---- A small markdown renderer: escapes first, then tables, lists, headings, emphasis. ----
function inline(s) {
  return s
    .replace(/\`([^\`]+)\`/g, "<code>$1</code>")
    .replace(/\\*\\*([^*]+)\\*\\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\\*([^*\\n]+)\\*/g, "$1<i>$2</i>")
    .replace(/\\b(Pass|PASS|pass)\\b/g, '<span class="v-pass">$1</span>')
    .replace(/\\b(Fail|FAIL|fail)\\b/g, '<span class="v-fail">$1</span>')
    .replace(/\\b(Unknown|UNKNOWN|unknown)\\b/g, '<span class="v-unknown">$1</span>');
}
function markdown(src) {
  var lines = esc(src).split("\\n"), out = [], i = 0;
  function isRow(l) { return /^\\s*\\|.*\\|\\s*$/.test(l); }
  function cells(l) { return l.trim().replace(/^\\|/, "").replace(/\\|$/, "").split("|").map(function (c) { return c.trim(); }); }
  while (i < lines.length) {
    var l = lines[i];
    if (isRow(l) && i + 1 < lines.length && /^\\s*\\|?\\s*:?-{2,}/.test(lines[i + 1])) {
      var head = cells(l); i += 2; var body = [];
      while (i < lines.length && isRow(lines[i])) { body.push(cells(lines[i])); i++; }
      out.push("<table><thead><tr>" + head.map(function (c) { return "<th>" + inline(c) + "</th>"; }).join("") + "</tr></thead><tbody>" +
        body.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>");
      continue;
    }
    var h = l.match(/^(#{1,6})\\s+(.*)$/);
    if (h) { out.push("<h4>" + inline(h[2]) + "</h4>"); i++; continue; }
    if (/^\\s*([-*]|\\d+\\.)\\s+/.test(l)) {
      var ordered = /^\\s*\\d+\\./.test(l), items = [];
      while (i < lines.length && /^\\s*([-*]|\\d+\\.)\\s+/.test(lines[i])) { items.push(lines[i].replace(/^\\s*([-*]|\\d+\\.)\\s+/, "")); i++; }
      out.push((ordered ? "<ol>" : "<ul>") + items.map(function (x) { return "<li>" + inline(x) + "</li>"; }).join("") + (ordered ? "</ol>" : "</ul>"));
      continue;
    }
    if (!l.trim()) { i++; continue; }
    var para = [];
    while (i < lines.length && lines[i].trim() && !isRow(lines[i]) && !/^#{1,6}\\s/.test(lines[i]) && !/^\\s*([-*]|\\d+\\.)\\s+/.test(lines[i])) { para.push(lines[i]); i++; }
    out.push("<p>" + inline(para.join("<br>")) + "</p>");
  }
  return out.join("");
}

// ---- Messages ----
function textOf(m) {
  var c = m.content;
  if (typeof c === "string") return c;
  if (c && Array.isArray(c.parts)) return c.parts.filter(function (p) { return p.type === "text"; }).map(function (p) { return p.text; }).join("\\n");
  if (c && typeof c.content === "string") return c.content;
  if (Array.isArray(c)) return c.filter(function (p) { return p.type === "text"; }).map(function (p) { return p.text; }).join("\\n");
  return "";
}
function addMessage(role, text, opts) {
  opts = opts || {};
  var box = $("messages");
  var empty = box.querySelector(".empty"); if (empty) empty.remove();
  var div = document.createElement("div");
  div.className = "msg " + (role === "user" ? "user" : "agent") + (opts.error ? " err" : "");
  var who = role === "user" ? "You" : (opts.error ? "Couldn't complete" : "Deal review agent");
  div.innerHTML = '<div class="who">' + esc(who) + '</div><div class="bubble">' + (role === "user" ? esc(text).replace(/\\n/g, "<br>") : markdown(text)) + "</div>";
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}
function showEmpty() {
  var p = persona();
  $("messages").innerHTML = '<div class="empty"><h3>Start a deal review</h3><p class="muted">' +
    (p.role === "Approver" ? "Approvers decide on submitted memos in the panel on the right. Switch to Dana or Raj to chat." :
      "Ask in your own words. The agent maps your criteria, waits for you to confirm, and proposes changes for you to accept on the right.") +
    '</p><div class="chips">' + (p.role === "Approver" ? "" : SUGGESTIONS.map(function (s) { return '<button class="chip" data-s="' + esc(s) + '">' + esc(s.length > 60 ? s.slice(0, 57) + "..." : s) + "</button>"; }).join("")) + "</div></div>";
  Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (b) { b.onclick = function () { $("input").value = b.getAttribute("data-s"); $("input").focus(); }; });
}

// ---- Threads: each is one review, and its id is the session id. ----
function titles() { return store("dr-titles") || {}; }
async function loadThreads() {
  var p = persona();
  var list = $("threadList");
  if (p.role === "Approver") { list.innerHTML = '<div class="muted">Approvers don\\'t chat.</div>'; return; }
  try {
    var r = await api("/api/memory/threads?agentId=" + AGENT + "&resourceId=" + encodeURIComponent(p.id) + "&perPage=50");
    var t = titles();
    var threads = (r.threads || []).sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
    list.innerHTML = threads.map(function (th) {
      var label = t[th.id] || th.title || ("Review " + th.id.slice(0, 6));
      return '<button class="thread' + (th.id === state.thread ? " on" : "") + '" data-id="' + esc(th.id) + '"><div class="t">' + esc(label) + '</div><div class="muted small">' + esc(new Date(th.updatedAt).toLocaleString()) + "</div></button>";
    }).join("") || '<div class="muted">No reviews yet.</div>';
    Array.prototype.forEach.call(list.querySelectorAll(".thread"), function (b) { b.onclick = function () { openThread(b.getAttribute("data-id")); }; });
  } catch (e) { list.innerHTML = '<div class="muted">Couldn\\'t load reviews: ' + esc(e.message) + "</div>"; }
}
async function openThread(id) {
  state.thread = id;
  store("dr-thread-" + persona().id, id);
  $("messages").innerHTML = "";
  try {
    var r = await api("/api/memory/threads/" + encodeURIComponent(id) + "/messages?agentId=" + AGENT + "&resourceId=" + encodeURIComponent(persona().id));
    var msgs = (r.messages || r.uiMessages || []).filter(function (m) { return m.role === "user" || m.role === "assistant"; });
    msgs.forEach(function (m) { var t = textOf(m); if (t.trim()) addMessage(m.role, t); });
    if (!msgs.length) showEmpty();
  } catch (e) { showEmpty(); }
  loadThreads(); refreshSide();
}
function newThread() {
  state.thread = uuid();
  store("dr-thread-" + persona().id, state.thread);
  showEmpty(); loadThreads(); refreshSide();
  $("input").focus();
}

// ---- Sending ----
function setBusy(b) {
  state.busy = b; $("send").disabled = b; $("input").disabled = b;
  clearInterval(state.timer);
  if (b) {
    state.startedAt = Date.now();
    var tick = function () { $("working").textContent = "The agents are working... " + Math.round((Date.now() - state.startedAt) / 1000) + "s (a turn can take up to a minute)"; };
    tick(); state.timer = setInterval(tick, 1000);
  } else { $("working").textContent = ""; }
}
async function send(text) {
  var p = persona();
  if (!text.trim() || state.busy) return;
  if (p.role === "Approver") { flash("Approvers don't chat. Switch to Dana or Raj."); return; }
  if (!state.thread) state.thread = uuid();
  var t = titles(); if (!t[state.thread]) { t[state.thread] = text.slice(0, 60); store("dr-titles", t); }
  addMessage("user", text);
  setBusy(true);
  try {
    var r = await api("/api/agents/" + AGENT + "/generate", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: text }],
        memory: { thread: state.thread, resource: p.id },
        requestContext: { userId: p.id, userRole: p.role, tenantId: TENANT }
      })
    });
    addMessage("assistant", r.text || "(No reply text.)");
  } catch (e) {
    var hint = /API key/i.test(e.message) ? "\\n\\nAdd your key to .env as ANTHROPIC_API_KEY=... and restart npm run dev." : "";
    addMessage("assistant", e.message + hint, { error: true });
  } finally {
    setBusy(false); loadThreads(); refreshSide(); $("input").focus();
  }
}

// ---- Side panel ----
function flash(m) { $("flash").textContent = m || ""; if (m) setTimeout(function () { $("flash").textContent = ""; }, 6000); }
async function act(fn) { flash(""); try { await fn(); } catch (e) { flash(e.message); } refreshSide(); }

var KIND = { task: "Task", memo: "Memo", field_value: "Field value", task_change: "Task change", note: "Note" };
function proposalBody(p) {
  var x = p.payload || {};
  if (p.kind === "task") return "<b>" + esc(x.title) + '</b><div class="muted small">From: ' + esc(x.criterion) + " · " + esc(x.assignee ? x.assignee.name : "Unassigned") + " · due " + esc(x.dueDate) + "</div>";
  if (p.kind === "field_value") return "<b>" + esc(x.fieldLabel) + ": " + esc(x.previous == null ? "empty" : x.previous) + " → " + esc(x.value) + '</b><div class="muted small">Source: ' + esc(x.source) + "</div>";
  if (p.kind === "task_change") return "<b>" + esc(x.title) + '</b><div class="muted small">' + (x.assignee !== undefined ? "Assignee → " + esc(x.assignee ? x.assignee.name : "none") + " · " : "") + (x.dueDate ? "Due → " + esc(x.dueDate) + " · " : "") + esc(x.reason) + "</div>";
  if (p.kind === "note") return "<b>Note</b><pre>" + esc(x.note) + "</pre>";
  return "<b>" + esc(x.title) + "</b>" + (x.decision ? '<div class="small">Decision: ' + esc(x.decision) + "</div>" : '<div class="muted small">Decision pending</div>') + "<pre>" + esc(x.body) + "</pre>";
}
function proposalCard(p, canDecide) {
  return '<div class="card"><div class="row"><span class="pill">' + esc(KIND[p.kind] || p.kind) + '</span><span class="muted small">' + esc(p.dealId) + " · " + esc(p.agentId) + " v" + esc(p.agentVersion) + "</span></div>" +
    '<div style="margin-top:6px">' + proposalBody(p) + "</div>" +
    (canDecide ? '<div class="actions"><button class="primary" data-accept="' + esc(p.id) + '">Accept</button><button class="danger" data-reject="' + esc(p.id) + '">Reject</button></div>' : "") + "</div>";
}
function approvalCard(a) {
  return '<div class="card"><div class="row"><b>Memo for ' + esc(a.deal_id) + '</b><span class="pill">' + esc(a.status) + "</span></div>" +
    '<div class="muted small">Submitted by ' + esc(a.submitted_by) + " · " + esc(new Date(a.submitted_at).toLocaleString()) + "</div>" +
    (a.status === "pending" ? '<div class="actions"><button class="primary" data-approve="' + esc(a.id) + '">Approve</button><button class="danger" data-decline="' + esc(a.id) + '">Reject</button></div>' : (a.comment ? '<div class="small">' + esc(a.comment) + "</div>" : "")) + "</div>";
}
function describe(a) {
  var d = a.detail || {};
  if (a.kind === "run.start") return null;
  if (a.kind === "delegation.start") return ["deleg", "Handed to <b>" + esc(a.actor_id) + "</b> v" + esc(a.agent_version)];
  if (a.kind === "delegation.rejected") return ["refused", "Handoff to " + esc(a.actor_id) + " refused: " + esc(d.reason)];
  if (a.kind === "delegation.complete") return ["", esc(a.actor_id) + " finished in " + (Math.round((d.durationMs || 0) / 100) / 10) + "s · " + money(a.cost_usd)];
  if (a.kind === "tool.call") return ["", esc(a.actor_id) + " → <code>" + esc(d.tool) + "</code>"];
  if (a.kind === "tool.refused") return ["refused", esc(a.actor_id) + " → <code>" + esc(d.tool) + "</code> refused: " + esc(d.reason)];
  if (a.kind === "proposal.created") return ["proposal", "Proposed a " + esc((KIND[d.kind] || d.kind || "").toLowerCase()) + " (" + esc(d.proposalId) + ")"];
  if (a.kind === "proposal.accepted") return ["proposal", esc(a.actor_id) + " accepted " + esc(d.proposalId)];
  if (a.kind === "proposal.rejected") return ["rejected", esc(a.actor_id) + " rejected " + esc(d.proposalId)];
  if (a.kind === "run.end") return ["", "Turn ended (" + esc(d.outcome) + ") in " + (Math.round((d.durationMs || 0) / 100) / 10) + "s · " + money(d.runCostUsd) + (d.bound ? " · bound: " + esc(d.bound) : "")];
  if (a.kind === "session.killed") return ["refused", "Stopped by the kill switch"];
  return ["", esc(a.kind)];
}
async function refreshActivity() {
  if (!state.thread) return;
  try {
    var rec = await api("/poc/sessions/" + encodeURIComponent(state.thread));
    var runs = {}, order = [];
    rec.activities.forEach(function (a) { var k = a.run_id || "other"; if (!runs[k]) { runs[k] = []; order.push(k); } runs[k].push(a); });
    var html = order.reverse().map(function (k, idx) {
      var items = runs[k].map(describe).filter(Boolean);
      if (!items.length) return "";
      return '<div class="card"><div class="row"><b class="small">Turn ' + (order.length - idx) + '</b><span class="muted small">' + esc(new Date(runs[k][0].at).toLocaleTimeString()) + '</span></div><ul class="timeline">' +
        items.map(function (it) { return '<li class="' + it[0] + '">' + it[1] + "</li>"; }).join("") + "</ul></div>";
    }).join("");
    $("activity").innerHTML = html + '<div class="muted small">Session cost so far: ' + money(rec.session.cost_usd) + " · " + esc(rec.session.tokens) + " tokens</div>";
  } catch (e) { $("activity").innerHTML = '<div class="muted small">Nothing yet in this review.</div>'; }
}
async function refreshSide() {
  var p = persona();
  try {
    if (p.role === "Approver") {
      $("waitingTitle").textContent = "Memos to approve";
      var ap = await api("/poc/approvals?approverId=" + p.id);
      $("waiting").innerHTML = ap.approvals.map(approvalCard).join("") || '<div class="muted small">No memos submitted to you.</div>';
    } else {
      $("waitingTitle").textContent = "Waiting for you";
      var pr = await api("/poc/proposals?status=pending");
      $("waiting").innerHTML = pr.proposals.map(function (x) { return proposalCard(x, p.role === "DealLead"); }).join("") ||
        '<div class="muted small">Nothing to accept. Proposals the agents make appear here.</div>';
      if (p.role !== "DealLead" && pr.proposals.length) $("waiting").insertAdjacentHTML("afterbegin", '<div class="muted small" style="margin-bottom:6px">Only the DealLead can accept or reject.</div>');
    }
    var k = await api("/poc/tenants/" + TENANT + "/kill-switch");
    $("kill").innerHTML = k.engaged ? '<span class="pill bad">Agents stopped</span> <button id="killBtn">Release</button>' : '<button class="danger" id="killBtn">Kill switch</button>';
    $("killBtn").onclick = function () {
      if (!k.engaged && !confirm("Stop every agent in " + TENANT + "?")) return;
      act(function () { return api("/poc/tenants/" + TENANT + "/kill-switch", { method: "POST", body: JSON.stringify({ engaged: !k.engaged }) }); });
    };
  } catch (e) { flash(e.message); }
  refreshActivity();
}
document.addEventListener("click", function (e) {
  var b = e.target.closest("button"); if (!b) return;
  if (b.dataset.accept) act(function () { return api("/poc/proposals/" + b.dataset.accept + "/accept", { method: "POST" }); });
  if (b.dataset.reject) { var why = prompt("Why reject? (optional)"); act(function () { return api("/poc/proposals/" + b.dataset.reject + "/reject", { method: "POST", body: JSON.stringify({ reason: why || null }) }); }); }
  if (b.dataset.approve) act(function () { return api("/poc/approvals/" + b.dataset.approve + "/decide", { method: "POST", body: JSON.stringify({ decision: "approved", comment: prompt("Comment (optional)") || null }) }); });
  if (b.dataset.decline) act(function () { return api("/poc/approvals/" + b.dataset.decline + "/decide", { method: "POST", body: JSON.stringify({ decision: "rejected", comment: prompt("Why? (optional)") || null }) }); });
});

// ---- Wiring ----
$("form").onsubmit = function (e) { e.preventDefault(); var v = $("input").value; $("input").value = ""; autosize(); send(v); };
$("input").addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("form").requestSubmit(); } });
function autosize() { var t = $("input"); t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 180) + "px"; }
$("input").addEventListener("input", autosize);
$("newThread").onclick = newThread;
$("persona").onchange = function () {
  store("dr-persona", $("persona").value);
  var last = store("dr-thread-" + persona().id);
  if (last && persona().role !== "Approver") openThread(last); else { state.thread = null; showEmpty(); loadThreads(); refreshSide(); }
};
(function start() {
  var saved = store("dr-persona"); if (saved) $("persona").value = saved;
  var last = store("dr-thread-" + persona().id);
  if (last && persona().role !== "Approver") openThread(last); else { showEmpty(); loadThreads(); refreshSide(); }
  setInterval(function () { if (!state.busy) refreshSide(); }, 15000);
})();
</script>
</body>
</html>`;
