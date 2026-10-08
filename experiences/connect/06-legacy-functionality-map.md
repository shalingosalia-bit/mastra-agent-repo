# Legacy functionality map

Every essos model, route, job, module and script, with a disposition. **Subsumed** means the behaviour survives inside a mechanism that already exists, named in the row. **Ported** means it moves substantially as written. **Deleted** means nothing carries it. **Moves** means another stack owns it.

The claim of [`00-connect.md`](00-connect.md) is checkable here. Every row names the stack that owns what survives, and no row may name Connect: a disposition that has nowhere to land except a Connect-owned table, package or service is a place the composition did not hold, and is either an amendment to the owning stack or a gap in [ADR-0029](ADR-0029-connect-capability-boundary-and-listings-repository.md).

## Tables

| Legacy | Disposition |
|---|---|
| `listings` | **Subsumed** → a record of the `listing` entity type. `listing_type` becomes an authorized field plus a distribution grant, not a masked display value; `uuid` and `broker_listing_id` become source references on the arrival, never the record's key; `deactivated_at`/`deactivated_by` become the type's lifecycle ([`coredata/entity-fields/16-lifecycle-and-archival.md`](../../coredata/entity-fields/16-lifecycle-and-archival.md)); `ingestion_source` becomes the arrival's source |
| `listing_properties` | **Subsumed** → field definitions and `field_values`. Every attribute column becomes configuration; `gla`/`gla_sqm` and `price_per_sqmeter` become one value read in a unit context ([`coredata/entity-fields/10-multi-currency-fit.md`](../../coredata/entity-fields/10-multi-currency-fit.md)); the five `ai_enhancement_*` columns become an ingest run record; `normalized_address_key` becomes the blocking key of ingest's probabilistic identity mode, recomputed from the record's values rather than stored as the only copy ([`04-proposed-model.md`](04-proposed-model.md)); `dp_market` becomes a derived value |
| `listing_contacts` | **Subsumed** → contact records linked by `entity_edges`, with the brokerage a record rather than a repeated string. The row's split of `broker_address` into street, city, state and zip is what the address normalization migrations were repairing |
| `listing_highlights` | **Subsumed** → a repeating field on the type. `position` is the field's ordering, not a column the reader sorts by hand |
| `listing_images` | **Moves** → [`documents/`](../../coreservices/documents/00-documents.md) over `@neuro/storage`. `source_image_url` becomes the arrival's reference; `dp_image_url` and the thumbnail profiles become derived renditions |
| `listing_statuses` | **Subsumed** → the type's status field, one current value by construction. `entity_id` becomes an `entity_edges` provenance row. The `(team, listing, status)` key and the enum member meaning "no row" do not survive (defect class 4) |
| `listing_distributions` | **Moves** → [`syndication/`](../../coreservices/syndication/00-syndication.md). A grant of a listing to a team becomes a publication with an audience rule and a disclosure set, so a broker chooses which fields travel and to whom — neither of which the grant can express. A revocation freezes the consumer's adopted copy rather than removing a row |
| `listing_property_enrichments` | **Subsumed** → derived values on the record. The `stats` text blob and the `(listing, property, radius, vintage)` uniqueness become a derivation with a declared input set |
| `listing_ai_enhancements` | **Subsumed** → `proposed_values` awaiting acceptance, plus the ingest run that produced them. `analysis_data` as an untyped JSON column and `widget_type` as a presentation discriminator both go: the widget is [`connect-screener/`](connect-screener/00-connect-screener.md)'s, and `prompt_version` belongs on the run |
| `broker_images` | **Subsumed** → brokerage reference records with branding, provisioned as dataset content ([`datasets/`](../../coredata/datasets/00-datasets.md)). The join on the brokerage's display-name string does not survive |
| `listing_email_ingestions` | **Subsumed** → the ingest run record and its per-record ledger. The claim, attempt count and payload stash become the pipeline's; the `status` and `skip_reason` vocabularies become the run's outcome plus a structured error (defect classes 6 and 7) |
| `listing_url_ingestions` | **Subsumed** → an ingest run for the crawl source. The one-row-per-listing uniqueness, which permits exactly one crawl per record for all time, does not survive |
| `outlook_integration_settings` | **Splits.** What the source *is* — the mailbox, the selected folder, the schedule — becomes an `ingest_sources` row of kind `api_pull`, with the encrypted credentials blob a credential reference ([`reference/modernization/23-shared-mechanisms.md`](../../reference/modernization/23-shared-mechanisms.md) §1). What the connection *holds* — the sync cursor, the subscription id and expiry, `graph_client_state`, the health state — belongs to the mailbox acquisition front, joined to the source by its id |

