# The reference surface

What a Builder or an agent can find in `apps/design-system` today, which component families it does not cover, and how to ask for what is missing.

The reference is the Storybook in `apps/design-system` plus the MCP endpoint its dev server exposes. `00-design-system-reference.md` covers what the app is and how to run it; this document covers what is *in* it, which is the part that changes as stories land.

**Measured 2026-09-08 against `@dealpath/ui-components` 2.4.0**, the version pinned in `packages/shared/ui/package.json`. The component menu it is measured against is the generated block in `design-rules.md`. Every claim below comes from the declaration file, the published bundle, the token sheet, or a compiler run — nothing here was checked in a browser, and the limits that follow from that are in "What needs a person".

## What the reference covers

Each family below has at least one story, imported from `@neuro/ui` — the specifier the products use. No story declares its own copy of a component.

| Family | Where | What the stories show |
| --- | --- | --- |
| `Accordion` | Library/Navigation | Single with collapsible, multiple open at once, and the `dropdown-menu` variant |
| `Alert` | Library/Bolide, Library/AI surfaces | The default, and `variant="ai"` beside neutral and warning |
| `Avatar` | Library/Surfaces | Five sizes, the muted fallback, presence, the active ring |
| `Badge` | Library/Bolide | All seven variants, and the count clamp `variant="number"` applies |
| `Breadcrumb` | Library/Navigation | Link, active link, page, separator, collapsed ellipsis |
| `Button` | Library/Bolide | Variants, `isLoading`, disabled, and `ButtonGroup` in both orientations |
| `Calendar` | Library/Overlays | Single selection on a fixed month, and the same picker inside a popover |
| `Card` | Library/Surfaces | Every slot: header, title, description, action, content, footer |
| `Checkbox` | Library/Bolide, Library/Fields and inputs | Labelled, and as a `Field` row |
| `Command` | Library/Overlays | A palette with groups and keyboard shortcuts, and the no-results state |
| `DropdownMenu` | Library/Overlays | Open and non-modal, with its portal hosted inside the story |
| `Empty` | Library/Surfaces | With primary and secondary actions, and the `icon` variant |
| `Field` | Library/Fields and inputs | A titled set of rows, the error state, the disabled state |
| `HoverCard` | Library/Overlays | The trigger only — the note under the next table says why the open state is not shown |
| `Input` | Library/Bolide, Library/Fields and inputs, Library/AI surfaces | Plain, inside an `InputGroup` at three sizes, and `variant="suggested"` |
| `Item` | Library/Surfaces | Rows with media and actions, the five variants, the hover-revealed action |
| `Kbd` | Library/Overlays | Key groups, and inside a `CommandShortcut` |
| `Label` | Library/Bolide, Library/Fields and inputs | Associated with its control by `htmlFor` |
| `LoadingDashboardEmptyState` | Library/Surfaces | With a progress percentage |
| `NotificationsIcon` | Library/Surfaces | With a count |
| `Popover` | Library/Overlays | Open, with header, description and footer, portal hosted in the story |
| `PortalContainerContext` | Library/Overlays | The host component every open-overlay story uses |
| `RadioGroup` | Library/Fields and inputs | The `primary` control, and the `box` variant with title and description |
| `ScrollArea` | Library/Surfaces | A list long enough to scroll |
| `Separator` | Library/Bolide | Under the data table |
| `Skeleton` | Library/Surfaces | Four shapes. Neuro's own component, marked as having no Bolide design |
| `Spinner` | Library/Bolide | Alongside the other feedback primitives |
| `Switch` | Library/Bolide | Labelled |
| `Table` | Library/Bolide | Header, body, rows, cells |
| `Tabs` | Library/Navigation | Composed triggers with a counter and a disabled tab, the three `TabsList` variants, and the declarative `TabsGroup` |
| `Tooltip` | Library/Bolide | Portalled, under React 19 |
| `Widget` | Library/Widget | Populated rows, empty rows, loading, empty, authoring, a scrolling body, a media body |

## Families with no story

