# Interface and configuration points

## Package identity and boundary

`@neuro/branding` is a data-transformation package. It exports one resolution function every surface calls, the admin operations behind it, and the host lifecycle. It owns the brand, override, asset, binding and presentation-defaults tables. It does not render (the app shell, [`../../coreservices/render/`](../../coreservices/render/00-render.md) and [`../../coreservices/messaging/channels/`](../../coreservices/messaging/channels/00-channels.md) do), presign or scan an object (`@neuro/storage`), decide who may read a record (access plans), or issue a certificate ([`../../operations/sites/`](../../operations/sites/00-sites.md)).

One table is outside it. `platform.branded_hosts` is cross-tenant and lives in `@neuro/core` beside `platform.tenant_domains`, which [ADR-0014](../../coreservices/authn/ADR-0014-domain-routing-and-sso.md) already put there. `@neuro/branding` reaches it through the `hosts` port below, so a package holding tenant rows under RLS never opens a cross-tenant table itself.

## Public surface

| Export | Kind | Shape |
|---|---|---|
| `resolveBrand` | operation | `(deps, { tenant, surface, principal? }) → ResolvedBrand` |
| `resolveForHost` | operation | `(deps, { hostname }) → { brand: ResolvedBrand; authScope: string } \| null` |
| `saveBrand` | operation | `(deps, { handle, displayName, disclaimer?, senderName?, overrides }) → Brand` |
| `uploadAsset` | operation | `(deps, { brand, role, scheme, contentType, size }) → { asset, uploadUrl }` |
| `confirmAsset` | operation | `(deps, { id }) → Asset` |
| `supersedeAsset` | operation | `(deps, { brand, role, scheme }) → Asset` |
| `bindSurface` | operation | `(deps, { surface, brand \| null, isDefault? }) → Binding` |
| `savePresentationDefaults` | operation | `(deps, { locale, timezone, dateStyle, numberStyle, currencyDisplay }) → PresentationDefaults` |
| `claimHost` | operation | `(deps, { hostname, authScope }) → { host, verification: { name, value } }` |
| `verifyHost` | operation | `(deps, { hostname }) → Host` |
| `retireHost` | operation | `(deps, { hostname }) → Host` |
| `ResolvedBrand` | type | the answer shape of [`04`](04-proposed-model.md) §Resolution |
| `BrandToken`, `AssetRole`, `Surface` | types | the closed enum, the closed enum, and the open registry key |

## Ports

| Port | What it does | Default shipped | Why it is a port |
|---|---|---|---|
| `db` | the tenant-scoped Drizzle handle | none, required | the host resolves tenancy, and the driver differs per environment |
| `storage` | presign one object for one verb and derive its key | none, required | `@neuro/storage` owns key derivation and the scan pipeline |
| `hosts` | read and write `platform.branded_hosts` | none, required | the table is cross-tenant and belongs to `@neuro/core` |
| `publish` | emit a domain event | none, required | the driver is inline, QStash or EventBridge by environment |
| `dnsLookup` | read the TXT record for a claimed hostname | none, required | a test cannot wait on real DNS, and [ADR-0014](../../coreservices/authn/ADR-0014-domain-routing-and-sso.md) already injects one for email domains |
| `sanitizer` | strip an uploaded SVG to an allow-list | none, required when `svgAssets` is on | the allow-list is a security decision the host reviews, and the implementation is replaceable |
| `clock` | current time | system clock | a claim's expiry and an asset's retention window cannot be tested against a real clock |

## Configuration arguments

### Instantiation-time

Fixed for the process, supplied once when the package is constructed. No user-facing meaning when correct.

| Argument | What it does | Default | Type | Where the value lives | If set wrong |
|---|---|---|---|---|---|
| `assetBaseUrl` | The address brand images are served from. A viewer sees the image, and this value means nothing to them | none | URL | SST output | absent, and the app stops at startup instead of serving pages with broken logos |
| `platformBrand` | The product's own logo, name and colours, used for any tenant that has set none | none | brand literal | build-time constant | absent, and a tenant with no brand of its own gets a blank page where a logo belongs |

### Operator-tunable

A threshold an operator reasonably changes without a deploy, declared through [`packages/shared/settings`](../../../packages/shared/settings). This group is the one a product manager reads.