## HTTP routes

| Legacy | Disposition |
|---|---|
| `GET /listings_sql`, `GET /listings` | **Moves** → [`search/`](../../coreservices/search/00-search.md) plus the record projections. The hand-rolled keyset pagination over `(created_at, id)` in both directions is the projection reader's |
| `GET /listings/:listing_id`, `GET /listings_by_id` | **Subsumed** → the record read. Two endpoints for one question do not survive |
| `GET /listings/:listing_id/ai_enhancements` | **Subsumed** → proposed values on the record, read through the normal path |
| `POST /listing_status`, `GET /listing_status` | **Subsumed** → a field write and a record read |
| `GET /listing_status_feed` | **Deleted.** Already dead: superseded by the activity feed in legacy itself, and no caller remains — `sunspear/app/connectors/listings.ts:293` requests `/listing_activity_feed` and nothing requests this one. It is still mounted and still unbounded (defect class 13) |
| `GET /listing_activity_feed` | **Subsumed** → `listArrivals` plus the record's change log, cursor-paginated and returning values. Day grouping, timezone conversion and the formatted day label move to [`connect-screener/`](connect-screener/00-connect-screener.md) |
| `GET /broker_images` | **Subsumed** → the brokerage reference records |
| `GET /admin/listings/search`, `POST /admin/listings/:id/deactivate` | **Moves** → `apps/control-ui`, over the same operations rather than an admin-only route with its own token transport in the JSON body |
| `GET` and `POST /outlook/webhooks/graph` | **Ported** → the mailbox front's webhook. The validation-token handshake and the constant-time `clientState` comparison port as written; the route being the one entry in an authentication skip-list becomes an explicitly unauthenticated endpoint whose only credential is the shared secret |
| `GET /internal/outlook/settings`, `PUT /internal/outlook/settings` | **Moves** → the source-connection lifecycle, which is one flow across every source kind rather than a per-provider route set. The source row is [`ingest/`](../../coredata/ingest/00-ingest.md)'s; the mailbox specifics behind it are the front's |
| `GET /internal/outlook/oauth/start`, `POST /internal/outlook/oauth/complete` | **Ported** → the mailbox front's authorization round trip. The signed state token ports as a signed capability token ([`reference/modernization/23-shared-mechanisms.md`](../../reference/modernization/23-shared-mechanisms.md) §2) rather than a locally-minted JWT |
| `GET /internal/outlook/folders` | **Subsumed** → the mailbox front's scope enumeration |
| `POST /internal/outlook/preview` | **Moves** → source preview (CN18): the front produces the candidates, [`ingest/`](../../coredata/ingest/00-ingest.md) reports what they would land as. The batch-and-top-up loop that caps extractor calls at the number of results still needed is the behaviour worth keeping; its three constants become settings |
| `POST /internal/outlook/confirm` | **Moves** → source activation. The re-confirmation guard that avoids rewinding the cursor or starting a second backfill chain is the front's, since the cursor is; the promotion of preview rows on activation is [`ingest/`](../../coredata/ingest/00-ingest.md)'s |
| `POST /internal/outlook/disconnect` | **Moves** → source disconnection: the front releases the subscription, [`ingest/`](../../coredata/ingest/00-ingest.md) closes the source |

## gRPC surface

