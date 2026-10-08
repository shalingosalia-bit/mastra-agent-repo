# Three exemplar workspaces, written as specs

This doc is a proof obligation, not a catalogue. If Classic, Agentic, and Connect Buy-Side can each be expressed as data under the contract in `04` — with no branch in the shell, no new component, and no new view kind — the model holds. Where one of them strains the contract, that strain is named here rather than smoothed over, because a strain found now is a design correction and a strain found later is a code path.

All three ship `is_managed = true` as part of the tenant profile (`07`). A tenant forks one to author its own.

None of them carries an agent field. [ADR-0021](ADR-0021-workspace-view-composition-boundary.md) puts the agent where arrangement is authored: `surfaces.home` names a navigation node, and that node's target may be a type, a route, or a view. Where it is a view, a `conversation` section on that view is what gives the assistant a place and a size. Agentic's `Ask` node below still targets a route, so this exemplar does not yet show that arrangement; GRO-244 converts it to a layout view carrying the section, and that conversion is what makes the exemplar match the decision.

The `primary` placement in the table below is that section. The two `sidebar` placements are the **assistant drawer** — a control in the frame's header pulling out a panel beside the page, derived rather than configured (`04`, "The assistant drawer"). So the table's agent row describes an outcome the shell computes: a workspace whose home carries the conversation gets `primary` and no drawer, and every other workspace gets the drawer. Neither is a field, and neither names a workspace.

## 1. Classic — the app the legacy product is

**The job:** a customer migrating from Dealpath opens Neuro and recognizes it. This is the workspace that has to exist before any tenant can be moved, and it is the one that must be *boring*.

```yaml
handle: classic
labels: { en: "Classic" }
description: >
  The full application, arranged the way Dealpath arranges it: entity types in the
  primary sidebar, CRM and reporting grouped below, the assistant available but not
  in the way.
icon: grid

navigation:
  - { label: Deals,           slug: deals,          section: primary, icon: deal,       target: { kind: type, entityType: deal } }
  - { label: Assets,          slug: assets,         section: primary, icon: property,   target: { kind: type, entityType: asset } }
  - { label: Properties,      slug: properties,     section: primary, icon: property,   target: { kind: type, entityType: property } }
  - { label: Loans,           slug: loans,          section: primary, icon: loan,       target: { kind: type, entityType: loan } }
  - { label: Comps,           slug: comps,          section: primary, icon: comp,       target: { kind: type, entityType: comp } }
  - { label: Investments,     slug: investments,    section: primary, icon: investment, target: { kind: type, entityType: investment } }
  - { label: Funds,           slug: funds,          section: primary, icon: fund,       target: { kind: type, entityType: fund } }
  - { label: Funding Events,  slug: funding-events, section: primary, icon: generic,    target: { kind: type, entityType: funding_event } }
  - label: CRM
    slug: crm
    section: secondary
    render: group
    children:
      - { label: People,      slug: people,    icon: person,  target: { kind: type, entityType: person } }
      - { label: Companies,   slug: companies, icon: company, target: { kind: type, entityType: company } }
  - { label: Reporting,       slug: reporting,   section: secondary, target: { kind: view,  handle: tenant_dashboard } }
  - { label: Assignments,     slug: assignments, section: secondary, target: { kind: route, route: assignments } }
  - label: Admin
    slug: admin
    section: footer
    render: tabs                                 # the horizontal strip (§4)
    children:                                    # `requires` sits on the LEAVES — the strain below
      - { label: Members,      slug: members,      requires: manage FieldConfig, target: { kind: route, route: team_members } }
      - { label: Templates,    slug: templates,    requires: manage FieldConfig, target: { kind: route, route: team_templates } }
      - { label: Integrations, slug: integrations, requires: manage FieldConfig, target: { kind: route, route: team_integrations } }

surfaces:
  home: deals            # legacy's universal default landing page — `/` 302s to /classic/deals.
                         # A person's own choice overrides it: a view_defaults row with
                         # context 'home', which is where legacy's login_landing_page lands

chrome: { mode: classic, density: comfortable, personalization: reorder }
focus: {}                                    # the whole tenant — Classic hides nothing
```

**What replaced what.** Every `display:` ternary in `useNavItems.tsx` (`01` M2) is gone, and it is worth being precise about where each one went, because "it's configuration now" is only true if each mechanism has a destination:

| Legacy gate | Where it goes |
|---|---|
| `featureAccess.assets` / `loans` / `comps` / `funds` / `investments` | the tenant's registered entity types. A type that is not registered has no node to omit — the seed writes the workspace for the types the tenant actually has (`07`) |
| `EntityUtils.isEntityTypeEnabled()` | same place. The two mechanisms collapse to one (`01` P5) |
| `featureAccess.reportingDashboards` / `classicReporting` | one `Reporting` node pointing at a view. Two reporting products was a migration artifact, not a customer requirement |
| `featureAccess.dpConnect` | not a gate on a node — a separate workspace (§3) |
| `isCollaborator` | not a gate on a node — a separate workspace, and the access half stays in `is_external` |
| `MEMBER_LEVEL.ADMIN` / `ADMIN_PLUS` on the admin link | `manage`-policy-gated node visibility, resolved from the principal's plan rather than an integer rung |
| `{ label: 'My Dashboard', display: 'exclude' }  // NYI` | deleted. Configuration has no place to put a permanently-off node |
| `SidebarEntityMenu` / `SidebarReportMenu` hover menus, `CreateNavButton` | **derived chrome** (`04`) — computed from views, favorites, recents, and the viewer's `create` permission, for every workspace, configured by none |
| `badge: '/assets/images/new.svg'` | refused as configuration — marketing pills are not tenant data (`04`, derived chrome) |
| `user_settings.login_landing_page` (+ dashboard id) | a `view_defaults` row with context `'home'` — the per-user override of `surfaces.home` (`01` M5) |

**The one strain.** The admin footer link is genuinely gated by *permission*. An admin panel offered to a `member` is a dead end. This is the one legitimate case for a node whose visibility depends on the viewer's plan: **a nav LEAF may declare a required policy (`requires: 'manage FieldConfig'`), and an unsatisfied policy hides it.** That is a coherence affordance (the route itself is guarded server-side regardless, and the R1 test in `04` still has to pass). If this affordance ever appears on a node targeting *records*, it has been misused.

