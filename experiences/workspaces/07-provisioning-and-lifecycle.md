# Provisioning, lifecycle, and migration

A workspace has to exist before a tenant does anything, survive being exported and re-imported somewhere else, be editable without anyone seeing the edit, and absorb a legacy team's 51 flag rows. This doc covers those four, in that order, and ends with what is deliberately not versioned.

## Provisioning: a tenant has a workspace on day one

`CLAUDE.md` states the rule: new tenant-facing schema or config needs an accompanying seed, so a freshly provisioned tenant is not missing it. For workspaces that rule has teeth — GRO-327 removed the no-workspace fallback, so a tenant that arrives without one has no shell at all.

**One mechanism, and three things that keep it true.** `classic` ships as `is_managed = true` in the tenant profile, written for the entity types that tenant actually registered, published and assigned at the `tenant` tier — so it resolves for everyone by default.

There used to be a second mechanism, and GRO-327 removed it. **The no-workspace fallback** rendered today's entity-type sidebar when resolution reached the end of the fold and found nothing — no seed ran, a tenant deleted everything, a silo was restored from an older snapshot. It was `03`'s design commitment that a tenant which never hears the word "workspace" gets a working app, and it was what made the feature safe to ship: the worst outcome of a workspace bug was today's application.

That commitment is replaced by a stronger one: **every tenant has at least one workspace it can open**, which is a rule rather than a convention because three things hold it up.

1. **Every seed profile ships one.** `workspacesFor` merges the starter pair into every profile, and `packages/tooling/seed/src/workspaces.test.ts` asserts per profile that at least one is `live` — published and tenant-assigned on apply, which is what "can open" means to `resolveWorkspace`.
2. **The last one is not taken away.** `guardLastWorkspace` rejects a `deleteWorkspace`, an `unassignWorkspace` or an `archiveWorkspace` that would leave the tenant with none, measured before and after the write inside the caller's transaction. Those are the three operations that can break it: a delete removes the workspace, an unassign removes the entitlement that makes it openable, and an archive moves it out of the `status = 'published'` filter the count shares with the resolver.
3. **A tenant without one is reported, not accommodated.** The shell throws and names the tenant. The state is reachable only from a provisioning path that registers a tenant without applying its configuration, and an operator needs to be told.

A **viewer** entitled to no workspace is a different question and keeps its own answer: they are sent to a stated page rather than into a shell. `03` draws that line; collapsing the two is what a single `null` from the resolver did.

**Where the seed lives.** The dataset engine already has the right shape for this. `packages/tooling/dataset/src/kinds/` holds one handler per resource kind — `entity-type`, `field-definition`, `view`, `group`, `principal`, `access` — registered into a registry whose apply order is the **topological sort of declared dependencies** (`registry.ts:45`). A `workspace` kind slots in with `dependsOn: ['view', 'entity-type', 'group', 'principal']`, and the ordering falls out rather than being asserted. `workspace_assignment` follows it.

Concretely: `datasets/dealpath-config/workspaces.json` beside the existing `views.json`, `roles.json`, and `permission-rules.json`.

**One provisioning invariant worth a test.** A seeded workspace must reference only what that profile also seeds. A `classic` workspace naming `entityType: loan` for a tenant with no `loan` type produces a sidebar of disabled nodes on day one — technically the tolerant read path working correctly, and a terrible first impression. The seed suite already tests this class of thing across every seeded view rather than one row, after a mis-modelled view survived until a first run against a fresh database (`packages/tooling/seed/src/seed.integration.test.ts`). The workspace assertion belongs in the same place, and it must iterate rather than sample.

## Where managed configuration is authored: the DP Model Tenant

The nouns first, because the word "template" invites a second authoring format and there must not be one:

- A **workspace** is the persisted noun — a row in a tenant, edited through the product.
- A **template** (`tenant_templates`, [ADR-0018](../views/ADR-0018-query-views-and-the-source-registry.md) move 4) is not authored at all. It is the **JSONified portable capture** of a configured tenant — the dataset pipeline's dependency-ordered export — stored in the **control-plane database** (the tenant-neutral plane; one fleet-wide copy, written by export, read by provisioning, never on a tenant request path) and applied at provisioning.

