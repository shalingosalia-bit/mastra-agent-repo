# Legacy pitfalls: the five mechanisms that already do this job

Dealpath already has workspaces. They are not called that, they are not one thing, and none of them can be changed without a deploy. Five separate mechanisms decide what a person sees when they open the app, and they overlap without agreeing. This doc names each one, states what it gets right, and states the trap it fell into — because the traps are the requirements in negative form.

Sources: `sunspear` on `major`, read 2026-08-17, cited as `file:line`; and the local legacy MySQL database, queried the same day. The database is a development snapshot, not production, so counts of *teams and flags* are trustworthy (the configuration is copied wholesale) while counts of *user preference rows* are not, and are marked where used.

## The paradigm worth keeping

Before the pitfalls: the legacy product is right that different people need different applications over the same data. It ships at least three distinguishable experiences today —

| Experience | Who gets it | How it is produced |
|---|---|---|
| The full application | internal members | the default path through the sidebar |
| A reduced application | external collaborators | `isCollaborator` short-circuits, plus an eight-type deny set |
| Listings / Connect | 7 of 55 teams | a `dp_connect` feature flag on one nav entry |

That is a workspace system. It works, customers use it, and Dealpath states publicly that roughly 65% of institutional sales volume now flows through the Connect exchange — a company claim, not a measurement made here. The problem is not the idea. The problem is that the idea was never named, so it was implemented five times.

## The five mechanisms

**M1 — `feature_access`: an untyped boolean matrix.** A `team_id` / `feature_name` / `access` table, read into `featureAccess: Record<string, boolean>` (`app/models/team.ts:73`). **51 distinct flag names across 55 teams — 2,761 rows, of which only 676 are on.** The flags are not orthogonal: `assets`, `loans`, `comps`, `leases`, `funds`, `investments` turn *entity types* on and off; `reporting_dashboards` and `classic_reporting` choose between two reporting products; `dp_connect` adds a nav destination; `white_label` changes chrome; `secondary_members` changes the role model. Seven unrelated concerns in one bag of booleans (`06` enumerates them), with no schema, no grouping, and no way to ask "what does this team's app look like?" other than reading all 51 rows and then reading the code that consumes them.

**M2 — the sitemap as a hard-coded array of conditionals.** `app/components/app-sidebar/useNavItems.tsx` returns `primaryNavItems`, `secondaryNavItems`, `footerNavItems` — fifteen top-level entries and four children, thirteen of them gated by some combination of four different mechanisms: `team.featureAccess.X`, `isCollaborator`, `EntityUtils.isEntityTypeEnabled(type)`, and `AccountUtils.loggedInTeamMemberHasLevel(MEMBER_LEVEL.X)`. Several entries also carry an `isActiveOverride` computed from route matching, and two compute their own `route` from a feature flag (`Comps` points at either the comps or the leases dashboard; `Funds` at either funds or custom funds). One entry is shipped permanently disabled — `{ label: 'My Dashboard', display: 'exclude' }`, commented `// NYI`. Changing any tenant's navigation means editing this file and deploying it to all 55.

**M3 — `isCollaborator` plus a deny set.** The external-user experience is `isCollaborator ? 'exclude' : 'show'` repeated across nav entries, plus `NoCollaboratorAccessEntityTypes` — a hard-coded set of eight entity types (`constants.ts:3678`). A second, differently-shaped list of five types governs who may be *invited* externally (`entity_constants.rb:352`). The two lists answer different questions and overlap without matching, which is exactly what happens when a concept has no home: it gets re-derived per call site with slightly different intent.

**M4 — `MEMBER_LEVEL`, a nine-rung ladder doing two jobs.** `DISABLED, INVITED, COLLABORATOR, MEMBER, MEMBER_PLUS, ADMIN, ADMIN_PLUS, OWNER, OWNER_PLUS` (`constants.ts:129`). Some rungs are genuinely about authority. Others exist to shape what you *see*: `ADMIN_PLUS` versus `ADMIN` selects which admin route the footer link points at (`useNavItems.tsx`), and `COLLABORATOR` is the whole reduced-application experience. Presentation and permission were fused into one integer, so a tenant that wants a colleague to see a narrower app has to change what that colleague may *do*.

