# ADR-0018: A query view is a `query` over a `source`, and sources are a registry

**Date:** 2026-08-17
**Status:** Accepted 2026-08-18
**Scope:** neuro
**Amended:** 2026-08-21 by ADR-0023 — decision 4 placed blueprint CONTENT in `tenant_templates.sections`. The table now holds a POINTER and the dataset holds the content; `sections` and `templateSectionsSchema` are removed. See the Amendment section at the end.

## Context

The presentation stack now spans four docsets — entity-fields, views, render, workspaces — and the workspaces design surfaced a pattern twice in one week: a surface that is conceptually a view could not be one, and had to be carried as a routing exception "under protest" (`docs/experiences/workspaces/09-build-specs.md`, admission rules). The two instances are the agent's proposal review queue and the Connect listings surface. Both fail for the same reason: `savedViewDefinitionSchema` requires an `entityType` (`packages/shared/fields/src/specs/view.ts:171`), and neither a proposal nor a repository listing is an entity.

That prompted an audit of the stored names against the mental model the docsets have since discovered. Three names encode a world the design has outgrown:

**1. `saved_view` names the persistence, not the concept.** The name is inherited from legacy's mental model — `filter_views`, a personal saved filter bookmarked on a grid. But the views docset's own central design move (`docs/experiences/views/00-views.md`, "the central design idea") is that the agent answers data questions by rendering **ephemeral** query views in chat, where "pin this" *is* the act of saving. In the system as designed, an unsaved query view is the normal working state, and the kind name `saved_view` is wrong about it. The docset already talks around the problem — `docs/experiences/views/04-proposed-model.md` says "a `saved_view` is a pure **query view**" — using the correct name to define the incorrect one.

**2. `entityType` assumes every queryable thing is an entity.** The system already has, or has specified, at least four collections that want the query-view treatment — sortable, filterable, columned, renderable in a page, a section, or a chat card — and are not entity types: proposals (`docs/experiences/workspaces/05-exemplar-workspaces.md` §2), repository listings (`docs/coreservices/syndication/`, browse-and-match), jobs, and audit events. Each currently needs a bespoke surface, which is the pre-registry condition the section registry was built to end.

**3. `ViewKind` is exported twice with different meanings.** `apps/dpagentic/src/features/workspaces/nav.ts` defines `ViewKind = 'table' | 'board'` (a display mode, predating `displayModes`); `packages/shared/fields/src/specs/view.ts:25` defines `ViewKind = 'saved_view' | 'layout' | 'dashboard'` (the stored artifact kind). Two packages exporting one name for two concepts is a standing reading hazard.

The timing matters: `saved_view` appears 146 times across 32 files, all first-party — **there are no live deployments**, seeds regenerate, drizzle migrations can be restated, the legacy data-migration generator (`filter_views` → `views`) is not yet built, and the agent's emit contract has no external consumers. Every change below is a clean cut with no aliases and no tolerant reads for old literals, because there is nothing deployed to tolerate. This window closes when the first tenant migrates or a public API ships, and none of it is mechanical after that.

The zero-deployment audit also caught a fourth item that cost had previously protected: **the composition payloads are a duplicated schema.** `dashboardWidgetSchema` and `chartSectionSchema` carry the same seven query fields — `chart, entityType, predicate, measure, groupBy, series, drillTo` — with the `series` doc comment copied verbatim between them (`packages/shared/fields/src/specs/view.ts:321` and `:667`); the widget adds only its identity and grid placement, and the section only its host concerns (`breakBefore`, `column`). One fact — a chart over a filtered record set — in two homes that can disagree. It exists because dashboards were built before the section union was; nothing preserves it but history.

## Decision

Five moves and two refusals.

**1. The kind `saved_view` becomes `query`.** A query view is: a **source**, a predicate, sort, columns, grouping, measures. Whether a given query view is stored is a property of the row that holds it, never of the kind — a stored query view and an agent-emitted ephemeral one are the same kind, which is what makes "pin this" persistence rather than conversion. The rename is a clean cut, not an alias: `viewKinds`, the discriminated union, the seeds, and the docs all move together, and no tolerant read for the old literal is kept, because there is no stored data outside regenerable seeds.

**2. `entityType` on a query view becomes `source`, and sources are a registry.**

```ts
source:
  | { kind: 'entity';     type: string }    // today's case — the entity-type registry
  | { kind: 'collection'; name: string }    // proposals, listings, jobs, audit events
```

A registered source supplies exactly three things, and a query view neither knows nor cares which kind it queries:

| A source provides | So that |
|---|---|
| a **field surface** — handles, types, labels | save-time validation, the column picker, and the predicate builder work unchanged |
| a **query executor** — predicate + sort + page → rows, resolved through the caller's access plan | the oracle guard, withheld-value stubs, and row filtering hold for collections exactly as for entities |
| optionally, an **aggregate executor** | groupBy/measures, or a stated refusal (a source without one cannot be a summary or chart) |

The entity source delegates to the projection compiler and `queryEntities` — zero behavior change. The first collection source is `proposals`. This is the codebase's proven move applied a fourth time: field descriptors, section resolvers, and dataset kinds are all registries keyed on kind, each built to end a bespoke-per-case sprawl, and the query source is the same shape ending the same sprawl.

**3. There is one composition payload: sections.** `dashboardWidgetSchema` retires. A `dashboard` holds the same `sections` array a `layout` holds — its tiles are members of the one section union, each carrying the stable `id` widgets already have (`dashboardWidgetSchema.id`, filled on read by `normalizeWidgets`) and an optional **`placement: {x, y, w, h}`** — the field `widgetLayoutSchema` defines today, renamed, because a field named `layout` inside a section of a `layout`-kind view is a word collision this ADR exists to prevent (`docs/experiences/views/04-proposed-model.md`'s sketch, which predates the rename, says `layout` and should be updated with it). The two kinds keep their names and differ in exactly two facts: what they resolve against (a record versus the tenant) and whether `placement` is honored. This makes the docset's existing claim — "the three kinds are surface grammar over two primitives" — true in storage rather than only in prose, and it hands dashboards every section kind for free: a markdown tile, a related-records tile, a matrix tile, with no widget-side reimplementation ever.

**4. `workspace_templates` becomes `tenant_templates`, and moves to the control-plane database.** Two corrections to one table.

*The rename.* The table holds the blueprint a tenant is *provisioned from* — fields, entity types, calculations, views, permission rules, roles (`packages/shared/fields/src/specs/template.ts`, ADR-0008 era). Its "workspace" means "a tenant's configured environment", a sense the product vocabulary has since reassigned: `docs/experiences/workspaces/` and ADR-0017 claim **Workspace** for the presentation lens, and the lens's own tables (`workspaces`, `workspace_assignments`) are about to land beside this one. A reader will assume `workspace_templates` templates `workspaces` rows; it does not. `tenant_templates` says what it is, and the `entities.template_type = 'system'` migration note points at it unchanged in meaning.

*The relocation.* The table currently lives in the tenant plane (`packages/tenant/core/src/db/field-system/platform.ts`, via `platformTable`), which is the wrong plane by every test the placement question has:

- **Write and read authority are both the Control Plane's.** It is written by the model-tenant export and read at provisioning (`docs/experiences/workspaces/07`) — both Control Plane acts per the solution profile. Its own doc comment already says "never read on a request path."
- **It is tenant-neutral by nature** — one fleet-wide copy. In the silo topology, a tenant-plane placement puts a copy of the vendor blueprints in every siloed Aurora, where they drift; and a *new* silo would need the blueprint before its own database exists, which is a bootstrap cycle.
- **Tenant mobility:** a tenant export must not carry vendor blueprints, and a table in the tenant schema is always one `select *` away from being included.
- **The pattern is already established.** `packages/control/core/src/db/schema.ts` states it for the tenant registry: platform-scoped rows staged in the tenant database move to the control-plane database (`CONTROL_DATABASE_URL`). Syndication's repository reached the same conclusion from the other direction (`docs/coreservices/syndication/04`): cross-tenant and tenant-neutral stores live in the platform plane.

The move lands in the same cut as the rename — table defined in `packages/control/core/src/db/schema.ts`, retired from tenant core (its `companion.sql` exclusion and `factory.test.ts` platform-scoped list updated; `platformTable` is left with no callers at all — `fx_rates` and `rate_indices` are tenant-neutral but use plain `pgTable`, so they were never users of it; it is kept as a documented seam rather than deleted, and its docstring records that choice). `templateSectionsSchema` stays in `@neuro/fields`, importable by both planes. The table is the *operational* store: per the codebase's bootstrap standard, template content lives as committed, readable JSON in the repo, loaded into the store, and stuffed into tenants at provisioning — the model-tenant export (`docs/experiences/workspaces/07`) regenerates the committed files rather than bypassing them.

**5. `nav.ts`'s `ViewKind` is retired.** The switcher's type narrows from the spec's `DisplayMode` (`'table' | 'board'` as a subset of `displayModes`), and the one name means one thing.

**Refusal 1: `layout` and `dashboard` keep their kind names.** With the payload unified (decision 3), collapsing the kinds into one `composition` with a context field was reconsidered and still refused — now purely on vocabulary grounds, since the schemas no longer differ: the two names are the words users, admins, and the legacy migration all actually say, and a `context` field would collide with `view_defaults.context`, which already means something else. Stored kinds are surface grammar, and grammar is allowed to use human words once the storage underneath is one thing.

**Refusal 2: `views`, `view_defaults`, `view_favorites`, and `views.scope` keep their names.** Audited and accurate: a table of view definitions, a default per audience and context, a starred pairing, an audience. `view_defaults` was re-checked against its new `'home'` context and still says what it does.

## Consequences

- **The two under-protest `NamedRoute` members convert and the enum shrinks**, as `docs/experiences/workspaces/09-build-specs.md` promised: `For Review` becomes a `query` view over `collection:proposals` — sortable, filterable, pinnable, renderable in chat — and the Connect listings surface has a declared shape (`collection` over the repository) waiting only on syndication itself. The workspace and views models change **zero** further for either.
- **The agent's emit contract stops lying.** The agent emits `kind: 'query'` specs, which is what they are; nothing in the contract implies a row exists.
- **Anything list-shaped in the product gains the full treatment for the cost of one source registration** — display modes, view defaults, favorites, sections hosting, export, the chat card — instead of a bespoke page. Jobs and audit events are the expected next registrations after proposals.
- **A database predating this cut must be reseeded, not just migrated.** The migrations are DDL-only, and every read path now refuses the old rows: a stored `kind = 'saved_view'` fails the enum, and a definition carrying `entityType` instead of `source` fails `queryViewDefinitionSchema`. Data statements were considered and refused — with no deployments there is nothing to preserve, and a migration that rewrites JSON payloads is harder to review than a reseed. So: `bun run --filter @neuro/core db:migrate` then reseed (`bun run --filter @neuro/seed seed`). A fresh database needs nothing special.
- **Dashboards stop being the poor sibling.** Item 13's drag-drop identity (`id` + `layout`) lands as part of the payload unification rather than as a widget-only patch, and every future section kind is a dashboard tile on the day it registers.
- **The costs**: a 146-occurrence mechanical rename (ast-grep for code, sed for docs, seed regeneration — with `git grep` as the sweep tool so hidden and CI files are caught); the section schemas that embed `entityType` (`related`, `chart`, `nearby`) migrate to `source` on the same cut or are explicitly deferred with entity-only semantics stated; widget `label` (optional) becomes the section's required `label` on the same cut, defaulted from the chart's own title where absent; and the source registry is a real abstraction that must refuse scope creep — a source is **not** a place to put joins, mutations, or per-source display logic. It answers "which rows, which fields"; everything else stays where it lives.
- **Docs absorb the decision**: `docs/experiences/views/04` and `08` take the `source` model and the registry contract; `docs/experiences/workspaces/05` and `09` drop the under-protest wording in favor of a conversion note; `docs/coredata/entity-fields/08`, ADR-0008's cross-references, and `docs/operations/data-migration/01`'s two `workspace_templates` mentions move to `tenant_templates`; the legacy migration generator, when built, targets `query` from the start. The sweep runs on `git grep`, not ripgrep — a rename sweep here has already missed a CI-hardcoded path once by skipping hidden directories.

## Alternatives considered

**Keep `saved_view`, add `collection_view` as a fourth kind.** Rejected: it doubles the kind space along the wrong axis. The difference between an entity query and a proposals query is the *source*, not the kind — one axis, one field, or the parallel-kinds sprawl the views model exists to prevent.

**Alias instead of rename (`query` accepted, `saved_view` tolerated forever).** Rejected: an alias is a rename that never finishes. With no production data, the tolerant-read machinery would exist only to let new code keep writing the old word.

**Generalize by loosening (`entityType: string` resolves against types *or* collections).** Rejected: stringly-typed dispatch — the reader cannot tell what a view queries without consulting a resolution order, and validation cannot tell a typo from a collection. The discriminated union costs one wrapper object and keeps both.

## References

- `docs/experiences/views/00-views.md`, `04-proposed-model.md` — the two-primitives model and the "pure query view" language this aligns the storage with
- `docs/experiences/workspaces/05-exemplar-workspaces.md` §2, `09-build-specs.md` — the two surfaces carried under protest, and the admission rule that predicted the conversion
- `packages/shared/fields/src/specs/view.ts:171` — the `entityType` requirement being generalized
- `docs/coreservices/syndication/03-requirements-and-user-stories.md` R2 — repository browse-and-match, the second collection source
- The registry precedents: field descriptors (`@neuro/fields`), section resolvers (`packages/tenant/core/src/views/sections.ts`), dataset kinds (`packages/tooling/dataset/src/registry.ts`)

## Amendment (2026-08-21): blueprint content belongs in the dataset, not in `tenant_templates.sections`

**Status: ACCEPTED** by ADR-0023 decision 2, which supersedes decision 4 below to the extent that it places content in `sections`. Raised while giving `entity_type_relations` a provisioning path (GRO-166), which is the first change that had to put the same configuration into two places.

### What decision 4 says, and what has changed under it

Decision 4 relocated the table and settled its authority, and both of those hold. It also settled the shape:

> The table is the *operational* store: per the codebase's bootstrap standard, template content lives as committed, readable JSON in the repo, loaded into the store, and stuffed into tenants at provisioning.

At the time, "committed, readable JSON in the repo" and "the store" were two views of one payload with nothing else able to apply it. That is no longer true. The dataset stack applies committed JSON to a tenant today, and a config-only dataset IS a blueprint: `datasets/dealpath-config/` carries the manifest name `dealpath_bootstrap`, and `bootstrap.integration.test.ts` proves the capability decision 4 describes — config applied to an empty tenant, leaving shape and no contents (`docs/coredata/datasets/12`).

So there are now two representations of "starter configuration", and they are not equivalent.

| | config dataset | `tenant_templates.sections` |
|---|---|---|
| kinds carried | 10 — `entity_type`, `relation`, `field_definition`, `field_calculation`, `role`, `principal`, `workspace`, `permission_rule`, `field_rule`, `view` | 6 — `fields`, `entity_types`, `calculations`, `views`, `permission_rules`, `roles` |
| leaf validation | per kind, through the same operation a runtime save uses | `z.record(z.string(), z.unknown())` |
| cross-resource references | `references()` plus the cross-resource check | none |
| schema pinning | `schemaAt`; apply refuses on mismatch | none |
| apply modes | `verify` / `plan` / `apply` / `reset` | none |
| idempotency | every kind upserts; re-apply is a no-op | undefined |
| audit | a run ledger row per apply | none |
| review | a diffable directory of JSON | a JSONB blob in a row |

`templateSectionsSchema` is `.strict()`, so the four kinds it lacks cannot be added to a blueprint without amending it: **relations, workspaces, principals and field rules**. Relations is the one that forced the question — a tenant provisioned from a template would get its entity types and no registry saying how they may relate, which is the gap GRO-166 exists to close.

That divergence is the argument. Two encodings of one fact drift, and this pair already has: the sections schema is four kinds behind the thing it is supposed to blueprint, and nobody noticed because nothing reads it.

### The proposal

**The content stays in the dataset. The table holds a reference to it.**

* `tenant_templates` keeps `handle`, `name`, `revision` and the audit columns, and gains a locator for the dataset it names. It loses `sections`.
* Provisioning resolves the locator, then applies the dataset through `applyDataset` — the same path `seedFrom` and the bootstrap test already use, so provisioning inherits validation, references, `schemaAt` refusal, idempotency and the ledger rather than reimplementing them.
* The table remains what decision 4 correctly argued for: fleet-wide, control-plane-owned, never carried by a tenant export, queryable for "which tenants got which revision".

This keeps every reason decision 4 gave for the relocation. It changes only what the row stores.

### What this needs that does not exist yet

Naming it so the proposal is not mistaken for free:

1. **A dataset source that does not assume the repo is on disk.** `seedFrom` accepts `{kind: 'file', dir}` and `{kind: 'recipe', …}`; a deployed control plane provisioning a production tenant has neither. A third source — bundled with the deploy, or object storage — is the one genuinely new piece of plumbing, and it is the problem an operational store was reaching for. Solving it as a source kind keeps one representation; solving it as a second schema is what produced the divergence above.
2. **Revision in the manifest.** The manifest carries `producedBy`, `producer` and `schemaAt`, and no `revision`. `tenant_templates.revision` has it. If blueprints are versioned datasets, revision belongs with the dataset or in the pointer, once.
3. **The provisioning worker.** `packages/control/events/src/events/workers/provision-tenant.ts` throws `'tenant provisioning is not implemented; this handler is a scaffold'` and is deliberately unregistered. Whoever implements it makes this choice either way, which is the moment to decide.

### Cost of the change

`tenant_templates` has no production reader, no production writer, and no committed template JSON in the repo (one integration test covers the `sections` column directly, and is deleted with it), and the provisioning worker is a scaffold, so the amendment removes a column and its test rather than migrating either. `templateSectionsSchema` is deleted rather than gaining the four kinds it lacks: extending it would put fields in a schema nothing writes and nothing reads, which is the dead-column shape GRO-73 recorded and GRO-166 exists to remove.

ADR-0023 decision 3 settles the question this amendment leaves open — a deployed control plane may load a config dataset into the control database, and the committed directory remains the source that was loaded, with an immutable revision and a mismatch treated as an error naming both sides.
