# The filter bar surface

The presentational half of the stack, stated here and nowhere else in it (`00-filters.md` §Status). It renders the list state as chips, a picker, a column picker and a view menu, from plain serialisable props, and consumes `@neuro/filters`'s pure functions and `views/`'s resolved shapes. It does not fetch, resolve a tenant, import `@neuro/core`, or apply a business rule: the container in `apps/dpagentic`, today the view surface and the two pages that render it (`apps/dpagentic/src/surfaces/view-surface.tsx:35`, `apps/dpagentic/src/app/(shell)/v/[handle]/page.tsx:22`, `apps/dpagentic/src/app/(shell)/e/[type]/page.tsx:18`), decodes the address, resolves the view, runs the query, and passes the results down. None of the components below exists yet. Each is required to render in a story with no database (`../../spec-stack-template.md` §Component kind), in `apps/design-system/src/stories/` beside the existing ones.

The components are composed from `@neuro/ui`'s existing menu, popover, combobox and badge components. Read a component's real props in [`../design-system/design-rules.md`](../design-system/design-rules.md) before writing a call site; the menu there is generated from the package's exports, and a name in it is a component this surface must not hand-write.

## Components

| Component | Renders | Consumes |
|---|---|---|
| `FilterBar` | The chips in order, an add affordance, the advanced affordance, a clear-all affordance, the withheld notice, and the focus chip first | `Chip[]` from `toChips`, `Withheld[]`, the focus label |
| `FilterChip` | One condition as field, comparison and value, removable; or the withheld form; or the removed-field form; or the advanced form | one `Chip` |
| `FilterPicker` | Field, then comparison, then value, in one popover; disabled fields listed with their reason | the field surface, `operatorsFor`, `presetsFor`, the field descriptors' edit controls |
| `ColumnPicker` | The ordered column list with show, hide and reorder | `columns`, the field surface, the withheld set |
| `ViewMenu` | The view's name with its modified mark, the axes that moved, the verbs the actor may take, the default and favourite controls, and which rule chose the view | the view, `diffListState`'s axes, `verbsFor`'s verbs, the resolver's `from` |
| `WithheldNotice` | `N conditions not applied` with the withheld chips' labels on expansion | `Withheld[]` |

The value editor inside `FilterPicker` is the field descriptor's own edit control, the one the record page and the grid already use (`../../reference/legacy_assessments/current-state/10.2-configurable-field-presentation.md:116`). A date offers the presets from `presetsFor` above its calendar; a principal field offers `me` above its people list while `principalToken` is on (`05-interface-and-configuration.md` §Feature toggles); a select offers its options.

## Props

The four groups a data-transformation `05` has collapse to two here: the props, slots and callbacks below are the whole interface, and the design tokens the components read come from [`../design-system/`](../design-system/00-design-system-reference.md). The operator-tunable and tenant-scoped groups are empty: a threshold in a component is a business rule in the presentational half. The one rendering budget is stated as a prop.

### `FilterBar`

| Prop | What it does | Default | Type | Required | If set wrong |
|---|---|---|---|---|---|
| `chips` | The conditions to show | none | `Chip[]` | no | `[]` → the empty state, an add affordance and nothing else; absent → the loading skeleton, which is why the prop is optional |
| `withheld` | The conditions not applied for this viewer | `[]` | `Withheld[]` | no | non-empty with `chips` empty → the notice alone, which is a legitimate state for a viewer who may read none of the view's fields |
| `focus` | The workspace focus chip's label | none | string | no | absent → no focus chip; present → a chip with a clear affordance and no edit (FV17) |
| `onRemove` | What happens when a chip's remove affordance is used | none | callback | no | absent → chips render without a remove affordance, which the read-only host in a chat card wants |
| `onAdd`, `onAdvanced`, `onClearAll` | Open the picker, open the builder, remove every chip | none | callbacks | no | absent → the affordance is not drawn |
| `maxVisibleChips` | How many chips are drawn before the rest collapse behind a count | 8 | integer | no | `0` → every chip collapses and the bar shows only a count, which looks broken; negative → treated as `0` |

### `FilterChip`