That ordering fixes where managed configuration comes from. Dealpath operates a **model tenant** — an ordinary tenant on the ordinary product — and configures it with **Neuro's own UI tools**: the workspace editor, the view editors, field configuration, roles. An export of the model tenant (the dataset engine's write, the same `transfer` verb `docs/operations/data-migration/02` names) produces a `tenant_templates` revision; provisioning applies that revision through the dataset pipeline, and the applied rows land `is_managed = true` with `from_template` naming the revision they came from.

Three consequences, each the point:

1. **There is no second authoring surface — but there is always a readable artifact in the codebase.** Committed JSON is the standard bootstrap form: the configs representing the workspace and view states live in the repo, human-readable and diffable, and the Control Plane loads them into its template store and stuffs them into a tenant at provisioning. What changes when the model tenant exists is *authorship*, not the artifact: the export **regenerates** those committed files (a PR, reviewed like any other), and hand-editing them after that is drift. Git stays the review and version surface for template revisions either way.
2. **A template can only contain what the product can express** — because it is captured from a real tenant through the real validation, the stored-oracle guard included. A hand-authored blueprint format would have to re-implement every save-time rule or silently skip them; an export cannot.
3. **Updating a managed workspace is a re-export.** Configure the change in the model tenant, verify it there — it is a running tenant, so verification is *using it* — export, bump the template revision. New tenants provision from the new revision; existing forks are untouched, exactly as forking already promises.

The model tenant is also where the exemplars in `05` stop being YAML in a document and become rows someone can click through — which is the strongest form of the proof obligation that doc carries.

### The loop, as commands

`packages/tooling/seed/src/model-tenant.ts` has the three steps, reachable as `bun run --filter @neuro/seed model:tenant <command>`:

| Command | What it does |
|---|---|
| `provision` | Stands `dp_model` up from `datasets/dealpath-config`, through the same `seedFrom` path a customer tenant is configured by |
| `export` | Captures the tenant back out and writes the collections it covers over the committed artifact |
| `check` | Captures and diffs against the committed artifact, exiting non-zero on a difference |

The export reads a tenant through `KindHandler.capture`, added beside `readCurrent` in `packages/tenant/core/src/dataset/types.ts`. `readCurrent` answers "what does this tenant have at this identity"; a capture has no list to start from, so it enumerates. `workspace` and `workspace_assignment` implement it. Every other kind in `dealpath-config` is still emitted from the `dealpath` profile by `db:dataset:emit`, and `captureDataset` names each one in its report; a kind absent from the report is absent from the artifact. That is also why the export is a partial write: two authors write into one directory, and a whole-directory write would delete the other's collections.

**What the export includes, per workspace.** Only a published one, and its `published_definition`; a draft is by construction what nobody in the model tenant has verified, and readers resolve the published column. `live` and `assignPriority` come from the tenant-tier assignment; group, user and role assignments travel as `workspace_assignment` resources naming their subject by handle. A published workspace with no tenant-tier assignment is exported without `live` and reported, because the destination keeps it as a managed draft.

**Two guards run at the export.** Every captured value goes back through its own kind's `validate` (the function `loadDataset` will run on it), so a value that does not survive its own artifact fails here. And `portabilityProblems` rejects a value with a UUID, an absolute URL, or the source tenant's slug; the tenant-transfer rule is checked mechanically.

### A contested handle at the destination

`assertStoredRules` rejects a provisioning save over a workspace the tenant authored, and `applyDataset` sees that coming: `decideAction` reads ownership before anything about content and returns `conflict`; the conflict is reported and skipped without reaching the write. One contested handle therefore does not strand the rest of the revision; the other resources apply. The remedies are named per resource in the run's output (`contestedHandleRemedy`): remove the existing one at the destination so the next provision installs this one, or deploy the revision without that resource and configure it by hand.

Not every `conflict` is a contested handle. `principal` reports one on every re-apply, because its `isTenantOwned` returns true unconditionally (an existing principal is never rewritten), so a second provision of an already-configured tenant reports one conflict per principal and has overwritten nothing. The report's wording does not assert authorship for that reason.

