# Build specifications for the sequenced additions

It settles how the four additions `04` sequences are built (named measure kinds, the `matrix` section, print, Excel export), for a Builder changing one. All four are built, along with corrections C1–C6. Each section states the evidence behind its bounds, the resolved shape, the fixed rules, and the acceptance criteria, which are the tests that exist.

`series` is guarded at save time exactly like `groupBy`. A series is the second grouping level, and the legend draws its distinct values. A chart using a series field the author may not read would print that field's values. Guarding only `groupBy` would leave the series as a way around the check.

Sources: the legacy dev MySQL (`mysql -u dealpath dealpath`) and this branch.

## 1. Named measure kinds

**The demand.** The data gives `show_variance_column` and `show_benchmark_line_options` little weight:

| Signal | Count | What it means |
|---|---|---|
| `filter_view_columns.calculation` | `count` 124, `sum` 77, `average` 19, `min` 2, `max` 1, `none` 2 | fifteen years of demand is exactly the five aggregate functions `measureSchema` already has |
| `show_variance_column` | 6 | real, but rare |
| `show_benchmark_line_options` | 2, **both set to `0`** | configured off; effectively unused |
| `interval_mode` (period bucketing) | **0 rows** | the column exists in the schema and no Tenant ever used it |
| `weighted_by_id` (weighted average) | **0 rows** | same |
| `filter_view_groups` depth | 752 views with one level, 177 with two, **none with three** | the data sets the two-level grouping ceiling |
| `category_axis_field` / `series_field` | 119 / 67 | the second grouping level is *rendered* as a chart series, which Neuro does not draw today |

The aggregate set needs nothing added. **The gap is in charts: they do not draw the second grouping level Neuro already stores.**

**What to build.**

```ts
// measureSchema gains a second member. The existing one is unchanged.
type Measure =
  | { fn: 'count' | 'sum' | 'avg' | 'min' | 'max'; field?: string; label?: string }
  | { kind: 'share-of-total'; of: { fn: 'count' | 'sum'; field?: string }; label?: string }

// chart sections and dashboard widgets gain the series encoding.
//   series?: string   // the SECOND groupBy handle, drawn as colour/stack rather than a new axis
// chartKinds gains: 'bar-grouped' | 'bar-stacked' | 'bar-100'
//   x = groupBy[0], colour = series, y = the measure — the grammar-of-graphics encoding
//   triple (`02`, layer 4), so the kinds stop being ad-hoc names.
```

`share-of-total` is the one derived kind to build now, and it adds no query. `aggregateEntities` already returns the `ROLLUP` grand total alongside the leaves in a single pass, so the resolver computes the share as `leaf.value / grandTotal.value` from data in hand. The legacy `hundred_percent_bar_chart` and `legend_display_option: 'Percentage' | 'Value & Percentage'` approximated the same measure with presentation flags.

Properties that must hold; both are easy to get wrong, and neither shows in a screenshot:

- **A zero grand total yields `null`**, never `NaN` or `Infinity`, rendered as `—`.
- **Truncation must leave the denominator correct.** The chart resolver caps at 200 groups. The grand total comes from the `ROLLUP` row, computed over *all* rows and never over the returned page. A denominator taken from the sum of returned leaves would be wrong, with no error, on any set wider than the cap. The chart resolver fixed a bug of the same class once, by moving off a 500-row client-side sum.

**Specified and not built.** `variance` has six real uses, so the shape is defined now and implemented when asked. A defined shape keeps it from arriving as a boolean:

```ts
| { kind: 'variance'; of: Measure; against: { field: string } | { measure: Measure } | { constant: number }
    as: 'absolute' | 'percent'; label?: string }
```

**Rejected, with the evidence.** Weighted average (`weighted_by_id`) and interval bucketing (`interval_mode`) are columns legacy provided and no Tenant used in fifteen years. They are outside the ceiling, and a schema column is no evidence of demand.