**M5 — `login_landing_page`, a per-user setting gated by the flag bag.** `user_settings.login_landing_page` and `login_landing_page_reporting_dashboard_id` decide what the app opens on, validated by `Team.hasLoginLandingPage()`, which maps a landing page name back through `LOGIN_LANDING_PAGE_TO_FEATURE_NAME_MAP` into `featureAccess` (`app/models/team.ts:127`). This is the closest legacy gets to naming the concept — a person's chosen starting surface — and it is the right instinct. It reaches only one setting. (In the development snapshot all 432 `user_settings` rows hold `deals`; that says nothing about production and is not used as evidence.)

## The pitfalls

**P1 — Presentation was expressed as permission, and permission as presentation.** M3 and M4 are the same mistake from both ends: the only way to give someone a smaller app was to give them less authority, and the only way to describe a persona was a rung on the authority ladder. The consequence is a product where "show this analyst a simpler screen" and "stop this analyst editing bank accounts" cannot be asked separately. **This is the pitfall that dictates the central decision in `04`:** a workspace narrows what is offered and never what is permitted, and the two are configured in different places by different policies.

**P2 — The flag bag is a schema-shaped hole.** M1's 51 booleans exist because there was nowhere to put a per-tenant *shape*. Each request became one more permanent global. The measured ratio is the tell: **676 on out of 2,761 rows** — three quarters of the matrix is the absence of something, stored explicitly, per team, forever. Legacy's presentation layer produced the identical pathology one level down (37 reporting `option_type`s, `docs/experiences/views/01-legacy-pitfalls.md` P8), which is strong evidence this is structural rather than a lapse. The rule it dictates: a workspace's chrome is a **bounded enum**, and a request that is really about *meaning* becomes a named thing in the model rather than a switch on the shell.

**P3 — The sitemap has no representation, so it cannot be read, validated, or diffed.** M2 is a function, not data. Nothing can answer "what does the Brookfield app look like?" without executing React with that team's Redux state. There is no save-time validation that a nav entry points at something that exists, no way to preview a change, no way to export one team's shape and give it to another, and no way for an agent to describe the application it is embedded in. Making navigation *data* is most of the value of this docset, independent of anything else.

**P4 — Four gating mechanisms with no precedence rule.** A single nav entry can be hidden by a feature flag, by an entity-type toggle, by collaborator status, or by member level, evaluated in whatever order the ternary happens to sit. When a customer asks why they cannot see Funds, there is no answer to look up — only four places to check. Any replacement needs **one resolution order with a named winner**, the discipline `view_defaults` already applies to views (`docs/experiences/views/04-proposed-model.md`).

**P5 — Feature flags and entity-type enablement were conflated.** `assets`, `loans`, `comps`, `leases`, `funds`, `investments` are flags in M1 *and* have a parallel `EntityUtils.isEntityTypeEnabled()` check in M2, and `Funds` needs both (`isEntityTypeEnabled(FUND) || featureAccess.customFunds`). Two systems answer "does this tenant have deals of this kind", disagree at the edges, and the nav has to bridge them per entry. In Neuro this question already has one answer — the tenant's registered entity types — and a workspace must consume that rather than re-encode it.

**P6 — A workspace's identity was smeared across four stores.** What a person sees comes from `feature_access` (team), `user_settings` (user), `group_members.member_level` (per-entity), and a compiled JavaScript array. Nothing can be versioned, nothing can be published as a unit, nothing can be rolled back, and nothing moves with a tenant. `07-provisioning-and-lifecycle.md` is written against this pitfall specifically: the tenant-transfer requirement is not satisfiable while a tenant's app shape lives partly in a deploy artifact.

## What legacy never had

Worth listing, because parity thinking hides additions:

- **No named concept.** Nobody at any tier can say "put this person in the Underwriting workspace."
- **No tenant-authored experience.** Every shape is one Dealpath ships; a customer can only toggle among them.
- **No description of the app for a non-human.** An agent embedded in the product cannot read what application it is inside, which is the prerequisite for it to navigate, cite, or hand off to a surface.
- **No draft or preview.** A navigation change is a deploy, so it cannot be tried.
- **No default data lens.** A person whose work is one region re-applies that filter every session; the closest thing is a saved filter on one grid.
