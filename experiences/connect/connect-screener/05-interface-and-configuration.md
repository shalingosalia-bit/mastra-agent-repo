# Interface and configuration points

## Package identity and boundary

`@neuro/ui`'s Connect screener (`packages/shared/ui/src/connect`) is presentational. It renders the arrival queue, the offering card, the decision bar, the timeline, the resolution review panel and the source setup flow from plain serialisable props. It does not fetch, resolve a tenant, decide a permission, store a cursor, format on a server's behalf, or import a domain package; the container in `apps/dpagentic` reads the arrivals, the record and its field metadata, and passes the results down.

## Public surface

| Export | Kind | Shape |
|---|---|---|
| `ArrivalQueue` | component | `(props: { arrivals?, selection, view, budgets?, onDecide, onOpen, onNext, onPrevious, onLoadMore }) → element` |
| `OfferingCard` | component | `(props: { record?, fields, aggregation?, restricted, locale, timeZone }) → element` |
| `DecisionBar` | component | `(props: { current?, options, write, onDecide, undoWindow? }) → element` |
| `OfferingTimeline` | component | `(props: { entries?, locale, timeZone, rowRenderers, onLoadMore }) → element` |
| `ResolutionPanel` | component | `(props: { resolution?, candidate, subject, write, onAcceptResolution, onRejectResolution, onReverseResolution }) → element` |
| `SourceSetup` | component | `(props: { connection?, scopes, preview?, write, onPreviewSource, onActivateSource, onDisconnectSource }) → element` |
| `HealthBanner` | component | `(props: { health, reason?, recovery }) → element` |
| `TimelineEntryKind` | type | the closed union of [`04-proposed-model.md`](04-proposed-model.md), one registered row renderer per member |
| `WriteState` | type | `'idle' \| { pending: true } \| { failed: string } \| { settled: true }` |
| `RenderBudgets` | type | `{ windowSize?, rowHeight?, cardFieldLimit?, summaryTruncation? }` |

## Ports

**Empty, and stated rather than omitted.** This stack injects no collaborator. A port here would be a database handle, a fetch, a clock read behind the caller's back, or a tenant resolution — every one of which is the container's, and a populated table in a later revision contradicts the kind declared in [`00-connect-screener.md`](00-connect-screener.md) rather than extending it ([`../../../spec-stack-template.md`](../../../spec-stack-template.md), pre-publish checklist item 4). What a caller would reach for a port to supply is a prop instead: the current time arrives as `now` where a relative label needs it, so a story can render "3 minutes ago" deterministically.

## Configuration arguments

The four lifetime groups collapse to two, because a component's interface is its props and its tokens.

### Instantiation-time

The design tokens the components read, which come from the token set in [`design-system/`](../../design-system/00-design-system-reference.md) rather than from arguments a caller passes (CS20).

| Argument | What it changes for the user | Type | Default | Where the value lives | Degenerate value |
|---|---|---|---|---|---|
| colour, spacing, type and elevation tokens | How the whole surface looks, and whether it still matches the rest of the product when the theme changes | DTCG token set | the platform set | [`design-system/`](../../design-system/00-design-system-reference.md) | a missing token resolves to the CSS fallback, so a component renders unstyled rather than failing — which is why a literal colour in a component is a review finding and not a shortcut |
| density | Whether the queue fits more offerings on a screen or gives each one more room. Someone working a long list wants compact; someone reviewing carefully wants comfortable | `comfortable` \| `compact` | `comfortable` | the app shell's theme | an unrecognised value falls through to the comfortable scale; the union is closed so an unrecognised value cannot be passed |

### Operator-tunable

**Empty, and stated rather than omitted.** A threshold, limit, timeout, cap or default with domain meaning inside a component is a business rule in the presentational half, which the kind declaration forbids. Every such value in this surface belongs to [`experiences/connect/05-interface-and-configuration.md`](../05-interface-and-configuration.md) — the resolution thresholds, the dedup window, the timeline page maximum — and reaches a component only as data already shaped by it. The rendering budgets in the props table below are the stated exception, and they are properties of rendering rather than of the domain.

### Tenant-scoped