The policy is on the leaves, because `saveWorkspace` blocks it on a group: "navigation node 'admin' has a requires but no target; a group header offers nothing to guard" (`packages/tenant/core/src/workspaces/save.ts`, rule 4). The visible result is the same (`resolveNode` returns null for a group whose every child the viewer's plan hides), and the rule keeps the affordance attached to something a policy can be about.

## 2. Agentic — the app the recommendation argues for

**The job:** the product delivers outcomes rather than screens. The recommendation's framing is that the deal lifecycle ships as *plays* — "keep this deal current", "draft the memo", "reconcile the quarter" — with autonomy scaled to confidence and source, timestamp, and confirmer recorded on every write (`apps/dpagentic/src/features/plays/plays.ts`). This workspace is what that looks like when it is the whole app rather than a panel.

The interesting claim: **this costs no new rendering.** `ViewHost = 'chat'` already exists, resolved sections are serializable data, and the agent answers a data question by rendering the product's own view — so "pin this" is persistence and "open as page" is a URL (`docs/experiences/views/04`). What changes is placement and what the app opens on.

```yaml
handle: agentic
labels: { en: "Agentic" }
description: >
  The assistant is the primary surface. You state an outcome; the agent works and
  answers with the product's own views, which you can pin, filter, and open as pages.
  The record surfaces are still here — they are the second click, not the first.
icon: generic

navigation:
  - { label: Ask,         slug: ask,        section: primary, target: { kind: view,  handle: agentic_home } }
  - { label: Plays,       slug: plays,      section: primary, target: { kind: route, route: plays } }
  - { label: For Review,  slug: review,     section: primary, target: { kind: view,  handle: open_proposals } }
  - { label: Pinned,      slug: pinned,     section: primary, target: { kind: route, route: starred_views } }
  - { label: Deals,       slug: deals,      section: secondary, icon: deal,     target: { kind: type, entityType: deal } }
  - { label: Properties,  slug: properties, section: secondary, icon: property, target: { kind: type, entityType: property } }

surfaces:
  home: ask              # `/` 302s to /agentic/ask

chrome: { mode: wide, density: comfortable, personalization: locked }
focus:
  entityTypes: [deal]                                    # amended — see "What shipped" below
  predicate: { field: stage, op: not_in, value: [closed, dead] }
  dismissible: true
```

**Four things this exemplar establishes.**

1. **`For Review` is the pattern that makes agent-forward honest.** An agent that proposes rather than writes needs a queue of proposals; autonomy scaled to confidence (play principle P3) is only real if the low-confidence half is visible, sortable, and reviewable rather than a feed. It is a view — `open_proposals`, a query over the `proposals` collection source — which is what the source registry bought.
2. **`personalization: locked` earns its place here.** Classic is a starting point people rearrange; an agent-forward workspace is a designed flow whose shape carries meaning. This is exactly the case Salesforce made per-app rather than global (`02`).
3. **`plays` is a subset, not a switch.** Six of the eight catalogued plays are not runnable — the model cannot yet carry what they produce, and `plays.ts` says so plainly. A workspace listing all eight would be a demo pretending to run a play it cannot run, which the code comments already refuse. Listing the runnable two is the honest configuration.
4. **Chrome mode does not buy honesty.** Planning visibility, tool-use disclosure, and recovery routing (`02`) are obligations of the agent surface wherever it is placed, including a narrow `conversation` section beside a grid. `chrome.mode` decides where navigation sits; it decides nothing about what the agent discloses, and nothing about the content of the page. That separation is a non-goal in `03` and is repeated here because `chrome.mode` is precisely where someone would be tempted to put it.

**What shipped, and the two places it differs from the block above.** This exemplar is seeded — `packages/tooling/seed/src/profiles/managed-views.ts` builds it from each demo profile's own records — so the block is a specification with a build behind it rather than a sketch. Two amendments, both found by building it:

1. **`Ask` is a VIEW, not a route.** [ADR-0021](ADR-0021-workspace-view-composition-boundary.md) makes a capability that needs a place on screen a section kind, so the agent home is a `dashboard` view (`agentic_home`) whose sections are a `conversation` and a `plays` roster, placed and sized like any other tiles. The workspace names a destination; the view arranges what is inside it. `agent_home` remains a `NamedRoute` and still draws the app's own conversation home — a workspace may point at either, and the difference is whether the arrangement is authored.
2. **The focus is `[deal]`, not `[deal, property]`.** A focus predicate is applied to every type the focus names, so it must be evaluable on all of them, and `saveWorkspace` now refuses a predicate naming a field one of the focused types does not have. `stage` is a deal field; properties have no lifecycle to be closed or dead. A lifecycle predicate therefore goes with a focus over the type whose lifecycle it is, and properties are offered whole. The chip says "Agentic shows deals", which is the truth about what was narrowed.

**The strain named here is resolved.** Four of this workspace's five nav nodes used to be `route` targets — `agent_home`, `plays`, `proposals`, `starred_views` — against a bounded enum of app routes, and `For Review` violated the bound the model wants (*a route target is for a surface that is genuinely not a view*) because no collection source was registered. Both halves are now closed:

- `For Review` is `{ kind: 'view', handle: 'open_proposals' }`, a query view over the `proposals` collection source ([ADR-0018](../views/ADR-0018-query-views-and-the-source-registry.md)) — the one-line change that was the test of whether composition by reference is real. `proposals` left `namedRoutes` in the same change, so the enum shrank.
- `09-build-specs.md` carries the route enum's admission rule, and `docs/experiences/views/08-build-specs.md` now carries the section registry's — the two enums this design can rot through, each with a rule a reviewer can hold a pull request against.

Two nodes remain routes and belong there: `plays` is the catalogue of what the product can do rather than a set of records, and `starred_views` is a per-reader preference list rather than a stored view.

## 3. Connect Buy-Side — the app for someone from another firm

**The job:** a buy-side principal at a different company screens listings distributed by brokers, against their own criteria, and adds what interests them to their pipeline. Dealpath states publicly that roughly 65% of institutional sales volume now flows through this exchange, with buy-side teams engaging on about 60% of the listings distributed through it. Those are company figures rather than measurements made here, but they are the reason to treat this as a real product surface rather than an illustration.

```yaml
handle: connect        # the URL's first segment — /connect/listings — so kebab, like every handle
labels: { en: "Listings" }
description: >
  Inbound listings matched to your investment criteria. Screen them, express
  interest, and move what fits into your own pipeline.
icon: generic

navigation:
  - { label: Listings,    slug: listings, section: primary, target: { kind: view, handle: matched_listings } }
  - { label: Watching,    slug: watching, section: primary, target: { kind: view, handle: watched_listings } }
  - { label: My Criteria, slug: criteria, section: secondary, target: { kind: route, route: listing_criteria } }

surfaces:
  home: listings         # `/` 302s to /connect/listings

chrome: { mode: minimal, density: compact, personalization: locked }
focus:
  entityTypes: [listing, deal]
  dismissible: false
```

**Why this is the forcing function.** It is the case where a lens-shaped design most wants to become a security mechanism, and where doing so would be worst. The sentence that has to be true, and has to be checkable:

> Jo sees only her matched listings because `is_external = true` principals hold access solely through per-record grants (`docs/coreservices/authz/10`). She sees a short sidebar because a short app is the right product for her.

Two independent facts. If the second one ever becomes the reason for the first, the design has failed. Three consequences follow:

- **`dismissible: false` is not enforcement.** It means the focus does not offer a "clear" affordance, because clearing it would be meaningless for someone who has no other grants. Reading it as a control is the misreading to guard against — hence its comment in the contract (`04`).
- **T1 is mandatory here.** For an external principal, the resolved `AccessPlan` must be byte-identical with and without the workspace. If it differs, the workspace is doing access control and the review should stop.
- **This workspace's surfaces are views, almost entirely** — which is what makes the safety argument short: there is no bespoke external surface to audit separately.

**The genuine gap this exposes, and it is larger than an entity type.** A listing is not a record in the consuming tenant. It is a **publication in a platform-plane repository outside any tenant's database**, which a consumer browses and then *tags in* as a **remoted entity**: a snapshot whose provider-sourced fields are read-only and refreshable, with the publisher retaining ownership, updates flowing as refreshes, and revocation freezing the consumer's copy without deleting it. That capability is specified in `docs/coreservices/syndication/` (see `01-use-cases.md` UC1, `02-sharing-model.md`, and R2 "repository browse and matching" in `03-requirements-and-user-stories.md`); [ADR-0029](../connect/ADR-0029-connect-capability-boundary-and-listings-repository.md) places the repository there and makes this workspace the whole of Connect's buy-side surface.

Three things follow for this exemplar, and they are the reason `07` sequences Connect last:

1. **`matched_listings` is not a `query` view over tenant records.** Before tag-in it is a query against the repository, filtered by the tenant's own criteria records — the same shape as the `For Review` gap in §2, and the same fix: a collection source registered on the ADR-0018 registry. The spec half exists after W0; the registration does not.
2. **`watched_listings` and everything after tag-in *are* ordinary tenant records** (remoted entities), so they are ordinary views. The workspace's sitemap therefore straddles the two, which is exactly what a lens should be able to do and worth proving.
3. **The workspace part really is small** — a sitemap, a home, a chrome mode, and an entity-type focus. Every hard problem here belongs to syndication, not to workspaces. That division is the point: this exemplar exists to check that the workspace model does not need to grow to accommodate a repository-backed surface, and it does not.

## 3b. Connect Sell-Side: the app for a brokerage

**The job:** a broker authors listings as records in their own tenant, runs their marketing process against them, publishes selected ones to chosen audiences with a per-field disclosure set, and watches engagement. This is one of the two publisher paths §3 consumes: the intended one, alongside the platform-operated intake publisher that includes brokers who are not tenants ([ADR-0029](../connect/ADR-0029-connect-capability-boundary-and-listings-repository.md) decision 4). It is the fourth exemplar `09-build-specs.md` asks for: the one the model can accommodate with no additional code.

```yaml
handle: broker
labels: { en: "Listings" }
description: >
  Your listings, from intake to close. Publish an offering to the investors
  you choose, keep it current, and see who engaged.
icon: generic

navigation:
  - { label: Listings,   slug: listings,   section: primary,   target: { kind: type,  handle: listing } }
  - { label: Published,  slug: published,  section: primary,   target: { kind: view,  handle: published_listings } }
  - { label: Audiences,  slug: audiences,  section: secondary, target: { kind: route, route: audiences } }
  - { label: Engagement, slug: engagement, section: secondary, target: { kind: view,  handle: publication_engagement } }

surfaces:
  home: listings

chrome: { mode: classic, density: comfortable, personalization: reorder }
focus:
  entityTypes: [listing, contact]
  dismissible: true
```

**Why it is different from §3.** A broker is an ordinary tenant with an ordinary `listing` type, so almost everything here is Classic wearing a different sitemap. `Listings` is the type itself: a pipeline over the broker's own records with their marketing stages as the status field. `Published` is a view over a collection source on the ADR-0018 registry (the tenant's own rows in `publications`): the publication's state lives in the repository and nowhere else, so a record stores no copy of it to filter on. `Engagement` is a `dashboard` view over `publisherEngagement` (`../../coreservices/syndication/05-interface-and-configuration.md`), a collection source on the ADR-0018 registry like §3's repository query. `Audiences` is a route because audience curation is `syndication/04` open question 1 and has no view kind yet.

