# ADR-0017: A workspace is a presentation lens, never a data or permission boundary

**Date:** 2026-08-17
**Status:** Accepted 2026-08-18 · amended 2026-08-25 (the third meaning of the word, and the code rules it needs — Decision unchanged)
**Scope:** neuro

## Context

Neuro needs a way for one deployment to present different applications to different people: the legacy-shaped app for a migrating customer, an agent-forward app for a team that wants outcomes rather than screens, and a narrow app for an external buy-side counterparty on Connect. `docs/experiences/workspaces/` specifies that system.

The industry uses one word — *workspace* — for three unrelated patterns. Choosing between the first two decides everything else here; the third is not a candidate for this decision and is tabulated because it collides in code.

| | Container | Lens | Execution environment |
|---|---|---|---|
| Examples | Slack workspace, Notion teamspace, Linear team | Salesforce Lightning App, Dynamics model-driven app, ServiceNow Configurable Workspace, SAP Fiori Space, Airtable Interface | `@mastra/core`'s `Workspace` — a filesystem plus a sandbox an agent writes files and runs code in |
| Records | belong to it | belong to the tenant | are not involved at all |
| Membership | grants access | grants nothing | does not exist as a concept |

The legacy product has already run the experiment of not choosing. Its equivalent of a workspace is five overlapping mechanisms (`docs/experiences/workspaces/01-legacy-pitfalls.md`), two of which fuse presentation with permission: `MEMBER_LEVEL` is a nine-rung ladder where `COLLABORATOR` is simultaneously a persona and an authority level, and `isCollaborator` plus an eight-entity-type deny set is how the external application is produced. The measured consequence is that "show this analyst a simpler screen" and "stop this analyst editing bank accounts" cannot be asked separately, and that a UI deny list of 8 types and a server-side list of 5 types answer different questions while looking like the same list.

Neuro already has both patterns' needs met elsewhere. Containment is tenancy — pool with RLS, or silo. Sharing and audience within a tenant are `views.scope ∈ personal | group | shared` with membership joined at read from `group_members`. Access to records is the AccessPlan: grants, `permission_rules`, and `field_rules`, with RLS as defense in depth for pooled tenants. External users are `is_external = true` principals who are excluded from every access default and hold access only through per-record grants (`docs/coreservices/authz/10-access-templates-and-defaults.md`).

The pressure to make a workspace a boundary is real and will recur. It comes from Connect: it is tempting to say a buy-side principal is safe because their workspace is small. Airtable appears to endorse this — its interfaces combine curated layouts with per-viewer record filtering — but the reason that is safe is that Airtable's interface-only users have no access to the underlying base at all. The access boundary is doing the work in that product too; the filter sits on top of it.

## Decision

**A workspace changes what a person is offered. It never changes what they are permitted.**

1. **A workspace owns no records.** No `workspace_id` on any record table. Containment is tenancy; audience within a tenant is `views.scope` and `group_members`.
2. **Assignment to a workspace grants nothing.** Being assigned confers no read, write, or discovery of any record.
3. **`focus.predicate` is applied by the caller, never by the operation.** A workspace's own surfaces AND it into the predicate they pass to `queryEntities`, exactly as a user's filter chips are applied. `queryEntities` and `getEntity` take no workspace argument, so the AccessPlan, `permission_rules`, `field_rules`, and RLS cannot see a workspace. The separation is a fact about the call graph rather than a policy someone maintains.
3a. **An applied focus is materialized into the URL as ordinary filter state.** A hidden focus would break the shareable-URL promise `docs/experiences/views/03-requirements-and-user-stories.md` makes — two people opening one view link from different workspaces seeing different rows, with nothing in the link to explain it — which is legacy pitfall P4 restored one layer up. A workspace supplies default filter state; it never supplies invisible filter state.
4. **A record outside a workspace's focus, reached directly, resolves normally** when the viewer's plan permits it. This is the design, not a leak. If a record must be unreachable, that is a grant.
5. **Navigation is not a control.** Omitting an entity type from a sitemap does not stop a link, a search result, or the agent reaching a record of that type the viewer may read. One narrow exception is admitted and bounded: a nav node may declare a required policy so an unusable *surface* (an admin panel) is not offered; the route is guarded server-side regardless, and a `requires` on a node targeting records or types fails validation.
6. **The rule is enforced by tests, not by review.** The obvious single assertion — the grid returns the same rows with and without the workspace — is wrong, because the workspace legitimately supplied a filter. Four assertions instead: the operations take no workspace argument and the resolved `AccessPlan` is byte-identical with and without one; the grid's rows equal `queryEntities` called with the focus predicate passed explicitly; the navigation offers demonstrably differ; and a record outside the focus opens by id when the plan permits. Run for an internal, a field-restricted, and an external principal. `docs/experiences/workspaces/08-authoring-and-authorization.md` carries them with their adversarial verification.
7. **A workspace's focus predicate is subject to the stored-oracle guard**, unchanged from views: a predicate touching a field its author cannot read is rejected at save, via the same `guardRequest` used at `packages/tenant/core/src/operations/reads/views.ts`.
8. **Authoring is a new policy, not a new role.** `Workspace` becomes a CASL subject granted to `admin` and above; no rung is added to `viewer < member < admin < owner`. Permissions are the union of held roles by transitive closure over `builds_on` (`packages/shared/authz/src/decide/plan.ts:31`), so "more authority" is expressed as a policy, and a tenant wanting a narrower authoring role composes one under the existing intersection rule.

