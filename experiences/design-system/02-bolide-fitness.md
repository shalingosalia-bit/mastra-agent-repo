# Bolide component fitness

Where `@dealpath/ui-components` — the design system, nicknamed Bolide, published by the DES team — fits how Neuro builds, and where it does not.

**Reviewed against `@dealpath/ui-components` 2.4.0**, the version pinned in `packages/shared/ui/package.json`. Read every measurement below as being about that release. The library publishes only `dist/`, so the review reads the compiled bundle, the compiled stylesheet, and the declaration file — not Bolide's source.

**Measured 2026-09-08 by static analysis.** Every finding names the command or file it came from, so a reader can re-derive it. Nothing here was measured in a browser, which bounds what it can say: the sections marked **Not verified** are the ones that need a rendered page, and they are listed together at the end rather than left implicit.

## Findings

| # | Finding | Where it lands |
| --- | --- | --- |
| 1 | The published stylesheet is compiled `!important`, so a consumer cannot restyle a component with a colliding utility | Worked around locally; send to DES |
| 2 | The bundle carries no `'use client'` and six top-level `createContext` calls, so every call site is a client boundary | Absorbed; send to DES |
| 3 | `data-testid` is required on more components than this repo's own prose said | Absorbed, and now measured rather than stated |
| 4 | Props that differ from shadcn produce code that compiles and renders wrong | Absorbed into the rules file |
| 5 | Only Phosphor ships. The second icon set is a configuration waiting to be used, not a bundle cost | Neuro-side cleanup |
| 6 | The published bundle has no preflight and no resets, so two repo documents describe resets that are not there | Correct the two documents |
| 7 | The token sheet arrives twice and Neuro's copy wins silently, so an upstream token change is invisible | Neuro-side check |
| 8 | Simplification candidates: a duplicated combobox API, three legacy-shaped exports, four migration tokens | Send to DES as a proposal |

Nothing in `ui-components` is fixed here. That is DES's work on DES's tracker, and `03-ownership-and-contribution.md` decides where each of the above gets filed.

## 1. The stylesheet is compiled `!important`

`packages/shared/ui/src/styles/globals.css:20` imports `@dealpath/ui-components/dist/index.css`. That file's utility layer is compiled with Tailwind's `important` flag on, and its class names carry no prefix, so a Bolide utility beats a consumer's utility of the same name wherever the two collide.

Evidence, from the repo root:

```bash
CSS=packages/shared/ui/node_modules/@dealpath/ui-components/dist/index.css
grep -c '!important' $CSS                                          # 1397
grep -oE '^\s*\.[A-Za-z0-9\\:_-]+' $CSS | sort -u | wc -l           # 495 class selectors
grep -oE '^\s*\.[A-Za-z0-9\\:_-]+' $CSS | sort -u | grep -c 'tw\\:'  # 0 — no prefix
```

The consequence is recorded twice already, once on each side. Bolide's own `dist/theme.css` says the `important` modifier "prevents Radix from temporarily overriding animation-name via inline styles to measure content height", breaks `--radix-collapsible-content-height`, and ships a plain-CSS accordion animation as the workaround. On the Neuro side, `packages/shared/ui/src/styles/bolide-dark.css` needed both `!important` and `@layer utilities` to correct two colour literals, in three rules, because for important declarations cascade-layer precedence inverts and an unlayered important rule is the weakest, not the strongest.

Two facts follow from the mechanism and were **not** measured: an inline `style` attribute loses to an important declaration, so any Neuro code setting a property inline that a Bolide utility also sets on the same element is overridden; and a `className` override that `tailwind-merge` does not recognise as conflicting survives into the DOM and then loses in the cascade. Both need a rendered page to confirm.

**Recommendation.** Treat `bolide-dark.css` as the exception rather than the pattern, and pass a component's documented props instead of a colliding utility — this is in `design-rules.md` as a rule. Send the `important` flag to DES as a request: it exists for sunspear's legacy CSS, and a prefix on the published utilities would give Bolide the same protection without reaching into every consumer's cascade.

## 2. Every call site is a client boundary

The bundle contains no `'use client'` directive, and evaluates six `createContext` calls at module top level:

```bash
JS=packages/shared/ui/node_modules/@dealpath/ui-components/dist/index.js
grep -c 'use client' $JS                                           # 0
grep -nE '^var [A-Za-z0-9_$]+ = (React43__default\.|React43\.)?createContext' $JS
# 6 matches: PortalContainerContext, AccordionVariantContext, TruncationReportContext,
#            ComboboxV2ModelContext, DrawerContext, SidebarContext
```

