# InfoView and InfoBox

It settles how the legacy words InfoView and InfoBox map onto Neuro's compositions and sections, for a Builder or designer working on a record page. It also decides what a box owns, what it must leave out, and whether the record page becomes a composition. The four questions come from `GRO-448`, and `GRO-449` needs the answers before it draws anything.

Sources: `04-proposed-model.md` for the pieces of a record page, which it leaves unnamed; sunspear's InfoView components for the legacy names and implementation.

## Today

1. **Legacy has the words.** In sunspear a record page is an InfoView: `InfoView → InfoViewPanel → InfoViewSection → {Row, Column, Cell}`, about 92 components. Users and designers both talk this way.
2. **Neuro has the pieces.** A composition is an ordered list of typed sections (`packages/shared/fields/src/specs/view.ts`); one registry resolves them and one exhaustive switch draws them (`packages/shared/ui/src/components/views/section.tsx`). Nothing is called an InfoView or an InfoBox.
3. **The design system already ships the box.** Bolide 2.4.0 exports `Widget`, `WidgetHeader`, `WidgetBody`, `WidgetFooter`, `WidgetEmpty`, `WidgetSkeleton`, `WidgetFields`, `WidgetField`, `WidgetMedia` and `WidgetDragHandle`, and describes `Widget` as "the opinionated widget shell that info views, dashboards and listings render".
4. **Neuro draws its own box twice.** `SectionView` draws `rounded-lg border bg-background` plus a header; `apps/dpagentic/src/features/entity/components/entity-detail.tsx` draws `rounded-lg border` plus a header, over its own layout walk, outside the section registry entirely.

So one idea has two vocabularies and two implementations.

## Decision 1 — the mapping, and which words are ours

**InfoView and InfoBox are reader-facing words. `composition` and `section` stay the words in the code and in the stored spec.**

| Reader says | Neuro means | Where it lives |
|---|---|---|
| **InfoView** | a resolved composition rendered at `ViewHost = 'page'` — a `layout` in the context of one record, or a `dashboard` in Tenant context | `resolveComposition` + the page |
| **InfoBox** | one section of that composition, drawn in the `Widget` shell | one member of the `sections` union + one `case` in `SectionView` |

The two vocabularies drifted through a second code noun for a thing that already had one. So we do not introduce `InfoBox` as a type, component or spec key. The pair is recorded so a designer's "InfoBox" and an engineer's "section" are known to be the same object.

**Where the correspondence to legacy stops:**

- **`InfoViewPanel` has no Neuro equivalent.** Column grouping is `placement` (dashboard) or `column` (layout), a coordinate on the section itself. Neuro has no panel object to configure or to style.
- **`Row` / `Column` / `Cell` inside a section do not port.** That is `custom_table`, the per-cell style engine that `07-widget-variant-explosion.md` found unbounded. Its bounded answer is the `matrix` section kind, already built: User-named axes, field references only, no literals and no per-cell styling.

## Decision 2 — what a box owns

Every concern is driven by exactly one of three things. "Spec" means it is stored and shared between Users; "component" means it is derived at render from resolved data; "viewer" means it is a per-User preference that never enters a shared spec.

