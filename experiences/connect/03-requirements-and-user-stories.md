# Requirements and user stories

Requirement ids take the prefix `CN` and are cited by [`04-proposed-model.md`](04-proposed-model.md), [`05-interface-and-configuration.md`](05-interface-and-configuration.md), [`connect-screener/`](connect-screener/00-connect-screener.md), the Issues and the tests. An id is never reused or renumbered.

The `Owned by` column names the stack that satisfies the requirement, per [ADR-0029](ADR-0029-connect-capability-boundary-and-listings-repository.md). Connect appears in no row, because Connect builds nothing; a requirement whose owner is unclear is a gap in the composition and is the thing to argue about in review. "Acquisition front" names the per-method package that holds a third party's relationship, in front of ingest's arrival adapter ([`04-proposed-model.md`](04-proposed-model.md)).

## The people

| Who | What they need from Connect |
|---|---|
| **Dana** (buy-side deal lead) | To see what arrived since she last looked, decide quickly whether it is worth pursuing, and turn the ones that are into deals without retyping them |
| **Sam** (buy-side analyst, restricted visibility) | To work the offerings he is entitled to see, and to be unable to learn anything about the ones he is not — including how many there are |
| **Marcus** (sell-side broker) | To author his listings once, choose who sees which parts of them, publish, keep them current, and know whether anyone is engaging |
| **Priya** (admin) | To connect the team's deal-flow mailbox, see what would be picked up before committing to it, and know when the connection has broken and why |
| **Ops** | To answer "why did this forwarded email produce no card" from a record rather than by reading worker logs, and to know what a match decided and on what evidence |
| **The agent** | To enumerate what arrived in a period with its provenance, propose a disposition with reasoning, and draft the deal — through the same operations a person uses |

## Functional requirements

