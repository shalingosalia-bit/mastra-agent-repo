# The essos transition

Essos runs in production, takes active feature work, and serves a live agent contract. [ADR-0029](ADR-0029-connect-capability-boundary-and-listings-repository.md) decides where its capabilities go; this document is what happens between now and then.

## The compatibility constraint

Feature work continues on essos while the composition is built. Three rules bound what kind of work, so that what lands is expressible in the target model rather than being surface that has to be unpicked:

1. **No new listing attribute becomes a typed column** where a field definition would serve. An attribute added as a column is a migration now and a mapping problem later; the same attribute added to the AI-enhancement JSON or as extractor output is neither.
2. **No new bespoke retry, scheduling, search or grant machinery.** Each of those exists in a target stack. A new job with its own attempt ceiling, a new OpenSearch index maintained from the write path, or a second distribution table is work that will be deleted rather than moved.
3. **No new intake path that is not expressible as an ingest source.** A path with its own claim protocol, its own dedup rule and its own terminal states is a fourth copy of what `ingest_sources` already specifies.

Work already in flight — the Outlook mailbox integration and AI-driven property enhancement — continues under these rules. Neither is affected by them: the mailbox path is an `api_pull` source in the target model, and enhancement output is proposed values.

Essos's build and deploy stay inside `the_wall`'s Docker image. Extracting them would buy an independent release lifecycle for a service being retired, and the current-state assessment names that extraction as work distinct from the data-model question.

## The contracts that must keep working

| Contract | Where it is | What happens |
|---|---|---|
| `EssosClient` listing search, exposed as an MCP tool | The `dealpath/mcp` repository | Keeps its shape and is repointed at the Neuro side once a tenant's listings are resident there. The tool is not restarted and its callers are not changed |
| `ListingManagementConnector` over gRPC | `the_wall/connectors/listing_management_connector.rb` | `set_listing_status`, `get_broker_images` and `ingest_forwarded_email` stay live until their tenants are cut over. `get_listings` has no live caller and is deleted rather than carried ([`06-legacy-functionality-map.md`](06-legacy-functionality-map.md)) |
| The forwarded-email door | `the_wall/core/connect/controllers/connect_forwarded_email_controller.rb` | Keeps gating and bouncing for tenants still on essos. A cut-over tenant's forwarding address routes to the `email` adapter instead, which carries the same four reasons and the same cap (CN25) |
| The sunspear Connect surface | `sunspear/app/components/connect` | Unchanged for tenants still on essos. A cut-over tenant uses the Connect Buy-Side workspace |

## Cutover

Cutover is per tenant, not per capability, so no tenant is ever half on each side for a given listing.

A tenant is ready when four things exist on Neuro: its `listing` and `listing_criterion` entity types with their field definitions, its ingest sources with their maps and credentials, its repository subscriptions for the publications it consumes, and its workspace. Its historical listings arrive through the migration package's path, as records with their dispositions and provenance edges, not as a second import mechanism.

The order the estate moves in is a sequencing question for the delivery bundle rather than a design one, with two constraints from the design. A tenant that publishes cannot cut over before the repository exists, because its consumers read through it. A tenant that only consumes can cut over as soon as the publications it subscribes to are in the repository, whether the publishers are on Neuro or reaching it through the platform-operated intake publisher.

Essos is retired when no tenant is left on it. Until then the two systems both run, and a tenant's listings are in exactly one of them.

## Migrating legacy visibility into audience rules

Legacy expresses who may see a listing as a value on the row plus, for one value, a grant table (`coreservices/syndication/01-legacy-pitfalls.md`, defect 1). Each combination has one target, and the middle one is the only judgement call.

| Legacy `listing_type` | Grants | Target |
|---|---|---|
| `Public` | none | A publication with audience `everyone` |
| `Private-Restricted` | `listing_distributions` rows | A publication with audience `tenants:[…]` enumerating the granted teams' tenants |
| `Private` | none | **Decided at migration, not inherited.** Legacy shows a `Private` listing to every team holding the Connect feature — a product entitlement, not an audience the publisher chose. The nearest rule is a named audience whose membership is the set of tenants entitled to Connect at cutover, so the visible set is frozen as a list a publisher can later edit rather than left as a flag nobody owns |
| Any type, `ingestion_source` forwarded or mailbox | a distribution to the forwarding team | The forwarding tenant's own `listing` record, not a publication (ADR-0029, amendment 2026-09-10). The distribution row is what told legacy which team it belonged to |

Listings that reached legacy by both the feed and a forward, and were collapsed onto one row with two distributions, are split at migration: a publication from the intake publisher, and a record in each forwarding tenant, matched by the consumer-side resolution `04-proposed-model.md` describes rather than by a shared row.

## What has no successor

Three legacy behaviours are rebuilt rather than moved, and each is work rather than a port:

1. **The broker-feed page structure.** The Python `pyppeteer` script encodes what each brokerage's site looks like. That knowledge is rebuilt against the extraction contract; the Ruby-to-Python bridge over a temp file is not translated.
2. **The property enrichment statistics.** `listing_property_enrichments` holds an untyped statistics blob keyed on a radius and a vintage. It becomes a derivation with a declared input set, which means naming the inputs that the blob currently leaves implicit.
3. **The AI-enhancement widget shapes.** `listing_ai_enhancements` carries a `widget_type` discriminator and per-widget field mappings. The widget is presentation and belongs to [`connect-screener/`](connect-screener/00-connect-screener.md); the values become proposed values, which means the mapping is restated as an extraction contract rather than moved.