| Family | Why not | What would change it |
| --- | --- | --- |
| `Combobox` | Two complete APIs — `Combobox*` and `ComboboxV2*` — and either needs a data model and typed input before it shows anything | `@neuro/fields`' Edit controls are routed onto `ComboboxV2` in `04-field-controls-and-input.md`; the story belongs with that work, against the real option shapes |
| `Dialog` | Modal. An always-open dialog covers the documentation page it sits on, and a closed one shows a button | An interaction-driven story, or a pair of images. **Used in the tenant product today and unstoried** |
| `Drawer`, `DockedDrawerContent` | Same overlay problem, plus a full-height layout | Same. **Both used in the tenant product today** (`apps/dpagentic/src/features/agent/components/assistant-drawer.tsx`) |
| `ScrollBar` | `ScrollArea` composes it with the viewport and the corner already, so it renders in that story without being called there | A story only when a surface hand-composes a scroller |
| `Sidebar` | Needs `SidebarProvider` and a full-height shell; the app chrome that would use it is not extracted | The extraction in `01-component-extraction.md` (GRO-266) |
| `SvgGradient`, `SvgIcon` | Both take an icon component as a prop, and no icon set is a dependency of `apps/design-system` — Bolide imports Phosphor internally and exports none of it | Adding an icon dependency to the reference app, which is a decision rather than a story |
| `Toaster` | A toast appears in response to an imperative `toast()` call, so a static story renders an empty region | An interaction-driven story |

`HoverCard` has a story, but a closed one. Its content renders in `HoverCardPrimitive.Portal` with no `container`, so — unlike `PopoverContent`, `DropdownMenuContent` and `ComboboxContent`, which all read `PortalContainerContext` — it cannot be brought inside the story's own subtree. The Storybook's theme class lives on that subtree (`.storybook/preview.tsx`), so an open hover card would render light tokens under the dark theme and misreport the component.

## Two rules the stories follow

1. **One story per state, not one story with arguments.** A reader choosing between a populated widget, a loading one and an empty one needs to see all three; a control that flips between them shows one and hides the rest. `Layout.mdx` names the four states a data surface owes a reader.
2. **`data-testid` goes where the type asks for it, and nowhere else.** Some components drop unknown props rather than spreading them — `Item` passes through only `asChild`, `children`, `className`, `role`, `size` and `variant` — so an id passed to one of those never reaches the DOM, and a test written against it would select nothing.

## Decision: an unshowable family is recorded, not given a story

A family that cannot be rendered honestly gets a row in the table above rather than a story its author cannot check.

The reference is where a claim gets copied. An agent reading it treats a story as the way to call a component, so a story that renders an overlay in the wrong theme, or asserts a state nobody has seen, is worse than an absence — the absence sends the reader to `design-rules.md`'s generated menu, which is measured from the exports and is right. That is why the table above names the reason for each gap: "no story" and "no component" have to be distinguishable from each other, and only one of them is a reason to write something new.

## Requesting a component

`03-ownership-and-contribution.md` owns this and is not restated here: it decides the tier first, because the tier decides where the request goes and who builds it, and it lists what a request needs. The Overview page in the Storybook now points at it, so a Builder who searched the Library section and found nothing has the next step in front of them rather than in a document they have not opened.

The one rule worth repeating, because it is the failure the whole arrangement exists to prevent: do not build a local copy of something you have asked another team for.

## Findings from writing the stories

Each was found by calling a component against its real types, and each is evidence for a change somewhere other than this document.

| # | Finding | Where it lands |
| --- | --- | --- |
| 1 | The generated menu's dagger set is incomplete: `Calendar`, `FieldLabel` and every `Command*` part require `data-testid` and carry no dagger | Neuro-side, in `packages/shared/ui/src/inventory/testid.ts` |
| 2 | `InputGroupInput` narrows `type` exactly as `Input` does, so the search-input escape hatch in `02-bolide-fitness.md` finding 4 does not exist on the exported component | Correct `02-bolide-fitness.md` |
| 3 | `ItemActions`' `revealOnHover` hides its action from keyboard users entirely | Send to DES |
| 4 | Bolide's sparkle is not exported, so the AI "running" mark is reachable only through `WidgetHeader` | Send to DES |
| 5 | `--ai-sparkle-static` is read by nothing | Neuro-side decision: drop it, or leave it pending an exported sparkle |
| 6 | `HoverCardContent` ignores `PortalContainerContext` while three other portalled surfaces honour it | Send to DES |

### 1. The dagger set is incomplete, and the cause is module resolution

`design-rules.md`'s menu marks a component with † when `inventory/testid.ts` measures its props type as requiring `data-testid`. The walk cannot distinguish "not required" from "could not tell", and treats both as not required — `testid.ts:86` skips an export whenever the property is absent from the props type, including when that type is `any`.

| Outcome | Count |
| --- | --- |
| Required — daggered | 58 |
| Optional | 1 |
| Skipped, props type fully resolved — genuinely not required | 81 |
| **Skipped, props type involves `any` — answer unknown** | **68** |