| Prop | What it does | Default | Type | Required | If set wrong |
|---|---|---|---|---|---|
| `chip` | The condition to draw | none | `Chip` | yes | `kind: 'withheld'` → the field label and the word `withheld`, no comparison, no value, no edit (FV29); `kind: 'removed'` → the label `condition removed`; `kind: 'advanced'` → one chip reading `advanced filter` that opens the builder |
| `onRemove`, `onEdit` | The chip's two affordances | none | callbacks | no | `onEdit` is ignored for a withheld or removed chip (FV30) |

### `FilterPicker`

| Prop | What it does | Default | Type | Required | If set wrong |
|---|---|---|---|---|---|
| `fields` | The fields to offer, with their primitive and whether the projection promoted them | none | field surface | yes | `[]` → the empty state naming the type; a field with `hot: false` is listed disabled with the reason and, for an administrator, the promotion path (FV3) |
| `operatorsFor`, `presetsFor` | The catalogue | the package's | functions | no | a catalogue offering a comparison the executor drops breaks FV2, so the prop exists for stories and never for a call site |
| `initial` | A condition to edit | none | `FieldCondition \| EdgeCondition` | no | absent → a new condition |
| `onCommit`, `onCancel` | Return the condition, or nothing | none | callbacks | yes | — |

### `ColumnPicker`

| Prop | What it does | Default | Type | Required | If set wrong |
|---|---|---|---|---|---|
| `columns` | The ordered handles the list shows, as the container resolved them: the view's columns, or the projection's promoted columns where the view has none (`04-proposed-model.md` §The list state) | none | `string[]` | yes | `[]` → every field listed unchecked and the grid draws no column, so the container never passes it; it resolves the effective list first |
| `fields` | Every field of the type, to offer | none | field surface | yes | — |
| `withheld` | Handles the viewer's plan withholds | `[]` | `string[]` | no | a withheld handle stays in `columns`, is drawn checked and disabled, and its cells read `withheld` (FV16) |
| `onChange` | The new ordered list | none | callback | yes | — |

### `ViewMenu`

| Prop | What it does | Default | Type | Required | If set wrong |
|---|---|---|---|---|---|
| `view` | The view the list started from: name, scope, owner label, managed flag | none | resolved view summary | no | absent → the menu shows `Unsaved list` and the save verb alone, which is why the prop is optional |
| `modifiedAxes` | Which axes differ from the saved view | `[]` | `Axis[]` | no | non-empty → the modified mark on the name and one line per axis (FV14) |
| `verbs` | The verbs the actor may take, from `verbsFor` | none | `Verb[]` | yes | `[]` → the name alone, which is the state for a viewer role over a managed view |
| `from` | Which rule chose this view: `personal`, `group:<name>`, `workspace`, `tenant`, `managed`, `synthesized` | none | string | no | absent → the line is not drawn; present → `Opened because: <rule>` (FV26) |
| `onVerb` | Runs a verb; the confirmation for publish, delete and make-default names who is affected | none | callback | yes | — |

## States every data surface owes a reader

| State | `FilterBar` | `ViewMenu` |
|---|---|---|
| Loading | a skeleton of two chip widths | the name greyed |
| Empty | the add affordance and `No filters` | `Unsaved list` |
| Error | the decode failure's reason and a `Open without filters` affordance (FV12) | — |
| Withheld | the notice and the withheld chips | — |
| Conflict | — | `Changed by someone else since you opened it`, with reload and save-as-copy (FV19) |
| Removed field | the `condition removed` chip and the notice | — |

## What this surface must not do

1. **Compute a predicate.** It receives chips and returns conditions; `toPredicate` runs in the container.
2. **Decide which verbs to offer.** `verbsFor` does, from the rules `04-proposed-model.md` states, and the menu draws its answer.
3. **Read the plan.** The withheld set is a prop. A component that consulted the plan would be a second enforcement point.
4. **Keep state of its own across a navigation.** The address is the state; a component's local state is the open popover and nothing that survives it.
5. **Apply a per-column filter that does not appear as a chip.** The grid's own column menu writes into the same list state, and the bar draws the result. A filter set from a header that the bar does not show is the second store `02-best-practice-research.md` warns against.
