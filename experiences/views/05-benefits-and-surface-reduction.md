# Benefits and surface reduction of one views system

It settles what one views system gains and which legacy surface it replaces, for anyone deciding whether to build it. It covers what Users notice, what the Agent gains, what brittleness goes away, and which legacy surface is never rebuilt.

Sources: legacy figures are the current-state assessments' measurements (`sunspear`/`major`, non-test lines). Neuro figures come from the DPN-16 load harness and this branch.

## User experience

| Today (legacy, and partly the POC) | With the views system | Evidence |
|---|---|---|
| A record page fans out 15–30 sequential XHRs; EU Users wait ~180–220 ms per trip before the server does any work | one browser round trip; sections stream server-side in parallel behind Suspense | `10-frontend-sunspear.md` outcome 3; RSC architecture already in place |
| The grid sends every field the registry knows: 222 columns, 648 KB per 100-row page, service collapse at 41 req/s under load | the view's columns are the select list; the same server sustained 119 req/s at 6 ms p95 on scoped reads | `docs/reference/poc/03-findings.md` |
| A configured page can be neither linked nor reproduced, because filters live in component state | every view is a URL; "send me what you're seeing" is copy-paste | `01` P4; `04` routing |
| Seeing a deal's properties means navigating away and losing context | the deal page hosts its properties as a live section, each row opening the real record | `related` sections (`04`) |
| Table and board are separate configurations that drift | one query, with presentation modes over it: switching modes never changes *what* you see | the query/presentation split (`02` §1) |
| A shared page errors or shows too much when audiences differ | the same view shows each User exactly what their plan allows, and says so when it degrades | `04`, authorization rules 2–3 |
| Rearranging a dashboard is a ticket for a TenantAdmin, or component state lost on refresh | drag a tile and drop it: the arrangement is saved to the spec, shared with the audience, and forked to a personal copy when you may not edit it | `04` composition editing; `02` drag-drop |

## A surface the design system can own

Legacy's design system cut the widgets because it could not certify them. Per-instance styling made the variant space thousands wide, and unbounded for `custom_table`. A design system can tokenize a Button and has no way to tokenize a spreadsheet a User authored (`07`). Neuro's equivalent space is **kinds × bounded hints**: dozens, enumerable from the registry, each rendered through Bolide tokens (`ADR-0009`). A design change (a color, a radius, a density scale) reaches every view, section, chart and Agent card in one token edit. Legacy needed per-widget work for it, which the design team had declined to take on. The non-goals (`03`) keep this property: once a view instance stores a style, the space is no longer certifiable.

For a Tenant, the combined effect: **the page you look at, the section inside another page, and the answer the assistant gives you are the same thing**. They show the same columns, rows and permissions, so no surface of the product contradicts another.

## AG-UI as an integrated feature

The legacy assessment's first finding: Sunspear has *no seam where AI plugs in*, and no library can add one (`10-frontend-sunspear.md`, outcome 1). The views system provides that seam:

- **Agent answers are product UI.** The Agent answers with a validated view spec, rendered by the page's own registry. The output is sortable, filterable, clickable, permission-correct and marked as the Agent's (Bolide's AI tokens), because it is the product's own component. The demo's three hand-built cards used the pattern one feature at a time; the registry makes it the default.
- **Agent capability grows by configuration.** The Agent can emit every section kind registered for Users as soon as it exists. An LLM can target a closed, typed catalogue reliably; a bespoke React tree offers it no such target (`02` §4). Add `chart` sections and the Agent can answer with charts, with no Agent-side work.
- **Agent answers become configuration.** Ephemeral answer → "pin this" → saved personal view → default view. The Agent's output becomes Tenant configuration through the same write path a User uses, with the same save-time guards, under Agent ∩ User. This applies the v2 recommendation's graduation principle (P6) to presentation.
- **Safety comes from the shared path.** The Agent renders only what the viewer may see, because rendering runs the viewer's plan. It stores no oracle, because `saveView` guards the save (`views.ts:66`). It stores no outage, because saves with an unpromoted predicate are rejected (`04` rule 4). None of this is Agent-specific code.

## Brittleness reduced or eliminated

| Brittleness class | Mechanism that removes it |
|---|---|
| Type-to-widget dispatch drifting across files (~20 category checks; 12-file field-type edits) | one section registry; adding a kind is one descriptor (`04`) |
| Views broken with no warning by field rename/delete | save-time validation (built) + declared "column removed" degradation at read (`04` rule 3) |
| Client and server disagreeing about visibility | no client evaluation exists: sections resolve server-side under the viewer's plan through the same operations the API serves, and the parity suites test it (`03` non-functional) |
| Duplicate in-render fetches accumulating as pages compose | `React.cache()` request memoization; duplicates were already found in a two-page app (`00`) |
| Whole-page refresh as the only update mechanism | version-keyed client caches in mutation islands; invalidation and live-settle share one key (`04` data flow) |
| A stored view as a stored performance incident | promotion required at save for shared-view predicates: the 1,108 ms failure is rejected at authoring time, before any User meets it (`docs/reference/poc/03-findings.md`, DPN-30) |

## Surface never rebuilt

The consolidation table, in the style of `docs/coredata/entity-fields/field-actions/07`. Each row is a legacy subsystem whose *jobs* the views system absorbs; the figures are what Neuro would otherwise re-implement and maintain. LOC per the current-state assessments; they overlap with neither the connector-layer figures (assessed in `10`) nor the field-actions consolidation table.

| Legacy subsystem | Non-test LOC | Fate under the views model |
|---|---|---|
| InfoView system (panels, sections, 66 imperatively-wired widgets) | ~15,500 / 92 files | composition + section registry; widgets become descriptors |
| `DpFieldValue` display/edit dispatch | ~4,150 / 6 files | already replaced by `@neuro/fields` descriptors; views consume the registry |
| Relationship widgets (`AssociationsWidget`, `AttachedEntitiesWidget`, `EmbeddedInfoViewWidget`) | inside the InfoView figure | one `related` section kind over `entity_edges` |
| Reporting dashboards & widget builder | ~11,150 | `dashboard` = composition of `chart` sections; the dashboard editor edits specs and never components |
| Entity-dashboard grid orchestration | 4,275 (one file) | the `query` view + display modes over the shared grid package |
| **Total addressed** | **~35,000 lines** | replaced by a spec (~200 lines of Zod), a resolver, and a registry of small descriptors |

The replacement has its own code. The registry, resolver, section components and a view editor are plausibly 3–5 k lines at maturity. The reduction is in *ratio* and *shape*: one typed catalogue with save-time validation and one rendering path, against ~35,000 lines of hand-wired composition with neither. Two capabilities also arrive that the 35,000 lines never had: server rendering, and an Agent that uses the same view spec as the page.
