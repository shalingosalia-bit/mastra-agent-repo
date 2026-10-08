# Settled answers for filter authoring, saved views and list state

## Terms

| Term | Meaning here |
|---|---|
| Chip | One condition drawn on the bar as a field, a comparison and a value, with a remove affordance |
| Authorable subset | The two-level shape a person can build with chips: groups joined one way, conditions inside each joined the other |
| Advanced condition | A stored predicate outside that subset, shown as one chip and edited in the builder |
| Token | A value form that stands for something bound when the query runs: the person running it, or a window relative to their today |
| List state | Everything a person has changed about a list since the view it started from: filter, sort, columns, grouping, display mode, search term |
| Address | The URL of a list, saved or unsaved, which reproduces it for whoever opens it under their own access |
| Withheld | A condition on a field the reader may not see: drawn as present, not applied, with neither comparison nor value shown |

## Method and confidence

The survey is drawn from the public behaviour and documentation of Linear, Airtable, Notion, Jira, Salesforce and Attio, read in 2026. [`../views/02-best-practices-and-patterns.md`](../views/02-best-practices-and-patterns.md) settles how those products model a view; this document settles how a person authors a filter on one and what happens to the filter afterwards. A row marked *inference* states what a product's behaviour implies about its internals. Confidence is moderate for the survey and high for the claims about this repository, each of which cites a line read on `develop` on 2026-09-17.

## Settled answers

| Assertion | Evidence | What it implies for this stack |
|---|---|---|
| **The list a person is looking at is the address.** | Linear reproduces every list, board and timeline from its URL, and a saved view is a name for one such address. `../views/01-legacy-pitfalls.md` P4 and `../workspaces/04-proposed-model.md` §Focus must be in the URL state the same rule for this repository | The address describes the whole list, saved or unsaved, and a saved view is a stored address with a name and an audience |
| **A filter is edited as chips, and a chip is one condition.** | Every surveyed product draws the active filter as a row of removable chips and opens a picker from a "+ Filter" affordance listing fields first and comparisons second. Jira's advanced mode is a text query language, and its own documentation steers people back to the chip mode | The chip model in `04-proposed-model.md` §The filter model is the surface, with the platform's grammar underneath |
| **The authorable subset is two levels.** | Airtable's condition groups, Notion's filter groups and legacy's `AdvancedFilterModal` all stop at two levels, and Airtable's documentation states the limit. The grammar allows depth eight (`packages/shared/fields/src/predicate/ast.ts:178`) | The surface offers two levels and shows a deeper stored predicate as one advanced chip with the builder behind it |
| **Comparisons are keyed by type, and the set per type is small.** | Airtable offers between four and seven comparisons per field type; Linear fewer. Legacy's evaluation tenant used `equals` for the large majority of stored filter values (`../views/06-legacy-view-inventory.md:127`). The grid already declines `starts with` because the executor has no prefix comparison (`apps/dpagentic/src/features/entity/entity-grid.tsx:60`) | The catalogue offers the comparisons the compiler honours for the primitive, and no others |
| **Relative dates are presets over one parameter.** | Every surveyed product offers "today", "this week", "last 30 days" as named choices; Airtable also exposes "number of days from now". *Inference:* each stores a parameterised window underneath, because the presets and the free number behave identically. Legacy stored the preset name and expanded it in code (`01-legacy-pitfalls.md` §4) | The stored form is the parameter, the preset is a label the catalogue attaches to common parameters, and a person who wants "next 45 days" types 45 |
| **"Me" is a token, resolved per viewer.** | Jira's `currentUser()`, Linear's "assigned to me", Salesforce's `$User` and Airtable's "current user" each mean the person running the query. *Inference:* each stores a marker and binds the viewer at query time, because one shared view answers differently per viewer. Legacy did the same with a sentinel id (`01-legacy-pitfalls.md` §3) | The token means the person running the query, never the person who saved it |
| **Saving from a modified list has four verbs.** | Linear: save, update, revert, duplicate. Airtable: save changes, discard, duplicate view. Notion the same. Each marks a modified saved view on its name | The four verbs, the modified mark, and fork-on-edit for a person who may not update the view (`../views/04-proposed-model.md` §Composition editing states the same rule for drag and drop) |
| **Columns are part of the view.** | Airtable and Notion treat hidden fields as view state; Linear treats display properties the same way | A column shown or hidden marks the view modified like a filter does, and is saved and reverted with it. A grid column menu that does not round-trip into the view is a second store |
| **The default a type opens with is resolved by audience, and the resolution is shown.** | Linear resolves a team's default view, then a personal override; Notion opens a database on its first view; Airtable on the last-used one. `../views/04-proposed-model.md` §Personal, group, and tenant preferences settles the fold and its `from` discriminator | The surface displays which rule chose the view |
| **Restricted readers see the shape and not the value.** | Salesforce redacts a filter value on a list view whose field the reader may not see, and shows the filter as present. Legacy computed the active filter count over fields the reader may not read (`the_wall models/filter_view.rb:730`) | A withheld condition is drawn as withheld, the list does not apply it and says so, and the chip count includes it |

## What does not apply

| Technique a reader would expect | Why it is not used |
|---|---|
| A text query language such as JQL | The chip model plus the builder covers the authorable subset, and a stored predicate is already a serialisable structure the agent emits and the builder edits |
| Client-side filtering of a loaded page | Every filter is a server round trip under the viewer's plan (`apps/dpagentic/src/features/entity/entity-grid.tsx:66`), so a filter never sees a row the plan excludes |
| Per-column filter menus as the primary surface | Kept as a secondary affordance only: they write into the same list state the chips show, and a filter set from a column header appears as a chip |
| Filter templates or "quick filters" as a separate object | A quick filter is a saved view with a short name, and one kind of stored thing is the reason `views/` exists |
| A per-view access list | Settled against in `../views/06-legacy-view-inventory.md` §5 |