| # | Requirement | Legacy today | Owned by | Consumers |
|---|---|---|---|---|
| CN1 | An offering arriving from any source becomes a record of the tenant's listing entity type, with its attributes as field values | A dedicated schema; attributes are columns | `entity-fields/` | UI, agents, flows |
| CN2 | Extracted attributes are written as proposed values and reach the record only when a person or an authorised agent accepts them | The importer writes columns directly from extractor JSON | `entity-fields/` | UI, agents |
| CN3 | Every arrival produces exactly one intake run record, whatever the source | Only the two email paths have one; the broker feed and the crawl have none comparable | `ingest/` | Ops, UI |
| CN4 | A run record carries its source, source reference, outcome, attempts spent, and a structured error | `status` plus a `skip_reason` that holds either a vocabulary term or truncated exception text | `ingest/` | Ops |
| CN5 | Re-delivery of the same source message within the configured window creates no second record and is recorded as a duplicate | Present for the forwarded and mailbox paths, keyed on the normalised message identifier over a fixed window | `ingest/` | UI, Ops |
| CN6 | Matching an arrival to an existing record produces a resolution decision recorded with its score, its inputs and its verdict | No decision is recorded; a match is a silent merge and a miss is a silent duplicate | `ingest/` (extension) | Ops, UI, agents |
| CN7 | A resolution merges above the automatic threshold, proposes between thresholds, and creates below the lower one | One deterministic key, so the outcome is only merge or create | `ingest/` (extension) | UI, agents |
| CN8 | A merge is reversible from its recorded decision, without DDL | Corrected by data migrations naming individual brokerages | `ingest/` (extension) | Ops |
| CN9 | A record is owned by one tenant and readable by another only through an explicit publication audience | Readable by every tenant unless marked restricted, enforced in application code | `syndication/` | UI, agents, Ops |
| CN10 | A read with no resolved tenant fails rather than returning rows | Returns every tenant's child rows when the tenant is absent | `entity-fields/`, `authz/` | UI, agents |
| CN11 | A restricted actor cannot infer the existence, attributes or count of records they may not read | Counts and aggregates are not access-narrowed | `authz/` | UI, agents |
| CN12 | A disposition on a listing the tenant has taken in is one live value per record; changing or withdrawing it is recorded. Passing on an offering the tenant never took in is a decision about a publication and is `syndication/`'s R11, not a record status | A set of flags keyed on the value itself, so nothing can be withdrawn and several can co-exist | `entity-fields/`, `syndication/` | UI, flows |
| CN13 | Creating a deal or a comp from a record links the provenance, and repeating the act is idempotent | Present, through a non-atomic check plus a rescue that adopts the winner's row | `entity-fields/` (`entity_edges`) | UI, flows |
| CN14 | The activity timeline for a record is a paginated query over dispositions, arrivals and resolutions, returning values | Unbounded, merged and sorted in application memory, day-grouped and display-formatted | `entity-fields/`, `ingest/` | UI |
| CN15 | Every timestamp leaves an operation in one representation | Seconds on a record, milliseconds on a disposition, in the same payload | every stack | UI, agents |
| CN16 | A source connection reports its health as one of a closed set of states, each naming its recovery path | Present for the mailbox source | acquisition front | Priya, Ops |
| CN17 | A push subscription is renewed ahead of expiry, and a reconciliation pass closes out or re-drives what push missed | Present: a renewal schedule, a stored cursor, and an hourly sweep with a policy expressed as a pure function | acquisition front | Ops |
| CN18 | Connecting a source previews what it would ingest before the source is activated, and preview results are promoted or closed out on the decision | Present for the mailbox source | acquisition front, `ingest/` | Priya |
| CN19 | A fetch of a third-party URL validates the target as publicly routable, re-validates every redirect hop, and is not subject to a resolution race | The guard is present and thorough; by its own statement the rebinding race is open and redirect targets are validated by whoever follows them | web acquisition front | Ops |
| CN20 | A crawl merges nothing directly: its values are proposals, gated on a recorded same-record check | The gate is present; what passes it is written | `ingest/`, `entity-fields/` | UI, Ops |
| CN21 | An agent enumerates arrivals, dispositions and provenance through the same operations the UI uses, with no Connect-specific tool surface | A separate client in the legacy MCP server backs listing search | `agentic/` | Agents |
| CN22 | A tenant's records, publications, subscriptions, dispositions and run records move with a tenant transfer, carrying no environment-scoped identifier | A separate database per environment; identifiers and bucket names are environment-scoped | `transfer`, `syndication/`, `ingest/` | Ops |
| CN23 | A freshly provisioned tenant has the listing and criterion entity types, their field definitions, and the intake defaults | No provisioning path exists; brokerage reference data ships as migrations | `datasets/`, provisioning | Ops, Priya |
| CN24 | Erasing a tenant removes its run records, stashed payloads, proposals and records; publications to it are closed rather than deleted | A payload purge exists in the sweep; nothing else is erased | `ingest/`, `entity-fields/`, `syndication/` | Ops |
| CN25 | The forwarded-email door checks a provider-authenticated sender identity, membership, and a per-user rate cap before storing anything, suppresses auto-responders, and bounces a rejection with one of four reasons | Present and thorough, in `the_wall`'s controller rather than in the service that interprets the email | `ingest/` (`email` adapter) | Dana, Ops |
| CN26 | A sell-side tenant authors listings as records of its own listing entity type | Absent: brokers are not tenants and listings are not tenant-owned | `entity-fields/` | Marcus |
| CN27 | Publishing a listing selects an audience and a disclosure set, and is audited with who published what, under which rule, when | `listing_distributions` grants a listing to a team, with no field-level disclosure and no audit of the act | `syndication/` | Marcus |
| CN28 | A publisher's update produces a new publication version, and adopted copies refresh their provider-sourced values while local additions are untouched | Absent: a distribution is a grant on a row, so a consumer reads the publisher's current values and has nowhere to put its own | `syndication/` | Marcus, Dana |
| CN29 | Narrowing an audience or withdrawing a publication freezes adopted copies and marks them stale with the date, rather than deleting them | Absent | `syndication/` | Marcus, Dana |
| CN30 | A buy-side tenant queries the repository filtered by its own criteria records, before adopting anything | Absent: matching is a saved search over one shared listing table | `syndication/`, `views/` (ADR-0018 source registry) | Dana, agents |
| CN31 | Tag-in creates a record in the consumer's tenant whose provider-sourced fields are read-only and refreshable, and whose comments, attachments, edges and flow history are the consumer's own | Absent: a distributed listing is the same row read by another team | `syndication/` (GRO-79) | Dana, agents |
| CN32 | A publisher sees aggregate engagement with a publication without seeing a consumer's internal usage of its copy | Absent | `syndication/` | Marcus |

