# Ownership and contribution

Who owns the design system, where a new component belongs, how to ask for one, and when one is finished.

Neuro depends on a design system another team publishes: `@dealpath/ui-components`, nicknamed Bolide, built by the DES team and designed by Henderson Beck's team. Neuro reaches it through `@neuro/ui`, which re-exports it and adds Neuro's own components. `00-design-system-reference.md` and `01-component-extraction.md` cover the in-repo half; this is the cross-team half they assume exists.

**Three of the answers below are proposals, marked as such.** They are the reversible default, written down so work is not blocked on a conversation that has not happened. Each names who confirms it. A proposal a reader acts on and finds wrong is cheaper than a blank section, and it costs nothing to change while nothing depends on it.

## Split it first, then place the halves

Before asking where a component belongs, ask whether it is one component or two. Nearly every one divides:

1. **The presentational half** takes plain serializable props, fetches nothing, and resolves no tenant. A story draws it with no database and no running server.
2. **The container half** resolves the tenant, fetches, and passes props down.

Those halves belong in different places, and answering "where does this go" before splitting sends both to the app. GRO-266 states the pattern and GRO-967 is the worked example: the view section shell moved to `@neuro/ui` while the two bodies that reach an application service stayed behind.

**The check a Builder can run on themselves:** what you are writing is presentational, and it is not going into the Storybook. Then the split has not been done.

## The three tiers, and what decides between them

The rule is **who else needs it**, not who is building it. Ask the question in this order and stop at the first yes.

| Tier | Where | Belongs here when | Publisher |
| --- | --- | --- | --- |
| Bolide | `dealpath/ui-components` | Sunspear or the Excel add-in would use it, or it is a generic primitive any Dealpath product would want — a button, a table, a date picker | DES |
| `@neuro/ui` | `packages/shared/ui` | It draws from plain props and is specific to how Neuro works — an agent card, an `--ai-*` treatment, a field control. **Every presentational half lands here**, whether one surface draws it today or several | GroundUp |
| One app | `apps/<app>/src` | It fetches, resolves the tenant, or arranges a single route — a container, a page layout, a wrapper composing shared pieces for one screen | Whoever built the surface |

**"Only one screen uses it" is not a reason to keep a component in an app.** That is true of every component on the day it is written, and a Builder who answers it literally puts everything in `apps/`, where no story draws it and no other surface can reach it. A component stays in an app for what it *does*: fetching, resolving a tenant, or arranging one route. Never for how many callers it has today.

The Storybook imports nothing from an app: `apps/design-system` declares only `@neuro/ui` and `@neuro/fields`, and nothing in the monorepo depends on an app. So a presentational component left in `apps/` is invisible to every Builder and every agent that reads the reference, which is how the same component gets written twice.

Two corrections that follow, because both mistakes have shipped:

1. **A component in one app that a second app now needs moves up a tier.** It does not get copied. `01-component-extraction.md` is the procedure.
2. **Nothing imports `@dealpath/ui-components` directly.** `@neuro/ui` is the only specifier, so the Storybook renders what the products render. `bun turbo boundaries` rejects the direct import from an app today, because the app does not declare the library — the seam holds on the absence of a declaration rather than on a rule naming it.

Where a Neuro-local name would collide with a Bolide one, Bolide wins: its version carries the product's affordances that a stock copy does not.

## Asking for a component

Three cases, and they go to different places.

### The component does not exist

1. **Decide the tier** with the table above.
2. **Bolide tier** — file on the DES tracker. The request needs: the surfaces that would use it, the states it has to support, the design if one exists, and the date you need it. Absent a design, say so — a component request without one is a request for design work too, and naming that is what stops it stalling silently.
3. **`@neuro/ui` tier** — file on GRO with `type:story`, and build it. Add its story in the same change (`apps/design-system/AGENTS.md`).
4. **App tier** — no separate issue. It rides along with the surface.

Do not build a Neuro-local version of something you have asked DES for. Two implementations of one component is the outcome this whole document exists to avoid, and a local copy removes the pressure that gets the shared one built.

### It exists but is wrong for Neuro

`02-bolide-fitness.md` is the standing record of these, and its findings table already routes each one: absorb it, work around it locally, or send it to DES. A new one joins that document with its evidence, and then follows the same routing.

Send to DES anything that is a property of the library — a prop that fights how consumers use it, a published stylesheet that reaches into a consumer's cascade, a missing `'use client'`. Work around locally anything where the fix would break sunspear. A published component's props are its contract; renaming them is not a request Neuro gets to make cheaply.

A local workaround gets recorded in `packages/shared/ui/src/index.ts`, beside the warnings already there, and its rule goes in `design-rules.md` with the check that catches it or a note that nothing does.

### It is right, but has never been designed for a Neuro-only surface

Agent cards, the `--ai-*` treatments, the withheld and derived states — surfaces Bolide has no equivalent for because sunspear has no equivalent feature.

**Proposal: Neuro designs these and submits them back.** Neuro's own designs go into `@neuro/ui` and are rendered in `apps/design-system`, which makes them a reviewable proposal rather than a fork — Henderson's team can adopt one into Bolide, ask for changes, or decline it, from something that already exists and renders. The alternative, waiting for DES design capacity on a surface only Neuro has, blocks Neuro on another team's queue for work that team has no product reason to prioritise.

Two things this deliberately does not claim: that Neuro's designs are Bolide-quality without review, and that Henderson's team will not want to design these. Confirmed by: Henderson Beck.

## When a component is finished

