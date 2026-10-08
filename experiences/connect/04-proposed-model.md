# Proposed model: the composition, and its one extension

Connect declares no table and includes no package. What follows is how the stacks it binds are configured to produce a listing exchange, and the single capability that binding requires and no stack yet has.

## The listing entity type

A listing is a tenant-authored entity type whose `handle` is `listing` ([`coredata/entity-fields/04-data-model.md`](../../coredata/entity-fields/04-data-model.md)). A broker attribute is a field definition; a value is a `field_values` row read in a unit context; an attribute nobody has configured yet is added as configuration and becomes filterable, sortable, derivable and searchable with no migration (CN1). Legacy's alternative (a `listings` table beside a `listing_properties` table whose width is the union of every source's vocabulary, with a hand-maintained allow-list naming which of those columns may be filtered on) is defect class 1 of [`01-legacy-pitfalls.md`](01-legacy-pitfalls.md).

Its standard bindings ([`coredata/entity-fields/07-standard-attributes-and-bindings.md`](../../coredata/entity-fields/07-standard-attributes-and-bindings.md)):

| Binding | What it holds |
|---|---|
| `status_field_handle` | The disposition of a listing the tenant has taken in — watching, pipelined, linked, comped. A select field has one live value by construction, a change-log history, and flow eligibility (CN12). **Passing on an offering is not here**: it is a decision about a publication the tenant never adopted, so it has no record to carry it and lives on the consumer's publication row ([`coreservices/syndication/04-proposed-model.md`](../../coreservices/syndication/04-proposed-model.md), R11). Legacy keys `listing_statuses` on the value itself, so nothing can be withdrawn and several dispositions co-exist |
| `title_field_handle` | The offering's display name |
| A location field | Not a binding — [`coredata/entity-fields/07-standard-attributes-and-bindings.md`](../../coredata/entity-fields/07-standard-attributes-and-bindings.md) declares `status`, `assignee` and `due_date` bindings and no location one. The type carries an ordinary location field, and radius and market queries run against the PostGIS point the projection derives from it ([`coredata/entity-fields/06-reads-projections-views.md`](../../coredata/entity-fields/06-reads-projections-views.md)) rather than an enrichment table's statistics blob |
| Lifecycle axes | Archival and retirement per [`coredata/entity-fields/16-lifecycle-and-archival.md`](../../coredata/entity-fields/16-lifecycle-and-archival.md), replacing `deactivated_at`/`deactivated_by` |

A second type, `listing_criterion`, stores a buy-side tenant's buy box: the geography, size, price and asset-class bounds a repository query is filtered by. Being an ordinary entity type with ordinary fields, a criterion is editable, shareable and agent-readable without a Connect mechanism.

Both types, their field definitions, their views and the intake defaults are provisioning content, so a freshly provisioned tenant has them (CN23). Brokerage reference records are dataset content ([`datasets/`](../../coredata/datasets/00-datasets.md)); legacy delivers them as migrations (defect class 12).

**Extraction output never reaches a record directly** (CN2). An extractor produces `proposed_values` rows, and acceptance runs the normal write path with its validation, field actions and change-log entry ([`coredata/entity-fields/05-writes-and-calculations.md`](../../coredata/entity-fields/05-writes-and-calculations.md)). This removes three legacy mechanisms at once: the per-property enhancement status columns, the importer's write of whatever columns the extractor's JSON happened to name, and the crawl's direct merge.

## The repository binding

A listing crosses a tenant boundary as a publication in syndication's platform-plane repository ([`coreservices/syndication/04-proposed-model.md`](../../coreservices/syndication/04-proposed-model.md)). Connect has no cross-tenant grant.

