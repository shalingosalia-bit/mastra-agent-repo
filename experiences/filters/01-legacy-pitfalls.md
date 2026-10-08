# Legacy filters and filter views: how they work, and the constraints their defects impose

Grounded in `the_wall` and `sunspear`, each on `develop`. Read directly: in `the_wall`, `models/filter_view.rb`, `models/filter_view_filter.rb`, `models/filter_view_filter_value.rb`, `models/filter_view_member.rb`, `core/filter_views/models/teamwide_view.rb` and `handlers/query_handler.rb`; in `sunspear`, `app/models/filter_view.ts`, `app/models/filter_view_filter.ts`, `app/models/filter_view_filter_group.ts`, `app/components/common/FilterViewToolbar/`, `app/components/common/FilterViewSelector.tsx`, `app/components/modals/AdvancedFilterModal/` and `app/connectors/filter_view_settings.ts`. An unqualified path is a `the_wall` path. [`../views/06-legacy-view-inventory.md`](../views/06-legacy-view-inventory.md) owns the measurements of what the evaluation tenant configured, and [`../../coreservices/search/01-legacy-pitfalls.md`](../../coreservices/search/01-legacy-pitfalls.md) owns the query-execution side; this document cites both and summarises only what its constraints need from them. Confidence is high: every mechanism claim cites a line read on `develop` on 2026-09-17.

## How a filter view exists today

A list page draws an AG Grid over one `filter_views` row and its satellites: `filter_view_filter_groups` holding `filter_view_filters`, each with `filter_view_filter_values`; `filter_view_sorts`; `filter_view_columns`; `filter_view_groups` and `filter_view_collapsed_groups`; `filter_view_options`; and one optional `filter_view_chart` (`models/filter_view.rb:1-27`). A row is a saved view when `saved_view` is true and has a `name`; otherwise it is a local view, one per user per `view_type`, with `name` null and a `metadata.filter_view_id` pointer at the saved view it was copied from (`models/filter_view.rb:381-415`, `:537-551`). The toolbar draws one chip per filter (`sunspear app/components/common/FilterViewToolbar/FilterChip.tsx`), the advanced modal edits groups joined by OR with conditions joined by AND or OR inside each (`sunspear app/components/modals/AdvancedFilterModal/AdvancedFilterModal.tsx`, `app/models/filter_view_filter_group.ts:13`), and the selector marks the local view modified when `metadata.dirty` is set (`sunspear app/components/common/FilterViewSelector.tsx:31`). Execution translates the row into MySQL through `EntityQueryController` (`handlers/query_handler.rb:130`), or into the search service's dialect for the comps dashboard.

## The defect classes

### 1. Three filter grammars for one question

Visibility, locking and redaction rules use `Conditional*`; saved-view filters use `FilterViewFilter*`; the comps dashboard translates the second into the search service's own dialect per request, dropping multi-group filters, multi-sorts and advanced groups with a log warning (`../../reference/legacy_assessments/current-state/03-field-system.md:43`, `../../coreservices/search/01-legacy-pitfalls.md:25`). A person's filter is expressed in one grammar, executed in another, and the translation decides what survives. **Constraint:** the person-facing filter model is a projection of the platform's one predicate grammar and never a second grammar. A predicate outside the model stays a predicate and is shown as such; nothing flattens it.

### 2. A filter type per surface and per relationship

`FilterViewFilterType` enumerates dozens of named types: `team_field` and `standard_field` for ordinary fields, then one type per related entity kind (`deal`, `property`, `loan`, `fund`, `comp`), one per contact attribute (`email`, `phone_number`, `title`), one per task attribute (`assignee_id`, `due_date`, `task_status`), and per-surface types for search, extraction and Connect (`sunspear app/models/filter_view_filter.ts:7-73`). `FilterView::VIEW_TYPE` pairs each entity type with each host context (`models/filter_view.rb:32-101`), so one list of properties has four types depending on where it is drawn (`../views/06-legacy-view-inventory.md:18`). Every new relationship or surface edits both enumerations. **Constraint:** comparisons are keyed by the field's primitive type and nothing else. A relationship is addressed through the predicate's edge leaf or a related subject, and the host of a list is no part of a filter.

### 3. Sentinels in the value domain

A blank is the reserved id `-1`, the current user is `-2` or the string `current_user`, and the backend substitutes the caller's `user_id` at query time (`sunspear app/models/filter_view_filter.ts:103-110`, `models/filter_view_filter.rb:194-214`). The substitution at run time is the right idea: a saved "assigned to me" answers per viewer. Encoding it as a value is the defect: a sentinel collides with the id space it borrows, a type check reads it as a literal, and blanks are expressed twice, once as the sentinel and once as `nullHandlingMode` (`models/filter_view_filter.rb:68-72`). **Constraint:** a token is a typed value form distinct from a literal, resolved when the query runs from the request context, and blank handling has one expression.

### 4. Relative dates as a closed list of buckets

`rolling_date` takes one of about two dozen named buckets, `prev_ninety_days` through `prev_thirty_six_months`, each expanded into a millisecond range against the user's local time (`models/filter_view_filter_value.rb:28-53`, `models/filter_view_filter.rb:236-345`). A window the list does not name, such as the next 45 days, is unavailable, and the list is edited in two codebases when a bucket is added. **Constraint:** the stored form of a relative window is a parameter, a signed day count or a calendar unit with an offset, evaluated against the viewer's today. Named presets are presentation over that parameter and live in the catalogue, never in storage.

