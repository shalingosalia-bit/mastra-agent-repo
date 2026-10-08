# ADR-0009 — Bolide token adoption

Status: accepted (2026-08-03); amended (2026-08-21)

Neuro's token sheet is Bolide's, copied verbatim. That is what this ADR decides and it is unchanged.

It was originally titled "tokens now, components later", and the sequencing half no longer holds: `packages/shared/ui` depends on `@dealpath/ui-components` and re-exports it, so apps and the design-system Storybook import the components through `@neuro/ui`. The title carried a decision the code had moved past, which is why it is gone rather than annotated.

The governance question this ADR deferred on is untouched and still open: who publishes to sunspear and the Excel add-in if Bolide is ever subsumed into the monorepo. Consuming the published package neither answers it nor forecloses it — nothing about `dealpath/ui-components` changes. The deferral was read as a reason not to take the dependency, which it never was.

Adopting the components as a dependency is not the same as using them. `apps/dpagentic` still builds its controls from raw elements and imports nothing from `@neuro/ui`; migrating it is separate work.

## Context

Dealpath's design system is **Bolide**: `@dealpath/ui-components`, a standalone repo extracted from sunspear, published to GitHub Packages, consumed today by sunspear (fully migrated) and the Excel add-in. It has three layers — a token sheet (`src/styles/bolide.css`, ~70 CSS variables with Tailwind v4 `@theme` mappings), internal shadcn/Radix primitives that are deliberately not exported, and 38 public wrapper components with the product's affordances (loading states, AI-sparkle treatments, Phosphor icons).

Neuro's `@neuro/ui` had already lifted Bolide's accent tokens (`--blue`, `--success`, the `--ai-*` family) but carried stock-shadcn `oklch` neutrals and a different radius, so the two surfaces read as cousins rather than one product. The open question was sequencing: adopt the tokens now, knowing the component library may be subsumed into the monorepo later — or does adopting first paint us into a corner?

## Decision

**Adopt the token sheet now, verbatim; leave subsumption of the components as a later, separate decision.** The two compose because tokens are the design system's *contract* and components are its *implementation*: everything Neuro builds against the token names renders identically whichever side supplies the components, so subsuming later costs no restyling pass. That composition only holds for a **faithful copy** — a blended or hand-converted palette would make later component adoption a visual migration — so the adoption rules are:

1. **Verbatim values with provenance.** `packages/shared/ui/src/styles/globals.css` copies `bolide.css` (adopted at `6e5eb23`, 2026-06-22), keeping Bolide's raw-HSL-triplet convention, comments, and hex annotations. The Figma link rides along as the design source of truth.
2. **Named departures only.** Two, both Neuro-side and neither a token value: preflight stays on (Bolide disables it solely for sunspear's legacy CSS; its components carry redundant-not-conflicting resets), and a `.dark` block exists (Bolide's is "not yet implemented" — ours is the de facto Bolide-dark proposal, kept complete so every semantic name resolves in both themes). Bolide's self-flagged "temporary migration tokens" are not adopted.
3. **Guards, because both failure modes have already happened.** `packages/shared/ui/src/styles/styles.test.ts` drift-pins sentinel values against the source, and asserts every `var(--x)` referenced anywhere in apps or packages is defined at `:root` — an undefined token renders as no colour rather than an error, which is exactly how the chart bars once shipped invisible.

## The later subsumption, and what this decision pre-answers

If/when `ui-components` moves into the monorepo (as `packages/design-system` or by growing `packages/shared/ui`), this ADR's groundwork means: components arrive onto their own token values; the no-preflight resets they carry are inert under our preflight; their `@theme` mapping style is already ours. What it deliberately does **not** pre-answer, because it is a governance question rather than a technical one: who feeds sunspear and the Excel add-in afterwards. The options are publishing `@dealpath/ui-components` *from* the monorepo (true subsumption; legacy consumers keep receiving releases) or freezing the standalone repo and letting legacy consume its last version until retirement. That choice belongs to whoever owns the legacy retirement timeline, and nothing in the token adoption forecloses either.

## Consequences

- dpagentic, tenant, and control-plane render pixel-faithful to Bolide (verified computed styles: border `#E6E6E6`, primary fill `#2463EB`, text `#0A0A0A`, radius `0.5rem`).
- The full token vocabulary is available before the components that use it, so newly built surfaces (charts, agent cards, drill chips) are already Bolide-coloured on arrival.
- Two copies of the sheet exist until subsumption; the sentinel test bounds the drift, and the provenance header says where truth lives.

## Related

- `docs/reference/modernization/built-surface-comparison.md` — the frontend rows this affects.
- `dealpath/ui-components` `README.md` / `CONSUMING.md` — the library's own contract.
