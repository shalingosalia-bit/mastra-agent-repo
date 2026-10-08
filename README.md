# mastra-agent-repo

Mastra sandbox for the Agentic Foundation POC: deal review, from screening to an approved decision.
Scope and requirements: [`experiences/briefs/agentic-foundation-poc.md`](experiences/briefs/agentic-foundation-poc.md) and [`experiences/deal-screening/05-agentic-experience.md`](experiences/deal-screening/05-agentic-experience.md).

## Run it

```sh
npm install
cp .env.example .env   # add ANTHROPIC_API_KEY
npm run dev            # Mastra Studio at http://localhost:4111
```

Open **Deal review supervisor** in Studio and try:

1. `Screen Riverside Flats: multifamily only, cap rate at least 5.5%, asking price under $60M, seller reserve under $57M.`
2. `Confirmed.`
3. `Chase the open criteria.`
4. `Compare it with comps, then draft the memo.`

Then open the **review panel** at http://localhost:4111/poc/review:

5. As Dana Kim (DealLead), accept or reject each proposed task and the memo. An accepted task becomes a work item. An accepted memo is saved on the deal and submitted to Flow.
6. Switch to Morgan Lee (Approver) and approve or reject the memo. The deal records who decided and on which evidence.
7. Open a session's record to see each run: who acted, which agent version, what it cost and how it ended.

The DealLead accepts proposals only in the panel. The supervisor can't accept, save or submit anything.

Request context keys: `userRole` (`DealLead` or `Analyst`), `userId` (`U-1` Dana Kim, `U-2` Raj Patel) and `tenantId` (`T-demo`). As an Analyst, the seller reserve becomes Unknown. `Lamar Station` has only two comps, so the comparison refuses to flag.

## What the POC tests, by layer

| Layer (brief §Foundation by Layer) | Where |
|---|---|
| Orchestration: route, hand off, park, stop at bounds | `agents/supervisor.ts`, `foundation/bounds.ts`: 25 steps, 8 per specialist, 60 s per run, $0.50 per run. Parked time between turns doesn't count |
| Agent registry, versioned | `foundation/registry.ts`. Every session activity records the agent's version |
| Guardrails | `foundation/guard.ts`: a tool runs only if both the User and the agent hold its grant. `foundation/kill-switch.ts`: one switch per Tenant aborts its running sessions and refuses every tool |
| Proposals | `foundation/proposals.ts`: one proposal per act; accepting twice yields one work item |
| Human approval and audit | Memo approval by the DealLead's manager; `poc_deal_record` records who decided and on which evidence |
| Evals | `evals/`: deterministic cases in `foundation.test.ts`, model cases in `agents.test.ts` (need `ANTHROPIC_API_KEY`) |
| Tools and data | `tools/`: arithmetic and verdicts happen here, not in the model. Values read in a session form its source ledger, and a memo may quote only those (case 12) |
| Observability | `poc_sessions` and `poc_activities`: cost and tokens per run and per delegation |

## HTTP routes

| Route | For |
|---|---|
| `GET /poc/review` | The review panel |
| `GET /poc/proposals?status=pending&dealId=` | Proposals |
| `POST /poc/proposals/:id/accept` · `/reject` | The DealLead's decision (`x-user-id` header) |
| `GET /poc/approvals` · `POST /poc/approvals/:id/decide` | Flow approvals (`{"decision":"approved"}`) |
| `GET /poc/sessions` · `/poc/sessions/:id` | Session records |
| `GET /poc/deals/:id/record` | Work items, files, approvals and decisions on a deal |
| `GET`/`POST /poc/tenants/:id/kill-switch` | The kill switch (`{"engaged":true}`) |
| `GET /poc/agents` | The agent registry |

In the sandbox, the acting person comes from the `x-user-id` header. In Neuro it is the signed-in User.

## Evals

```sh
npm test         # every case; the model cases are skipped without ANTHROPIC_API_KEY
npm run evals    # only the model cases
```

CI (`.github/workflows/ci.yml`) typechecks, runs the cases and builds. Add an `ANTHROPIC_API_KEY` repository secret to run the model cases there too.

## Not in the sandbox

- **Claude through Bedrock.** Set `MASTRA_MODEL` and the `MASTRA_PRICE_*` variables once the provider is approved.
- **Neuro reads, Flow, documents, the verdict view section and `@neuro/flags`.** `data/fixtures.ts` and the `poc_*` tables stand in for them.
- **Authentication.** The `/poc` routes trust the `x-user-id` header, so don't expose a deployment beyond the team.
