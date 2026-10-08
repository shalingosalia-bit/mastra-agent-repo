# ADR-0029: Connect's capability boundary and the listings repository

**Date:** 2026-09-09
**Status:** Accepted
**Scope:** neuro

## Context

Connect is how property offerings reach a tenant from outside it — a broker's bulk feed, an email a deal lead forwards, a monitored mailbox, a link on a brokerage site — and how a person or an agent triages what arrived. Legacy implements it as `essos`, a service inside `the_wall`'s repository with its own MySQL database, its own Sinatra and gRPC servers, its own Resque workers, and its own OpenSearch index. `docs/reference/legacy_assessments/current-state/20-listings-connect-essos.md` establishes its current state.

Two facts force the decision now.

1. **Essos is taking active feature work.** Outlook mailbox auto-ingestion and AI-driven property enhancement are landing, with migrations dated into 2026-08. Feature work continues to land on a system whose target shape is unrecorded, and each addition is surface whose eventual home is unknown.
2. **The question as previously posed has no correct answer.** `docs/coreservices/syndication/04-proposed-model.md` and this ADR's tracker issue (GRO-33) both frame the choice as *evolve essos* versus *a new repository service*. Both options assume Connect is a service that owns a listings domain. Every capability that assumption bundles together is separately specified and separately owned on Neuro, and choosing between two placements for a bundle that should not exist would build the bundle.

The capabilities essos bundles, and where each is already specified:

| What essos does | The Neuro stack that owns it |
|---|---|
| Holds listing attributes in typed columns | `docs/coredata/entity-fields/` — a tenant-authored entity type over the value spine |
| Reaches out to a mailbox, a broker site, a listing's own URL | An acquisition front per method, in front of ingest's arrival adapter |
| Accepts a payload and turns it into records | `docs/coredata/ingest/` — `ingest_sources` and the five shared stages, with arrival as an adapter |
| Gates the forwarded-email door and bounces with a reason | `docs/coredata/ingest/` — the `email` adapter carries the four-gate protocol (I13) |
| Decides whether an arrival is a record that already exists | `docs/coredata/ingest/` — `mode` plus `match_on`, resolved per batch under an identity guard |
| Makes a listing readable by a tenant that does not own it | `docs/coreservices/syndication/` — publications, audiences, disclosure sets in a platform-plane repository |
| Lets a consumer adopt a listing as their own record | `docs/coreservices/syndication/` — remoted entities, subscriptions, refresh, freeze-on-revoke (GRO-79) |
| Filters and text-matches listings | `docs/coreservices/search/` |
| Records a disposition | `docs/coredata/entity-fields/` — the type's status field |
| Links the deal an offering became | `entity_edges` |
| Presents the triage surface | `docs/experiences/workspaces/` — the Connect Buy-Side exemplar, over `docs/experiences/views/` |
| Delivers listing data to systems outside the platform | `docs/coreservices/federation/` |

Legacy's own structure is evidence for reading it this way rather than against it. Essos is a nascent implementation of remote viewing of syndicated content, with a focused surface over that one use case: `listing_distributions` is a hand-rolled publication grant, `ListingStatus` is a disposition field expressed as flags, the three `INGESTION_SOURCE` values are three arrival adapters, and `sunspear/app/components/connect` is a workspace whose shape is code. Each is a narrow, per-domain version of a capability Neuro specifies once and generally.

Constraints on the answer:

1. The live MCP contract (`EssosClient` in the `dealpath/mcp` repository) exposes listing search as an agent tool today and must keep working through the transition.
2. The forwarded-email gate lives in `the_wall`'s `core/connect/controllers/connect_forwarded_email_controller.rb`, not in essos, so any answer that moves listing interpretation must say what happens to the gate.
3. Buy-side listings are visible to a tenant before that tenant owns anything, so their pre-adoption home cannot be a tenant's database.
4. `docs/coredata/ingest/` resolves identity by exact match over a declared candidate key. The same building arriving as two differently-written addresses is not caught by any such key.

## Decision

1. **Connect is a capability composition, not a module.** No `@neuro/connect` package is built, and `docs/experiences/connect/` specifies a composition rather than a service. Each concern is met by the stack that already owns it, per the table above. A proposal to add a Connect-owned table, package, or service is a review finding, and the argument it has to defeat is that the capability it wants is already specified somewhere in that table.

