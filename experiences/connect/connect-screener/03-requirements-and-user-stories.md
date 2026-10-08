# Requirements and user stories

Requirement ids take the prefix `CS` and are cited by [`04-proposed-model.md`](04-proposed-model.md), [`05-interface-and-configuration.md`](05-interface-and-configuration.md), the Issues and the stories. `CN` ids belong to [`connect/`](../00-connect.md), and a `CS` requirement cites one where it depends on it.

## The people

| Who | What they need from the screener |
|---|---|
| **Dana** (deal lead) | To work a stack of offerings quickly from the keyboard, decide from the card where she can, and change her mind without asking anyone |
| **Sam** (analyst, restricted visibility) | A surface that shows him accurately what he may see, tells him plainly when an action is unavailable to him, and reveals nothing about what he may not see |
| **Priya** (admin) | A setup flow that shows her what a mailbox would pick up before she commits, and states the connection's health in words she can act on |
| **Ops** | A resolution rendered with its score and the evidence behind it, so a merge can be judged without reading a database |
| **The agent** | A component inventory it can compose, with the states enumerated as stories, so it reuses this surface instead of authoring another one |

## Functional requirements

| # | Requirement | Legacy today | Consumers |
|---|---|---|---|
| CS1 | Every component renders from plain serialisable props, performs no fetch, and imports no domain package | The dashboard holds cursors, loading flags and a loop guard, and drives its own fetches | UI, agents, design-system |
| CS2 | Every component has a story per state, and the stories run with no database | Component tests exist for some; nothing renders without an API | design-system, agents |
| CS3 | A collection prop distinguishes absent from empty, so "nothing arrived" and "not loaded" render differently | Both arrive as an empty array | UI |
| CS4 | Loading, partial, complete and failed are four distinct renderings, and a failure renders its reason | A single error flag on the screen | UI |
| CS5 | A card renders any field from its metadata — label, unit, precision, display settings — with no per-attribute code | A constant per displayable attribute, with separate aggregation and default-value variants | UI, agents |
| CS6 | A portfolio offering renders its properties aggregated, driven by the field's declared aggregation | Present, as hardcoded `SUM` and `MIN_MAX_RANGE` variants | UI |
| CS7 | The timeline groups by calendar day in the reader's timezone, formats labels here, and re-renders on a timezone change with no request | The service groups and formats, in a timezone the client passes as a parameter | UI |
| CS8 | An affordance unavailable to the reader renders as unavailable with its reason, never absent and never mislabelled | A restricted offering arrives relabelled as private, and the client supplies part of the visibility rule itself | Sam, UI |
| CS9 | Every write affordance takes a callback and an explicit state — idle, pending, failed with a reason, settled | Each write component reconciles the screen itself; a write in flight has no rendering | UI |
| CS10 | Setting and withdrawing a disposition are the same affordance, and an undo window is rendered after a decision | Nothing can be withdrawn, because the disposition is a set of flags (CN12) | Dana, UI |
| CS11 | A selection persists across list paging, detail open and close, and remount | Navigating back and re-confirming was the path that produced a duplicate attribution | Dana |
| CS12 | The list is keyboard-navigable: next, previous, open, decide, undo, all without pointing | Pointer-driven | Dana |
| CS13 | Focus moves into a detail view on open and returns to the originating row on close | Not addressed | Dana, Sam |
| CS14 | New arrivals in an open list are announced and do not silently move the selection | Not addressed | Dana |
| CS15 | One timeline component with one row contract; an entry kind is a member of a closed union with a registered row renderer | One feed, built as four components with the entry kind decided by a branch and no extension point | UI |
| CS16 | A resolution renders its verdict, its score and the features it was computed from, and offers acceptance, rejection or reversal as callbacks | Nothing renders a resolution; there is none to render (CN6) | Ops, Dana |
| CS17 | Record detail panels are the shared panels configured for this type, with no per-source wrapper | Four panels are a shared base plus a `Connect*` wrapper that adapts the offering's schema; the location panel has no base and exists only in its Connect form | UI |
| CS18 | The source setup flow renders preview results, the selected scope, and the connection's health state with its recovery path | Present for the mailbox source, inside the app's own screens | Priya |
| CS19 | The list virtualises, and the window size and row height are props with defaults | Not virtualised | UI |
| CS20 | Colour, spacing, type and elevation come from the token set; no component carries a literal | Not audited | design-system |
| CS21 | The saved filter view the screener returns to is a [`views/`](../../views/00-views.md) view rendered by its contract, not a Connect-specific saved view | A Connect-local view resolve-or-create on mount | UI |

## Stories

**Dana.** *"Give me the stack, let me pass or pursue from the keyboard, and let me take it back if I was too quick."* → CS10, CS11, CS12, CS19

**Dana.** *"Open the detail, decide, and put me back where I was."* → CS11, CS13

**Dana.** *"Something new came in while I was reading this one — tell me, don't move my cursor."* → CS14

**Dana.** *"This is a portfolio. Show me the totals, not the first building."* → CS5, CS6

**Sam.** *"Tell me when I can't do something and why, rather than hiding the button."* → CS8, CS9

**Priya.** *"Show me what the mailbox would pick up, then tell me when it breaks and whether I need to re-authorise."* → CS18, CS4

**Ops.** *"Two teams say the same building appeared twice. Show me what the matcher decided and let me reverse it."* → CS16

**The agent.** *"I am composing a deal-flow surface. Show me the components and their states."* → CS1, CS2, CS5

**The design-system reader.** *"Show me the card with no data, with a failure, mid-write, and for a restricted offering."* → CS2, CS3, CS4, CS8, CS9

## Non-functional

- **No component in this stack may be rendered only against a live API.** The check is mechanical: the stories run in CI with no database and no network, and a component with no story for a state does not have that state specified (CS1, CS2).
- **A rendering budget is stated, not discovered.** The virtualisation window and the row height are props with defaults and stated degenerate values ([`05-interface-and-configuration.md`](05-interface-and-configuration.md)); they are the only numeric knobs this stack carries, because a threshold with business meaning here would be a business rule in the presentational half.
- **Sam's negative guarantee is visible as well as enforced.** A restricted offering is either rendered accurately as restricted or not present at all; there is no rendering in which its existence is implied by a count, a gap in a sequence, or a disabled affordance that names it (CS8, and CN11).
- **Every interactive element is reachable and labelled by what it acts on**, so an affordance in a queue announces the offering and not only the verb (CS12, CS13).