| Concern | Driven by | Notes |
|---|---|---|
| Title | **spec** | `section.label`, already stored. `WidgetHeader`'s `title`. |
| Count | **component** | Derived from the resolved shape (`total`, `truncated`), never stored. Only `related` and `nearby` resolve a total; every other kind renders no count. Goes in `WidgetHeader`'s `aside`. |
| Actions | **component / host** | Supplied by the surface, never by the spec. A per-instance action menu in the stored spec is the first step back into legacy's option space. `WidgetHeader`'s `actions`, `actionsVisibility="hover"` for reading and `"always"` for an authoring surface. |
| Collapse | **viewer** | Browser-local, keyed by view identity plus section `id`. A stored spec is shared between Users (`04`, audience model), so a collapse written there would collapse a section for eleven colleagues. Not available in the version we consume — see *The collapse gap* below. |
| Empty state | **component** | `WidgetEmpty`, with copy owned by the kind (`No properties linked here`). Not `WidgetField`'s `emptyText`, which is for an empty *value*. |
| Loading state | **component** | `WidgetSkeleton`. There is no per-section loading state today: `resolveComposition` resolves every section in one `Promise.all` and the page paints after the slowest. The skeleton becomes reachable only when sections move to per-section `Suspense`, on the trigger `04` already states — when a single section's p95 exceeds the rest of the page. Until then the shell renders it in Storybook and nowhere else. |
| AI treatment | **host** | `WidgetHeader`'s `aiSparkle`, set from the render host and the resolved origin, never stored. An Agent-emitted view that a reader pins through `saveView` becomes an ordinary view: the sparkle marks *this answer came from the Agent*, not *this view was once authored by one*. |
| Footer link | **component** | `WidgetFooter`'s `link`, derived — today the "see all" a truncated `related` section already renders inline. |
| Withheld values | **component** | A redacted cell stays `withheld` in the value slot, not an em dash. `WidgetField`'s empty placeholder means "nobody filled this in"; conflating the two tells a reader there is nothing there when the truth is that they may not see it. Same wording as `entity-detail.tsx` uses today. |

## Decision 3 — what a box may not carry

**No per-instance presentation enters the stored spec.** `07-widget-variant-explosion.md` counted where that ends: 32 (category, view_type) pairs × 512 boolean styling states ≈ 16,000 certifiable renderings before the numeric axes, plus an unbounded per-cell style space in `custom_table`. Naming the box re-opens the question of per-instance presentation.

Legacy axes this model leaves out, and where each need goes:

| Legacy axis | Where it lives in Neuro |
|---|---|
| `shaded`, `color_id`, `show_border_outside/top/bottom` | Nowhere. The shell has one appearance, from tokens. |
| `label_size`, `table_row_height` | Nowhere. Typography and density are the design system's. |
| `parens_neg_values`, `color_negative_nums`, `underline_formulas` | The field descriptor. A negative number renders the same way on every surface (`06-legacy-view-inventory.md`, gap 7). |
| `show_name` / `maintain_title_spacing` | Nowhere. `WidgetHeader`'s `titleHidden` exists for legacy's hidden-name widgets; Neuro sections always show their label, so we do not pass it. |
| `is_page_break` | `breakBefore`, the one render hint the model allows — attached by the registry so no kind can forget it. It stays the only one. |
| `view_type` per category | The kind's own bounded hint (`display: 'table' \| 'cards' \| 'list'`, chart kind). Adding a value is a deliberate edit to the union. |

The one exception that is not a style: `WidgetBody`'s sizing props are structural, and they are chosen by the *host*, not stored. See the mapping below.

## Decision 4 — the record page

**Yes: the record page becomes a composition of sections, and `entity-detail.tsx` stops walking its own layout.** Two box implementations drift apart, as legacy's did.

The change is outside `GRO-449`, because **a `fields` section is read-only and the record page is editable.** `SectionView` renders a `<dl>` of display values; `entity-detail.tsx` renders `FieldEdit` islands wired to `saveFieldAction`, with optimistic overrides, a live settle watch and a `calculating…` state for derived fields. Converging without keeping that behaviour would remove a feature.

The path to an editable section is short. `WidgetFields` takes the value as a **slot**. Bolide's own documentation says the consumer passes its own field component, which owns formatting, permissions and click-to-edit. `WidgetField` reserves an `actions` slot for a per-row control. So the sequence is:

1. `GRO-449` — view sections render through the shell. No behaviour change to the record page.
2. A new story — the `fields` section kind gains an editable cell, reusing `entity-detail.tsx`'s submit/settle machinery behind the resolved-section seam.
3. A new story — the record page renders `resolveComposition` output through `SectionView`, and `entity-detail.tsx`'s own box and layout walk are deleted.