2. **A listing is an entity type.** Every attribute a source supplies is a field definition over the value spine; every value is a `field_values` row. Legacy's split of listings out of the entity model is an artifact of essos being a separate service with a separate database, not a design.

3. **The listings repository is syndication's platform-plane store, from the first build.** A listing that a consuming tenant has not adopted is a publication in the repository specified by `docs/coreservices/syndication/04-proposed-model.md`, carrying an audience rule and a disclosure set. Adoption is tag-in: the consumer's copy is a remoted entity, its provider-sourced fields read-only and refreshable, its local additions the consumer's own (GRO-79). A consumer works an adopted listing as a native record — comments, attachments, edges, workflow, and agents all act on it — and the one thing they cannot do is change a value that originated with the publisher.

4. **A listing is owned by the tenant that authored it, and syndication is one mechanism read from two ends.** A sell-side tenant — a brokerage — authors listings as its own records of its own `listing` entity type, then publishes selected ones to a chosen audience. A buy-side tenant sees what it is in the audience for and tags in what interests it. Publishing and adoption are the two halves of `docs/coreservices/syndication/`, so sell-side Connect is not a later inversion of a buy-side design; it is the origin of the data the buy-side consumes, and both are specified together.

   Two publisher kinds exist, and only the second is transitional. A **tenant publisher** is a brokerage on the platform publishing its own records — the intended shape, and the one the sell-side surface is built for. A **platform-operated intake publisher** carries listings from brokers who are not tenants, which is what legacy's broker-feed scrape and its forwarded-email door produce *(the forwarded-email half is superseded — see Amendment 2026-09-10 below; for implementation, the intake publisher carries the broker-feed scrape only)*; it is the mechanism `docs/coreservices/syndication/04-proposed-model.md` open question 5 asks for. Both produce publications in the same repository under the same audience and disclosure rules, so a consumer's experience does not depend on which kind sourced a listing.

5. **No Connect-owned grant table is built.** Cross-tenant readability is the publication's audience rule, and one grant mechanism exists across the platform. A Connect-side table of per-tenant read grants would be a second one, resolved against the first on every read.

6. **Acquisition is a front per method; ingest begins at the payload.** `docs/coredata/ingest/04-proposed-model.md` states the arrival adapter's whole job as authenticate, persist the payload, enqueue a run — deliberately trivial, and deliberately not parsing. That holds for a door something arrives at. It does not describe reaching out and maintaining a standing relationship with a third party, which is what a monitored mailbox and a broker feed require: an authorization round trip, a push subscription created, renewed and expired, a delta cursor, a webhook validation handshake, and a fetch of a site that does not want to be read by a machine.

   That work is an **acquisition front** — its own package per acquisition method, sitting in front of ingest's arrival adapter and handing it raw payloads. A front owns the vendor relationship and nothing else: it holds no tenant schema, resolves no records, and never parses a payload into fields. `@neuro/ingest` gains no vendor client, no headless browser and no provider SDK, which is what keeps one pipeline from becoming a place integrations accumulate.

   The seam divides a source's configuration from its session. What a source *is* stays on its `ingest_sources` row — kind, entity type, source map, mode and `match_on`, credential reference, schedule, exclusions, and the settings the pipeline reads. What a live connection *holds* belongs to its front — the subscription id and expiry, the delta cursor, the authorization grant's state, and the health the front reports. The two are joined by the source id, and the cost is two rows per connected source rather than one.

7. **Connect's four intake paths need three fronts and one plain door.** The forwarded-email door is a passive arrival and needs no front: the mail provider delivers, and ingest's `email` adapter receives, exactly as its contract describes. The monitored mailbox, the broker feed and the post-creation crawl each reach outward and get a front, with the feed and the crawl candidates for one web-acquisition front rather than two, since both are a scheduled, guarded fetch of a site. Package names are a proposal, settled when the first is built.

8. **Ingest gains one extension: identity resolution gets a probabilistic mode.** A declared comparator set producing a score with its recorded features, an automatic-merge threshold, a proposal band that creates nothing until a person or an authorized agent decides, and a reversal that is a new decision rather than an edit. Exact `match_on` remains the default and the probabilistic mode is opt-in per source. This belongs in `docs/coredata/ingest/` rather than in a front or in Connect, because an arrival that may be a record that already exists is every source's problem — legacy solved it twice, narrowly and differently — and it operates on mapped records, which is after every front has finished.