| Legacy | Disposition |
|---|---|
| `get_listings(created_after)` | **Deleted.** An untenanted, unpaginated read of every listing with children, and it has no live caller: `the_wall/connectors/listing_management_connector.rb:10` defines the client method and nothing outside that file invokes it, in the monolith or in `kings_landing`, `braavos` or `sunspear`. The other three methods on the same connector are all called. Nothing to carry (defect class 3) |
| `set_listing_status` | **Subsumed** → a field write plus a provenance edge. The idempotency the method exists to provide becomes the edge's uniqueness constraint, so the check-then-create and its `RecordNotUnique` rescue are unnecessary rather than ported |
| `get_broker_images` | **Subsumed** → the brokerage reference records |
| `ingest_forwarded_email` | **Moves** → [`ingest/`](../../coredata/ingest/00-ingest.md)'s `email` arrival adapter. The synchronous-handler-plus-job split exists to fit a gRPC deadline and does not survive; what does survive is the budget it was protecting ([`03-requirements-and-user-stories.md`](03-requirements-and-user-stories.md), Non-functional) |
| `protos/` and the `ProtoLink`/`EssosProtoLink` model concerns, `essos/mappings/` | **Deleted.** The wire format between two services inside one repository is a consequence of the split, not a capability |

## Jobs, schedules and their scaffolding

| Legacy | Disposition |
|---|---|
| `ai_listing_enhancement_job` | **Subsumed** → an ingest run producing proposed values. Its per-widget field mapping and rename tables move to the extraction contract; its two batch-size constants become settings |
| `ingest_outlook_email_job` | **Ported** → the mailbox front's delivery of a message to the arrival adapter, without its self-re-enqueue backoff, which is the bus's |
| `extract_forwarded_email_job` | **Deleted** as a job. It exists only because the synchronous handler cannot fit extraction; the recorded verdict crossing a stage boundary replaces it (defect class 8) |
| `backfill_outlook_mailbox_job` | **Ported** → the mailbox front's backfill, with its window as a setting |
| `handle_outlook_graph_lifecycle_event_job` | **Ported** → the mailbox front's subscription lifecycle handler |
| `renew_outlook_graph_subscriptions_cron_job` | **Ported** → the mailbox front's renewal job (CN17), with the renewal window as a setting |
| `listing_email_ingestion_sweep_cron_job` | **Ported** → the source reconciliation job. Reads rows, applies the policy's verdict, logs — the division of labour is kept |
| `listing_url_crawler_job` | **Ported** → the web acquisition front's fetch, without its private attempt ceiling and backoff array. Its merge gate is kept and strengthened into a proposal (CN20), which is the pipeline's |
| `listing_url_crawl_timeout_cron_job` | **Subsumed** → the pipeline's run timeout. A per-workload timeout cron is what a bus with a visibility timeout removes |
| `index_listings_job`, `update_listing_status_job` | **Deleted.** Both maintain a second store from the write path with no outbox; [`search/`](../../coreservices/search/00-search.md) owns the projections and their maintenance |
| `hooks/logged_resque_job`, `deferred_job`, `resque_utils`, `crontab.rb` | **Deleted.** Job registration, queue naming, delayed enqueue and schedule ownership are [`async/`](../../coreservices/async/00-async.md)'s. The schedule-ownership contract the crontab documents — every name here must also appear in the monolith's list, because the two schedulers share one Redis and the other's init drops anything missing (`essos/resque/crontab.rb:11`) — is a coupling that disappears with the shared Redis |
| `LoggedResqueJob` writing every job argument to stdout | **Deleted**, and it is the reason a forwarded email had to be stashed encrypted on its row. A payload is never a job argument (defect class 7) |

## Modules

