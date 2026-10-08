---
type: spec-stack
status: partly-built
---
# Workspaces: the app shell as configuration

A **workspace** is a stored, named description of how the application presents itself to a person: which navigation they see, which views that navigation points at, what the app opens on, how much of the surface the agent occupies, and what slice of the tenant's data the whole thing is pointed at by default. Workspaces are configuration rows, not code — the same fungibility argument the field system makes for data and the views system makes for presentation, made for the shell around both.

This docset specifies the workspace system for Neuro. It exists because dpagentic today has exactly one shell, its shape is code (`apps/dpagentic/src/features/workspaces/nav.ts`), and the legacy product it must subsume has five overlapping mechanisms doing this job — none of them named, none configurable without a deploy.

## The one-sentence definition

**A workspace is a lens, not a container.** It changes what a person is *offered*; it never changes what they are *allowed*. Records do not belong to a workspace, membership in a workspace grants nothing, and two people in the same workspace looking at the same list can see different rows — because rows come from their access plan, not from the lens.

That refusal is the decision the rest of this docset depends on and is recorded separately as [ADR-0017](ADR-0017-workspaces-are-a-presentation-lens.md), because everything else here depends on it and a later reader needs to find it without reading nine documents.

## Reading order

| Doc | What it settles |
|---|---|
| `01-legacy-pitfalls.md` | the five mechanisms legacy uses to do this job, why each one fails, and the flag-accretion trap that produced them |
| `02-best-practices-and-patterns.md` | the two things the industry calls a "workspace", the six analogues worth copying from, and the admin-authors / user-personalizes seam |
| `03-requirements-and-user-stories.md` | what the system must enable, per persona — including the external Connect user and the agent — and the written non-goals |
| `04-proposed-model.md` | the design: the workspace contract, the navigation model, resolution order, and the authorization interaction |
| `05-exemplar-workspaces.md` | Classic, Agentic, and Connect Buy-Side written **as specs** — the proof that the model needs no per-workspace code |
| `06-legacy-inventory.md` | evidence: what the legacy product actually configures, measured against MySQL and the `major` branch |
| `07-provisioning-and-lifecycle.md` | seeding, forking, draft→publish, versioning, tenant transfer, and the migration off `feature_access` |
| `08-authoring-and-authorization.md` | who may author and publish a workspace, and why that is a new policy rather than a new role |
| `09-build-specs.md` | the resolved shapes, the sequenced build items W1–W6 with their tests, the performance bounds, and the enum admission rules |

## Where things stand today

**Built and working.** The dpagentic shell (`apps/dpagentic/src/app/(shell)/layout.tsx`) builds its sidebar from the tenant's registered entity types, with no hard-coded routes, so a tenant with `fund → deal → property` and a tenant with `loan` and `comp` get their own navigation from one build. Signing in to another tenant builds that tenant's navigation. That is the fungibility claim already made in the chrome.

**Built, and the substrate this depends on.** The views system (`docs/experiences/views/04-proposed-model.md`) supplies almost everything a workspace needs to point at:

- the view contract and its three kinds (`query`, `layout`, `dashboard`),
- `ViewHost = 'page' | 'section' | 'chat'` — the parameter that makes an agent-forward workspace a configuration rather than a second renderer,
- `view_defaults` with a typed principal (`tenant | group | user`), an explicit `priority`, a stated tie-break, and a named winner in the result.

That last one matters more than it looks: workspace resolution has the same shape as view-default resolution, so it reuses that fold rather than introducing a second, subtly different precedence system.

**Missing outright.** Three things:

1. **Navigation is code.** `apps/dpagentic/src/features/workspaces/nav.ts` holds the entity ordering and an icon table matched by substring. It is generic across tenants, which is good, but it is one shape for everyone — a tenant cannot promote Listings, hide Comps, group CRM, or set what the app opens on.
2. **There is one shell.** `chrome`, agent placement, and the home surface are fixed. The demo's agent-forward surfaces (`home-agent.tsx`, `home-chat.tsx`, `play-launcher.tsx`) exist alongside the ordinary shell rather than as a configuration of it.
3. **No default focus.** A person whose job is one region or one fund sees the whole tenant and re-applies the same filter every session. Views have `view_defaults`; the shell has no equivalent.

## The central design idea

One workspace contract, resolved once per request in the shell, composing artifacts that already exist:

| A workspace supplies | It points at | Which already exists |
|---|---|---|
| navigation | view handles and named routes | `views`, the app router |
| what the app opens on | a view reference | `resolveViewDefault` |
| how much surface the agent gets | a placement enum | `ViewHost: 'chat'`, the plays catalogue |
| the default slice of data | a `Predicate` | the same predicate grammar a `query` view uses |

A workspace **composes by reference and authors nothing**. It holds no view specs, no section definitions, no styles, and no field lists. That constraint is what stops it becoming the fourth parallel presentation system — the failure `docs/experiences/views/00` was written to prevent, and the one Salesforce is the standing example of.

## Method and confidence

Legacy figures in `01` and `06` are measured directly rather than quoted: the flag counts come from the local legacy MySQL database and the code shapes from `sunspear` on `major`, both on 2026-08-17, with the queries and file references given inline. Neuro-side claims are verified against `develop` at `3c92d89c` and cited as `file:line`. The industry survey in `02` is drawn from public product documentation and behavior and is marked where it is inference rather than documented.