**The strain, named.** Publishing needs a disclosure-set editor: pick an audience, then per field choose full, redacted or hidden. That is a form, and no existing section kind renders "a field rule per field of this record". But it is not sell-side-specific (a tenant admin setting internal field visibility needs the same editor), and `syndication/02` puts disclosure in the field-rule vocabulary for exactly this reason. So the component is new and shared across contexts; the row below records it.

## 4. The horizontal sub-menu, and where it lives

Legacy draws a horizontal strip of tabs under the header in at least three unrelated implementations, and separating them is what decides where each lands here.

| Legacy construct | Size | What it navigates |
|---|---|---|
| `NavTabsList` (`components/common/`, from `@dealpath/ui-components`) | 42 lines, ~12 call sites | sections of an admin or settings area — Members, Templates, Integrations, Bulk Tools |
| `BaseHorizontalBarMenu` + `DashboardTopBarMenu` | 336 + 729 lines | the entity dashboard's own toolbar — view select, group/configure, bulk actions |
| `InfoViewNavigation` / `InfoViewToolbar` | 1,608 lines across 9 files | tabs across one record — overview, files, tasks, activity |

`NavTabsList` has the right shape and the wrong sourcing: every one of its ~12 consumers hand-writes its own `navLinks` array in code, which is `useNavItems`'s disease one level down (`01` M2). The other two are bespoke.

