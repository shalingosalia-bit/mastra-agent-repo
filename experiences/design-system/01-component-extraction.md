# Turning app-local components into a shared library

`@neuro/ui` exports Neuro's own components beside its re-export of Bolide, and most of the product's components remain in `apps/dpagentic`. This document is the plan for closing that. An agent asked to build a tenant-facing surface can compose only from what a package exports. A component inside `apps/dpagentic` is invisible to it, so it writes a new one, and the product accumulates a second visual vocabulary nobody reviewed.

## What is there now

The directories, and what stands alone in each. No counts here: they move with every ticket, and `find <dir> -name '*.tsx' ! -name '*.test.tsx' | wc -l` gives the current one per row.

| Location | Renders in isolation? |
|---|---|
| `packages/shared/ui/src/components/ui` | Yes |
| `packages/shared/ui/src/components/views` | Yes. The view leaves, moved here by GRO-800 |
| `packages/shared/fields/src/react` | Yes. The package is pure, with no I/O |
| `apps/dpagentic/src/components` | No. Each imports `@neuro/core`, `@neuro/grid`, or `next/server` |
| `apps/dpagentic/src/features/views/components` | Mixed |
| `apps/dpagentic/src/features/compose/components` | No |

## The seam

The rule already exists in this repo, stated for the backend in `CLAUDE.md`: transport is thin, business logic lives in operations, and pure functions have no I/O. Extraction applies the same rule one layer up.

Each component splits in two:

- A **presentational** component in `@neuro/ui`, taking plain serialisable props. No data fetching, no tenant resolution, no `@neuro/core` import. It can be rendered by a story, a test, and an agent's composition with no database.
- A **container** that stays in the app, resolves the tenant, fetches, and passes props down.

This is not a rewrite. For most of the 25, the presentational half is already the bulk of the file and the coupling is a handful of imports at the top.

## Sequencing

Extract in dependency order, lowest first, because a section component that needs a badge cannot move before the badge does.

1. **Primitives** — the shadcn set the app already uses inline: input, label, badge, card, separator, dialog, dropdown, tooltip. Sourced with `bun run --filter @neuro/ui ui:add`, which the package already scripts.
2. **Field controls** — none needed; `@neuro/fields/react` is already a package. Fix the presentation-hint wiring named in `00` while here.
3. **View sections**: `data-table.tsx`, `cards.tsx`, `board.tsx`, `summary-table.tsx` and `chart-section.tsx` moved to `@neuro/ui` under GRO-800; each takes resolved data already, so the presentational half was the whole file. GRO-967 moved `section.tsx` and the four remaining bodies: `map-section.tsx`, `matrix-section.tsx`, `nearby-section.tsx` and `notes-section.tsx`. Some section kinds did not move, because each reaches an application service: a `conversation` the chat host, a `plays` roster the plays feature, a `flow` the flow engine's write path. `SectionView` names them in `DELEGATED_SECTION_KINDS`, frames them, and takes their drawing from its host as a `body` prop, so the app supplies what only the app has. A rendered element crosses the server/client boundary a composition renders across, where a kind-to-component map would not.
4. **Agent surfaces** — `proposal-review-card.tsx`, `memo-card.tsx`, `agent-view-card.tsx`. These carry the `--ai-*` treatment, so extracting them is what makes `AISurfaces.mdx` show real components rather than swatches.
5. **Shell** — sidebar, switchers, nav. Lowest value to extract: they are app-shaped and only one app renders them.

Each step ends with the component exported from `@neuro/ui`, a story in `apps/design-system`, and `apps/dpagentic` importing it rather than declaring it. A step that does not delete the app-local copy has not finished.

## What not to do

- **Do not extract a component that still needs a database.** Moving the coupling into the package rather than removing it makes the package unrenderable and defeats the point.
- **Do not extract the shell first** because it is visible. It is the least reusable layer.
- **Do not vendor Bolide's components** as part of this. That is ADR-0009's parked decision and is unrelated to whether Neuro's own components are packaged.

## Tailwind sources: one list, not one per app

Tailwind v4 only emits a utility for a class it can see, and it does not follow imports into a workspace package. So the set of packages an app scans decides which shared components arrive fully styled.

The failure mode is partial, which is why it survives review. `apps/dpagentic` declared `packages/shared/ui/src` and not `packages/shared/fields/src/react`: classes its own markup also uses (`bg-background`, `px-2`, `rounded-md`) were emitted by coincidence, while `min-h-16` on the multiline textarea and `size-4` on the boolean checkbox appeared in no source it scanned — so a multi-line text field rendered a single-row textarea and the checkbox rendered at the browser default size. `focus-visible:ring-ring` survived only because `@neuro/ui`'s button happens to use it too. `apps/control-ui` had the same omission.

Three apps each kept a hand-maintained copy of the list and the copies disagreed. The list now lives once, in `packages/shared/ui/src/styles/sources.css`, which the token sheet imports — so every surface that imports `@neuro/ui/styles.css` inherits the same scan set with no per-app declaration.

**Every extraction step adds the new package to that one file.** Nothing else changes. Four tests in `styles.test.ts` hold the arrangement: the list covers each component-bearing package, every declared path exists (a typo'd path scans nothing, silently — an early draft shipped one level too high), every scanned root excludes its test files, and no app declares an `@source` of its own.

### Test files are excluded, and that exclusion is what makes the rest checkable

Tailwind extracts class-shaped strings from any file it scans, comments included. `styles.test.ts` explains this hazard by naming the classes it protects — `min-h-16`, `size-4` — and it sits inside the scanned `packages/shared/ui/src` tree. Without an exclusion those utilities were emitted into every app out of a test's prose.

That is worse than noise, because it inverts the guarantee. A missing `@source` stops looking like a missing `@source`: measured directly, deleting the fields source left `.min-h-16` and `.size-4` in the bundle unchanged. Any verification that greps compiled CSS would have reported a pass it had not earned — and the first version of this document did exactly that.

With `@source not "…/*.test.*"` in place, deleting the fields source removes both classes, which is what makes the arrangement testable at all.

### The verification, as actually run

With the exclusions in place, all three surfaces were rebuilt and their emitted CSS compared. `min-h-16`, `size-4`, and `whitespace-nowrap` appear in the Storybook, dpagentic, and control-plane bundles alike; removing the fields `@source` removes the first two from all of them. That is what makes `apps/design-system` honest — a Storybook with its own source list would render through a different scan set than the products, and could look correct while a product did not, which is worse than having no Storybook.