**Acceptance.** Shares over a complete set sum to 100% within rounding; a set wider than 200 groups still produces shares against the true total (negative control: point the denominator at the page sum and watch the test fail); a zero total renders `—`; a two-level `groupBy` renders as a grouped bar whose series count equals the second level's distinct values.

## 2. The `matrix` section

**The demand.** `info_view_section_cells` has 893 cells: **864 field references, 24 literals, 5 empty**. Sizes run to 5 columns (137 sections have one, 47 have two) and 22 rows (most have six or fewer). Styling, the axis that made `custom_table` unbounded, is attached to just **55 elements in the entire dev database** (39 cells, 15 rows, 1 column).

Dropping per-cell styling on migration therefore affects 6% of one section type. The non-goal in `03` removes little that Tenants use.

**Spec, with bounds enforced in Zod** (observed maxima are 5 × 22; the bounds leave headroom and keep the space certifiable):

```ts
{ kind: 'matrix'; label: string
  rows: string[]            // user-named, ≤ 64, array order is the order
  columns: string[]         // user-named, ≤ 8
  cells: Array<{ row: string; column: string; field: string }>   // ≤ 256, sparse
  breakBefore?: boolean }
```

Resolved shape and rules:

```ts
ResolvedMatrixSection = { kind: 'matrix'; label: string
  rows: string[]; columns: string[]
  cells: Array<{ row: string; column: string; handle: string
                 label: string; value: unknown; display: string; redacted: boolean }> }
```

- **It resolves against the host record**, like `fields`; legacy's `custom_table` is per-record and runs no query. With no host it degrades to `unresolved` with a stated reason, as every host-dependent kind already does.
- **Sparse by design.** Not every intersection is filled (legacy has 5 empty cells); a missing cell renders blank, and a cell naming a deleted field is skipped exactly as `fields` skips one (P5, read side).
- **A withheld cell reads `withheld`, never blank.** `display: ''` with `redacted: true`, following the rule `toRows` already applies: `null` is withheld, `''` is empty, and collapsing them lets a redacted field look like an empty one.
- **A cell may reference a calculated field.** Calculations are fields here, so this needs no special case, and legacy's `derived_field_id` column on cells has no counterpart.
- **No styling. No literals.** A migrated literal becomes text in an adjacent `markdown` section or is reported as dropped (24 cells); styles are reported as dropped (55 records). Both are reported, as the migration package already does with `unmappedLabels()`, and nothing is discarded unreported.

**Acceptance.** A matrix with a redacted cell shows `withheld` and not a blank (negative control: collapse the two and watch it fail); a spec exceeding the bounds is rejected at save with a named error and is never truncated; a matrix whose cell names a deleted field renders the rest; migrating a legacy `custom_table` prints the literal and style drop counts.

## 3. Print

Print is a render target of the resolved composition (`02`, layer 3). Authentication is the design question; the rest is a stylesheet.

**The authentication rule: a PDF contains exactly what its requester may see.** A print worker with a service credential that reads across the Tenant would make the PDF a redaction bypass: a restricted Analyst requests a print and receives the unrestricted rendering. The design prevents that failure, which rules out the obvious implementation.

The mechanism:

1. The User requests a print. The server mints a **single-use, short-lived print token** bound to `(tenant, principal, view handle, host entity id, expiry ≤ 60s)`. The Nitro API already has a bearer path (`apps/api/utils/acting-context.ts`), so this is a bounded credential on an existing seam and no new auth system.
2. A headless Chromium loads `/print/<handle>?token=…`. The route redeems the token, builds the `OpContext` **for the original principal**, and resolves the composition through the same resolver the page uses.
3. `page.pdf()` produces the file. Headers and footers come from Chromium's `headerTemplate`/`footerTemplate`, in one place, with no per-view configuration.

Redemption is single-use and expiry is short because the token is a bearer of a Principal's read access; a leaked long-lived one is an access grant.