**Two of the three are workspace navigation, and they need no new grammar.** A parent node with children already exists; `render: 'tabs'` on that node says its children draw as a horizontal strip on the surface rather than as a collapsible sidebar group. The URL falls out of the slugs:

```yaml
- label: Admin
  slug: admin
  section: footer
  render: tabs
  children:                               # §1's affordance, on each leaf that earns it
    - { label: Members,      slug: members,      requires: manage FieldConfig, target: { kind: route, route: team_members } }
    - { label: Templates,    slug: templates,    requires: manage FieldConfig, target: { kind: route, route: team_templates } }
    - { label: Integrations, slug: integrations, requires: manage FieldConfig, target: { kind: route, route: team_integrations } }
```

→ `/classic/admin/members`, `/classic/admin/templates`. One field, one component, every admin area and settings area covered — replacing twelve hand-written arrays.

**The third is not workspace navigation and must not be modelled here.** Tabs across a single record are a `layout` composition: the sections already exist, and whether they stack or tab is a *layout* presentation hint belonging to `docs/experiences/views/04-proposed-model.md`, exactly as `display.mode` is for a query view. Putting record tabs in the workspace spec would make a workspace author record layouts, which is R3 broken. Filed as a views item rather than absorbed.

The entity-dashboard toolbar is the third case and is already answered: view select is the view switcher, group and configure are `query` view properties, and bulk actions are actions on a selection — none of them navigation.

## What the three prove, together

| Axis | Classic | Agentic | Connect Buy-Side | Connect Sell-Side |
|---|---|---|---|---|
| Navigation depth | two levels | one | one | one |
| Home | an entity type | a route | a view | an entity type |
| Agent placement | `sidebar` | `primary` | `sidebar` | `sidebar` |
| Chrome mode | `classic` | `wide` | `minimal` | `classic` |
| Personalization | `reorder` | `locked` | `locked` | `reorder` |
| Focus | none | types + predicate, dismissible | types, sticky | types, dismissible |
| Audience | tenant default | a group or role | external principals | tenant default, brokerage tenant |
| New components required | none | none | none | **one, shared** — the disclosure-set editor, which tenant admin needs regardless |
| New view kinds required | none | none | none | none |
| New shell branches required | **one** — the `requires` affordance in §1 | none | none | none |

The single branch is the honest result, and it is a small one: node visibility may depend on a policy the viewer holds. Everything else in three deliberately different applications is data.

The corollary is the acceptance criterion for the build: **adding a fourth exemplar must require no code.** If it does, the model in `04` has a gap, and `09-build-specs.md` should find it by writing a fourth one — a lending-focused workspace is the obvious candidate, since it exercises `loan` and reaches for the relationship-heavy surfaces the views system already covers.
