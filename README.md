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

Or test everything from one page: the **deal review app** at http://localhost:4111/poc/app. It has the chat with your past reviews, the proposals waiting for you with Accept and Reject, what the agents did on each turn (handoffs, tools, cost), a switch between Dana, Raj and Morgan, and the kill switch.

Then open the **review panel** at http://localhost:4111/poc/review:

5. As Dana Kim (DealLead), accept or reject each proposed task and the memo. An accepted task becomes a work item. An accepted memo is saved on the deal and submitted to Flow.
6. Switch to Morgan Lee (Approver) and approve or reject the memo. The deal records who decided and on which evidence.
7. Open a session's record to see each run: who acted, which agent version, what it cost and how it ended.

The DealLead accepts proposals only in the panel. The supervisor can't accept, save or submit anything.

### The deal-review workflow

**Workflows → deal-review** runs the standard review as a fixed sequence, with each pause for the DealLead enforced by the engine rather than the supervisor's instructions (`workflows/deal-review.ts`, built from `workflows/screening-steps.ts`). Every input and reply is a sentence in your own words, and the run is its own session, at `/poc/sessions/<runId>`.

1. **Run** with a request, e.g. `Screen Riverside Flats: multifamily only, cap rate at least 5.5%, asking price under $60M.`
2. It pauses with the mapping. Reply `Looks good, go ahead.`, correct it (`Price means purchase price.`) or `Stop.` Nothing is checked until you reply.
3. It checks, then decides on two things the verdict shows, asking you yes or no each time:
   - **Outside the buy box:** if property type or market failed, `Continue the review anyway?` A no ends the review and proposes a note on the deal saying why. Deals in the buy box skip this.
   - **Missing data:** if any criterion is Unknown, `Shall I propose requests for the missing values?` A yes has the task specialist propose a request for each. Deals with nothing missing skip this.
4. It pauses with the verdict. Reply with what's next, e.g. `Chase the open criteria and compare with comps.`, `All of it. My decision: pursue to LOI.` or `Stop.`
5. It runs only what you asked for, in the order tasks, comps, memo, and ends with a summary of what waits for you in the review panel.

A field the model names that doesn't exist, or that the User can't read, becomes a question instead of a mapping. Your yes, no and what's-next replies are read in code, not by a model, so the workflow never runs a step you didn't ask for; an unclear yes or no gets the question again. To run one specialist on its own, ask the supervisor (`Just compare Riverside with comps.`) or chat with that specialist in **Agents**.

### What each agent can do

Reads are direct. Every write is a proposal the DealLead accepts in the review panel, and no tool can change a deal's stage, status or owner.

| Agent | Reads | Proposes |
|---|---|---|
| Supervisor | `session-status`: what ran, what's pending, cost so far, the kill switch | Nothing; it routes |
| Screening | `find-deal`, `search-deals`, `describe-deal-fields`, `read-deal`, `check-criteria` | `propose-field-value`: a value someone stated, with its source |
| Comparison | `compare-to-comps` (optionally recent comps only, or without some), `list-comps` | Nothing |
| Task | `read-deal-team`, `list-deal-tasks` | `propose-task`, `propose-task-change` (reassign or move a due date), `propose-deal-note` |
| Memo | `list-session-sources`, `list-session-proposals` | `propose-memo` |

Try, in the supervisor's chat: `Which deals are in screening?`, `Show me the Austin comps that sold this year.`, `Compare Riverside with comps sold since January only.`, `The broker says the asking price on Riverside is $61M, put that on the deal.`, `Move the cap rate task to Ana and give her until the 20th.`, `Note on Riverside: broker wants best and final by the 20th.`, `Where are we on this review?`

Request context keys: `userRole` (`DealLead` or `Analyst`), `userId` (`U-1` Dana Kim, `U-2` Raj Patel) and `tenantId` (`T-demo`). As an Analyst, the seller reserve becomes Unknown. `Lamar Station` has only two comps, so the comparison refuses to flag.

## What the POC tests, by layer

| Layer (brief §Foundation by Layer) | Where |
|---|---|
| Orchestration: route, hand off, park, stop at bounds | `agents/supervisor.ts`, `foundation/bounds.ts`: 25 steps, 8 per specialist, 60 s per run, $2 per run (the Solution Profile caps at $0.50; set `MASTRA_RUN_COST_BOUND_USD` to change it). Parked time between turns doesn't count |
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

[`evals/golden/`](evals/golden/README.md) holds the golden set: prompts per agent with the result each must give, for manual runs in Studio. For a guided walkthrough of every agent, tool and workflow in one conversation, use the [demo script](evals/golden/demo-script.md).

## Deploy

```sh
npm run deploy   # mastra deploy to Mastra platform
```

**Keep data across deploys.** By default the app stores chats, sessions, proposals and accepted values in a local `mastra.db` file, which each deploy starts empty. To keep them, create a hosted LibSQL database at [turso.tech](https://turso.tech), then set two environment variables on the Mastra platform project and redeploy:

| Variable | Value |
|---|---|
| `MASTRA_DB_URL` | The database URL, `libsql://<name>-<org>.turso.io` |
| `MASTRA_DB_AUTH_TOKEN` | A token for that database (`turso db tokens create <name>`) |

The app creates its tables on first start. To return to the sample data, empty the database's `poc_*` tables or point at a new database.

Deploy reads the target project from `.mastra-project.json`. If the first deploy writes one, commit it so later deploys target the same project. The Mastra Factory server that works issues on this repo lives in its own repo ([mastra-factory](https://github.com/shalingosalia-bit/mastra-factory)). `.claude/skills/mastra-factory` lets Claude Code inspect and operate it through `mastra api factory`.

## Not in the sandbox

- **Claude through Bedrock.** Set `MASTRA_MODEL` and the `MASTRA_PRICE_*` variables once the provider is approved.
- **Neuro reads, Flow, documents, the verdict view section and `@neuro/flags`.** `data/fixtures.ts` and the `poc_*` tables stand in for them.
- **Authentication.** The `/poc` routes trust the `x-user-id` header, so don't expose a deployment beyond the team.
