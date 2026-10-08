---
type: reference
---
# The design-system reference app

`apps/design-system` is an internal Storybook that renders Neuro's UI components from the real packages and carries the written rules that govern how they behave. Two audiences read it: staff (engineers, product managers, designers, customer success) who need to see what exists and what the rules are, and the AI agents that build tenant-facing surfaces, which query it over MCP so they compose existing components instead of inventing new ones.

It is a reference, not a second implementation. Every component it shows is imported from the package that ships it. There are no copies.

## What it renders, and what it does not

| Source | What it contributes | Status |
|---|---|---|
| `@neuro/fields/react` | The Display and Edit control for each of the nine field primitives, plus the registry that pairs them. This is the form layer | Stories, no refactor needed — the package is pure and has no I/O |
| `@neuro/ui` | Shared primitives. Today that is `Button` and nothing else | Stories; the library itself is the gap (see `01-component-extraction.md`) |
| `packages/shared/ui/src/styles/globals.css` | The Bolide token sheet, ~70 variables in light and dark | A generated token page, parsed from the sheet at build time so it cannot drift from it |
| `dealpath/ui-components` (Bolide) | 38 public wrapper components with 33 stories, already published to Chromatic | Composed as a remote section, not vendored — see below |
| `apps/dpagentic/src/components` | The 48 components the product actually renders | **Not shown yet.** All 25 top-level ones import `@neuro/core`, `@neuro/grid`, or `next/server`, so none renders in isolation |

The last row is the honest limit of the first version. The Storybook is not the missing piece — a shared component library is. Doc `01` is the plan for that; it runs as a separate track and does not block this app.

## Bolide is adopted as a dependency, and also composed

`@dealpath/ui-components` is a dependency of `packages/shared/ui`, which re-exports it. Apps and this site import `@neuro/ui`, so the components rendered here are the components the products render.

This reverses the position the first version of this app took. It composed Bolide's published Storybook in an iframe instead, on two arguments that did not survive:

1. **Governance.** ADR-0009 deferred subsuming Bolide's components pending a question about who publishes to sunspear and the Excel add-in afterwards. Consuming the published package does not answer that question or foreclose it — nothing about `ui-components` changes — so it was never a reason to avoid the dependency.
2. **React versions.** Bolide peers React `^18` while Neuro is on React `^19`. The peer range is conservative rather than a real incompatibility: the components install and render on 19. Widening the declared range is upstream's to do.

Composition remains, as a `refs` entry pointing at Bolide's Chromatic Storybook, so its own stories stay reachable — but it is opt-in via `BOLIDE_STORYBOOK_URL`, because composing a private Chromatic Storybook makes the dev server's `/mcp` endpoint demand a Chromatic token.

## Framework: `@storybook/nextjs-vite`, not `@storybook/react-vite`

Bolide uses `react-vite`. Neuro cannot, and the reason is measurable rather than stylistic: in `apps/dpagentic/src/components`, 18 files import `next/link` and 12 import `next/navigation`. Under plain `react-vite` every one of those throws on render. `@storybook/nextjs-vite` supplies working mocks for the Next router, navigation, `Image`, and `Link`.

Its peer ranges match the repo exactly — `next: ^14.1.0 || ^15.0.0 || ^16.0.0` against Neuro's `^16.3.0`, and `react: … || ^19.0.0` against Neuro's `^19`.

This choice costs nothing today (the fields package needs no Next mocks) and is what lets Track B's extracted components arrive without a framework migration.

## The rules pages

Written rules live as MDX beside the stories, so a rule can embed the live component it describes. Six pages:

| Page | What it governs | Why it needs to be written down |
|---|---|---|
| `Overview.mdx` | What the site is, where each section comes from, and the honest gap | Somebody opening this for the first time needs to know what they are looking at and what it does not yet cover |
| `Forms.mdx` | How a field renders and how an edit round-trips | The rules are real and non-obvious — a percent field stores `0.5` and shows `50`, a currency edit must preserve the value's own currency or a EUR amount silently becomes USD |
| `AISurfaces.mdx` | The `--ai-*` token family | The design system has a visual language for "this came from an agent". A reader should be able to tell an agent-authored card from a person-authored one before reading a word of it |
| `Tokens.mdx` | Every token, light and dark | Generated from the sheet. A hand-written token table is a second copy that drifts |
| `Layout.mdx` | Spacing, radius, density, empty and loading states | Otherwise every surface picks its own |
| `Composition.mdx` | How views compose from typed sections | Summarises `docs/experiences/views/02-best-practices-and-patterns.md` and links to it |

`docs/` stays where the reasoning lives. The MDX is the rendered, example-bearing view of it, and each page links back to its source document. The two are allowed to differ in depth, never in substance.

## Delivery

