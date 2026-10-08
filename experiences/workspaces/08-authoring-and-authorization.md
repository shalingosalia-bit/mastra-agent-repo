# Authoring a workspace, and the authorization it needs

Two questions, deliberately kept apart. **Who may author a workspace** is an ordinary privileged-configuration question, answered the way this repo answers the others. **What a workspace does to authorization** is the answer "nothing", and this doc states how that is enforced rather than asserted.

## Who may author one

`Workspace` becomes a CASL subject, alongside the twelve that exist today (`packages/shared/authz/src/gate.ts:38`).

```ts
export type Subject =
  | 'Conversation' | 'Message' | 'Document' | 'Tenant' | 'Agent'
  | 'Entity' | 'FieldValue' | 'FieldConfig' | 'Proposal' | 'View'
  | 'Role' | 'ShareLink'
  | 'Workspace'        // ← new
  | 'all'
```

Granted to `admin` and above, by extending the existing admin grant (`gate.ts:168`):

```ts
can('manage', ['Entity', 'FieldValue', 'FieldConfig', 'Proposal', 'View', 'Role', 'Workspace'], tenant)
```

**Why a separate subject rather than folding into `View` or `FieldConfig`.** The same argument `docs/coreservices/authz/10` makes for `Role`: someone trusted to author a view is not automatically someone trusted to decide what application a hundred colleagues open into every morning. Different blast radius, different grant. Folding it into `View` would also make it un-refusable for a tenant-defined role that legitimately needs view authoring — a `deal_lead` who curates the team's views but should not reshape the app.

### There is no SuperAdmin, and there should not be

The tenant role set is `viewer < member < admin < owner`, plus `support` (`docs/coreservices/authz/10`). Adding a rung above `owner` was considered and refused for three reasons:

1. `docs/coreservices/authz/10` reserves everything on the `Tenant` subject to `owner`, and forbids tenant-defined roles from holding it. A rung above `owner` would need a new rule about what it may do to a tenant, which is the rule that doc exists to fix in place.
2. Role permissions are the **union** of every role a principal holds, resolved by transitive closure over `builds_on` (`packages/shared/authz/src/decide/plan.ts:31`). A ladder rung is not how this model expresses "more authority"; a policy is. Adding a rung would reintroduce the rank thinking that model deliberately replaced — and that legacy's nine-rung `MEMBER_LEVEL` is the cautionary example of (`01` M4).
3. A tenant that wants a narrower authoring role can already build one: `manage Workspace` is assignable to a tenant-defined role under the existing rules, giving a `workspace_admin` that reshapes the app and touches nothing else.

**The escalation guard applies unchanged.** A role cannot contain a policy its author does not hold — the intersection rule from ADR-0002, in its fifth application after agents, share links, support sessions, and roles (`docs/coreservices/authz/10`, rule 2). An admin cannot mint a role holding `manage Workspace` unless they hold it themselves.

### Assigning is a separate act from authoring

`docs/coreservices/authz/10` rule 4 already draws this line for roles: defining and assigning are distinct actions, kept apart so a team lead can assign without being able to author. The same split here:

| Act | Requires | Touches |
|---|---|---|
| Author / edit / publish a workspace | `manage Workspace` | `workspaces` |
| Assign a workspace to a principal | `manage Workspace` initially; separable later | `workspace_assignments` |

Both start at `manage Workspace`; keeping them distinct in the operations layer leaves room to relax the second without relaxing the first. Distinguishing them later is a widening, which is cheap. Fusing them now and splitting later is not.

### Audit

A workspace change is a configuration change with a wide blast radius: publishing changes what everyone assigned to it sees on their next load, with no warning. Following `docs/coreservices/authz/10` rule 5, the audit record names **what changed**: nav nodes added and removed, home surface changed, focus predicate changed, chrome changed, and `version` on each side the change moved it. A publish moves the version, so it records `version` before and after. Archive and un-archive move `status` and leave the version where it was, so they record `version` after alone. A `before` equal to it would assert a change that did not happen. An entry reading "workspace updated" is not enough to answer the only question anyone asks after a bad publish.

Assignment changes are audited separately and name the principal, because "who put Jo in the Connect workspace" is a different investigation from "who changed Connect".

## What a workspace does to authorization

Nothing. This section is about making that checkable.

### The rule

**Focus narrows offers. The access plan decides results.** `focus.predicate` is applied **by the caller**, as an ordinary predicate ANDed into what a workspace's own surfaces pass to `queryEntities` — the same way a user's filter chips are applied, and materialized into the URL alongside them (`04`). It never reaches the operations layer as a workspace: `queryEntities` and `getEntity` take no workspace argument, so the AccessPlan, `permission_rules`, `field_rules`, and RLS cannot see one.

### Four tests that pin it

A rule stated in prose is a comment, and this repo has a recorded failure mode for defenses that cannot go red (`work-that-cannot-fail`). The tempting single assertion — "the grid returns the same rows with and without the workspace" — is wrong, because the workspace legitimately supplied a filter and the rows *should* differ. Four narrower assertions, each able to fail:

**T1 — The operation is workspace-blind.** `queryEntities` and `getEntity` accept no workspace argument, and the resolved `AccessPlan` for a fixed principal is **byte-identical** with a workspace resolved and with none. Run for an internal `member`, a field-restricted `member`, and an `is_external` principal. This is the assertion that makes the separation structural: it fails the moment anyone threads a workspace into the operations layer.

