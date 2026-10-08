# Design system

How Neuro's UI is put together: where components live, which rules govern them, and how the reference app makes both visible.

| Document | What it covers |
| --- | --- |
| [`00-design-system-reference.md`](00-design-system-reference.md) | `apps/design-system` — what it is, why it is shaped this way, what it renders and what it cannot yet, the defects it surfaced, and what is left to provision |
| [`01-component-extraction.md`](01-component-extraction.md) | The plan for turning app-local components into a shared library, and the Tailwind source rule that keeps every surface rendering the same thing |
| [`design-rules.md`](design-rules.md) | The rules and the component menu in one file, for an agent that never runs the Storybook. Pointed at from `CLAUDE.md`; the menu is generated from `@neuro/ui`'s exports |
| [`02-bolide-fitness.md`](02-bolide-fitness.md) | Where `@dealpath/ui-components` fits how Neuro builds and where it does not, measured against the pinned version, with the routing for each finding |
| [`03-ownership-and-contribution.md`](03-ownership-and-contribution.md) | Who owns what across DES and GroundUp: the tier rule, how to ask for a component, when one is finished, who re-syncs the tokens |
| [`04-field-controls-and-input.md`](04-field-controls-and-input.md) | Whether `@neuro/fields`' Display and Edit components render through the design system's `Input`, `InputGroup` and `ComboboxV2`: the decision, the per-type mapping and its gaps, and what the fields package then depends on |
| [`05-entity-grid-and-datagrid.md`](05-entity-grid-and-datagrid.md) | Whether Neuro's entity grid moves onto the grid component DES is building: the decision, what a shared component would have to carry, and the AG Grid Enterprise licence state |
| [`06-reference-surface.md`](06-reference-surface.md) | What the Storybook reference covers today: the families with a story and the states each shows, the families with none and why, the request path for a missing one, and the findings writing them produced |

## The short version

`@neuro/ui` re-exports the whole of `@dealpath/ui-components` plus Neuro's own additions, so every library component is already importable from any surface. Most of the product's own components are not: they live inside `apps/dpagentic`, where each reaches the database layer or the Next server runtime, so none renders in isolation. That is the gap, and it matters beyond tidiness: **a component an agent cannot import is a component the agent will rewrite.**

`apps/design-system` is the reference that makes the rules and the available components visible to both staff and agents. Most library families now have a story there; doc `06` lists which do not and why, and doc `01` sequences the extraction that would let the product's own components join them.

## Related, elsewhere

- [`ADR-0009-bolide-token-adoption.md`](ADR-0009-bolide-token-adoption.md) — the Bolide token adoption these docs build on
- [`../../coredata/entity-fields/ADR-0008-schema-naming-and-consolidation.md`](../../coredata/entity-fields/ADR-0008-schema-naming-and-consolidation.md) — the `settings` / `display` split behind the form rules
- [`../views/02-best-practices-and-patterns.md`](../views/02-best-practices-and-patterns.md) — the composition model the Composition rules page summarises
- [`../../../apps/design-system/README.md`](../../../apps/design-system/README.md) — how to run, test, and deploy the app
- `packages/shared/ui/src/styles/sources.css` — the single Tailwind scan list every surface inherits
