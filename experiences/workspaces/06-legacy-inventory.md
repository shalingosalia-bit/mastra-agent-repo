# Legacy inventory: what the app shape actually consists of, measured

`01-legacy-pitfalls.md` names the five mechanisms. This doc measures them, so the design in `04` is sized against what customers configure rather than against an impression of it.

**Method.** Flag counts come from the local legacy MySQL database (`mysql -u dealpath dealpath`), queried 2026-08-17. Code shapes come from `sunspear` on `major`, read the same day, cited as `file:line`. Confidence is noted per finding. The database is a **development snapshot**: tenant *configuration* is copied wholesale and is trustworthy; per-user preference rows are not representative and are marked where they appear.

## The flag matrix

```sql
select count(distinct feature_name), count(distinct team_id), sum(access=1), sum(access=0)
from feature_access;
```

| | |
|---|---|
| Distinct flag names | **51** |
| Teams | **55** |
| Rows | **2,761** |
| Rows on | **676** (24.5%) |
| Rows off | **2,085** (75.5%) |

Three quarters of the matrix is the *absence* of something, stored explicitly, per team, forever. That ratio is the clearest single argument that this is a schema-shaped hole rather than a configuration surface: a real configuration surface does not spend 75% of its rows saying no.

### The 51 flags, sorted by how many teams have them on

| Flag | On | Concern |
|---|---|---|
| `new_field_value_calculation`, `property_standardization_api`, `reporting_dashboards` | 55 | universal — not a flag |
| `activity_report`, `classic_reporting` | 54 | near-universal |
| `property_required` | 53 | validation behavior |
| `word` | 52 | export format |
| `white_label` | 42 | **chrome** |
| `assets` | 23 | **entity type** |
| `loans` | 20 | **entity type** |
| `comps` | 19 | **entity type** |
| `custom_funds` | 15 | **entity type** variant |
| `bulk_tools` | 14 | capability |
| `investments`, `leases` | 14 | **entity type** |
| `secondary_members` | 13 | **role model** |
| `financial_models`, `webhooks` | 12 | capability |
| `public_api` | 9 | capability |
| `ai_extract`, `ai_extract_with_managed_service`, `dp_connect`, `funds` | 7 | capability / **entity type** / **an entire experience** |
| `mobile` | 7 | platform |
| `etl` | 6 | capability |
| `auto_change_workflow_milestone`, `auto_ddi`, `ddi`, `property_dashboard`, `sandbox_preview`, `sandbox_production`, `task_info_page` | 5 | mixed |
| `sso_access` | 4 | **authentication** |
| `box_edit` | 3 | integration |
| `funding_events` | 2 | **entity type** |
| `legacy_due_date_linking`, `msci_rca_comps` | 2 | mixed |
| `multi_info_view_export`, `restrict_approval_editing` | 1 | **presentation** / **permission** |
| `ai_comps`, `ai_comps_match_score`, `ai_comps_refresh`, `bulk_import_v2`, `comps_backing_property`, `disable_shareable_file_links`, `fund_ownership_percentage`, `limit_access_to_properties`, `mcp`, `mcp_write`, `pendo_debug_logging`, `single_logout` | **0** | dark |

Four findings from the distribution:

1. **At least seven distinct concerns share one bag.** Entity-type enablement (`assets`, `loans`, `comps`, `leases`, `funds`, `funding_events`, `investments` — 7 flags), chrome (`white_label`), the role model (`secondary_members`), authentication (`sso_access`, `single_logout`), permission (`limit_access_to_properties`, `restrict_approval_editing`, `disable_shareable_file_links`), presentation (`multi_info_view_export`), and ordinary product entitlement (the rest). In Neuro these have five different homes — the entity-type registry, design tokens, `docs/coreservices/authz/10`, `@neuro/authn`, and `@neuro/flags`. **A workspace is the home for none of them**, which is why `03` lists "not a feature-flag store" as a non-goal.
2. **12 of 51 flags are on for zero teams** — 660 rows storing "no" about something nobody has. That is 24% of the flag names and 24% of the rows. Some are unreleased (`mcp`, `mcp_write`, `bulk_import_v2`), some are abandoned. Nothing distinguishes the two, because a boolean carries no lifecycle.
3. **Three flags are on for all 55 teams and two for 54.** These are not configuration; they are code that was afraid to be code. Migrating them as flags would carry the fear forward.
4. **`dp_connect` is on for 7 of 55 teams** and is a *whole application* behind one boolean. It is the strongest evidence for the workspace concept in the entire measurement: the product already ships alternate experiences, and the mechanism for choosing them is a bit.

*Confidence: high for counts (direct query); medium for the "concern" column, which is my classification from flag name plus call sites, not a legacy taxonomy — there isn't one.*

## The sitemap

`app/components/app-sidebar/useNavItems.tsx` — **224 lines, 202 of them code**, returning three arrays.

| | |
|---|---|
| Nav entries (top-level + children) | **19** — 15 top-level, 4 children |
| Entries carrying an explicit `display:` gate | 13 |
| Distinct gating mechanisms | 4 — `team.featureAccess.X`, `isCollaborator`, `EntityUtils.isEntityTypeEnabled()`, `AccountUtils.loggedInTeamMemberHasLevel()` |
| Entries whose *route* is computed from a flag | 2 — `Comps` (comps vs leases), `Funds` (funds vs custom funds) |
| Entries with a hand-computed `isActiveOverride` | 8 |
| Entries shipped permanently off | 1 — `{ label: 'My Dashboard', display: 'exclude' } // NYI` |
| Tenants able to change any of it without a deploy | 0 |

