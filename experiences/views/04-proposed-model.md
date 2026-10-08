# Proposed model: two primitives, one registry, three hosts

It settles what a view is, for a Builder building or changing the views system. A view is a query (records, fields, order) or a composition of typed sections, and a composition's sections host queries. One resolver renders it identically on a page, in another view, or in the Agent's chat.

## The contract

Every view has four parts:

| Part | Contents | Why it is separate |
|---|---|---|
| **Identity** | `handle`, localized `labels`, `description` | the description is for Users *and the Agent*: a view is reusable only when its purpose is stated |
| **Audience** | `scope: personal \| group \| shared` + `owner` (the User id, the group id, or `''`); the vendor tier is the `is_managed` flag every configuration table already has | who is offered it in pickers, and never who sees its *data*: data access is always the viewer's authorization plan. Three stored values give four displayed audiences. `managed` is derived from `is_managed` and is not stored as a fourth `scope`, which would store one fact twice and let the copies disagree |
| **Query** | source (an entity type or a registered collection), predicate, sort, columns, groupBy | the semantics; one query has many presentations |
| **Presentation** | display mode for a query view; ordered typed sections for a composition | swappable without touching semantics |

The three stored kinds remain (`query`, `layout`, `dashboard`; `packages/shared/fields/src/specs/view.ts`), each a form of the two primitives. A `query` view is a pure query view. A `layout` is a composition resolved in the context of one record, and a `dashboard` is a composition resolved in Tenant context. One model with kinds avoids Salesforce's parallel layout systems, which confuse Users (`02`).

### A query view always has its columns

A `query` view has a column set even when its purpose is the summary. Grouping and charting are *presentations* of a browsable query view and never replace one. A User can therefore click a total through to the rows behind it; the `chart` section's `drillTo` applies the same idea one layer up. A view with `groupBy` and `measures` and no `columns` is a composition in Tenant context, a `dashboard`.

The legacy database already answers this consistently, so Neuro follows it:

| Question | Legacy `filter_views` |
|---|---|
| Do charts replace the grid? | No: all **35/35** `filter_view_charts` hang off views that also have `filter_view_columns` |
| Does grouping replace columns? | No: **927 of 929** grouped grid views have columns |
| Is anything legitimately column-less? | One thing: `view_type = 'reporting_dashboard'`, the dashboard *container*: **97/97** |
| Do dashboard tiles have columns? | Yes: **282 of 294** `dashboard_widget` rows |

The 12 column-less widgets are unconfigured stubs (`"Dashboard Widget 84"`: zero groups, zero charts, no metadata), paired with `(unnamed)` draft shadows that contain `{"dirty": …, "filterViewId": …}`. They set no precedent for a chart-only tile.

The seed suite enforces this over *every* seeded `query` view (`packages/tooling/seed/src/seed.integration.test.ts`). A check on one row picked with an unordered `find()` would pass or fail by heap order.

The spec is `packages/shared/fields/src/specs/view.ts`; what follows is its shape.