Because `@neuro/ui` re-exports the library as one module, a Next.js server component that imports anything from `@neuro/ui` pulls that module into the server graph. It is the top-level `createContext`, not any component's hooks, that makes the module server-hostile — which is why the boundary cannot be avoided by picking a hook-free primitive.

`apps/dpagentic/src/features/entity/components/create-menu.tsx` records the arrangement Neuro settled on: the component is a client leaf and a server component renders it.

The cost is that a page wanting only static chrome from the library still ships a client component to get it. Neuro renders on the server by default, so this moves the boundary down to wherever a design-system component appears.

**Recommendation.** Absorbed — the client-leaf arrangement is in `design-rules.md`. Send to DES as a request for `'use client'` on the components that need it, or a subpath export map so a consumer can import one component without the whole module. Either would let a server component render a hook-free primitive.

## 3. `data-testid` is required on more components than the prose said

Required on **at least 58** exported components; optional on one (`PopoverViewAllButton`). `packages/shared/ui/src/index.ts` and this repo's other prose said 21, which was true of an earlier release.

**58 is a lower bound, not the count**, and the walk that produces it is what makes it one. `inventory/testid.ts` builds a one-file program over the vendored `dist/index.d.ts`, and module resolution from inside `dist/` does not reach the primitive packages that declaration imports — so those exports' first parameter resolves to `any`, and a property query on `any` returns nothing. The walk treats "could not tell" as "not required", so **68 exports have an unknown answer** rather than a measured one — the ones whose props type involves `any`, against 81 that resolve fully and genuinely do not need the prop. Confirmed as actually required among the unknown, by omitting the prop in a file inside `apps/design-system` (whose `tsconfig.json` does resolve those packages) and reading `TS2741` back: `Checkbox`, `ButtonGroupSeparator`, `Calendar`, `FieldLabel`, and every `Command*` part. So the dagger in `design-rules.md`'s menu is trustworthy where it appears and uninformative where it is absent. `06-reference-surface.md` finding 1 carries the diagnostic and proposes a GRO Task; until that lands, read the component's own types rather than the menu's dagger to decide whether an id is required.

The measurement is a type query, not a grep, and the difference matters: the declaration file spells the property in several shapes (inline object literals, `RequiredTestId` intersections, `Omit<…, 'ref'>` wrappers), so it holds 38 literal `"data-testid": string;` declarations against 58 exports that resolve to requiring it. `packages/shared/ui/src/inventory/testid.ts` reads it through the TypeScript compiler, and `inventory.test.ts` re-runs it on every suite.

Confirmed by effect as well as by the walk: a file rendering `<Button>go</Button>`, `<Badge badgeText="x" />` and `<Widget />` inside `packages/shared/ui` fails `tsc --noEmit` with TS2741 on each, naming `ButtonProps`, `Omit<BadgeProps, "ref">` and `RequiredTestId`. `<Alert>` and `<Dialog>` compile, matching their absence from the required set.

The suffix behaviour is unchanged: each rendered element appends its own, so `<Button data-testid="save">` yields `save-button`. Pass one base id per component.

**Does it help or hinder Neuro's Artillery browser tests?** It helps, and the requirement should stay. A test id that the type system will not let a Builder forget is the difference between a browser test selecting on a stable hook and selecting on a class name or a text string. The suffix convention is the part worth documenting rather than changing, because a test author who expects `save` and gets `save-button` reads it as a missing id.

**Recommendation.** Absorbed, with the walk itself still to fix. The number is generated into `design-rules.md` rather than written in a sentence, because a sentence is what went stale — but generating a wrong number is not better than writing one, so the resolution defect above is the open half. No DES issue either way: the walk is Neuro's.

## 4. Props that differ from shadcn

Each of these compiles and renders wrong, which is why they belong in a rules file rather than in a component's own documentation.

| Component | The surprise | Evidence |
| --- | --- | --- |
| `Badge` | Renders `badgeText`; **discards children** unless `asChild` is set. `badgeText` is required, so `<Badge badgeText="">3</Badge>` renders empty | `dist/index.js`, `Badge2`: `children: asChild ? children : <>…{getBadgeText()}…</>` |
| `Badge` | With `variant="number"`, the text is clamped: above 9 it renders `9+`, at 100 or above `99+` | `dist/index.js`, `getBadgeText()` |
| `Button` | Adds `isLoading`, which shadcn has no equivalent for | `dist/index.d.ts:80,84` |
| `Input`, `InputGroupInput` | `type` is narrowed to `"text" \| "number" \| "date"` on both. `type="search"` — and `email`, `tel`, `password`, `url` — do not typecheck, so a keyword box cannot be either of them | `dist/index.d.ts:848,856-857,887-888` |
| `Combobox` | Its own large API, and a second complete one (`ComboboxV2*`) beside it | see finding 8 |

