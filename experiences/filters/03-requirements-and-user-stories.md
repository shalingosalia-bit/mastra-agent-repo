# Requirements and user stories

Requirement ids use the `FV` prefix. `04-proposed-model.md`, `05-interface-and-configuration.md`, `07-filter-bar-surface.md`, the Issues and the tests cite them by id. An id is never reused or renumbered.

## The people

| Who | What they need from filters |
|---|---|
| **Dana**, deal lead | Her pipeline narrowed the way she thinks about it, saved once, sent to a colleague as one link, and still right tomorrow |
| **Sam**, analyst with restricted visibility | The same shared views as Dana, with no chip, count or comparison telling him what a field he may not read is filtered to |
| **Priya**, administrator | A view the whole tenant opens on, a different one for the underwriting group, and a warning before she deletes a field a view depends on |
| **Ops** | No new table, no per-tenant code path, a bounded address, and a migration report that names every legacy filter it could not carry |
| **The agent** | The filter the person is looking at, in a grammar it can read and propose a change to, and a way to pin its own answer |

## Functional requirements

### Authoring a condition

Legacy cells cite the line read on `develop` on 2026-09-17, and confidence in each is high; `01-legacy-pitfalls.md` states the method.

| # | Requirement | Legacy today | Consumers |
|---|---|---|---|
| FV1 | A person can add a condition on any promoted field of the list's type, choosing a comparison from the catalogue for that field's primitive type | One filter type per surface and per relationship (`sunspear app/models/filter_view_filter.ts:7-73`) | Dana, Priya |
| FV2 | The catalogue offers a comparison only where the executor honours it for that primitive, and an executor that receives an unsupported condition fails the request with a structured error naming the condition | The comps translation drops multi-group filters and multi-sorts with a log warning (`search_connector.rb:304-312`) | Dana, Ops |
| FV3 | A field the projection has not promoted is listed with the reason it is unavailable, and an administrator is shown the promotion path | Filtering waits on `cache_ready?` and backfill scripts (`entity_query_sort_pure.rb:28-52`) | Dana, Priya |
| FV4 | Blank handling on a condition has one expression with three values: exclude blanks, include blanks, only blanks | The sentinel `-1` and `nullHandlingMode` both express it (`models/filter_view_filter.rb:68-72`) | Dana |
| FV5 | A date condition takes a literal, or a relative window stated as a signed day count or a calendar unit with an offset, evaluated against the viewer's own today; a named preset is a label over one such parameter | About two dozen named buckets expanded in code (`models/filter_view_filter_value.rb:28-53`) | Dana |
| FV6 | A condition on a principal-typed field may name the viewing principal by a token; the token is stored as a token and bound when the query runs, from the request context | The sentinel `-2`, substituted with `user_id` at query time (`models/filter_view_filter.rb:199`) | Dana, Sam |
| FV7 | The authorable subset is two levels: groups joined by one connective, conditions inside each joined by the other. A stored predicate outside the subset is shown as one advanced chip that opens the builder, and is executed unchanged | Groups joined by OR, conditions by AND or OR (`sunspear app/models/filter_view_filter_group.ts:13`) | Dana, the agent |
| FV8 | A person can add a condition on a relationship: a linked record exists, none exists, at least or at most a count, or a link to one named record | One filter type per related entity kind | Dana |
| FV9 | A condition on a related record's field is offered only where the related-subject read layer is enabled, and is refused at save with the compiler's own error otherwise | Entity filter types read the related record in MySQL | Dana |
| FV10 | Translating the filter model to a predicate and back returns the same model for every value of the authorable subset | — | Dana, the agent |

### The list state and its address