| Legacy | Disposition |
|---|---|
| `connect_record_importer.rb` | **Subsumed** → the map, validate and land stages of [`ingest/`](../../coredata/ingest/00-ingest.md), plus `resolveArrival`. Nothing carries its accepted-attribute set computed from `column_names` (defect class 10) |
| `connect_email_ingestor.rb` | **Split.** The exclusion, dedup and classify sequence becomes pipeline stages; the row lifecycle becomes the run record; the `Result` struct and `apply_result!` disappear with them. `prepare_listing_data!`'s synthesis of an identifier from the `Message-ID` is deleted outright (defect class 5) |
| `listing_ingestion_sweep_policy.rb` | **Ported as written.** A pure decision module over a candidate struct, tested without a database, is the shape the reconciler keeps |
| `address_normalizer.rb` | **Moves** → [`ingest/`](../../coredata/ingest/00-ingest.md) as a blocking-key derivation, with its abbreviation and region tables moving from constants to tenant-scoped configuration and its output recomputed rather than stored |
| `listing_crawl_confidence.rb` | **Moves** → [`ingest/`](../../coredata/ingest/00-ingest.md)'s comparator registry. Its per-field comparison becomes registered comparators whose weighted contributions are recorded on the decision (CN6) |
| `listing_url_fill_blanks.rb` | **Subsumed** → proposed values. Filling blanks directly is the write this design forbids |
| `url_safety.rb` | **Ported** → the web acquisition front, including the blocked-range list and its handling of IPv4-mapped and NAT64 forms. The resolution race the module names becomes a requirement met by an egress proxy (CN19) |
| `email_exclusion_rules.rb` | **Ported** as a rule set, with its inputs becoming tenant configuration. The production-only gate and the substring match on the sender do not survive (defect class 11) |
| `email_subject_normalizer.rb`, `outlook_email_formatter.rb`, `outlook_graph_webhook_url.rb`, `outlook_retry_policy.rb`, `outlook_debug_fixtures.rb` | **Ported** → the mailbox front. The retry policy's values become settings; the debug fixtures become the front's test double, injected rather than selected by an environment check inside the route |
| `connect_image_ingestor.rb`, `content_scraper.rb`, `broker_content_scraper.rb` | **Moves** → the web acquisition front for the fetch, the extraction service for reading what it fetched, and [`documents/`](../../coreservices/documents/00-documents.md) for the renditions. A Ruby-to-Python bridge over a temp file is a consequence of the language split |
| `property_geocoder.rb` | **Subsumed** → a derivation over the record's address fields |
| `listing_document_transformer.rb`, `open_search_utils.rb`, `open_search_connector.rb` | **Deleted** with the search index (see `index_listings_job`) |
| `filters/listing_filter_builder.rb`, `filters/listing_filter_config.rb`, `filters/listing_search_query_builder.rb` | **Moves** → [`search/`](../../coreservices/search/00-search.md). The hand-maintained allow-list of filterable column names is what the field system replaces; the tiered prefix-and-ngram text matching is a relevance question [`search/`](../../coreservices/search/00-search.md) owns |
| `member_level_utils.rb`, `feature_access_utils.rb` | **Deleted.** Authorization is [`authz/`](../../coreservices/authz/00-authorization.md)'s decision from the request context, not a numeric level fetched over the network per check, and a product entitlement is [`flags/`](../../../packages/shared/flags) or a plan |
| `token_utils.rb`, `context_utils.rb`, `shard_utils.rb`, `connectors/auth_connector.rb`, `connectors/wall_connector.rb` | **Deleted.** Identity, request context and tenant placement are [`authn/`](../../coreservices/authn/00-authn.md), Mastra's request context, and [`sites/`](../../operations/sites/00-sites.md). Shard-to-URL derivation by arithmetic on a port number has no successor |
| `connectors/ai_service_connector.rb` | **Subsumed** → the extraction contract at the pipeline boundary, declared and validated rather than a shape two services agree on informally |
| `connectors/microsoft_graph_connector.rb` | **Ported** → the mailbox front's provider client. This is the code the front exists to keep out of the pipeline |
| `connectors/base_connector.rb`, `interceptors/error_handler_interceptor.rb`, `grpc/interceptors/*`, `http/middleware/*`, `http/helpers/*`, `http_server.rb`, `grpc_server.rb`, `launch_*`, `main.rb`, `Procfile*` | **Deleted.** Two servers, their transports, their interceptors and their process supervision are the service boundary itself |
| `models/base_model.rb`, `models/synthetic/*`, `extensions/activerecord_schema_statements.rb` | **Deleted.** The schema extension's own comment records that a single shared connection class means connecting to a second shard switches every model built from it |
| `utils/log_utils.rb`, `utils/slack_webhook.rb`, `utils/env_utils.rb` | **Deleted.** Structured logging and alerting are the platform's; an environment accessor has no legitimate caller once no rule reads the environment class |

