# Legacy functionality map

Every legacy table, column, value type, endpoint and screen this stack subsumes, with a disposition. Paths are `the_wall` unless prefixed `sunspear`. [`../views/06-legacy-view-inventory.md`](../views/06-legacy-view-inventory.md) maps the other three view systems and the widget-hosted `filter_views`; this map covers the list-hosted `filter_views` rows, their filters, and the screens a person filters on. `../../operations/data-migration/01-identifier-map.md:222` already assigns `filter_views` to `views` rows of kind `query` with the disposition **derive**; this document states the derivation.

## Tables

| Legacy | Rows are | Neuro | Disposition |
|---|---|---|---|
| `filter_views` (list-hosted `view_type`s) | one saved or local view per user per surface | one `views` row of kind `query` per saved view; a local view becomes nothing, because the working state is the address (FV11) | derive saved rows; drop local rows and count them in the report |
| `filter_view_filter_groups` | one group per view, `match_any` | one group in the filter model, `match` from `match_any` | derive |
| `filter_view_filters` | one condition, `filter_type`, `remove_selected`, `null_handling_mode` | one `FieldCondition` or `EdgeCondition`; `remove_selected` chooses the negative comparison; `null_handling_mode` becomes `blanks` | derive; a `filter_type` with no field or relation behind it is reported |
| `filter_view_filter_values` | one value per condition, `value_type` | the condition's `value`, per the value-type table below | derive |
| `filter_view_sorts` | one sort key per view | `sort`, every key, in order | derive; a second key is reported while `multiKeySort` is off |
| `filter_view_columns` | one column per view, with `calculation` | `columns`, in order; `calculation` is `measures`, which `../views/08-build-specs.md` §1 owns | derive the columns here; the measures there |
| `filter_view_groups`, `filter_view_collapsed_groups` | grouping and its collapsed state | `groupBy`, two levels at most; collapsed state is a per-viewer preference and is dropped (`../views/09-infoview-and-infobox.md` Decision 2) | derive the grouping; drop the collapse |
| `filter_view_options` | one boolean or enum flag per view per `option_type` | `display.density` for `display_density`; every other flag is refused by `../views/03-requirements-and-user-stories.md` §Non-goals and reported | derive one; report the rest |
| `filter_view_charts` | a chart attached to a list view | a `chart` section, which `../views/` owns | out of scope here |
| `filter_view_members` | one named reader or writer per `custom_access` view | none; the audience is a subject (`../views/06-legacy-view-inventory.md` §5) | see the sharing table |
| `teamwide_views` | one pinned view per team, ranked | a `view_defaults` row at the tenant tier for the first-ranked view of each type; the rest become nothing, because pinning is `view_favorites` per person | derive one row per type; report the rest |

## Columns of `filter_views`

| Column | Neuro | Rule |
|---|---|---|
| `view_type` | `source: { kind: 'entity', type }` | The entity type half of the pair. The host-context half is dropped, because a view has no host (`01-legacy-pitfalls.md` §2). A `view_type` naming a widget host is `../views/06`'s |
| `name`, `description` | `name`, `definition.description` | Verbatim. A saved view with a duplicate name under one owner takes a numeric suffix, reported |
| `user_id` | `owner` where the scope is personal; `created_by` always | — |
| `saved_view` | whether a row is derived at all | `false` rows are local working copies and produce nothing |
| `share_option`, `team_id` | `scope` and `owner` | Per the sharing table |
| `metadata.filter_view_id`, `metadata.dirty` | nothing | A working copy's pointer at its parent. The address replaces it |
| `active_filter_count` | nothing | Computed at render from the chips (FV29) |
| `cron_job_setting_id` | a scheduled delivery in [`../../coreservices/federation/`](../../coreservices/federation/00-federation.md) | Out of scope here; reported with the view handle so that stack's migration finds it |
| `reporting_dashboard_id`, `is_default_grouped` | `../views/`'s dashboard map | Out of scope here |
| `deleted_at` | not derived | A soft-deleted view is not migrated and is counted |

## Value types and sentinels

