# Cross-stack review: parity, the seller experience, and reuse

A review of [`connect/`](00-connect.md), [`connect-screener/`](connect-screener/00-connect-screener.md) and [`syndication/`](../../coreservices/syndication/00-syndication.md) together, against three questions: whether the design subsumes the Connect offering as it exists, whether it supports a brokerage as a publisher, and whether Connect stands on constructs Neuro already has rather than growing its own. Findings that were defects are corrected in the documents they belong to and pointed at from here; what remains here is the reasoning, the edge-case register, and the opportunities the design opens that legacy cannot reach.

Read against `origin/develop` after the two stacks landed, and against `the_wall` at `origin/major`.

## Verdict

| Question | Answer | What had to change |
|---|---|---|
| Does Neuro subsume Connect as it exists? | Yes, for every buy-side capability legacy has — with one correction to where forwarded deal flow lands | Forwarded and mailbox arrivals were routed through the platform repository; they are the forwarding tenant's own records (ADR-0029 amendment 2026-09-10) |
| Can Neuro offer a brokerage a publisher's experience? | Yes, and it is mostly Classic with a different sitemap. One shared component is new | A sell-side workspace exemplar, a tenant blueprint for a brokerage, and the reopen-after-withdrawal lifecycle (R17) |
| Does Connect reuse Neuro's constructs? | Yes. Every concern maps to a specified or built primitive, and the one it needed that did not exist went into ingest rather than into Connect | One invented binding removed; GRO-79's four open design questions answered where its first consumer needed them answered |

## Subsuming Connect as it exists

The parity check is [`../../coreservices/syndication/01-legacy-pitfalls.md`](../../coreservices/syndication/01-legacy-pitfalls.md) §Buy-side coverage, which maps every legacy route to a requirement, and [`06-legacy-functionality-map.md`](06-legacy-functionality-map.md), which maps every legacy artifact to a disposition. Between them nothing legacy does for a buy-side user is unaccounted for. Reading the two together against the syndication model surfaced three things the individual documents had not.

**Forwarded deal flow is private and was being made public.** ADR-0029 decision 4 named the platform-operated intake publisher as carrying what the forwarded-email door produces. Read with decisions 6 and 7 — a forwarded email is an `email` ingest source of the forwarding tenant — that cannot be right: ingest lands a tenant's arrivals as that tenant's own records. An offering Dana forwards would have entered the platform-plane repository and Dana would have had to adopt her own listing. Legacy routed it through the shared store only because essos was the only store it had. The amendment to ADR-0029 fixes the meaning without rewriting the decision, and [`04-proposed-model.md`](04-proposed-model.md) §The intake bindings now says where each path's record lands. The intake publisher carries exactly one thing: the broker-feed scrape, which no tenant asked for.

**Passing on an offering was in two places.** `passed` appeared as a value of the adopted record's status field in this stack and as a pre-adoption disposition on the publication in syndication's R11. A consumer who has not adopted has no record to carry a status, so the record's status field carries only what a tenant that took the listing in can be. Fixed in three places in this stack, and the screener's decision bar now states that it calls one of two operations depending on whether a record exists ([`connect-screener/04-proposed-model.md`](connect-screener/04-proposed-model.md)).

**The screener's timeline had no row for a pre-adoption decision.** Its entry kinds were arrivals and record events. A pass on an offering the tenant never adopted is neither, and legacy's activity feed shows exactly those. A `Disposition row` kind is added, sourced from the consumer's publication row history.

Two things legacy does are deliberately **not** carried, and both are recorded as defects rather than gaps: collapsing two tenants onto one physical listing row (syndication defect 6) and visibility that defaults to open (defect 1). The design replaces the first with per-consumer snapshots and the second with default-closed audience rules, and the migration mapping for legacy's three listing types is in [`07-essos-transition.md`](07-essos-transition.md).

## The seller experience

Legacy has no brokerage as a tenant. Brokers reach it as a scraped website or as the sender of an email. So there is no parity to check, only whether the design supports the persona, and the review found it does with less new surface than expected.

