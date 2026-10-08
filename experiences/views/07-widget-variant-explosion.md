# The widget variant explosion: what "thousands of variants" means

It settles where legacy's "thousands of variants" come from, for a Builder deciding what a Neuro view or section may configure. The design-system lead cut InfoView and reporting widgets from the Bolide extraction because of them. The count comes from axes that multiply, and the widget kinds number only dozens.

The lead's stated reason: *"there are thousands of variants to info view widgets and reporting widgets."*

Sources: the legacy schema, data and Sunspear source; §Reproducibility has the queries.

**The claim is accurate, and it counts variants of each kind.** There are 28 section categories and ~31 widget components: dozens. The thousands come from the widgets being **layout-and-style engines Users compose**, so the variant space is a product of axes. A design system can tokenize a Button and has no way to tokenize a spreadsheet a User authored with per-cell styling. Bolide therefore provides the primitives (Button, Dialog, Table…) and stops where User composition begins.

## Where the variants come from

### 1. Per-section styling switches (the visible multiplier)

Every `info_view_sections` row stores its own presentation state, independent of what the widget shows:

| Axis | Values |
|---|---|
| `category` | 28 distinct |
| `view_type` per category | renderings like `row`/`list`/`tile`, `bar_vertical`/`bar_horizontal`/`pie`, `sale_comps` — 32 observed (category, view_type) pairs in the dev DB |
| Boolean styling | `shaded`, `special_row`, `parens_neg_values`, `show_border_outside/top/bottom`, `show_values`, `show_name`, `maintain_title_spacing` — 9 flags = 512 states |
| Numeric/enum styling | `label_size`, `table_row_height`, `color_id`, `is_page_break`, free-form `metadata` JSON |

32 pairs × 512 boolean states is **~16,000 visual states before the numeric axes**, and a designer would have to certify each rendering. The dev DB shows 62 distinct combinations in use across 5,700 live sections. Production, with real Tenants, is where "thousands" is observed as well as possible.

### 2. `custom_table`: the unbounded one

The second-most-used section category (12 uses on the evaluation Tenant alone) is a **spreadsheet Users build**, and no widget. Its satellite tables:

- `info_view_section_columns`: columns a User defines, each with a `grid_column_size`
- `info_view_section_rows`: rows a User defines
- `info_view_section_cells`: a field reference *or a literal value* per cell (893 cells in the dev DB)
- `info_view_section_styles`: a **per-element style record**, polymorphically attachable (`klass_type`): background colour, font colour, bold, italic, underline, strikethrough, text alignment

Per cell, that is palette² × 2⁴ decorations × 3 alignments. Each `custom_table` section is a one-off design artifact. For this category "thousands" is an undercount: the space is *unbounded*, because Users do document layout in it.

### 3. Reporting widgets — configuration as a product

The reporting side multiplies through query-and-presentation configuration:

| Axis | Values |
|---|---|
| `filter_views.view_type` | **49** distinct (each effectively a bespoke rendering context) |
| `filter_view_options.option_type` | **37** per-view toggles/settings — `show_subtotal`, `subtotal_location`, `show_variance_column`, `show_benchmark_line_options`, `underline_formulas`, `use_alternate_shading`, `highlight_critical_dates`, `map_view_zoom`… |
| `filter_view_columns.column_type` | 18 (plus `calculation` × 6, `interval_mode`, `weighted_by`) |
| `filter_view_groups.group_type` | 7, up to two levels, with interval modes |
| chart types | 10 |

Counting only the boolean options, one reporting view's configuration space runs to millions, and the dev DB alone has 2,340 saved `filter_views`. Every combination is a page a User may see and a rendering someone must keep correct.

### Why the styling exists: InfoViews are documents

The print-shaped columns (`is_page_break`, `label_size`, `parens_neg_values`) serve print. The InfoView toolbar exports to **PDF and Excel** (`InfoViewToolbarButtons.tsx` wires `ExportSettingsPdf`/`ExportSettingsExcel`; `persisted_info_view_options` has 119 saved export configurations in dev). An InfoView is the IC memo and the lender package. Every styling toggle is therefore a word-processor feature, and the variant space is the space of documents Users write. A component library has no way to own that space, so the design system cut it.

## What this means for Neuro's UI surface

The variant explosion supports two decisions the view model has made, and it narrows three open items:

**Already answered by the model:**

- **Kinds with bounded hints.** A section is a typed kind with a typed spec; presentation is a bounded hint (`table`/`cards`/`list`, chart kind). Neuro's equivalent variant space is kinds × hints: dozens, certifiable, tokenizable. Bolide-style tokens can therefore govern the whole surface, which legacy's design system could not do.
- **Styling belongs to the field descriptor** (`06-legacy-view-inventory.md`, gap 7). `parens_neg_values`, `color_negative_nums`, `underline_formulas` are per-section in legacy, so the same number renders differently two sections apart. In Neuro a negative number renders the way its descriptor says, everywhere.

**Narrowed by the variant counts:**

1. **`custom_table` needs a bounded answer, with no port.** The demand behind it is real: "arrange these fields in a labelled matrix". The per-cell style engine generated the unbounded space. Neuro's answer is a `matrix`/`fields-grid` section kind: rows and columns of field references a User chooses, typography from tokens, zero per-cell styling. When a Tenant's migrated `custom_table` contains literals and cell colours, the literals migrate as markdown and the colours do not. The migration states that, as the option-mapping decisions do, and drops nothing unreported.
2. **Print/export is a separate surface.** `is_page_break` and the export toolbar mean legacy Users *publish* record pages. Neuro has no print story yet. When it comes, it should be a render target of the same resolved composition (a print stylesheet + pagination over resolved sections), never a second layout system. Once print has its own configuration, the variant explosion starts again.
3. **A handful of reporting options encode meaning as styling.** `show_variance_column`, `show_benchmark_line_options`, `highlight_critical_dates` encode *comparisons and thresholds*, and no look. They belong in the view and measure model eventually (variance as a measure kind; thresholds as field semantics). Legacy reached 37 option types by storing such options as booleans.

## Reproducibility

Schema and counts from the legacy dev MySQL (`mysql -u dealpath dealpath`): `describe info_view_sections` and satellites; distinct-combination counts use `count(distinct concat_ws(…, coalesce(…)))` because `COUNT(DISTINCT a,b,…)` drops NULL tuples without a warning. Component inventory and export wiring from sunspear `origin/major` (`app/components/InfoView/**`, InfoViewWidgets = 9,626 LOC excluding tests). Dev-DB observed counts understate production; the schema-derived spaces do not depend on data volume.

## Related reading

- `01-legacy-pitfalls.md` P1/P4: the dispatch and state pitfalls that end in this explosion.
- `06-legacy-view-inventory.md`: the per-capability gap analysis this extends.
- `../design-system/ADR-0009-bolide-token-adoption.md`: why Bolide could adopt tokens repo-wide while legacy's design system had to cut the widgets.
