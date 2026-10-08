# Build specs: the seams, the sequence, and the bounds

`04` says what a workspace is; this doc pins how it is built so the result is fast, testable in isolation, and hard to break by accident. Three kinds of content: the **resolved shapes** (the seam every layer talks across), the **sequenced build items** (each with the tests that prove it), and the **bounds** (performance obligations and the admission rules that keep the enums honest).

## The resolved shapes

The seam between the domain and the shell is a serializable value, exactly as `ResolvedSection` is for views: the shell receives data, never a spec to interpret, and never a query to run. Everything below is computed server-side in one place.

```ts
// packages/tenant/core/src/workspaces/resolve.ts — the only producer.

interface ResolvedWorkspace {
  handle: string
  label: string                       // the viewer's locale, already picked
  description: string
  chrome: { mode: ChromeMode; density: Density; personalization: Personalization }
  focus?: { workspace: string; predicate?: Predicate; entityTypes: string[]; dismissible: boolean }
                                      // `workspace` names where the focus came from, which is not
                                      //   always `handle`: a path naming a workspace the viewer is
                                      //   not entitled to supplies its focus while their own
                                      //   supplies the chrome. The surface applying the focus — and
                                      //   the grid re-reading it per block — sends that handle.
  navigation: ResolvedNavNode[]       // requires-filtered, targets checked — ready to draw
  home: { slug: string; href: string }
  from: string                        // 'path' | 'cookie' | 'user' | 'group:<id>' | 'role:<h>'
                                      //   | 'tenant' | 'managed' | 'none' — the named winner
  switcher: Array<{ handle: string; label: string; icon: IconName }>  // every entitled workspace
}

type ResolvedNavNode =
  | { kind: 'link';     label: string; href: string; icon?: IconName;
      section: Section; active?: boolean }
  | { kind: 'group';    label: string; render: 'group' | 'tabs'; section: Section;
      children: ResolvedNavNode[] }
  | { kind: 'disabled'; label: string; reason: string; section: Section }
      // the tolerant-read state: a deleted target degrades in place, named
```

Two properties are the point of this shape:

1. **`href` is computed at resolve time, once.** The slug→URL mapping lives in the resolver, so no component ever concatenates path segments — the mistake that turns a renamed slug into a scavenger hunt.
2. **`requires` is already applied.** The shell never sees a node the viewer's plan hides, so no component carries policy logic — and the one place that does (the resolver) reads the plan through the same `guardRequest` machinery everything else uses.

A pairing guard test pins `ResolvedNavNode['kind']` against the sidebar's exhaustive switch in both directions, by source scan — the same test shape as `apps/dpagentic/src/features/views/components/view-section.test.tsx`, for the same reason: a kind added server-side with no case to draw it fails the build, not the user.

## Capability inventory

What the build stands on, sorted by whether it exists. The point of the list is the third row: one genuine platform gap, named as a dependency rather than discovered mid-build.

| Standing | Capabilities |
|---|---|
| **Exists, reused as-is** | `configTable` + `tenantIsolation`; the Zod spec pattern and predicate AST; the stored-oracle guard (`views.ts:66`); `expandRoles` and the plan machinery; `view_defaults` (needs only the `'home'` context value and one rung); the dataset kind registry; the seed profiles; the section-registry pairing-guard test shape; the advisory-lock publish pattern; `is_external` + grants for Connect's boundary |
| **New, but specified here** | the two tables; the resolver and fold; slug routing; the `Workspace` CASL subject; the per-user reorder store (W6); the recently-accessed store (outside W1–W6) |
| **Genuine platform gap** | **a configuration-change audit mechanism.** `change_log` is record lifecycle; `@neuro/audit` is authentication events; `saveView` writes no audit record today. `08`'s requirement (an audit entry naming what a publish changed) has no home — and neither does the role-change audit `docs/coreservices/authz/10` rule 5 requires, so this gap predates workspaces. W1 must resolve it: either extend `@neuro/audit`'s event catalog beyond authentication or add a config-audit event kind — decided as its own small ADR, because roles, views, and workspaces will all write to it |

One sequencing fact, so the launch seed is not mistaken for a regression: `NamedRoute` can only contain routes the app has, and several surfaces the `05` exemplars target do not exist yet in dpagentic (the admin tabs, assignments). `05` is target state; W4's seed writes the subset the enum supports at that moment, and nodes join the seed as their surfaces ship.

## Build sequence

