# Best-practice research: how mature products model views, and the patterns to adopt

It settles which industry patterns Neuro's views model adopts and which it leaves out, for a Builder designing a layer or choosing its library. It covers how mature products model views, the external discipline each layer borrows, and drag-and-drop composition. It ends with the data-fetching patterns that keep a view-driven UI fast.

Sources: public product behavior and documentation. Where a claim is inferred from observed behavior, the text says so.

## The survey

| Product | View model | What it does well | What it teaches by omission |
|---|---|---|---|
| **Airtable** | A view is a named object on a table in its own right: filter + sort + field visibility + one of several *layouts* (grid, kanban, calendar, gallery, form) over the same data | Switching grid→kanban changes no data semantics. Views are the product's sharing primitive: a share link is a view | Views are per-table only, with no cross-table composition. A record's "page" showing related records is a separate mechanism (record detail + linked-record fields) |
| **Notion** | A database view = filter + sort + grouping + layout; views can be embedded in any page, including other databases' pages | **Embedding is the paradigm**: a view is a block that composes anywhere. Of the products surveyed, it is closest to "related section = hosted view" | Weak typing of the underlying schema; performance degrades visibly with size because the client does too much |
| **Salesforce** | Layered: list views (query + columns), page layouts / Lightning record pages (sections + components per record type and profile), **related lists** (a child object's list view hosted on a parent's page) | Related lists show the market need: every CRM record page is mostly related lists. Per-audience layout assignment is built in | The layering is confusing (layout vs Lightning page vs compact layout vs record type). Neuro uses one contract with kinds and no parallel systems |
| **Linear** | Views are saved filter+display configurations, always URL-addressable; every board/list/timeline is the same query with a display mode | **View = URL** discipline: everything on the page is reproducible from the address bar. Display mode is orthogonal to the query | No per-record layout configuration. That suits Linear's product and would not suit a field-system product |
| **ServiceNow / Retool class** | Server-defined UI schemas rendered by a generic client | Shows the registry pattern at scale: the server sends descriptors, and the client owns a component catalogue keyed by kind | A descriptor language that grows ad hoc becomes a poor programming language. Keep the spec small and typed |

Rules to adopt:

1. **Separate the query from the presentation.** Filter, sort and scope are one axis; layout (table, board, sections, chart) is another. Airtable and Linear both show one query in many layouts. Neuro's `query` view already has `groupBy`, so the board and the table are two renderings of one view. The demo departs from this by giving the board its own picker.
2. **A view is a named, addressable artifact.** URL-addressable (Linear), shareable (Airtable), embeddable (Notion). Page state that a stored spec plus a URL does not reproduce is component state, and no view.
3. **Compose views; do not add widgets.** Notion's embedded views and Salesforce's related lists both show related records by hosting a view in a section, scoped by the relationship. Neither builds a bespoke "related records widget" (Sunspear built three; see `01` P6).
4. **Rendering is a registry lookup.** Section kind → component, one catalogue, enumerable and validatable. A registry is also the precondition for UI the Agent generates. The Agent emits a spec against a closed, typed catalogue, and a bespoke React tree is outside what it can emit.
5. **Views need an audience dimension.** Personal vs shared vs managed-default exists in every surveyed product. Neuro's `views` table currently has none of it.

## The layered disciplines

The variant explosion (`07-widget-variant-explosion.md`) happened because legacy answered every kind of request inside one widget system. Neuro names the layers of the model, so each layer adopts the external discipline the industry uses for it. A request then goes to its layer and does not accrete as an option flag (`01` P8). The model has one data contract, one composition contract, many render targets and bounded interaction:

| Layer | Our contract | Discipline to adopt | Library / standard | Status |
|---|---|---|---|---|
| **1. Semantic**: what is being asked | `query`: source, predicate, columns, sort, `groupBy`, `measures` | **Semantic-layer discipline** (dbt MetricFlow, Cube, LookML): measures and dimensions are *named registry things*, never per-view booleans. Variance, benchmark-delta, period-over-period become measure kinds with typed parameters | Nothing to install: a discipline and no product. Our Zod specs are the definition format | measures and groupBy built; derived measure kinds are the growth path |
| **2. Composition**: how answers are arranged | `layout`/`dashboard`: ordered typed sections; the registry | **Typed block document** (Notion's block model, Sanity's Portable Text): a document is a tree of versioned typed blocks; an unknown block renders as an explanation, never a blank | our registry already follows this; Portable Text is the reference for schema-evolution discipline | built, including unknown-kind degradation |
| **3. Render targets**: where a resolved view appears | one resolved shape → page, section, chat, print, export | **Render-target rule**: every target consumes the *same resolved composition*. Print = CSS Paged Media (`@page`, break rules) over a print route, PDF via headless-Chromium print, with the same components and no second layout config. Excel = serialization of resolved rows and groups, never its own query | Paged Media is a W3C standard; Playwright/Puppeteer for print-to-PDF; SheetJS or exceljs for workbook output | page/section/chat built; print and export are the named gaps |
| **4. Rendering vocabulary**: how data becomes marks | display modes (bounded enum) + chart kinds | **Grammar of graphics** (Vega-Lite, Observable Plot): a chart is data + mark + encodings. Adopt the *grammar* as the shape of our chart spec so kinds stop multiplying ad hoc; adopt a library only when charts need axes/tooltips/zoom beyond the current SVG | Observable Plot (lightweight, grammar-shaped) or shadcn Charts (Recharts) as the upgrade path; today's server-rendered SVG stays while it suffices | bar/donut/line/stat built; the enum is the bound |
| **5. Interaction**: how Users manipulate views | URL-as-state; picker/favorites/defaults; drag-drop composition | **Headless UI primitives** + Linear's saved-view lifecycle (keep → star → share with team → publish); direct-manipulation edits always write back to the **spec**, never to component state (`01` P4) | TanStack Table/Virtual, AG Grid where already dense; dnd-kit + react-grid-layout for composition (next section) | lifecycle and URL-state built; drag-drop is a named gap |
| **6. Style**: what everything looks like | Bolide tokens (`ADR-0009`) | **Design-token discipline** (W3C Design Tokens format as the eventual Figma↔code interchange): components consume semantic tokens; *no view instance stores style* (`01` P7) | Bolide sheet adopted verbatim; guard tests pin it | built |

**The Agent constraint on every adoption.** The Agent emits the same spec a User saves, and authorization runs in the one resolver. No BI or plugin product offers this. Every library adoption must preserve it, and the spec stays the only contract. With a grammar-of-graphics renderer, the Agent still emits Neuro's view spec, and the server derives the chart spec from resolved data. An Agent authoring raw Vega-Lite with inline data would bypass the permission-checked resolver. The architecture must never allow that.

**Not adopted**, with the layer rule each breaks:

- **A BI platform embed** (Metabase/Superset/Looker iframes): breaks one-resolver authorization and the Agent contract. When analytics demand exceeds what layer 1 supports, the semantic layer becomes the export surface: hand the measures to an analytics tool.
- **A spreadsheet component inside sections** (Handsontable/Univer *as a section*): brings in the unbounded per-cell variant space (`01` P7). If Tenants need a spreadsheet, embed a spreadsheet engine as its own document type beside the view system.
- **A block *editor* framework as the runtime** (ProseMirror/BlockNote for rendering views): sections are resolved data and are never edited as rich text. Adopt the block-model discipline and leave out the editing runtime.
- **react-pdf-style PDF generation**: a second layout engine that drifts from the web rendering. Chromium print draws the same components, so it stays in step.

## Drag-drop composition (arranging views by direct manipulation)

Legacy shows the demand. Reporting dashboards are User-arranged widget grids, and `info_view_sections` rows store `position` and column assignments that a TenantAdmin reorders. One rule keeps drag and drop out of pitfall P4 (state trapped in components): **a drag is a spec edit**. The gesture changes a local optimistic copy. The drop commits the whole spec through `saveView`, the write path the Agent and the settings form also use, and the render re-derives from the stored spec. No layout state is stored anywhere else.

Both libraries are headless: they handle gesture math and leave rendering to Bolide tokens.

| Shape | Where it appears | Library | Data pattern in the spec |
|---|---|---|---|
| **1-D reorder**: sections within a layout, columns within a table, rows within a matrix | record-page section order; column arrangement | **dnd-kit** (sortable preset): actively maintained, accessible (keyboard sorting, screen-reader announcements), with no styling opinions | array order *is* the order; a drop writes the reordered array. No position field to drift from the array |
| **2-D grid placement**: dashboard tiles dragged and resized on a grid | the dashboard editor | **react-grid-layout**: the standard 12-column grid model (drag, resize, collision push, responsive breakpoints) | each tile has a stable `id` plus `placement: {x, y, w, h}` in grid units; a drop writes the new coordinates for the affected tiles |