The `Input` row has no escape hatch. `InputGroupInput` narrows `type` the same way — it omits the underlying element's `type` and re-adds it as `InputType` (`dist/index.d.ts:887-888`) — so `<InputGroupInput type="search">` fails with `TS2322: Type '"search"' is not assignable to type 'InputType'`, exactly as `Input` does. The library exports no way to render a search, email, tel, password or url input. GRO-447 left `apps/dpagentic/src/features/views/components/search-box.tsx` hand-written for that reason, and this is a request to DES rather than something a call site can work around.

Read the exported wrapper, not the internal one it wraps. `InputGroupInput$1` at `dist/index.d.ts:874` does take the unrestricted HTML `type`, and it is not what `@neuro/ui` re-exports. A `bun` run cannot tell the two apart, because bun strips types without checking them: a probe rendering `type="search"` through `InputGroupInput` emits `<input type="search">` and typechecks nowhere. `bunx tsc --noEmit` over the same file is what reports the error.

The repo's existing note said `Badge` "renders an empty span if you pass children instead". The refinement is that children are not ignored in every case — with `asChild` they are what renders — so the rule is about the default, and `packages/shared/ui/src/index.ts` now says so.

**Recommendation.** Absorbed into `design-rules.md`, which is the file an agent loads. No DES issue: a published component's props are its contract, and renaming them would break sunspear.

## 5. Only one icon set ships

The concern was two icon sets in one bundle. It is not the current state.

```bash
JS=packages/shared/ui/node_modules/@dealpath/ui-components/dist/index.js
grep -oE '@phosphor-icons/react/dist/ssr/[A-Za-z0-9]+' $JS | sort -u | wc -l              # 18
grep -rn lucide --include='*.ts' --include='*.tsx' apps packages | grep -v node_modules   # no imports
```

Bolide imports 18 Phosphor icons, all from the `dist/ssr/` entry points. No file under `apps/` or `packages/` imports `lucide-react` at all. What exists is the configuration that would produce the second set: `lucide-react` is a declared dependency of `@neuro/ui`, and `iconLibrary: "lucide"` is set in both `packages/shared/ui/components.json` and `apps/control-ui/components.json`, so the next `shadcn add` generates lucide imports into a component that sits beside Phosphor ones.

**Recommendation.** Neuro-side, and reversible either way. Setting `iconLibrary` to `phosphor` in both `components.json` files and dropping `lucide-react` from `@neuro/ui` makes the intended set the default one. Filed separately rather than done here — this document is a review. No DES issue.

## 6. The published bundle has no preflight and no resets

The concern was that Bolide ships its own resets, which could conflict under Neuro's preflight. The published stylesheet contains neither.

Its layers are `theme`, `base` (twice — the token block, and the accordion animation), `utilities`, and `properties`. Outside them the file holds `@keyframes` and `@property` declarations and exactly one rule, `.dp-svg-icon :is(path, circle, …)`, which is class-scoped. There is no `html`, `body`, or `*` element rule anywhere in the file — the only `*` selector is inside `@layer properties`, declaring `--tw-*` defaults.

```bash
CSS=packages/shared/ui/node_modules/@dealpath/ui-components/dist/index.css
grep -nE '^\s*(html|body|h1|p|ul|button|input|table|a|img|svg|\*)[ ,{]' $CSS
# one match, inside @layer properties, declaring --tw-* defaults
```

So Bolide's components rely on the **consumer's** preflight for border-box sizing and margin resets. Neuro leaves preflight on, so they get it, and the risk this finding was opened for does not exist. The inverse is now a constraint worth naming: if Neuro ever turned preflight off, Bolide's components would lose sizing they do not ship themselves.

Two repo documents describe resets that 2.4.0's published CSS does not contain:

1. `docs/experiences/design-system/ADR-0009-bolide-token-adoption.md`, decision 2 — "its components carry redundant-not-conflicting resets".
2. `packages/shared/ui/src/styles/globals.css`, the departures comment — "its components carry their own resets, which are redundant (not conflicting) under preflight".

