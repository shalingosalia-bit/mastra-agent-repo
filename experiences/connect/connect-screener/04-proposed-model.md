# Proposed model: the screens, the component inventory, and the render contract

A presentational stack's model is its rendering contract (not a schema). This document states the screens, the components each is composed from, where every component's data comes from, and the seam at which the container stops and rendering begins. The sections a data stack fills with tables, operations, events, jobs and erasure are stated here as empty, in a line each. An omitted section suggests an oversight; a stated one is the kind declaration holding.

## Data model

**None.** This stack persists nothing and owns no table. Every value it renders arrives as a prop. The render units it is organised around are listed below so a reader can see what a component is responsible for, but none of them is a row.

| Render unit | What one is | Where it comes from |
|---|---|---|
| Arrival row | One thing that arrived, with its source, its outcome and the record it produced | `listArrivals` ([`experiences/connect/05-interface-and-configuration.md`](../05-interface-and-configuration.md)) |
| Disposition row | A judgement the tenant recorded on an offering before adopting it — passed, or a pass withdrawn — with who and when | the consumer's publication row history (`coreservices/syndication/04-proposed-model.md`, R11) |
| Offering card | One record rendered at decision altitude — enough to pass or pursue without opening it | the record's field values plus its field metadata ([`entity-fields/`](../../../coredata/entity-fields/00-entity-fields.md)) |
| Timeline entry | One dated thing that happened to an offering: a disposition change, an arrival, a resolution | the record's change log, the pipeline's arrival log, ingest's recorded resolution decisions, and — for an offering the tenant has not adopted — the consumer's publication row history (`coreservices/syndication/04-proposed-model.md`, R11). The container merges the sources into one list ordered by instant before passing `entries`; the component orders nothing and never sees which source a row came from except through its kind |
| Resolution panel | One resolution decision with its verdict, score and features | `resolveArrival` and its recorded row (CN6) |
| Connection panel | One source connection with its scope, health and recovery path | `connectSource` and the connection read (CN16) |

## The screens

| Screen | Composed from | What the container supplies |
|---|---|---|
| Queue | the filter bar, the virtualised arrival list, the offering card, the decision bar | a page of arrivals with cursors in both directions, the active view, the selection, and a callback per decision |
| Detail | the offering header, the shared record panels configured for this type, the image gallery, the timeline | one record with its field metadata, its documents, and its timeline page |
| Resolution review | the resolution panel, the candidate comparison, the accept, reject and reverse affordances | one resolution with its features, and the two records being compared |
| Source setup | the source picker, the scope selector, the preview list, the health banner | the connection, its available scopes, a preview result, and callbacks for preview, activate and disconnect |

The queue and the detail are instances of [`views/`](../../views/00-views.md)'s presentation contract (not bespoke layouts), and the saved view a screener returns to is a view (CS21). Specific to this stack: the decision bar, the resolution panel and the source setup flow, parts a general view engine has no concept of.

## The central design contract: props in, callbacks out, nothing else

Every component in this stack takes a `props` object that is JSON-serialisable and returns rendered output; every act a reader can take is a callback the container supplied. A component that fetches its own data (as legacy's dashboard and feed container both do) is rejected because it makes each of the four renderings of [`02-best-practice-research.md`](02-best-practice-research.md) reachable only against a live API, and because it puts the failure mode of fetching into the state of rendering (defect class 1 of [`01-legacy-pitfalls.md`](01-legacy-pitfalls.md)).

The constraint that makes this checkable is not a rule in this document. It is three mechanical facts: the package's dependency list contains no domain package and no HTTP client, so an import that would break the contract does not resolve; every component has a story per state and the stories run in CI with no database and no network (CS2); and `05`'s ports table is empty, so there is nothing to inject that could reach a database. A populated ports table in a later revision is the contract being abandoned, and [`../../../spec-stack-template.md`](../../../spec-stack-template.md)'s checklist treats it as a review finding (not a design choice).

**A field is rendered from its metadata, never from a per-attribute constant** (CS5). The renderer reads the field's label, primitive, unit and dimension, precision, prefix and suffix, and its declared aggregation for a portfolio, all of which the field definition already carries ([`coredata/entity-fields/04-data-model.md`](../../../coredata/entity-fields/04-data-model.md)). A card therefore renders an attribute that did not exist when the component was written, and which fields appear on a card is the tenant's view configuration.

**Absence and emptiness are different props (not the same empty array)** (CS3). A collection that is absent means the container has not loaded it and the component renders a skeleton; a collection that is present and empty means nothing matched and the component renders the empty state with the filter that produced it. Legacy cannot distinguish these, so a misconfigured filter looks like an empty mailbox.

**A write is a callback plus a state** (CS9). The four states are supplied, so pending and failed are stories with designs nobody has had to guess. Whether the underlying act is idempotent belongs to the stack that owns the write (CN13); rendering an in-flight decision that survives a remount is this one's.

## Operations

**None.** This stack exports components and types. What a data stack would call an operation is here a callback the container passes in, and the set of them is the interaction contract:

| Callback | Fired when | What the container does with it |
|---|---|---|
| `onDecide` | a disposition is set or withdrawn | before adoption, writes the consumer's disposition on the publication (`syndication/`, R11 — passing creates no record); after adoption, writes the adopted record's status field. The bar renders one affordance; the container decides which operation it calls from whether a record exists, and supplies `options` accordingly — `passed` alone before adoption, the status field's options after — so the bar never offers a value the state cannot hold. It also supplies the undo window (CS10) |
| `onOpen` / `onClose` | a detail view opens or closes | routes, and restores focus to the originating row (CS13) |
| `onNext` / `onPrevious` | keyboard navigation moves the selection | advances within the page, or requests the next page (CS12) |
| `onLoadMore` | the list reaches either end | fetches with the cursor it holds — the cursor is never a prop this stack mutates |
| `onAcceptResolution` / `onRejectResolution` / `onReverseResolution` | a resolution is settled or undone | calls the matching operation (CN6, CN8) |
| `onPreviewSource` / `onActivateSource` / `onDisconnectSource` | the setup flow advances | calls the matching operation (CN18) |
| `onCreateDeal` | a screener promotes an offering | creates the record and the provenance edge (CN13) |

## Events, jobs and erasure

**None of the three, in all three cases.** This stack emits no domain event (an event describes a write, and this stack performs none). It runs no job. It erases nothing, because it stores nothing; a reader's local interface preferences, if any are ever added, are browser-local and are not this stack's state to manage. A component that appears to need any of the three has a container inside it.

## What this module must not do

1. **Fetch.** No HTTP client, no query hook, no connector import. The dependency list is what enforces it.
2. **Resolve a tenant, a principal or a permission.** It renders what it is given, including an affordance's unavailability and the reason for it (CS8). It never decides that unavailability.
3. **Import a domain package.** None of [`connect/`](../00-connect.md), the field system, or the search package. It takes their output as props; the arrow only points one way.
4. **Hold a business rule.** A threshold, a limit, a cap or a window with domain meaning is a rule in the presentational half. The one exception is a rendering budget (a virtualisation window, a truncation length), which is a property of rendering and is declared as a prop with a degenerate value.
5. **Own a cursor, a retry, or a loop guard.** All three belong to the container. A loop guard in a component is the diagnostic that a fetch is inside it.
6. **Receive or render a pre-formatted date, label or masked value.** It formats from an instant in the reader's locale and timezone (CS7), and it renders the value the reader is entitled to see; a service's display substitute is never passed in.
7. **Ship a `Connect*` variant of a shared panel.** With the offering as an entity type, the shared panel configured for this type is the answer (CS17).