Until step 3 is merged, `entity-detail.tsx` adopts the shell in step 1's PR so both surfaces share the box while they keep two layout paths.

## Answers to the three open questions

1. **Workspace.** An InfoBox is not workspace-dependent. `chrome.mode` decides the frame *around* a page; how a section is drawn is the same in Classic, in Agentic, and for a Principal provisioned to neither. There is no `chrome.mode` branch in the shell.
2. **Collapse persistence.** Per viewer, browser-local, keyed by view identity plus section `id` (built: `normalizeTiles` fills an id on read for specs stored before it existed). Never in the stored spec, and no new table: collapse state does not sync across devices.
3. **Agent output.** An Agent answering with a view spec composes the same InfoBoxes through the same registry. `ViewHost = 'chat'` already means that. The `--ai-*` treatment and `aiSparkle` come from the host at render, so a pinned view has no permanent AI marking.

## Section-to-Widget mapping for GRO-449

For the implementer, and to keep two existing behaviours in `section.tsx`:

| Today in `section.tsx` | Becomes |
|---|---|
| `<section className="rounded-lg border bg-background">` | `<Widget data-testid={…}>` |
| `<header>` with label + count | `<WidgetHeader title={section.label} aside={count} />` |
| `<div className="p-3">` | `<WidgetBody>` |
| `fill` → `flex min-h-0 flex-1` + `overflow-auto` | `<WidgetBody scroll>` **only when `fill`** |
| not `fill` → no overflow at all | `<WidgetBody>` with no sizing prop |
| `fields` kind's `<dl>` | `<WidgetFields>` / `<WidgetField>` |
| `related`'s "see all" link | `<WidgetFooter link={…} />` |
| `data-testid={`section-${kind}-${slug(label)}`}` | unchanged — `Widget` requires a `data-testid` and appends its own suffix per element, so pass this as the base and expect derived ids on children |

**The print hazard remains after the move, and `WidgetBody` keeps the fix available.** `overflow` other than `visible` makes an element monolithic to CSS fragmentation, so a long table inside one does not break across printed pages. `print.css` guarantees that break. `WidgetBody`'s `scroll` sets exactly that overflow. Passing it unconditionally would reintroduce the bug that only a printed page reveals, so `scroll` is opt-in on the same condition `fill` is today: only a dashboard tile with a definite height.

## The collapse gap

**`Widget` in the version we consume has no collapse.** `@dealpath/ui-components` 2.4.0 is the latest published version, and its `WidgetHeader` props are `title`, `aiSparkle`, `info`, `leading`, `aside`, `actions`, `actionsVisibility` and `titleHidden` — no caret, no collapsed state, and no `Collapsible` export anywhere in the package. DES-39 and DES-76 are Done upstream, so the capability exists in the library's repository and has not been released.

Consequences:

- `GRO-449` ships without collapse. Every other behaviour in this document is available in 2.4.0.
- Collapse arrives with a dependency bump, not with app code. It needs a `type:task` to bump `@dealpath/ui-components` once a release carrying DES-39/DES-76 is published, plus the browser-local viewer state from Decision 2.
- This is the first concrete instance of the release-cadence question `GRO-446` (ownership and contribution model) has to answer: Neuro consumes a published package, so a merged DES component is not a usable one.

## Related reading

- `04-proposed-model.md` — the contract, the section registry, the audience model these decisions sit inside.
- `07-widget-variant-explosion.md` — the measured variant space Decision 3 refuses.
- `../design-system/00-design-system-reference.md`, `01-component-extraction.md` — the adoption programme this is part of.
- `../design-system/ADR-0009-bolide-token-adoption.md` — why the tokens arrived before the components.
- `packages/shared/ui/src/index.ts` — the seam, and the two call-site surprises (`data-testid` is required; several props are not the shadcn ones).
