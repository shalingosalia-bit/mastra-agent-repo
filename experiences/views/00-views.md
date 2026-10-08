---
type: spec-stack
status: partly-built
---
# Views

## Purpose

Views are the pages where a User reads and works with records: tables, boards, charts, maps and dashboards. A saved view is stored as configuration, so a TenantAdmin changes one without code. When it is built:

1. A User opens a saved view and sees what was saved, as a table or a board, with the same records, filter and grouping.
2. A User opens a deal and sees its related records, such as its properties and its fund, on the same page.
3. A TenantAdmin arranges a record page or a dashboard by dragging its sections, such as fields, related records, charts and maps.
4. A TenantAdmin sets a record type's default view for the whole Tenant or for one group of Users.
5. An Agent answers a question about records with a view the User can sort, filter, save or open as a page.

## Scope

1. **The view contract.** A saved `query`, `layout` or `dashboard` definition, validated when it is saved.
2. **Sources.** A `query` reads an entity type or a registered collection, such as proposals or work items (ADR-0018).
3. **The section registry.** Each section kind is one schema, one resolver and one component, drawn the same on a page, in a section and in chat.
4. **Related sections.** A `query` view shown on a record's page, limited to the records joined to it by one `entity_edges` edge type.
5. **Measures and bounded sections.** Named measure kinds, the `matrix` section, and one page-break hint per section for print (`08`).
6. **Composition editing.** Arranging a dashboard's or a layout's sections by drag and drop, saved with a version check.
7. **Which view opens.** The URL, then the User's, their group's, the workspace's and the Tenant's defaults, then the managed default, with a stated fallback for a deleted field.
8. **Access.** A view never widens access. An Analyst sees only the fields and rows they may read, and a Collaborator sees only the views shared with them. A view is checked against its author's access at save, and the viewer's at render.
9. **Render targets.** One resolved view drawn as a page, a section, a chat answer, a print or an Excel file, or returned by `POST /views/resolve`.

Not in scope:

1. **Saving, forking, publishing and setting defaults from a list page:** [`../filters/`](../filters/00-filters.md).
2. **Field types, formatting and derivation:** [`../../coredata/entity-fields/`](../../coredata/entity-fields/00-entity-fields.md).
3. **Access plans and redaction:** [`../../coreservices/authz/`](../../coreservices/authz/00-authorization.md).
4. **The print worker fleet:** [`../../coreservices/render/`](../../coreservices/render/00-render.md).
5. **The box shell and visual tokens:** Bolide and [`../design-system/`](../design-system/00-design-system-reference.md).
6. **The app shell and navigation:** [`../workspaces/`](../workspaces/00-workspaces.md).
7. **Agent competences and sessions:** [`../../agentic/agentic/`](../../agentic/agentic/00-agentic.md).

## Three hosts

One view contract, rendered by one registry, in three hosts:

| Host | Example | Why it matters |
|---|---|---|
| A page | `/e/deal` rendering the Tenant's pipeline `query` view | The list a User works from |
| A section of another view | A deal layout showing "Active Properties", a `query` view scoped by an edge | Related records appear on the record's page, with no navigation |
| A chat message | The Agent answering "show me stalled deals over $20M" by rendering a view | The answer is the product's own table, which a User can sort, filter, pin or open as a page |

When the Agent's answer is a `query` view drawn by the same registry, "pin this" saves it as a personal view, and "open as page" is its URL. The memo, related-records and proposal cards built for the demo are earlier, hand-built forms of the same pattern.

## Status

> **Status: partly built.** The three kinds, the section registry, related sections, composition editing, print, export and the Agent's rendered answer are built. Managing views from a list page, the Agent's view of the open page, and the record page as a pure composition are not.