Both conclusions are right and both reasons are wrong: the resets are redundant because they are absent, not because preflight duplicates them. The claim may hold of Bolide's unpublished source `index.css`, which is not what a consumer gets.

**Recommendation.** Correct both sentences to state the constraint that is actually true — preflight must stay on because Bolide's components depend on the consumer's. Filed separately: an ADR amendment is its own change.

## 7. The token sheet arrives twice, and the fidelity test does not see upstream

`dist/index.css` ships Bolide's entire `:root` token block inside `@layer base`. `globals.css` imports that file first and then declares its own `:root`, and its comment explains the ordering: `:root` and `.dark` have equal specificity, so importing Bolide's after Neuro's `.dark` block would restore the light theme. Unlayered rules also beat layered ones, so Neuro's copy wins twice over.

The consequence is that **Neuro's copy always wins, whatever upstream now says.** A Bolide release that changes a token value ships the new value into `@layer base :root`, where Neuro's `:root` overrides it, and nothing reports the divergence. `styles.test.ts`'s Bolide-fidelity block pins ten sentinel values against literals written into the test, so it detects a Neuro-side edit — which is what it was built for — and cannot detect an upstream move. ADR-0009 says "the sentinel test bounds the drift"; it bounds drift in one direction.

**Recommendation.** Neuro-side. Compare Neuro's `:root` against the `@layer base :root` block in the vendored `dist/index.css` and fail on a value that differs without a recorded departure. The vendored file is the upstream copy, already present at the pinned version, so the check needs no network and no second checkout. This is the one recommendation implemented alongside this document, in `styles.test.ts`, because it turns the finding into something that stays true.

## 8. Simplification candidates

This part is a proposal, not a defect list. Each is complexity a consumer pays for, where a simpler version is imaginable.

1. **Two complete combobox APIs.** `Combobox*` and `ComboboxV2*` are both exported, 29 exports between them, plus `ComboboxPrimitiveRoot` re-exporting the underlying `@base-ui/react` root. A consumer choosing between them has no signal in the export names about which is current, and an agent reading the menu has less. Deprecating one in the types, or renaming the survivor, would remove the choice.
2. **Three product-shaped exports.** `LoadingDashboardEmptyState`, `NotificationsIcon`, and `DRAWER_HEADER_TAB_CLASSES` — an empty state named for one product's dashboard, an icon named for one product's feature, and a class string exported so a consumer can reproduce a layout the library does not encapsulate. Each is a legacy shape rather than a primitive.
3. **Four migration tokens.** `--conversations-dark-bg`, `--notifications-page-header-text`, `--notifications-page-row-border`, `--notifications-page-row-hover-bg`. Bolide's own comment calls them "not final semantic theme tokens" and scaffolding for the legacy nav refactor. ADR-0009 declined to adopt them, so they arrive in the imported sheet and are used by nothing in Neuro.
4. **The dark block is commented out upstream.** `dist/theme.css` carries a full `.dark` block inside a comment, marked "Dark mode not yet implemented". Neuro's is complete and is effectively a proposal to Bolide. `03-ownership-and-contribution.md` decides whether it goes upstream.

**Recommendation.** One DES issue per item, raised as a proposal. None blocks Neuro.

## Not verified

Everything in this list needs a rendered page, and jsdom cannot see any of it. None of it was attempted.

