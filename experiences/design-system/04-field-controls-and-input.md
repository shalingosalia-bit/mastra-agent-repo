# Field controls and the design system Input

Whether `@neuro/fields`' Display and Edit components render through the design system's primitives, and where the boundary between the two falls.

**Measured 2026-09-08 by static analysis against `@dealpath/ui-components` 2.4.0**, the version pinned in `packages/shared/ui/package.json:19` and installed at `packages/shared/ui/node_modules/@dealpath/ui-components/`. Every `index.d.ts:N` citation is against that install's `dist/index.d.ts`. The library publishes only `dist/`, so the measurements read the declaration file and the compiled bundle, not Bolide's source.

The other half of the question is DES-3, whose tech spec is `specs/architecture/dpfieldvalue-design-system-input-tech-spec.md` in `dealpath/dp-docs`, on the branch `dpfieldvalue-ds-input-tech-spec` (revised 2026-08-03, author Diego Bueno, not merged to `main`). Section references to it below are to that revision.

Nothing here is built by this document, and nothing in `ui-components` is fixed here.

## Decision

1. **Neuro's field controls render through the design system's primitives.** `packages/shared/fields/src/react/components.tsx` replaces its hand-written `<input>`, `<textarea>`, `<select>` and `<span>` elements, and the local `INPUT_CLS` string at `components.tsx:23`, with `Input`, `InputGroup`, `ComboboxV2`, `Checkbox` and `Calendar` imported from `@neuro/ui`.
2. **The seam is the one Bolide already draws, and a Neuro descriptor sits on Neuro's side of it.** The package holds domain-free presentation; the consuming app holds the domain wrapper. A descriptor's `Display`/`Edit` pair is that wrapper — it knows the field's type, its settings, its display hints and its parse contract, none of which the design system knows or wants.
3. **The two field-control layers do not merge into one component.** Sunspear's `FieldValue` cluster lives in sunspear, not in the published package, so there is nothing for Neuro to import and nothing to reconcile. The layers converge on the primitives, the size axis and the resting/editing frame contract.
4. **`@neuro/fields` takes a dependency on `@neuro/ui`, behind the `./react` export only.** The root `.` export stays free of React and of `@neuro/ui`, and a test asserts it, so every non-UI consumer's dependency tree is unchanged at import time.
5. **A surface counts as adopted only when a design-system `data-testid` role suffix appears in its rendered DOM** — `-input`, `-input-group`, `-combobox-input`. This is DES-3's SC-1, adopted verbatim.
6. **Where a primitive has no counterpart, Neuro files a request on the DES tracker rather than building a local component.** The exception is a composition of primitives Bolide already ships, which is `@neuro/ui`-tier work. `03-ownership-and-contribution.md` holds the tier rule; the gap column below routes each case.
7. **Proposal — Neuro's descriptor model stays Neuro's, and is offered to DES rather than pushed upward.** The reversible default is no upward convergence: Neuro keeps the three-axis resolve, the `settings`/`display` split and the number round-trip, and records them here so DES can take any of them. Confirmed by: Diego Bueno (DES-3), Henderson Beck.

The decision that needed no person is 1 through 6. Only 7 is a cross-team commitment, and it is written as the default so no work waits on the conversation.

## Why the seam is already drawn

Bolide states it in its own declarations, in the `WidgetFields` docblock at `index.d.ts:1399-1402`:

> **The value is a slot.** The app passes its own `FieldValue`, which already owns formatting, links, the empty state, the data-source popover, the AI marker, permissions and click-to-edit — exactly as a table is passed into `WidgetTable` and a chart into `WidgetChart`.

`Input`'s `onCommit` docblock says the same thing from the other end, at `index.d.ts:858`: "Outside-click commits are owned by the FieldValue wrapper." The package assumes a consumer-side wrapper it does not ship, and no `FieldValue`, `FieldValueDisplay` or equivalent appears in its exports.

DES-3 §1.2 goal 2 states the boundary as a goal already met — domain-free primitives in the package, all domain logic in sunspear's wrapper. So the question "where is the seam" has one answer for both teams, and each team writes its own wrapper above it. Neuro's is the descriptor registry it already has.

Two of DES's own conclusions transfer directly and are worth adopting rather than re-deriving:

1. **A behaviour-faithful clone passes every criterion that does not name the components.** DES-3 §1.1 records that the first execution shipped a raw `<input>` with legacy styling, satisfied all four original success criteria, and left the design-system components consumed by nothing. Neuro's `components.tsx` is that shape today, arrived at independently — a hand-written input carrying Tailwind utilities against Bolide's tokens. Decision 5 is the criterion that a clone cannot satisfy.
2. **Display is the larger surface, and it shares the edit frame.** DES-3 §5 alternative 3 rejects adopting edit only. The `ghost` variant exists so a field's resting and editing states are the same frame, swapping the inner control rather than the box, which is what stops a row changing height on click.

## Per-type mapping

Neuro's field types are the `PrimitiveType` union at `packages/shared/fields/src/descriptor.ts:19-28`, and the controls are the `fieldComponents` registry at `components.tsx:391-405`. `rich_text` shares `text`'s Edit component (`components.tsx:393`).

| Neuro field type | Control today | Bolide 2.4.0 counterpart | Gap |
| --- | --- | --- | --- |
| `text` | `<input type="text">`, or `<textarea>` when `settings.multiline` (`components.tsx:78-104`) | `Input type="text"`; multiline needs `InputGroup` + `InputGroupTextarea`, since no standalone `Textarea` is exported | None |
| `rich_text` | Shares `TextEdit`; Display renders the formatted string (`components.tsx:106-108`) | No editor of any kind. `InputGroup` frames one; nothing fills it | **No counterpart.** Request to DES. Display can use `Input variant="ghost"` over the descriptor's `plainText` (`descriptor.ts:122`) meanwhile |
| `number` | `<input type="number" step="any" inputMode="decimal">` (`components.tsx:172-184`) | `Input type="number"`, which resolves to `<input type="text" inputMode="decimal">`. Prefix and suffix map to `InputGroupAddon align="inline-start"` / `"inline-end"` + `InputGroupText` | None for the control. The resolution drops the native spinner and `step` — see the call-site surprises below |
| `date` | `<input type="date">` over an ISO `YYYY-MM-DD` slice (`components.tsx:193-206`) | `Input type="date"` matches today's behaviour exactly. `Calendar` and `Popover` are both exported but no composite joins them | **No date picker.** `03-ownership-and-contribution.md`'s tier table names a date picker as Bolide-tier, so this is a request to DES, not a local composition. `date` settings also carry `granularity: day \| month \| year` (`specs/settings.ts:77-85`), and a month-only or year-only picker has no counterpart either |
| `boolean` | `<input type="checkbox">` (`components.tsx:220-231`) | `Checkbox`. `Switch` is the alternative where the field reads as a toggle | None. `InputType` excludes `"checkbox"`, so a boolean does not go through `Input` |
| `select` | `<select>`, with `multiple` when `settings.multi` (`components.tsx:244-286`) | `ComboboxV2`, plus `ComboboxV2Chips` / `Chip` / `ChipsInput` for multi. `RadioGroup` for a small closed single-select | No colour affordance. A `SelectOption` carries `color` (`specs/settings.ts:113`) and `ComboboxV2ItemType`'s only visual slot is `icon?: ReactNode` (`index.d.ts:463-470`), so a coloured option is composed by the consumer |
| `entity_ref` | Comma-separated ids in a text input, marked a minimal POC control (`components.tsx:294-318`) | `ComboboxV2` | No typed loading state or spinner slot for remote options. The larger gap is Neuro's own: an entity read surface to populate the list |
| `principal_ref` | The same text-input shape as `entity_ref`, deliberately (`components.tsx:326-352`) | `ComboboxV2`, with `Avatar` in an item's `icon` slot for a person row | No person-picker composite. Sunspear's contact family reaches the same primitive (DES-13), so the composition is duplicated work worth comparing before either team builds it |
| `location` | Text input over `value.address`, discarding `lat` and `lng` from the stored `{address, lat, lng}` (`components.tsx:373-386`) | `Input type="text"` for the address line; `InputGroup` frames a multi-part control | **No address autocomplete**, and no multi-part composite. DES-3 §2.1 delegates address to the legacy modal editor rather than porting it, so DES has not built it either |
| Every type's Display | `DisplayShell` renders a `<span>` with prefix, suffix and an em-dash empty state (`components.tsx:50-70`) | `Input variant="ghost"` is the resting treatment; `WidgetField` supplies the label/value row and its own em-dash `emptyText` (`index.d.ts:1415-1438`) | None |