## Forking: how a tenant gets its own

A tenant does not author a workspace from an empty form. It **forks a managed one**. Dynamics starts a maker from a solution's sitemap (`02`) the same way, and so does the rest of this repo's configuration; `configTable` has a `from_template` column on every row (`packages/tenant/core/src/db/factory.ts:127`).

```text
fork('classic') → a new workspaces row: is_managed = false,
                                        from_template = 'classic',
                                        status = 'draft'
```

Three consequences:

- **A managed workspace is never edited in place.** Editing `classic` would put the tenant's changes in the path of the next seed update. `from_template` records the ancestry so a later question — "what did they change about Classic?" — has an answer.
- **A managed workspace can be updated by Dealpath** without touching any fork. Forks do not track upstream and are not meant to; a fork is a decision the tenant made.
- **The fork inherits nothing about audience.** Assignment is a separate act, which is the point of `workspace_assignments` being its own table.

## Draft and publish

`workspaces` carries `spec`, `published_spec`, `status`, and `version` (`04`). The rules:

| Act | Effect |
|---|---|
| Edit | writes `spec` only. Readers are unaffected |
| Preview | the author resolves the shell's navigation, home surface and chrome against `spec` instead of `published_spec`, for their session only. The focus stays the published one — see below |
| Publish | copies `spec` → `published_spec`, `version += 1`, `status = 'published'`. Audited |
| Archive | `status = 'archived'`. Stops resolving; assignments are retained so an un-archive restores the audience |
| Delete | soft delete via `deletedAt`, like every `configTable` row |

**Why `published_spec` is its own column.** A "draft flag plus be careful" arrangement means every reader must remember to check it, and one reader that forgets sends an unpublished navigation to a tenant. Separating the columns makes the read path incapable of the mistake: resolution reads `published_spec` and never sees `spec`. That is the same reasoning `04` applies to focus-versus-permission; put the rule where it is impossible to forget it.

**What preview does not cover.** The limits below are stated in the admin UI (`WorkspacePreviewBanner`), because an admin who assumes either away draws the wrong conclusion from a page that looked right.

1. **It does not preview someone else's experience**, because the data behind every surface is the previewer's own access plan. An admin previewing the Connect workspace sees Connect's navigation over their own grants; that is the correct and only safe behavior. "Preview as user" is the obvious next request; it is an impersonation feature (`docs/coreservices/authz/09`), handled separately.
2. **It does not preview a change to the focus.** A preview reports the workspace's PUBLISHED focus, whatever `spec.focus` says. The chip reports a focus; the rows are narrowed by a predicate the grid re-reads server-side from `published_spec` so that a caller does not rewrite it. Reporting the draft's focus would put a header counting one set of records over a body drawing another. Previewing a focus change needs the grid to accept a preview too; that is a second reader of the draft column and a separate decision.

A workspace that has never been published reports no focus at all, because there is no published predicate for the grid to re-read; a chip there could only claim a narrowing the rows do not have.

## Versioning, and what is not versioned

`version` is a monotonic counter stamped at publish, recorded in the audit entry, and used for exactly two things: naming a version in the audit trail, and optimistic concurrency on publish (two admins publishing one workspace is the `publishDraft` lost-update shape already fixed once in this repo with an advisory lock and a re-read — `CLAUDE.md`, running the suite).

**Prior specs are not retained.** No version history table, no rollback-to-v3. The reasons: a workspace references views by handle, so an old spec restored a month later may point at views that have since changed or gone, making the restore a different application than the one that was published; and the recovery path that matters — "put back what we had this morning" — is served by the audit record plus a fork, without a second storage system to keep coherent. If version history is later wanted, it is additive and this decision is the cheap one to revisit.

## Tenant transfer

The `CLAUDE.md` rule: a tenant's data must be movable between environments and sites, and nothing environment-specific may be baked into tenant-owned data. Workspaces satisfy it by construction if two things hold:

1. **No free-text URLs.** `route` targets are members of a bounded `NamedRoute` enum (`04`). A stored `https://app-preview.example.com/...` would break on import, and would additionally be an open-redirect surface.
2. **No environment-scoped identifiers.** Targets are handles (`view`, `play`, `type`), and assignments name group ids, user ids, and role handles — all tenant-scoped, all already carried by an export.

The verification is not a review checklist. It is the dataset engine: a workspace kind that round-trips through `write-dataset` → `load` → `apply` into a second tenant, with the resolved navigation compared on both sides, proves portability by exercising it. `packages/tooling/dataset/src/apply.integration.test.ts` is the existing pattern.

**The one hazard.** `workspace_assignments` rows naming *user* ids are the least portable part, because a user id may not survive a move the way a group or role handle does. Prefer role and group assignment; treat the user tier as an override for individuals, and expect an import to drop user assignments whose principal did not come across, with the drop reported rather than silent.

## Migration from legacy

`docs/reference/modernization/06-migration-roadmap.md` is the sequencing home; this is the mapping. A legacy team's app shape becomes **one workspace plus zero new flags**, and the 51 flags disperse to five destinations:

| Legacy input | Destination | Note |
|---|---|---|
| `feature_access.{assets,loans,comps,leases,funds,funding_events,investments}` (7 flags) | the tenant's **registered entity types** | already how Neuro answers this; nothing to migrate but the fact of which types to register |
| `feature_access.{white_label}` | **design tokens** | not a workspace concern (`03` non-goal 2) |
| `feature_access.{secondary_members}` | **roles** (`docs/coreservices/authz/10`, tenant-defined roles) | the union-versus-rank prerequisite that doc names is done — `expandRoles` is a transitive closure over `builds_on` (`packages/shared/authz/src/decide/plan.ts:31`) |
| `feature_access.{sso_access, single_logout}` | **`@neuro/authn`** and `tenant_domains` (ADR-0014) | |
| `feature_access.{limit_access_to_properties, restrict_approval_editing, disable_shareable_file_links}` | **`permission_rules` / `field_rules`** | these are permissions and must not become lens config |
| `feature_access.{dp_connect}` | **a second workspace** (`connect`) | the flag becomes a row |
| the remaining product-entitlement flags | **`@neuro/flags` / `@neuro/settings`** | with the 12 dark flags and the 3 universal ones **dropped, not migrated** (`06`) |
| `useNavItems.tsx` structure | the **`navigation` tree** of the `classic` fork | one workspace per team, generated |
| `isCollaborator` + the 8-type deny set | **`is_external` + grants** for access; a short workspace for the app | the split is the whole point (`04`) |
| `MEMBER_LEVEL` rungs | **roles** for the authority half; **workspace assignment** for the presentation half | the fusion is legacy P1 (`01`) |
| `user_settings.login_landing_page` (+ `login_landing_page_reporting_dashboard_id`) | a **`view_defaults` row with context `'home'`** per user; the workspace's `surfaces.home` is the default under it | the per-user half of legacy M5, kept per-user — the dashboard-id variant is a home default naming a `dashboard` view |

**The migration is generated, not hand-authored.** 55 teams is too many to write by hand and too few to justify tooling that outlives the migration: a script reads `feature_access` and the entity-type registry per team and emits a `workspaces.json` fork of `classic`. It runs once, its output is reviewed, and the output — not the script — is the artifact. `docs/operations/data-migration/01-identifier-map.md` is where the id mapping lives.

**Two migration invariants worth asserting:**

1. **No flag survives as a flag.** Every one of the 51 names resolves to a row in the table above, or is explicitly dropped with a reason. A leftover `workspace.features.X` would be `01` P2 reproduced on new schema.
2. **Back-test against real legacy behavior, not against an assumption of it.** `CLAUDE.md` requires this for ported behavior. For each migrated team, the generated navigation is compared against what `useNavItems.tsx` would actually produce for that team's flags — which is mechanically checkable, since the function is pure over `featureAccess`, `isCollaborator`, the enabled types, and the member level. A comparison against what we *think* the sidebar shows is not the test.