Each item is independently shippable and lands with its tests. Order matters: the vocabulary cut lands before anything writes it, nothing renders until it can be validated, nothing migrates until it renders.

### W0 — The ADR-0018 cut (vocabulary and payload restatement)

**Landed** — the cut is in the tree; this entry stays as the record of what it covered. First because everything after it writes the new words, and cheap only now: [ADR-0018](../views/ADR-0018-query-views-and-the-source-registry.md)'s five moves as one PR — `saved_view` → `query`; `entityType` → `source` with the source registry (entity source delegating to `queryEntities`, `proposals` deferred to its own item); `dashboardWidgetSchema` retired into the section union with `id` + `placement`; `workspace_templates` → `tenant_templates` **relocated to the control-plane database** (ADR-0018 move 4 — defined in `packages/control/core/src/db/schema.ts`, retired from tenant core); the `ViewKind` double export resolved. Migrations restated, seeds regenerated, docs swept — **with `git grep`, not ripgrep**, so hidden and CI files are caught.

Tests: the existing view suites pass under the new vocabulary with no behavioral diff (the cut is a rename plus a schema unification, so any behavior change is a defect); the section pairing guard still passes both directions; a fresh-database seed run proves no old literal survives anywhere a seed writes.

### W1 — Spec, tables, `saveWorkspace`