```ts
// What a query view queries (built). A discriminated union, not a bare entity-type
// string: proposals, repository listings, jobs and audit events are list-shaped things a
// user wants filtered, sorted, columned and pinned, and none of them is an entity type
// (ADR-0018). `entityTypeOf(source)` is the one way to read the entity type — it returns
// null for a collection, which forces every caller to name that branch.
source: { kind: 'entity'; type: string } | { kind: 'collection'; name: string }

// Presentation of a query view (built). The enum is the bound that keeps display from
// becoming legacy's option-flag space (01 P8) — adding a mode is a deliberate edit here.
display?: { mode: 'table' | 'grid' | 'board' | 'cards' | 'summary' | 'chart' }

// Sections are a discriminated union on `kind` (built: eight kinds).
sections: Array<
  | { kind: 'fields';   label: string; fields: string[] }
  | { kind: 'related';  label: string; edgeType: string; entityType: string;
      direction?: 'outgoing' | 'incoming' | 'both';
      view?: string;                    // host an existing query view by handle…
      columns?: string[]; sort?: Sort[]; predicate?: Predicate; limit?: number;  // …or inline it
      display?: 'table' | 'cards' | 'list' }
  | { kind: 'chart';    label: string; chart: ChartKind; entityType: string;
      measure?: string; groupBy?: string; predicate?: Predicate; drillTo?: string }
  | { kind: 'map';      label: string; field: string; entityType?: string; edgeType?: string }
  | { kind: 'notes';    label: string; field?: string; limit?: number }
  | { kind: 'nearby';   label: string; entityType: string; field: string;
      radiusMeters: number; columns?: string[]; predicate?: Predicate; limit?: number }
  | { kind: 'markdown'; label: string; body: string }
  | { kind: 'matrix';   label: string;                // the bounded custom_table answer (07)
      rows: string[]; columns: string[];              // user-named axes, bounded 64 x 8
      cells: Array<{ row: string; column: string; field: string }> }  // field refs only — no literals, no styles
>

// Every section carries one print-specific hint, and only this one (01 P7). It is
// attached by the REGISTRY rather than by each resolver, so no kind can be forgotten:
//   breakBefore?: boolean   // start a new page here when the render target is print

// Charts carry the second grouping level as an encoding rather than as more kinds:
//   series?: string   // drawn as colour; guarded at save exactly like groupBy, because
//                     //   its distinct values are the legend

// Tile identity and placement are BUILT, and they belong to every section rather than to
// a widget schema of their own: `id` (optional — specs stored before it existed;
// `normalizeTiles` fills it on read) and `placement: {x,y,w,h}` in 12-column grid units
// via `placementSchema`, absent = auto-flow. A `dashboard` honors `placement`; a `layout`
// ignores it and places by `column`, which is the whole difference between the kinds now
// that they hold one payload (ADR-0018). The field is `placement` and not `layout`,
// because a key named `layout` inside a section of a `layout`-kind view is a word
// collision.
//
// The section kinds above still name an `entityType` and mean an entity type — a
// deliberate deferral, not an oversight: sections move to `source` on the cut that
// registers the first collection source (ADR-0018, consequences).
```

Storage (built): `views` stores `scope` and `owner` alongside `handle`. `owner` is `''` for shared, the User id for personal, and the group id for group. It is an empty string and never null because owner is part of the uniqueness key. Postgres treats NULLs as distinct, so a nullable column would let two shared views keep one handle. Handles are therefore unique per owner: two Users may each keep a "My Pipeline", and a personal view shadows the shared one it is named after.

## Personal, group, and Tenant preferences

Three tables of their own store the audience model, apart from `views`. A favourite is a fact about a *pairing* of a User and a view, and a default is a fact about a *pairing* of an audience and an entity type. Neither is a property of the view.

| Table | Grain today | Grain needed |
|---|---|---|
| `views` | `scope ∈ personal \| group \| shared` + `owner`; group sharing checked against the same `group_members` the access plan reads | built |
| `view_defaults` | typed principal (`principal_type` + `principal_id`), `view_owner`, `priority` | built |
| `view_favorites` | unique on `(tenant, view_handle, principal)`; principal is a User | a group tier remains optional, and unbuilt |

**The group tier lets a group have a default, as a view can be shared with a group.** Without it, sharing has three tiers, defaults two and favourites one. A team that agrees "Underwriting opens on the Underwriting Pipeline" then has nowhere to store the agreement. Each User re-sets it by hand, or a TenantAdmin imposes it Tenant-wide on Users it does not fit.

These decisions make the tiers symmetric. All four are built for `view_defaults`; `view_favorites` keeps its single tier until a team asks to star together.