| Surface | Status | How | Who it serves |
|---|---|---|---|
| Local | **working** | `bun run --filter @neuro/design-system dev`, port 6006 | Engineers with a checkout |
| MCP | **working** | `@storybook/addon-mcp`, served by the local dev server at `:6006/mcp` | Coding agents. This is what stops an agent asserting a prop that does not exist |
| Deployed | **working**, at https://dealpath-design-system.vercel.app | Static `storybook-static/` on Vercel (`dealpath-design-system`), SSO-protected | Staff without a checkout |
| Chromatic | **workflow built, token missing** — the publish job in `.github/workflows/chromatic.yml` reports skipped until `CHROMATIC_PROJECT_TOKEN` exists | The Dealpath account Bolide and sunspear already share | Visual regression on pull requests that touch the design system or the packages whose components it renders |

Each pull request gets a Storybook at its Vercel preview URL, and `develop` publishes the stable one at https://dealpath-design-system.vercel.app. `apps/design-system/vercel.json` enables deployments on `develop` alone and the project's production branch points there, so every merge to `develop` republishes that address. Confirmed 2026-09-16: the deployment behind it reports target `production` and has the `-git-develop-` alias on it.

Vercel Authentication guards it. A person signs in with a Dealpath Vercel account; an agent reads it with `vercel curl <url> --scope dealpath`, which bypasses the protection on its own, or with `VERCEL_AUTOMATION_BYPASS_SECRET`, already a repository secret.

The MCP surface is deliberately local-only. The addon serves from the running dev server, and it is preview-stage and React-only. An agent working in the repo has the dev server available; the deployed static site has no MCP endpoint and does not need one. `.mcp.json` is gitignored in this repo, so each developer registers the server themselves — the snippet is in the app's README.

### What is built, and what is not

Built and verified: the app, the stories, the rules pages, the MCP surface, the Turborepo wiring (`build-storybook` output declared, `CHROMATIC_PROJECT_TOKEN` pass-through, `BOLIDE_STORYBOOK_URL` in the cache key), and a confirmed cache hit that restores the artifact rather than replaying empty logs.

