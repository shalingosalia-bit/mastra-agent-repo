# Proposed model: the filter model, the value tokens, the list state, and the lifecycle

Four concerns, and every one of them is a value. The **filter model** is what a person edits, with a catalogue of comparisons per field type. The **value tokens** stand in a stored condition for the viewing principal or a relative window. The **list state** is an unsaved `query` view definition with a pointer at the view it started from, written into the address. The **lifecycle** is the set of verbs a person applies to a view from a list, each a call into an operation `views/` already provides. Every claim below that something is built cites the line it rests on, read on `develop` on 2026-09-17; everything else is proposed.

| Machinery this stack stands on | Where |
|---|---|
| The predicate grammar and its two compilers | `packages/shared/fields/src/predicate/ast.ts`, `packages/tenant/core/src/operations/predicate/predicate-sql.ts`, the projection read model |
| The view row with its audience, defaults and favourites | `packages/tenant/core/src/operations/reads/views.ts` |
| The inference guard | `packages/shared/authz/src/guard.ts` |
| The grid's mapping of column filters onto the grammar | `packages/tenant/grid/src/ssrm.ts` |

## Data model

This stack adds no table. It reads and writes the tables below through `views/`'s operations, and it stores the list state in the address.

| Store | Grain | Owner | What this stack does with it |
|---|---|---|---|
| `views` | one row per view per owner; `(tenant, handle, owner)` unique among live rows (`packages/tenant/core/src/db/field-system/config.ts:266`) | `views/` | reads a `query` definition as the base of a list state; writes one through `saveView` on save, update, fork and publish |
| `view_defaults` | one row per (tenant, entity type, context, principal type, principal id) (`config.ts:368`) | `views/` | writes through `setViewDefault`; reads the resolver's `from` to show which rule chose the view |
| `view_favorites` | one row per (tenant, view, principal) (`config.ts:331`) | `views/` | writes through `setViewFavorite` |
| the address | one list, as one reader sees it | the reader's browser, and whoever they send it to | encodes and decodes the list state |

## The filter model

The filter model is the two-level subset of the predicate grammar a person authors as chips (FV7).

```ts
interface FilterModel {
  match: 'all' | 'any'                 // how the groups join
  groups: FilterGroup[]
}
interface FilterGroup {
  match: 'all' | 'any'                 // how the conditions inside join
  conditions: Condition[]
}
type Condition = FieldCondition | EdgeCondition | AdvancedCondition
interface FieldCondition {
  field: string                        // a field handle on the list's type
  op: CatalogueOp                      // from the catalogue for the field's primitive
  value?: Literal | Token
  blanks: 'exclude' | 'include' | 'only'
}
interface EdgeCondition {              // FV8; the grammar's edge leaf, unchanged
  edge: string
  op: 'exists' | 'not_exists' | 'count_gte' | 'count_lte' | 'to'
  value?: number | string
  direction?: 'from' | 'to'
}
interface AdvancedCondition {          // a stored predicate outside the subset, shown as one chip
  predicate: Predicate
}
```

### Translation to the grammar

`toPredicate` produces `{ [match]: groups.map(g => ({ [g.match]: g.conditions.map(leaf) })) }`. A field condition becomes one leaf, or a leaf wrapped for its blank handling:

| `blanks` | Positive comparison (`eq`, `in`, `contains`, `lt`, `gt`, `within`, …) | Negative comparison (`ne`, `not_in`, `none`) |
|---|---|---|
| `exclude` | the leaf alone | `{ all: [leaf, { field, op: 'not_blank' }] }`, because the compiler counts a blank as "not in the set" (`predicate-sql.ts:252-257`) |
| `include` | `{ any: [leaf, { field, op: 'is_blank' }] }` | the leaf alone |
| `only` | `{ field, op: 'is_blank' }`, and `op` and `value` are dropped | the same |

1. The deepest tree the model produces is four levels: root, group, blank wrapper, leaf. The grammar's bound is eight (`ast.ts:178`), so depth never fails; `assertPredicateBounds` checks the leaf count as for every predicate.
2. The workspace focus is not in the model. The server applies it from the workspace handle (`packages/tenant/grid/src/query.ts:146`) and the bar draws it as a chip the reader may clear and may not edit (FV17).
3. The view's own predicate is the base of the list state, below. A person editing a chip edits that base.

### Translation from the grammar

`fromPredicate` recognises the shapes below and nothing else:

| Predicate shape | Model |
|---|---|
| a leaf | one group of one condition |
| a group whose children are groups of leaves, with or without the blank wrappers | the model, group for group |
| a `gte` and an `lte` leaf on one field in one `all` group | one `between` condition |
| anything else: a third level, a `not` group, a leaf with a `subject`, a comparison outside the catalogue for the field | one `AdvancedCondition` covering the whole predicate |

The property both directions keep is FV10: `fromPredicate(toPredicate(m))` equals `m` for every model in the subset, asserted with generated models.

## The comparison catalogue

One catalogue, keyed by the field's primitive type (`packages/shared/fields/src/primitives/`), states what a person is offered, how it appears as a chip, what value form it takes, and which grammar comparison it compiles to (FV1, FV2). A comparison is offered only where `predicate-sql.ts` and the projection read model compile it for that primitive.

| Primitive | Offered | Chip reads | Value form | Grammar |
|---|---|---|---|---|
| `text` | is, is not, contains, is blank, is not blank | `Name is "Alpine"` | a string | `eq`, `ne`, `contains`, `is_blank`, `not_blank` |
| `rich-text` | contains, is blank, is not blank | `Notes contain "ground lease"` | a string | `contains`, `is_blank`, `not_blank` |
| `number` | is, is not, less than, at most, more than, at least, between, is blank, is not blank | `Price at least 20,000,000` | a number, or two for between | `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `gte`+`lte` in an `all` group, `is_blank`, `not_blank` |
| `date` | on, before, after, between, within, is overdue, is blank, is not blank | `Close date within next 30 days` | a date, two dates, or a window token | `eq`, `lt`, `gt`, `gte`+`lte`, `within`, `before_today`, `is_blank`, `not_blank` |
| `boolean` | is | `Is critical is true` | `true` or `false` | `eq` |
| `select` | has, has any of, has none of, is blank, is not blank | `Stage has any of Underwriting, Closing` | one option id, or a list | `eq`, `in`, `none`, `is_blank`, `not_blank` |
| `entity-ref` | is, is any of, is blank, is not blank | `Fund is Growth III` | one record id, or a list | `eq`, `in`, `is_blank`, `not_blank` |
| `principal-ref` | is, is any of, is none of, is blank, is not blank | `Owner is me` | a principal id, a list, or the principal token | `eq`, `in`, `none`, `is_blank`, `not_blank` |
| `location` | is blank, is not blank | `Address is not blank` | none | `is_blank`, `not_blank` |

Rules the table implies:

1. **`between` is two leaves.** The chip shows one condition and the grammar receives `gte` and `lte` in an `all` group; `fromPredicate` folds the pair back.
2. **A `select` "is not" is `none` with one value.** `none` states the intent the compiler's option containment does not (`ast.ts:44-46`).
3. **Proximity is not a comparison.** Distance from a point is the `nearby` section and the analytics read (`../views/04-proposed-model.md`, `../../coreservices/search/04-proposed-model.md` §Comps). An address part a tenant filters on is a `text` field of its own, as legacy's address-part value types were (`01-legacy-pitfalls.md` §2).
4. **`modified` is never offered.** It compares a write's before and after and belongs to an action condition (`predicate-sql.ts:307-317`).
5. **Prefix and suffix matching are never offered.** The grammar has no such comparison, and widening to `contains` returns rows the person excluded (`packages/tenant/grid/src/ssrm.ts:142-146`).
6. **An unpromoted field is listed and disabled** with the reason, and an administrator sees the promotion path (FV3). The grid already draws such a column read-only (`apps/dpagentic/src/features/entity/entity-grid.tsx:117-136`).
7. **An edge condition offers the five edge comparisons** for every relation registered on the list's type (FV8).
8. **A related record's field is offered only where the related-subject read layer is enabled** (FV9). `saveView` rejects one otherwise with the compiler's error (`packages/shared/fields/src/predicate/fields-of.ts:108-115`).

## Value tokens

A token is a typed value form, distinct from a literal, bound when the query runs (FV5, FV6).

| Token | Shape | Bound to | Offered on |
|---|---|---|---|
| the principal | `{ token: 'principal' }` | the acting principal's id from the request context, in both compilers and from `ctx.principal` in `evaluate.ts` | `principal-ref` with `eq`, `in`, `none` |
| a window | `{ token: 'window', days: number }` or `{ token: 'window', unit: 'week' \| 'month' \| 'quarter' \| 'year', offset: number }` | the viewer's today, as `within` already reads it (`predicate-sql.ts:274-305`); `offset` 0 is the current period, `-1` the previous, `1` the next; week start and quarter alignment come from the tenant's date defaults ([`../branding/`](../branding/00-branding.md)) | `date` with `within` |

Two grammar amendments are asked of the field system, each filed as its own Issue before anything here is built:

| Amendment | Today | Asked |
|---|---|---|
| A principal token as a leaf value | a leaf `value` is `unknown`, and no compiler resolves anything from the principal (`ast.ts:54-60`) | `leafSchema` accepts `{ token: 'principal' }` as the value of `eq`, `in` and `none`, rejects it on any other comparison or on a field whose primitive is not `principal-ref`; both compilers and the evaluator bind it |
| Calendar windows on `within` | `within` takes a signed day count (`evaluate.ts:201`) | `within` also takes `{ unit, offset }`, compiled to the period's bounds against the viewer's today |

1. The token is stored as written. A view saved by Dana with `Owner is me` shows Sam his own records (`00-filters.md` §Pitfalls 1).
2. The save-time oracle guard reads the field and never the value, so a token does not touch it.
3. A named preset such as "today", "this week" or "next quarter" is a catalogue entry mapping a label to one window token. The token is stored, the label is looked up at render, and a person who wants the next 45 days types 45 (`02-best-practice-research.md`).

## The list state

The list state is an unsaved `query` view definition plus the identity of the view it started from (FV11). An unsaved query view is the normal working state of the system (ADR-0018 decision 1), so the state reuses the definition's own fields.

```ts
interface ListState {
  from?: { handle: string; owner: string; version: number }   // the view the state started from; `version` rides in the address, the other two come from `view`
  spec: Pick<QueryViewDefinition, 'predicate' | 'sort' | 'columns' | 'groupBy' | 'display' | 'search'>
}
```

| Concern | Rule |
|---|---|
| Resolution on open | `view` names a view, or `resolveViewDefault` supplies one with the `from` rule that chose it (`views.ts:631-743`). The view's definition is the spec; where the address also names a state, the state's spec replaces it axis by axis; with neither, the spec is the resolver's synthesised default |
| The parameter `s` | The spec plus `version`, as JSON with the definition's own keys, deflated and written base64url |
| Why `version` rides in `s` | The update verb names the version the person read when their editing began (FV19). Re-resolving it on each navigation would refresh it past a colleague's write and lose the conflict |
| Why `from.handle` and `from.owner` do not | `view` names the handle, and the owner is whatever that name resolves to for the opener under the shadowing rule, so a pasted address opens the opener's own copy where one exists. The version in `s` belongs to the sender's row, so where `view` resolves to a different owner's row the update verb is not offered and the menu offers save-as and fork; where it resolves to the same row, `version` is compared as FV19 requires |
| `view`, `mode`, `q` | Readable parameters a person reads. `mode` and `q` are the `display.mode` and `search.term` axes written twice, and the readable form wins on decode where both are present |
| `focus` | The workspace's, and never inside `s` (FV17) |
| `f` and `eq` | Retired. A bucket click emits `s` with one condition, the same address the person reaches by adding the chip |
| Bounds (FV12) | The predicate bounds apply to the predicate, and the byte ceiling `05-interface-and-configuration.md` states applies to the whole parameter. Decoding over either bound fails with a named error and the page offers the bare view |
| Outbound size | The surface measures `encodeListState`'s output against the same ceiling before writing the address. An edit that would exceed it is declined with a notice offering to remove a condition or to save the list as a view, which has no address to fit |
| The diff (FV14) | `diffListState(saved, state)` compares axis by axis, after normalisation, and returns which of `filter`, `sort`, `columns`, `groupBy`, `display`, `search` differ. The view menu lists the axes that moved and marks the name |
| Columns (FV16) | The ordered handle list the grid draws, seeded from the view or from the projection's promoted columns where the view has none (`packages/tenant/grid/src/query.ts:63-92`). A withheld column stays in the list and renders `withheld` (`entity-grid.tsx:126-133`) |
| Sort keys (FV15) | The state accepts the definition's sort array. The executor honours every key or the mapper rejects more than one, pinned by a test on `toSort`'s arity. Today the mapper keeps the first key (`ssrm.ts:181`) and the keyset cursor packs one value; honouring N keys is a cursor change and the first Issue this stack files against the grid |

## The executor contract

The grid receives the state and nothing the state does not say. Today `runGridQuery` receives the grid's column filters, looks up the view's predicate by handle and the workspace focus by handle, and joins the three (`packages/tenant/grid/src/query.ts:130-215`). Under this model:

1. The request contains the encoded state and the workspace handle. The view handle travels for the diff and for `from`; its predicate is not applied on top of the state's, because the state's predicate is the view's as the person edited it. Removing a chip removes a condition.
2. The server decodes the state and checks the predicate bounds (`assertPredicateBounds`) and the related-subject rule (`assertNoRelatedSubject`).
3. The server calls `partitionByPlan(spec, readable)`, which takes the stored definition shape: it derives the model with `fromPredicate`, withholds as the next section states, and returns the applied part as a definition through `toPredicate`, so nothing outside this package converts between the two shapes.
4. The applied part runs through `guardRequest` as every read does today, the focus predicate is AND-ed from the workspace handle, and the query executes.
5. The response contains the rows, the result count over the applied query, and the withheld list, so the bar draws each withheld condition as a chip and the notice names how many were not applied.

The focus stays a server-side handle for the two reasons `query.ts:161-171` gives: a client must not widen it, and a load test compares runs with the query constant.

## Withheld conditions

The inference guard rejects a filter, sort or grouping over a field the caller may not read, because the result set is an oracle for the hidden value (`../../coreservices/search/03-requirements-and-user-stories.md`, the restriction stories). A shared view or a pasted address naming such a field therefore fails for Sam as a whole today, which is the wrong answer for a view he did not write. The rule here follows `../views/04-proposed-model.md` §Views are an authorization surface, rule 3, and extends it from grouping to filter and sort (FV13, FV29, FV30):

1. `partitionByPlan` removes every field condition and edge condition whose field or relation is outside `readable`, removes every sort key and grouping handle outside it, and withholds an `AdvancedCondition` as a whole when any field its predicate names is outside `readable`.
2. An advanced predicate is never rewritten leaf by leaf. Removing a leaf under `not`, or under an `all` inside an `any`, changes what the remaining leaves mean, and FV7 requires an advanced predicate to execute unchanged or not at all.
3. The result is `{ applied, withheld }`, where `withheld` names each removed condition by field, or by `advanced` with the fields it named, and nothing else. A group left empty is removed; a root left empty is no predicate.
4. The applied part runs. A withheld condition is drawn as a chip with the field's label and the word `withheld`, and neither comparison nor value. The list states `N conditions not applied`.
5. The viewer may remove a withheld chip from their own state, because removal discloses nothing, and may not edit one.
6. A leaf typed live over a hidden field is impossible from the bar, which offers no such field. One arriving by a crafted request reaches `guardRequest` only if partition kept it, and partition keeps nothing outside the plan, so the guard's refusal covers what it covers today and a field outside the type.
7. The result count on the bar is the count of the applied query under the plan (FV31), and the chip count is the number of conditions drawn, withheld ones included (FV29). ADR-0016 states the first rule for every query-time aggregate.

## The lifecycle

Every verb is a call into `views/`'s operations, and the surface adds the confirmation and the address that follow it. The preconditions are the ones `views.ts` already enforces, and the table names the line so a reader can check that nothing here relaxes them.

| Verb | Precondition | Write | Address after | Requirement |
|---|---|---|---|---|
| save as | any state, and `create View` | `saveView({ scope: 'personal', handle: slugOf(name), name, definition: state.spec })`; the default scope is personal (`views.ts:363`) | `?view=<handle>`, no `s` | FV18 |
| update | `canEditViewInPlace` (`views.ts:444-452`), and `view` resolved to the row `from.version` belongs to | `saveView` with the view's definition replaced by the state's spec and `expectedVersion: from.version` (`views.ts:173`); a stale version fails with a named conflict, as `arrangeDashboard` already does (`packages/tenant/core/src/views/arrange.ts:7`) | `?view=<handle>`, no `s` | FV19 |
| revert | none | none | `?view=<handle>`, no `s` | FV20 |
| fork | not editable in place | `saveView({ scope: 'personal', handle: from.handle, definition: state.spec })`; the per-owner handle lets the copy shadow the original (`config.ts:308`) | `?view=<handle>`, resolving to the person's own copy | FV21 |
| publish to a group | membership in the group, or `manage View` (`views.ts:368-380`) | `saveView` with `scope: 'group'`, `groupId` | unchanged | FV22 |
| publish to the tenant | `manage View` (`views.ts:367`) | `saveView` with `scope: 'shared'` | unchanged | FV22 |
| rename, describe | `canEditViewInPlace` | `saveView` with `name`, `labels`, and the definition's `description` | unchanged | FV23 |
| delete | `canEditViewInPlace` and `delete View` | the soft delete `views/` provides; the confirmation lists the `view_defaults` rows naming this identity first | the resolver's next choice | FV24 |
| make default | personal: `read View`; group: membership; tenant: `manage View` (`views.ts:757-888`) | `setViewDefault` at the chosen tier | unchanged, and the bar shows `from` | FV26 |
| favourite | `read View` | `setViewFavorite` | unchanged | FV27 |

| Situation | Rule | Requirement |
|---|---|---|
| The author leaves the tenant | A shared view's `owner` is the empty string and a group view's is the group id, so neither row references the author beyond `created_by`, and `canEditViewInPlace` reads scope and role and never `created_by`. Both survive by construction. A personal view's owner is the author, and `../views/04-proposed-model.md` §Personal, group, and tenant preferences removes it with the user. One test is asked for: an administrator edits a shared view whose `created_by` names a deleted user, and the write succeeds | FV25 |
| A field is deleted or retyped | Before the change, the field's settings surface lists every view whose definition names it, through `viewReferencedFields` (`packages/shared/fields/src/specs/view.ts:884-940`) behind an operation `views/` provides, `listViewsReferencing(field)`. After it, a condition on the removed field is drawn as a chip reading `condition removed`, is not applied, and the list says so, the tolerant read `../views/04-proposed-model.md` §Views are an authorization surface, rule 3, states for a column | FV28 |

## The agent

The agent reads the list state through the readable channel a view page publishes, proposes a change as a `ListState` the person accepts or rejects, and pins its own answer with `saveView` at personal scope (FV33). The rules are `../views/04-proposed-model.md` §Views as the agent's language, applied to the state: `render` for an answer, `renderAndWaitForResponse` for a change to what the person is looking at, one object parameter validated by `queryViewDefinitionSchema`, and validation errors returned verbatim. Two constraints this stack adds:

1. A proposal is a diff. The card shows the axes that would change, computed by `diffListState(current, proposed)`, so "add a cap-rate column and drop the closed deals" is two lines a person reads.
2. An agent never changes a view's scope. Publishing is a person's act, as creating a share link is (`../../coreservices/authz/08-magic-links-and-shared-access.md` §3), and `saveView` receives no `scope` other than `personal` from an agent principal.

## Events, jobs and erasure

| Concern | Here |
|---|---|
| Events | None. Saving a view, setting a default and favouriting are `views/`'s writes, and any event they emit is that stack's. The list state is a value and nothing observes it |
| Jobs | None. The field-removal check is a read at the moment of the administrator's action, and the migration in `06-legacy-functionality-map.md` runs inside `../../operations/data-migration/`'s generator |
| Erasure | Nothing is retained. An address exists wherever it was pasted and names no person. A saved view follows `../views/04-proposed-model.md`'s lifecycle |

## What this module must not do

1. **Compile a predicate to SQL.** The compiler is `predicate-sql.ts` and the projection read model, and the search stack owns them. This package produces a predicate and stops.
2. **Write a `views` row.** Every write goes through `saveView`, `setViewDefault` and `setViewFavorite`, so a view saved from a list is bounded, guarded and versioned as one saved from the builder or a dataset is (`packages/tooling/dataset/src/kinds/view.ts:1-11`).
3. **Decide visibility.** `partitionByPlan` receives the readable set as an argument and derives nothing about who may see what. The plan is the authz stack's.
4. **Resolve which view a list opens with.** `resolveViewDefault` does, and this stack shows its answer.
5. **Store list state on the server.** No "last used view" row, no per-user filter memory. The default fold answers where a list opens and the address answers everything else.
6. **Grow into a query language.** The chip model plus the builder is the whole authoring surface. A text syntax is a second grammar (`01-legacy-pitfalls.md` §1).
7. **Keep a per-view access list.** Settled in `../views/06-legacy-view-inventory.md` §5.
