# Proposed model: one lens, resolved once, composed by reference

The design in one sentence: a workspace is a stored spec holding **navigation, a home surface, a chrome mode, and a default focus predicate** — all of them pointing at artifacts that already exist — and one resolver picks a person's workspace on each request and hands the shell its shape.

## Eight rules

Stated first because the contract below is only defensible against them.

| | Rule | What it prevents |
|---|---|---|
| **R1** | A workspace narrows what is **offered**, never what is **permitted** | legacy P1 — presentation and permission fused (`01`); `docs/experiences/views/01` P3 one level up |
| **R2** | No workspace carries style. `chrome` is a bounded enum over design tokens | legacy P2 — 51 flags and 37 `option_type`s (`01`, `docs/experiences/views/01` P7–P8) |
| **R3** | A workspace **references** views; it never contains a view spec | the Salesforce parallel-layout-systems failure (`02`) |
| **R4** | Navigation is data with a bounded grammar, validated at save, resolved server-side | legacy P3 — the sitemap is a function nobody can read (`01`) |
| **R5** | One resolution order, one named winner | legacy P4 — four gating mechanisms, no precedence (`01`) |
| **R6** | Specs are portable: no environment-scoped identifiers, ever | the tenant-transfer rule in `CLAUDE.md`; legacy P6 (`01`) |
| **R7** | Preferences stay where they already live | `view_defaults` / `view_favorites` are facts about a pairing, not about a lens (`docs/experiences/views/04`) |
| **R8** | A workspace names destinations; it carries no knowledge of what is inside one | a capability on the shell contract, rather than a section on a view ([ADR-0021](ADR-0021-workspace-view-composition-boundary.md)) |

## The contract

Every workspace carries six things. The split matters: identity and audience decide *whether you get it*; the other four decide *what it is*.

| Part | Contents | Why it is separate |
|---|---|---|
| **Identity** | `handle`, localized `labels`, `description`, `icon` | the description is for humans **and the agent** — a workspace an agent cannot describe is a workspace it cannot navigate (`03`, Nia) |
| **Audience** | assignment rows with a typed principal and a `priority`; the vendor tier is the `is_managed` flag every configuration table already carries | who may enter and what resolves by default; never who may see *data* |
| **Navigation** | an ordered tree of typed nodes | the sitemap, as data |
| **Surfaces** | `home`, `defaultViewByType` overrides | what the app opens on, per workspace |
| **Chrome** | `mode`, `density`, `personalization` | a bounded enum, deliberately small (R2). `mode` selects the FRAME — where navigation sits and the furniture around it — never the content ([ADR-0021](ADR-0021-workspace-view-composition-boundary.md)) |
| **Focus** | `entityTypes`, `predicate` | the default lens over data — a starting point, not a boundary (R1) |