A brokerage is an ordinary tenant with an ordinary `listing` type. Its marketing process — broker opinion of value, listing agreement, marketing, under contract, closed — is the type's status field with flow over it, which is Classic. Publishing is an operation on a record it already owns. What is specific to the seller is small, and each piece is now specified:

| What a seller needs | Where it is |
|---|---|
| A workspace: my listings, what is published, my audiences, who engaged | [`../workspaces/05-exemplar-workspaces.md`](../workspaces/05-exemplar-workspaces.md) §3b, the fourth exemplar — Classic with a different sitemap, and the acceptance test that the workspace model needs no per-workspace code |
| Publish, republish, withdraw, set audience | [`../../coreservices/syndication/05-interface-and-configuration.md`](../../coreservices/syndication/05-interface-and-configuration.md) operations; the story set in [`../../coreservices/syndication/03-requirements-and-user-stories.md`](../../coreservices/syndication/03-requirements-and-user-stories.md) |
| Back on the market | R17 — a withdrawn publication reopens and previously-adopted copies thaw. Under-contract-then-fell-through is routine in this industry and was unstated |
| Attribution that consumers cannot strip | R12 |
| Aggregate engagement without seeing inside a consumer | R8, with the suppression floor in `syndication/05` |
| A firm-wide stop | R14 |
| Provisioning as a brokerage | Not yet a blueprint. GRO-749 provisions the buy-side pair; a brokerage needs `listing` with publisher-side fields and no `listing_criterion`. Filed as follow-on work below |

One genuinely new component: the disclosure-set editor, where a publisher chooses per field what travels. It is shared rather than Connect's — a tenant admin setting internal field visibility needs the same editor — and the exemplar records it as such rather than claiming nothing new.

## Reuse of Neuro's constructs

Every Connect concern, and the construct it stands on:

| Concern | Construct | State |
|---|---|---|
| A listing's attributes | Entity type over the value spine | Built |
| Disposition after adoption | `status_field_handle` binding | Built (ADR-0007) |
| Disposition before adoption | `publication_consumers` | Design, `syndication/04` |
| The deal an offering became | `entity_edges` | Built |
| Extracted attributes awaiting acceptance | `proposed_values` | Built |
| Arrival, run record, ledger | `ingest_sources`, the five stages | Partly built |
| Reaching a mailbox or a site | Acquisition fronts | Design |
| Likeness matching | Ingest's probabilistic identity mode | Design, GRO-745 |
| Cross-tenant visibility | Publication audience rule | Design |
| A consumer's copy | Remoted entity | Design, GRO-79 |
| Repository query in a workspace | ADR-0018 collection source | Registry built, source not |
| The triage shell | Workspace contract | Partly built |
| The components | `connect-screener/` over `@neuro/ui` | Design |
| Platform-plane store | The pattern of ADR-0018 and ADR-0022 | Precedent built |

Two corrections came out of building this table. [`04-proposed-model.md`](04-proposed-model.md) cited a `location_field` binding; [`../../coredata/entity-fields/07-standard-attributes-and-bindings.md`](../../coredata/entity-fields/07-standard-attributes-and-bindings.md) declares status, assignee and due-date bindings and no other, so the type carries an ordinary location field and the projection derives the PostGIS point. And GRO-79, the remoted-entity model issue everything buy-side stands on, left four design questions open for its first consumer; syndication is that consumer, and [`../../coreservices/syndication/04-proposed-model.md`](../../coreservices/syndication/04-proposed-model.md) §Answers to GRO-79's design questions now states them so the model issue has a specification to build to.

One sequencing fact is not a document defect but belongs here: GRO-79 sits in `GRO:Field System Close-out` in Todo, while ADR-0029 puts it on the critical path of three W3 projects. Nothing buy-side ships before it does.

## Edge-case register

Each is stated in the document that owns it; this is the index.

