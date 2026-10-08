# Legacy view inventory: what `sircharlesgroup` configures

It settles which configured legacy view capabilities Neuro's views model lacks, for a Builder choosing the next view capability to build. The evidence is the evaluation Tenant's view rows. Their shapes show what the view engine must support, and their names are mostly QA fixtures.

Sources: the legacy MySQL development database (`mysql -u dealpath dealpath`), queried against `shard_teams.id = 4`, the *Sir Charles Group* Tenant used to evaluate functionality in the legacy product. Counts are live rows with `deleted_at is null` where the table has that column. Every number below is a count; where a reading is an interpretation, the text says so.

**Caveat.** Team 4 is an internal QA Tenant. Many view names are fixtures (`Dashboard Widget 189`, `Display Options ON`, `Double Groupings, Charts, Display Options ON`), and no business built them. The *names* are therefore weak evidence of what a business wants. The *shapes* are strong evidence of what the view engine must support, because a QA Tenant is configured to exercise every capability.

## Four parallel view systems

| System | Rows (team 4) | What it configures | Neuro equivalent |
|---|---|---|---|
| `filter_views` (+ 12 child tables) | 167 | Lists, related-record widgets, chart widgets, reports | `query` view, `related` section, `chart` section |
| `info_views` (+ 11 child tables) | 49 | Record detail layouts | `layout` |
| `reporting_dashboards` / `dashboard_widgets` | 5 / 229 | Dashboards | `dashboard` |
| `teamwide_views` | 2 | Which view a type opens with | `view_defaults` |

Four systems, 27 tables. They implement one idea four times: a configured presentation over a query. `01` P1 and P6 describe the cost. Two vocabularies show the proliferation:

- **25 distinct `filter_views.view_type` values.** Each is an (entity type × host context) pair, and none is a kind. `properties_view`, `deal_properties_view`, `property_carousel_widgets_view`, and `properties_widget_view` are all "a list of properties", differing only in where it is drawn. `deal_loans_dashboard_view`, `deal_funds_view`, and `investment_funds_view` are all "records related to this record through one edge".
- **26 distinct `info_view_sections.category` values**: the ~20 hardcoded category checks `01` P1 describes, counted.

Neuro's two primitives remove the first vocabulary: a related section is a hosted query view plus an edge, and the host context is not part of the view. The second vocabulary becomes a registry, where a new kind is a descriptor and no branch.

## What team 4 uses, and whether Neuro has it

### Query views: shape

| Capability | Evidence in team 4 | Have it? |
|---|---|---|
| Columns per view | max 28, mean 3.2 | Yes |
| Filter | 38 filters; operators are `equals` (119 values), `min`/`max` (6), `rolling_date` (8) | Partly — see *relative dates* below |
| Sort | 10 views sort; **every one is single-key** | Yes |
| Group by, one level | 59 views | Yes (`boardGroupBy`) |
| **Group by, two levels** | **13 views** | **No** |
| **Column aggregates** | `calculation` set on 21 columns: `count` (15), `sum` (6) | **No** |
| **Subtotals and a summary row** | options `show_summary` (21), `show_subtotal` (16), `subtotal_location` (19) | **No** |
| **A chart attached to a list view** | `filter_view_charts` rows on `reporting_deals` views — chart *and* table in one view | **No** — charts are only sections/widgets |
| Personal vs shared | `share_option`: `teamwide`, `team_access`, `custom_access`, null (private) | Yes for three of four |
| **Per-view access list** | `custom_access` + 53 `filter_view_members` rows across 53 views | **No** — we have shared/personal, no named-principal ACL |
| Density | option `display_density` (14) | Yes |

### Dashboards — chart kinds in use

| Legacy `chart_type` | Count | Have it? |
|---|---|---|
| `table_chart` | 26 | **No** — a grouped table with aggregates, i.e. a pivot |
| `single_metric` | 12 | Yes (`stat` / `sum` / `count`) |
| `donut_chart` | 3 | Yes |
| `bar_chart` | 3 | Yes |
| `line_chart` | 3 | Yes |

`table_chart` is the most-used dashboard widget. It is the aggregate table and draws no plot. It needs the same grouping-plus-aggregation machinery the list views need, so two of Neuro's gaps are one gap.

### Detail layouts — section categories in use

Grouped by what they are:

| Group | Legacy categories (uses) | Neuro kind |
|---|---|---|
| Fields of the record | `custom_info` (114), `details_widget` (2) | `fields` — have it |
| Prose | `text_block` (3) | `markdown` — have it |
| Charts | `info_chart_widget` (13: bar vertical/horizontal, pie) | `chart` — have it; **horizontal bar orientation missing** |
| Related records | `properties_widget` (5), `contacts_widget` (6), `comps_widget` (3), `loans_widget` (3), `associations_widget` (2), `people_widget` (1), `fund_allocation_widget` (1) | `related` — have it; **`view_type` of `row` / `list` / `tile` is a display mode we do not offer inside a section** |
| **Dates / critical dates** | `dates_widget` (18) — plus `group_type: due_date` (8) and options `show_critical_date_statuses`, `highlight_critical_dates`, `show_start_dates` | **No kind** |
| **Media** | `photos_widget` (20) | **No kind** |
| **Geography** | `street_view_widget` (16), `map_widget` (14), `esri_widget` (11) | **No kind** |
| **Notes and activity** | `entity_notes_widget` (6), `contact_notes_widget` (2), `activities_widget` (2) | **No kind** |
| **External data** | `compstak_widget` (4) | **No kind** |
| Tabular field block | `custom_table` (12) | Partly — a `fields` section rendered as a grid, not a record list |
| **A layout inside a layout** | `embedded_info_view` (1, embedding a Property layout in a Deal) | **No** — compositions do not nest |
| Specialized | `entity_progress_widget` (1), `model_comparison_widget` (1) | No kind |

`photos_widget` has 20 uses, and the three geography sections have 41 combined. In a real-estate product, a record page is largely a picture and a map as well as fields.

## The gaps, ranked by impact

**1. Grouping with aggregates.** One gap covers three capabilities: two-level grouping (13 views), column `sum`/`count` (21 columns), and subtotals plus a summary row (56 option rows). It is also `table_chart`, the most-used dashboard widget. Nothing Neuro has does any of it: the query view returns rows, never groups or totals. This is the largest single gap and the one a Tenant notices first, because "total pipeline by stage and type" is the ordinary question.

**2. Relative dates in predicates (closed 2026-08-02).** `rolling_date` (8 values), `interval_mode: month` on groups, and views like *Comp Date = Last 30 days*. A saved view filtered on a literal date is wrong the next morning.

`within` is in the predicate-operator vocabulary and compiles to SQL. Two bugs made it unusable, both binding a JavaScript `Date` where postgres.js requires a string. One was in the projection predicate compiler, so *any* relative-date filter threw. The other was in the materializer, so promoting a date column broke; no seeded profile promotes one, so it never surfaced. Both are fixed and covered by tests; see the note on measurement below.

A capability in the AST with no test on the path that uses it is not usable. The projection compiler had no `within` coverage, so it kept a bug its twin had already fixed and documented.

**3. Related sections need display modes.** Legacy already distinguishes `row`, `list`, and `tile` renderings of the same related query. Neuro resolves every related section as a table. The resolved shape already contains what a card or tile rendering needs, so this is a component change and leaves the model alone.

**4. Media, map, and notes sections.** Four new registry kinds, none of which changes the model. Each is a descriptor plus a component. `photos_widget` and `map_widget` give a property page its photos and its map.

**5. Per-view access lists: decided, and not rebuilt.** 53 of team 4's views are shared with named Users (`custom_access` plus `filter_view_members`).

Neuro drops the per-view member list. A member list is a second authorization system. Every view grows its own ACL, answering "what can this User see" means walking them all, and removing a User from a team leaves their name on 53 rows. The audience is a subject, and the subjects are the ones authorization already reads:

| Tier | Stored as | Who sees it |
|---|---|---|
| personal | `scope: 'personal'`, `owner` = the principal | the author |
| group | `scope: 'group'`, `owner` = a group id | that group's members, read from the same `group_members` the access plan reads |
| shared | `scope: 'shared'` | the Tenant; publishing requires `manage View` |
| managed | `is_managed` | every User; provisioned and never authored |

A favourite (`view_favorites`) is a preference and grants no permission; it only reorders the picker.

This follows Linear's progression: keep it, share it with your team, publish it. It reuses the one notion of "my team", so no second notion can drift from it. A named User who needs one view gets a group of one. That is less convenient than a member list, and it keeps every sharing decision inspectable in one place.