| Syndication object | What Connect puts in it |
|---|---|
| Publication | One `listing` record, published by its owning tenant or by the platform-operated intake publisher |
| Version | A new one per source update, so a consumer's refresh is idempotent against a content hash |
| Audience | `everyone` for an open marketing listing, `audience:<handle>` for a curated investor list, `tenants:[...]` for a named few |
| Disclosure set | Which of the listing's fields travel. A broker publishing an off-market offering discloses the address to a named audience and redacts it from everyone else, using the same field-rule vocabulary an admin uses internally |
| Subscription | Created at tag-in; binds the consumer's snapshot to the publication for refreshes |

**The sell-side act.** A brokerage tenant authors a listing as its own record, chooses an audience and a disclosure set, and publishes. Publishing is audited, and the publication records who shared what, with which rule, when. Withdrawing it stops discovery and stops refreshes; it does not delete what consumers did with it.

**The buy-side act.** A consumer queries the repository filtered by its own `listing_criterion` records, and tags in what fits. Tag-in creates a remoted entity in the consumer's tenant (GRO-79): a record of the consumer's own `listing` type whose provider-sourced fields are read-only and refreshable, and whose local additions are the consumer's. From that point it is a native record — commentable, attachable, edge-linkable, flow-eligible, and reachable by the consumer's agents. Fields the publication includes that the consumer's type does not define become read-only extras.

**Refresh and revocation.** A new publication version updates remoted values and leaves local additions untouched, recording the refresh in history. A narrowed audience or a withdrawal freezes the consumer's snapshot and marks it stale with the date; it does not vanish, because the consumer's annotations, edges and flow history are the consumer's data.

**The screens.** Before tag-in, the buy-side list is a query against the repository (a collection source registered on the ADR-0018 source registry, distinct from a `query` view over tenant records). After tag-in, everything is an ordinary view over ordinary records. [`experiences/workspaces/05-exemplar-workspaces.md`](../workspaces/05-exemplar-workspaces.md) §3 specifies the workspace that straddles the two.

## The intake bindings

Getting an offering into the product is three layers. The seam between the first two keeps one pipeline from becoming a place integrations accumulate ([ADR-0029](ADR-0029-connect-capability-boundary-and-listings-repository.md) decisions 6 and 7).

| Layer | What it does | Where it lives |
|---|---|---|
| Acquisition front | Holds the standing relationship with a third party: the authorization round trip, the push subscription and its renewal, the delta cursor, the webhook handshake, the guarded fetch. Produces raw payloads | A package per acquisition method |
| Arrival adapter | Authenticates the source, persists the payload, enqueues a run. Trivial by construction, and it does not parse | [`ingest/`](../../coredata/ingest/00-ingest.md) |
| Pipeline | Convert, map, validate, land, report — per record | [`ingest/`](../../coredata/ingest/00-ingest.md) |

