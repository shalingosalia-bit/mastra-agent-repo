# View requirements, as stories mapped to the model

It settles what the views system must enable, for a Builder building or reviewing a piece of `04-proposed-model.md`. Each story cites its evidence, a legacy mechanism Tenants use or a finding from this branch, and the piece of `04` that covers it. The cast is shared with `docs/coredata/entity-fields/field-actions/03-requirements-and-user-stories.md`, so the two stacks describe one product.

## The cast

| Who | Actor | What they touch |
|---|---|---|
| **Priya Raman** | TenantAdmin (`admin` profile role) | authors the Tenant's views and defaults |
| **Dana Okonjo** | DealLead (`member`) | works in the pipeline; opens deals all day |
| **Sam Reyes** | Analyst (`member`, restricted from some fields) | works the same views as Dana, sees less |
| **Marcus Webb**, lender contact | Collaborator (external, read-only) | one shared view is his whole product |
| **Nia** | Agent (the Tenant's AI agent) | answers questions by producing views; drafts changes through them |
| **A Builder** | Builder | adds a section kind without touring the codebase |

Grounding scenario: Alpine runs its pipeline from one saved view, grouped by stage. Every deal page shows its properties and its fund. The IC asks Nia questions like "which deals are stalled in underwriting past 60 days?", and expects an answer it can sort.

## Configuration stories: Priya

| Story | Evidence | Covered by |
|---|---|---|
| As a TenantAdmin, I define once which columns, filter, sort and grouping a type's list shows, and the table, the board and any export all follow it | the grid currently derives 222 columns from the registry; 648 KB/page, collapse at 41 req/s (`docs/reference/poc/03-findings.md`) | the `query` view as the single query+shape source; layout kinds render it |
| As a TenantAdmin, I add a section to the deal page showing its properties, using an existing properties view, filtered to active ones | `AssociationsWidget`/`EmbeddedInfoViewWidget` are core legacy usage (`01` P6) | `related` section = hosted `query` view + edge scope |
| As a TenantAdmin, I pick the default view per entity type, and Users can set a personal default over it | legacy hardcodes the default; every surveyed product has this (`02` §5) | view scoping: `managed default < tenant shared < personal` |
| As a team lead, my team opens on our view, and neither on the Tenant-wide one nor on one each of us re-picks by hand | views can be shared with a group today, but `view_defaults` has only User and Tenant tiers (verified against the live schema) | the group tier on `view_defaults`, with the stated precedence fold and tie-break (`04` preferences) |
| As a team member in three groups, which team's default I get is a stated rule, and a TenantAdmin or SupportStaff can tell me which one applied | a User can belong to several groups; row order is no answer | ranked group defaults; the resolver returns `from: 'group:<id>'` (`04` preferences) |
| As a team member who leaves a team, that team's views, defaults, and stars stop appearing for me immediately | membership drives the audience model | membership joined at read, never denormalized (`04` preferences) |
| As a TenantAdmin, I am told at save time when a view references a field that does not exist, does not apply to the type, or that I may not read | legacy breaks with no warning on rename/delete (`01` P5); the oracle guard already exists at save (`views.ts:66`) | save-time validation, extended to columns/sections |
| As a TenantAdmin, when a field is later deleted, views that referenced it degrade to a named "column removed" state and do not error | `01` P5, read side | tolerant resolution in the view resolver |
| As a TenantAdmin, I share a view with the team, or keep it mine | `views` table has no audience dimension today (verified 2026-08-02) | `scope: personal \| shared` + owner |
| As a TenantAdmin, I arrange a dashboard by dragging and resizing its tiles, and every User who opens it sees my arrangement | legacy reporting dashboards are User-arranged widget grids; a TenantAdmin reorders `info_view_sections` positions | a tile's `id` + `placement {x,y,w,h}` in the spec; commit-on-drop via `saveView` (`02` drag-drop, `04` contract) |
| As a TenantAdmin, I arrange fields in a labelled matrix (rows × columns of field references) without any per-cell styling | `custom_table` is the second-most-used legacy section category: 12 uses on the evaluation Tenant, 893 cells in dev (`07`) | the bounded `matrix` section kind (`04`) |
| As a TenantAdmin, I print or export a record page as the document the IC sees, and it is the same page, with no second layout to maintain | the InfoView export toolbar; 119 saved export configs; `is_page_break` (`07`) | print/export as render targets of the resolved composition; one break hint per section (`04`) |
| As a TenantAdmin, when I need a variance or benchmark comparison, I add a named measure and no display toggle | 37 legacy `option_type` flags, `show_variance_column` among them (`01` P8) | named measure kinds in the measure registry (`04`) |

## Working stories: Dana and Sam

| Story | Evidence | Covered by |
|---|---|---|
| As a User, the pipeline I see is a URL I can send to a colleague, and it opens identically for them | `01` P4: legacy view state is trapped in Redux; Linear's view-=-URL discipline (`02` §2) | `/e/<type>/v/<handle>` routing; display params in the URL |
| As a User, switching table ↔ board changes presentation only: same records, same filter, same grouping | the demo board invented its own picker, diverging from the view (`00`) | one `query` view, many renderings |
| As a User, a deal's page shows its properties and its fund without my navigating anywhere | the legacy relationship widgets (`01` P6) | `related` sections |
| As a User, the page paints once, fast, and sections fill in, with no spinner per widget | 15–30 XHRs/page in legacy (`10-frontend-sunspear.md`); EU round-trip tax | RSC + per-section Suspense streaming (`02`) |
| As an Analyst, the same shared view shows me less: restricted fields are withheld, restricted rows are absent, and it never errors | authorization is enforced in the query (`docs/coreservices/authz/00`); redacted values arrive as withheld stubs | viewer-plan resolution at render (see `04`, authorization) |
| As an Analyst, when a shared view *groups by* a field I may not read, I get a stated degradation, and the grouping reveals nothing about the field | group counts over a hidden field leak it. The 403 guard closes the same inference channel on queries | read-time guard + declared fallback |
| As a User, when I accept an Agent proposal, only the affected card updates, and the page does not reload | current post-accept path is `router.refresh()` (whole-tree re-render) | scoped client cache keyed by entity version (`02`) |
| As a User, when I rearrange a shared dashboard I may not edit, I get my own copy on the first drop, and the shared one is unchanged | Linear's fork-on-edit lifecycle (`02` survey) | scope-aware drag-drop: edit in place if permitted, else personal fork (`02` drag-drop rule 5) |
| As a User, when two of us arrange the same dashboard, neither loses the other's changes unseen | the standard lost-update hazard of drag-and-drop editing | version-checked `saveView`: a mismatch shows "changed while editing" (`02` drag-drop rule 4) |

## External stories: Marcus

| Story | Evidence | Covered by |
|---|---|---|
| As a Collaborator at a lender, the one view shared with me is my entire surface: I reach its records and its columns and nothing more | magic-link/shared-access model (`docs/coreservices/authz/08`) | a shared view resolved under the *viewer's* plan: the view never widens access, and authorization narrows it |
| As a Collaborator at a lender, I may not edit a view shared to me so that it shows more | same | view spec is read-only to `scope` outsiders; the plan bounds results regardless |

## Agent stories: Nia

Legacy has no Agent surface, so these have no legacy analogue.

| Story | Evidence | Covered by |
|---|---|---|
| As the Agent asked "which deals are stalled past 60 days?", I answer with a **rendered view** that a User can sort, filter and open, and write no prose answer | the demo's related-records and memo cards are hand-rolled versions of this; the pattern generalizes | ephemeral `query` view spec → the same section registry renders it in chat (AG-UI host) |
| As the Agent, when the User says "pin that", the answer becomes a saved personal view with one write | views are rows; the spec I emitted is already valid | `saveView` on the ephemeral spec |
| As the Agent, I read the view the User has open, so "add a column for cap rate" is a spec edit I can propose | `useCopilotReadable` already exposes the open record; views extend the same channel | readable view context + propose-view-change flow |
| As the Agent, every view I author reads only what my Principal may read | Agent ∩ User is the standing rule; save-time `guardRequest` exists | same guard, Agent path included |
| As a Builder, I add a section kind by registering a descriptor (spec schema + server component) in one place | `01` P1: legacy's ~20 hardcoded category checks and 12-file type edits | the section registry (`04`) |

## Non-goals

Legacy's variant explosion (`07`) happened one reasonable request at a time. What the view system excludes is therefore a requirement. Each row names the demand behind a request and where Neuro serves it:

| The view system is not… | The rule | The real demand, served elsewhere |
|---|---|---|
| **A styling surface** | no view, section, row, or cell stores fonts, colors, borders, shading, or number-format flags (`01` P7) | formatting belongs to the field descriptor (a negative number renders one way, everywhere); looks belong to Bolide tokens |
| **A spreadsheet** | a view never computes; no per-cell anything | fields and calculations own computation; "arrange fields in a labelled matrix" gets the bounded `matrix` kind (`04`); spreadsheet demand gets a spreadsheet engine as its own document type |
| **A word processor** | print is a render target of the resolved composition; one break hint per section is the entire print-specific spec | CSS Paged Media + Chromium print over the same components (`02` layer 3) |
| **A BI tool past its ceiling** | the ceiling, named: two grouping levels, the measure-kind registry, one chart per view | above it, the semantic layer is the export surface: hand the measures to an analytics tool, and add no option flags (`01` P8) |

## Non-functional requirements

| Requirement | Threshold | Source |
|---|---|---|
| Browser round trips per page view | 1 (the document); client XHRs only in mutation islands | `02` data-fetch patterns |
| Repeated identical reads within one server render | 0 (memoized): app side via `React.cache()`, resolver side via a per-request memo on `OpContext` | duplicates found (`00`); per-section registry re-reads in `columnsFor` (`04` data flow) |
| Registry reads per composition | constant, and independent of section count | `04` data flow |
| Records shown by a `related` or `map` section | all linked records the viewer may read, or a stated truncation; never an unreported subset because the linked rows fell outside a scan cap | `04`, the id push-down |
| Agent-emitted view expressiveness | whatever `queryViewDefinitionSchema` accepts, including nested predicates and multiple measures; the tool parameter is the whole spec | `04`, CopilotKit rules 1–2 |
| Hosts able to resolve a view | any caller of the operations layer, over HTTP as well as in-process; print, export and non-RSC agents are ordinary consumers | `04`, the resolved shape is the wire contract |
| View payload | the view's columns, never the registry | 222-column finding (`docs/reference/poc/03-findings.md`) |
| Shared-view predicate on an unpromoted field | rejected or flagged at save, as an availability hazard | 4 ms → 1,108 ms collapse, DPN-30/DPN-34 |
| A view render under enforcement | same rows/fields as the equivalent direct query: no widening, no second path | parity suites (`packages/tenant/core/src/authz/projection-parity.integration.test.ts` as the pattern) |