### 5. Working state as a shadow row

An unsaved list is a `filter_views` row with `name` null, one per user per `view_type`, validated by `ensure_not_exist` (`models/filter_view.rb:381-415`). Its title and description are resolved by following `metadata.filter_view_id` to the saved parent (`models/filter_view.rb:537-587`), and `metadata.dirty` marks it modified (`sunspear app/components/common/FilterViewSelector.tsx:31`). The state is per user and per surface, so it is on no address: two people opening the same saved view see different rows once either has touched a filter, and a bug report reproduces no screen (`../views/01-legacy-pitfalls.md:31`). **Constraint:** the working state of a list is a value in the address and never a row. A row is written when a person saves, and reverting is discarding the address's changes.

### 6. Sharing as a per-view member list, and an owner the view dies with

`share_option` is `teamwide`, `team_access`, `custom_access` or null, and `custom_access` adds `filter_view_members` rows per user, sub-team or team with a `write_access` flag (`models/filter_view.rb:375-379`, `models/filter_view_member.rb:11-19`). Write access is checked by `ensure_write`, whose comment records the production defect: the owner's team membership was dereferenced for every caller, so an offboarded owner made every view they had authored uneditable by anyone, across many production teams (T2-496, `models/filter_view.rb:421-440`). The `shared` flag the API returns is `team_id` presence, marked `TODO: need to fix this flag, or just remove it` (`models/filter_view.rb:727`). **Constraint:** who may edit a view follows from its scope and the actor's role, and never from the author's row still existing. `../views/06-legacy-view-inventory.md` §5 settles the audience model; this stack states what happens to a shared view when its author leaves.

### 7. The bar offers what the executor may drop

Sorting and filtering by a field value depend on the `field_value_sort_num` and `field_value_sort_text` cache tables, gated on `cache_ready?` and repaired by backfill scripts (`../../coreservices/search/01-legacy-pitfalls.md:26`). The chip is drawn whether or not the executor can honour it, and the comps translation drops what it has no dialect for, with a log warning (`../../coreservices/search/01-legacy-pitfalls.md:25`). **Constraint:** the bar offers a comparison only where the executor honours it, and an executor that receives an unsupported condition fails the request with a structured error naming the condition (`../../reference/modernization/23-shared-mechanisms.md` §3). The Neuro grid already has one instance of the defect: the view spec accepts an array of sorts and the executor keeps the first (`packages/tenant/grid/src/ssrm.ts:181`).

### 8. A filter and a search term never meet

A saved view holds filter groups and no text term; the omnisearch takes a term and no filter group (`../../coreservices/search/01-legacy-pitfalls.md:24`). "Deals in Closing mentioning retenanting" is two screens. The search stack composes the two in one query (`../../coreservices/search/04-proposed-model.md` §The read contract). **Constraint:** the list state keeps the search term beside the filter, the address includes both, and a saved view stores both.

### 9. No default a type opens with, per person or per group

`teamwide_views` is one ordered list of pinned views per team, ranked by `position` (`core/filter_views/models/teamwide_view.rb:1-50`). There is no default per person, per group or per entity type, and the first pinned item serves as the de facto opening view (`../views/01-legacy-pitfalls.md:43`). `../views/04-proposed-model.md` §Personal, group, and tenant preferences settles the resolution fold and it is built. **Constraint:** this stack adds the surface for setting a group or tenant default and the confirmation that names who is affected, and adds no resolution rule of its own.

### 10. A chip count computed over fields the viewer may not read

`active_filter_count` is computed for the reader with the note "shared user might not have access to all team fields" (`models/filter_view.rb:730`), and `hasAccess` on a grouped view checks the grouping field's read permission separately (`sunspear app/models/filter_view.ts:282-300`). A chip that names a hidden field's comparison and value tells a restricted reader what the field is filtered to. **Constraint:** a condition over a field outside the viewer's plan renders as a withheld chip that states neither comparison nor value, is not applied, and the list says so.

## What legacy got right, and this stack keeps

| Rule | Where | Kept as |
|---|---|---|
| The current-user filter resolves per viewer at query time | `models/filter_view_filter.rb:199` | the principal token (`04-proposed-model.md` §Value tokens) |
| Relative dates are evaluated against the viewer's own day | `models/filter_view_filter.rb:238` | `within` and `before_today` against the viewer's today, built in the compiler |
| Blanks may be excluded, included or the only match | `models/filter_view_filter.rb:68-72` | the three blank modes on a chip, compiled to `is_blank` and `not_blank` |
| Groups joined by OR, conditions joined inside each | `sunspear app/models/filter_view_filter_group.ts:13` | the two-level authorable subset of `all`/`any` |
| A local copy shadows the saved view it came from, and the selector says so | `sunspear app/components/common/FilterViewSelector.tsx:31` | the modified indicator per axis, computed from the address against the saved view |
| One chip per filter, removable in place | `sunspear app/components/common/FilterViewToolbar/FilterChip.tsx` | the chip contract in `07-filter-bar-surface.md` |