1. **Model the audience the same way everywhere, as a typed principal.** `principal` is `principal_type ∈ ('tenant' | 'group' | 'user')` plus `principal_id` (`''` for the Tenant tier), mirroring `views.scope` + `owner` exactly. Prefixing one text column (`u:…`, `g:…`) is the rejected alternative. A prefixed string has no join to `group_members` and no index per type, and every reader re-implements the parse. Parallel per-tier tables (`view_defaults_user`, `view_defaults_group`) are rejected too, because they repeat legacy's parallel view systems (`06`), which this model replaces.
2. **Precedence is an ordered fold with a stated tie-break.** Resolution runs: explicit `?view=` → the User's default → **the User's groups' defaults** → the Tenant default → the managed seed → a synthesized view. A User can be in several groups, so a rule decides which team's default applies, and row order does not. Group defaults rank by an explicit `priority` on the default row, and **higher wins**. Ties break by **ascending group id under a plain byte comparison**, with no locale collation, so two servers in different locales agree. The resolution result names the winner (`from: 'group:<id>'`), so whoever is asked, a TenantAdmin or SupportStaff, can say which default applied. The current resolver already returns a `from` discriminator for this reason.
3. **Defaults point at a view identity.** Handles are unique *per owner*. A group default naming only `pipeline` would resolve to a different view for the member who owns a personal `pipeline`, so one agreed default would render as several views. `view_owner` completes the identity, and `getViewByIdentity` resolves it through to the page: `resolveViewDefault` returns the owner, and the caller opens the view it picked. An explicit `?view=` still resolves by name, and there a reader's own copy shadows the shared one by design. A default whose target is gone is skipped.
4. **Membership is joined at read, never denormalized.** A group default applies because the reader is in the group *now*. Copying group defaults onto members at share time would leave a leaver with a team's default and an entrant without it. The same rule makes revocation one write: removing a User from `group_members` retires their group-derived defaults, favourites and picker entries. It also keeps the audience model and the access plan in step.

Group favourites follow the same model. A team-starred view appears in every member's starred list, marked as the team's. Un-starring it is a group-level act, so a member who does not want it hides it for themselves alone. Starring for a group and setting a group default take the same permission as sharing into that group: membership, checked against `group_members`. `saveView` already enforces this for `scope: 'group'`.

Lifecycle, so preference tables keep no orphan rows: deleting a User removes their personal views, defaults and favourites. Deleting a group reverts its views to the author's personal scope and drops its defaults and favourites. It never promotes the views Tenant-wide, because promotion is a decision and a deleted group has no one to make it.

## The source registry

A query view's `source` resolves through a registry keyed on the source, the same structure as the section registry (`packages/tenant/core/src/views/sources.ts`). One member covers every entity type, as one source with a parameter resolved through the entity-type registry. Each collection registers under its own name, because `proposals` and `jobs` share only the contract.

A source supplies the three parts below, and a query view works the same whichever kind it queries:

| A source provides | Why it matters |
|---|---|
| a **field surface**: handles, types, labels, and which of them are cheap to filter, sort and group by | save-time validation, the column picker and the predicate builder then work over a collection unchanged, and no collection needs a bespoke page |
| a **query executor**: predicate + sort + page → rows, resolved through the caller's access plan | the oracle guard, the withheld-value stubs and row filtering apply to a collection exactly as to an entity type, because the executor reaches the data through the same authorized operations the API serves |
| an **aggregate executor**, or a stated refusal | a source with no aggregate executor offers no summary or chart, and the reader sees a stated reason and no empty chart. Typed as a union, so a descriptor supplying neither does not compile |

A source answers "which rows, which fields". Joins, mutations and per-source display logic stay in their own layers and never enter the registry.

`resolveQueryView` reaches all three through `sourceFor(def.source)` and imports no read operation directly. A new source is therefore a registration and never a second read path. The entity source delegates to the projection compiler, `queryEntities` and `aggregateEntities`, so entities resolve the same way through the registry. `proposals` is the first collection source (ADR-0018).

## The section registry

Sections render through a registry keyed on `kind`, as field types render through descriptors in `@neuro/fields`. It answers `01` P1: legacy's ~20 hardcoded category checks and the 2,664-line dispatch.

A descriptor is one concept in **three files across three packages**. The spec must be importable by a client, the resolver must never be, and a React component has no place in a server package. Adding a section kind takes these three edits:

| Part | Where | Contract |
|---|---|---|
| **Spec** | `packages/shared/fields/src/specs/view.ts` | a Zod member of the `sectionSchema` discriminated union. Save-time validation and the Agent's emit contract are both this schema |
| **Resolver** | `packages/tenant/core/src/views/sections.ts` | `registerSection(kind, async (db, ctx, spec, host) => ResolvedSection)`, registered at module load. Reads only through the ordinary operations (`getEntity`, `listEdges`, `queryEntities`, `aggregateEntities`), so a section follows the viewer's access with no access logic of its own |
| **Component** | `packages/shared/ui/src/components/views/section.tsx` | a `case` in the exhaustive switch over `ResolvedSection['kind']`, plus its own component file if the body is more than a few lines. A kind needing an application service is named in `DELEGATED_SECTION_KINDS` and drawn by `apps/dpagentic/src/features/views/components/view-section.tsx` |

The seam between resolver and component is a **serializable resolved shape** (`ResolvedSection`): the component receives data, never a query or a spec. The same section therefore renders in an RSC page, a Nitro JSON response and a chat card with one renderer. `resolveSection` never throws. An unknown kind, a missing host record or a failing query returns `{ kind: 'unresolved', reason }`, so one broken section shows its reason in place and the page still renders.

The split's one hazard is drift. A kind registered server-side with no `case` to draw it falls through to `This build cannot draw a <kind> section`, and CI would not notice. **A guard test pins the pairing.** It compares `sectionKinds()` against the two lists `@neuro/ui` exports, `DRAWN_SECTION_KINDS` and `DELEGATED_SECTION_KINDS`, in both directions, and it asserts this app draws a body for each delegated kind (`apps/dpagentic/src/features/views/components/view-section.test.tsx`). Adding the `matrix` resolver failed the build until its component existed.

`ViewHost` is the third axis: `'page' | 'section' | 'chat'`. The same resolved shape renders in all three; the host only sets chrome (a page gets a toolbar, an embedded section gets a header and a cap, a chat card gets the AI border tokens). The AG-UI integration below depends on this one parameter.

**The chrome is Bolide's `Widget` shell, with bounded contents.** A section renders inside the design system's widget shell and has no frame of its own. `09-infoview-and-infobox.md` decides which of its slots the stored spec drives, which are derived at render, and which are per-viewer preferences that never enter a shared spec. It also gives a composition and a section their reader-facing names (InfoView, InfoBox), and decides that the record page converges onto this path.

**The resolver fetches; the component only draws.** `resolveComposition` resolves every section with `Promise.all` and hands the page an array of resolved data. Sections resolve in parallel and arrive together, so the page currently paints after the slowest one. The alternative makes each section an `async` server component behind its own `<Suspense>`, calling `resolveSection` itself. It streams the shell first and fills sections in as they finish. The trade is between one place that resolves a composition and first-paint latency under a slow section. That one place is today's design, and it lets the whole composition be tested without a component tree. The rule for switching: **move to per-section Suspense when any single section's p95 exceeds the rest of the page's**. Today none does: the heaviest sections are `nearby` and `related`, both single indexed reads. The composition is parallel and is not streamed.

## Related sections

A related section is **a hosted query view scoped by an edge**, with no widget of its own. Resolution:

1. `listEdges(entityId, edgeType)`, which already enforces both ends: the subject must be plan-visible (404-shaped like a missing record) and far endpoints the viewer's plan denies are absent (`packages/tenant/core/src/operations/writes/edges.ts`).
2. The admitted ids scope the hosted view's query; columns come from the named `query` view or the inline spec; values are read through `queryEntities`, so field rules apply to the related records exactly as on their own pages.
3. Render with TanStack Table (headless). Related sections are the long tail where AG Grid is more than needed (`02`, library posture). `EmbeddedInfoViewWidget` parity (a nested full layout) uses the same mechanism with a `layout` handle where a `query` view would go, capped at one level of nesting. Navigation handles deeper nesting, and rendering does not.

