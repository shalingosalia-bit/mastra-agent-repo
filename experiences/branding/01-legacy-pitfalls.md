# Legacy branding: how it works, and the constraints its defects impose

Grounded in `the_wall` on `develop`: `castle_black/db/schema.rb` (the global database, where `teams` lives), `db/schema.rb` (the shard database, where `export_footers` and `user_settings` live), `handlers/team_handler.rb`, and `core/team_management/controllers/core_team_controller.rb`. The measured legacy figures this document would otherwise restate are owned by [`../../reference/legacy_assessments/`](../../reference/legacy_assessments/README.md), [`../../coreservices/render/01-legacy-pitfalls.md`](../../coreservices/render/01-legacy-pitfalls.md) §7 and [`../workspaces/01-legacy-pitfalls.md`](../workspaces/01-legacy-pitfalls.md) M1, and are cited here.

## How a tenant's appearance exists today

A team's visual identity is two columns on the team row, `whitelabel_logo_setting` (a string enum of `default` and `custom`) and `whitelabel_logo_url` (a plain string), with a third image column, `picture_url`, beside them (`castle_black/db/schema.rb:198,217-218`). Turning the custom logo on is gated by a `feature_access` row, `WHITE_LABEL`, checked where the setting is written (`handlers/team_handler.rb:213`). Uploading the image is a separate route that stores the object in the shared pictures bucket under `whitelabel-logo/<team_id>-<epoch>`, deletes the previous object, and writes the assembled public URL back onto the column (`core/team_management/controllers/core_team_controller.rb:271-289`). Printed output has its own record: `export_footers` in the shard database has a name, a description, a disclaimer, three display booleans, and one boolean per printable surface (`db/schema.rb:1022-1038`). Date and time display is per person on `user_settings` (`db/schema.rb:2957-2961`). There is no colour, no favicon, no dark variant, no tenant-owned hostname, and no tenant-level date format anywhere in the schema.

## The defect classes

### 1. The brand is two columns on the tenant row

`whitelabel_logo_setting` and `whitelabel_logo_url` sit on `teams` among the unrelated settings that table has accumulated (`castle_black/db/schema.rb:195-246`): seat counts, session timeouts, approval rules, invitation policy, a currency field reference and a migration status flag. Adding a favicon, a dark-mode logo or a brand colour is a migration on the busiest table in the global database. None of the three were added. **Constraint:** a brand is its own row, and an asset is a row under it, so a new asset role is data.

### 2. An asset is a URL string assembled in application code

The column stores a URL built by concatenating a settings value with the object key (`core_team_controller.rb:284`). Nothing records the content type, the size, the dimensions, or whether the object was scanned; nothing ties the row to the object once the string is written. A string that no longer resolves is indistinguishable from one that does. **Constraint:** an asset is a row this stack owns, stating its content type, byte size, scan state and colour scheme. Its storage key is derived from the row through `@neuro/storage`'s `keyFor`.

### 3. Entitlement, setting and asset are three states that can disagree

The entitlement check runs where the setting is written and nowhere else (`handlers/team_handler.rb:213`). The upload route checks membership level and never checks entitlement (`handlers/team_handler.rb:400-411`). So a team with no `WHITE_LABEL` row can upload a logo and store it. A team whose entitlement is withdrawn keeps `whitelabel_logo_setting = 'custom'` and its URL on the row, and the client still receives both (`sunspear` `app/models/team.ts:103-104`). Whether any display path re-reads the entitlement is not established here; what is established is that the withdrawal changes no stored state. **Constraint:** one resolution answers what a surface shows, and every condition on that answer is evaluated inside it. A condition enforced at write time alone is a validation, and this design treats it as one.

### 4. Overwriting the logo destroys the previous object

The save path deletes the prior S3 object before writing the new URL (`core_team_controller.rb:282`). An admin who uploads the wrong file has destroyed the right one, and the tenant has no earlier state to return to. **Constraint:** replacing an asset supersedes it and keeps the superseded row, on the one-live-row-per-key mechanism ([`../../reference/modernization/23-shared-mechanisms.md`](../../reference/modernization/23-shared-mechanisms.md) §5).

### 5. Logo objects are world-readable at a guessable key

The object key is `whitelabel-logo/<team_id>-<epoch>` in a bucket shared by every tenant, and the URL is public (`core_team_controller.rb:275,284`). Team ids are sequential integers. Anyone can walk the id space and learn which teams have a custom logo, and read the logo of any team whose epoch they can find. **Constraint:** a brand asset is public by design, since a sign-in page has to render it before anyone signs in. Its public URL is therefore built from an unguessable identifier naming no tenant and following no sequence, and the storage key stays private behind it.

