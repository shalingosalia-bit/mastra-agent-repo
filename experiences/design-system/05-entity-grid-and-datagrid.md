# The entity grid and the design system TableGrid

Whether Neuro's entity grid moves onto the grid component the DES team is building, keeps its own, or shares a layer with it.

**Measured 2026-09-08 by static analysis** against `@dealpath/ui-components` 2.4.0 — the version pinned in `packages/shared/ui/package.json` and linked at `packages/shared/ui/node_modules/@dealpath/ui-components` — plus the installed `ag-grid-*` packages and the DES tracker. Every finding names the file, command or issue it came from. Nothing was measured in a browser, which bounds what this can say; the claims that need a rendered page are listed under **Not verified**.

Both sides are building on AG Grid Enterprise, independently. DES's component is named `TableGrid` and ships from `dealpath/ui-components`; Neuro's is `apps/dpagentic/src/features/entity/entity-grid.tsx`.

## Decision

1. **Neuro converges on the Bolide `TableGrid`, and contributes a data contract rather than a component.** `@neuro/grid` stays Neuro's — it is the query and the request mapping, it renders nothing, and DES has no equivalent. The rendering half is the part that stops being Neuro's.
2. **Nothing migrates until `TableGrid`'s `serverSource` has met a real backend.** That is DES-98, in Milestone 3, in Backlog. Until it lands, `entity-grid.tsx` stays exactly as it is and no adoption work starts. A component whose server-side data path has only ever been driven by a fake (DES-79) cannot yet be evaluated against a grid whose entire behaviour is server-side.
3. **The reversible default is therefore: keep the current grid, and open the contract conversation now.** The cost of waiting is not zero — DES's request contract is being fixed in Milestone 0 — so the requirements in the table below are raised against DES while its shape is still open, not after.
4. **`@neuro/grid` gains one adapter, and does not gain a second contract.** If DES's `RowRange` becomes the shape a consumer sees, the mapping from it to `AgGetRowsRequest` is a pure function next to `toPredicate`/`toSort`/`toLimit`/`toOffset` in `packages/tenant/grid/src/ssrm.ts`. No SQL, no repository and no transport changes.
5. **One AG Grid Enterprise integration, one licence.** Neuro's integration is unlicensed today (see below); DES's key is not visible from this repo. Converging makes procurement a single question instead of two, and the ag-grid dependency leaves `apps/dpagentic`.
6. **The smaller tables and view-section chrome are unaffected.** `docs/experiences/views/02-best-practices-and-patterns.md:84` routes those to headless tables and keeps AG Grid for the dense, filter-heavy dashboards. That disposition holds under this decision.

**Decisions 1, 2 and 3 are a proposal.** They are the reversible default, written down so Neuro's grid work is not blocked on a conversation that has not happened. Neither team has been told the other exists. **Confirmed by Diego Bueno** (DES, author of the `TableGrid` milestones) **and Henderson Beck** (design), with GroundUp's side confirmed by whoever owns `apps/dpagentic`. Decisions 4, 5 and 6 are Neuro's alone and need no cross-team agreement.

## Questions from GRO-474

| Question | Answer |
| --- | --- |
| Does Neuro consume the `TableGrid` when it ships? | Yes, as the target. Not on the current release, and not before DES-98. |
| Where does the row model sit, if they converge? | With Neuro. `@neuro/grid` is server-side and unduplicated by DES; it gains an adapter, not a rewrite. |
| What does Neuro need that sunspear's grids did not? | Eight requirements, tabled below. Two of them — a server filter model, and the `--ai-*` treatment — have no issue on the DES project at all. |
| The licence? | Enterprise is in use in Neuro and unlicensed. DES pins Enterprise too. Measured below. |

## Corrections to the premises in GRO-474

| Premise | Measured state |
| --- | --- |
| The grid is `apps/dpagentic/src/components/entity-grid.tsx` | It is `apps/dpagentic/src/features/entity/entity-grid.tsx`. `grep -rl 'ag-grid' --include='*.ts*' apps packages` returns that file and a `tsconfig.tsbuildinfo`, so the "only file that uses ag-grid" claim holds — exactly one source file imports it. |
| DES is "building a shared grid" on ag-grid Enterprise, project in Backlog | Milestone 0 is six stacked pull requests, five of them In PR (DES-78 through DES-105), with the component and its export in DES-82. Milestones 1–5 are Backlog. |
| DES-35 shipped the DataGrid | DES-35 is Done as the *design* issue. Its spec (DES-37) chose TanStack Table v8 headless; the implementation that followed pins ag-grid instead (DES-78). The export is named `TableGrid`, not `DataGrid`. |
| Live rows over ElectricSQL | The grid's live path is a polling `LiveProvider` (`apps/dpagentic/src/features/live/live.ts:1-45`), which names Electric as a later drop-in swap. Electric shapes exist in `packages/tenant/realtime/src/shapes.ts` and are not wired to the grid. The grid refreshes on settle, it does not stream. |
| The `--ai-*` treatment on generated cells | Not built. `entity-grid.tsx` contains no `--ai-*`. It is a written rule (`apps/design-system/AGENTS.md:32`) with tokens defined (`apps/design-system/src/rules/AISurfaces.mdx:21`), and a requirement on whatever renders the grid. |