## Scripts and out-of-band operations

| Legacy | Disposition |
|---|---|
| `script/run_connect_ingestion.rb` and the GitHub Actions workflow that drives it (`essos/docs/connect_ingestion_flow.md`) | **Subsumed** → a broker-feed arrival adapter with a scheduled run. A manually dispatched workflow that executes a script inside a Kubernetes pod, with a documented limitation that direct execution does not work for feature environments, is not an intake mechanism |
| `script/enhance_listings_ai.rb`, `script/backfill_dp_market.rb`, `script/fetch_esri_data.rb` | **Subsumed** → derivations and ingest runs, with run records |
| `script/index_listings_to_opensearch.rb`, `script/create_opensearch_index.rb`, `script/delete_opensearch_index.rb`, `script/recreate_opensearch_index.rb` | **Deleted** with the search index |
| `script/cleanup_listing_images.rb`, `script/delete_listings.rb` | **Moves** → `apps/control-ui`, as operations with break-glass and an audit record, per [CLAUDE.md](../../../CLAUDE.md) §Security non-negotiables |
| `script/debug_outlook_ai_flow.rb`, `script/recover_outlook_graph_subscription.rb` | **Subsumed** → the mailbox front's health report and a re-drive operation. A recovery that needs a script is a missing operation |
| `script/console.rb`, `script/start_server.rb` | **Deleted** |
| The broker-logo migrations, and the per-brokerage data corrections | **Subsumed** → dataset content and jobs with run records. Migrations change schema (defect class 12) |
| `db/schema.rb` trailing its own migrations | **Deleted** as a problem: the schema is generated from a migrated database and CI fails on drift, as [`reference/schema/tenant.md`](../../reference/schema/tenant.md) already does |

## Capabilities legacy does not have

These are gaps, not parity, and they are the blank cells in [`03-requirements-and-user-stories.md`](03-requirements-and-user-stories.md)'s `Legacy today` column. Presenting them alongside the subsumptions above would read as a port when they are new work.

1. **A recorded resolution decision** (CN6, CN7, CN8). Legacy matches on one derived key and records nothing, so a false merge and a false miss are both silent and both repaired by hand.
2. **Reviewable extraction** (CN2). Legacy writes extractor output to columns; there is no proposal, no acceptance, and therefore no way to tell a machine's claim from a person's entry.
3. **Database-enforced tenancy and a default-closed grant** (CN9, CN10, CN11). Legacy has neither row-level security nor a tenant column on the record, and its serializer widens rather than narrows when the tenant is absent.
4. **A withdrawable disposition** (CN12). Legacy's key makes the disposition a set of flags, so "we passed on this, then changed our minds" has no representation.
5. **One run record per arrival across every source** (CN3, CN4). Legacy has one for the two email paths only; a broker-feed row and a crawl have nothing comparable, and the feed's failures are a log file in S3.
6. **A transferable tenant** (CN22). Essos is one database per environment with environment-scoped identifiers throughout, so there is no export of one tenant's deal flow and no import of it elsewhere.
7. **Provisioning defaults** (CN23). A new tenant gets no listing type, no fields and no brokerage reference data, because in legacy those are schema and migrations rather than content.
8. **Erasure beyond the payload stash** (CN24). The sweep nulls stored email payloads at a retention ceiling; nothing erases a departing tenant's connections, keys, resolutions or grants.
