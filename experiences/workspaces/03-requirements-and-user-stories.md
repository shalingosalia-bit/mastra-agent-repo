# Workspace requirements, as user stories mapped to the model

What the workspace system must enable, told through the people (and non-people) who use it. The cast is shared with `docs/experiences/views/03-requirements-and-user-stories.md` so the docsets read as one product, with two additions the shell forces into view: a workspace author and an external counterparty. Every story cites its evidence — a legacy mechanism customers actually use, or a measured finding — and names the piece of `04-proposed-model.md` that covers it.

## The cast

| Who | Role | What they touch |
|---|---|---|
| **Priya Raman** | tenant `admin`, holds `manage Workspace` | authors the tenant's workspaces |
| **Dana Okonjo**, deal lead | `member` | lives in the pipeline; opens deals all day |
| **Sam Reyes**, analyst | `member`, restricted from some fields | works the same surfaces as Dana, sees less |
| **Wren Adeyemi**, acquisitions associate | `member`, works one region | wants the app pointed at her slice by default |
| **Marcus Webb**, lender contact | external (`is_external`), read-only | one narrow surface is his whole product |
| **Jo Tanaka**, buy-side principal on Connect | external, from another firm | screens inbound listings; never sees the tenant's pipeline |
| **Nia** | the tenant's AI agent | answers questions by producing views; needs to know what app it is inside |
| **A Neuro developer** | — | adds a workspace without adding a code path |

Grounding scenario: Alpine runs on Classic and never changes it. Six months later its underwriting team asks for a simpler app pointed at active deals; Priya forks Classic, trims the sitemap, sets a focus, publishes it to the `underwriting` group, and nobody deploys anything. A year after that Alpine turns on Connect, and Jo — who works for a different firm entirely — signs in to a surface that shares the deployment and shares nothing else.

## Configuration stories — Priya

| Story | Evidence | Covered by |
|---|---|---|
| As an admin, I define the navigation my tenant sees — order, grouping, labels, what is hidden — without a deploy | `useNavItems.tsx` is 15 hard-coded top-level entries gated four ways (`01` M2, P3) | the `navigation` tree in the workspace contract (`04`) |
| As an admin, I choose what the app opens on, per workspace | `login_landing_page` reaches one setting and is gated through the flag bag (`01` M5) | `surfaces.home` (`04`) |
| As an admin, I point a workspace at a slice of the data — one region, one fund, active deals — so nobody re-applies that filter every morning | no legacy equivalent; the nearest is a saved filter on one grid | `focus.predicate` (`04`), explicitly not a permission |
| As an admin, I compose a workspace out of views that already exist, and I cannot accidentally author a view inside it | Salesforce's parallel layout systems (`02`); `docs/experiences/views/04` collapses three kinds for the same reason | reference-only composition (`04`, rule R3) |
| As an admin, I am told at save time when a workspace points at a view, entity type, or route that does not exist | legacy nav breaks silently; views already validate at save (`views.ts:66`) | save-time validation (`04`) |
| As an admin, when a view a workspace referenced is later deleted, the workspace degrades to a named, visible state rather than a broken sidebar | `docs/experiences/views/01` P5, read side | tolerant resolution (`04`) |
| As an admin, I assign a workspace to a role or a group rather than to twenty people one at a time | Salesforce assigns apps to profiles; Dynamics to security roles (`02`) | `audience` with typed principals (`04`) |
| As an admin, I try a change before anyone sees it | a legacy nav change is a deploy, so it cannot be tried (`01` P3) | draft → publish lifecycle (`07`) |
| As an admin, I decide per workspace whether people may rearrange their own navigation | Salesforce makes this an explicit per-app toggle (`02`) | `personalization` policy (`04`) |
| As an admin, I start from a workspace Dealpath ships and change it, rather than from nothing | Dynamics apps start from a solution's sitemap (`02`) | fork-a-managed-workspace (`07`) |
| As an admin, I never have to configure any of this to have a working app | Notion, Slack, and Linear all work before configuration (`02` §8); `docs/coreservices/authz/10` reaches the same conclusion for permissions | the seeded `classic` workspace, which GRO-327 makes a guarantee: every tenant has at least one workspace it can open, so there is no unconfigured state to fall back from (`04`, `07`) |

## Working stories — Dana, Sam, Wren

| Story | Evidence | Covered by |
|---|---|---|
| As a deal lead, I open the app and it is already the app for my job | today there is one shell for everyone | resolution order (`04`) |
| As a deal lead in two teams, I switch workspaces cheaply, from the chrome | ServiceNow's shell moves between workspaces without separate tabs (`02` §7) | the workspace switcher (`04`), which also names the acting workspace ([ADR-0041](ADR-0041-the-workspace-switcher-returns-to-the-chrome.md)) |
| As a deal lead, which workspace I got is a question with an answer support can look up | four legacy gating mechanisms with no precedence rule (`01` P4); `view_defaults` already returns a named winner | the resolution fold returns `from` (`04`) |
| As an associate working one region, the app opens pointed at my region and I can still leave it | no legacy equivalent | `focus.predicate` as a default the user may clear (`04`) |
| As an analyst, moving to a narrower workspace does not change what I may do — my permissions are identical in both | legacy fused the two: `COLLABORATOR` is both a persona and an authority rung (`01` M4, P1) | the lens/permission separation ([ADR-0017](ADR-0017-workspaces-are-a-presentation-lens.md)) |
| As an analyst, a workspace that hides a type from my navigation does not stop a link, a search result, or the agent taking me to a record of that type I may read | hiding as security is `docs/experiences/views/01` P3 one level up | focus narrows offers, never results (`04`) |
| As a user, my personal view defaults and starred views survive a workspace switch | preferences are facts about me, not about the lens (`docs/experiences/views/04`) | workspace holds no per-user preference state (`04`) |
| As a user, I choose what I open on — a dashboard, a view — overriding the workspace's home | legacy's `login_landing_page` + reporting-dashboard-id is per-user (`01` M5) | a `view_defaults` row with context `'home'` resolves above `surfaces.home` (`04`) |