| Edge case | Owner |
|---|---|
| One building, two publishers — co-brokerage, or a forwarded copy beside a broker's publication. Never merged; surfaced as a consumer-side match | `04-proposed-model.md` §The intake bindings; `syndication/04` §Edge cases 1 |
| Disposition is per tenant, not per person | `syndication/04` §Edge cases 2 |
| Passed, then the price dropped | `syndication/04` §Edge cases 3 — the pass stands; the version event is what a rule acts on |
| Adopted, built a deal, then withdrawn — the deal stays, the edge points at a frozen record | `syndication/04` §Edge cases 4 |
| Archived by the consumer, then republished — refresh applies, archival stands | `syndication/04` §Edge cases 5 |
| Disclosure narrowed after adoption — delivered values stay, marked no longer refreshed | `syndication/04` §Disclosure changes after adoption |
| Withdrawn, then reopened — adopted copies thaw on the same record | R17; `syndication/04` §Lifecycle |
| Legacy `Private` listings have no owner-chosen audience | `07-essos-transition.md` §Migrating legacy visibility |
| Intake-publisher copy superseded by the broker's own publication | `syndication/04` §Edge cases 10 |
| Consumer or publisher tenant relocates or leaves | `syndication/04` §Edge cases 8–9, §Erasure |
| The decision bar is one affordance over two operations | `connect-screener/04` |

## Opportunities the design opens for a commercial-real-estate audience

Each is something legacy cannot do at all, and each rides a construct the design already has. None is a requirement yet; they are the reasons the composition is worth more than parity, and candidates for the product roadmap rather than for these stacks.

1. **Tiered, terms-gated disclosure.** Off-market offerings are marketed as a teaser to a wide audience and a full package to those who sign a confidentiality agreement. The model has the pieces — a disclosure set per audience, a `termsRef` on the publication, acceptance recordable at adoption — and lacks only the rule that acceptance moves a consumer into a wider-disclosure audience. Legacy has public or private, and nothing between.
2. **Expressions of interest.** The one direction the model does not carry is a consumer choosing to reveal itself to a publisher — "we are interested, send the package". R8 keeps consumers private by default; an opt-in reveal is a consumer-initiated event on `publication_consumers`, and it is the start of every deal conversation in this industry. It is also the answer to the question every broker asks first about engagement.
3. **Brokers as tenants with a pipeline.** A listing is a record with flow. A brokerage's marketing process runs on the same record it publishes. The two lifecycles stay separate — the marketing stage is the record's status field, the publication's state lives in the repository and nowhere else — but a broker sees both on one record, and a rule can connect them (under contract withdraws; back on market reopens) without either becoming the other. Legacy brokers are a scraped website.
4. **Change alerts on what you passed.** Versions exist, so "an offering you passed on dropped its price" is a rule over an event. Legacy has no versions and no way to say a listing changed.
5. **The buy box as a publishable object.** A buyer's `listing_criterion` records are records, and the same repository machinery can publish them to an audience of brokers — "we are looking for this" — so brokers match offerings to stated demand instead of blasting. Reverse syndication, on the mechanism already specified, with no new construct: a criteria repository is a second entry in the repository registry.
6. **Comps and market data as a second repository.** GRO-79's stated precedent is legacy's External Records — MSCI, RCA, CompStak comps surfaced beside native ones as a hardcoded special case. A comps repository is a registry entry ([`../../coreservices/syndication/05-interface-and-configuration.md`](../../coreservices/syndication/05-interface-and-configuration.md) §Extension points), and the model says a second repository must require no code; this is where that claim gets tested.
7. **Cross-firm deal collaboration.** UC3 in syndication: a joint-venture partner, a lender and a borrower, or a buyer and seller under contract sharing a bounded record set, each side's contributions attributed. Same publication, audience and remoted-entity machinery, with a bidirectional publication rather than a one-way one. The furthest from parity and the largest.
8. **Engagement as a broker product.** Aggregate views and adoptions by audience over time is a dashboard view over `publisherEngagement` — analytics no broker gets from a blast email.

## Follow-on work

Filed or to file, in the projects that own them:

1. A brokerage tenant blueprint — `listing` with publisher-side fields, marketing-stage status options, contacts, no `listing_criterion` — `GRO:Connect Sell-Side`.
2. The disclosure-set editor as a shared component — `GRO:Tenant Administration`, since internal field visibility needs it first.
3. Reopen a withdrawn publication (R17) — `GRO:Syndication`, as an amendment to GRO-752's scope.
4. Re-sequencing GRO-79 against the three W3 projects that depend on it.