| Legacy `value_type` or sentinel | Source | Neuro | Rule |
|---|---|---|---|
| `equals` with one value | `sunspear app/models/filter_view_filter.ts:80` | `eq`, or `none` when `remove_selected` | On a `select` field a list of values is `in` |
| `equals` with several values | the same | `in`, or `none` when `remove_selected` | — |
| `min`, `max` | `:76-77` | `gte`, `lte`; both present fold into one `between` condition | A percentage field's division by 100 (`models/filter_view_filter.rb:220-225`) is undone: Neuro stores the value the person typed |
| `contains` | `:79` | `contains` | — |
| `rolling_date` | `:78`, `models/filter_view_filter_value.rb:28-53` | a window token: `prev_seven_days` → `{ days: -7 }`, `next_thirty_days` → `{ days: 30 }`, `curr_month` → `{ unit: 'month', offset: 0 }`, `prev_quarter` → `{ unit: 'quarter', offset: -1 }`, and so on for each bucket | A calendar bucket is reported while `calendarWindows` is off, and migrated as its token regardless, so turning the toggle on needs no second pass |
| `zip`, `city`, `state`, `country`, `address_1` | `:82-86` | `eq` or `contains` on the tenant's text field for that address part, where the tenant has one | Reported where the tenant has no such field |
| blanks `-1`, and `null_handling_mode` | `:107-110`, `models/filter_view_filter.rb:68-72` | `blanks`: the sentinel beside other values is `include`, and alone it is `only`; `null_handling_mode` 0, 1, 2 is `exclude`, `include`, `only` | Where both appear and disagree, `null_handling_mode` wins and the row is reported |
| `current_user` and `-2` | `:103-110`, `models/filter_view_filter.rb:199` | `{ token: 'principal' }` | Migrated as the token regardless of the `principalToken` toggle, for the same reason as the calendar windows |
| `upcoming_critical_dates`, `past_critical_dates`, `starred_tasks`, the task-type values | `models/filter_view_filter_value.rb:55-58` | `within` and `before_today` on the task's date field for the first two; the rest are [`../../coreservices/flow/`](../../coreservices/flow/00-flow.md)'s | Reported with the view handle |
| `hidden`, `entity_type` | `:88-89` | nothing | Surface-specific special cases; reported |

## Sharing

| Legacy | Neuro | Rule |
|---|---|---|
| `share_option` null, `team_id` null | `scope: 'personal'`, `owner: user_id` | — |
| `teamwide` | `scope: 'shared'`, `owner: ''` | Publishing requires `manage View`; the migration writes as the platform |
| `team_access` | `scope: 'shared'` | Legacy's "team" is the tenant |
| `custom_access` with `filter_view_members` naming one sub-team | `scope: 'group'`, `owner` the group derived from that sub-team | Where `../../coreservices/authz/`'s migration derived a group from the sub-team |
| `custom_access` with named users, or several sub-teams | `scope: 'personal'`, `owner: user_id`, and one report line per member | A named individual is a group of one, and creating that group is the tenant's decision (`../views/06-legacy-view-inventory.md` §5) |
| `filter_view_members.write_access` | nothing | Editability follows scope and role |

## Endpoints and screens

| Legacy | Source | Neuro |
|---|---|---|
| `entities_for_filter_view`, `entities_for_filter_views` | `handlers/query_handler.rb:130,255` | the grid's block query and `resolveQueryView`, given the list state (`04-proposed-model.md` §The executor contract) |
| Filter view create, update, delete, share | `Core::Views::FilterViews::CoreFilterViewController` | `saveView`, the soft delete, `setViewDefault`, `setViewFavorite`, called through the verbs `04-proposed-model.md` §The lifecycle states |
| `FilterViewToolbar`, `FilterChip`, `OpenFilterToolbarButton` | `sunspear app/components/common/FilterViewToolbar/` | `FilterBar` and `FilterChip` (`07-filter-bar-surface.md`) |
| `FilterFieldInput`, `TeamFieldFilterInput`, `StandardFieldFilterInput`, `FilterFieldOptionsInput`, `FilterMatchingOption` | the same directory | `FilterPicker` and the field descriptors' edit controls (`07-filter-bar-surface.md`) |
| `AdvancedFilterModal`, `AdvancedFilterGroup` | `sunspear app/components/modals/AdvancedFilterModal/` | the builder that exists today (`apps/dpagentic/src/features/query/components/predicate-builder.tsx`, saving through `features/query/actions.ts:22-49`), opened from the bar and seeded with the list state |
| `FilterViewSelector` | `sunspear app/components/common/FilterViewSelector.tsx` | `ViewMenu` (`07-filter-bar-surface.md`) |
| `filter_view_settings` connector | `sunspear app/connectors/filter_view_settings.ts` | none; the state is decoded from the address and the view is read once |

## The migration report

The generator emits one report per tenant, and FV34 requires every line below to appear rather than a count:

| Line | Named by |
|---|---|
| A local view dropped | user, `view_type` |
| A `filter_type` with no field or relation behind it | view handle, `filter_type` |
| A second sort key while `multiKeySort` is off | view handle, field |
| An option flag refused | view handle, `option_type` |
| A `custom_access` member who received no group | view handle, member type, member id |
| A duplicate name suffixed | view handle, original name |
| A `cron_job_setting_id`, a chart, a dashboard reference | view handle, the stack that owns it |
| An address-part filter with no matching text field | view handle, part |
| A blank sentinel disagreeing with `null_handling_mode` | view handle, field |

## What has no legacy equivalent

Listed so the closing state is not presented as parity:

1. The list state in the address, and the diff per axis (FV11, FV14).
2. The partition of a shared view by the reader's plan, and the withheld chip (FV29).
3. A typed principal token, and a calendar window as a parameter (FV5, FV6).
4. The fork of a view a person may not edit, under the same handle (FV21).
5. The impact list before a field is deleted (FV28).
6. The agent reading and proposing a change to the open list (FV33).
