# Legacy pitfalls: what Sunspear's presentation layer teaches

It settles which parts of Sunspear's view layer Neuro keeps and which implementation traps it avoids, for a Builder designing or reviewing Neuro's views. Every Sunspear widget and layout option exists because a Tenant configured it, so the paradigm comes first as the requirements source. The pitfalls follow, each stated as effect, then cause.

Sources: the current-state assessments `10-frontend-sunspear.md`, `10.2-configurable-field-presentation.md` and `10.3-reporting-dashboards-and-widgets.md`, and for P7 and P8 the variant analysis in `07-widget-variant-explosion.md`.

## The paradigm to keep

Sunspear presents records through three composed surfaces:

| Surface | Composition | Scale (assessed) |
|---|---|---|
| **InfoView** — a record's page | Panels → Sections → Widgets, laid out per Tenant configuration; a section's `category` selects its widget | ~21,100 lines / ~100 files |
| **EntityDashboard** — a type's list | AG Grid driven by saved filters, column sets, and grouping | grid orchestration alone is a 4,275-line file |
| **Reporting dashboards** | User-arranged chart widgets over filtered record sets | ~11,150 lines |

The widget catalogue shows how Tenants use the product. Alongside the fields widget (`DetailsWidget`) sit **relationship widgets**: `AssociationsWidget` and `AttachedEntitiesWidget` render tables of *other* entity types related to the open record, and `EmbeddedInfoViewWidget` nests an entire second layout inside a section (`sunspear/app/components/InfoView/InfoViewWidgets/`). In the legacy product, a deal's page contains a live, filterable table of its properties, and each row opens into that property's own layout. Tenants use the product this way. A Neuro views design must express this to meet the parity bar.

Properties of the paradigm to preserve:

1. **Layout is configuration.** Which sections appear, in what order, with which fields, differs per Tenant, and a TenantAdmin changes it without a deploy.
2. **Sections are typed.** A section declares what kind of thing it is (fields, related records, notes, map, chart) and the kind determines rendering. Neuro keeps the idea of a widget registry, which legacy never built.
3. **Views are shaped by audience.** The same record renders differently for different Users. Legacy does this with conditional display rules, and Neuro does it with authorization. Neuro keeps the principle and changes the mechanism.

## The pitfalls

**P1: Dispatch by switch statement, with no registry.** Effect: adding or changing a section or field type is a many-place edit that drifts. Cause: the widget layer has no registry. A page picks widgets through ~20 hardcoded `if (section.category === WIDGETS.X)` checks, and field rendering runs through a 2,664-line nested `switch` (`DpFieldValueEdit.tsx`). The type-to-behavior mapping is re-implemented in at least 12 files. Unregistered dispatch has no single place to enumerate, validate or extend the catalogue. Every addition starts by finding each place the mapping is re-implemented.

**P2: Each widget fetches for itself, from the client.** Effect: a record page fans out 15–30 sequential XHRs; a European User spends most of a second network-bound before the server does any work. Cause: every widget is a bespoke tree with its own client-side data fetch against the connector layer. Per-widget fetching lets sections load independently. Run on the client, it multiplies round trips and runs no server work in parallel. The fix keeps the shape (each section fetches its own data) and moves the fetch server-side behind Suspense.

**P3: Presentation-layer "security."** Effect: a field the UI hides is present in the payload; conditional visibility and redaction are evaluated client-side per render. Cause: views were the only place rules could run, so rules ran where the data had already arrived. Neuro's authorization layer enforces in the database. The views system still inherits one obligation from this pitfall: a view must never become the bypass. A stored view is a stored query, and a stored query another User authored is an oracle vector (see `04`, "Views are an authorization surface").

**P4 — View state trapped in component state.** Effect: a configured screen cannot be linked, shared, restored after refresh, or reproduced in a bug report. Cause: active filters, grouping, and column state live in Redux and component state rather than in an addressable artifact. The dashboard's saved filters partially escape this; the InfoView's runtime state does not.

**P5: No referential integrity between views and fields.** Effect: renaming or deleting a field breaks every layout, saved filter, and widget that referenced it, with no warning, and the next User to open the page discovers it. Cause: views store field references with no save-time validation and no tolerant read path. Neuro already validates at save (`views.ts`). The read side must degrade explicitly, as a named "this column no longer exists" state, and must neither crash nor drop the column without saying so.

**P6: The relationship widgets are bespoke, not composed.** Effect: `AssociationsWidget`, `AttachedEntitiesWidget`, and `EmbeddedInfoViewWidget` each have their own fetching, their own mini-table and their own view-mode variants. They are three implementations of "show related records", and an improvement to one reaches neither of the others. Cause: there is no notion of "a view rendered inside another view," so each embedding was built as a one-off. This pitfall sets the central design in `04`: a related section is a hosted view, with no widget kind or rendering of its own.

**P7: Per-instance styling turned widgets into documents.** Effect: the design system could not own the widgets. Bolide's own lead: *"one critical reason why we cut it is because there are thousands of variants to info view widgets and reporting widgets."* Cause: every section instance stores its own presentation state (nine styling booleans, label sizes, row heights, colour ids; ~16,000 states across the observed category×view_type pairs before the numeric axes), and `custom_table` goes further with a per-cell style record (background, font colour, bold/italic/underline/strikethrough, alignment). The styling exists because InfoViews are *published*: the toolbar exports PDF and Excel, so Users did document layout inside a view system. `07-widget-variant-explosion.md` has the measurements. The rule that follows: **no view, section, row, or cell stores style.** Formatting belongs to the field descriptor, looks belong to tokens, and print is a render target, never a second layout configuration.

**P8: Option-flag accretion, with no named semantics.** Effect: 37 distinct `option_type`s on reporting views (`show_variance_column`, `show_benchmark_line_options`, `highlight_critical_dates`, `subtotal_location`, `underline_formulas`…), each a boolean added when a Tenant asked, none composable, every one a permanent rendering obligation. Cause: the view was the only place to put a request, so *semantics* (a variance is a comparison; a benchmark is a threshold) were encoded as *presentation switches*. A request about meaning belongs in the measure or field model as a named, typed thing. A `variance` measure kind retires the flag before it exists.

## What legacy never had

Parity comparison misses these: no default view per entity type (hardcoded); no view-level description of *why* a view exists (the Agent needs this); no way for a non-human to author or render a view; no server-rendered first paint of any view. Neuro adds each of these new.
