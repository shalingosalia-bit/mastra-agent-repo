---
type: spec-substack
status: design-only
---
# Connect screener: the triage surface, renderable with no database

The screener is where a person meets inbound deal flow: a list of what arrived, a card that says enough to decide without opening anything, a detail view for when it does not, a disposition they can set and withdraw, a timeline of what has happened to an offering, and the setup flow an admin uses to connect a mailbox. This stack is that surface and nothing behind it. Every value it renders comes from an operation in [`connect/`](../00-connect.md) or from the record itself, passed down as plain serialisable props by a container in the app.

> **Status: design only.** Nothing described here is built on Neuro. The legacy implementation is `sunspear/app/components/connect` — a React surface whose dashboard holds its own pagination cursors, fetch orchestration and loop guards, and whose card body declares a constant per displayable attribute. The substrate is partly built: [`ui/`](../../../../packages/shared/ui) ships the component library and [`design-system/`](../../design-system/00-design-system-reference.md) the token set and its rules; [`views/`](../../views/00-views.md) and [`workspaces/`](../../workspaces/00-workspaces.md) are partly built; [`ingest/`](../../../coredata/ingest/00-ingest.md) is partly built and [`syndication/`](../../../coreservices/syndication/00-syndication.md) is design only, so the operations behind these screens do not all exist yet.

**Kind: presentational.** It owns layout, affordances and the rendering contract, and it must contain no fetching, no tenant resolution, no business rule, and no import of a domain package. It consumes [`ingest/`](../../../coredata/ingest/00-ingest.md) for arrivals, resolution decisions and source connections, [`syndication/`](../../../coreservices/syndication/00-syndication.md) for repository results and adoption, [`entity-fields/`](../../../coredata/entity-fields/00-entity-fields.md) for the record and its field metadata, [`search/`](../../../coreservices/search/00-search.md) for filter and query results, [`views/`](../../views/00-views.md) for the presentation contract the list and detail layouts are instances of, and [`documents/`](../../../coreservices/documents/00-documents.md) for images and memoranda. The reverse never happens: no package here is imported by any of them.

**The claim: the whole surface renders in a story with no database.** Every screen below can be driven from a fixture — a list of arrivals, a record with its field values and metadata, a resolution with its score, a connection with its health — and there is no state in this stack that a fixture cannot supply. If that holds, a designer can change the card without a running API, a test can assert an empty state without seeding a tenant, and an agent composing a surface can reuse these components rather than inventing them. It is falsifiable in the most direct way available: the stories exist and they run with no database, or the kind declaration is wrong. [`06-legacy-functionality-map.md`](06-legacy-functionality-map.md) names each legacy component that cannot meet it today and why.

Secret handling, signed capability tokens, the structured-error envelope, retention declarations, the one-live-row-per-key index and the ledger contract are specified once in [`reference/modernization/23-shared-mechanisms.md`](../../../reference/modernization/23-shared-mechanisms.md). None of them is this stack's concern, and a component that appears to need one is a container hiding inside it.

## Who consumes the capability

- **UI** — the tenant app composes these components into the screener route. It is the only consumer that renders them in production.
- **The design-system reference app** — every component appears as a story with its states, which is what makes the claim above checkable and what agents query over MCP ([`experiences/design-system/00-design-system-reference.md`](../../design-system/00-design-system-reference.md)).
- **Agents** — an agent composing a surface picks these components rather than authoring new ones. It consumes the component inventory, not the rendered result.
- **Data-driven workflows** — none. A flow acts on records and dispositions through operations; it never renders.

## The documents

| Doc | What it settles |
|---|---|
| [`01-legacy-pitfalls.md`](01-legacy-pitfalls.md) | What sunspear's Connect surface teaches, and the constraint each defect imposes |
| [`02-best-practice-research.md`](02-best-practice-research.md) | The settled answers for a triage surface and a presentational package, and what does not apply |
| [`03-requirements-and-user-stories.md`](03-requirements-and-user-stories.md) | The surface per consumer as numbered `CS` requirements |
| [`04-proposed-model.md`](04-proposed-model.md) | The screens, the component inventory, the render contract, and what this module refuses to do |
| [`05-interface-and-configuration.md`](05-interface-and-configuration.md) | The props, slots, callbacks and tokens — and the sections a presentational stack states as empty |
| [`06-legacy-functionality-map.md`](06-legacy-functionality-map.md) | Every legacy Connect component and helper, with a disposition |

Requirement ids take the prefix `CS`. The capability this stack renders is specified as `CN` requirements in [`experiences/connect/03-requirements-and-user-stories.md`](../03-requirements-and-user-stories.md), and this stack cites those ids where a requirement of its own depends on one.

Related: [`connect/`](../00-connect.md), the composition this one renders, which owns no operations of its own and names the stack behind each · [`views/`](../../views/00-views.md), whose [`01-legacy-pitfalls.md`](../../views/01-legacy-pitfalls.md) already covers sunspear's presentation layer in general, so this stack's `01` covers only what is specific to Connect · [`experiences/design-system/01-component-extraction.md`](../../design-system/01-component-extraction.md) for the presentational/container split this stack is an instance of · [`livedata/`](../../../coreservices/livedata/00-livedata.md) for how a changed record reaches an open screen