`Combobox` is the wrong export to reach for. `index.d.ts:455-461` carries the declaration file's only `@deprecated` tag, on `Combobox`, directing consumers to `ComboboxV2`; DES-3 §3 item 3 says the same. This supersedes `02-bolide-fitness.md` finding 8 item 1, which proposed deprecating one of the two APIs as work still to do.

## Call-site surprises in this layer

Each of these compiles and renders differently from the element it replaces, which is why they belong beside the mapping rather than in a component's own documentation. They extend `02-bolide-fitness.md` finding 4 with the ones specific to field controls.

| Primitive | The surprise | Evidence |
| --- | --- | --- |
| `Input` | `type="number"` renders `<input type="text" inputMode="decimal">`. No native spinner, no `step`, no browser numeric validation — the descriptor's `parse` and `validate` are the only numeric guard | `dist/index.js`, `resolveInputType` |
| `Input`, `InputGroupInput` | `onCommit(value, reason)` hands back a **string**. A currency field's raw value is `{amount, currency}` (`components.tsx:159-166`), so a commit handler that forwards `onCommit`'s string loses the currency and lets the next write default a EUR value to USD | `index.d.ts:849-850`, `components.tsx:139-166` |
| `Input`, `InputGroup`, `ComboboxV2Input` | `size` is a shared axis across all three, and `extra-small` is the 26px dense field editor. A control that omits it renders at a different height from its neighbour | `index.d.ts:532-534`, DES-3 §3.1 |
| `Field` and its parts | Layout only. No `htmlFor` wiring between `FieldLabel` and its control, and no `error`, `invalid` or `required` prop — the label association is the caller's | `index.d.ts:783-827` |
| `ComboboxV2List` | `children` is a required render prop, `(item, index) => ReactNode`, and the list is virtualized. `ComboboxV2Item` needs an explicit `index` or keyboard navigation does not work | `index.d.ts:546-558`, `:615-639` |
| Every `Field*`, `Input*`, `ComboboxV2*` except the root and `Collection` | `data-testid` is required by the type, and each element appends its own suffix | `index.d.ts:805`, `:877`, `:481`; `02-bolide-fitness.md` finding 3 |
| Subcomponents | Flat exports, never dot notation. `Field.Label`, `InputGroup.Addon` and `Combobox.Trigger` do not typecheck; the names are `FieldLabel`, `InputGroupAddon`, `ComboboxV2Trigger` | `index.d.ts:1543` — the single export statement |

## What the fields package depends on

The written record permits the import and one document already directs it. `docs/reference/poc/01-decisions.md:36` states that `@neuro/fields`' "React Edit/Display components compose `@neuro/ui` primitives" while "`@neuro/ui` stays domain-free" — the same one-way direction decision 2 restates. That document is history (`docs/README.md` marks the POC set as subsumed), so decision 4 renews it rather than relying on it.

Nothing forbids it, and nothing enforces a rule about it either:

| Check | Result |
| --- | --- |
| `docs/codebase-map.md` tiers | Silent. `fields` and `ui` are on the same line of the same tier (`codebase-map.md:16-17`), and the placement rules at `:39-69` are all cross-tier or cross-plane. No sentence permits or forbids one `packages/shared/*` package importing another |
| `turbo boundaries` | No `boundaries` key in the root `turbo.json`, no `tags` in any package's `turbo.json`, no `boundaries.json`. The gate (`package.json:47`, `.github/workflows/ci.yml:182`) enforces only its defaults: an import must be declared in the importer's `package.json`, and no relative imports across packages |
| `biome.json` | `@neuro/ui` appears in no `noRestrictedImports` pattern. The `packages/shared/**` override at `biome.json:283-325` restricts five `@neuro/control-*` and `@neuro/core/*` specifier groups and nothing else |
| Precedent | None. No package under `packages/` declares `@neuro/ui` today — only `apps/dpagentic`, `apps/control-ui` and `apps/design-system`. `@neuro/fields` would be the first |

So the cost is real but it is not a tier violation, and three claims of purity become inaccurate and need editing in the same change: `packages/shared/README.md:11` ("No database, no React"), `packages/shared/fields/README.md:3`, and the comment at `components.tsx:18` ("pulls in no UI dep").