```ts
// packages/shared/fields/src/specs/workspace.ts — Zod, alongside specs/view.ts.
// Save-time validation and the agent's read of "what app am I in" are both this schema.

workspaceSpec = {
  // ── Navigation ────────────────────────────────────────────────────────────
  // Two levels, like Fiori's spaces/pages and unlike Dynamics' three. Two is what
  // legacy actually uses: `useNavItems` returns primary/secondary/footer groups with
  // at most one level of children (CRM → People, Companies). A third level is a
  // deliberate edit here, not an accident of nesting.
  navigation: Array<{
    label: string
    slug: string               // the URL segment this node owns. Tenant-authored, so it is
                               //   validated at save: lowercase kebab, unique among siblings,
                               //   and not a reserved segment (validation rule 6)
    icon?: IconName            // the existing bounded set in apps/dpagentic/src/features/workspaces/nav.ts
    section?: 'primary' | 'secondary' | 'footer'
    children?: NavNode[]       // one level; a node with children has no target
    render?: 'group' | 'tabs'  // how CHILDREN draw: a collapsible sidebar group (default),
                               //   or a horizontal tab strip on the surface itself. One
                               //   presentation hint on an existing shape — not a second
                               //   navigation grammar (`05` §4)
    requires?: Policy          // hide this node when the viewer lacks the policy. For
                               //   SURFACES only (an admin panel) — validation rejects it
                               //   on a node targeting a view or a type. Coherence, not
                               //   control: the route is guarded server-side regardless.
                               //   Introduced by the one case in `05` §1 that needed it.
    target?:                   // exactly one of:
      | { kind: 'view';   handle: string; owner?: string }   // owner completes identity —
                                                             //   handles are unique per owner
      | { kind: 'type';   entityType: string }               // that type's resolved default view
      | { kind: 'route';  route: NamedRoute }                // a bounded enum of app routes,
                                                             //   never a free-text URL (R6)
      | { kind: 'play';   handle: string }                   // an agent play as a destination
  }>

  // ── Surfaces ──────────────────────────────────────────────────────────────
  surfaces: {
    home: string               // the SLUG of a navigation node — not a free target. Home must
                               //   be reachable from the sitemap and must have a URL, and
                               //   naming a node buys both: `/` 302s to that node's path.
                               //   A person's own choice overrides it: a `view_defaults` row
                               //   with context 'home' (the column already anticipates new
                               //   hosts) — which is where legacy's per-user
                               //   `login_landing_page` lands (`01` M5)
    defaultViewByType?: Record<string, ViewRef>      // a workspace-tier default, folded in
                                                     //   BELOW group and user (see resolution)
  }

  // ── Chrome — a bounded enum, and the whole of it ──────────────────────────
  chrome: {
    mode: 'classic' | 'wide' | 'minimal'
    density?: 'comfortable' | 'compact'
    personalization: 'locked' | 'reorder' | 'full'   // may a user rearrange their own nav?
                                                     //   Salesforce makes this per-app (02)
  }

  // ── Focus: a LENS, not a boundary (R1) ────────────────────────────────────
  focus?: {
    entityTypes?: string[]     // which of the tenant's registered types appear in pickers,
                               //   search scoping, and the agent's offered surface
    predicate?: Predicate      // the same predicate AST a `query` view uses (specs/predicate/ast)
    dismissible?: boolean      // default true — a user may clear the focus for a session.
                               //   `false` means "sticky", NOT "enforced": clearing it is
                               //   still not a permission change, and a direct link to a
                               //   record outside the focus still resolves. If a record
                               //   must be unreachable, that is a grant, not a workspace.
  }
}
```