## The two integrations

| | Neuro | Bolide `TableGrid` |
| --- | --- | --- |
| ag-grid version | 33.3.2, declared in `apps/dpagentic/package.json:40-42` | 31.3.4, pinned as regular dependencies (DES-78) |
| Theming | The v33 Theming API — `theme={themeQuartz}` at `entity-grid.tsx:256` | `--ag-*` custom properties in a shipped stylesheet, adopting no ag-grid theme (DES-78) |
| Row model | Server-side only, no client row model (`entity-grid.tsx:257`) | `localSource`, `serverSource`, `idListSource` behind one contract (DES-79) |
| Server request shape | AG Grid's own request, typed as `AgGetRowsRequest` (`packages/tenant/grid/src/ssrm.ts:58-65`) | A four-field `RowRange`; ag-grid's `IServerSideDatasource` is a forbidden import (DES-79, DES-98) |
| Vendor types at the call site | `ColDef`, `GridApi`, `IServerSideDatasource`, `GridReadyEvent` (`entity-grid.tsx:3-13`) | None. One adapter module sees a vendor type (DES-80), to be enforced by eslint (DES-108) |
| Filtering | The whole surface. Every filter is a server round-trip mapped to a predicate AST | No filter-model issue exists on the project. Milestone 1 has a sort model (DES-85) and no filter counterpart |
| Licence key | Read from `NEXT_PUBLIC_AG_GRID_LICENSE`, unset | Not visible from this repo |

The version and theming rows are the two that make a same-page coexistence unattractive rather than merely untidy. `ModuleRegistry` and `LicenseManager` are per-copy: `entity-grid.tsx:25-28` registers Enterprise modules and sets a key on Neuro's copy, and a second copy of ag-grid resolved for `ui-components` would carry neither. AG Grid 33 also treats CSS-file themes and the Theming API as mutually exclusive on one page — the installed bundle carries the diagnostic for it:

```text
Because no value was provided to the `theme` grid option it defaulted to themeQuartz.
But the file (ag-grid.css) is also included and will cause styling issues. Either pass
the string "legacy" to the theme grid option to use v32 style themes, or remove
ag-grid.css from the page to use Theming API.
```

```bash
grep -o '.\{240\}theme grid option to use v32 style themes' \
  node_modules/.bun/ag-grid-community@33.3.2/node_modules/ag-grid-community/dist/package/main.cjs.js
```

Whether DES's stylesheet triggers that specific diagnostic is not verified: it ships `--ag-*` properties rather than `ag-grid.css`, and the check names the file. The version gap is the certain part; the theming collision is a risk to test, not a measured failure.

## What a shared TableGrid would have to carry

Each row is a behaviour the current grid has, with the reason it exists, and the DES issue that would carry it.

| # | Requirement | Grounded in | Covered by |
| --- | --- | --- | --- |
| 1 | A server filter model, with per-column operator allow-lists | `entity-grid.tsx:46-57` and `:121-123`; the throw that makes it necessary is `ssrm.ts:156-158` | Nothing. Milestone 1 has no filter issue |
| 2 | Per-column filterable/sortable driven by data, not by the call site's preference | `entity-grid.tsx:104-109` (`c.hot`), sourced at `data.server.ts:167-171` from `query.ts:36` | Partly DES-85 (sort) |
| 3 | A withheld value rendered distinctly from an empty one | `entity-grid.tsx:114-117`, contract at `query.ts:40-58` (`redactedFields`) | DES-91 (`FieldValueCell`), if the cell can see a per-row marker |
| 4 | Imperative purge-and-refetch, triggered from outside the grid | `entity-grid.tsx:136` and `:219` (`refreshServerSide({ purge: true })`), driven by `refreshWhenSettled` | Nothing named |
| 5 | Full reset when datasource identity changes, not only when the row type does | `entity-grid.tsx:255`, with the failure it prevents at `:248-254` | Nothing named |
| 6 | Tenant, view and workspace carried as opaque handles on every row request | `entity-grid.tsx:152-162`, and the reason at `:76-89` | DES-98, if `serverSource` passes caller-supplied context through |
| 7 | Columns composed by an agent at request time, from the same shape a person saves | `query-view.tsx:80-85`, `agent-view-card.tsx:11-24` | Satisfied by construction — column specs are caller-supplied |
| 8 | The `--ai-*` treatment on agent-produced cells | Rule at `apps/design-system/AGENTS.md:32`, tokens at `AISurfaces.mdx:21`; not implemented in the grid | Nothing. Closest is DES-93 (conditional formatting) |

Rows 1 and 8 are the ones to raise first. A grid component with no filter model cannot host Neuro's grid at all, since filtering is what the grid is for and the mapping in `ssrm.ts` exists to serve it. Row 4 is the second: `TableGrid`'s contract deliberately hides ag-grid's API (DES-80, DES-108), and an imperative handle for refreshing from outside the component is exactly the kind of reach-through that boundary is designed to refuse — so it has to be an intentional part of the contract or it is unavailable.