Data-pattern requirements (specified in `04`):

1. **Stable tile identity.** A dashboard's tiles need an `id` independent of array position. react-grid-layout keys its layout items on it, the optimistic UI reconciles on it, and concurrent editors' changes merge on it. A positional array supports none of these.
2. **Grid units.** `{x, y, w, h}` in a 12-column abstract grid keeps the stored spec independent of the device, and the renderer maps units to pixels per breakpoint. A spec stored in pixels is wrong on any other screen size.
3. **Commit-on-drop, optimistic during drag.** The drag changes local state at 60fps, and only the drop issues a write. One drag is one `saveView`; a mouse move writes nothing.
4. **Version-checked saves.** When two Users arrange the same shared dashboard, neither save may overwrite the other unseen. The save sends the version it read. A mismatch shows "this view changed while you were editing", and no update is lost.
5. **Authorization follows the view lifecycle.** Arranging a view the User may edit saves in place. Arranging a shared or managed view the User may not edit forks a personal copy on first drop (the Linear pattern). The gesture never becomes an edit path around `scope`.

Board card drag (moving a deal between stage columns) changes data, the record's stage field, and leaves the view spec alone. It goes through the field-actions write path, with its own proposal and permission checks, and never through `saveView`.

## Data-fetching patterns

The performance goal: **one network round trip from the User's browser per page view, however many sections the view has.** The patterns, in order of their effect:

**Server-first rendering (the current architecture).** Pages are React Server Components. A view resolves and renders on the server, so the browser receives HTML and no fetch plan. This fixes Sunspear's 15–30-XHR waterfall (`10-frontend-sunspear.md` outcome 3). The fan-out still happens, in parallel, between the server and the database on a fast network.

**Request memoization within a render.** Wrap the per-request read helpers in `React.cache()` so the same question asked twice in one render runs one query. This is currently missing: `getEntityTypes` runs in both the shell layout and the entity page, and the board path resolves `getGroupableFields` three times per render (`apps/dpagentic/src/features/`, verified 2026-08-02). The change alters no behavior and takes a few lines. It lets sections compose safely: twenty sections can each ask "what fields does this type have" and share one query.

**Sections stream behind Suspense.** Each section of a view is a server component that fetches its own data and streams independently. The shell paints first, and the sections fill in. This keeps the independence of Sunspear's per-widget fetching and drops its client round trips. A slow related section never blocks the fields section.

**Client cache only where the client owns state.** Use TanStack Query only in the islands that mutate and refetch after first paint: the Agent panel's proposals, inline-edit settle states, related-section refresh after an accepted write. Hydrate those with `initialData` from the server render so nothing is fetched twice, and invalidate by key. `router.refresh()`, the current post-accept behavior, re-renders the whole RSC tree to update one card. Everywhere else, a client cache on an RSC page adds requests, so the default is no client fetching.

**Live updates use the existing settle channel.** A rendered view is a query whose answer changes. The settle mechanism (`reflects_version`, `useLiveEntity`, Electric) is the update path: a view subscribes to the entities it shows and does not poll. The authorization guidance caches affordances and values against the entity version the client already tracks (`docs/coreservices/authz/07`, front-end §5). Views should key their client caches the same way.

**Payload follows the view's columns.** A view's `columns` is the select list. The demo grid derives its columns from the full registry. It sends 222 columns / 648 KB per page and collapses at 41 req/s, where a scoped read sustains 119 (`docs/reference/poc/03-findings.md`). A views system also limits payload size.

## Component-library posture

shadcn/ui remains the base. Bolide (`dealpath/ui-components`), the design system this UI must converge with, is itself built on shadcn with the same token vocabulary. Convergence is therefore token adoption with no component migration, and it is done for the Agent surfaces. The views system adds **TanStack Table** for related sections and other long-tail tables, where AG Grid Enterprise is more weight than needed. It adds **TanStack Virtual** where a section can be long. AG Grid stays for the dense, filter-heavy primary dashboards. That split, one grid for the primary dashboards and headless tables for the rest, follows the disposition in `10-frontend-sunspear.md`.