**The Vercel project exists** (#369): `dealpath-design-system`, output directory `storybook-static`, SSO-protected, with no database or QStash connection because it reads no data at build time and none at runtime. Every pull request gets a Storybook at its preview URL.

One thing about it is still outstanding, and it is not code:

1. **`BOLIDE_STORYBOOK_URL=1`** on the deployed project only, so staff get the Bolide section there while local runs keep a working MCP endpoint.

**The Chromatic project does not exist.** It needs to be created under the Dealpath account that already hosts Bolide and sunspear, and its token added as `CHROMATIC_PROJECT_TOKEN`. The publishing workflow is in place and its publish job reports *skipped* until that secret exists. Creating the project and adding its token are both required, and nothing in this repository changes when they are.

## Two defects this app surfaced, and one integration constraint

### Dark mode did not work (fixed here)

The theme switch in the toolbar was the first thing to exercise the `.dark` block, and it did not hold up. Measured in a browser: a `.border` element inside `.dark` rendered `rgb(230, 230, 230)` — the light `#E6E6E6` — where `rgb(38, 38, 38)` was correct.

The cause is a Tailwind v4 detail with a wide blast radius. `@theme inline` substitutes a mapping's value **where it is defined**, which is `:root`. Utilities are unaffected, because `bg-background` expands to the resolved `hsl(var(--background))` and re-evaluates under `.dark`. But a `--color-*` name read from hand-written CSS or a Tailwind arbitrary value keeps its light value in every scope. Confirmed by probe: inside `.dark`, `--color-border` computed `hsl(0 0% 90%)` while `--border` correctly read `0 0% 14.9%`, and **every** `--color-*` was frozen or unemitted.

Five sites read them that way, and all five are fixed:

| Site | Was | Now |
|---|---|---|
| `globals.css` `* { border-color }` | `var(--color-border)` | `hsl(var(--border))` |
| `globals.css` `body` background and colour | `var(--color-background)` / `var(--color-foreground)` | `hsl(var(--…))` |
| `packages/shared/ui/src/components/ui/button.tsx` | `ring-[var(--color-ring)]` | `ring-ring` |
| `packages/shared/fields/src/react/components.tsx` | `ring-[var(--color-ring)]` | `ring-ring` |

The `*` rule is the one that mattered: it gave every bordered element in the product a light border under a dark theme. It is latent today because no app ships a theme toggle, which is exactly why nothing had caught it.

Two tests in `styles.test.ts` now pin the rule — the sheet must not read a `@theme` mapping outside the mapping block, and neither may any app or package. Both were confirmed to fail against the unfixed code. The departure from Bolide is recorded in the sheet header per ADR-0009's rule, and it is a departure only because Bolide has no dark theme to break.

### Presentation hints never reach the components

Building the form stories exposed that **every presentation hint in the field system is authored, stored, and never rendered.**

The chain, verified:

1. `field_definitions.display` is a real column holding `prefix`, `suffix`, `null_label`, `placeholder`, `help`, `scale`, `alignment`, and `locale` (`packages/tenant/core/src/db/field-system/config.ts:143`).
2. ADR-0008 hoisted those keys out of `settings` deliberately, and the settings schemas reject an embedded `presentation` block — asserted as a test (`packages/shared/fields/src/specs/specs.test.ts:243-246`).
3. The detail page passes only the settings blob: `params: def.settings` (`apps/dpagentic/src/features/entity/detail.server.ts`).
4. The components read `params.presentation` (`packages/shared/fields/src/react/types.ts`, `presentationOf`), which step 2 guarantees is never present.

So a field authored with a `$` prefix, a `"Not set"` null label, or placeholder text renders without any of them, and no test fails. The fix is a change to what the detail builder passes and what `presentationOf` reads; it is tracked separately rather than folded into this app, because it changes rendering in the tenant product.

The stories pass a `presentation` block inside `params` so they exercise the component contract as written, and `field-fixtures.test.ts` asserts that those blobs are **not** valid settings — so the day the wiring is fixed, that assertion fails and tells whoever fixed it to reshape the fixtures. `Forms.mdx` states the gap rather than implying the hints work end to end.

This one is **not** fixed here. It changes rendering in the tenant product, which is a different review than adding a Storybook.

### Composing Bolide takes the MCP endpoint offline

The two capabilities collide, and the collision is not documented anywhere upstream. Bolide's Chromatic Storybook is not publicly readable, so declaring it as a `refs` entry makes the whole dev server demand a Chromatic OAuth token — including `/mcp`:

```text
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer error="unauthorized",
  error_description="Authorization needed for composed Storybooks"
```

Verified by isolation: with the ref removed, the same server answers `initialize` with 200 and lists all seven tools.

So the ref is opt-in through `BOLIDE_STORYBOOK_URL`. Unset — the default for `bun run dev` — Neuro's own components render and agents can reach MCP. Set, the Bolide section appears and the server authenticates. The deployed static build sets it and has no MCP endpoint to lose, so nothing is traded away in either direction.

## `react-docgen`, not `react-docgen-typescript`

`typescript.reactDocgen` is set to `'react-docgen'` in `.storybook/main.ts`. This is Storybook's own default: `@storybook/react/dist/preset.js:569` destructures it as `{ reactDocgen = 'react-docgen' }`, so writing it down changes nothing about the build. Confirmed by building with the line removed: the same component set, the same exit 0.

The line is written down because the other value does not work here. `react-docgen-typescript` needs the TypeScript compiler API, and TypeScript 7 provides none. Its peer range is `>= 4.3.x`, so the install resolves without complaint; `@joshwooding/vite-plugin-react-docgen-typescript` is already in the tree and would be picked up by `@storybook/react-vite`'s preset the moment the value changes.

No GitHub Actions job builds the design system. `bun run build` is outside `.github/workflows/ci.yml`, and `chromatic.yml` gates its build job on `CHROMATIC_PROJECT_TOKEN` (not set in CI), so that job skips. Vercel does build it: `apps/design-system/vercel.json` sets `buildCommand: bunx turbo run build --filter=@neuro/design-system`, which runs `storybook build`, and the dashboard Ignored Build Step builds any pull-request head.

A wrong value turns the Vercel build red but does not block a merge. `develop`'s only required status check is `verify`; all five Vercel deployments are unrequired.

A wrong KEY had no signal at all: Storybook ignores an unrecognised key and falls back to its default (this same value), so a misspelled `reactDocGen` produced a byte-identical build. Two things now catch it: `StorybookConfig` in the app's tsconfig `include` (`.storybook/*.ts`; naming the directory alone skips dot-directories); and `scripts/lib/typescript-pins.test.ts`, which asserts the resolved value.

To verify a change, list the components with docgen. Exit code and `__docgenInfo` count are both unreliable: the count has a floor from Storybook's own runtime and moves whenever a component is added.

```bash
rg -o '\w+\.__docgenInfo' storybook-static | sed 's/.*://' | grep -v '^component\.' | sort -u
```

`docs/typescript-toolchain.md` covers the rest: what TypeScript 7 removed, which packages still reach for the compiler API, and why a presence check does not detect them.

## Verified working

Against the running dev server, not the build log:

- Six rules pages and thirteen stories build and render, zero console errors.
- All nine field primitives render real values through the real components, in `en-US`, `de-DE`, and with no locale (which is the failure the Locales story now demonstrates deliberately).
- The token page generates 50 tokens across 7 groups, with **zero swatches rendering as no colour** — the failure mode `styles.test.ts` exists to prevent.
- Light and dark both resolve correctly after the fix above.
- MCP answers `initialize` and `tools/list` with seven tools, and `list-all-documentation` returns both components and all six rules pages.

## Related

- `01-component-extraction.md` — the plan for turning app-local components into a shared library
- `docs/experiences/design-system/ADR-0009-bolide-token-adoption.md` — the token adoption this app documents
- `docs/coredata/entity-fields/ADR-0008-schema-naming-and-consolidation.md` — the `settings` / `display` split
- `docs/experiences/views/02-best-practices-and-patterns.md` — the composition rules `Composition.mdx` summarises