The `Funds` entry is the compact illustration of `01` P5:

```ts
route: EntityUtils.isEntityTypeEnabled(EntityType.FUND) ? ROUTES.FUNDS.FUNDS : ROUTES.FUNDS.CUSTOM_FUNDS,
display: (EntityUtils.isEntityTypeEnabled(EntityType.FUND) || team?.featureAccess?.customFunds) && !isCollaborator ? 'show' : 'exclude',
```

Two systems answering "does this tenant have funds", bridged per entry, with the collaborator persona ANDed in as a third term. There is no place to look up the answer; there is only this expression.

The sidebar also carries three constructs that are not navigation entries: `SidebarEntityMenu` and `SidebarReportMenu` (hover menus listing **recently accessed** records or dashboards — `getNavEntities`, `getRecentlyAccessed` — plus a permission-gated "New X" action), `CreateNavButton` (the global create menu over permitted types), and a `badge` field used once, for a vendor "New" pill (`/assets/images/new.svg`) on Listings. All three are computed from data plus permissions rather than configured — which is exactly how they stay in the new model (`04`, derived chrome); only the badge is refused outright.

*Confidence: high — direct read and count.*

## The external persona

| | |
|---|---|
| Entity types denied to collaborators in the UI | **8** — `constants.ts:3678` (`INVESTMENT`, `COMP`, `PROPERTY`, `LEASE`, `FUND`, `FUNDING_EVENT`, `LINE_ITEM`, `BANK_ACCOUNT`) |
| Entity types forbidding external invitation server-side | **5** — `entity_constants.rb:352` |
| Overlap | partial; the lists answer different questions and were derived separately |
| Rungs on `MEMBER_LEVEL` | **9** — `DISABLED(-1000000)`, `INVITED(-100)`, `COLLABORATOR(1)`, `MEMBER(50)`, `MEMBER_PLUS(100)`, `ADMIN(200)`, `ADMIN_PLUS(300)`, `OWNER(400)`, `OWNER_PLUS(500)` (`constants.ts:129`) |
| Rungs that exist to shape *presentation* rather than authority | at least 2 — `COLLABORATOR` (the reduced application) and `ADMIN_PLUS` (which admin route the footer link targets) |

`group_members.member_level` in the snapshot: 308,392 rows at `OWNER`, 14,406 at `MEMBER`, 2,564 `DISABLED`, 816 `ADMIN`, **152 `COLLABORATOR`**, 124 `INVITED`, 62 `MEMBER_PLUS`, 54 `OWNER_PLUS`, 43 `ADMIN_PLUS`. This is per-record access rather than team standing, so it sizes the *shape* of the ladder in use, not the population of external users. The finding it supports: the top and bottom rungs carry essentially all the volume, and the `_PLUS` rungs — the ones that most often exist for presentation reasons — carry 159 rows between them.

*Confidence: high for the code lists; low for generalizing the row counts beyond "the middle rungs are rare".*

## The landing page

| | |
|---|---|
| Columns | `user_settings.login_landing_page`, `user_settings.login_landing_page_reporting_dashboard_id`, `user_settings.entity_landing_page` |
| Validation | `Team.hasLoginLandingPage()` → `LOGIN_LANDING_PAGE_TO_FEATURE_NAME_MAP` → `featureAccess` (`app/models/team.ts:127`) |
| Rows in snapshot | 432, all `deals` |

The row distribution is a snapshot artifact and proves nothing about production; it is recorded only so a later reader does not re-run the query expecting insight. **The mechanism is the finding:** a per-user starting surface exists, it is one enum value plus one optional dashboard id, and it is validated by round-tripping through the flag bag. It is the right instinct reaching as far as a single setting can reach — which is the gap `surfaces.home` in `04` closes.

*Confidence: high for the mechanism; the row counts are explicitly not evidence.*

## What the measurements set as bounds for `04`

| Measurement | Bound it sets |
|---|---|
| 51 flags, 7 concerns, 12 dark | chrome must be a **bounded enum**; a workspace must not be a flag store (`03` non-goals 2, 4) |
| 7 entity-type flags shadowed by a second enablement check | a workspace **consumes** the entity-type registry and never re-encodes it (`04`, R3 / `01` P5) |
| 20 nav entries, at most one level of children | the navigation grammar is **two levels**, not Dynamics' three — matched to observed use (`04`) |
| 13 gates across 4 mechanisms, no precedence | **one resolution fold, one named winner** (`04`) |
| `dp_connect` — an application behind a boolean | alternate experiences are **first-class rows**, not flags (`05` §3) |
| 8-type UI deny set versus 5-type server list | the lens/permission separation, and the **byte-identical result-set test** that pins it (`04`) |
| `login_landing_page` reaching one setting | `surfaces.home` per workspace, with the per-user override kept per-user as a `view_defaults` `'home'` row (`04`) |
| hover menus, create button, and badge computed in components | derived chrome — computed, never configured; badges refused (`04`) |
| `// NYI` shipped as a permanently-excluded node | configuration has no representation for a permanently-off node; delete it (`05` §1) |