## Where the row model sits

`@neuro/grid` renders nothing. It exports pure request-mapping functions and one query: `toPredicate`, `toSort`, `toLimit`, `toOffset`, `filterToPredicate`, `gridFields` and `runGridQuery` (`packages/tenant/grid/src/index.ts:9-29`). Its only dependencies are `@neuro/core` and `@neuro/fields`. It has no AG Grid import — the vendor's request shape is re-declared locally as `AgGetRowsRequest` (`ssrm.ts:58-65`), so nothing in the package is coupled to an ag-grid version.

That split is what makes convergence cheap on Neuro's side and is the thing worth telling DES. Neuro has already built the server half of `serverSource`, including the part DES-98 has not reached: a filter model mapped to a typed predicate, with unmappable operators throwing rather than widening to a wrong superset. DES's contract keeps ag-grid's nine-field request behind a four-field `RowRange` (DES-79); Neuro's server reads a superset of it. So the adapter is one direction and one function.

Which four fields `RowRange` carries is unknown, as is whether it can express a group drill-down — `toPredicate` builds one from `rowGroupCols` plus `groupKeys` (`ssrm.ts:174-180`), and a contract without an equivalent would drop that behaviour. Neither is measurable from this repo, and together they decide how small the adapter is.

## The AG Grid Enterprise licence in this repo

AG Grid Enterprise is in use and unlicensed.

1. **Enterprise, not Community.** `apps/dpagentic/package.json:40-42` declares `ag-grid-community`, `ag-grid-enterprise` and `ag-grid-react`, all `^33.3.2`, all resolved at 33.3.2. `entity-grid.tsx:12` imports `AllEnterpriseModule` and `LicenseManager`, and `:25` registers the Enterprise module set.
2. **No key is set anywhere.** `NEXT_PUBLIC_AG_GRID_LICENSE` appears in exactly two places: declared as a passthrough in `turbo.json:100`, and read at `entity-grid.tsx:26`. It is absent from `.env.example`, `apps/dpagentic/.env.example`, `sst.config.ts` and `devops/`.
3. **The grid therefore runs in trial mode**, and `entity-grid.tsx:29-44` suppresses the trial banner AG Grid writes to `console.error`, with a comment routing procurement to DPN-12. `apps/dpagentic/README.md:143` records the same.
4. **DES declares Enterprise as a regular dependency** of `ui-components` (DES-78), so every consumer of that package acquires the Enterprise build whether or not it uses an Enterprise feature.

AG Grid prices Enterprise per developer seat, in its own terms. Two independent integrations against one company's licence is a procurement question and a compliance question, and it currently has no owner on either side. Under this decision it collapses to one integration — but only after DES-98, and the trial-mode exposure in Neuro exists now and is unchanged by any of this.

## Not verified

Everything here needs a rendered page, a running app, a person, or a repository this one cannot read.

1. **Whether DES's stylesheet and Neuro's Theming API collide.** The v33 diagnostic names `ag-grid.css`; DES ships `--ag-*` properties in its own bundle. Needs both on one page.
2. **What `TableGrid` accepts.** Its props are `types.ts` in `dealpath/ui-components` (DES-78), which is not published in 2.4.0 and not readable from here. The four fields of `RowRange`, the column spec, and whether an error state or a refresh handle is exposed are all unmeasured.
3. **ADR-003 and ADR-006.** Both live in `dealpath/dp-docs` (PRs #100 and #140). The decisions are quoted here only as the DES issues paraphrase them.
4. **DES's intent about a second consumer.** No one on DES has been asked. Nothing in the project's issues mentions Neuro, and GRO-474 is related to DES-35 by a link only.
5. **Whether the `TableGrid` renders correctly at all**, in any browser, at any density. DES-83 is establishing the first Chromatic baseline and is In Progress; it notes two stories that are deliberately unfinished states. No visual or accessibility claim is made here.
6. **Row-height and virtualization behaviour under Neuro's row counts.** DES-83 records that row heights are content-driven (`autoHeight`) and DES-77 caps dynamic height at 110 columns. Neuro's grid uses a fixed block size of 100 (`entity-grid.tsx:258`) and flex columns. How the two interact is untested.
7. **Migration cost.** No estimate was made. Decision 2 defers it, and it needs `TableGrid`'s props to be knowable first.
8. **Whether anything else in Dealpath has a third ag-grid integration.** Only this repository and the DES tracker were searched.

## Related

- `02-bolide-fitness.md` — where the pinned release fits how Neuro builds; the same release, measured the same day
- `03-ownership-and-contribution.md` — the tier rule this decision applies, and the proposal-with-a-named-confirmer pattern it follows
- `../views/02-best-practices-and-patterns.md` — one grid for the dense dashboards, headless tables everywhere else
- `../views/ADR-0018-query-views-and-the-source-registry.md` — the entity-only constraint on grid-mode views that `query-view.tsx` cites
- `packages/tenant/grid/src/ssrm.ts` — the request mapping any converged contract has to reach