This single section kind replaces all three legacy relationship widgets (`01` P6).

**The id push-down (built).** Step 2 pushes an id restriction into the read. `id` is not a field handle and is never a predicate leaf, so `queryEntities` takes an explicit `ids?: string[]` input (an `id = ANY($1)` on the projection), and the edge scope applies in SQL. Reading a page of the type (`limit: 200`) and filtering in memory would miss linked records past the cap: a deal with twelve properties could render zero of them with no error. `map`, which would otherwise read 500 rows to plot a handful, uses the same restriction. The edge set bounds the read, so the cap bounds what is drawn and no longer what is found.

## Named measure kinds

`measures` today are `{fn, field, label}` with `fn ∈ count|sum|avg|min|max`. The rule: a *semantic* request (a comparison, a share, a threshold) becomes a named, typed measure kind and never a display flag. Named kinds retire legacy's 37 `option_type`s before a Tenant asks for them (`01` P8).

In the legacy corpus, the `calculation` column contains only our five functions, across 223 uses. `show_variance_column` is set six times and `show_benchmark_line_options` twice, both of those set to off (`08` §1). Legacy's two advanced axes, weighted average and interval bucketing, have **zero rows in fifteen years**. The aggregate set needs nothing added. No grouping deeper than two levels exists in 929 grouped views (752 one-level, 177 two-level), which confirms the ceiling. 67 views use a chart *series*, the second level rendered as colour, which Neuro stores and does not draw.

The ceiling stays: two grouping levels, the measure-kind registry, one chart per view. The near-term work is `share-of-total` plus series-encoded charts, with `variance` specified and deferred. `08-build-specs.md` §1 has the full design, the counts behind it, and what is rejected on evidence.

## Composition editing (drag-drop)

Direct-manipulation arrangement (dragging sections into order, dragging and resizing dashboard tiles) is an editing mode over the same spec, with one rule: **a drag is a spec edit; the drop commits it through `saveView`.** `02` has the interaction patterns and libraries (dnd-kit for 1-D reorder, react-grid-layout for the 2-D dashboard grid). The model owns the data contract they need:

1. **Tiles have `id`s** (above). Reorder, resize, optimistic reconciliation, and concurrent-edit merging all key on identity, and a positional array has none. Existing id-less specs normalize on read (index-derived ids), the same tolerant-read posture as `normalizeGroupBy`.
2. **`placement` is `{x, y, w, h}` in grid units**, stored in the spec, mapped to pixels per breakpoint by the renderer. Section order in a layout needs no coordinates at all — array order is the order.
3. **One drop, one save, compare-and-set.** The drag runs on a local optimistic copy; the drop writes the whole spec. `configTable` has no `version` column, so the check is on `updated_at`. The client sends the value it read, `saveView` adds `where updated_at = $read`, and a zero-row update raises a named conflict, so no update is lost (`08` loose ends).
4. **Scope decides where the drop saves.** Arranging a view the Principal may edit saves in place. Arranging a shared or managed view they may not edit forks a personal copy on first drop, the Linear lifecycle the picker already implements. The fork needs no handle generation. Handles are unique per owner, so the copy keeps its handle under the new owner and shadows the original, as the contract already states. Drag never becomes a write path around `scope`. Rearrangements the Agent proposes go through the same guard, because they are the same `saveView` call.

Board card drag is outside composition editing. Moving a card between stage columns changes the *record* and leaves the view alone, and it goes through the field-write path with its proposal checks.

## Views are an authorization surface

Four rules, two already built:

