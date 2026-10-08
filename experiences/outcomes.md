---
type: outcome-register
owner: Ursula Sage, Jeff Blasbalg and the PM team
pod: Product
state: draft
phase: 1b
---

# Client outcomes

The outcomes Dealpath builds toward, and the experience stacks that serve each one. Ursula Sage, Jeff Blasbalg and the PM team own and revise the list. Other documents cite its IDs and do not change them.

Source: Ground Up Vision Plan (September 2026), slides 8 and 9.

## Rules

1. **IDs are stable.** `CO-n` is an outcome clients need today, `FO-n` one to support in the future. A retired outcome keeps its ID with the state Retired; a new one takes the next number.
2. **Every experience stack and brief names the outcomes it serves** in its frontmatter `outcomes`. Its flows, evals and guardrails are worked out backward from them.
3. **Served by is generated** from that frontmatter by `bun run experiences:index`. An outcome no experience serves yet shows none.
4. **Progress is updated** when the tool evidence or an experience changes, in the same pull request.

## Progress

The Progress column says how far Dealpath is toward each outcome. Each step needs the one before.

| Step | Meaning | Evidence |
|---|---|---|
| 0 No capability | Nothing in Dealpath or the MCP beta serves it | — |
| 1 Exists | A tool or feature serves it | [Tool evidence](evidence/mcp-tools-to-outcomes.md) |
| 2 Used | Clients use those tools: at least 100 beta calls in the 30 days before 19 August 2026, not counting cross-cutting tools | The same map's Beta calls column |
| 3 Delivered | An experience on Neuro does the job for the User | [Experience stacks](README.md) |
| 4 Measured | That experience meets its success measures | The experience's own measures |

1. FO-9 is the one exception to the beta-call rule: clients use the MCP connector itself for it.
2. At steps 1 and 2, the client's own AI client does the work with Dealpath's raw tools.
3. No outcome is at step 3 yet. The POC aims to take CO-4, CO-5, CO-7 and CO-10 there.

## Outcomes clients need today

| ID | Outcome | So that | Who cares most | Progress |
|---|---|---|---|---|
| CO-1 | Capture every deal that comes in | No deal from a broker email or OM gets lost, and it goes into the pipeline cleanly | Analyst, Associate | 1 Exists |
| CO-2 | Source off-market and broker deals | The firm sees deals that match its buy box before competitors do | Acq. VP, Associate | 1 Exists |
| CO-3 | Know the firm's contacts and touchpoints | The firm sees its whole network, which deals each relationship is tied to, and every interaction | Acq. VP, Associate, Capital Markets | 2 Used |
| CO-4 | Screen and triage quickly | The team kills bad deals on day one and focuses on the ones that fit | Analyst, Acq. VP | 2 Used |
| CO-5 | Benchmark against comps and history | Pricing and assumptions have support from the market and past deals | Analyst, Associate | 1 Exists |
| CO-6 | Underwrite and compare scenarios | The firm knows what the deal is worth and what changed between versions | Analyst, Associate | 1 Exists |
| CO-7 | Package the deal for IC and get it approved | The committee decides quickly using one trusted package | Associate, VP, IC | 1 Exists |
| CO-8 | Arrange and track debt | Financing is lined up before close and every loan's terms and status stay current | Capital markets, Associate, Asset mgt | 1 Exists |
| CO-9 | Manage an investment as one record from deal to asset | Everything about an investment stays connected from pipeline to owned asset | Portfolio manager, Asset manager, CIO | 2 Used |
| CO-10 | Run diligence and close on time and thoroughly | No critical date, document, risk or third-party report slips | Deal team, Txn mgr | 2 Used |
| CO-11 | Allocate deals to funds and sectors | Each deal goes to the right vehicle in line with allocation policy, with an audit trail | Deal team, Txn mgr | 0 No capability |
| CO-12 | Fund investments and track capital movements | Capital moves on time and in the right amounts, tied to the right fund for LP reporting | Fund controller, IR, Portfolio manager | 1 Exists |
| CO-13 | Manage assets after close | Leases, loans and key dates on owned assets stay current | Asset manager | 2 Used |
| CO-14 | Report on pipeline, portfolio and funds | Leadership and LPs get accurate numbers without a quarter-end scramble | Head of acq., CIO, IR | 2 Used |
| CO-15 | Keep the team aligned | Everyone knows the status, their next task and who is waiting on whom | Everyone | 2 Used |
| CO-16 | Encode the firm's process and connect its data | Dealpath matches how the firm works and talks to its other systems | Admin, Ops, Data team | 0 No capability |