The bar at which a Builder, or an agent reading the Storybook's MCP endpoint, can use a component without asking a person. All six, or it is not done.

1. **It is exported from `@neuro/ui`.** A component only reachable by a deep path is a component the next agent rewrites.
2. **Its props are typed, and the types are the documentation.** No `any`, and no prop whose meaning is only in a comment. This is what MCP reads — a fabricated prop compiles under `any` and fails silently at render.
3. **It has a story in `apps/design-system/src/stories`**, in the same change. A component with no story is invisible to the next agent.
4. **Every state it has is a story or a story argument** — loading, empty, error, disabled, and whichever of those the component actually has. `Layout.mdx` names the four states a data surface owes a reader.
5. **The a11y panel passes on its story, in both themes.** Every input labelled by `htmlFor`; focus visible.
6. **It reads tokens, never colours.** `styles.test.ts` fails on a token the sheet does not define; it does not catch a hardcoded hex, so that one is on the author and the reviewer.

For a Bolide component the same bar applies, and the check is its own Storybook rather than Neuro's. Where a Bolide component arrives without a story, Neuro's Storybook is where the gap shows, not where it gets fixed.

## Re-syncing the tokens

`packages/shared/ui/src/styles/globals.css` is a verbatim copy of Bolide's sheet, adopted at `6e5eb23` per ADR-0009. Two copies exist by design, and the ordering in `globals.css` means Neuro's wins whatever upstream says.

1. **The owner is whoever bumps `@dealpath/ui-components`.** The bump is the re-sync, because a bump is the only thing that moves the vendored upstream copy.
2. **The check runs itself.** `styles.test.ts` compares Neuro's `:root` against the `@layer base :root` block in the vendored `dist/index.css`, and fails on a value that differs or a token added on either side. So a bump that changes a token fails the suite, and the bump cannot land without either adopting the change or recording the departure.
3. **Adding a departure** means adding the token to the enumerated list in that test with the reason, and to ADR-0009's departures. Both, in the same change — the test is what enforces it and the ADR is what explains it.
4. **Dropping a departure** is the same edit in reverse, and it lands the upstream value.

Three departures exist today: preflight stays on, a `.dark` block exists, and Bolide's four self-flagged migration tokens are not adopted. `02-bolide-fitness.md` finding 6 corrects the stated reason for the first, and finding 7 is why the check in point 2 exists at all.

## Dark mode

Bolide's dark block is commented out upstream and marked "not yet implemented". Neuro's is complete, corrects two colour literals Bolide paints, and is effectively a proposal to Bolide.

**Proposal: offer it upstream, and do not block on the answer.** The work is done and it is a reviewable artifact — `apps/design-system`'s theme toolbar renders any component in both schemes, so DES can see the proposal rather than read it. What Neuro should not do is maintain a growing correction layer indefinitely: `packages/shared/ui/src/styles/bolide-dark.css` needs `!important` and `@layer utilities` to win the cascade, and its header says why that is an exception rather than a pattern. Every literal Bolide adds is another rule in that file.

Two things are unknown and are the reason this is a proposal rather than a decision: whether Bolide wants a dark theme at all, and whether the corrections are complete. On the second, `02-bolide-fitness.md`'s **Not verified** list is explicit — two literals were found by the a11y panel, and whether those are all of them has not been checked. Offering an incomplete theme upstream as complete would be worse than not offering it.

Confirmed by: Henderson Beck, for whether Bolide takes it.

## Chromatic

**One project each, in the Dealpath account that already hosts `ui-components` and `sunspear`.** This is not a new decision: `GRO-267` specifies it, and its Chromatic half is still open on a `CHROMATIC_PROJECT_TOKEN` from whoever administers that account. The publishing workflow exists and its job reports skipped until the secret does.

Separate projects also happen to be the reversible arrangement: two baselines can be merged later, while splitting one shared baseline loses the history on both sides.

## If the library moves into the monorepo

ADR-0009 parked that question deliberately, and nothing above depends on the answer. Every rule here is written in terms of a **role** — the library's publisher, the consuming surface — rather than a repository, so subsumption changes who fills a role and not what the roles are.

What would change on the day it moved: the Bolide tier's publisher becomes whoever publishes from the monorepo, "file on the DES tracker" becomes filing on GRO, and the token re-sync in point 2 above stops existing because there would be one sheet. What would not change: the tier rule, the request contents, the finished bar, and the single-specifier rule.

The open governance question is unchanged and is not this document's to answer: who feeds sunspear and the Excel add-in afterwards. ADR-0009 states the two options and whose call it is.

## Open questions

Each blocks nothing today and each has a proposal above.

| Question | Proposal | Confirmed by |
| --- | --- | --- |
| Does Henderson's team design Neuro-only surfaces, or does Neuro design them and submit back? | Neuro designs and submits back | Henderson Beck |
| Does Bolide want Neuro's dark theme? | Offer it; do not block on the answer | Henderson Beck |
| One Chromatic project or two? | Two, per `GRO-267` — and that half of `GRO-267` is still blocked on a token | Whoever administers the Dealpath Chromatic account |

## Related

- `design-rules.md` — the rules an agent loads before writing a call site
- `02-bolide-fitness.md` — the standing record of where the library fights how Neuro builds
- `01-component-extraction.md` — the procedure for moving a component up a tier
- `00-design-system-reference.md` — the Storybook that makes the finished bar checkable
- `ADR-0009-bolide-token-adoption.md` — the token adoption and the subsumption question it parked
- `apps/design-system/AGENTS.md` — the rules for building a screen