9. **The forwarded-email gate is the `email` adapter's.** Sender identity verified against the provider-authenticated envelope sender, membership and rate gates, auto-responder suppression, and bounce-with-reason are `docs/coredata/ingest/04-proposed-model.md`'s email adapter contract. `docs/coredata/ingest/05-legacy-functionality-map.md`'s statement that the listing interpretation stays with essos is superseded by this ADR.

10. **The triage surface is the Connect Buy-Side workspace.** Navigation, home surface, chrome mode, and entity-type focus are the workspace contract; the screens are views; the components those views render are `docs/experiences/connect/connect-screener/`. No bespoke external surface is built, which is what keeps the external-principal safety argument short: an external principal's access comes from per-record grants alone (`docs/coreservices/authz/10`), and the workspace changes what they are offered, never what they are allowed (ADR-0017).

11. **Essos continues under a compatibility constraint.** Feature work keeps landing while Neuro's composition is built, subject to three rules: no new listing attribute becomes a typed column where a field definition would serve, no new bespoke retry, scheduling, or search machinery is added where the target stack has one, and no new intake path is added that is not expressible as an ingest source. Its build and deploy stay inside `the_wall`'s image; extracting them buys an independent release for a service being retired.

12. **Cutover is per tenant, and the MCP contract is repointed rather than restarted.** `EssosClient`'s listing-search tool keeps its shape and is served from the Neuro side once a tenant's listings are resident there. A tenant is cut over when its listing entity type, its sources, and its repository subscriptions exist on Neuro; essos is retired when no tenant is left on it.

## Alternatives considered

**Evolve essos in place.** Harden the existing Ruby service, add a typed contract, and keep the `dplistings` database. Rejected because it preserves the bundle: the listings domain stays separate from the entity model, cross-tenant readability stays a second grant mechanism beside syndication's, intake stays four bespoke paths beside the ingest pipeline, and the triage surface stays code beside the workspace contract. It defers every one of those merges rather than deciding it, and it keeps a Ruby and Python runtime that no other part of Neuro uses.

**A new repository service on Neuro primitives.** Restate the listings domain as a standing service on the target runtime. Rejected because it is the same bundle on a better runtime. It would own listing storage that the field system owns, an intake path that ingest owns, and a grant mechanism that syndication owns — and it carries integration work the evolve option does not, since the forwarded-email gate would have to be re-hosted or called out to across a boundary.

**Composition, with a Connect module for the leftovers.** Compose the substrate stacks, but keep a small `@neuro/connect` holding the three concerns that appear to have no other home: identity resolution, source connections, and cross-tenant grants. Rejected on inspection of each. Source connections duplicate `ingest_sources`, down to its per-kind settings and credential references. Grants duplicate syndication's audience rule and would have to be reconciled with it on every read. Resolution is a capability every ingest source needs, not a listings one, which is why it becomes decision 8's extension rather than a fourth stack's private copy. Nothing survived the inspection, so no module is built.

**Defer the repository placement to GRO-80.** Record the entity-type answer and leave the cross-tenant store open. Rejected because the buy-side surface is unbuildable without it: the workspace exemplar's `matched_listings` is a query against the repository before tag-in, so leaving the repository undecided leaves the flagship surface's first screen undesigned.

## Consequences

**Required by this decision**

1. `docs/coredata/ingest/` gains the probabilistic identity mode: comparator registry, scored decision with recorded features, threshold bands, proposal and reversal operations, and the rebuild path for a derivation change.
2. Three acquisition fronts are built and specified — a mailbox front, and one or two web fronts for the broker feed and the crawl. Each is a package with its own connection state, its own health reporting, and no dependency on the tenant schema.
3. `docs/coredata/ingest/04-proposed-model.md`'s arrival-adapter contract states what sits in front of it for a source that reaches outward, so the contract's "deliberately trivial" claim stays true rather than being quietly outgrown.
4. `docs/coreservices/syndication/` builds ahead of the buy-side surface. Its repository, publication versioning, audience rules, and remoted-entity tag-in are on Connect's critical path, and its open question on non-tenant providers is answered by decision 4's platform-operated intake publisher.
5. The `listing` entity type, its field definitions, and its intake defaults become provisioning content, so a freshly provisioned tenant has them. Legacy ships brokerage reference data as migrations; it becomes dataset content.
6. `docs/coredata/ingest/05-legacy-functionality-map.md` is corrected per decision 9.
7. `docs/coreservices/syndication/04-proposed-model.md`'s placement options and its open question 1 are resolved by this ADR and cite it instead of posing the choice.
8. `docs/reference/modernization/22-remaining-capabilities-and-module-map.md`'s essos disposition is restated: it is a composition across M-modules, not a separate team's strangler scope.