1. **Save-time oracle guard (built).** A view whose predicate, sort, or groupBy touches a field its author cannot read is rejected at save — `guardRequest` in `saveView` (`packages/tenant/core/src/operations/reads/views.ts`). Extend the same check to section specs via the registry's `specSchema` pass.
2. **Render under the viewer's plan, always.** A shared view suggests a shape and grants nothing: rows the viewer's plan excludes are absent, and withheld fields arrive as redacted stubs. There is no view-owned second query path. Sections resolve through the same operations the API serves, and the parity suites test that (`03`, non-functional).
3. **Read-time degradation is declared.** When the *viewer*, as opposed to the author, may not read a view's groupBy or a section's column, grouping over it would leak by count. The query guard closes that inference channel with 403. The view renders flat with a stated "grouping unavailable" notice, and a removed field renders a named "column removed" state (`01` P5). The view never crashes and never leaks the field.
4. **Performance is a save-time concern.** A stored predicate over an unpromoted field causes an outage each time it runs: 4 ms → 1,108 ms median, with 92% of load-test clients timing out (`docs/reference/poc/03-findings.md`, DPN-30/DPN-34). Saving a shared view whose predicate touches an unpromoted field is rejected or requires promotion, mirroring the rule-authoring constraint in `docs/coreservices/authz/07`.

## Views as the Agent's language (the AG-UI integration)

The Agent answers a data question with **a view spec** and no prose answer. The flow:

1. Nia receives "which deals are stalled in underwriting past 60 days?" and emits an ephemeral `query` view spec, the same Zod-validated shape a User's saved view stores.
2. The chat host renders it through the same registry (`ViewHost = 'chat'`), so the answer is the product's own table: sortable, filterable, rows opening to real records, styled with the design system's AI tokens so the Agent's output is recognizable (`--ai-border`/`--ai-background`, Bolide).
3. "Pin this" is one `saveView` call; the spec is already valid. "Open as page" is a URL, because views are URL-addressable (`/e/deal/v/<handle>`).
4. The readable channel exposes the view the User has open, so "add a cap-rate column" is a spec edit the Agent proposes through the same accept/reject flow field changes use.

Views come before further Agent work. The three cards hand-built for the demo (related records, memo figures, proposal review) are each a bespoke chat renderer for something the registry should render. One generic `renderView` tool plus the registry replaces the read-side cards, and every *future* section kind becomes available to the Agent with no Agent-side work. The Agent's capability grows by configuration, as the field system's data model does. Validation is the same `viewDefinitionSchema` both ways, and specs the Agent authors pass the same save-time guards under Agent ∩ User.

### The CopilotKit tool shape

The chat surface is CopilotKit, so "the Agent emits a view spec" has to be a specific tool shape. The tool built today has another shape. `showView` (`apps/dpagentic/src/features/agent/home-agent.tsx`) takes **flattened primitives** (`filterField`, `filterOp`, `filterValue`, `sortField`, `sortDir`, `columns`, `groupBy`, `measures`, `chart`) and reassembles a spec client-side. That limits the Agent to one filter leaf and one sort: no `all`/`any` nesting, no second grouping level, and no route for the measure kinds sequenced below. The model sees none of this flattening, so it keeps proposing compound filters that the parameter list drops without an error.

Five rules make the AG-UI surface match the model:

1. **One object parameter (built).** The tool takes a single `spec` parameter (CopilotKit action parameters nest via `type: 'object'` + `attributes`, or a JSON string for the whole spec), validated server-side by `queryViewDefinitionSchema`. The spec is the contract in both directions.
2. **Return validation errors verbatim to the model.** `resolveAgentView` already does this: a `safeParse` failure comes back as `path: message` pairs, never as a bare "invalid view". The model corrects itself from those errors, fixing its own field handle on the next turn. The Agent can therefore work with a small, strict schema. Keep this pattern for every spec surface the Agent uses.
3. **`render` for answers, `renderAndWaitForResponse` for spec edits.** Rendering a view is a read, so it draws immediately (`render`, as `showView` does today). *Changing* the view the User has open ("add a cap-rate column", "filter this to the West region") is a proposal. It uses `renderAndWaitForResponse`, so the User accepts or rejects a diff, as with field proposals (`play-actions.tsx` is the working precedent). On the Agent side, this applies "views are an authorization surface": the Agent never reshapes the view a User has open without that User's acceptance.
4. **Expose the current view through `useCopilotReadable`.** The record panel already publishes the open entity and its fields; a view page publishes the resolved view's handle, spec, and visible columns the same way. Without it, "add a column" has no antecedent, and the Agent composes a new view from scratch where it should propose a diff.
5. **Suggestions come from the view catalogue, with no hand-written list.** A view's `description` serves the Agent as much as a User (see the contract). The catalogue (handle, label, description, entity type) feeds the readable channel and `useCopilotChatSuggestions`. The Agent can then *pick the Tenant's Underwriting Pipeline* and does not build an approximation of it. Every new saved view becomes a new Agent capability with no Agent-side work.

