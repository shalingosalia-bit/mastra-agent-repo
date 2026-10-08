---
type: spec-stack
kind: experience
status: proposed
status_checked: 2026-10-07
owner: Frances Lo
secondary: Shalin Gosalia
pod: Connect & Pipeline
outcomes: [CO-4, CO-5, CO-7, CO-10, FO-1, FO-2, FO-5, FO-9]
agentic: true
depends_on: [coredata/entity-fields, agentic/agentic, coreservices/documents, coreservices/flow, experiences/views, experiences/mcp]
format: 2
---
# Deal Review (POC)

## Delivered Experience

Deal review takes a new deal from its first check against the buy box to an approved decision. Poor fits are dropped early, and each decision rests on sourced evidence.

## Covers

1. **Checking a deal against the buy box,** criterion by criterion, after the DealLead confirms how each criterion is read.
2. **Tracing every value** to the field or document page it came from.
3. **Proposing values found only in documents,** for the DealLead to accept or reject.
4. **Screening from Claude,** with the same verdict as in the app.
5. **Comparing with comps,** flagging values outside the Tenant's comps.
6. **Chasing open criteria,** as one proposed task per criterion that fails or is unknown.
7. **Drafting and approving a decision memo,** recorded on the deal.
8. **The agents' rules:** its eval cases, guardrails and sign-off triggers, on AI Platform's foundation.

## User Experiences

| # | User experience | Kind | Where | What the User gets |
|---|---|---|---|---|
| UX1 | Screen a New Deal | Combined | The agent panel on a deal | A verdict for each criterion, with the source of every value |
| UX2 | Confirm the Criteria | Agentic | The agent panel, before UX1's check | The agent's reading of each criterion, to correct before it checks |
| UX3 | Review Found Values | Visual | Proposal cards on the deal | Each value found only in a document, to accept or reject |
| UX4 | Screen From Claude | Agentic | Claude, through the Neuro MCP connector | The same confirmation and verdict, as tables in the conversation |
| UX5 | Chase Open Criteria | Combined | The agent panel, then proposal cards on the deal | One proposed task per open criterion, to accept or reject |
| UX6 | Compare With Comps | Agentic | The agent panel | Price, cap rate and price per unit against the comps' range |
| UX7 | Decide and Record | Combined | A proposal card, then Flow's approval on the deal | A sourced memo, approved and recorded |

### Outputs

UX1. A broker sends a new deal, an apartment complex in Austin, with an offering memorandum attached. On the deal's page, the DealLead asks the agent to check it against four criteria from the buy box. The agent replies:

| Criterion | The deal's value | Verdict | Source |
|---|---|---|---|
| Property type is multifamily | Multifamily | Pass | Deal field: Property type |
| Market is in the Sun Belt | Austin, TX | Pass | Deal field: Market |
| Price is $20M to $60M | $68M asking price | Fail | Offering memorandum, page 4 |
| Going-in cap rate is above 5.5% | None found | Unknown | No field or document states it |

The asking price appears only in the offering memorandum, so UX3 offers it as a proposal, with **Accept** and **Reject**.

## Outcomes Served

| Outcome | What changes for the client |
|---|---|
| CO-4 Screen and triage quickly | A verdict per criterion from one request |
| CO-5 Benchmark against comps and history | Each key value is shown against the Tenant's comps |
| CO-7 Package the deal for IC and get it approved | A sourced memo goes to approval in one step |
| CO-10 Run diligence and close on time | Each open criterion becomes an owned, dated task |
| FO-1 Delegate work to agents | The agents do the follow-up, and the DealLead approves |
| FO-2 Verify an agent's work | Every value names its source |
| FO-5 Govern and audit agent actions | The deal records who approved which memo, on which evidence |
| FO-9 Work where people already are | The same screening from Claude |

## Success Measures

| Measure | Kind | Today | Target | How it is measured |
|---|---|---|---|---|
| Values in a verdict with a cited source | Target | Not measured | Every value | The cited-source scorer, run over the screening eval cases |
| Time from request to verdict | Target | Manual | The time bound in `05` §Bounds and Cost | The session's start and end activities |
| Values reported that no field or document states | Guardrail | Not measured | Zero | The unknown-when-absent eval case |
| Open criteria with a proposed task | Target | Not measured | Every open criterion | The session's proposal activities, against the verdict |
| Agent writes without an accepted proposal | Guardrail | Not recorded | Zero | Each write matched to its accepted proposal in the session's activity |
| Memo figures with a cited source | Guardrail | Not measured | Every figure | The memo eval case |
| Cost per review | Guardrail | Not measured | Within the cap in `05` §Bounds and Cost | The session's cost, recorded at its end |

## Interoperable With

| Experience | What passes |
|---|---|
| [Connect](../connect/00-connect.md) | A deal created from an adopted listing can be screened like any other deal |

## Not Responsible For

| Concern | Owner |
|---|---|
| Sessions, bounds, the eval harness, and the rule that an agent proposes every write | [`agentic/`](../../agentic/agentic/00-agentic.md) |
| A deal's fields, what they mean to an agent, and the proposal record and its acceptance | [`entity-fields/`](../../coredata/entity-fields/00-entity-fields.md) |
| Listing a deal's documents and reading their text | [`documents/`](../../coreservices/documents/00-documents.md) |
| Moving a deal's status after a screening | The DealLead, through [`flow/`](../../coreservices/flow/00-flow.md) |
| Tasks, approvals, deadlines and escalation | [`flow/`](../../coreservices/flow/00-flow.md) |
| Storing the accepted memo as a file | [`documents/`](../../coreservices/documents/00-documents.md) |
| The comps and their values | The Tenant's comp records, through [`entity-fields/`](../../coredata/entity-fields/00-entity-fields.md) |
| A Tenant's stored buy box | [Connect](../connect/00-connect.md), as `listing_criterion` records |

## Pitfalls

| Mistake | What happens | Do this instead |
|---|---|---|
| Building the agents from the MCP beta's deal tools | The agents keep no record and write when called | Work backward from the flow to Neuro operations, as `04` §Composition does |
| Recommending pass or pursue | An agent makes the DealLead's decision | Give verdicts and evidence; the memo states the DealLead's decision |
| Adding a screening table or package | The experience builds a piece another stack should own | Record the need as an Extend or New row in `04` §Composition and a row in `04` §Gaps |