So the wrong-answer set is up to 68 exports, not a handful. Confirmed required among them by compiler probe, each reported as `TS2741` or `TS2322` when the prop is omitted in a file inside `apps/design-system`: `Checkbox`, `ButtonGroupSeparator`, `Calendar`, `FieldLabel`, and every `Command*` part. `AccordionItem`, `Label`, `Switch`, `Separator`, `RadioGroup`, `ScrollArea` and the `Dialog*`, `Drawer*`, `DropdownMenu*`, `Popover*`, `Tooltip*`, `Combobox*` and `ComboboxV2*` families are all in the unknown set and were not individually probed.

Measured by omitting the prop in a file inside `apps/design-system` and reading the compiler's errors — `TS2741: Property '"data-testid"' is missing … but required in type 'RequiredTestId$3'` for the `Command` parts and `RequiredTestId$2` for `FieldLabel`. `Calendar` is the one of the nine whose error names something else first, because `react-day-picker`'s selection props are a union: the compiler prints the whole expected type, which carries `"data-testid": string` non-optionally, and reports the union mismatch. The same run shows `Empty`, `HoverCard`, `Item`, `ItemContent`, `Kbd`, `KbdGroup`, `Popover`, `RadioGroup`, `RadioGroupItem`, `ScrollArea`, `Skeleton`, `Tabs`, `TabsList`, `TabsTrigger` and `TabsContent` accepting no such prop, so the split is real rather than a blanket requirement.

The cause is verified, not inferred. `testIdSplit` builds a one-file program over the vendored `dist/index.d.ts`, and module resolution from inside `dist/` does not reach the primitive packages that declaration imports — so those exports' first parameter resolves to `any`, and a property query on `any` returns nothing:

```bash
# prints: Command => any, FieldLabel => any, Calendar => any, Field => FieldProps, Empty => EmptyProps
bun -e '
import * as ts from "./packages/shared/ui/node_modules/typescript/lib/typescript.js"
import { BOLIDE_DTS } from "./packages/shared/ui/src/inventory/testid.ts"
const program = ts.createProgram([BOLIDE_DTS], { noEmit: true, skipLibCheck: true, strict: true,
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ESNext })
const checker = program.getTypeChecker()
const mod = checker.getSymbolAtLocation(program.getSourceFile(BOLIDE_DTS))
for (const name of ["Command", "FieldLabel", "Calendar", "Field", "Empty"]) {
  const sym = checker.getExportsOfModule(mod).find((s) => s.getName() === name)
  const d = sym.declarations[0]
  const p = checker.getTypeOfSymbolAtLocation(sym, d).getCallSignatures()[0].getParameters()[0]
  console.log(name, "=>", checker.typeToString(checker.getTypeOfSymbolAtLocation(p, p.valueDeclaration ?? p.declarations[0])))
}'
```

So the dagger is trustworthy where it appears and uninformative where it does not, which makes the 58 in `02-bolide-fitness.md` finding 3 a lower bound rather than the number. A fix resolves the declaration file inside a program that can see the primitive packages — the app's own `tsconfig.json` resolves them, which is how the omission above was measured — and `inventory.test.ts` then pins the corrected set.

**Proposal: file this on GRO as a Task against `@neuro/ui` rather than fixing it here.** It changes a generated block in `design-rules.md` and the test that guards it, which is a different review from adding stories. Until it lands, a Builder reads the types and an agent asks the MCP endpoint. Confirmed by: whoever picks up the GRO Task.

### 2. There is no search-input escape hatch

`02-bolide-fitness.md` finding 4 says `InputGroupInput` takes the unrestricted HTML `type`, citing `dist/index.d.ts:874`. That line declares the *inner* `InputGroupInput$1`. The exported wrapper re-narrows it:

```text
InputGroupInputProps = Omit<React.ComponentProps<typeof InputGroupInput$1>, "type"> & RequiredTestId & { type?: InputType }
```

Measured the same way as finding 1: `<InputGroupInput data-testid="p" type="search" />` inside an `InputGroup` fails with `TS2322: Type '"search"' is not assignable to type 'InputType | undefined'`. So `search`, `email`, `tel`, `password` and `url` are unavailable through every exported input, and GRO-447's decision to leave `search-box.tsx` hand-written stands on a firmer reason than the accessibility-tree change that document gives.

**Proposal: correct the sentence in `02-bolide-fitness.md` and add the unrestricted `type` to the DES request already recorded there.** Confirmed by: whoever owns that document's next revision.