Constraints on where this code lives, for the POC: the tools stay CopilotKit frontend actions backed by Next server actions. They make no changes to `apps/mcp` and no registration into the shared `packages/tenant/ai` Mastra registry. The resolved-shape API contract makes a later move a matter of placement. When `renderView` moves server-side (an MCP tool, a Mastra tool, a Nitro-hosted agent), it calls the same `POST /views/resolve` and returns the shape the chat card already draws.

## Data flow and request budget

- **First paint:** RSC resolves the view server-side; the browser gets HTML. One round trip.
- **Within a render, app side:** every read helper in `apps/dpagentic/src/features/` is wrapped in `React.cache()`. The duplicates found (`getEntityTypes` ×2, `getGroupableFields` ×3) drop to one query each.
- **Within a render, resolver side, where `React.cache()` does not reach.** `@neuro/core` is not a React package and must not become one, because it serves Nitro and workers too. The memoization stops at the app boundary, and every section resolver re-reads the registry for itself. `columnsFor` calls `listFieldDefinitions` **and** `getProjectionShape` per tabular section, and the `chart` resolver reads field definitions again for its option labels. A six-section layout makes a dozen identical registry reads for one page. The fix belongs on `OpContext`: a per-request memo (a plain `Map` keyed by `(tenant, entityType)`, populated by the read helpers, discarded with the context), so the composition reads once regardless of section count. It applies the rule of `React.cache()` one layer lower. Without it, section composition multiplies registry reads.
- **After paint:** TanStack Query only in mutation islands (proposals, inline edit, related-section refresh), hydrated with `initialData` from the server render, invalidated by `(entityId, version)` key. This replaces the whole-tree `router.refresh()` the accept path uses today. Cache keys align with the entity version the settle channel already tracks (`docs/coreservices/authz/07` front-end §5), so live updates and cache invalidation are one mechanism.

## The resolved shape is the wire contract

`ResolvedQueryView` and `ResolvedComposition` are plain serializable data, by design. That makes print, Excel export and a server-side Agent tool small additions. The contract: **the resolver's output is the API, and every host consumes the same JSON.**

Today only one host exists. `apps/api` (Nitro) has no view routes at all, so anything outside the Next render — a print/PDF worker, an Excel export job, a non-RSC client, an agent runtime that is not CopilotKit-in-the-browser — cannot resolve a view. Three of the sequenced items below (print, Excel, and any move of the agent tools server-side) are blocked on that, not on their own difficulty.

The route is thin because the resolver does the work: `POST /views/resolve` takes `{ handle | spec, host: { surface, entityId, entityType, locale } }` and returns the resolved shape, under the same Tenant resolution and `OpContext` every other Nitro route uses. Two rules keep it from becoming a second path to the data. It calls only `resolveQueryView`/`resolveComposition`, with no route-level query construction. An ad-hoc `spec` is `safeParse`d by the same `viewDefinitionSchema` a save uses, so the HTTP surface expresses only views a User could have stored. Add `shapeVersion` to the response before the first non-Next consumer, because a worker depends on the resolved shape.

## Corrections to the built code

Six defects or missing guards in code already built, each now fixed, with a negative control per guard.