The Zod spec (`packages/shared/fields/src/specs/workspace.ts`), the two `configTable`s, the save operation with all seven validation rules from `04` plus the stored-oracle guard, **the `Workspace` CASL subject** (the `Subject` union member and the `grantAdmin` widening — which deliberately fails `gate-roles.test.ts`'s exact-set assertions until they are updated: that test exists to make a permission widening a visible act), and **the config-audit decision** from the capability inventory, since `saveWorkspace`/publish are its first writers alongside the role edits `docs/coreservices/authz/10` already requires.

Tests that must exist and must be able to fail:
- Every validation rule has a rejection test **and** an acceptance test one edit away from it (a slug with one uppercase letter; the same slug on two siblings; a handle on the reserved list; a `requires` on a `type`-target node; a `home` naming a group header).
- The oracle guard: a focus predicate on a field the author cannot read is rejected — verified by removing the guard call and watching the test fail, per the adversarial-verification expectation.
- Publish concurrency: two concurrent publishes of one workspace, advisory-locked, both terminate and the loser's edit is not silently dropped — the `publishDraft` lost-update shape already fixed once in this repo, asserted here before it recurs.

### W2 — The resolver

`resolveWorkspace` (the fold), `resolveViewDefault` gaining its workspace rung and the `'home'` context, and `React.cache()` wrapping both.

- The fold is a **pure function** over `(assignments, memberships, expandedRoles, cookie, pathSegment)` — no I/O — with the reads injected around it. That is what makes the precedence property-testable: a fast-check test asserts the tie-break is a total order (permuting assignment row order never changes the winner) and that `from` always names a rung that exists.
- T1–T4 from `08-authoring-and-authorization.md`, with their adversarial verification, land here.
- The cookie rung: a stale cookie naming a workspace the principal is no longer entitled to falls through silently — one test, because it is the rung most likely to rot.

### W3 — The shell

Slug routing under `/[workspace]/[...node]`, the `/` and unprefixed 302s, the switcher, chrome modes, and focus-as-chips. The no-workspace fallback shipped here as today's sidebar verbatim, and GRO-327 removed it: every tenant has a workspace it can open, so the state it served does not exist.

**Where the focus is applied, and by whom.** The route computes it (`focusToApply`) and hands the surface an ordinary predicate, which `resolveQueryView` ANDs into the view's own. The grid is the second consumer and needs its own path: AG Grid's row model re-queries per block, so it is sent the workspace HANDLE and `@neuro/grid` reads the predicate from the published workspace — the same treatment the view handle already gets, and for the same two reasons (a predicate in a request body is one a caller can rewrite, and both grid transports must apply the same one). Absent handle means unfocused, which is what `?focus=off` sends. A focus applied only at resolve time narrows the count in the header and none of the rows beneath it, which is the defect shape this split exists to prevent.

- The pairing guard test (above).
- **The perf bound from `04`, measured**: a shell render with a workspace resolves with at most two added queries — asserted by counting queries in an instrumented test, not by review — and the load harness re-run against the DPN-16 baseline (`docs/reference/poc/03-findings.md`) with the delta recorded here. No target number is invented in advance; the first measurement sets it and regressions are judged against it.
- Redirect behavior: `/deals` 302s to the prefixed form the resolver picks; `/classic` alone 302s to `/classic/deals`; an unknown first segment falls through to the ordinary 404 rather than the resolver.

### W4 — Seed, dataset kind, portability

The `workspace` and `workspace_assignment` dataset kinds (`dependsOn: ['view', 'entity-type', 'group', 'principal']`), the managed `classic` seed per profile, and the round-trip test: write-dataset → load → apply into a second tenant → resolved navigation compared on both sides.

- The seed invariant from `07`, iterated not sampled: every seeded workspace's targets exist in that profile's own seed.
- The exemplars in `05` are the fixtures. If seeding `agentic` or `connect` requires code, `05`'s proof obligation has failed and the model gets fixed before this item closes.

### W5 — Migration

The generator that reads a legacy team's `feature_access` + enabled types and emits its `classic` fork, and the back-test: for each team, the generated navigation is compared against what `useNavItems.tsx` actually produces for that team's flags — mechanically, since the function is pure over its inputs. The two invariants from `07` (no flag survives as a flag; the comparison is against real behavior) are the acceptance criteria.

### W6 — Personalization: `reorder`

Last, because it needs the one store nothing else needs: a per-user node ordering keyed `(tenant, user, workspace_handle)`. `workspace_nav_orders` is that store, and the resolver applies it after the tree is built; an arrangement is a permutation of what the reader was already offered and does not add or remove a node. A move is expressed as a pair of controls per row; that is the accessible form and does not require a designed interaction. A drag gesture is additive when one is designed.

`'full'` (hiding admin-published nodes) is **not built**: it is open question 1 in `08` and stays open until a real user asks. It validates and behaves as `locked`, and the admin UI says so.

### W7 — The workspace authoring surface

The admin editor the `03` stories assume and W1–W6 never build: fork a managed workspace, edit the nav tree (order, labels, slugs, targets), set focus and chrome, preview as draft, publish, manage assignments. Gated on `manage Workspace`; every action lands through `saveWorkspace` and the publish operation, so the editor carries no validation of its own — it renders the save errors the operation already returns. The `05` exemplars are the acceptance fixtures: an admin must be able to *reproduce Classic from a blank fork* using only this surface.

### W8 — The model-tenant loop

The authoring story from `07`: provision the **DP Model Tenant**, configure the managed workspaces in it through W7's editor, export via the dataset engine, and provision a fresh tenant from the result. The flow both ways runs through the committed JSON: bootstrap is repo JSON → the control-plane `tenant_templates` store → the tenant; the export writes **back to the repo JSON** as a reviewed PR, and the store loads the committed revision. Depends on W4 (the dataset kinds) and W7 (the editor). Acceptance is the loop run end-to-end: model tenant → export → committed JSON → provision → the new tenant's resolved navigation is byte-equal to the model's for the same principal shape — at which point hand-editing the JSON is drift per `07`, caught by regenerating it from the model tenant and diffing.

## Admission rules

The two enums where this design can rot, each with its rule stated so a reviewer has something to hold a PR against:

**`NamedRoute`.** Adding a member requires a sentence in the PR stating why the surface cannot be a view. Two members are already carried under protest — `proposals` and the repository-backed `matched_listings` pattern — both waiting on the same views-model item, now decided: query views over a `source` registry ([ADR-0018](../views/ADR-0018-query-views-and-the-source-registry.md)), whose first collection source is `proposals`. When it lands, they convert and the enum shrinks; an enum that only grows is `feature_access` with better types.

**`chrome.mode`.** Adding a member means writing a new shell layout component. There is no field for a variation on an existing mode; a variation request is either a token (looks), a derived behavior (computed), or a new mode (a designed layout). The refusal of a middle ground is the boundary.

## What is deliberately not built

Recorded so their absence reads as decisions rather than omissions: version-history storage and rollback (`07` — audit plus fork covers recovery); the `discoverable` flag on assignments (`08` OQ2 — additive when a large tenant asks); an agent-owned workspace (`08` OQ3 — blocked on exercising the agent-principal design); per-workspace count badges on nav nodes (a filtered count per node per render is N aggregate queries the sidebar does not need — counts stay per-type and derived, as today); `'full'` personalization (W6); and the hover menus' **recently-accessed store** (`04`, derived chrome) — not in W1–W6, because derived chrome needs no workspace machinery: until a recents store exists, the hover menus offer starred views and the create action, which legacy's menus never had.