| Built | Missing |
|---|---|
| Three kinds (`packages/shared/fields/src/specs/view.ts:887`). `layout` and `dashboard` share one set of section kinds (`:804-817`, `:848`), resolved by one registry (`packages/tenant/core/src/views/sections.ts`) | Saving, updating, forking or publishing a list as a view, or setting a group or Tenant default, from a list page. The toolbar sets a personal default and a favourite only (`apps/dpagentic/src/features/views/components/view-toolbar.tsx:135-189`). [`../filters/`](../filters/00-filters.md) owns it |
| Sources: an entity type or a registered collection (`packages/tenant/core/src/views/sources.ts`) | The Agent reading the view a User has open. `useCopilotReadable` publishes only the open record (`apps/dpagentic/src/features/agent/agent-panel.tsx:98`) |
| The save-time access check through `guardRequest` (`packages/tenant/core/src/operations/reads/views.ts:267`, `:338`) | The Agent proposing a change to a view |
| Related sections (`packages/shared/fields/src/specs/view.ts:372`, resolved at `packages/tenant/core/src/views/sections.ts:150`, drawn at `packages/shared/ui/src/components/views/section.tsx:198`) | A single `spec` parameter on the Agent's `showView` tool, which still takes separate parameters (`apps/dpagentic/src/features/agent/home-agent.tsx:51-127`) |
| Measure kinds `share-of-total` and `duration` (`packages/shared/fields/src/specs/view.ts:119`, `:146`), and the `matrix` section (`packages/tenant/core/src/views/sections.ts:671`) | The `variance` measure (`08` §1) |
| Print (`apps/dpagentic/src/app/(print)/print/[handle]/page.tsx`), Excel export (`apps/dpagentic/src/app/api/views/export/route.ts`) and `POST /views/resolve` (`apps/api/routes/views/resolve.post.ts`) | The record page as a pure composition. `EntityDetailClient` still draws the field sections (`apps/dpagentic/src/surfaces/record-surface.tsx:203`, `09` Decision 4) |
| The list page reads a saved `query` view (`apps/dpagentic/src/surfaces/entity-surface.tsx:178`), and the board reads the view's grouping (`packages/tenant/core/src/views/resolve.ts:519`) | |
| The record page reads a `layout` (`apps/dpagentic/src/features/entity/detail.server.ts:160`), and the home page offers `dashboard` views (`apps/dpagentic/src/surfaces/home-surface.tsx:115`) | |
| Drag-and-drop editing of a dashboard or a layout (`apps/dpagentic/src/app/(shell)/compose/[handle]/page.tsx:58`, `:65`) | |
| The Agent's answer drawn as a view (`apps/dpagentic/src/features/agent/home-agent.tsx:46`), and pinned with `persistView` (`apps/dpagentic/src/features/views/views.server.ts:293`) | |
| `getEntityTypes`, `getGridColumns`, `getViews` and `resolveDefaultView` are memoized per server render through `React.cache()`, so repeat calls with the same arguments fetch once (`apps/dpagentic/src/features/entity/data.server.ts:71`, `:160`, `apps/dpagentic/src/features/views/views.server.ts:85`, `:122`) | |

Every seeded Tenant except `relationships` has all three kinds (`packages/tooling/seed/src/seed.integration.test.ts:461`). A grid that takes its columns from the whole field registry fails under load where narrow reads of the same data do not (`docs/reference/poc/03-findings.md`). When a `query` view names no columns, the resolver selects promoted fields only (`packages/tenant/core/src/views/resolve.ts:260-264`).

Checked against `develop` at `7a74e1baf`. To check it again, read the files in each row.

**Kind: data transformation**, with the presentational half in `@neuro/ui`'s view components.

## The documents

| Doc | What it settles |
|---|---|
| `01-legacy-pitfalls.md` | What Sunspear's presentation layer teaches: the pattern to keep, and the eight implementation traps, two of them behind the variant explosion |
| `02-best-practices-and-patterns.md` | How Notion, Airtable, Salesforce and Linear model views; the layered disciplines (semantic layer, typed blocks, render targets, grammar of graphics, tokens); drag-and-drop composition; and the data-fetch discipline (RSC first, request memoization, scoped client caches) |
| `03-requirements-and-user-stories.md` | What the system must enable, as stories per Actor, the Agent included, and the non-goals |
| `04-proposed-model.md` | The design: the view contract, the section registry, related sections over `entity_edges`, named measure kinds, composition editing, resolution and scoping, the access rules, and views as the shared language of the UI and the Agent |
| `05-benefits-and-surface-reduction.md` | What one views system does for Tenants, for the Agent and for the design system, and the legacy surface it replaces |
| `06-legacy-view-inventory.md` | What the legacy evaluation Tenant configures, queried from MySQL: the four parallel view systems, and the ranked gaps between them and this model |
| `07-widget-variant-explosion.md` | Why the design system cut the widgets: the variant count behind "thousands of variants", and the boundary it sets for Neuro's UI |
| `08-build-specs.md` | Build detail for the four additions `04` sequenced: measure kinds and chart series, the `matrix` section, print and Excel export, each with its legacy bounds and tests |
| `09-infoview-and-infobox.md` | What an InfoView and an InfoBox are in Neuro's terms, what a box owns, whether the record page becomes a composition, and the mapping onto Bolide's `Widget` shell |

## Method and confidence

Legacy figures come from the current-state assessments (`docs/reference/legacy_assessments/current-state/10*.md`), taken against `sunspear`/`major`, and are not taken again here. Neuro claims cite the code inline, and the performance numbers come from the DPN-16 load harness (`docs/reference/poc/03-findings.md`). The industry survey in `02` draws on public product behaviour and documentation, and marks where it infers. Confidence is high for the Neuro claims, each read at its cited line on `develop` at `7a74e1baf`, and for the legacy figures, which the assessments measured. It is lower for the survey, which is inference from outside.