| # | Requirement | Legacy today | Consumers |
|---|---|---|---|
| FV11 | The list state is the filter, the sort, the columns, the grouping, the display mode, the search term and the identity of the view it started from, written into the address as one parameter, so that decoding the address reproduces the list for any reader under that reader's plan | A local `filter_views` row per user per surface, on no address (`models/filter_view.rb:381-415`) | Dana, Ops |
| FV12 | An encoded state is bounded by the predicate bounds and a byte ceiling, and one over either bound is refused with a named error | — | Ops |
| FV13 | An encoded state is partitioned by the opener's plan before it runs, so a condition on a field outside that plan is withheld and not applied, as it is for a shared view (FV29), and the page says so | — | Sam |
| FV14 | The surface shows, per axis, whether the state differs from the saved view it started from: filter, sort, columns, grouping, display mode, search term | `metadata.dirty` on the local row, one flag for everything (`sunspear app/components/common/FilterViewSelector.tsx:31`) | Dana |
| FV15 | The number of sort keys the state accepts equals the number the executor honours | Single key, in every view that sorts (`../views/06-legacy-view-inventory.md:31`) | Dana, Ops |
| FV16 | The column set in the state is ordered, and a column shown or hidden is a change to the state like a condition is; a column the viewer's plan withholds stays in the set and renders withheld | `filter_view_columns` per view | Dana, Sam |
| FV17 | A workspace focus is shown as a chip the reader may clear and may not edit, and is no part of the encoded state | — | Dana |

### Saving, and the life of a view

| # | Requirement | Legacy today | Consumers |
|---|---|---|---|
| FV18 | From any state a person can save a new personal view with a name; the address then names the view and the state is empty | Save as a new `filter_views` row | Dana |
| FV19 | A person who may edit the view in place can write the state into it; the write names the version the person read, and a stale write fails with a named conflict | Updated in place, with no version | Dana, Priya |
| FV20 | A person can revert, discarding the state so the address names the bare view | Discard the local row | Dana |
| FV21 | A person who may not edit the view in place is offered a personal copy under the same handle, and the original is untouched | The local row shadows the saved one | Dana, Sam |
| FV22 | A person can move a view from personal to a group they belong to, or an administrator to the tenant, and the confirmation names who will see it | `share_option` plus a member list (`models/filter_view.rb:375-379`) | Dana, Priya |
| FV23 | A person who may edit a view can rename it and set its description | `name` and `description` on the row | Dana, Priya, the agent |
| FV24 | A person can delete a view they may edit; a default that named it is skipped at resolution, and the person is told which defaults named it | Soft delete | Dana, Priya |
| FV25 | A shared or group view keeps its scope and stays editable by its audience when its author leaves the tenant; a personal view is removed with its author | An offboarded owner made every view they had authored uneditable (T2-496, `models/filter_view.rb:421-440`) | Priya, Ops |
| FV26 | A person can make a view their own default for a type; a group member can make it the group's; an administrator can make it the tenant's. The confirmation names who is affected, and the list shows which rule chose the view it opened with | One ordered pinned list per team (`core/filter_views/models/teamwide_view.rb`) | Dana, Priya |
| FV27 | A person can favourite a view, and the favourite reorders their picker and grants nothing | Starred views | Dana |
| FV28 | Before a field is deleted or retyped, the administrator is shown every view whose filter, sort, columns or grouping names it; afterwards, a condition on a removed field renders as a named chip, is not applied, and the list states that a condition was not applied | A renamed field breaks every saved filter, found by the next reader (`../views/01-legacy-pitfalls.md:33`) | Priya, Dana |

### Visibility

| # | Requirement | Legacy today | Consumers |
|---|---|---|---|
| FV29 | A condition on a field outside the viewer's plan renders as a withheld chip stating neither comparison nor value, is not applied, and the list states how many conditions were not applied; the chip count includes it | The active filter count is computed over fields the reader may not see (`models/filter_view.rb:730`) | Sam |
| FV30 | A viewer may remove a withheld chip from their own state and may not edit it | — | Sam |
| FV31 | Every count, total and facet on the bar is computed over the rows and fields the viewer's plan admits | Partial totals unmarked (`../../reference/legacy_assessments/current-state/10.3-reporting-dashboards-and-widgets.md:25`) | Sam |
| FV32 | Opening an address a colleague sent runs the same state under the opener's plan and widens nothing | — | Sam, Dana |
| FV33 | The agent can read the open list's state, propose a change to it as a diff the person accepts or rejects, and save its own answer as a personal view; it may not publish a view beyond personal scope | No agent surface | The agent, Dana |

### Migration