**Unchanged by this decision**

1. Essos's runtime, database, and deployment shape, until its tenants are cut over.
2. The `EssosClient` MCP tool's contract.
3. The forwarded-email gate's behavior. The four bounce reasons, the per-user hourly cap, and auto-responder suppression are carried; only their host changes.
4. `docs/experiences/connect/connect-screener/`'s presentational discipline and component inventory. It consumes syndication, entity-field, and view operations instead of a Connect package.

**Accepted costs**

1. Connect's delivery is now coupled to syndication's, which is design-only. Nothing buy-side ships before the repository does, and a slip in syndication is a slip in Connect. The evolve-essos option carried no such dependency.
2. Probabilistic resolution lands in ingest, where every source pays the cost of a capability that so far only listings need. The alternative is a second matcher, which is the shape this ADR exists to refuse.
3. Essos accumulates further surface during the transition. Decision 11's three rules bound what kind of surface, not how much.
4. A connected source is two rows in two stores rather than one, and a front is a package to own, release and test. The alternative is a pipeline that grows a provider SDK per integration, which is the shape legacy reached by a different route.
4. A tenant mid-cutover has listings in two systems. Per-tenant cutover keeps the split from being global, but it is real while it lasts.
5. The `listing_property_enrichments` statistics blob, the AI-enhancement widget shapes, and the brokerage-logo data corrections have no direct successor and become derivations, proposed values, and dataset content respectively — each a rewrite rather than a port.

## Traceability

- Tracker: GRO-33. Related: GRO-79 (remoted entities), GRO-80 (syndication's open questions — the repository-placement one is resolved here and the non-tenant-provider one is answered in shape; the rest remain), GRO-588 (public API façade, a separate boundary).
- Current state: `docs/reference/legacy_assessments/current-state/20-listings-connect-essos.md`.
- Composition: `docs/experiences/connect/`, `docs/experiences/connect/connect-screener/`, `docs/coredata/ingest/`, `docs/coreservices/syndication/`, `docs/coredata/entity-fields/`, `docs/coreservices/search/`, `docs/experiences/workspaces/`, `docs/coreservices/federation/`.
- Depends on: ADR-0017 (a workspace is a lens), ADR-0018 (query views and the source registry), ADR-0025 (one creation path and source-conditional behaviour).

## Amendment 2026-09-10 — what the intake publisher carries

Decision 4 names the platform-operated intake publisher as carrying "what legacy's broker-feed scrape and its forwarded-email door produce". Read with decisions 6 and 7, the second half does not hold and is corrected here; decision 4's text stands as the record of what was decided and this amendment states what it means.

A forwarded email and a monitored mailbox are `ingest_sources` rows **of the tenant that forwarded or connected them** (`email` and `api_pull`, decision 7). Ingest lands a tenant's arrivals as that tenant's own records, so an offering Dana forwards becomes a `listing` record in Dana's tenant with no publication involved — her private deal flow never enters the platform-plane repository, and she never has to adopt her own forwarded listing. Legacy routed the same email through the shared listings store only because essos was the only listing store it had ([`../../coreservices/syndication/01-legacy-pitfalls.md`](../../coreservices/syndication/01-legacy-pitfalls.md), defect 6).

The intake publisher therefore carries exactly one thing: the **broker-feed scrape** — offerings read from brokerage sites that no tenant asked for and no tenant owns. Those are published to the repository under an audience rule and adopted like any other publication.

Consequences: a tenant-scoped record and a repository publication can describe the same building — Dana's forwarded copy and a broker's publication of the same offering. That is a consumer-side match ([`04-proposed-model.md`](04-proposed-model.md) §The intake bindings), never a repository merge, because the two have different owners.