## Consequences

**What this buys.**

- A person can be moved between workspaces freely — it is a presentation change, reversible, with no access review attached. That is what makes gradual Classic → Agentic migration possible person by person.
- The security argument for Connect is one sentence and does not mention navigation, so a security review can reach its conclusion without reading the workspace docset.
- The legacy fusion (`MEMBER_LEVEL` as persona-and-authority) is untangled rather than ported, and the two halves land in the two systems that already own them.
- Workspaces cannot become an authorization bypass surface, which is the failure `docs/experiences/views/01-legacy-pitfalls.md` P3 records at the view layer and which would be worse at the shell layer, because the shell is what an external user is handed.

**What this costs.**

- **Focus is defeatable, by design.** A user can clear it, or follow a link past it. Anyone who reads "focus" as "restriction" will consider this a bug; the test that pins it (decision 6, T3) has to carry a comment saying so, or it will eventually be "fixed".
- **Some real requests have no home here.** "Give this contractor an app that only shows the Northeast portfolio" is a *grants* problem. The workspace makes the app appropriate; someone still has to do the access work, and this ADR is what stops the app from appearing to have done it.
- **A second concept may be needed later** if a customer genuinely wants records partitioned within one tenant. That is a container, it belongs in the tenancy or authorization model, and it must not be built by widening this one.

**What the third pattern requires, since it is a dependency rather than a design option.** `@mastra/core` exports a `Workspace` class meaning a filesystem plus a sandbox, and `Workspace` here is a CASL subject over presentation (`packages/shared/authz/src/gate.ts:75`). Nothing imports both today, which makes this the time to state the rules rather than the time to debug them.

- **Never import `@mastra/core`'s `Workspace` unaliased.** Where it is needed, import it as `MastraWorkspace`. An unaliased import into authorization-adjacent code puts a sandbox handle where a permission subject is expected, and both are called `Workspace`.
- **`NeedsApprovalContext.workspace` is not a Neuro workspace.** Mastra surfaces `workspace?: Workspace` to a tool-approval predicate, which is precisely where an author reaching for "which workspace is this request in" would look. It is the execution environment. A tenant policy that read it as a presentation lens would be reading an unrelated object, and it would appear to work.
- **Stored workspaces in the Mastra editor are execution environments.** They are authored per deployment and are not the tenant's presentation lenses, despite listing under the same word in the same UI.
- **A focus predicate never reaches an agent's sandbox, and a sandbox never narrows a plan.** Decision 3 already puts focus in the caller; this restates it for the surface where the collision makes the mistake plausible.

**What is explicitly not decided here.** Whether Neuro ever gains a container-style partition below the tenant; that remains open and would be its own ADR. This ADR decides only that *workspaces* are not it. The execution-environment pattern is a dependency's concept and is not a Neuro workspace of either kind.

## Alternatives considered

**Make a workspace a container.** Rejected. It would put containment in a third home alongside tenancy and `views.scope`, requiring RLS changes, an AccessPlan change, a migration touching every record table, and a rule for what happens to a record when its workspace is deleted. It also answers a question no named customer has asked, while the lens answers three that have.

**Lens now, `workspace_id` reserved for later.** Rejected as the worst of both. A nullable column carries no behavior but does carry an implication, and implications on schema get consumed. The migration cost of adding the column later is real but bounded; the cost of a half-present concept is unbounded and paid continuously.

**Make focus a real filter on `queryEntities` globally — "safe by default".** Rejected, and it is the most attractive of the three. It would make the Connect argument shorter, and it fails for a specific reason: it creates a second, weaker access mechanism that looks like the first. Two systems that both decide which records you see will disagree, and the one that is easier to configure will become the one people rely on. `docs/experiences/views/01` P3 is what that looks like after fifteen years.

## References

- `docs/experiences/workspaces/` — the specification, particularly `04-proposed-model.md` (the authorization interaction) and `08-authoring-and-authorization.md` (the tests)
- `docs/coreservices/authz/10-access-templates-and-defaults.md` — roles, what roles do not decide, external principals
- ADR-0002 — unified principal authorization, and the intersection rule
- `docs/experiences/views/01-legacy-pitfalls.md` P3 — presentation-layer security at the view layer
- `docs/experiences/views/04-proposed-model.md` — the view contract this composes by reference, and the `view_defaults` precedence fold this resolution mirrors