**The token is in the URL, as a stated compromise.** A query parameter is the most leak-prone place for a credential: browser history, server access logs, tracing spans, and the `Referer` header of any link the page follows. Three things bound it: the token is single-use, it lives 60 seconds, and the print route sends `Referrer-Policy: no-referrer` so the page never passes it on. What remains is the requester's own history and the access log of the server they already authenticate to. Removing that too needs a POST exchange that swaps the token for an `HttpOnly; Secure; SameSite` cookie before the render. The exchange is larger than the route itself and belongs with a real worker fleet. That fleet is designed in [`../../coreservices/render/04-proposed-model.md`](../../coreservices/render/04-proposed-model.md), which takes the exchange.

**Stylesheet, with everything that is configurable:**

- `@page { size: Letter; margin: 0.5in }`: Paged Media, a W3C standard.
- `break-before: page` where a section's `breakBefore` is set. **No view has any other print-specific spec** (`01` P7).
- `thead { display: table-header-group }` so a table spanning pages repeats its headers.
- `break-inside: avoid` on section cards so a card is not split mid-row.
- Long tables paginate by CSS, and **the data is never chunked**: chunking would be a second layout engine, and a second layout engine drifts from the first.

**Acceptance.** The same view printed by a TenantAdmin and by a restricted Analyst produces different row counts, and the Analyst's shows `withheld` where fields are denied. This is the negative control for the whole token design: if the two PDFs match, the worker is over-privileged. An expired or reused token is rejected; a section with `breakBefore` starts a new page; a 200-row table repeats its header on every page.

## 4. Excel export

Serialization of the resolved shape, never its own query. `resolveQueryView` output → worksheet.

**Library: exceljs.** Number formats and row outlining are what this needs. SheetJS's community build puts both in the pro tier; exceljs has them in the open package.

**Rules; breaking any one is a bug:**

1. **Write raw values with a number format, never display strings.** A money column written as `"$2,450,000"` is text: it does not sum, and the export is no better than a screenshot. `ResolvedRow` already has both, `values` (display) and `raw`, so the second render target can use the one the first does not.
2. **The number format comes from the field descriptor.** A money field's precision and currency are properties of the field, so the cell's `numFmt` derives from the descriptor. This applies the "formatting belongs to the field" rule (`01` P7) to a second target, so the same figure renders one way in every place.
3. **A withheld cell reads `withheld`, never blank.** The rule is the same as elsewhere, with more at stake here. A blank spreadsheet cell looks like "no value", a claim about the record, when the fact is about the reader's access.
4. **Subtotals are written as values, never as formulas.** `ROLLUP` levels map to Excel outline levels (`row.outlineLevel`), and each subtotal row contains the server's computed number. A `SUBTOTAL()` formula would recompute against whatever the recipient filters and then disagree with the server that produced it.

**Acceptance.** A money column sums correctly in Excel (negative control: write display strings and watch the sum test fail); a redacted cell reads `withheld`; subtotal rows equal the server's `ROLLUP` values exactly; outline levels match the grouping depth.

## The section-kind admission rule

[ADR-0021](../workspaces/ADR-0021-workspace-view-composition-boundary.md) decision 3 sets the section registry's admission rule. It matches what `docs/experiences/workspaces/09-build-specs.md` states for `NamedRoute` and `chrome.mode`, for the same reason: an enum that only grows is legacy's widget catalogue with better types. `07-widget-variant-explosion.md` shows the result, a variant space no one can enumerate.

**The rule.** Adding a section kind requires a sentence in the pull request stating **what the existing vocabulary fails to express**. The sentence names the closest existing kind and says what that kind does not do. An existing kind with a different presentation is a presentation hint on that kind and no new kind, the way `related.display` covers legacy's three separate renderings of one related query.

**What does not clear the bar**, each drawn from a variant legacy shipped:

1. **A different look for the same data.** Three geography widgets that differ only in basemap are one `map` kind, with a hint.
2. **A different source for the same shape.** A list of records is `related` or a query view whatever it queried; the source registry (ADR-0018) is where a new source belongs.
3. **A convenience wrapper.** A kind that is another kind with a preset filter is a stored view, used through composition by reference.