### 3. A hover-only action is unreachable by keyboard

`ItemActions`' `revealOnHover` compiles to `invisible group-hover/item:visible`. There is no focus counterpart, and `visibility: hidden` removes the element from the tab order, so a keyboard-only user cannot reach the action at all. `WidgetHeader`'s equivalent does not have the problem — `actionsVisibility="hover"` pairs `opacity-0 group-hover/widget:opacity-100` with `focus-within:opacity-100`, and its source comment says why.

Read from the bundle rather than a browser. The a11y panel would not catch it either: axe checks the rendered tree, not what becomes reachable on hover.

**Proposal: send to DES, with `WidgetHeader` named as the fix already in the same package.** Confirmed by: Henderson Beck, per `03-ownership-and-contribution.md`'s routing for a property of the library.

### 4 and 5. The AI mark, and a token nothing reads

`WidgetHeader`'s `aiSparkle` renders Bolide's `AiSparkle` internally, fixed to the `miniActive` variant. `AiSparkle` itself is not exported, so the blue-gradient, grey-gradient and at-rest variants are unreachable — including from `TabItem.leadingIcon`, whose own type comment suggests putting one there. The AI surfaces rule that a run is marked on the specific thing being computed therefore has no component behind it outside a widget header.

The mark that *is* reachable reads `hsl(var(--blue))`, not an `--ai-*` token. Of the sparkle family, the bundle reads `--ai-sparkle-blue-start`, `--ai-sparkle-gray-start` and `--ai-sparkle-mini-static` from the unexported variants, and reads `--ai-sparkle-static` nowhere:

```bash
DIST=packages/shared/ui/node_modules/@dealpath/ui-components/dist
grep -n 'ai-sparkle-static' $DIST/index.css   # one line, its definition — no utility class reads it
grep -c 'ai-sparkle-static' $DIST/index.js    # 0
grep -rn 'ai-sparkle-static' apps/*/src packages/*/*/src   # its definition in the sheet, prose, one parser test
```

So it is defined on both sides of the adoption and read by neither the bundle nor a compiled utility.

**Proposal: ask DES to export the sparkle, and leave `--ai-sparkle-static` in the sheet until they answer.** Dropping a token is a departure from the adopted sheet under ADR-0009, and adopting a value nothing reads costs nothing while an exported sparkle would need it. Confirmed by: Henderson Beck for the export; whoever bumps `@dealpath/ui-components` for the token, since a bump is when the sheet is re-synced.

### 6. One portalled surface out of four ignores the container

`PopoverContent`, `DropdownMenuContent` and `ComboboxContent` each read `PortalContainerContext` and pass `container: portalContainer ?? undefined` to their primitive's portal. `HoverCardContent` does not. A consumer rendering a hover card inside a themed subtree, a modal, or any container it needs the overlay to stay within has no way to say so.

**Proposal: send to DES as a one-line consistency fix.** Confirmed by: Henderson Beck.

## The accessibility sweep

**Run 2026-09-08 over every story in both themes. It does not pass.** GRO-451's BR-2 — the accessibility addon passes on each new story, or the story states why not — is not met, and this section is the "states why not".

Method, so it can be re-run: axe-core 4.13.0 against `#storybook-root` in each story's isolated frame, `http://localhost:6007/iframe.html?id=<id>&viewMode=story&globals=theme:<light|dark>`, driven by Playwright. The story list is the `type: "story"` entries of `storybook-static/index.json`, which is what `bun run --filter @neuro/design-system build` writes. Nothing in the repository does this automatically: `.storybook/preview.tsx` sets `a11y: { test: 'todo' }` and the app's `test` script is `bun test src` with no Storybook test runner, so the addon's panel exists only in a browser.

| | Count |
| --- | --- |
| Story/theme combinations scanned | 118 (59 stories × 2 themes) |
| Clean | 89 |
| With at least one violation | 29 |

By rule: `color-contrast` 15, `aria-required-children` 6, `scrollable-region-focusable` 4, `aria-dialog-name` 4, `aria-valid-attr-value` 2.

**One violation was the story's own and is fixed.** `InputGroupSizes` rendered three `InputGroupInput`s with no accessible name, reported as `label` at critical impact in both themes. `InputGroupAddon` + `InputGroupText` renders text that reads as a label and is not one — it carries no `htmlFor`, and the library declares `aria-labelledby` nowhere in its bundle. The story now passes `aria-label`, and re-running the sweep removed exactly those two rows and no others, 87 clean to 89.