| # | Requirement | Legacy today | Consumers |
|---|---|---|---|
| FV34 | A legacy `filter_views` row maps onto one `query` view with a scope, per `06-legacy-functionality-map.md`, and every part the map could not carry is listed in the migration report by view and by legacy column | — | Ops |

## Stories

**Dana, deal lead.** *"Show me deals in underwriting or closing, over twenty million, assigned to me, closing in the next 30 days. Then let me save that and never build it again."* → FV1, FV4, FV5, FV6, FV7, FV18

**Dana, deal lead.** *"I sent Marcus the link. He should see the same list I see, minus what he is not allowed to see, and nothing should ask him to rebuild it."* → FV11, FV13, FV32

**Dana, deal lead.** *"I changed the sort and hid two columns. Tell me the view is modified, and let me update it, put it back, or save it as a new one."* → FV14, FV16, FV19, FV20

**Dana, deal lead.** *"This is Priya's view and I cannot change it. Give me my own copy and leave hers alone."* → FV21

**Dana, deal lead.** *"Deals with no loan attached. Deals attached to this one fund."* → FV8

**Dana, deal lead.** *"Sort by stage, then by close date. If you can only do one, say so before I click."* → FV2, FV15

**Dana, deal lead.** *"Which view did I just open, and why this one?"* → FV26

**Dana, deal lead.** *"The list does not offer the field I need. Tell me why."* → FV3

**Dana, deal lead.** *"My workspace narrows this list to the West region. Show me that as a chip, and let me clear it when I need the whole pipeline."* → FV17

**Dana, deal lead.** *"Star the three views I live in, so they sit at the top of the picker."* → FV27

**Sam, analyst with restricted visibility.** *"Dana's view filters on a field I may not read. Show me the rows I may see, tell me a filter is there, and do not tell me what it says."* → FV29, FV30, FV31

**Sam, analyst with restricted visibility.** *"Someone sent me a link with a filter on a field I may not read. Fail it the way the grid would, and let me clear it."* → FV13, FV32

**Priya, administrator.** *"Underwriting opens on the Underwriting Pipeline, everyone else opens on the tenant pipeline, and I set both without a support ticket."* → FV22, FV26

**Priya, administrator.** *"Before I delete this field, show me every view that will break."* → FV28

**Priya, administrator.** *"A deal lead left. Her shared views stay shared and I can still edit them. Her private ones go with her."* → FV24, FV25

**Priya, administrator.** *"Rename this view and write down what it is for, so the agent picks it instead of inventing one."* → FV23

**Ops.** *"No new table for filter state, and no address that can grow without limit."* → FV11, FV12

**Ops.** *"Migrate every tenant's saved views, and give me a list of what did not survive, by view."* → FV34

**Ops.** *"A condition over a related record's field is off until the read layer exists, and turning it on is a setting."* → FV9

**The agent.** *"The person asked me to add a cap-rate column and drop the closed deals. I read the list they are looking at, propose the two changes, and they accept or reject each."* → FV7, FV10, FV33

## Non-functional

1. **Latency.** A filter, sort, column or grouping change is one grid round trip under the budget `../../coreservices/search/03-requirements-and-user-stories.md` sets for a filtered read. The package adds no round trip of its own: translation, diffing and encoding are pure functions run in the request.
2. **Purity.** Every export of the package is a pure function over plain values. It reads no database, no settings and no clock; the viewer's today and the field surface are arguments. A test needs no fixture beyond values.
3. **Round trip.** `fromPredicate(toPredicate(m)) = m` for every model in the authorable subset, and `decodeListState(encodeListState(s))` returns `s`'s spec and version for every bounded state, with `from.handle` and `from.owner` supplied by the `view` parameter, each asserted with generated values.
4. **Address size.** At any value of `listStateMaxBytes` inside the range `05-interface-and-configuration.md` states, the encoded state plus the path and the other parameters stays under the shortest common browser and proxy limit. The settings reader rejects a value outside the range, so the guarantee holds for every value the setting accepts.
5. **No new table.** The list state is a value; the view row, its defaults and its favourites are `views/`'s tables. This stack adds no persistence.
6. **Erasure.** Nothing here is retained: an address exists wherever it was pasted, and a saved view follows `../views/04-proposed-model.md`'s lifecycle.
