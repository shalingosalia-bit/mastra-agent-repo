# Requirements and User Stories

Deal review serves a DealLead who drops poor fits on day one and takes good ones to an approved decision. It also serves an Analyst with less visibility. Its requirements make every value cite its source, and every write wait for a User to accept it.

## Personas

| Persona | Actor | Job | Today they use | What stops them switching |
|---|---|---|---|---|
| Dana | DealLead | When a deal arrives, I want to check it against our criteria, so I can drop it the same day | Reading the deal and its documents by hand, or asking the MCP beta | A value she cannot trace to its source |
| Sam | Analyst, restricted from some fields | When I screen a deal Dana passes me, I want a verdict on what I can see, so I can prepare it for her | The same manual reading | A verdict that shows values he may not see |
| The agent | Agent | When asked for a screening, I want criteria mapped to fields, so I can check each one | Nothing: the beta has no screening tool | Criteria that match no field |

## Terms

| Term | Meaning here |
|---|---|
| Buy box | The Tenant's investment criteria, such as property type, market, size and return, that a new deal must meet |
| Verdict | Pass, fail or unknown for one criterion, with the value and its source |
| Proposal | A change the agent offers, written only when a User accepts it |
| Competence | What an agent can be asked to do to one type of record, such as `screening` on `deal` |

## Stories

| Persona | Story | User experience | Requirements |
|---|---|---|---|
| Dana | A User asks for a new deal to be checked against the buy box, and sees a verdict for each criterion with its source | UX1 | DS3, DS4, DS5, DS9, DSN1, DSN3 |
| Dana | A User confirms how the agent reads each criterion before the check runs | UX2 | DS1, DS9 |
| Dana | A DealLead accepts an asking price the agent found in the offering memorandum, and it is recorded once | UX3 | DS6, DS7, DS8 |
| Dana | A User asks for a screening in Claude, and gets the same verdict as in the agent panel | UX4 | DS10 |
| Dana | A DealLead asks the agent to chase the open criteria, and accepts one proposed task per criterion | UX5 | DS11, DS12, DS13, DS14 |
| Dana | A DealLead sees the deal's price, cap rate and price per unit against the Tenant's comps | UX6 | DS15, DS16, DS17 |
| Dana | A DealLead accepts a drafted memo, submits it, and the approvers' decision is recorded on the deal | UX7 | DS18, DS19, DS20, DS21, DSN5 |
| Sam | An Analyst who cannot read a field sees Unknown for the criterion that uses it | UX1 | DS2 |
| The agent | The agent stops a screening at its cost bound with the criteria checked so far, or at once on the Tenant's kill switch | UX1 | DSN2, DSN4 |

## Functional Requirements

| # | Requirement | Verified by |
|---|---|---|
| DS1 | A stated criterion resolves to the Tenant's own field and options, or the agent asks the DealLead | |
| DS2 | The agent sees only what the User who asked can see. A field hidden from that User is unknown in the verdict | |
| DS3 | The agent reads the deal's associated properties and loans | |
| DS4 | The agent lists the deal's documents and reads their extracted text | |
| DS5 | Every value in a verdict cites its field, or its document and page | |
| DS6 | A value found only in a document is offered as a proposal, and never written to the deal | |
| DS7 | Accepting a proposal twice writes once | |
| DS8 | The `abstraction` competence is declared on `deal`, as it is on `lease` and `loan` | |
| DS9 | The agent's answer shows the verdict as a view: one row per criterion, each source linked | |
| DS10 | A screening through Claude returns the same verdict as one in the agent panel | |
| DS11 | Each criterion marked Fail or Unknown gets exactly one proposed task, naming the criterion, unless a bound stops the run first | |
| DS12 | A proposed task is assigned to a deal team member who can read the deal, or to no one | |
| DS13 | No task exists until the DealLead accepts its proposal | |
| DS14 | Accepting a task proposal twice creates one task | |
| DS15 | The agent compares the deal's price, cap rate and price per unit with the Tenant's comps for the same market and property type | |
| DS16 | Each value outside the comps' range is flagged, naming the comps it was compared with | |
| DS17 | With fewer than three matching comps, the agent says so and flags nothing | |
| DS18 | The memo quotes only values from the verdict, the comparison and the tasks, each with its source | |
| DS19 | Nothing is saved on the deal until the DealLead accepts the memo | |
| DS20 | An accepted memo is saved as a file on the deal, attributed to the DealLead and the agent | |
| DS21 | Submitting the memo creates an approval for the Tenant's approvers, and their decision is recorded on the deal | |

## Non-Functional Requirements

| # | Requirement | Verified by |
|---|---|---|
| DSN1 | A verdict returns within the time bound in `05`, at the 95th percentile | |
| DSN2 | One screening costs no more than the Solution Profile's per-request cap | |
| DSN3 | Every screening runs as a session that records what the agent read, proposed and spent, and the version of each agent | |
| DSN4 | A Tenant's kill switch stops every running screening session in that Tenant | |
| DSN5 | The deal's record links each approval to its memo and to the session that drafted it | |

## Out of Scope

1. **Recommending pass or pursue.** The agents give verdicts and evidence. The decision stays with the DealLead and the approvers.
2. **Changing the deal's status.** No agent moves a deal through its stages, even after an approval.
3. **Editing a proposed task before accepting it.** The DealLead accepts it, then edits it in the task list.
4. **Underwriting.** The comparison uses the deal's fields and comps, with no financial model.
5. **Saved criteria and fund buy boxes.** Criteria are stated per request. A stored buy box is Connect's `listing_criterion`.

Sources: Shalin Gosalia's deal screening draft in pull request #1399; the shared personas in `.claude/terms/actors.md`.