A front owns no tenant schema, resolves no records, and never turns a payload into fields. `@neuro/ingest` gains no provider SDK, no mail client and no headless browser. The division of state follows the same line: what a source **is** stays on its `ingest_sources` row (kind, entity type, source map, `mode` and `match_on`, credential reference, schedule, exclusions); what a live connection **stores** belongs to its front (the subscription id and expiry, the delta cursor, the grant's state, and the health it reports). The two are joined by the source id.

| Legacy path | Front | `kind` | Where the record lands | Rejection |
|---|---|---|---|---|
| Broker feed (CBRE, JLL, driven by a scheduled workflow over S3) | Web acquisition — scheduled, guarded fetch of a site | `feed_pull` | The platform-operated intake publisher's tenant, then the repository as a publication — nobody asked for it and no tenant owns it | A failed run with finite backoff, then dead-lettered |
| Monitored mailbox (Microsoft Graph subscription) | Mailbox acquisition — OAuth, subscription lifecycle, delta reads | `api_pull` | The tenant that connected the mailbox, as its own `listing` record | Recorded on the run; the front reports a health transition naming its recovery path (CN16) |
| Forwarded email | **None.** The provider delivers and the adapter receives; this is the passive door the adapter contract describes | `email` | The tenant whose address it was forwarded to, as its own `listing` record. It never enters the repository (ADR-0029, amendment 2026-09-10) | Bounces with a reason — the four-gate protocol (I13) |
| Post-creation crawl of a listing's own URL | Web acquisition, same front as the feed — both are a scheduled, guarded fetch | `api_pull` | Proposed values on the record that carried the URL, in whichever tenant owns it | A record-level finding, never a payload rejection |

**One building, two owners.** Dana's forwarded copy is her record; a broker's publication of the same offering is the broker's. Both may exist, and the repository never merges them, because a merge would need one owner. What Dana sees is a consumer-side match: syndication's `matchHeldRecords` ([`../../coreservices/syndication/04-proposed-model.md`](../../coreservices/syndication/04-proposed-model.md) §Operations) applies the comparators of the extension below to publications visible to her against her tenant's records, and a hit is surfaced on both ("you already have this" on the publication, "the broker has published this" on her record) as a proposal she may act on by adopting, which subscribes her copy to the publisher's versions from then on. Legacy collapsed the two onto one shared row (`coreservices/syndication/01-legacy-pitfalls.md`, defect 6); this is the shape that replaces it.

Package names are a proposal, settled when the first front is built. Whether the feed and the crawl share one web front or take two is the same kind of question, and the answer is whichever leaves no acquisition code in `@neuro/ingest`.

Three legacy properties move into the pipeline without being re-derived: the encrypted-payload-with-a-purge-ceiling shape becomes a retention declaration ([`reference/modernization/23-shared-mechanisms.md`](../../reference/modernization/23-shared-mechanisms.md) §4); the source-message-id dedup window becomes the source's declared **deduplication** key, bounding repeat delivery of one message (CN5). It is not the record's identity (a sender's client supplies it, so it is an idempotency key and never an input to resolution ([`02-best-practice-research.md`](02-best-practice-research.md))); and the reconciliation sweep's policy (a pure function over a candidate, tested without a database) is the shape the reconciler keeps (CN17). Renewal and reconciliation belong to the mailbox front, as properties of the vendor's subscription.

**The forwarded-email gate is the `email` adapter's** (CN25). Sender identity is verified by the provider-authenticated envelope sender (ignoring the `From:` header), membership and the per-user hourly cap are checked before anything is stored, auto-responder senders and subjects are suppressed, and a rejection bounces with one of the four reasons. Legacy's gate lives in `the_wall/core/connect/controllers/connect_forwarded_email_controller.rb` and calls essos over gRPC once it passes; the adapter is one place instead of two, which removes the cross-service diagnosis the current-state assessment records as a friction.

**The broker feed is not ported.** Legacy enriches feed rows by shelling from Ruby to a Python `pyppeteer` script over a temp file (`essos/lib/utils/content_scraper.rb`, `essos/script/scrape_content.py`), driven by a manually dispatched workflow that executes a script inside a Kubernetes pod. The replacement is a web acquisition front producing payloads on a schedule, with extraction of what it fetched belonging to the extraction service. What is genuinely lost is the per-brokerage page structure knowledge encoded in that script; it is rebuilt against the extraction contract.

## The extension: probabilistic identity resolution

Ingest resolves identity by exact match over a declared candidate key: exactly one match updates, no match creates, several fail as ambiguous ([`coredata/ingest/04-proposed-model.md`](../../coredata/ingest/04-proposed-model.md), Record identity). The same building arriving as "123 Main St." from a feed and "123 Main Street, Suite 400" by forwarded email is not caught by any such key, and legacy's answer (one lossy normalized address key, stored on the row, repaired by migration when the derivation changes) is defect class 9.

`docs/coredata/ingest/` gains a probabilistic mode, opt-in per source, alongside the exact one. It belongs to `docs/coredata/ingest/` because an arrival that may be a record that already exists is every source's problem: legacy already solved it twice, narrowly and differently, in the bulk importer's per-type dedup and in essos's address key.

| Element | Shape |
|---|---|
| Comparators | A registered, declared set per source — street line, locality and region, the source's own offering identifier, the brokerage, the offering price. Each contributes a named, weighted feature |
| Blocking | Candidates are fetched by a derived key, recomputed from the record's field values rather than stored as the only copy, so a derivation change is a rebuild job with a run record rather than a backfill migration |
| Decision | A row per arrival weighed against one candidate, carrying the score, the features it was computed from, the verdict, and who or what decided |
| Bands | At or above the automatic threshold, the arrival's values become proposed values on the existing record. Between the thresholds, nothing is created and nothing is modified until a person or an authorized agent decides. Below the lower threshold, a new record is created through the normal write path |
| Reversal | A new decision referring to the one it reverses, never an edit. The history of what was decided on what evidence is not editable (CN6, CN8) |
| Thresholds and tables | Operator-tunable settings and tenant-scoped configuration — the abbreviation table and the region maps included, since a tenant operating outside the default regions needs different ones and legacy's answer to that was a code change (CN23) |

The concurrency guard is the one ingest already specifies: resolution and creation happen inside the record's single transaction, under an advisory lock on the hashed blocking key or a unique index where the key is stable enough to declare one. A probabilistic verdict does not change that; it changes what the transaction decides; enforcement is unchanged.

## Events and jobs

Every event a Connect consumer subscribes to is owned by the stack that owns the write. Arrival, per-record outcome and run completion are `ingest.*`. Record creation, value acceptance and disposition changes are entity-field events. Publication, refresh, audience change and withdrawal are `syndication.*`. Emitting a Connect-prefixed copy of any of them is a review finding.

The same applies to jobs. Subscription renewal, source reconciliation, the crawl, the match-key rebuild and the run timeout are the pipeline's and the bus's, with their windows and batch sizes as settings. Not one of them takes a payload as an argument, manages its own retry ceiling, or writes a terminal status of its own devising. Legacy does all of that per job; a forwarded email therefore has to be stashed encrypted on its row (defect class 7).

## Erasure

Erasing a tenant is each owning stack's obligation, and Connect adds no sweep of its own. Its records, proposed values, field values and change-log entries are the entity system's; its `ingest_sources`, arrivals, payload stashes and run records are the pipeline's, under its retention declaration; its publications and subscriptions are syndication's. Publications **to** a departing tenant are closed on departure, because the publishing tenant's audit trail is not the departing tenant's to erase (CN24). A consumer's frozen snapshots of another tenant's listings are the consumer's own records and erase with it.

## What this composition must not do

1. **Grow a Connect table, package or service.** The capability being reached for is in [`00-connect.md`](00-connect.md)'s table; if it genuinely is not, that is an amendment to the owning stack.
2. **Take on a cross-tenant grant.** The audience rule is syndication's, and a second grant mechanism would have to be reconciled with it on every read.
3. **Parse an arrival.** Transport shape (MIME, a spreadsheet, a feed row) is an arrival adapter's.
4. **Classify or extract.** A model's verdict is produced once by the extraction service and recorded on the run; every later stage reads it and never asks again (defect class 8).
5. **Decide visibility.** Access plans decide ([`authz/`](../../coreservices/authz/00-authorization.md)). A publication's audience says who may discover a listing; whether a given principal may read a record is not Connect's answer, and the workspace changes what a person is offered and never what they are allowed (ADR-0017).
6. **Index for search.** [`search/`](../../coreservices/search/00-search.md) owns the projections and their maintenance.
7. **Format anything.** Day grouping, timezone conversion, label formatting and a masked listing type are [`connect-screener/`](connect-screener/00-connect-screener.md)'s; operations return values, and timestamps leave in one representation (CN15).
8. **Read the environment class.** A rule that should differ per environment is a setting whose value differs per environment.