**T2 — Same predicate, same rows.** `queryEntities` called with the focus predicate passed explicitly returns exactly what the workspace's grid returns. This proves the grid is applying a *predicate*, not a *privilege* — the two are indistinguishable from the grid's output alone, which is why T1 and T2 are both needed.

The surface has TWO consumers and T2 has to cover both. The page resolves its rows once; the grid's row model re-queries its own blocks as the reader scrolls, so a focus applied only at resolve time narrows the count in the header and none of the rows beneath it. The grid is therefore sent the workspace HANDLE and reads the predicate server-side — the same treatment a view's own predicate gets, for the same two reasons: a predicate in a request body is one a caller can rewrite, and both grid transports must apply the same one. `packages/tenant/core/src/workspaces/focus.integration.test.ts` carries the resolve half and `packages/tenant/grid/src/query.integration.test.ts` the block half.

**T3 — Offer difference.** The workspace's navigation and pickers demonstrably differ **from those of a second workspace over the same records**. Without it, T1 passes trivially for a workspace that does nothing — the vacuous-fixture shape that has bitten this repo before. The comparator was originally the no-workspace shell, which GRO-327 deleted; asserted against that absence the check becomes trivially true the moment the shell is gone, which is the same vacuous shape one level up. Two workspaces is the stronger comparator anyway, and it is what the seeded fixture has always held.

**T4 — Direct reach.** A principal in a focused workspace opens a record **outside** the focus, by id, and gets it, provided their plan permits. This is the test most likely to be "fixed" by someone who reads it as a bug. Its comment must say so.

Adversarial verification, per the repo's standing expectation: add a workspace parameter to `queryEntities` and confirm T1 fails; remove the focus from the grid's predicate and confirm T2 fails; resolve both workspaces from one spec, so either handle returns the same navigation, and confirm T3 fails; move focus application from the caller into the operation and confirm T1 and T4 both fail. A test that cannot be made to fail by breaking the thing it guards is not testing it.

T3 takes its own mutation because the grid-predicate one does not reach it: removing the focus changes which rows a surface returns, not which destinations a workspace offers, so T3 survives it. Pairing T3 with T2's mutation records a check on T3 that cannot go red.

**And the measurement has to be able to fail too.** A browser check counting rendered grid rows measures the VIEWPORT — AG Grid virtualizes, so the DOM held 42 rows for both a 48-row and a 70-row answer. Read the surface's own record count and the block request's row count, and use an unknown workspace handle as the control: a narrowing that also appears for a handle nobody published came from something other than the focus. A seeded focus that repeats its surface's default view predicate is the same trap one layer up — applied, correct, and unmeasurable.

### The stored-oracle guard

A workspace with a focus predicate is a **stored query**, and a stored query someone else authored is an inference channel — the author learns about field values from which records a *reader* is offered. This is settled ground: `saveView` already rejects a view whose predicate touches a field its author cannot read (`packages/tenant/core/src/operations/reads/views.ts`), using the same `guardRequest` that returns 403 on the query path. `saveWorkspace` applies the identical guard to `focus.predicate`. Not a new mechanism — the same one, at a new call site, which is the whole reason to reuse the predicate AST rather than invent a focus grammar.

### Node visibility and policy

`05` §1 introduces the one affordance that couples navigation to authorization: a nav node may declare `requires: <policy>`, and an unsatisfied policy hides the node. Bounds:

- It is for **surfaces**, never records — an admin panel, a settings route. A `requires` on a node targeting a view or an entity type is a misuse and should fail validation.
- It is **coherence, not control**. The route is guarded server-side regardless; hiding the node only avoids offering a dead end.
- T1 still has to pass. `requires` changes what is offered, which is exactly what a lens is permitted to do.

### External users, stated once

An external principal (`is_external = true`) holds access solely through per-record grants and is excluded from every access default (`docs/coreservices/authz/10`). That is the entire security argument for Connect. The workspace makes the application appropriate; it makes nothing safe. A security review of Connect should be able to reach its conclusion without reading this docset — and if it cannot, the separation has failed somewhere and the answer is in the grants, not in the navigation.

## Open questions

Recorded rather than resolved, since each is a real decision this stack does not need to make yet:

1. **May a user hide a nav node the admin published, under `personalization: 'full'`?** Reordering is clearly personalization; hiding shades into "I made my own workspace". Leaning yes, with the hidden set stored as a per-user preference and never as a workspace edit — but it wants a real user before it is decided.
2. **Should `workspace_assignments` gain a `discoverable` flag** — the open/closed/private axis Notion uses (`02`)? It separates "may enter" from "appears in my switcher", which is a distinction a large tenant with fifteen workspaces will eventually want. Additive; deferred.
3. **Does the agent get a workspace of its own?** A headless principal has no navigation, but it does have a focus and a play set, and today those would come from whichever workspace the invoking user is in. Coherent, and possibly wrong for scheduled or event-driven runs where there is no invoking user. Needs the agent-principal design (ADR-0002) to be exercised further before it can be answered.
4. **How does a workspace interact with impersonation and support sessions?** A support session sees the tenant's default workspace today by resolution; whether it should instead see a deliberately plain shell — so support is never confused about what the customer sees — is a `docs/coreservices/authz/09` question, not a workspace one, and should be answered there.