## Agent-forward stories — Dana and Nia

| Story | Evidence | Covered by |
|---|---|---|
| As a deal lead in an agent-forward workspace, the agent is the primary surface and the app's own views are what it answers with — not prose, not a chat-shaped imitation of a table | `ViewHost: 'chat'` is already in the model; the generative-UI direction (`02`) | a `conversation` section on the view the home destination resolves to, + `chrome.mode` ([ADR-0021](ADR-0021-workspace-view-composition-boundary.md)) |
| As a deal lead, an answer the agent renders can be pinned, opened as a page, and filtered — because it is the same view | the resolved section shape is serializable data, not a query (`docs/experiences/views/04`) | no new render path (`04`, rule R8) |
| As Nia, I can read a description of the application I am inside — what surfaces exist, what they are for — so I can navigate and hand off to them | legacy has no description of the app for a non-human (`01`) | `description` and labels on the workspace and every nav node (`04`) |
| As Nia, the workspace's focus predicate is applied to what I offer, and it is not the reason a record is withheld | an agent is a principal with its own plan (ADR-0002) | focus is a lens for the agent too (`04`) |
| As a deal lead, an agent-forward workspace is not a less legible one — I still see what it plans, what tools it used, and how to correct it | the enterprise agent-UX pattern set (`02`) | an obligation of the agent surface, not of chrome — stated as a non-goal below |

## External stories — Marcus and Jo

| Story | Evidence | Covered by |
|---|---|---|
| As an external contact, the application I see is small and obviously not the customer's whole product | legacy does this with `isCollaborator` and an eight-type deny set (`01` M3) | a workspace with a short sitemap (`05`, Connect) |
| As an external contact, nothing I am shown depends on the sidebar being short — I could not reach the rest if I tried | Airtable is safe because interface-only users have no base access (`02`); `is_external` principals get access only from per-record grants (`docs/coreservices/authz/10`) | focus is never the boundary ([ADR-0017](ADR-0017-workspaces-are-a-presentation-lens.md)) |
| As a buy-side principal, I screen inbound listings against my criteria and never see the distributing firm's pipeline | Dealpath states publicly that ~65% of institutional sales volume flows through Connect, with buy-side engagement on ~60% of distributed listings (company claim, not measured here) | the Connect exemplar (`05`) |
| As a security reviewer, I can state in one sentence why an external user is safe, and the sentence does not mention navigation | `01` P1 — legacy cannot separate the two | the separation, and the test that proves it (`08`) |

## Provisioning stories — the platform

| Story | Evidence | Covered by |
|---|---|---|
| As Control Plane, a newly provisioned tenant has a working workspace on day one without anyone configuring one | `CLAUDE.md` provisionability rule; `packages/tooling/seed` | the seeded managed `classic` workspace (`07`) |
| As Control Plane, a tenant can be exported and imported without its app shape breaking | `CLAUDE.md` tenant-transfer rule; legacy's shape lives partly in a deploy artifact (`01` P6) | portable specs, no environment-scoped identifiers (`07`) |
| As a migration engineer, a legacy team's `feature_access` row set maps onto a workspace rather than onto 51 new flags | 51 flags × 55 teams, 676 on (`06`) | the migration mapping (`07`) |
| As a Neuro developer, I add a new exemplar workspace without adding a branch to the shell | if a workspace needs code, the model is wrong | `05` is the proof obligation |

## Non-goals — the refusal boundary

Written down because each is a thing a reasonable person will ask for, and each would break something:

1. **A workspace does not own records, and joining one grants nothing.** Containment is tenancy; sharing is `views.scope` and `group_members`. See [ADR-0017](ADR-0017-workspaces-are-a-presentation-lens.md).
2. **A workspace does not carry style.** No colors, fonts, spacing, or per-instance presentation state. `chrome` is a bounded enum over design tokens. This is where legacy's 51 flags and 37 reporting `option_type`s came from (`01` P2, `docs/experiences/views/01` P7–P8).
3. **A workspace does not author views, layouts, sections, or field lists.** It references them. Anything else recreates the parallel-systems failure.
4. **A workspace is not a feature-flag store.** Product entitlement (does this tenant have Connect at all?) stays with `@neuro/flags` and settings; a workspace decides what an entitled tenant's app *looks like*. Conflating them is `01` M1.
5. **A workspace does not decide entity-type enablement.** The tenant's registered entity types answer that once (`01` P5). A workspace may omit a type from navigation; it may not un-register it.
6. **A workspace does not define agent behavior, tools, guardrails, or the honesty obligations of the agent surface.** It decides how much room the agent gets. Everything else belongs to the agent design.
7. **No per-workspace preference storage.** Personal defaults, starred views, and favorites are facts about a person and already have homes (`docs/experiences/views/04`). A workspace that duplicated them would let them disagree.
8. **Not a page builder.** Arranging sections and widgets is view composition and already specified (`docs/experiences/views/04`, drag-drop). A workspace arranges *navigation*, not canvases.
