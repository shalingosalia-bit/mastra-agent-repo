# Legacy functionality subsumed by this module

Every legacy column, table, route and flag that holds part of a tenant's appearance, with what becomes of it. The dispositions are **Ported** (the same behaviour in the new model), **Absorbed** (folded into an operation), **Split** (parts go different ways), **Moved** (another stack owns it), and **Declined** (nothing replaces it, with the reason). Citations are to `the_wall` on `develop`, as [`01`](01-legacy-pitfalls.md) states.

## Columns on the team row

| Legacy | Disposition |
|---|---|
| `teams.whitelabel_logo_setting` | **Declined.** The enum records whether a custom logo is in use, and resolution answers that from the presence of a live asset (B4, B11) |
| `teams.whitelabel_logo_url` | **Ported** as a `brand_assets` row with role `logo`, one per colour scheme, its object key derived from the row (B4, B8) |
| `teams.picture_url` | **Ported** as a `brand_assets` row with role `wordmark` where a tenant uses it. [`01`](01-legacy-pitfalls.md) §7 records why three image columns are one concern |
| `teams.entity_type_aliases` | **Declined.** Renaming a record type reaches every screen, every export and every agent reply, and no Neuro stack owns that today. Recorded here so a reader does not take this stack as covering it |
| `teams.domain` | **Moved** to `platform.tenant_domains` ([ADR-0014](../../coreservices/authn/ADR-0014-domain-routing-and-sso.md)). It is an email domain and never a web host ([`01`](01-legacy-pitfalls.md) §10) |

## The export footer

| Legacy | Disposition |
|---|---|
| `export_footers.name`, `.description` | **Ported** as `brands.handle` and `brands.display_name` |
| `export_footers.disclaimer` | **Ported** as `brands.disclaimer`, with its length bound declared as a setting and no longer as a column width ([`01`](01-legacy-pitfalls.md) §8) |
| `export_footers.show_date`, `.show_page_number` | **Moved** to the render target's options. Both are properties of a printed page, and [`../../coreservices/render/04-proposed-model.md`](../../coreservices/render/04-proposed-model.md) owns the target |
| `export_footers.show_dp_logo` | **Declined.** A tenant either has a brand or resolves to the platform's own (B11). A toggle over our mark states the same fact a second time |
| `export_footers.export_views`, `.export_dashboards`, `.export_reports`, `.export_tasks`, `.export_comps` | **Declined** in favour of `brand_bindings` (B10, B14). [`../../coreservices/render/05-legacy-functionality-map.md`](../../coreservices/render/05-legacy-functionality-map.md) records the same disposition from the render side |
| `index_export_footers_on_team_id_and_name` | **Ported** as the unique `handle` per tenant. [`01`](01-legacy-pitfalls.md) closes on this as the one legacy rule that survives unchanged |

## Per-person formatting

| Legacy | Disposition |
|---|---|
| `user_settings.timezone` | **Split.** The person's own value stays with the person, and a tenant default is added beneath it (B16, B17) |
| `user_settings.date_format` | **Split** the same way. The stored value names a locale and its options, so a reader of the row needs no constant to decode it (B18) |

## Routes and controllers

| Legacy | Disposition |
|---|---|
| `POST /team/whitelabel_logo` (`handlers/team_handler.rb:400-411`) | **Ported** as `uploadAsset` and `confirmAsset`, with the entitlement check the legacy route omits ([`01`](01-legacy-pitfalls.md) §3) |
| `CoreTeamController.save_whitelabel_logo` (`core/team_management/controllers/core_team_controller.rb:271-289`) | **Split**: the validation call is **ported**; the delete-then-write is **declined** (B5); the URL assembled from a settings value is **declined** (B8) |
| `Core::Storage::ImageController.validate` | **Ported** as the accepted content types and the size and dimension bounds of B6, with SVG sanitization added (B7) |
| The `whitelabel_logo_setting` branch (`handlers/team_handler.rb:208-222`) | **Absorbed** into `saveBrand` |
| `_delete_whitelabel_logo` (`core_team_controller.rb:282`) | **Declined.** Superseding keeps the row and the sweep removes the object after the retention window (B5, NFR3) |

## Entitlement

| Legacy | Disposition |
|---|---|
| `FeatureAccess::FEATURES[:WHITE_LABEL]` (`handlers/team_handler.rb:213`) | **Moved** to `@neuro/flags`, and evaluated inside resolution so a withdrawal takes effect on the next read (B13). [`../workspaces/01-legacy-pitfalls.md`](../workspaces/01-legacy-pitfalls.md) M1 records why the flag table itself is not ported |

## Capabilities legacy never had

These have a blank `Legacy today` cell in [`03`](03-requirements-and-user-stories.md), so nothing above maps to them. They are new work and not parity:

1. A brand colour (B2) and the contrast check that keeps the product readable (B3).
2. Dark-scheme assets and a favicon (B4).
3. Recovery of an asset someone replaced by mistake (B5).
4. SVG sanitization (B7) and an asset URL that does not identify the tenant (B8).
5. A reason attached to the resolution, so an operator can answer why a surface showed a brand (B12).
6. Tenant-level formats, and a stored format a reader can interpret (B16, B18).
7. A hostname a tenant owns, with verification, a lifecycle and a bounded anonymous answer (B19 to B23).

## Gaps, and where they go

No migration sequence exists for the rows above. [`../../reference/modernization/06-migration-roadmap.md`](../../reference/modernization/06-migration-roadmap.md) sequences records and attachments and names no branding column. [`../../operations/data-migration/01-identifier-map.md`](../../operations/data-migration/01-identifier-map.md) owns column-level mapping and takes `user_settings.timezone` as an input to a derived `display` value. It maps neither that column nor `date_format` onto a tenant default, and it has no row for the team-row or footer columns above.

This table is the input to that sequence and not a substitute for it. Writing the ordering, the validation and the cutover steps needs a scheduling decision this stack does not have at status `proposed`, and that decision adds the source-to-target rows to `data-migration/`.

`entity_type_aliases` is the only legacy capability with no replacement anywhere in this model. Every other declined row is a mechanism whose capability survives by another route, and a tenant renaming its record types today has nothing here. Renaming a record type belongs with the entity-type registry in [`../../coredata/entity-fields/`](../../coredata/entity-fields/00-entity-fields.md), because the name is a property of the type and not of the tenant's appearance. Until a stack takes it, a migration from legacy leaves those aliases behind, and [`../../operations/data-migration/`](../../operations/data-migration/00-data-migration.md) is where that has to be stated for a customer.