**What does clear it.** A kind that draws something no existing kind draws, or that has an interaction no existing kind has. Both current admissions are recorded here, so the next proposal has a precedent to compare against:

| Kind | Closest existing | Why that one cannot express it |
|---|---|---|
| `conversation` | `markdown` | `markdown` renders authored prose. Nothing in the registry renders a **bidirectional** surface — one the reader types into and that answers. |
| `plays` | `related` | `related` lists records and `fields` lists values. Neither lists **capabilities**, and neither carries a per-entry availability state or a launch affordance. |

**Naming is part of the bar.** A kind's name is a word in a shared vocabulary, so it obeys [ADR-0008](../../coredata/entity-fields/ADR-0008-schema-naming-and-consolidation.md) and the tests in `docs/coredata/entity-fields/13-naming-hazards.md`: a word may appear in several places only if it means the same thing in all of them. The conversation surface is therefore not called `agent`. `agent` already names an actor kind (the `Agent` CASL subject, `agent:<name>@<tenant>`, the reserved `agent` URL segment), and a section is where a User talks to an Agent. The roster is `plays` and not `agent_catalogue` for the same reason: the rows are plays, `agent` is a field **on** a play, and a name that leads with the association over the differentiating fact fails ADR-0008 law 5.

**The edits a kind requires.** Five places, each of which a reviewer can check: a Zod schema in `packages/shared/fields/src/specs/view.ts`, a resolver registered in `packages/tenant/core/src/views/registry.ts`, a `ResolvedSection` union member in `views/types.ts`, a case in `packages/shared/ui/src/components/views/section.tsx`, and both directions of the pairing guard in `apps/dpagentic/src/features/views/components/view-section.test.tsx`, which fails the build if either half is missing.

**Properties of every kind, whatever it draws.**

1. **The resolved shape is serializable and contains no query.** Three hosts render it: a page, a section of another view, and the assistant's answer. In the last, a model reads values and no pixels.
2. **A kind that fails to draw degrades in place, with a name.** `{ kind: 'unresolved', reason }` already exists for this. A section that vanishes looks like "there is nothing here". That claim is different, and wrong.

**Where content lives is part of the design.** `plays` resolves the filter and the host record; the roster itself comes from the play catalogue at render. A resolver that copied the catalogue into its payload would put a second copy of product configuration in the server package, free to disagree with the one the launcher reads. A play that became runnable would then have to be re-saved into every view that lists it.

## Loose ends

**Optimistic concurrency has no `version` column.** `configTable` provides `id`, `deletedAt`, `createdAt/By`, `updatedAt/By`, `tenant`, `fromTemplate`, `isManaged`, and no version (`packages/tenant/core/src/db/factory.ts:108`). The version-checked save in `04` is therefore a **compare-and-set on `updated_at`**. The client sends the `updatedAt` it read, `saveView` adds `where updated_at = $read`, and a zero-row update raises a named conflict, so no update is lost. A monotonic `version` column would also work, and one table does not justify its migration.

**Fork-on-drop needs no handle generation.** Handles are unique per owner, so Dana's fork of the shared `pipeline` is `pipeline` with `owner = dana`. The contract's shadowing rule already defines this, so no new mechanism is needed.

**C5 backfill.** Existing `view_defaults` rows store `principal` as `''` or a User id. On this branch the migration is drop-and-regenerate (POC posture). For an environment where drop-and-regenerate is not allowed, the mapping is `'' → ('tenant','')` and `<user> → ('user',<user>)`; it covers every row and needs no interpretation.

## Related reading

- `04-proposed-model.md`: the model these four extend, and corrections C1–C6, which come first.
- `07-widget-variant-explosion.md`: the variant space these bounds keep Neuro inside.
- `03-requirements-and-user-stories.md`: the non-goals each of these is tested against.
