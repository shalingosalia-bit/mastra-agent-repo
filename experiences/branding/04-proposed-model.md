# Proposed model: the brand, its assets, the bindings, the formats, and the hosts

Five concerns, one of them cross-tenant. A brand and its assets and bindings are tenant rows under RLS. Presentation defaults are one row per tenant. A branded host is a platform row, because a hostname is unique across every tenant and an anonymous caller reaches it before any tenant is known. The heavy machinery is already elsewhere: object storage and key derivation in `@neuro/storage`, the scan pipeline with it, the token sheet in [`../design-system/`](../design-system/00-design-system-reference.md), retention and the one-live-row index in [`../../reference/modernization/23-shared-mechanisms.md`](../../reference/modernization/23-shared-mechanisms.md), and DNS verification as [ADR-0014](../../coreservices/authn/ADR-0014-domain-routing-and-sso.md) already built it for email domains.

## Data model

| Table | Grain | Key semantics |
|---|---|---|
| `brands` | one row per named brand per tenant | tenant, id, `handle` (unique per tenant), `display_name`, `disclaimer`, `sender_name`, `state` (`draft`/`published`), soft-delete. RLS-scoped |
| `brand_token_overrides` | one row per overridable token per brand | tenant, brand, `token` (a closed enum, §The overridable tokens), `value` (a colour in the sheet's own notation), the contrast ratio computed at save and the token it was compared against |
| `brand_assets` | one row per version of one asset role in one colour scheme | tenant, brand, `role` (`logo`/`wordmark`/`favicon`/`email_header`), `scheme` (`light`/`dark`/`any`), `content_type`, `byte_size`, `width`, `height`, `object_key` (derived, §Assets), `scan_state` (`pending`/`clean`/`quarantined`), `superseded_at`, creator principal |
| `brand_bindings` | one row per surface per tenant | tenant, `surface` (an open registry key, §Bindings), brand, `is_default` |
| `presentation_defaults` | one row per tenant | tenant, `locale` (BCP 47), `timezone` (IANA), `date_style`, `number_style`, `currency_display`, each an explicit option set and not an integer index |
| `platform.branded_hosts` | one row per hostname, across every tenant | `hostname` (globally unique, lower-cased), tenant, `auth_scope`, `state` (`claimed`/`verified`/`live`/`retired`), `verification_token`, `verified_at`, `retired_at` |

## The overridable tokens are a closed set

B2 permits a tenant to set values for named tokens and for nothing else. A JSON column would accept any key and validate none of them. [`01`](01-legacy-pitfalls.md) §11 records that defect against `entity_type_aliases`. So an override is a row whose `token` column is an enumerated type:

```sql
create type brand_token as enum (
  'primary', 'primary_foreground', 'accent', 'accent_foreground', 'ring'
);

create unique index brand_token_overrides_one_per_token
  on brand_token_overrides (tenant, brand_id, token);
```

The set is the subset that expresses a brand in `@neuro/ui`'s sheet. The status colours stay out of it: a tenant setting `destructive` to its own green makes a delete confirmation look like a success message in every screen at once, and no tenant asking for a brand colour is asking for that. Adding a member is a migration and a review, and [`05`](05-interface-and-configuration.md) states that cost beside the extension points.

Each override row keeps the contrast ratio computed at save, along with the token it was compared against (B3, NFR5). Storing the measurement makes an admin screen able to show why a value was accepted, and makes a later change to the floor auditable against the rows already saved.

## Assets

An asset object is stored the way every tenant object is stored, through `@neuro/storage`'s `bucketFor` and `keyFor`: prefixed with the tenant slug in a pool, and in the tenant's own bucket in a silo (`packages/tenant/storage/src/index.ts:34-42`). Those keys stay private and no browser receives one.

What a browser receives is a public URL built from the asset row's own opaque id, under the `assetBaseUrl` of [`05`](05-interface-and-configuration.md). A public route reads the id, streams the object behind it, and reveals neither the bucket nor the key. The id names no tenant and follows no sequence (B8), so nobody can walk the space to learn which firms use the product. Superseding writes a new row with a new id, so the URL changes when the asset changes and no consumer needs telling to discard the old one (NFR2). Legacy publishes the storage path itself, with the team id and a timestamp inside it ([`01`](01-legacy-pitfalls.md) §5).

Replacing an asset writes a new row and sets `superseded_at` on the old one (B5). One asset is live per role and scheme:

```sql
create unique index brand_assets_one_live
  on brand_assets (tenant, brand_id, role, scheme)
  where superseded_at is null;
```

This is the one-live-row-per-key mechanism ([`../../reference/modernization/23-shared-mechanisms.md`](../../reference/modernization/23-shared-mechanisms.md) §5), and the predicate is the whole condition. A superseded row is kept for the retention window NFR3 declares, then its object is removed by the sweep below.

### A brand asset is not a document

[`../../coreservices/documents/04-proposed-model.md`](../../coreservices/documents/04-proposed-model.md) reads a tenant-anchored document under `manage` on `Tenant`. That is correct for the offboarding archive the anchor was designed for. A logo is the opposite case: the sign-in page renders it for a caller with no session at all (B21, [`../../coreservices/authn/07-auth-scope-topology.md`](../../coreservices/authn/07-auth-scope-topology.md) §Auth-surface topology: one surface, many apps). Filing brand assets as documents would either widen that anchor's read rule for every document under it, or add a fifth anchor kind whose authorization contradicts the other four. The two also differ in lifecycle: a document is a tenant's content and follows the tenant's retention, and an asset is part of the product's chrome and follows NFR3.

## Bindings

A binding names a surface with a registry key, so adding a printable or sendable surface is an insert (B14). A tenant with at least one brand has one default binding, and resolution falls back to it:

```sql
create unique index brand_bindings_one_per_surface on brand_bindings (tenant, surface);
create unique index brand_bindings_one_default on brand_bindings (tenant) where is_default;
```

The surface keys are `app`, `auth`, `render`, `comms` and `public_link` at the outset. A key with no binding resolves through the default, so a new surface needs no backfill.

The index enforces at most one default, and the remaining half of B10 is enforced by the operations:

1. **Provisioning a tenant's first brand writes its default binding in the same transaction.** A brand with no binding resolves for nothing.
2. **Moving the default is one transaction.** The index rejects two default rows, so the old row's flag clears and the new row's sets together, and no intermediate state has two.
3. **Clearing the only default is rejected**, and `bindSurface` says which binding would be left with none. Clearing a non-default binding returns that surface to the default.
4. **Erasure is the exception.** An erasure request removes every binding, the default included, and leaves no brand for one to point at. The tenant resolves to the platform brand afterwards (B11).

## Resolution

One function answers for every signed-in consumer (B9, B15), taking the tenant, the surface, and the principal whose own format settings sit above the tenant defaults (B17). An anonymous caller reaches the narrower form described at the end of this section, which takes a hostname and nothing else. Both answer with plain values:

```ts
type ResolvedBrand = {
  displayName: string
  disclaimer?: string
  senderName?: string
  tokens: Record<BrandToken, string>
  assets: Partial<Record<AssetRole, { light: AssetUrl; dark?: AssetUrl }>>
  formats: { locale: string; timezone: string; dateStyle: DateStyle; numberStyle: NumberStyle }
  source: { brand: string | null; binding: 'surface' | 'default' | 'platform' }
}
```

What makes the answer usable to a caller:

1. **Whether the tenant may show a brand is evaluated here** (B13), on each read. Legacy checks it where the setting is written, and a withdrawal changes no stored state ([`01`](01-legacy-pitfalls.md) §3). Evaluating it inside resolution makes withdrawal take effect on the next read with no sweep and no backfill.
2. **`source` is part of the answer** (B12). An operator asked why a surface showed the wrong brand gets the brand and the binding that produced it from the same call the surface made.
3. **A tenant with no brand resolves to the platform's own** (B11), with `binding: 'platform'`. The absent case is an answer and never an error, so no consumer needs a branch for it.

Authorization is the caller's ordinary plan. Resolution reads rows the caller may already read, and the anonymous path is narrower still: given a hostname it answers the brand and the auth scope, and nothing about membership, tenant size or tenant name beyond what the brand itself states (B21).

## Branded hosts

A host moves through four states, and an operator can see which one it is in (B19, B22, B23):

| State | Means | What moves it on |
|---|---|---|
| `claimed` | The tenant named the hostname. A verification token is issued | The DNS lookup job observes the token |
| `verified` | Control is shown. No certificate yet | `sites/` issues a certificate |
| `live` | The host serves the tenant's brand at its bound auth scope | An operator retires it |
| `retired` | The host serves nothing. Its surfaces return to the default origin | Nothing. The row is kept for the audit trail |

```sql
create unique index branded_hosts_one_tenant on platform.branded_hosts (lower(hostname));
```

The uniqueness is an index rather than a resolution order, on the reasoning ADR-0014 decision 3 already settled for email domains: two tenants claiming one name is a conflict an operator resolves, and a precedence rule would let row order decide whose brand a visitor sees.

**A branded host is an alias of an existing auth scope.** [`../../coreservices/authn/07-auth-scope-topology.md`](../../coreservices/authn/07-auth-scope-topology.md) §Auth scopes: one origin per pool, one per silo puts one auth surface per scope, and a vanity hostname that became a scope of its own would mean a new issuer, a new cookie domain and a new set of tokens per customer. The host selects an appearance and the scope stays where it was.

## Operations

| Operation | What it does |
|---|---|
| `resolveBrand` | The function above. Every surface calls it |
| `resolveForHost` | The anonymous form: hostname to brand and auth scope, nothing more |
| `saveBrand` | Create or update a brand, with the contrast check on each override |
| `uploadAsset`, `confirmAsset` | Presign an upload, then record the row once the object is confirmed and scanned |
| `supersedeAsset` | Replace the live asset for a role and scheme |
| `bindSurface` | Point a surface at a brand, or clear the binding |
| `savePresentationDefaults` | Set the tenant's locale, timezone and formats |
| `claimHost`, `verifyHost`, `retireHost` | The host lifecycle above |

Every write operation takes `manage` on `Tenant`. Legacy asks for that level on the upload route and for less on the setting. Reads follow the caller's plan, and `resolveForHost` is the one unauthenticated entry.

## Events

| Event | When | Payload |
|---|---|---|
| `brand.published` | A brand's values or bindings change | tenant, brand handle, the surfaces affected |
| `brand.asset.replaced` | A new asset supersedes a live one | tenant, brand handle, role, scheme |
| `brand.host.verified` | A claim's DNS record is observed | tenant, hostname |
| `brand.host.retired` | A host leaves service | tenant, hostname |

No event contains bytes or a URL. A consumer that cached a resolution discards it on `brand.published` for the named surfaces, closing the NFR1 window early when someone is watching.

## Jobs

1. **Scan and sanitize on upload.** An object stays `pending` until it passes, and a resolution never returns a `pending` or `quarantined` asset (B6, B7).
2. **Host verification.** Poll the DNS record for a `claimed` host until it appears or the claim expires (B19).
3. **Superseded-asset sweep.** Remove objects whose rows passed the retention window NFR3 declares.

## Erasure

Every row this stack writes is keyed by tenant, and `platform.branded_hosts` names the tenant on the row, so the whole of a tenant's branding is enumerable from the tenant id (NFR4). Deleting it removes the brands, their overrides, their assets, their bindings, the presentation defaults, the host records, and every object behind an asset. The report names counts per table so an erasure request can be answered with what was removed.

## What this module must not do

1. **Render anything.** Consumers receive values. A brand that produced markup would be a second template engine beside [`../../coreservices/messaging/channels/`](../../coreservices/messaging/channels/00-channels.md) and [`../../coreservices/render/`](../../coreservices/render/00-render.md).
2. **Decide who may see a record.** Access plans answer that, and a branded host is an appearance and never an authority ([ADR-0013](../../coreservices/authn/ADR-0013-one-identity-many-tenants.md)).
3. **Issue or renew a certificate.** [`../../operations/sites/`](../../operations/sites/00-sites.md) owns where a tenant lives and what serves it.
4. **Own the token sheet.** [`../design-system/`](../design-system/00-design-system-reference.md) defines the tokens. This stack stores values for a subset of them.
5. **Rename a record type.** Legacy's `entity_type_aliases` has no owner in Neuro, and [`06-legacy-functionality-map.md`](06-legacy-functionality-map.md) records it as declined, and this stack does not absorb it.
6. **Keep a person's preferences.** A person's own timezone and format are facts about the person and belong with the person's settings. This stack supplies the tenant default beneath them (B17).
7. **Decide which navigation items appear.** [`../workspaces/`](../workspaces/00-workspaces.md) owns the shell's arrangement, and its own non-goal 2 excludes style for the same reason this stack excludes arrangement.
