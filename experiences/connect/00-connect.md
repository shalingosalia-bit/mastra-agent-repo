---
type: spec-stack
status: design-only
---
# Connect: listings published by one tenant, worked by another

Connect is the listing exchange. A brokerage authors listings as its own records and publishes selected ones to a chosen audience; an investor sees what it is in the audience for, adopts what interests it, and works those listings in its own tenant (commenting, attaching, running agents, and creating deals from them). Offerings from brokers who are not on the platform reach the same repository through a bulk feed, a monitored mailbox, or an email a User forwards.

> **Status: design only.** Nothing described here is built on Neuro, and no package will be built for it. The legacy implementation is `the_wall/essos`, a Sinatra and gRPC service over a dedicated MySQL database with its own Resque workers and OpenSearch index; `docs/reference/legacy_assessments/current-state/20-listings-connect-essos.md` is its current state. The substrate is partly built: `entity-fields` and `search` are built, `ingest` is partly built, `views` and `workspaces` are partly built, and `syndication`, `documents` and `federation` are design only.

**Kind: composition.** Connect owns no table, no package and no service. Every capability it needs is specified by a stack that already owns it, and this stack states which, binds them together, and specifies the one extension the composition requires. That is the decision of [ADR-0029](ADR-0029-connect-capability-boundary-and-listings-repository.md), and a proposal to add a Connect-owned table or package is a review finding whose burden is to show the capability is absent from the table below.

## Where each concern lives

| The concern | The stack that owns it |
|---|---|
| A listing's attributes | [`entity-fields/`](../../coredata/entity-fields/00-entity-fields.md) — a tenant-authored `listing` entity type over the value spine |
| Publishing a listing to an audience | [`syndication/`](../../coreservices/syndication/00-syndication.md) — publications, versions, audience rules, disclosure sets |
| Seeing and adopting another Tenant's listing | [`syndication/`](../../coreservices/syndication/00-syndication.md) — the repository, tag-in, remoted entities, refresh and freeze-on-revoke (GRO-79) |
| Reaching out to a mailbox, a broker site, or a listing's own URL | An acquisition front per method — a package holding only the vendor relationship |
| Turning what arrived into records | [`ingest/`](../../coredata/ingest/00-ingest.md) — an `ingest_sources` row per path, and the five shared stages |
| The forwarded-email door's gates and its bounce protocol | [`ingest/`](../../coredata/ingest/00-ingest.md) — the `email` adapter contract (I13) |
| Deciding whether an arrival is a record that already exists | [`ingest/`](../../coredata/ingest/00-ingest.md) — `mode` and `match_on`, extended here with a probabilistic mode |
| Filtering, matching against criteria, and text search | [`search/`](../../coreservices/search/00-search.md) |
| A disposition on a listing the Tenant took in: watching, pipelined, linked | [`entity-fields/`](../../coredata/entity-fields/00-entity-fields.md) — the type's status field |
| Passing on an offering the Tenant never took in | [`syndication/`](../../coreservices/syndication/00-syndication.md) — a decision on the publication, creating no record |
| The deal or comp a listing became | `entity_edges`, traversable from both ends |
| Images and offering memoranda | [`documents/`](../../coreservices/documents/00-documents.md) over `@neuro/storage` |
| The views a User triages in | [`workspaces/`](../workspaces/00-workspaces.md) — the Connect Buy-Side exemplar, over [`views/`](../views/00-views.md) |
| The components those views render | [`connect-screener/`](connect-screener/00-connect-screener.md) |
| Listing data leaving the platform | [`federation/`](../../coreservices/federation/00-federation.md) |

Legacy's structure is the evidence for reading Connect this way. Essos is an implementation of remote viewing of syndicated content with a surface built for that one use case, and each of its mechanisms is a narrow version of one Neuro specifies generally: `listing_distributions` is a publication grant, `ListingStatus` is a status field expressed as flags, the `INGESTION_SOURCE` values are three doors onto one pipeline, and `sunspear/app/components/connect` is a workspace whose shape is code.

Secret handling, signed capability tokens, the structured-error envelope, retention declarations, the one-live-row-per-key index and the ledger contract are specified once in [`reference/modernization/23-shared-mechanisms.md`](../../reference/modernization/23-shared-mechanisms.md) and consumed by the stacks above.

## The two sides

Sell-side and buy-side are one mechanism read from two ends; they are not built in sequence.

| | Sell-side | Buy-side |
|---|---|---|
| Who | A brokerage Tenant | An investor Tenant |
| The listing | Its own record, authored in its Tenant | A remoted entity adopted from the repository |
| The act | Publish to an audience, with a disclosure set | Browse the repository, tag in what fits |
| What they may change | Every value; the audience; the disclosure set | Their own additions only — comments, attachments, edges, locally-added fields |
| What flows | Updates out, as new publication versions | Refreshes in, overwriting provider-sourced values and leaving local additions alone |
| The surface | A publishing workspace over their listing records | The Connect Buy-Side workspace |

A listing sourced from a broker who is not a Tenant reaches the repository through a platform-operated intake publisher instead. It is a publication like any other, so a consumer's experience does not depend on which kind of publisher sourced it.

## Who consumes the capability

- **A buy-side Principal** screens what arrived against their criteria, sets a disposition, and turns what fits into a deal without retyping it.
- **A Broker** authors a listing, chooses who sees which of its fields, publishes, and sees engagement in aggregate.
- **Agents** answer "what came in this week that fits our buy box", propose a disposition with reasoning, and draft the deal through the same operations a User uses, with no Connect-specific tool surface.
- **A TenantAdmin** connects a deal-flow mailbox, previews what it would pick up before committing, and learns when a connection has broken and why.
- **An Operator** answers why a forwarded email produced no card from a record (not from logs), and sees what a match decided and on what evidence.

## The documents

| Doc | What it settles |
|---|---|
| [`01-legacy-pitfalls.md`](01-legacy-pitfalls.md) | How essos works, and the constraint each defect class imposes on the composition |
| [`02-best-practice-research.md`](02-best-practice-research.md) | The settled answers for listing exchanges, entity resolution and mailbox integration, and what does not apply |
| [`03-requirements-and-user-stories.md`](03-requirements-and-user-stories.md) | The capability per consumer as numbered `CN` requirements, each naming the stack that satisfies it |
| [`04-proposed-model.md`](04-proposed-model.md) | The composition: the listing entity type, the repository binding, the intake bindings, and the one extension |
| [`05-interface-and-configuration.md`](05-interface-and-configuration.md) | What a TenantAdmin and an Operator configure, across the stacks the composition binds |
| [`06-legacy-functionality-map.md`](06-legacy-functionality-map.md) | Every essos model, job, route and script, with a disposition naming its owning stack |
| [`07-essos-transition.md`](07-essos-transition.md) | The compatibility constraint on essos, the cutover sequence, and the contracts that must keep working |
| [`08-cross-stack-review.md`](08-cross-stack-review.md) | The three stacks read together: parity with Connect as it exists, the seller experience, reuse of Neuro's constructs, the edge-case register, and the opportunities the design opens |

Requirement ids take the prefix `CN` instead of the single letter [`../../spec-stack-template.md`](../../spec-stack-template.md) rule 5 asks for. `C` belongs to [`comms/`](../../coreservices/messaging/channels/00-channels.md), and `CON` is the tracker prefix legacy Connect work is filed under and that essos source cites in comments (`essos/lib/models/listing_email_ingestion.rb:107`), so a requirement numbered `CON1` would look like an issue id.
