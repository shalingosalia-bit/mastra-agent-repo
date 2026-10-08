# ADR-0021: The workspace arranges navigation; views arrange content

**Date:** 2026-08-20
**Status:** Accepted
**Scope:** neuro
**Extends:** [ADR-0017](ADR-0017-workspaces-are-a-presentation-lens.md) — that ADR decides what a workspace may do to authorization; this one decides what it may know about content. No decision in ADR-0017 changes.

## Context

[ADR-0017](ADR-0017-workspaces-are-a-presentation-lens.md) settled what a workspace may do to authorization. It did not settle what a workspace may know about the contents of the surfaces it names.

`WorkspaceSpec` carries a required `agent` block — `{ placement: 'off' | 'sidebar' | 'primary', plays?: string[], agents?: string[] }`. Three facts about it:

1. `plays` and `agents` are computable from the agent registry, the plays whose declared entity types apply, and the viewer's plan. `packages/shared/fields/src/specs/workspace.ts` states in its header that anything so computable is derived and is not a field.
2. `placement` names a slot the layout system does not have. `WorkspaceChrome` switches on `chrome.mode` and renders one content region per mode. The field is resolved onto the seam, carried through the audit differ, and read by nothing.
3. A `layout` view already holds sections carrying `placement: {x, y, w, h}` and `column`, arranged through a composer, drawn from a registry of section kinds.

`docs/experiences/workspaces/03-requirements-and-user-stories.md` non-goal 8 states the boundary: "Arranging sections and widgets is view composition and already specified. A workspace arranges navigation, not canvases." The `agent` block crosses it.

## Decision

1. **A workspace arranges navigation and names destinations.** Its members are `navigation`, `surfaces`, `chrome`, and `focus`. No member may name a capability, a component, a section kind, or an agent.
2. **Views own arrangement and content.** Which elements appear on a surface, in what order, at what size, in which zone, is a `layout` view's sections and their `placement`.
3. **A capability that needs a place on screen becomes a section kind.** The section registry has no admission rule today; this ADR sets one, matching what `docs/experiences/workspaces/09-build-specs.md` states for `NamedRoute` and `chrome.mode`: a new kind requires a statement of why the existing vocabulary cannot express it.
4. **`agentSurfaceSchema` is removed.** `placement` becomes a section's size and position; `plays` and `agents` are derived at render.
5. **`chrome.mode` selects the frame, never the content.** The frame is where navigation sits and the furniture around it. Nothing else may branch on `mode`.
6. **`chrome.mode` keeps three members and its admission rule.** Adding one costs a shell layout component.
7. **No code branches on a workspace handle.**

## Alternatives considered

1. **Wire `agent.placement` into `WorkspaceChrome`.** Rejected: it fuses `chrome.mode` with agent placement, so a sidebar agent under the `classic` frame becomes unexpressible — the combination `docs/experiences/workspaces/05-exemplar-workspaces.md` specifies for Classic, though the shipped seed and starter both set `placement: 'off'`.
2. **Generalize the workspace into an N-zone system.** Rejected: it duplicates the view composer, and an open-ended arrangement surface on the shell is what `chrome`'s bounded enum exists to prevent.
3. **Keep the `agent` block, unread, until the agent surface is designed.** Rejected: a field in a published contract is read as an intention, and removal costs a migration once it has consumers.
4. **Add a richer `agent` member instead.** Rejected: it keeps content knowledge in the shell contract, and every later capability would claim the same treatment.

## Consequences

**Required by this decision.**

1. Delete `agentSurfaceSchema` and the `agent` member from `workspaceSpecSchema`, the resolver's output shape, the audit differ, the three starter specs, the seeded workspaces, and the test fixtures carrying it.
2. Build a `conversation` section kind before the agent has anywhere to render. Named for the surface rather than the principal: `agent` already denotes an actor kind in `authn`/`authz`, and a section is not an agent.
3. Reseed the two stored specs in the same change: `workspaceSpecSchema` is `.strict()`, so a spec still carrying `agent` is rejected.
4. Amend `docs/experiences/workspaces/04` (the chrome table, the storage sketch, validation rule 5), `05` (the three exemplars), `03`'s agent-forward story row, and `09`'s capability inventory.
5. Record the section-kind admission rule in `docs/experiences/views/08-build-specs.md`. Decision 3 states it; no views doc carries one today, so the rule has no home until this is written.

**Unchanged by this decision.**

1. All of ADR-0017. Focus remains a lens applied by the caller; navigation remains not a control.
2. `chrome.mode`'s three members, its admission rule, and its place on the workspace.
3. Composition by reference (`04` rule R3).
4. The `layout` view's section shape. A `conversation` section carries `placement` and `column` like every other kind.

**Costs.**

1. Enabling an agent surface is authoring a view, not editing one spec field.
2. `agent-forward` was renamed to `wide`, because the mode decides nothing about agents — it means navigation on top, content full width. The phrase survives in prose where it describes a way of working rather than naming the frame.
3. A capability belonging in the chrome rather than the content region has no home here, and needs a derived-chrome argument or a new mode.

## Traceability

1. `packages/shared/fields/src/specs/workspace.ts` — the contract.
2. `packages/tenant/core/src/workspaces/resolve.ts` — the seam that carried `agent` unread.
3. `apps/dpagentic/src/components/workspace-chrome.tsx` — one layout per mode.
4. `packages/shared/fields/src/specs/view.ts` — the section registry.
5. `docs/experiences/workspaces/09-build-specs.md` §Admission rules — the rule decision 3 extends to section kinds.
6. `docs/experiences/workspaces/03-requirements-and-user-stories.md` non-goal 8.