**Empty, and stated rather than omitted.** What a tenant configures about this surface — which fields appear on a card, which views the screener returns to, the labels the fields carry — is field metadata and view configuration, owned by [`entity-fields/`](../../../coredata/entity-fields/00-entity-fields.md) and [`views/`](../../views/00-views.md) and arriving here as the `fields` and `view` props. A tenant-scoped setting read by a component would be a second configuration surface for the same thing.

### Per-call

The props, slots and callbacks, which are the whole interface. Every collection prop distinguishes absent from empty, because that distinction is what separates "not loaded" from "nothing matched" (CS3, CS4).

| Prop | What it changes for the user | Type | Default | Required | Degenerate value |
|---|---|---|---|---|---|
| `arrivals` | The offerings in the queue. This is the list a screener works through | `Arrival[]` | none | no | `[]` → the empty state, rendered with the filter that produced it; absent → a loading skeleton. Conflating the two is defect class 1's symptom |
| `selection` | Which offering is under the cursor, so the keyboard has somewhere to start and a decision knows what it applies to | `{ id, index }` | none | yes | absent → no row is focused and keyboard navigation has no origin, so the queue is pointer-only; an id not in `arrivals` → the queue renders with no selection rather than throwing (CS11) |
| `view` | The saved filter the screener is working — its columns, its ordering, and the wording of its empty state | `View` | none | yes | absent → the queue cannot render its columns or its empty-state explanation, since both come from the view (CS21) |
| `record` | The offering being shown in detail | `Record` | none | no | absent → the card renders a skeleton; present with no field values → the card renders its labels with empty-value text from the field's `display` settings, which is a real state for a freshly extracted offering |
| `fields` | Which attributes appear, and how each is labelled and formatted. This is what lets a customer's own fields show up on a card with no code change | `FieldDefinition[]` | none | yes | `[]` → a card with a header and no body, which is a misconfigured view rather than an error (CS5) |
| `restricted` | Whether this offering gets its restricted treatment, with the decision buttons shown as unavailable and the reason stated | boolean | `false` | no | `true` → the card renders the restricted treatment and the decision affordances render unavailable with their reason (CS8). Absent must not mean "unknown": the container knows |
| `write` | Whether a decision is idle, in flight, failed or done — so a screener sees their click register, and sees plainly when it did not work | `WriteState` | `'idle'` | no | absent → treated as idle, so an in-flight decision renders as if nothing were happening; the container must pass it (CS9) |
| `current` | The disposition already on this offering, so the decision bar shows what was chosen and offers to change it. Before adoption the container reads it from the consumer's publication row; after, from the record's status field — the component cannot tell and must not try | disposition value | none | no | absent → the decision bar renders as undecided, which is the common initial state, not an error (CS10) |
| `undoWindow` | How long a screener has to take back a decision they made too quickly. This is the safety net for keyboard-fast triage | duration | 10s | no | `0` → no undo affordance renders after a decision, so a mis-keyed decision has no recovery in the surface |
| `entries` | What has happened to this offering — arrivals, decisions, merges — in one timeline | `TimelineEntry[]` | none | no | `[]` → "nothing has happened yet"; absent → a skeleton |
| `rowRenderers` | How each kind of timeline entry is drawn. A kind with no renderer still appears, as an unknown row, so a new event type is visible rather than silently missing | map of kind to renderer | the shipped set | no | missing a kind present in `entries` → that entry renders as an unknown-kind row rather than being dropped silently, so a new kind is visible rather than invisible (CS15) |
| `locale` | The language and number conventions of the person reading, so prices and sizes read correctly for them | BCP 47 tag | the app's locale | no | absent → the platform default, which will format dates and numbers wrongly for some readers rather than failing visibly |
| `timeZone` | The timezone of the person reading, which decides where one day ends and the next begins in the timeline | IANA zone | the reader's zone | no | an invalid zone → falls back to UTC and renders the fallback plainly, rather than silently shifting every label (CS7) |
| `now` | Nothing for a real reader. It lets a test or a design review render a relative time such as 3 minutes ago identically every run | instant | none | no | absent → the component reads the system clock, so a relative label is non-deterministic and its story cannot be asserted; a story passes it |
| `scopes` | The mailbox folders an admin can choose from during setup | `Scope[]` | none | yes | `[]` → the setup flow renders "no folders available", which is a real state for a mailbox with no folders (CS18) |
| `preview` | The sample of offerings an admin is shown before committing to connect a mailbox | `PreviewResult` | none | no | absent → the preview step renders its prompt; present and empty → "nothing would be picked up", which is the state a misconfigured scope produces and must not read as a spinner |
| `health` | Whether a connected mailbox is working, and if not, what the admin has to do about it | `SourceHealth` | none | yes | a state with no `recovery` text → the banner renders the state with no guidance, which is the one case worth failing a type check over (CS18) |
| `budgets.windowSize` | How many rows are drawn at once. It trades memory for smoothness while scrolling a long queue | integer | 40 | no | `0` → nothing renders and the queue looks broken |
| `budgets.rowHeight` | How tall a row is, which is what the smooth-scrolling calculation depends on | pixels | 96 | no | `0` → every row collapses and the virtualiser cannot compute a window |
| `budgets.cardFieldLimit` | How many attributes fit on a card before the rest are left to the detail view | integer | 8 | no | `0` → a card renders its header and nothing else |
| `budgets.summaryTruncation` | How much of a broker's description shows on the card before it is cut short | characters | 240 | no | `0` → the summary is omitted rather than truncated, which changes the card's meaning |

