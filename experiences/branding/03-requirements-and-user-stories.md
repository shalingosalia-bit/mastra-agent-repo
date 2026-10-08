# Requirements and user stories

## The people

| Who | What they need from branding |
|---|---|
| **Priya** (admin) | Set the firm's logo, colour and disclaimer once, and see where each one appears |
| **Dana** (deal lead) | An export she sends to an investor looks like a document from her firm |
| **Sam** (analyst, restricted visibility) | Nothing reachable through a brand tells him about tenants he is not a member of |
| **Ops** | Answer why a surface showed the wrong brand, and take a hostname out of service |
| **The agent** | Produce a document under the tenant's identity without being told what that identity is |

## Functional requirements

A blank `Legacy today` cell is a capability legacy never had. [`06-legacy-functionality-map.md`](06-legacy-functionality-map.md) collects those in its closing section.

Each filled `Legacy today` cell names the legacy column, route or flag without repeating its citation. [`01-legacy-pitfalls.md`](01-legacy-pitfalls.md) holds the `file:line` evidence for every one of them, and states the branch it was read on and which claims are inference. An absence stated here as "neither exists" or "per person only" rests on a search of both schemas recorded in `01` §9 and §10.

### The brand and its assets

| # | Requirement | Legacy today | Consumers |
|---|---|---|---|
| B1 | An admin defines a named brand for the tenant: display name, disclaimer, and the sender name outbound messages go out under | `export_footers.name`, `.description`, `.disclaimer`, each capped at 150 characters | app shell, render, comms |
| B2 | An admin sets values for the overridable colour tokens, and for no other token | | app shell, render |
| B3 | A colour value failing the contrast floor is rejected when it is saved, with the measured ratio and the pairing that failed | | admin surface |
| B4 | An admin supplies one asset per role and colour scheme: logo, wordmark, favicon, email header, in light and dark | `whitelabel_logo_url`, one role and one form | app shell, render, comms, auth surface |
| B5 | Replacing an asset supersedes it, and the superseded asset stays retrievable for a declared window | The prior object is deleted on upload | admin surface, Ops |
| B6 | An asset is accepted only when its bytes match an accepted content type, pass the scan, and fall within the size and dimension bounds | `Core::Storage::ImageController.validate` | admin surface |
| B7 | An SVG is sanitized against an allow-list on upload, and the stored object is the sanitized form | | admin surface |
| B8 | A brand asset is served from a URL containing no tenant identifier and no sequence | `whitelabel-logo/<team_id>-<epoch>` at a public URL | every surface |

### Resolution

| # | Requirement | Legacy today | Consumers |
|---|---|---|---|
| B9 | A surface resolves to exactly one brand for a tenant | Each footer names the surfaces it applies to, so two can claim one surface | every surface |
| B10 | A tenant may bind different brands to different surfaces, and at most one binding is the default. A tenant with no brand has none | `export_views`, `export_dashboards`, `export_reports`, `export_tasks`, `export_comps` | app shell, render, comms |
| B11 | Resolution answers with the platform's own brand when the tenant has none | `whitelabel_logo_setting = 'default'` | every surface |
| B12 | Resolution reports which brand it chose and which binding produced it | | Ops, admin surface |
| B13 | Whether a tenant may show a brand is evaluated inside resolution, so withdrawing it takes effect on the next read | Checked where the setting is written and nowhere else ([`01`](01-legacy-pitfalls.md) §3) | every surface |
| B14 | Adding a surface to the product requires no change to the branding schema | A new printable surface is a new boolean column | Builders |
| B15 | A consumer receives resolved values, never markup and never CSS | Footer templates are ERB partials in the legacy repository | render, comms |

### Formats

| # | Requirement | Legacy today | Consumers |
|---|---|---|---|
| B16 | A tenant sets a default timezone, date format, number format and currency display | No tenant-level default exists | app shell, render, comms |
| B17 | A person's own setting overrides the tenant default, and a job with no person uses the tenant default | `user_settings.timezone` and `.date_format`, per person only | app shell, render |
| B18 | A stored format names a locale and its options, and is readable without the code that wrote it | `date_format` is an integer whose meaning lives in a constant | every surface |

### Branded hosts

| # | Requirement | Legacy today | Consumers |
|---|---|---|---|
| B19 | An admin claims a hostname, and the claim stays unusable until a DNS record showing control is observed | | admin surface, Ops |
| B20 | A hostname resolves to exactly one tenant, enforced by a unique index | | auth surface |
| B21 | An anonymous caller at a branded host learns the brand and nothing further: no tenant name the brand does not itself state, no membership, no count | | auth surface |
| B22 | A branded host is bound to an existing auth scope and never becomes one of its own | Sign-in is one host per environment | auth surface, Ops |
| B23 | Taking a host out of service returns its surfaces to the default origin, and the brand is unaffected | | Ops |

## Stories

**Priya.** *"Our logo and our green go on the app, and our disclaimer goes on every export."* → B1, B2, B3, B4, B9, B10

**Priya, on a bad upload.** *"The designer sent me a 40 MB TIFF, then an SVG I have not read."* → B6, B7

**Priya, an hour later.** *"I uploaded the wrong file over the right one."* → B5

**Priya, at renewal.** *"We stopped paying for branding and the logo is still on the sign-in page."* → B13

**Dana.** *"The PDF I send an investor should look like a document from this firm, with our dates and our disclaimer."* → B1, B4, B9, B16

**Sam.** *"Nothing I can reach should tell me which other firms use this product."* → B8, B21

**Ops.** *"A customer says their sign-in page shows the wrong logo, and I need the reason before I change anything."* → B12, B19, B20, B22

**Ops, on a host being retired.** *"Their vanity hostname has to come down today, and nobody should lose access."* → B23

**Ops, at offboarding.** *"This tenant has left, and their logo has to go with them."* → NFR4

**The agent.** *"I am producing a quarterly pack for this tenant and need its identity and its date format without asking anyone."* → B9, B11, B15, B16, B17

**A Builder.** *"I am adding a printable surface and will not migrate the branding tables to do it."* → B14, B15

**A Builder, on call.** *"I am reading a tenant's row at two in the morning and need its date format without hunting for the constant that decodes it."* → B18

## Non-functional

1. **NFR1.** Tenant and surface key the binding lookup, which is one indexed read. A consumer may reuse an answer for a window declared as an operator-tunable setting, and a brand change takes effect within that window everywhere. The reusable unit is keyed on the principal as well, because `formats` reflects that person's own settings (B17), and a cache keyed on tenant and surface alone would hand one person another's date format. `resolveForHost` is the separate anonymous path, keyed on the hostname, and it returns no person's settings.
2. **NFR2.** An asset is served with a long cache lifetime, and its URL changes when the asset changes, so no consumer needs to be told to discard an old copy.
3. **NFR3.** The superseded-asset window of B5 is a retention number declared once, per [`../../reference/modernization/23-shared-mechanisms.md`](../../reference/modernization/23-shared-mechanisms.md) §4.
4. **NFR4.** Brands, assets, bindings, hosts and the objects behind them are enumerable for a tenant, so an erasure request deletes all of them and reports what it deleted.
5. **NFR5.** The contrast floor of B3 is a published number, and the check that applies it names the standard it comes from.
