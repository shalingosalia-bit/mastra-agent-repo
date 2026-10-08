---
type: spec-stack
status: proposed
status_checked: 2026-10-02
status_note: "The substrate is built: saved views, the predicate grammar under the viewer's plan, and the grid's column filters. Nothing in this stack's own responsibilities is built yet."
built:
  - "The predicate grammar with `within`, `before_today`, `is_blank`, `not_blank`, `none`, nested `all`/`any`/`not` and the structural bounds (`packages/shared/fields/src/predicate/ast.ts`)"
  - "The oracle guard at save and at read (`packages/tenant/core/src/operations/reads/views.ts`, `@neuro/authz`)"
  - "`views.scope`, `owner`, `is_managed`, the per-owner handle, `view_defaults` with a group tier, and `view_favorites`"
  - "The grid's column filters mapped to the grammar, bounded (`packages/tenant/grid/src/ssrm.ts`)"
  - "`?view=`, `?mode=`, `?q=`, `?focus=`, and `?f=&eq=` for one drill-down"
  - "A predicate builder page that saves a personal `query` view (`apps/dpagentic/src/features/query/`)"
missing:
  - "A comparison catalogue stating which comparisons a User is offered per field type, and what each looks like as a chip"
  - "A principal token, so one shared view means me for each viewer"
  - "The actions on a saved view, taken from a list: save as, update, revert, fork, publish, rename"
  - "The list state as one addressable value, with the unsaved changes visible against the view they started from"
  - "A column picker, multi-key sort in execution, and the filter bar itself"
  - "The same predicate builder reachable from a list, seeded with the list's own state"
kind: data-transformation
---
# Filters and filter views

## Purpose

Filters gives Principals (Users and Agents) lists they can narrow, save and share, and that stay correct for each viewer.

## Responsible For

1. **Turning a filter into a query and back:** the comparisons each field type offers a User, their values including "me" and dates relative to today, and the translation to and from the platform's predicate grammar.
2. **A list's unsaved state:** its filter, sort, columns, grouping, display mode and search term, how it differs from its view, and the address that carries it.
3. **The actions on a saved view:** save as, update, revert, fork, rename, publish, set as default, favourite and delete, and who may take each.

## Sample Use-Cases & Outputs

1. A User narrows a list by any filterable field they may read, with the comparisons its type offers, and removes each condition as a chip.
2. A User saves the list as a view, and "assigned to me" or "the next 30 days" answers correctly for every colleague, every morning.
3. A User updates, reverts or shares a view, or sends the list unsaved as one address a colleague opens under their own access.
4. A TenantAdmin publishes a view, makes it a type's default for a group or everyone, and sees which views deleting a field would break.
5. An Agent reads the filter its User is looking at, proposes a change in the same grammar, and pins its own answer as a view.

### Outputs

Dana narrows Deals to her own deals at LOI that close in the next 30 days, and the filter bar shows three chips:

| Chip | Field | Comparison | Value |
|---|---|---|---|
| Stage is LOI | Stage | is | LOI |
| Owner is me | Owner | is | the viewer |
| Close date within next 30 days | Close date | within | a 30-day window from today |

The address is `?view=pipeline&s=…`, and `s` decodes to the list state:

```json
{
  "version": 3,
  "predicate": {
    "all": [
      { "field": "stage", "op": "eq", "value": "loi" },
      { "field": "owner", "op": "eq", "value": { "token": "principal" } },
      { "field": "close_date", "op": "within", "value": { "token": "window", "days": 30 } }
    ]
  }
}
```

Sam opens the same address and sees his own deals, because the token resolves to whoever is viewing.

## How To Use

```ts
const state = decodeListState(url.searchParams)          // the list as the address describes it
const diff = diffListState(savedView, state)              // which axes moved since the view was saved
const predicate = toPredicate(state.filter, { fields })   // the platform grammar, ready for queryEntities
const chips = toChips(state.filter, { fields, locale })   // what the bar draws, one chip per condition
```

Every call is a pure function over plain values and reads no database. `05-interface-and-configuration.md` owns the contract.

## Interoperable With

| Caller | What they need from Filters |
|---|---|
| **The filter bar** (`07-filter-bar-surface.md`) | The chips for the current filter, the comparisons each field offers, and the list state to write back to the address |
| **The grid** (`@neuro/grid` and the entity grid in `apps/dpagentic`) | The filter as a predicate `queryEntities` runs, and the list's sort and columns |
| **An Agent** ([`../views/04-proposed-model.md`](../views/04-proposed-model.md) §Views as the agent's language) | The filter its User is looking at, in the same grammar it proposes a change in |
| **An export** ([`../../coreservices/render/`](../../coreservices/render/00-render.md)) | The same predicate the list shows, so the export holds the same rows |

## Not Responsible For

| Concern | Owner |
|---|---|
| The predicate grammar and its SQL compilation | [`../../coreservices/search/`](../../coreservices/search/00-search.md) and `packages/shared/fields/src/predicate/ast.ts` |
| The view row, its audience, its defaults and its favourites | [`../views/`](../views/00-views.md) |
| The text search term and how it composes with a filter | [`../../coreservices/search/`](../../coreservices/search/00-search.md) |
| Which fields a viewer may filter, sort or group by | [`../../coreservices/authz/`](../../coreservices/authz/00-authorization.md), through the inference guard |
| Which columns a type may filter and sort on at all | the projection shape ([`../../coredata/entity-fields/`](../../coredata/entity-fields/00-entity-fields.md)) |
| A workspace's focus, shown as a chip a reader cannot edit | [`../workspaces/`](../workspaces/00-workspaces.md) |
| Executing the predicate under the viewer's access plan | `queryEntities` ([`../../coreservices/search/04-proposed-model.md`](../../coreservices/search/04-proposed-model.md)) |
| Writing a view, checking its scope, forking a copy | `saveView` ([`../views/04-proposed-model.md`](../views/04-proposed-model.md)) |
| Which view a list opens with | `resolveViewDefault` ([`../views/04-proposed-model.md`](../views/04-proposed-model.md) §Personal, group, and tenant preferences) |
| Moving a legacy filter view onto a `query` view | [`../../operations/data-migration/`](../../operations/data-migration/00-data-migration.md), with the map in `06-legacy-functionality-map.md` |

## Pitfalls

| Mistake | What happens | Do this instead |
|---|---|---|
| **Resolving a token when the view is saved** | A saved "assigned to me" that stored the author's id shows every colleague the author's deals | Store the token as written, and resolve it when the query runs |
| **Expecting a shared address to show a colleague what you see** | The colleague runs the same predicate under their own plan. A condition on a field they may not read is withheld and not applied, and the list says so | Treat the address as a query: it carries the filter and grants nothing |
| **Guarding the grid but not the address** | An address that names a hidden value probes for it, and becomes a second door | Pass the encoded list state through the same inference guard the grid applies |
| **Flattening a predicate outside the authorable subset** | Turning it into the nearest simple condition changes what the list shows | Show it as one read-only advanced chip that opens the predicate builder |
| **Offering a field that is not promoted, then failing the request** | Only a promoted column filters or sorts, so the User meets the legacy experience: offered a filter that fails | Offer the field greyed, with the reason, and show a TenantAdmin the promotion path |