| # | Correction | What it fixed |
|---|---|---|
| C1 | Id push-down for `related` and `map` (`ids` on `queryEntities`, compiled to a bound `IN` list in both read models) | scan-then-filter rendered zero linked records, with no error, once a type outgrew the read window. An empty list compiles to `false`, never to no restriction |
| C2 | Per-resolution memo (`views/cache.ts`) installed by the resolver on a copy of the context | composition asked the registry once per section; now once per type. Not a general operation cache: a cache that survived a write would serve a stale definition |
| C3 | Component-pairing guard (`sectionKinds()` vs the rendered switch, both directions) | nothing prevented the three-package split's halves from drifting. Adding the matrix resolver failed the build until its component existed |
| C4 | `POST /views/resolve` on Nitro, decisions extracted to `lib/views-resolve` so they test without booting Nitro | only the Next render could resolve a view, which is what blocked print and export. The payload carries `shapeVersion` |
| C5 | Group tier on `view_defaults`: typed principal, ranked precedence fold, identity-not-handle targets | a team could share a view but not agree on a default. Defaults now identify a view, so one agreed default never resolves to a different view per member |
| C6 | `buildViewSpec` gains a whole-spec path and a JSON `filter` predicate | the flat trio holds one leaf, so a compound question lost half of itself with no error |

## Sequencing

1. `React.cache()` on the read helpers: an hour's work that removes the duplicate reads found above, with no behavior change.
2. Wire the `query` view into the grid and board: columns/filter/sort/groupBy from the view; delete the standalone group-by picker. This also delivers the payload fix (222 columns → the view's columns).
3. Section registry + `fields` and `markdown` kinds; the detail page's layout resolution moves onto it (its output is unchanged).
4. `related` sections, the parity capability. The layout editor can wait; seeds and hand-authored specs exercise it.
5. Scoping columns + `view_defaults` + URL routing (`/v/<handle>`, with `?view=` and `?mode=` on a type page).
6. The chat host: generic `renderView` tool; refactor the related-records card onto it; the memo card's figures table follows.
7. `chart` sections consume the already-seeded `dashboard` views last: they are the least structurally novel once the registry exists.

Steps 1–2 are demo-visible immediately; 3–4 are the parity spine; 5–7 complete the model.

Beyond the core, in demand order, each item is a bounded addition to an existing layer (`02`, layered disciplines) and no new system. **Items 8–11 are built**, specified with their evidence and acceptance criteria in `08-build-specs.md`:

- **8 · `share-of-total` + series-encoded charts** (built). The legacy data showed a gap in chart encoding and none in aggregates. `share-of-total` adds no query and divides by the `ROLLUP` grand total, so truncation leaves it correct. `series` renders the second grouping level as colour through `bar-grouped`/`bar-stacked`/`bar-100`, and is guarded at save exactly like `groupBy` because its values are the legend. `variance` is specified and deferred; weighted average and interval bucketing are rejected on evidence (`08` §1).
- **9 · `matrix` section kind** (built): the bounded `custom_table` answer: field references only, host-record resolution, sparse, bounds enforced in Zod, withheld cells stated (`08` §2).
- **10 · Print target** (built): Paged Media over the same resolved composition, with a single-use scoped token so a PDF has the requester's access and never a worker's (`08` §3). The registry attaches `breakBefore`, so every section kind has it.
- **11 · Excel export** (built): raw values plus descriptor-derived number formats, `ROLLUP` levels as outline levels, subtotals as values and never formulas (`08` §4).
- **12 · Chart library upgrade**: only when tooltips/axes/zoom are demanded; grammar-shaped (Observable Plot) first, keeping the bucket shape as the interface.
- **13 · Composition editing**: dnd-kit section reorder, then react-grid-layout dashboard arrangement, on the `id` + `{x,y,w,h}` contract above. It comes last because specs written by hand and by the Agent exercise the model without an editor, and the editor is UI alone once the data contract exists.

Items 12 and 13 remain unbuilt. Item 12 waits for a demand the current SVG does not meet. Item 13 is the editor: its data contract (a tile's `id` + `placement`, compare-and-set on `updated_at`) is specified above, and its UI is not written.