**What is deliberately absent**, each because it has a home already: colors and typography (design tokens), field lists and sections (`ViewDefinition`), which entity types exist (the tenant's registry), product entitlement (`@neuro/flags` and `@neuro/settings`), per-user defaults and favorites (`view_defaults`, `view_favorites`), and role definitions (`docs/coreservices/authz/10`).

## Storage

Two tables, both `configTable` — so both inherit `tenant`, soft delete, the audit stamps, `from_template`, `is_managed`, and `tenantIsolation()` (`packages/tenant/core/src/db/factory.ts:108`).

```text
workspaces               handle (unique per tenant, live rows only), labels, description,
                         icon, spec jsonb, status ∈ draft|published|archived,
                         published_spec jsonb, version int, draft_revision int

workspace_assignments    workspace_handle,
                         principal_type ∈ tenant|group|user|role,
                         principal_id ('' for the tenant tier),
                         priority int,
                         unique (tenant, workspace_handle, principal_type, principal_id)
```

Notes on shape:

1. **`handle` is unique per tenant, not per owner.** This is the one place the workspace model deliberately diverges from `views`. Views are unique per *owner* because two people may each keep a personal "My Pipeline" (`config.ts`, `ux_view_handle`). A workspace is an administered artifact — there is no personal tier — so a handle names one thing and a support conversation about "the underwriting workspace" has a single referent.
2. **`principal_type` gains a fourth value, `role`, that `view_defaults` does not have.** Assignment to a role is how every surveyed analogue does it (`02`), and it is what makes "everyone who is a `deal_lead` gets this app" expressible without enumerating people. It costs nothing: the resolver already has the principal's expanded role set.
3. **`published_spec` is a separate column from `spec`.** Draft editing writes `spec`; publish copies it to `published_spec` and bumps `version`. Readers only ever read `published_spec`. This is what makes "try it before anyone sees it" a property of the storage rather than a convention (`07`).
4. **`draft_revision` and `version` count different things.** `version` is stamped at publish and is the optimistic-concurrency value the publish path compares; `draft_revision` moves on every `saveWorkspace` write and is the value an editing panel has as a hidden field and hands back. Reusing `version` for editing would allow the update it is meant to reject: publish is the only act that moves it, so two admins editing one draft read the same number and both pass the compare. A workspace published once and edited nine times is `version` 1, `draft_revision` 10.

## Resolution

One ordered fold, deliberately the same shape as `resolveViewDefault` so there is one precedence idea in the product rather than two:

The workspace is named **in the path** (`/underwriting/deals`), so on most requests there is nothing to resolve — the segment is the answer, checked against entitlement for chrome adoption (below). The fold runs when the path names no workspace: at `/`, and on unprefixed short links (`/deals`) before their 302.

```text
the path's workspace segment  explicit; entitlement decides chrome adoption, never data
  → the user's last choice     a cookie, like TENANT_COOKIE — a preference, not authority
  → user assignment            principal_type = 'user'
  → group assignments          ranked by priority (higher wins), then by ascending group id,
                               then by ascending workspace handle — all under a PLAIN BYTE
                               COMPARISON, not a locale collation, so two servers in different
                               locales agree
  → role assignments           ranked the same way, over the principal's EXPANDED role set
  → tenant assignment          principal_type = 'tenant'
  → the managed `classic` seed is_managed = true
  → nothing resolved           NOT a shell. A tenant with no openable workspace is a broken
                               tenant and the shell says so; a viewer entitled to none is sent to
                               a stated page (GRO-327)
```

**"Entitled" is defined once, because three things hang on it** — chrome adoption on the explicit path, the cookie rung's validity check, and the switcher's contents. A principal is entitled to a workspace when a **published** `workspace_assignments` row matches them at any tier: their user id, one of their groups, one of their *expanded* roles, or the tenant tier — or when the workspace is the managed fallback. Assignment at any tier is entry; the tiers' ordering decides only the *default*.

**The third tie-break is not decoration.** `view_defaults` needs only two, because its unique index is per principal — one principal, one default, so the only ambiguity is *which of my groups*. `workspace_assignments` is unique per `(workspace_handle, principal_type, principal_id)`, which deliberately lets one group be assigned to several workspaces; that is how a team gets a switcher with more than one entry. So an admin who assigns the `underwriting` group to two workspaces at priority 0 has created a real ambiguity that group id cannot break, because it is the same group. Handle order breaks it deterministically, and the `from` discriminator names the loser's existence in the switcher.

Four properties this has to have, each learned from a specific failure:

- **The result names its winner.** `{ workspace, from: 'group:<id>' }`, exactly as the view resolver returns `from`. Legacy's four ungoverned gates (`01` P4) are the reason: a support question needs an answer that can be looked up rather than reasoned out.
- **There is no last rung below the fold, and that is a change.** This originally read "the last rung is 'no workspace', not an error" — a tenant that had never heard of workspaces got today's shell, which was `03`'s day-one requirement. That requirement is retired by GRO-327: **every tenant has at least one workspace it can open**, enforced by the seed profiles, by a refusal on the two writes that could take the last one away (`guardLastWorkspace`), and asserted where a profile is authored. So resolution returning nothing is one of two facts and neither is a shell — a tenant with none is misconfigured and the layout refuses loudly, and a **viewer** entitled to none is sent to a stated page. The two are separate questions (`03`), and one `null` for both is what let a viewer's missing grant read as a broken tenant.
- **Entitlement gates chrome, not URLs.** A principal not entitled to the workspace a path names still opens the page with its focus applied (the URL-space rules below) — they are simply not *moved into* it: their own sidebar stays, and the cookie is not written. On the cookie rung, a stale value naming a workspace the person is no longer entitled to falls through silently. This is coherence, not security — the workspace grants nothing either way.
- **It composes with `resolveViewDefault` at one named rung.** A workspace's `surfaces.defaultViewByType` is a **fourth tier** in the existing view-default fold, inserted between group and tenant: explicit `?view=` → the user's default → the user's groups' defaults → **the workspace's default** → the tenant default → the managed seed → a synthesized view. Above tenant because a workspace is a deliberate choice about a way of working and the tenant default is the fallback for everyone; below group because a team's agreement about its own view is more specific than the app they happen to be in. `resolveViewDefault` gains one rung and returns `from: 'workspace:<handle>'`; it does not gain a second fold.

Resolution runs once, in the shell layout. It should be wrapped in `React.cache()` — there is no `React.cache()` anywhere in `apps/dpagentic/src/features/` today, which `docs/experiences/views/00` names as a missing request-memoization fix; a workspace resolved independently by the layout and by each page would repeat the same reads per render. Every page under `(shell)` reads the resolved workspace from that one call.

### The read-time cost bound

Tolerant resolution has a naïve implementation that must be refused up front: checking each nav target "still exists" as its own lookup is **N queries per render, growing with the sitemap**. The bound instead:

- **Workspaces add at most two reads to a shell render**: the winning workspace row (with its assignments, one indexed query), and the entity-type registry read on the same addressed context inside that door. Everything else is checked **against lists already in memory**. `getViews` is fetched to build today's sidebar (`(shell)/layout.tsx`) and shared with the resolver through `React.cache`; a `view` or `type` target resolves against those in-memory lists, `route` and `play` targets against static registries. No per-node I/O. The entity types are NOT shared with the layout's copy: that one goes through the preference door and this one through the door the request addressed, and GRO-608 ends the pattern of one request resolving one slug by two rules.
- **The resolved workspace is a serializable value**, computed server-side and passed down as props (the same posture as `ResolvedSection`). The sidebar receives data; it does not interpret a spec.
- **Publish is the only invalidation event.** Readers read `published_spec`, so any caching keyed on `(tenant, handle, version)` is correct by construction — `version` changes exactly when the content does. Nothing needs a TTL guess.

`09-build-specs.md` carries the measurement obligation: the shell's added latency under the load harness, with the DPN-16 numbers as the baseline.

## The authorization interaction

This is the section the rest of the docset exists to protect, so it is stated as a boundary rather than as a mechanism.

**Focus narrows offers. The access plan decides results.**

The mechanism matters more than the sentence, because a rule enforced by discipline decays. **`focus.predicate` is applied by the caller as an ordinary predicate, never by the operation.** A page in a workspace ANDs it into the predicate it passes to `queryEntities`, exactly as it would AND a user's own filter chips. Consequently:

- **`queryEntities` and `getEntity` take no workspace parameter, and never will.** There is nothing to pass, so there is nothing to forget and nothing to accidentally widen.
- The access plan, `permission_rules`, `field_rules`, and RLS are untouched — none of them can see a workspace, because a workspace never reaches them.
- A surface that is not the workspace's — a share link, a print route, an MCP tool call, an agent's direct read — issues the same query it issues today.

That is the structural version of R1: the separation is a fact about the call graph, not a policy someone maintains.

**Therefore a direct link to a record outside the workspace's focus resolves normally**, provided the viewer may read it. That is not a leak; it is the design. A person in the "West Region" workspace sent a link to an East Region deal they have a grant on opens it. If they should not open it, the fix is the grant.

### The URL space

**A workspace owns a path prefix, and its nav nodes own the segments under it.** `slug` on each node makes the URL space tenant-authored data rather than a route table:

```text
/<workspace>/<node>[/<child>][/<record-or-view>]

/classic/deals                       Classic, the pipeline
/classic/properties/PROP-1042        a record
/classic/admin/members               a `render: tabs` child
/underwriting/deals                  a different workspace, same entity type
/agentic/ask                         an agent-forward home
/connect/listings                    a repository-backed surface
```

Today's equivalents are `/e/deal?view=pipeline`, `/v/<handle>`, and `/entity/<id>` — a developer-shaped route space that no tenant can rename. The paths above are what legacy actually shipped (`/app/deals`, `/app/listings`), reached as configuration rather than as a router.

Three rules keep this from being a liability:

1. **Slugs are validated at save**: lowercase kebab, unique among siblings, rejected against a reserved list (`api`, `_next`, and the app's own fixed segments). Tenant-authored strings in a path are a route-collision and open-redirect surface if they are not. The workspace handle and every navigation node's slug are both checked, with one exception: a node whose target is the named route its slug spells leads where that segment leads, so it is allowed; `plays` pointing at `route: plays` is the seeded case.
2. **The unprefixed form resolves and redirects.** `/deals` resolves the reader's workspace and redirects to the exact prefixed URL, so typed and bookmarked short links work and what a reader copies is always the exact form. A slug the resolved navigation does not include stays a 404. A wrong URL that turns into a right one without warning is how a typo produces "the app sent me somewhere else". The redirect is temporary (307 from a Server Component), so the short form keeps working if a workspace renames the node behind it.
3. **The prefix makes a link reproducible.** `/underwriting/deals` means the underwriting workspace's deals surface, with its focus, for everyone, including a reader whose own default is Classic. No extra parameter is needed.

### Focus must be in the URL

`docs/experiences/views/03-requirements-and-user-stories.md` promises Dana that "the pipeline I see is a URL I can send to a colleague, and it opens identically for them" — the cure for legacy pitfall P4, where view state was trapped in Redux and a configured screen could not be linked or reproduced in a bug report. **A focus applied invisibly would break that promise**: two people opening `/v/pipeline` from different workspaces would see different rows, with nothing in the URL to explain the difference, which is P4 restored one layer up.

So: **an applied focus is visible in the URL and shown as a filter chip like any other.** The workspace segment carries it — `/underwriting/deals` is the focused surface for every reader — and clearing it is an explicit `?focus=off`, which is what `dismissible: true` means concretely. Three consequences, all of them wanted:

1. A link carries its focus, so a colleague whose own default is a different workspace opens the identical result set.
2. Clearing is the same gesture as clearing any other filter, and the cleared state is itself linkable.
3. A bug report contains the focus, so "why am I seeing fewer deals" is answerable from the URL rather than from a support session.

**Entitlement splits cleanly here, and the split is worth stating.** A reader who opens `/underwriting/deals` without being assigned that workspace gets **the same rows** — the focus is a filter, it grants nothing and withholds nothing they were entitled to, and refusing to apply it would break the reproduction promise for no security benefit. What they do not get is the **chrome**: they keep their own sidebar and are not moved into the workspace. Data behavior follows the link; identity does not.

The workspace supplies the *default* filter state for its surfaces. It does not supply hidden filter state. That distinction is what keeps focus a lens rather than a second, invisible query layer.

### The tests that pin it

One assertion is not enough, and the obvious single assertion is subtly wrong: comparing "the grid with the workspace" against "the grid without it" *should* differ, because the workspace supplied a filter. Three narrower tests, each able to fail:

1. **The operation is workspace-blind.** `queryEntities` / `getEntity` accept no workspace argument, and the resolved `AccessPlan` for a fixed principal is byte-identical with and without a workspace resolved. This is the one that makes R1 structural; it fails the moment someone threads a workspace into the operations layer.
2. **Same predicate, same rows.** For a fixed principal, `queryEntities` with the focus predicate passed explicitly returns exactly what the workspace's grid returns — proving the grid is applying a predicate, not a privilege.
3. **Direct reach.** A principal in a focused workspace opens a record **outside** the focus, by id, and gets it, provided their plan permits.

Without these the rule is a comment, which is the failure shape recorded in `work-that-cannot-fail`. `08-authoring-and-authorization.md` carries the full test set including the adversarial verification.

**Two corollaries.**

*The agent.* Nia is a principal with its own plan (ADR-0002). The workspace focus shapes what Nia *offers* — which types it searches first, which plays it surfaces — and never why a record is withheld. An agent that cited the workspace as the reason for an omission would be lying about authorization.

*External users.* Jo on Connect is safe because `is_external = true` principals get access only from per-record grants (`docs/coreservices/authz/10`), full stop. The Connect workspace is short because a short app is the right product, not because shortness is a control. Airtable can pair a curated interface with per-viewer filtering precisely because its interface-only users have no base access underneath (`02`); the boundary is doing the work in both products, and here the boundary is grants.

## Validation, and degradation

**At save** (`saveWorkspace`, mirroring `saveView`):

1. Every `view` target resolves to an existing view of a compatible kind, and every `type` target names a registered entity type.
2. Every `route` target is a member of the `NamedRoute` enum — a free-text URL is rejected, which is both an R6 (portability) and an open-redirect concern.
3. `focus.predicate` validates against the predicate AST and against the referenced types' fields.
4. **The stored-oracle guard applies, unchanged in spirit from `views.ts:66`:** a focus predicate touching a field its author cannot read is rejected. A workspace is a stored query the same way a view is, and it would otherwise be an inference channel — the author learns about field values from which records a *reader* sees.
5. `navigation` nests at most one level; every `chrome` member is an enum member.
6. **The handle obeys the same rules as a slug**, because it is the URL's first segment: lowercase kebab, and refused against the reserved list — which includes every fixed segment the app already routes (`e`, `v`, `entity`, `compose`, `print`, `plays`, `query`, `shared`, `agent`, `api`, `sign-out`). A workspace named `entity` would shadow a real route.
7. **`surfaces.home` names an existing navigation node** that carries a target — a home pointing at a group header or at nothing is rejected at save, not discovered at sign-in.

**At read**, nothing throws. A nav node whose target has been deleted resolves to a named disabled state ("this destination no longer exists"), the same tolerant posture `resolveSection` takes with `{ kind: 'unresolved', reason }`. One retired view must not take a tenant's sidebar down. A guard test pins the pairing between `NavTarget['kind']` and the shell's exhaustive switch, in both directions — the drift hazard and its cure are already proven in `apps/dpagentic/src/features/views/components/view-section.test.tsx`.

## Derived chrome: what the shell computes and no workspace configures

Legacy's sidebar carries three constructs beyond navigation, and the trap is modelling them as workspace fields. All three are **derived** — computed from data the shell already has — and putting any of them in the spec would be the first boolean in a new flag bag:

| Legacy construct | What it does | Where it comes from here |
|---|---|---|
| `SidebarEntityMenu` / `SidebarReportMenu` (hover menus) | hovering a type shows **recently accessed** records (or dashboards) and a "New X" action | derived: a recently-accessed store (new, small, per user), starred views from `view_favorites` as the enhancement legacy lacked — per type, for any `type` node, in every workspace |
| `CreateNavButton` (the global "+") | create a record of any permitted type | derived: the tenant's registered types × the viewer's `create` permission. `focus.entityTypes` orders the offers; it does not gate creation |
| `badge: '/assets/images/new.svg'` | a vendor "New" pill on a nav item | **refused as configuration.** Marketing chrome is not tenant data; if the product wants launch pills they are shell behavior keyed on release metadata, not spec fields |

Sidebar collapse state, hover state, and which groups are expanded are ephemeral client state — not preferences, not configuration, not synced.

The rule these three instances share: **if the shell can compute it from existing data plus the viewer's permissions, it is not a workspace field.** A workspace configures what cannot be derived — arrangement, emphasis, and defaults.

### The assistant drawer

The fourth derived control, and the one that arrived from the other direction: it is not a legacy construct being kept out of the spec but a capability the spec used to name and no longer does. [ADR-0021](ADR-0021-workspace-view-composition-boundary.md) removed `agent.placement`, and its Costs section states that a capability belonging in the chrome rather than in a view's content needs a derived-chrome argument or a new mode. This is that argument.

| What it does | Where it comes from |
|---|---|
| a control in the frame's header pulls out a panel holding the conversational surface, on every page of the workspace | derived: whether the runtime has a model, and whether the workspace's home node already targets a view carrying a `conversation` section. `offersAssistant` in `apps/dpagentic/src/features/workspaces/nav.ts` computes it |

On a page that has its own assistant (a record page, whose tools propose field values and run plays), the drawer IS that assistant; there is no second one. One conversation runtime is mounted by the shell layout, above both the drawer's panel and the page, so the page's tools register into the conversation the header control opens (GRO-337). A page reached where no drawer is offered still mounts a runtime of its own.

Two things follow from computing it rather than configuring it. A workspace whose home *is* the conversation is refused the drawer without being named anywhere — a tenant that forks Agentic, or authors its own conversation-home workspace, gets the same answer. And a deploy with no model key draws no control at all, which is the same rule the realtime widget follows: mounted only where the thing behind it exists.

Every frame draws it, `minimal` included. `05`'s exemplar table gives Connect Buy-Side `sidebar` placement, and the create control's argument for being refused there does not transfer — a reviewer asking a question about the one document they were sent is the opposite of a reviewer being handed an application to explore.

## What this replaces in the app

`apps/dpagentic/src/features/workspaces/nav.ts` keeps its icon table (a bounded serializable enum is exactly right) and loses its ordering opinion. `orderEntities` keeps one job — ordering the create menu's offers. `(shell)/layout.tsx` resolves the workspace once and hands its shape to `WorkspaceChrome`, which is the only shell: the tenant-derived sidebar this doc described as the fallback's implementation is deleted (GRO-327), along with the state it served.

Nothing in the views system changes. That is the test of R3: if specifying workspaces required a change to `ViewDefinition`, the two systems would be entangled, and this docset would be describing a second presentation layer rather than a shell over the first.

## Naming

Three collisions, all resolved here rather than discovered later.

**`workspace`.** The product term is **Workspace**. In code, `workspace` already means a bun/Turborepo package in this monorepo, so: tables are `workspaces` and `workspace_assignments`, the spec lives at `packages/shared/fields/src/specs/workspace.ts` beside `view.ts`, and the domain lives at `packages/tenant/core/src/workspaces/`. **No package is named `workspace`** — a `packages/*/workspace` directory would be a bun workspace called workspace, which is the kind of pun that costs an afternoon later.

**`workspace_templates` is the OLD sense of the word and is renamed.** A platform-scoped table of that name already holds tenant *provisioning blueprints* (`packages/tenant/core/src/db/factory.ts:193`), where "workspace" meant a tenant's configured environment. With `workspaces` and `workspace_assignments` landing beside it, the old name reads as "templates for workspaces rows", which it is not. It becomes `tenant_templates` ([ADR-0018](../views/ADR-0018-query-views-and-the-source-registry.md), move 4).

**`focus`, not `scope`.** The data-lens field is named `focus` because `scope` already carries two unrelated meanings in this codebase, and a third would make every occurrence ambiguous:

| Existing | Means |
|---|---|
| `views.scope ∈ personal \| group \| shared` | a view's **audience** |
| `ResolvedChartSection.scope`, `ResolvedAggregate.scope`, `FacetResult.scope` | that a figure covers only the records the reader may see (ADR-0016; `apps/dpagentic/src/features/views/components/scope.tsx`) |

The second is the dangerous one: it is a marker meaning *the access plan reduced this*. A workspace field named `scope` sitting beside it, meaning *a default filter that is explicitly not access control*, would read as the same idea and is the exact opposite of it. `focus` also matches how the capability is described to users — a workspace is how someone focuses on one flow — so the product word and the code word are the same word.