## Stories

**Marcus.** *"Put this offering in front of the twelve funds who buy this asset class, show them the address, and show everyone else the submarket."* → CN26, CN27

**Marcus.** *"The price changed. Everyone who took it should see the new one without me emailing anybody."* → CN28

**Marcus.** *"It went under contract. Stop showing it, but do not wipe out the notes anyone made."* → CN29, CN32

**Dana.** *"Show me what came in this week that looks like our buy box, and let me turn the good ones into deals without retyping the address."* → CN30, CN31, CN1, CN2, CN12, CN13, CN14, CN15

**Dana.** *"I took this listing in. Now let my analyst comment on it, attach the memo, and run the screening agent against it — the same as any other record."* → CN31, CN21

**Dana.** *"I forwarded that broker email twenty minutes ago and there's no card. Where did it go?"* → CN3, CN4, CN5, CN25

**Sam.** *"I can see the offerings my team is entitled to, and I should not be able to tell that there are others."* → CN9, CN10, CN11

**Priya.** *"Connect our deal-flow mailbox, show me the three most recent things it would pick up, and tell me before we commit."* → CN16, CN18, CN23

**Priya.** *"The mailbox stopped working and I need to know whether I have to re-authorise or just wait."* → CN16, CN17

**Ops.** *"Two teams say the same building appeared twice. What did the matcher decide, on what evidence, and can I undo it?"* → CN6, CN7, CN8, CN20

**Ops.** *"This tenant is moving to a dedicated site, and later it is leaving."* → CN22, CN24

**Ops.** *"A broker put a link in the email. Confirm we cannot be talked into fetching something on our own network."* → CN19

**The agent.** *"List what arrived since Monday with where each came from, propose a disposition for each, and draft the deal for the one Dana accepts."* → CN2, CN12, CN13, CN14, CN21

## Non-functional

- **Forwarded email to a visible record**: the legacy product budget is stated in the code as roughly two minutes, and is the reason the forwarded path is split across a synchronous handler and a job (`essos/resque/extract_forwarded_email_job.rb:1-3`, CON-1 NFR-1). It is carried as the target here, and it is a property of the pipeline rather than of a hand-tuned pair of timeouts — [`coredata/ingest/03-requirements-and-user-stories.md`](../../coredata/ingest/03-requirements-and-user-stories.md) I4, I7 and I12 govern the mechanism (the payload persisted before interpretation, the per-record ledger, and the run as a `job_status` job with live progress).
- **Stashed payload retention**: a raw arrival held for re-drive is retained for a declared period and no longer, as a retention declaration per [`reference/modernization/23-shared-mechanisms.md`](../../reference/modernization/23-shared-mechanisms.md) §4 rather than a cron with a constant. Legacy's ceiling is a code constant enforced by the sweep (CN24).
- **Repository queries are bounded**: a repository browse is cursor-paginated with an enforced maximum page size, the same as a tenant record list. A buy-side tenant's criteria narrow the query at the source, applied before the fetch (CN30).
- **Timeline reads are bounded**: no read returns an unbounded set. The screener's timeline and the record list are cursor-paginated, and the page size has an enforced maximum (CN14).
- **Sam's negative guarantee is testable**: a request from a restricted actor for a record they may not read, a filter that would match it, an aggregate that would count it, and an export that would include it all return the same answer as if the record did not exist (CN11).
- **The external principal's access plan is unchanged by the workspace**: for an `is_external = true` principal, the resolved plan is byte-identical with and without the Connect workspace applied. A difference means the workspace is doing access control ([`experiences/workspaces/05-exemplar-workspaces.md`](../workspaces/05-exemplar-workspaces.md) §3, T1).
- **No operation reads the environment class to decide a rule**, per the constraint on defect class 11 in [`01-legacy-pitfalls.md`](01-legacy-pitfalls.md). Behaviour that differs per environment is a setting with a different value.