| Setting | What it does | Default | Type | Settings key | If set wrong |
|---|---|---|---|---|---|
| `assetMaxBytes` | The largest image file someone can upload for a logo | 2 MiB | integer | `BRANDING_ASSET_MAX_BYTES` | `0`, and every upload is rejected with a size message naming no size that would work |
| `assetMaxPixels` | The largest width or height an uploaded image may have. A very large image slows every page that shows it | 4096 | integer | `BRANDING_ASSET_MAX_PIXELS` | `0`, and no image is accepted; unbounded, and one tenant's logo can stall a render |
| `disclaimerMaxChars` | How long the disclaimer printed on exports may be. Legacy caps it at 150 characters, which is shorter than most legal text | 2000 | integer | `BRANDING_DISCLAIMER_MAX_CHARS` | `0`, and no disclaimer can be saved at all |
| `contrastFloor` | The contrast a brand colour must reach against the text that sits on it, so the product stays readable | 4.5 | number | `BRANDING_CONTRAST_FLOOR` | `1`, and the check passes everything, which is the same as having none; `21`, and only black on white passes, so no brand colour can be saved |
| `resolutionCacheTtl` | How long a page may keep using a brand it already looked up. Longer is faster; shorter makes a rebrand appear sooner | 60s | duration | `BRANDING_RESOLUTION_CACHE_TTL` | `0`, and every page view reads the database; a day, and a tenant that changes its logo waits a day to see it |
| `supersededAssetRetention` | How long a replaced logo can still be recovered | 30d | duration | `BRANDING_SUPERSEDED_ASSET_RETENTION` | `0`, and the replaced file is destroyed at once, which is the legacy behaviour B5 was written to fix |
| `hostClaimTtl` | How long an unverified hostname claim is held before the name is released | 7d | duration | `BRANDING_HOST_CLAIM_TTL` | `0`, and a claim expires before DNS can propagate, so no hostname is ever verified |
| `hostDnsPollInterval` | How often an unverified claim is re-checked | 5m | duration | `BRANDING_HOST_DNS_POLL_INTERVAL` | `0`, and the job re-checks continuously against the resolver's rate limit |

### Tenant-scoped

A value a customer sets for itself. It is configuration data, arriving through a config dataset section with a provisioning default, per [`packages/tenant/core/CLAUDE.md`](../../../packages/tenant/core/CLAUDE.md) rule 10 and [`packages/tooling/CLAUDE.md`](../../../packages/tooling/CLAUDE.md) rule 4.

| Argument | What it does | Provisioning default | Type | Dataset section | If set wrong |
|---|---|---|---|---|---|
| `brand` | The firm's name, colours and disclaimer as people see them | none | brand | `brand` | absent, and the tenant shows the product's own brand, which is a legitimate configuration and not an error |
| `bindings` | Which brand each surface shows, for a tenant that keeps several | one default binding | binding list | `brand-binding` | a binding naming a brand that was deleted, and the surface falls through to the default rather than failing |
| `presentationDefaults` | The firm's house timezone, date format and number format | the platform locale and UTC | option set | `presentation-defaults` | an IANA timezone the runtime does not know, and every date renders in UTC with no error; the save validates the name against the runtime's own list |
| `brandedHosts` | Hostnames the firm owns and wants its people to use | none | host list | `branded-host` | a hostname pointing at a certificate that has not been issued, and a visitor gets a browser warning; the `live` state of [`04`](04-proposed-model.md) §Branded hosts prevents the transition |

A dataset applied at another site omits the `branded-host` section. A hostname is a fact about the internet and not about a tenant's contents, and importing one would claim a name the destination site does not control. [`../../coredata/datasets/`](../../coredata/datasets/00-datasets.md) doc `08` owns what a transfer takes.

### Per-call

Arguments on the operation, listed here to mark them as not configuration. A value varying per request must never also be readable from settings, or two callers get different behaviour from one code path.

| Argument | On | What it decides |
|---|---|---|
| `surface` | `resolveBrand` | Which binding answers |
| `principal` | `resolveBrand` | Whose own format settings sit above the tenant defaults (B17) |
| `hostname` | `resolveForHost` | Which tenant and auth scope the anonymous answer is for |
| `scheme` | `uploadAsset`, `supersedeAsset` | Which colour scheme the asset is for |

## Feature toggles

| Toggle | What it does | Default | Gates | Blocked on |
|---|---|---|---|---|
| `brandedHosts` | Whether a customer may point its own hostname at the product | off | `claimHost`, `verifyHost`, `resolveForHost` | certificate issuance in [`../../operations/sites/`](../../operations/sites/00-sites.md) |
| `svgAssets` | Whether a logo may be uploaded as an SVG, which is smaller and stays sharp at any size | off | the `sanitizer` port and the SVG content type | a security review of the sanitizer allow-list ([`02`](02-best-practice-research.md)) |

## Extension points

| Point | Kind | Cost of a new member |
|---|---|---|
| `BrandToken` | closed enum | a migration, a review, and a contrast pairing so B3 has something to check the new token against |
| `AssetRole` | closed enum | a migration and a review. Each surface decides on its own whether it uses the role |
| `Surface` | open registry | register `public_link` beside `render`, with no migration (B14) |
| Format styles | closed set over `Intl` options | a migration, and the stored options stay readable without the code that wrote them (B18) |

The token enum states its cost because the contrast rule depends on pairings: a new colour token with no foreground token beside it has nothing to be measured against, and B3 would pass it unchecked.

## What is deliberately not configurable

1. **The status colours.** A tenant setting `destructive` to its brand colour makes a delete confirmation look like a success message on every screen.
2. **Fetching an asset from a customer's own URL.** [`02`](02-best-practice-research.md) settles it: a remote image puts someone else's uptime in the render path and is a tracking vector in email.
3. **Markup of any kind.** Consumers receive values. A brand that supplied HTML or CSS would be a second template engine beside comms and render.
4. **Which auth scope a host binds to at sign-in.** [`../../coreservices/authn/07-auth-scope-topology.md`](../../coreservices/authn/07-auth-scope-topology.md) §Auth scopes: one origin per pool, one per silo owns scopes, and a branded host is an alias of one.
5. **Whether contrast is checked.** The floor is a setting. Skipping the check is not, because the person who sees an unreadable screen is not the person who chose the colour.