What the dependency actually costs:

1. **The client boundary is already paid.** `@neuro/ui` is one module with no `'use client'` and six top-level `createContext` calls (`02-bolide-fitness.md` finding 2), so importing anything from it makes the call site a client boundary. Both product consumers of `@neuro/fields/react` already declare `'use client'` — `apps/dpagentic/src/features/entity/components/entity-detail.tsx:1` and `apps/dpagentic/src/features/agent/agent-panel.tsx:1`. No current consumer changes.
2. **Import-time isolation holds; install-time does not.** Every other consumer of `@neuro/fields` imports the root `.` export, which is what the separate `./react` entry point exists for (`packages/shared/fields/README.md:5`). A `dependencies` entry is graph-wide, so `bun install` places `@dealpath/ui-components` in `@neuro/fields`' tree regardless of which export reaches it.
3. **No test can render the result.** The repo has no DOM harness — no jsdom, no happy-dom, no testing-library in any `package.json` — and `packages/shared/fields/src/react/components.test.ts` imports pure helpers only. A migration of `components.tsx` would ship with the Storybook and Chromatic as its only visual coverage. Decision 5's test-id assertion is checkable in an Artillery browser test, and that is the automated coverage worth adding with the work.
4. **The visual dependency exists already.** `packages/shared/ui/src/styles/sources.css:33` adds `@neuro/fields`' React tree to `@neuro/ui`'s Tailwind scan list, guarded by `packages/shared/ui/src/styles/styles.test.ts:112`, and `INPUT_CLS` is written against `@neuro/ui`'s semantic tokens. Only the package declaration is missing.

## The wrapper's props

ADR-0008 moved presentation out of the per-type settings blob: `field_definitions.params` became `settings`, and the universal presentation hints were hoisted into a `field_definitions.display` column of their own (`ADR-0008-schema-naming-and-consolidation.md:40,42`). `packages/shared/fields/src/specs/display.ts:5-18` states the boundary as a test — removing a `display` attribute changes only rendering, while a `settings` attribute constrains which values are legal or participates in computation — and `specs/specs.test.ts:242-246` asserts that every settings schema rejects an embedded `presentation` block.

The component props predate that split. `FieldDisplayProps` and `FieldEditProps` take one opaque `params` (`react/types.ts:32-48`), and `presentationOf` reads `params.presentation` (`react/types.ts:26-29`) — the key the settings schemas now reject. So the wrapper contract has to carry two arguments, `settings` and `display`, matching the two columns. GRO-265 is the defect in the current behaviour and is out of scope here; the two-argument shape is a constraint on whatever renders through Bolide, either way GRO-265 is fixed.

`display` maps onto the primitives directly: `prefix` and `suffix` to `InputGroupAddon` + `InputGroupText`, `placeholder` to the input's own, `help` to `FieldDescription` or a `Tooltip`, `null_label` to `WidgetField`'s `emptyText`, `alignment` to a class on the control. `scale` and `locale` stay inside the descriptor's `format`, because they change the string rather than the frame.

## What Neuro's model has that DES may want

Offered as decision 7's proposal, not pushed. Each is a mechanism Neuro built and DES's spec records a matching problem for.

1. **The three-axis resolve.** `resolve.ts:27-36` dispatches on the triple of primitive type, calculation kind and autofill kind, and derives `readOnly` rather than asking a caller for it: autofill wins, then a calculated field is the type descriptor read-only, then the type descriptor as an input. DES-3 §2.1 delegates the equivalent combinations — non-note autofill, and any aggregate or target-calculation field — back to the legacy editor verbatim, and §6 names keeping the two paths in step as the initiative's primary risk and its weakest control.
2. **Compile-time exhaustiveness.** `assertNever` (`descriptor.ts:45-47`) sits where a `default:` clause would, so adding a primitive fails the build at every switch that has not handled it.
3. **The `settings` / `display` split with a stated test.** `display.ts:5-18`. Sunspear has no equivalent boundary, and ADR-0008:127 records that legacy sets `alignment` on almost every field with nowhere for it to land.
4. **The number round-trip as a contract rather than an implementation detail.** `numberInputValue` and `numberEditEmit` (`components.tsx:128-166`) make a percent field show a hundredth of what it stores and a currency field carry its own code back, so a no-op edit round-trips to the same stored value. `onCommit`'s string signature cannot express the second half.
5. **`plainText` on the descriptor** (`descriptor.ts:122`) — the type owns how to strip its own markup, rather than each consumer hardcoding a stripper for one markup.
6. **`counts_as` on a select option** (`specs/settings.ts:135`) — which lifecycle class an option means, so completion and overdue math works against any tenant's status vocabulary. DES-2's workflow and milestone selectors need exactly this knowledge and take it from legacy status-progression rules instead.