Slots: `ArrivalQueue` takes a `filterBar` and a `emptyState` slot; `OfferingCard` takes a `badges` slot and a `media` slot for the gallery; `SourceSetup` takes a `providerBranding` slot. A slot exists where a consumer supplies markup this stack should not know about; a slot that would supply data is a prop.

## Feature toggles

| Toggle | What it changes for the user | Gates | Default | Blocked on |
|---|---|---|---|---|
| `resolutionReview` | Whether a screener is ever shown "this might be a building you already have" and can act on it. Off, possible duplicates are invisible in the surface | rendering the resolution panel and its affordances at all | off | [`ingest/`](../../../coredata/ingest/00-ingest.md) shipping the probabilistic identity mode; there is nothing to render until a resolution proposal exists to review (CN6). The panel is what a person acts through, so it appears on the proposal, not after the act |
| `liveArrivals` | Whether new deal flow appears in a queue someone already has open, announced rather than silently inserted. Off, they see it on their next refresh | announcing and appending arrivals into an open queue | off | [`livedata/`](../../../coreservices/livedata/00-livedata.md)'s sync landing for this shape; until then the queue is refreshed by the container (CS14) |

Each names its blocker. A toggle with none is a setting or dead code, and a presentational stack should have very few of either.

## Extension points

| Point | Kind | Cost of a new member |
|---|---|---|
| timeline row renderers | open registry | register a renderer for a kind; an unregistered kind renders as unknown rather than disappearing |
| card badges | open registry | supply through the `badges` slot |
| field renderers by primitive | open registry, inherited from [`ui/`](../../../../packages/shared/ui) | the field system's primitives own it; this stack registers none of its own |
| `TimelineEntryKind` | closed union | a review, a renderer, and a story per state. Closed because the timeline's grouping, its keyboard order and its announcements all enumerate the kinds |
| `WriteState` | closed union | a review and a rendering for the new state in every write affordance — four states are what CS9 specifies, and a fifth means every affordance is incomplete until it renders it |

## What is deliberately not configurable

1. **Whether a component fetches** — never. The dependency list contains no HTTP client, so the answer is not a setting.
2. **Whether an unavailable affordance is hidden or shown** — always shown, with its reason (CS8). A hide-instead switch would make Sam's guarantee untestable from the UI and would turn a permission into a layout question.
3. **Date and number formatting rules** — from the locale and timezone props, not from per-component options. Legacy's server-formatted labels are what a configurable answer produces.
4. **The token source** — [`design-system/`](../../design-system/00-design-system-reference.md). A component-level colour override is how a surface stops following the theme.
5. **Whether the queue virtualises** — always. The budget is tunable; the behaviour is not, because a full-queue render is what makes a screener feel slow (CS19).
6. **Focus behaviour on open and close** — fixed (CS13). A configurable answer means some consumer gets it wrong.