## Outcomes to support in the future

| ID | Outcome | So that | Who cares most | Progress |
|---|---|---|---|---|
| FO-1 | Delegate work to agents | People hand off a whole job instead of clicking through it | Associate, VP | 0 No capability |
| FO-2 | Verify an agent's work | Every number, claim and paragraph traces to its source before anyone relies on it | Associate, IC member | 1 Exists |
| FO-3 | Monitor agents at scale | Leads see what agent runs are doing, and which are stuck, wrong or costly | Acq. VP, Ops | 0 No capability |
| FO-4 | Teach and correct agents | The firm's buy box, standards and style become the agent's defaults | VP, CIO | 0 No capability |
| FO-5 | Govern and audit agent actions | The firm can prove who or what did what, with what data and whose approval | Compliance, CIO | 1 Exists |
| FO-6 | Measure what agents are worth | Leadership sees hours saved, deals screened and errors caught | Head of acq., CIO | 0 No capability |
| FO-7 | Get alerted before being asked | Agents raise passed deals to revisit, rolling leases and covenants at risk | VP, Asset mgr | 0 No capability |
| FO-8 | Learn from the firm's own history | Past decisions, pass reasons and results inform the next deal | CIO, Associate | 1 Exists |
| FO-9 | Work where people already are | Users get outcomes in Claude, ChatGPT, Excel, Slack or email without switching | Everyone | 2 Used (the MCP connector in Claude) |
| FO-10 | Collaborate with counterparties | Brokers, lenders, partners and LPs exchange information through agents | Deal team, IR | 0 No capability |
| FO-11 | Answer LP and investor questions | IR answers exposure and tracking questions instantly and correctly | IR, Portfolio manager | 0 No capability |
| FO-12 | Plan strategy and capital | Leaders model shifts in allocation against live data | CIO, Portfolio manager | 0 No capability |

## Served by

<!-- served-by:begin -->
| Outcome | Served by |
|---|---|
| CO-4 | [Deal Review (POC)](deal-screening/00-deal-screening.md), [A DealLead takes a deal from screening to an approved decision through agents](briefs/agentic-foundation-poc.md) (brief) |
| CO-5 | [Deal Review (POC)](deal-screening/00-deal-screening.md), [A DealLead takes a deal from screening to an approved decision through agents](briefs/agentic-foundation-poc.md) (brief) |
| CO-7 | [Deal Review (POC)](deal-screening/00-deal-screening.md), [A DealLead takes a deal from screening to an approved decision through agents](briefs/agentic-foundation-poc.md) (brief) |
| CO-10 | [Deal Review (POC)](deal-screening/00-deal-screening.md), [A DealLead takes a deal from screening to an approved decision through agents](briefs/agentic-foundation-poc.md) (brief) |
| FO-1 | [Deal Review (POC)](deal-screening/00-deal-screening.md), [A DealLead takes a deal from screening to an approved decision through agents](briefs/agentic-foundation-poc.md) (brief) |
| FO-2 | [Deal Review (POC)](deal-screening/00-deal-screening.md), [A DealLead takes a deal from screening to an approved decision through agents](briefs/agentic-foundation-poc.md) (brief) |
| FO-5 | [Deal Review (POC)](deal-screening/00-deal-screening.md), [A DealLead takes a deal from screening to an approved decision through agents](briefs/agentic-foundation-poc.md) (brief) |
| FO-9 | [Deal Review (POC)](deal-screening/00-deal-screening.md), [A DealLead takes a deal from screening to an approved decision through agents](briefs/agentic-foundation-poc.md) (brief) |
<!-- served-by:end -->

## Changes

| Date | Change | By |
|---|---|---|
| 2026-10-05 | First register from the Vision Plan slides 8 and 9, mapped to the POC's two experiences, with a Progress column from the tool evidence | Shalin Gosalia |
| 2026-10-07 | The POC became deal review across three pillars, so it aims CO-4, CO-5, CO-7 and CO-10 at step 3, and no longer CO-15 | Shalin Gosalia |