### 6. The footer record decides which surfaces it applies to

`export_footers` has `export_dashboards`, `export_reports`, `export_views`, `export_tasks` and `export_comps` (`db/schema.rb:1032-1036`): one boolean per printable surface, inside the branding record. A new printable surface is a schema change, and "this footer applies everywhere except reports" is expressible only by enumerating the rest. [`../../coreservices/render/01-legacy-pitfalls.md`](../../coreservices/render/01-legacy-pitfalls.md) §7 records the same defect from the render stack's side. **Constraint:** the binding between a brand and a surface is a row of its own, and the set of surfaces lives outside the brand.

### 7. Three columns answer "what is this tenant's image"

`picture_url`, `whitelabel_logo_url` and the footer's `show_dp_logo` boolean (`castle_black/db/schema.rb:198,218`; `db/schema.rb:1031`) each answer part of the question, with no rule saying which wins on a surface that could use any of them. The third is a toggle over Dealpath's own logo rather than a reference to the tenant's. **Constraint:** every asset declares its role, resolution answers per role, and the platform's own mark is the fallback when a role has no asset.

### 8. Disclaimer text is capped by a column width

`export_footers.disclaimer` is `limit: 150`, as are `name` and `description` (`db/schema.rb:1026-1028`). A disclaimer that legal counsel wrote does not fit in 150 characters, and the limit is invisible until the save fails. **Constraint:** a disclaimer is text with a bound declared as an operator-tunable setting, stated in [`05`](05-interface-and-configuration.md) with what happens when it is exceeded.

### 9. There is no tenant-level date format or timezone

`timezone` and `date_format` are columns on `user_settings` and appear nowhere else in either schema (`db/schema.rb:2957-2961`). A tenant has no house format. [`../../operations/data-migration/01-identifier-map.md`](../../operations/data-migration/01-identifier-map.md) reaches the same finding from the migration side, in its `display` and `units` rows: no currency, locale or unit column exists anywhere in legacy, and `user_settings.timezone` is the only reusable value. An export produced by a scheduled job has no person to take a format from, so it falls back to whatever the code picked. `date_format` is an integer whose meaning lives in a constant, so the stored value means nothing to a reader of the database. **Constraint:** the tenant has a default, a person may override it, an unattended job uses the tenant's, and the stored value names a format that a reader can interpret without the code.

### 10. There is no tenant-owned hostname, and the one domain column is an email domain

Sign-in is one host per environment. Per-team SSO is `sso_settings`, keyed on `(team_id, environment)` (`castle_black/db/schema.rb:129-142`), and it configures an identity provider without giving the team an origin of its own. The `domain` column on `teams` is an email domain of 44 characters (`castle_black/db/schema.rb:197`), used for membership rules and not for routing a browser. **Constraint:** a branded host is its own record with its own verification, and this stack states the separation from [ADR-0014](../../coreservices/authn/ADR-0014-domain-routing-and-sso.md)'s email domain, which selects an identity provider and grants nothing.

### 11. Terminology overrides are checked in one handler and typed nowhere

`teams.entity_type_aliases` is a `json` column (`castle_black/db/schema.rb:243`), written through the same settings handler as the branding fields (`handlers/team_handler.rb:237`). Its contents are checked by `TeamHandler.validate_entity_type_aliases` (`handlers/team_handler.rb:4183`), which accepts only known entity types, rejects the ones excluded from relabelling, and bounds each label. Those rules are sound and they live in one write path, so the database itself accepts whatever a second writer sends. **Constraint:** renaming a record type is out of scope for this stack. [`06-legacy-functionality-map.md`](06-legacy-functionality-map.md) records the column as declined so that a later reader does not take this stack as covering it.

## What legacy gets right

Separating the mechanism from the verdict, one of legacy's rules survives unchanged. A brand record is **named and unique per tenant** (`index_export_footers_on_team_id_and_name`, `db/schema.rb:1037`). A tenant can therefore keep several and choose between them.

`show_date` and `show_page_number` are a second case where the rule is sound and its placement is wrong. Both are switches over a printed page, and legacy keeps them on the branding record beside the per-surface booleans. [`06-legacy-functionality-map.md`](06-legacy-functionality-map.md) moves them to the render target's options, where page size and orientation already live, and [`../../coreservices/render/04-proposed-model.md`](../../coreservices/render/04-proposed-model.md) §Branding states the same split from the render side.
