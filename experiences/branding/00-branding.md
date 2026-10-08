---
type: spec-stack
status: proposed
---
# Branding

## Purpose

Branding is a service that provides a tenant's visual identity and house formats to the surfaces that show them, such as:

1. An admin can put their firm's logo and colour on the app shell.
2. A render worker can stamp the tenant's disclaimer and logo onto a PDF.
3. Comms can send an email under the tenant's name, header and footer.
4. A visitor arriving at a tenant's own hostname can see that tenant's sign-in page before any session exists.
5. A report can print dates and numbers in the tenant's house format rather than the author's.
6. An operator can ask which brand a surface resolved, and why that one.

## Scope

Branding manages:

1. The brand declaration: display name, colour token overrides, disclaimer, sender name.
2. Brand assets: logo, wordmark, favicon and email header, one per colour scheme.
3. Bindings: which brand each surface shows, where a tenant keeps more than one.
4. Presentation defaults: timezone, date format, number and currency display for the tenant.
5. Branded hosts: a hostname a tenant owns, the DNS record that verifies it, and the tenant it resolves to.

A tenant's appearance has parts this stack does not carry:

| Part of how a tenant's app looks | Through this stack | What carries it otherwise |
|---|---|---|
| Logo, colour, favicon, disclaimer | yes | |
| Date, number and currency display defaults | yes | a person's own setting overrides the tenant default |
| Which navigation items and views appear | no | [`../workspaces/`](../workspaces/00-workspaces.md) |
| The token sheet the overrides are applied against | no | [`../design-system/`](../design-system/00-design-system-reference.md) |
| What a record type is called | no | nothing yet. Legacy's `entity_type_aliases` is declined in [`06`](06-legacy-functionality-map.md) |
| Whether a tenant has a capability at all | no | `@neuro/flags` and settings |

## Who calls it

| Caller | What it needs |
|---|---|
| **A signed-in surface** | The tenant is known. Give the brand and the formats for this surface |
| **An anonymous surface** | Nobody has signed in. Answer from the hostname alone, and disclose nothing a stranger should not learn |
| **A worker** | No browser and no session. Give the same answer a page would get, as plain values a template can use |

## How to use

```ts
const brand = await resolveBrand(deps, { tenant, surface: 'app', principal })
```

[`05-interface-and-configuration.md`](05-interface-and-configuration.md) defines the contract.

## Where it fits

| Concern | Owner |
|---|---|
| Which email domain routes a person to which identity provider | [`../../coreservices/authn/`](../../coreservices/authn/00-authn.md), [ADR-0014](../../coreservices/authn/ADR-0014-domain-routing-and-sso.md) |
| What the sign-in page does once it has the brand | [`../../coreservices/authn/07-auth-scope-topology.md`](../../coreservices/authn/07-auth-scope-topology.md) §Auth-surface topology: one surface, many apps |
| The certificate for a branded host, and the edge that routes it | [`../../operations/sites/`](../../operations/sites/00-sites.md) and [`devops/`](../../../devops/) |
| Turning a composition into a PDF | [`../../coreservices/render/`](../../coreservices/render/00-render.md) |
| Delivering the message a brand appears in | [`../../coreservices/messaging/channels/`](../../coreservices/messaging/channels/00-channels.md) |

## Pitfalls

1. **A tenant supplies token values, never a stylesheet.** The overridable tokens are a closed, named subset of `@neuro/ui`'s sheet. Everything else stays where the design system put it.
2. **A brand asset is not a document.** [`../../coreservices/documents/04-proposed-model.md`](../../coreservices/documents/04-proposed-model.md) grants a tenant-anchored document to `manage` alone, and a logo has to render for someone who has not signed in.
3. **Resolve, do not copy.** A consumer holding its own copy shows the old logo for as long as that copy lives, and a tenant that rebrands expects the change on every surface at once.
4. **A branded host says nothing about a caller.** It selects an appearance. Authority still comes from membership ([ADR-0013](../../coreservices/authn/ADR-0013-one-identity-many-tenants.md)).
5. **An anonymous resolution is a disclosure.** What a stranger learns from a hostname is bounded by [`03`](03-requirements-and-user-stories.md) B21, and it is less than the signed-in answer.

## Status

> **Status: proposed.** Nothing is built. Legacy's logo columns on the team row, its per-surface footer booleans and its per-person date format are the whole of what exists today, and no Neuro package owns any of it. This stack states the model so that `render/`, `comms/`, `authn/` and the app shell consume one declaration between them.

**Kind: data transformation.**

## The documents

| Doc | What it settles |
|---|---|
| [`01-legacy-pitfalls.md`](01-legacy-pitfalls.md) | How legacy branding works, and the constraint each defect imposes |
| [`02-best-practice-research.md`](02-best-practice-research.md) | Theming, contrast, untrusted assets and custom hostnames, as settled questions |
| [`03-requirements-and-user-stories.md`](03-requirements-and-user-stories.md) | The requirements `B1` to `B23`, their consumers, and the stories that cite them |
| [`04-proposed-model.md`](04-proposed-model.md) | The tables, their grain, resolution, and what this module must not do |
| [`05-interface-and-configuration.md`](05-interface-and-configuration.md) | `@neuro/branding` as a package a host composes: surface, ports and every option |
| [`06-legacy-functionality-map.md`](06-legacy-functionality-map.md) | Every legacy column, table and flag this stack subsumes, with a disposition |