## Requests to DES

One issue each, on the DES tracker, per `03-ownership-and-contribution.md`. None blocks decision 1 — every one of them has a Neuro control today that is no worse than what it replaces.

1. **A rich-text editor**, or a documented pattern for composing one inside an `InputGroup` ghost frame. DES-3 §2.1 composes Quill's `DpCommentBox` inside the frame and §1.2 makes rewriting it a non-goal, so the pattern exists in sunspear and is not published.
2. **A date picker** — `Calendar` plus `Popover` plus an `Input` anchor, with the month and year granularities. Bolide-tier by the tier table's own example.
3. **A colour or swatch slot on `ComboboxV2ItemType`**, or a documented composition, for a select option's authored colour.
4. **A typed loading state on `ComboboxV2`** for remotely-loaded options, so an entity or person picker does not hand-roll one.
5. **Address input.** Neither team has it; both need it. Worth raising jointly rather than as a Neuro request.

`02-bolide-fitness.md` item 8 already routes the deprecated-`Combobox` cleanup; nothing further is needed there now that the deprecation is in the types.

## Not verified

No browser, no running app, no rendered page, and no designer was available. Nothing below was attempted, and no visual or accessibility result is claimed anywhere in this document.

1. **Every visual claim.** How a `ghost` frame reads at rest, whether the focus reveal fires, whether the three sizes render at the heights DES-3 §3.1 computes, and whether a Bolide control looks right in a Neuro grid cell. The size metrics are read from the spec and the cva comment, not measured.
2. **Accessibility.** `Field`'s missing label wiring is a fact about its types; whether any composition Neuro builds on top is accessible is a separate question that needs the a11y panel on a story.
3. **Narrow-column text wrapping.** DES-2 item 4 left the truncation strategy open pending design, and DES-3 §8 open question 4 still defers the contact display frame for the same reason. Neuro's `principal_ref` and `location` controls land in the same narrow columns and inherit that open question.
4. **Whether `ComboboxV2` can express a "create new option" row.** Nothing in Bolide's types or base-ui's combobox types names `creatable`, `onCreate` or an equivalent. Free text is typeable via `inputValue`; nothing converts it into an option. A footer render is the escape hatch, and it was not built or tested here.
5. **DES's intent beyond what is written.** DES-3 §8 leaves which surface adopts first unowned and the dual-path exit condition unset. Whether DES wants any of the model above, and whether the sequencing in decision 7 suits them, needs the conversation decision 7 names.
6. **Whether the six server components that import `Skeleton` from `@neuro/ui` render at request time.** The build half is answered — `02-bolide-fitness.md` § "The six `Skeleton` importers" records that `apps/dpagentic`' production build completes with those imports in place, because the library declares its JavaScript side-effect-free and the unused re-export is dropped. A rendered response is still unverified, and it is that half which bounds the blast radius of decision 4: adding `@neuro/ui` to `@neuro/fields` does not by itself change those six, since the drop depends on nothing from the re-export being used, and `@neuro/fields`' root export would still use none of it.
7. **Bundle cost.** No measurement of what the primitives add to a page that already ships the hand-written controls.
8. **React peer range.** `@dealpath/ui-components`' `package.json` declares a `^18.0.0` React peer while the workspace runs React 19.2. Nothing has failed on it, and no compatibility test was run.

## Related

- `02-bolide-fitness.md` — where the library fits and where it does not, and the findings this document extends
- `03-ownership-and-contribution.md` — the tier rule that routes each gap, and the proposal pattern decision 7 follows
- `design-rules.md` — where the call-site surprises above belong once the work starts
- `../../coredata/entity-fields/ADR-0008-schema-naming-and-consolidation.md` — the `settings` / `display` split the wrapper's props have to carry
- `packages/shared/fields/README.md` — the package's purity claim, which decision 4 amends