The remaining gap: a legacy view shared with three specific Users has no exact equivalent, and migrating one means creating a group. Neuro accepts that migration cost so that Neuro keeps no per-object ACL.

**6. Nested compositions.** One use in team 4 (a Property layout embedded in a Deal layout). Low volume, and a real structural question: a `layout` section kind hosting another layout, resolved against a related record. It is a small addition once wanted, and not urgent on this evidence.

**7. Cosmetic display options.** `paren_negative_nums`, `color_negative_nums`, `underline_formulas`, `use_alternate_shading`, `show_thumbnail`. In Neuro's model these formatting rules belong to the field descriptor: a negative number should render the same way everywhere in the Tenant. Leave them off the view, and keep only the per-view ones (density, which Neuro has).

## Capabilities from the search work (#155)

The Postgres search and PostGIS work in `model-poc` covers three of the gaps above, and views consume it:

| Capability | How views use it | Legacy equivalent |
|---|---|---|
| Full-text over the projections | `?q=` on any view page, and a `search` term storable on a saved view. The viewer's access plan decides at read time which fields the term matches, so a shared view's saved term never matches fields the viewer may not read | the keyword box legacy pairs with a list view and loses on navigation |
| PostGIS radius + nearest ordering | a `nearby` section kind: records of one type within a radius of the HOST record's position, nearest first, with the distance shown | `compstak_widget` plus a candidate-ranking job over a 500-row cap |
| Relevance ranking | a typed term ranks by relevance, overriding the view's stored sort | — |

`nearby` is distinct from `related`. A related section follows an edge, a declared relationship someone or something recorded; `nearby` follows proximity, a fact about the data. Both resolve through the same authorized read, so a comp found by distance is subject to the same field and row rules as one found by a link.

**A gap in the search subsystem.** Search does not match a `location` field's text. The vector is built from `value_text` (`projection/materialize.ts`), locations store in `value_json` with `value_text` null, and the location descriptor has no `plainText`. On the seeded dealpath corpus, `?q=Denver` returns 0 properties while every property address contains a city, and `?q=Property 7` and `?q=APN` both work. Address search is a core need in this domain: legacy's evaluation Tenant uses `Address` as its 8th most-referenced field. Close it at the materializer, either by populating `value_text` for locations or by having the vector read per-primitive.

## Where legacy matches the model

- **Neuro's 14 seeded entity types match the Tenant's exactly.** Team 4's field-bearing types are Property (841 fields), Deal/Asset/FinancialModel (59), Fund (42), Loan (33), Comp (21), `Person` (11), Investment (10), Lease (9), LineItem (7), FundingEvent (7), BankAccount (6), Company (5). Neuro's seed splits the composite Deal/Asset/FinancialModel type into three, giving 14. Nothing is missing.
- **Sorting is single-key in every view that sorts.** Multi-key sorting is not needed on this evidence.
- **Filter operators are a small set.** `equals` dominates at 119 of 133 values. The predicate AST is not the constraint.
- **The grouping fields are few and obvious**: Deal Status (32), Property Type (16), Deal Type (8), Country, Investment Type, Fund Status. A board or a grouped table over those covers most of what the Tenant does.
- **Column counts are modest**: mean 3.2, max 28. The 222-column page in the load harness was Neuro's own default, and no Tenant asked for it.

## Recommended seeded views

Views to seed in the demo Tenant so it exercises the gaps above. Seed the first three whatever is decided about the rest:

1. **Pipeline by stage and type**: a deal view grouped two levels with `sum(purchase_price)` subtotals. Does not resolve today; it is the concrete driver for gap 1.
2. **Recent comps**: a comp view filtered `comp_date within last 90 days`. Resolves today, with the binding bugs fixed. Seed it so the capability has a view that uses it.
3. **Property page with photos and a map**: two new section kinds on the existing property layout. The concrete driver for gap 4, and the view that makes the demo look like the product.
4. **Portfolio table**: a `table_chart` equivalent: loans grouped by status with `sum(principal)` and a count. Follows from gap 1 once built.
5. **Related properties as tiles**: the existing deal layout's property section, rendered as cards. Gap 3, component only.

Nothing here changes the two primitives or the registry. Every gap is a resolver capability (grouping and aggregates), a predicate capability (relative dates), or a new descriptor plus component.