1. **Every component in both colour schemes — now done, and it does not pass.** `06-reference-surface.md` § "The accessibility sweep" carries the result: axe over every story in both themes, 29 of 118 story/theme combinations with a violation, `color-contrast` the largest class. The worst is `--ai-auto-complete` on white at **1.67:1** against AA's 4.5:1, which is `Input variant="suggested"` — the treatment for text an agent is suggesting. `Badge`'s `destructive` and `number` variants fail in both themes; `Avatar`'s fallback fails in dark across every size and passes in light, so dark is the worse of the two rather than equally clean. `bolide-dark.css` corrects two literals — `bg-white`, including its hover state, and `text-[#0A0A0A]`. They are not all of them, which is now measured rather than suspected.
2. **Whether an inline `style` loses to a Bolide important utility in practice**, and on which components. The mechanism is documented by Bolide's own accordion workaround; the blast radius across Neuro's surfaces is not measured.
3. **Whether a `className` override that `tailwind-merge` does not treat as conflicting reaches the DOM and then loses.** Same mechanism, also unmeasured.
4. **Whether the six server components that import `Skeleton` from `@neuro/ui` render at REQUEST time.** The build half of this is now answered and is no longer open — see "The six `Skeleton` importers" below. What is still unverified is a rendered response: every route those six sit on is dynamic (`ƒ` in the build's route table), so the build never rendered one, and doing so needs a database.
5. **Bundle size.** No measurement was taken of what the library adds to a page, in either direction. Finding 5 says only one icon set ships; it does not say what that costs.

## The six `Skeleton` importers

Finding 2 says the module is hostile to the server graph, and six server components import `Skeleton` from it with no `'use client'`. Both are true, and they do not conflict — the re-export is dropped before it reaches that graph.

Measured 2026-09-08, in this order, so the mechanism and the effect are separate claims:

1. **`react`'s server build has no `createContext` at all.** Not a different implementation — absent. `grep -c createContext node_modules/.bun/node_modules/react/cjs/react.react-server.development.js` returns `0`, and the same file exports only `useCallback`, `useDebugValue`, `useId` and `useMemo` of the hooks. So the six top-level `createContext` calls in finding 2 cannot run under the `react-server` condition, and neither can the module's named imports of `useState`, `useEffect`, `useRef`, `useContext` and `useLayoutEffect`.
2. **The library declares its JavaScript free of side effects.** `"sideEffects": ["**/*.css"]` in `@dealpath/ui-components`' `package.json`, which permits a bundler to drop an unused re-export rather than evaluate it. `@neuro/ui` declares no `sideEffects` of its own.
3. **The production build completes with those six imports in place.** `bun run build` in `apps/dpagentic` exits 0 — "Compiled successfully", 16 static pages generated. It needs values for the variables `@neuro/core` parses at import (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_BASE_URL`, `AUTH_ORIGIN`, `DB_DRIVER`) but reaches no database, so throwaway values are enough.

Step 3 is the one that answers the question, and it answers it narrowly. Two things it does not establish:

1. **A rendered response.** Every route carrying those six is dynamic in the build's route table, so the build compiled them and never rendered one. Request-time rendering needs a database and is listed above as still unverified.
2. **That a server component may render a Bolide component.** It may not, and this changes nothing about that. The drop happens *because* nothing from the re-export is used; using one puts the module in the server graph, which is what finding 2 describes. The rule in `design-rules.md` stands as written.

`create-menu.tsx`'s comment — "a server component cannot render any of it — not even a hook-free primitive" — is right about rendering and wrong about importing. `Skeleton` is Neuro's own component, not Bolide's, and importing it through the barrel is what those six do.

## Adoption today

Context for the findings above, from the same day. The count is the distinct identifiers a consumer imports from `@neuro/ui`, over each root in turn:

```bash
grep -rl "from '@neuro/ui'" --include=*.tsx --include=*.ts <root> | grep -v node_modules \
  | grep -v 'packages/shared/ui/' \
  | xargs perl -0777 -ne "while (/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'\@neuro\/ui'/g) { print \"\$1\n\" }" \
  | tr ',' '\n' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; s/^type //' | grep -v '^$' | sort -u | wc -l
```


| Consumer | Distinct `@neuro/ui` exports imported, 2026-09-08 | Same command, 2026-09-23 |
| --- | --- | --- |
| `apps/dpagentic` | 15 | 36 |
| `apps/design-system` | 19, and they are stories rather than product usage | 161, all stories |
| `apps/control-ui` | none — it declares `@neuro/ui`, imports its token sheet, and imports no component | none |
| `packages/*` | none | none |

On 2026-09-08 the library's fitness problems were not what limited adoption: most of it had never been reached for. `Card`, `Widget`, `Table`, `Empty`, `Badge`, `Tabs`, `Alert` and `Tooltip` were all exported and none was used in the tenant product, while `apps/dpagentic` hand-drew bordered boxes in `className` strings across dozens of call sites. By 2026-09-23 `apps/dpagentic` imports `Alert`, `Badge`, `Card`, `Empty`, `Table` and `Widget` (for example `apps/dpagentic/src/features/plays/play-status-chip.tsx` for `Badge`), and `Tabs` and `Tooltip` are still unused there. `design-rules.md`'s generated menu and `GRO-452`'s bypass check address the rest.

## Related

- `design-rules.md` — the rules an agent loads, including the ones this review produced
- `03-ownership-and-contribution.md` — where each finding above gets filed, and who owns it
- `00-design-system-reference.md` — the Storybook, and the dark-mode and MCP constraints it surfaced
- `ADR-0009-bolide-token-adoption.md` — the token adoption, and the subsumption question it parked
