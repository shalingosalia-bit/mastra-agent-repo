# Interface and configuration points

## Package identity and boundary

`@neuro/filters` is a proposed data-transformation package; nothing exists under `packages/shared/filters` today. It belongs in that directory, the plane-neutral tier, because it reads no connection string and no plane-specific table (`packages/shared/CLAUDE.md`). It exports the filter model and the comparison catalogue, the value tokens, the list state with its address codec and its diff, the partition of a query by a readable set, and the chips a bar draws. Every export is a pure function over plain values. It does not compile a predicate (the search reads in `@neuro/core` do), write a view (`saveView` does), decide who may read a field (access plans do), resolve which view a list opens with (`resolveViewDefault` does), or draw anything (`07-filter-bar-surface.md`'s components do, in `@neuro/ui` and `apps/dpagentic`).

## Public surface

| Export | Kind | Shape |
|---|---|---|
| `operatorsFor` | pure function | `(primitive) → CatalogueEntry[]`, each `{ op, label, valueForm, grammar }` per `04-proposed-model.md` §The comparison catalogue |
| `presetsFor` | pure function | `('date') → Preset[]`, each `{ label, token }` |
| `toPredicate` | pure function | `(model, { fields }) → Predicate` |
| `fromPredicate` | pure function | `(predicate, { fields }) → FilterModel` |
| `toChips` | pure function | `(model, { fields, readable, locale }) → Chip[]` |
| `encodeListState` | pure function | `(state) → string`, the value of the `s` parameter |
| `decodeListState` | pure function | `(params, { maxBytes, bounds }) → ListState \| DecodeFailure` |
| `diffListState` | pure function | `(savedDefinition, state) → Axis[]`, a subset of `filter, sort, columns, groupBy, display, search` |
| `partitionByPlan` | pure function | `(spec, readable) → { applied: spec, withheld: Withheld[] }`; takes the stored definition shape and converts through `fromPredicate` and `toPredicate` inside (`04-proposed-model.md` §The executor contract) |
| `verbsFor` | pure function | `(view, actor, diff) → Verb[]`, the lifecycle verbs the menu offers, from the rules `04-proposed-model.md` §The lifecycle states |
| `FilterModel`, `ListState`, `Chip`, `Token`, `Withheld` | types | the shapes `04-proposed-model.md` states |

`toChips` takes the readable set so that a chip over a field outside it is produced as `{ kind: 'withheld', field }` with no comparison and no value (FV29). `decodeListState` returns a failure value and never throws: an address is untrusted input, and the page draws the bare view with the failure's reason (FV12). `encodeListState` takes no ceiling: the caller measures its output against `listStateMaxBytes` before writing the address, and declines the edit with a notice when it would exceed it (`04-proposed-model.md` §The list state).

## Ports

This package has no ports. Every collaborator is a plain argument: the field surface, the readable set, the locale, the bounds. A port here would be a database, a plan lookup or a clock, and each of those belongs to the caller that already has it. The one caller proposed is the view surface in `apps/dpagentic` (`apps/dpagentic/src/surfaces/view-surface.tsx:35`), which has all four in hand from the request. The viewer's today is no argument here: the compiler resolves it for `within` and `before_today`.

## Configuration arguments

### Instantiation-time

None. The catalogue, the presets and the codec are module constants, and the package is constructed nowhere. This is stated so a reader does not look for a factory.

### Operator-tunable

A threshold someone will reasonably change without a deploy. Each lives in [`packages/shared/settings`](../../../packages/shared/settings) and is read by the caller at the moment of use and passed in, because the package reads no settings.

| Setting | What it does | Default | Type | Settings key | If set wrong |
|---|---|---|---|---|---|
| `listStateMaxBytes` | The longest a list's encoded state may be in an address. Past this an edit is declined and a pasted link opens the bare view, so a link somebody pastes fits in a browser, a chat message and a proxy log at every value the setting accepts | 2048 | integer, accepted from 256 to 4096 through `integerSetting` (`packages/shared/settings/src/index.ts:94`), which rejects a value outside the range and never clamps | `filters.list_state_max_bytes` | Below 256, including `0`, or above 4096 → `integerSetting` throws `SettingError` and the caller receives a configuration error. No fallback applies: the fallback covers an unset key only. The upper bound is there because the shortest common browser and proxy limit is about 8,000 bytes and the path, `view`, `mode`, `q` and `focus` need the rest |
| predicate bounds | How deep, how wide and how many conditions one filter may have | as `@neuro/core`'s `predicateBounds` declares | `PredicateBounds` | the existing keys | Owned by the predicate engine (`packages/shared/fields/src/predicate/ast.ts:172-182`) and stated here only because `decodeListState` receives them. A browser reads no settings and bounds its editor by `DEFAULT_PREDICATE_BOUNDS` |

### Tenant-scoped

None from this package. The two tenant facts it depends on arrive from their owners: the starter views a provisioned tenant opens with are the `view` dataset kind (`packages/tooling/dataset/src/kinds/view.ts`), always shared and managed, and the week start and quarter alignment a calendar window token reads are the tenant's date defaults ([`../branding/`](../branding/00-branding.md)).

### Per-call

Arguments on the functions, listed to mark them as not configuration. A value that varies per request must never also be readable from settings.

| Argument | Function | What it is |
|---|---|---|
| `fields` | `toPredicate`, `fromPredicate`, `toChips` | The list type's field surface: handle, primitive, label, and whether the projection promoted it |
| `readable` | `toChips`, `partitionByPlan` | The handles the viewer's plan admits, from the same plan the query runs under |
| `locale` | `toChips` | The reader's locale, for the chip's value formatting |
| `today` | none here; the compiler's | The viewer's today, which the compiler already resolves for `within` and `before_today` |
| `maxBytes`, `bounds` | `decodeListState` | The two limits above, read by the caller |

## Feature toggles

Behaviour gated on a decision or a dependency that has not landed, so the gap is a flag and never a redesign.

| Toggle | What it does | Default | Gates | Blocked on |
|---|---|---|---|---|
| `relatedSubjectFilters` | Whether a person may filter a list by a field on a related record, such as deals whose fund is named Growth | off | offering related fields in the picker; `saveView` accepting a leaf with a `subject` | The related-subject read layer. `assertNoRelatedSubject` states that it reads this setting when the layer arrives (`packages/shared/fields/src/predicate/fields-of.ts:104-107`) |
| `principalToken` | Whether "me" is offered as a value on a principal field | off | the token in the picker and in `toPredicate` | The grammar amendment `04-proposed-model.md` §Value tokens asks for, in both compilers and the evaluator |
| `calendarWindows` | Whether "this month", "last quarter" and their kin are offered beside day counts | off | the unit-and-offset window token | The `within` amendment in the same section, and the tenant date defaults from `branding/` |
| `multiKeySort` | Whether a second sort key is offered | off | more than one entry in `state.spec.sort` | The keyset cursor packing every sort value, and `toSort` returning every key (`packages/tenant/grid/src/ssrm.ts:181`) |

Each toggle names what it is blocked on. With a toggle off the surface offers nothing the executor drops, which is FV2 held while the dependency is missing.

## Extension points

| Point | Kind | Cost of a new member |
|---|---|---|
| A comparison on a primitive | closed union per primitive | A compiler case in `predicate-sql.ts` and the projection read model, a catalogue row with its chip wording and value form, a `fromPredicate` case, and a generated round-trip case (FV10) |
| A value token | closed union | A grammar amendment in `ast.ts`, a binding in both compilers and the evaluator, a catalogue entry, and a review, because a token is a value the plan never sees |
| A date preset | open list in the package | One `{ label, token }` row and its translations. No storage changes, because the token is what is stored |
| An axis of the list state | closed, the `query` definition's own fields | A field on `queryViewDefinitionSchema` first, then the codec, the diff and the surface; nothing here adds an axis the definition does not have |

## What is deliberately not configurable

1. **The authorable depth.** Two levels is the whole chip model. A tenant wanting three writes a predicate in the builder and gets one advanced chip.
2. **Blank semantics.** Exclude, include and only mean one thing everywhere, and a per-tenant meaning reintroduces the legacy defect as an option (`01-legacy-pitfalls.md` §3).
3. **Which comparisons a tenant sees.** The catalogue is the set the executor honours for the primitive, and hiding a comparison per tenant is a second catalogue to keep in step.
4. **The address parameter.** `s`, `view`, `mode`, `q` and `focus` are the contract every link ever pasted depends on.
5. **Whether a withheld condition is applied.** It is never applied. A flag that applied it would turn a shared view into the oracle the guard closes.
6. **Where the state is kept.** In the address, and nowhere on the server (`04-proposed-model.md` §What this module must not do, 5).