**Every remaining violation is a property of the library, not of a story.** Each was attributed by reading the failing node's `target` and HTML rather than by assuming.

| Rule | Where | What it is |
| --- | --- | --- |
| `color-contrast` | `Input variant="suggested"` | `--ai-auto-complete` on white measures **1.67:1**, against the 4.5:1 AA needs. This is the treatment for text an agent is suggesting — content a reader is meant to read and decide on |
| `color-contrast` | `Alert variant="ai"`, and any `text-muted-foreground` on an AI surface | `--muted-foreground` on `--ai-background` measures 4.36:1. Bolide's own `AlertDescription` uses that pair inside its `ai` variant, and a Neuro composition that follows the same rule inherits it |
| `color-contrast` | `Badge variant="destructive"` and `variant="number"` | 4.35:1 and 3.46:1, in **both** themes |
| `color-contrast` | `Avatar` fallback | 2.51:1 in dark, across every size. Seven nodes in dark against one in light, so this is a dark-theme regression rather than a uniform miss |
| `color-contrast` | `Item` variants, `Kbd`, `Breadcrumb`, inactive `TabsTrigger` | An inactive tab measures 3.79:1 |
| `aria-required-children` | `CommandList`, `ItemGroup` | `CommandList` holds a `[role=separator]` child its role disallows; `ItemGroup` sets `role="list"` and `Item` renders a `button` into it |
| `aria-dialog-name` | `PopoverContent` | It sets `role="dialog"` and has no accessible name. The library ships `PopoverTitle` and never wires it: `aria-labelledby` appears **zero times** in the published bundle, so a consumer using the header and title components exactly as intended still produces an unnamed dialog |
| `scrollable-region-focusable` | `ScrollArea`, and `WidgetBody scroll` | The Radix viewport scrolls and is not focusable, so its content is unreachable by keyboard |
| `aria-valid-attr-value` | `TabsTrigger` | `aria-controls` points at panel content that is unmounted while the tab is inactive |

This is the review `02-bolide-fitness.md`'s "Not verified" item 1 asked for — every component in both colour schemes — and the answer is that the library's contrast is not clean in either, and is worse in dark.

**Proposal: send all of it to DES as one report, and do not work around any of it locally.** Each is a property of a published component or of an adopted token, so a local override would diverge the two themes for one consumer and hide the defect from everyone else. The two worth naming first are `--ai-auto-complete` at 1.67:1, because it is unreadable rather than marginal, and `aria-dialog-name`, because the fix is inside a component the library already ships. Confirmed by: Henderson Beck, per `03-ownership-and-contribution.md`'s routing for a property of the library.

## What needs a person

| Item | Reversible default | Confirmed by |
| --- | --- | --- |
| Whether the nine library findings above are accepted as filed, and in what order | Proposal: one DES report carrying the sweep's method so they can re-run it, rather than nine issues | Henderson Beck |
| Whether any of them blocks adoption of the affected component in the product | **Not assessed.** The sweep says the component fails a rule; whether a Neuro surface using it is therefore unusable is a product judgment nobody has made | Whoever reviews GRO-451 |
| Everything the sweep cannot see | axe checks the rendered tree. It does not see what becomes reachable on hover — finding 3 above is invisible to it — nor keyboard traversal order, focus visibility, or whether a colour that passes contrast is the *right* colour | Same reviewer |
| The four DES-side findings above | Proposal: file each on the DES tracker with the evidence in this document | Henderson Beck |
| The two Neuro-side findings above | Proposal: one GRO Task for the dagger measurement, one edit to `02-bolide-fitness.md` | Whoever picks them up |
| A stable URL and the Chromatic project | Already tracked in `00-design-system-reference.md` and GRO-267; neither is code and nothing here changes them | As recorded there |
| The product's own components | The entity grid, the view sections and the agent cards still live in `apps/dpagentic` and cannot render in isolation. `01-component-extraction.md` (GRO-266) is the plan; this document covers what is showable without it | As recorded there |

## Related

- `design-rules.md` — the rules and the generated component menu, which is the authority on what exists
- `03-ownership-and-contribution.md` — the tier rule, the request path, and the bar at which a component is finished
- `02-bolide-fitness.md` — where the library fights how Neuro builds, and the adoption gap these stories close
- `00-design-system-reference.md` — the app itself: what it renders, how to run it, what is left to provision
- `01-component-extraction.md` — the plan for the app-local components no story can reach yet
- `apps/design-system/src/stories/README.md` — the conventions for adding a story
