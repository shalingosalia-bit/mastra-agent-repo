# ADR-0005: MCP server authentication — delegate to the_wall's OAuth now; converge on Better-Auth (ADR-0003 end-state)

**Date:** 2026-07-14
**Status:** Superseded
**Scope:** neuro (MCP transport)
**Amends:** ADR-0003 — inserts an interim delegate-to-the_wall step for the MCP transport *ahead of* ADR-0003's Better-Auth end-state, which it reaffirms; ADR-0003 remains Accepted and continues to govern platform-wide AuthN (see Relationship to ADR-0003)
**Amended:** 2026-07-15 — the_wall is removing its MCP sub-service (`the_wall/mcp`), which deletes the OAuth authorization server Phase 1 delegated to; Phase 1 is revised to host the authorization server in dp-neuro. See the Amendment section at the end.

> **Superseded (2026-08-23):** The MCP transport this ADR governs was removed from dp-neuro in commit `18ea54dc` and now lives in the `dealpath/mcp` repository, which owns any subsequent decision about its authentication. ADR-0003 continues to govern platform AuthN. The record below is retained as written.

> **Amendment (2026-07-15):** the_wall is decommissioning its MCP sub-service (`the_wall/mcp`, branch `mcp-jaguar`), removing `oauth_routes.rb` — the OAuth 2.1 authorization server this ADR's Phase 1 delegated to — and MCP-6 (re-platforming that server onto the Ruby MCP SDK) is deprecated. Phase 1 is revised: dp-neuro now hosts the OAuth 2.1 authorization server itself (re-implemented in TypeScript in `apps/mcp`) and calls the_wall's Castle Black endpoints as an HTTP API for credential verification. the_wall keeps Castle Black authentication as an API with no sign-in UI. The Phase 2 Better-Auth end-state (per ADR-0003) is unchanged. Full detail — including the specific earlier passages this revises — is in the Amendment section at the end of this document.

## Context

The Neuro MCP server authenticates callers by verifying a the_wall API token: stdio reads `WALL_TOKEN` once at startup (`apps/mcp/src/auth.ts:74`); HTTP/Lambda verify a per-request `Authorization: Bearer` via `wallAuthInfoForToken` (`apps/mcp/src/auth.ts:44`, `http.ts:27`, `lambda.ts:47`). There is no interactive sign-in — the token is obtained out-of-band and pasted into client config. That blocks a real MCP sign-in for agents/clients and is the credential shape most likely to leak (`docs/reference/legacy_assessments/legacy-authn-assessment.md`). The task that forced this decision: give the MCP a way to log in via SSO (with or without SAML).

ADR-0003 already committed, **platform-wide**, to the *architecture* — Neuro owns AuthN behind the `@neuro/authn` `Authenticator` seam, resolving any credential to a normalized `AuthResult` (principal + optional `wall` credential), with "every consumer — MCP tools, Server Actions, workers" depending only on that seam — and chose **Better-Auth** as the modern implementation. The MCP is named there as the most urgent use case, not the scope. What ADR-0003 left open was not *which provider* — that's settled — but *how and when the MCP transport specifically gets there*: Better-Auth wasn't built yet, and nothing said what the MCP should do in the meantime or how it plugs into a resource-server topology (discovery, stdio reachability, token validation). This ADR decides that path: it keeps ADR-0003's Better-Auth end-state unchanged and inserts a DB-free interim step (delegate to the_wall's live OAuth server) for the MCP transport ahead of the Better-Auth cutover. The rest of Neuro AuthN remains under ADR-0003.

Two axes were separated during evaluation:

- **Authorization server (who runs the OAuth/SSO sign-in):** the_wall/Castle Black, WorkOS AuthKit, Better-Auth, Clerk. This is the axis this ADR decides.
- **Enforcement topology (where the token is validated):** MCP as a stateless resource server, an API gateway, an in-process authorization server, or a reverse-proxy sidecar. Both Phase 1 and Phase 2 land on the same topology — MCP-as-resource-server — because Mastra's `oauth-middleware` already provides it DB-free (see below); an API gateway or reverse-proxy sidecar would add throttling/WAF/custom-domain but is an orthogonal infra layer that can sit in front of either phase's resource server without changing this decision, so it is not evaluated as an alternative here.

Facts established during evaluation that shape the decision:

- **OAuth/SSO is HTTP-transport only.** The MCP spec states stdio `SHOULD NOT` use OAuth and `SHOULD` read credentials from the environment; only HTTP transports do the OAuth flow. So SSO lands on `http.ts`/`lambda.ts`; stdio reaches it via `mcp-remote` (a proxy to the HTTP server) or a one-time token-minting login helper. This is provider-independent.
- **the_wall already runs a complete, spec-shaped OAuth 2.1 authorization server, and it is live in production.** `the_wall/mcp/lib/http/routes/oauth_routes.rb` (merged to `master`/`major`/`rc`) implements discovery (RFC 9728/8414), dynamic client registration (RFC 7591), PKCE S256, the two-step domain→SAML/password sign-in, the SAML callback, and the token endpoint, mounted on the same origin as `/mcp`. `GET https://mcp.dealpath.com/.well-known/oauth-authorization-server` returns `200` with valid metadata (verified 2026-07-14). Castle Black — which runs the SSO/SAML dance — is deployed in every tier and has explicit MCP relay support. The token it issues is the opaque 14-day `ApiUserToken`, which dp-neuro already verifies.
- **Mastra's MCPServer has the resource-server plumbing built in.** `@mastra/mcp@1.13.1` ships `oauth-middleware` (RFC 9728: serves protected-resource metadata, validates bearer tokens, returns 401 + `WWW-Authenticate`) and, on the client side, `MCPOAuthClientProvider` (DCR/PKCE/refresh, in-memory storage). Neither needs a database.
- **Better-Auth as an authorization server requires a relational database.** Its OAuth-provider/SSO/SCIM plugins store clients, tokens, consent, users, signing keys, and per-tenant IdP configs in Postgres (Redis is secondary-storage only; SQLite has no workable path on serverless). Hosting Better-Auth's AS *on* the MCP Lambda would end its DB-free property and make it a credential store — so the Better-Auth end-state (Phase 2) runs it as the **platform** AS (per ADR-0003, "in Neuro's own runtime against Neuro's database") with the MCP remaining a resource server that validates its tokens; the MCP surface itself stays DB-free in both phases. Better-Auth's SSO rides `samlify` (two now-closed advisories, incl. CVE-2025-47949, CVSS 9.9), so self-operating SAML is a patch treadmill Neuro accepts as the ADR-0003 lifecycle-ownership trade-off. Better-Auth was acquired by Vercel (2026-07-07) and its dedicated `mcp()` plugin is deprecating into a newer `oauth-provider` plugin — a moving surface to track before the cutover.
- **Every non-the_wall provider needs a `wallTokenBroker`.** WorkOS/Clerk/Better-Auth authenticate the user but issue their own token; the tools still call the_wall, so a `wallTokenBroker(principal) → WallCredential` translation shim must be built (`docs/reference/modernization/authn-strategy.md`). Only delegating to the_wall's own AS avoids it (the token *is* a the_wall token already, so nothing needs translating).
- **braavos is not a candidate.** It authenticates at team scope, not per-user, so it cannot front a per-user MCP sign-in.

### Terminology: bridge vs. broker

Two distinct mechanisms are both loosely called "bridge" in prior discussion; this ADR uses them precisely and by these names throughout.

| | **The bridge** — `wallTokenAuthenticator` | **The broker** — `wallTokenBroker` |
|---|---|---|
| Direction | the_wall token → normalized principal | normalized principal → the_wall token |
| What it does | Verifies an *existing* the_wall API token (`verifyWallToken`) and normalizes it into `AuthResult` | Mints or looks up a the_wall credential for a principal that was **not** authenticated by the_wall |
| Status | Already built and running (ADR-0003's "Bridge, don't cut over" — the strangler adapter that keeps legacy the_wall tokens working) | Not yet built — the open design question `docs/reference/modernization/authn-strategy.md` names but doesn't resolve |
| Needed by | Any caller presenting a the_wall token | Any principal authenticated by a **non**-the_wall system (WorkOS, Clerk, Better-Auth) |
| Role in this ADR | Reused unchanged in Phase 1 (delegating to the_wall's AS produces a the_wall token, so the existing bridge verifies it as-is) | Required starting at the Phase 2 cutover, once the authenticating principal is a Better-Auth identity instead of a the_wall token holder |

In short: the bridge is inherited infrastructure this ADR keeps; the broker is new infrastructure Phase 2 must build. They are near-inverses of each other, not variations on the same thing — confusing them makes "avoid the broker" (a Phase 1 cost-avoidance) read as "avoid the bridge" (which would contradict the strangler pattern this whole migration follows).

## Decision Drivers

| # | Driver | Priority | Why it matters |
|---|--------|----------|----------------|
| 1 | SSO with or without SAML | Must-have | The task; enterprise teams need SAML, others password/OIDC |
| 2 | OAuth 2.1 for MCP clients (DCR, PKCE, discovery) | Must-have | A real consent flow replaces a leak-prone pasted key; it is the MCP-client standard |
| 3 | Managed vs. self-operated SAML/SCIM security burden | Strong-want | Self-operated SAML is a CVE patch treadmill and a credential store to secure under SOC 2 |
| 4 | Avoid building the `wallTokenBroker` before it's needed | Strong-want | The broker (see Terminology above) is the single largest bespoke piece; deferring it ships sooner. Not to be confused with the bridge (`wallTokenAuthenticator`), which this ADR keeps and relies on, not avoids. |
| 5 | Transport/topology fit — stdio reachability + DB-free MCP Lambda | Strong-want | The MCP surface is deliberately DB-free and serverless; a DB or store changes the deploy contract |
| 6 | Reversible behind the `Authenticator` seam | Strong-want | Auth needs (SSO, SCIM, org model) are still forming; the choice must be swappable |
| 7 | Neuro owns the session lifecycle | Want | Short-lived + rotating tokens and central revocation are security controls Neuro should set |
| 8 | Operational simplicity / serverless-friendly | Want | The platform targets serverless; an always-on or stateful component is a cost and failure surface |
| 9 | Maturity / TCO | Want | A foundational auth dependency should be battle-tested and cost-predictable |

## Decision

### Why not implement ADR-0003 (Better-Auth) directly, right now?

ADR-0003's own Implementation section says plainly: "Not yet built." For the MCP specifically, going straight to Better-Auth is blocked by more than remaining engineering hours — several pieces don't exist yet and can't be assembled quickly:

1. **No running Better-Auth instance exists anywhere in the platform.** `packages/shared/authn/src/authn.ts` implements only WorkOS and Clerk; there is no Better-Auth code, schema, or deployment today. Standing it up means new Postgres migrations (clients, tokens, consent, users, sessions, and — once SSO is enabled — per-tenant IdP configs and JWKS signing keys) and a decision on which platform surface hosts it (left open to the Phase 2 cutover, see below).
2. **The `wallTokenBroker` is undesigned, and most of its viable designs require per-user identity linking between the_wall and Better-Auth** — this is the "user migration" cost: none of the three options `docs/reference/modernization/authn-strategy.md` names is a config flag.
   - *A principal→the_wall-token mapping table* requires establishing, for every user who authenticates via Better-Auth, which existing the_wall account they correspond to — real account-linking work, whether run as a batch pass or done lazily on first login.
   - *A the_wall-issued federated token* requires Castle Black to gain a new capability — minting a the_wall token from a verified external identity — that, from what's been read of its routes, does not exist today; that work sits outside dp-neuro's control.
   - *A scoped service token with an audited acting-user* avoids per-user linking but shifts trust onto a shared credential and needs its own audit-trail design.
3. **Per-tenant SAML/OIDC configuration would need to be recreated.** Every enterprise customer's SSO connection is configured in Castle Black today; Better-Auth's `sso()` plugin needs its own `registerSSOProvider` call per tenant (domain, issuer, certs) — existing configs don't carry over, so this is effectively a second onboarding per SSO customer.
4. **The library surface is moving.** Better-Auth's dedicated `mcp()` plugin is deprecating into `oauth-provider`, and Better-Auth was acquired by Vercel five days before ADR-0003 was written (2026-07-07) — building against the plugin already being phased out is poor timing.

Put together: going straight to Better-Auth for the MCP today would mean building an authorization server, designing and building an identity-linking/broker mechanism, and re-onboarding every enterprise SSO customer — all before a single user could sign in. Phase 1 exists because the_wall's OAuth server already solves the sign-in problem today with none of that new work, while Phase 2 is designed and built properly.

### The chosen path

**Adopt a phased approach behind the existing `@neuro/authn` `Authenticator` seam (ADR-0003's seam is retained): Phase 1 reuses the existing `wallTokenAuthenticator` adapter behind a new OAuth resource-server transport layer; Phase 2 introduces a new Better-Auth `Authenticator` adapter and retires the interim.**

**Phase 1 — now: the MCP server is an OAuth 2.1 resource server that delegates authorization to the_wall's live production OAuth server.**

- dp-neuro's HTTP MCP transport serves `/.well-known/oauth-protected-resource` (via Mastra's `oauth-middleware`) advertising `https://mcp.dealpath.com` as the authorization server, and returns `401` + `WWW-Authenticate` when unauthenticated.
- MCP clients run the OAuth 2.1 flow (DCR + PKCE) against the_wall's AS, sign in through Castle Black (SSO/SAML or password), and receive a the_wall `ApiUserToken`.
- dp-neuro validates that token with the existing `verifyWallToken` / `wallAuthInfoForToken` path — no new authorization server, no database on the MCP surface, and no `wallTokenBroker` (the token is already a the_wall token). This is the front-door counterpart to the `wallTokenAuthenticator` adapter dp-neuro already runs.
- stdio clients reach this over HTTP via `mcp-remote` (or a one-time SSO login helper that writes the env credential); `stdio.ts`'s env-credential model is unchanged, per the MCP spec.

**Phase 2 — the end-state: converge on Better-Auth, per ADR-0003.** When credential modernization (audience-bound short-lived tokens, per-agent scoping, Neuro-owned session lifecycle) becomes the priority, the MCP repoints its resource-server discovery from the_wall's AS to the **Neuro-owned Better-Auth AS** (run platform-side per ADR-0003) and the interim delegate is retired. Because the token is then a Better-Auth credential rather than a the_wall token, this phase also builds the `wallTokenBroker` so the tools still reach the_wall. The MCP stays a resource server; tools, workers, and authorization do not change — it is a seam-adapter swap. The provider is not reopened here: it is ADR-0003's Better-Auth.

Open questions to resolve for the Phase 2 Better-Auth cutover (not provider selection — that is settled):

- **The `wallTokenBroker` design** — the pivotal build: choose among a the_wall-issued federated token, a principal→token mapping, or an audited scoped service token (`docs/reference/modernization/authn-strategy.md`).
- **Audience-bound (RFC 8707) tokens** — issue Better-Auth JWTs bound to the dp-neuro MCP resource, which closes the Phase-1 confused-deputy gap; confirm the MCP resource server validates audience.
- **Where the Better-Auth AS runs** — the platform surface hosting it (e.g. `apps/api`) and its Postgres, per ADR-0003; the MCP only needs the issuer/JWKS URL.
- **Better-Auth MCP-surface trajectory** — its `mcp()` plugin is deprecating into `oauth-provider`; adopt the successor and re-verify stability post-Vercel before the cutover.
- **SAML operation** — the samlify patch cadence and per-tenant IdP config lifecycle Neuro takes on (the ADR-0003 self-hosted trade-off).

### Lifecycle

Phase 1 (delegate to the_wall) is explicitly **interim**. It is retired when the Phase 2 Better-Auth cutover lands — at which point a follow-up ADR documenting that cutover **supersedes this ADR-0005**. Because Phase 2 converges on ADR-0003's already-chosen provider (Better-Auth), it implements ADR-0003 rather than superseding it; ADR-0003 stays the platform-wide authority throughout.

## Relationship to ADR-0003

ADR-0003 is a **platform-wide** AuthN decision (its own text: "every consumer — MCP tools, Server Actions, workers — depends only on that seam"), with the MCP named as its most urgent use case, not its scope. This ADR does **not** supersede it. It **amends ADR-0003 for the MCP transport only**; ADR-0003 remains Accepted and continues to govern AuthN for the tenant app, Server Actions, RSC, and workers. It keeps ADR-0003's core — the `Authenticator` seam and the principle that the provider is a swappable implementation detail — and narrows two things for the MCP:

- ADR-0003 chose **Better-Auth** as the bridging-phase implementation for all consumers, including the MCP's OAuth surface. For **Phase 1 only**, this ADR delegates the MCP's sign-in to **the_wall's already-deployed OAuth server** instead — an option ADR-0003 did not consider — to avoid standing up a database-backed authorization server and a `wallTokenBroker` before either is needed, and to reuse a live, prod-grade SSO/SAML backend immediately. This is a sequencing choice, not a permanent one: at the Phase 2 cutover the MCP moves onto Better-Auth like every other consumer, so ADR-0003's Better-Auth choice is unchanged for the MCP's end-state and stands unmodified for the non-MCP surfaces throughout.
- ADR-0005 does **not** reopen or change ADR-0003's provider choice. Phase 2 converges on ADR-0003's Better-Auth as the MCP's end-state; ADR-0005 only sequences the path there by inserting the interim the_wall-delegate step first. The deep evaluation's cautions about Better-Auth (self-operated SAML burden, its DB requirement, MCP-plugin churn) are recorded here as risks to manage at cutover, not as grounds to change the provider.

ADR-0003's status is unchanged (remains Accepted). This ADR neither supersedes it nor requires any status change to it; the Better-Auth end-state it names is ADR-0003's.

## Alternatives Considered

### Comparison matrix

Legend: ✅ satisfies · ⚠️ partial/with tradeoff · ❌ does not · n/a

| Driver | Delegate to the_wall (Phase 1, chosen) | WorkOS AuthKit | Better-Auth | Port the_wall OAuth to TS | Status quo (pasted token) |
|---|---|---|---|---|---|
| 1. SSO with/without SAML | ✅ (Castle Black) | ✅ | ✅¹ | ✅ | ❌ |
| 2. OAuth 2.1 for MCP clients | ✅ | ✅ | ⚠️² | ✅ | ❌ |
| 3. Managed SAML/SCIM burden | ✅³ | ✅ | ❌ | ❌ | n/a |
| 4. No `wallTokenBroker` needed yet | ✅ | ❌ | ❌ | ✅ | ✅ |
| 5. Topology — stdio + DB-free Lambda | ✅ | ✅ | ⚠️⁴ | ⚠️⁵ | ✅ |
| 6. Reversible behind the seam | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| 7. Neuro-owned session lifecycle | ❌⁶ | ⚠️ | ✅ | ❌⁶ | ❌⁶ |
| 8. Operational simplicity / serverless | ✅ | ✅ | ⚠️ | ❌ | ✅ |
| 9. Maturity / TCO | ✅⁷ | ✅ | ⚠️ | ⚠️ | ✅ |

¹ SAML works but the plugin is young. ² `mcp()` plugin deprecating; provisional DCR knob. ³ SAML is operated by the_wall/Castle Black, not Neuro. ⁴ Requires Postgres; in the chosen end-state it runs platform-side (per ADR-0003) with the MCP a resource server, so the MCP surface stays DB-free. ⁵ Promotes Redis to a hard correctness dependency. ⁶ Inherits the opaque 14-day `ApiUserToken`. ⁷ Reuses a deployed, in-use production server.

### Delegate to the_wall's OAuth AS (Phase 1, chosen)

Satisfies drivers 1–6, 8, 9 at the lowest cost of any option: no new authorization server, no database on the MCP surface, no `wallTokenBroker`, and it reuses a live prod SSO/SAML backend. It fails driver 7 (the credential is the_wall's opaque 14-day token) — accepted as an interim, and the reason Phase 2 exists.

### Better-Auth (the Phase 2 end-state, per ADR-0003)

MIT, self-hosted, Neuro-owned session lifecycle, strong OAuth-2.1/MCP fit, now Vercel-backed. This is ADR-0003's chosen provider and the MCP's Phase 2 end-state — run platform-side as the authorization server, with the MCP a resource server validating its audience-bound JWTs (so the MCP surface stays DB-free and the Phase-1 confused-deputy gap closes). Its costs are accepted as the ADR-0003 lifecycle-ownership trade-off and tracked as Phase-2 open questions: self-operated SAML on `samlify` (patch cadence), the per-tenant IdP config lifecycle, and the deprecating `mcp()` plugin (adopt `oauth-provider`).

### WorkOS AuthKit (not selected; seam-swappable future option)

Strongest managed option: first-class MCP support, managed SAML + SCIM behind a self-service portal, audience-bound JWTs, free at Neuro's user scale — but it is a managed-vendor commitment and still needs the `wallTokenBroker`. Not selected: ADR-0003 chose Better-Auth for Neuro-owned lifecycle and no vendor lock-in, and this ADR does not reopen that. WorkOS remains the documented future option the `Authenticator` seam preserves (per ADR-0003) if that trade-off is ever revisited platform-wide.

### Port the_wall's OAuth flow to TypeScript (rejected)

Issues a the_wall token directly (no `wallTokenBroker` needed) and is strangler-consistent, but it means owning a bespoke OAuth authorization server (~350–400 lines of security-critical logic: redirect-URI matching, PKCE, SAML relay-state), promotes Redis to a hard dependency, and still issues the opaque 14-day token. Rejected because delegating to the_wall's *already-deployed* AS delivers the same credential and SSO with none of the code-ownership or security surface.

### Status quo — pasted the_wall token (rejected)

The baseline: works today, DB-free, zero added cost. Rejected because it provides no interactive sign-in, keeps the leak-prone pasted-key credential, and never lets the OAuth transport populate the write-scope gate (`assertWriteScope` / `mcp_write`). Defensible only as the interim until Phase 1 ships.

## Consequences

### Positive

- Real OAuth 2.1 SSO sign-in (with or without SAML) for the MCP, reusing a live production authorization server and a prod-grade SSO/SAML backend — no new AS to build, deploy, or secure.
- The MCP surface stays database-free and serverless; Mastra's built-in resource-server middleware plus the existing `verifyWallToken` do the work.
- No `wallTokenBroker` in Phase 1 — the largest bespoke piece is deferred to the Phase 2 Better-Auth cutover, where it is designed once.
- The write-scope gate (`mcp_write`) and per-tenant scoping switch on end-to-end, since the OAuth transport now populates feature-access on the request context (the step ADR-0003 named).
- Phase 2 is a seam-adapter swap to ADR-0003's Better-Auth, so the interim can be retired without touching tools, workers, or authorization, and without reopening the provider decision.

### Negative

- Phase 1 inherits the_wall's opaque, non-audience-bound 14-day `ApiUserToken`: no refresh, no per-agent scoping, and a **confused-deputy exposure** — a token obtained "for the MCP" is a general Dealpath API bearer valid against the whole Wall API. Accepted as an interim; Phase 2 is the remediation.
- dp-neuro's MCP auth now has a **runtime dependency on the_wall's MCP AS** (`mcp.dealpath.com`) and Castle Black being up, and a **cross-team coupling** to their lifecycle. The AS pod is minted by an out-of-repo Jenkins job, so its deployment is not visible in the devops repo — an operational-visibility gap to close.
- Two authentication paths coexist (pasted token during transition, delegated OAuth after), each needing tests and clear routing — the strangler cost ADR-0003 already named.
- The modern-credential benefits (short-lived audience-bound tokens, per-agent scoping) are not realized until the Phase 2 Better-Auth cutover; Phase 1 is deliberately a lower-ceiling interim.
- The Phase 2 end-state (Better-Auth) carries ADR-0003's accepted self-hosted costs — Neuro operates the SAML surface (samlify patch cadence) and the per-tenant IdP config lifecycle, rather than offloading them to a managed provider.
- **Two Strong-want drivers are not satisfied even at the end-state, by design.** Driver 3 (managed SAML/SCIM burden) and driver 4 (avoid the `wallTokenBroker`) both score ❌ for Better-Auth in the matrix above — Phase 1 satisfies them only temporarily; Phase 2 requires building the broker and self-operating SAML. This is an inherited trade-off, not an oversight: ADR-0003 already accepted self-hosted SAML and the eventual need for a broker, in exchange for no vendor lock-in and Neuro-owned session lifecycle (driver 7). ADR-0005 does not reconsider that trade-off; it is named here so it isn't mistaken for something Phase 2 fixes.

### Risks

- **the_wall AS availability/versioning.** dp-neuro's sign-in breaks if `mcp.dealpath.com` is down or its OAuth contract changes. Mitigate with monitoring of the discovery endpoint, an owned understanding of its deploy pipeline, and coordination with the the_wall team on contract changes.
- **Confused-deputy / audience.** Because the token is not resource-bound to dp-neuro's MCP, a leaked token has Wall-wide scope. Mitigate by treating Phase 2 (audience-bound tokens) as time-boxed, and by keeping the write-scope gate enforced per tool.
- **Cutover-delay drift.** The provider is decided (Better-Auth, per ADR-0003); what remains is the Phase 2 engineering (broker, audience-bound tokens, AS hosting, plugin migration) and it can stall or be deprioritized once Phase 1 ships and the interim "works well enough." Mitigate by filing the Phase 2 cutover as a tracked issue with the open questions above as its acceptance criteria and an owner, not left implicit.

## Implementation

Phase 1:

- MCP transport: enable Mastra's `oauth-middleware` on `http.ts`/`lambda.ts` — serve `/.well-known/oauth-protected-resource` advertising `https://mcp.dealpath.com`, return 401 + `WWW-Authenticate`, and validate the bearer via the existing `wallAuthInfoForToken` as the token validator; keep `wallTokenAuthenticator` as the registered adapter.
- Confirm `mapAuthInfoToUser` / `wallRequestContext` puts the verified `wall` credential (token, team/user ids, `featureAccess`) on the request context so `assertWriteScope` reads `mcp_write` end-to-end.
- stdio: document `mcp-remote` (or a one-time SSO login helper) as the way stdio clients reach the HTTP SSO flow; leave `initStdioAuth` env-credential path intact.
- Coordinate with the the_wall/devops teams: confirm the AS deploy pipeline, add discovery-endpoint monitoring, and record the runtime dependency.

Phase 2 — Better-Auth cutover (follow-up ADR; MCP-side work only — standing up the platform Better-Auth AS itself is ADR-0003's implementation track, not this ADR's):

- **Depends on:** the Neuro-owned Better-Auth AS running platform-side (per ADR-0003), configured to issue audience-bound JWTs for the dp-neuro MCP resource, on the `oauth-provider` plugin (not the deprecating `mcp()`).
- **MCP-side:** build the `wallTokenBroker` (Better-Auth principal → the_wall credential) so the tools still reach the_wall; add its `Authenticator` adapter.
- **MCP-side:** repoint the MCP resource server's discovery from `https://mcp.dealpath.com` to the Better-Auth issuer/JWKS; retire the interim delegate. The MCP stays a resource server — no DB on the MCP surface.

## Amendment (2026-07-15): the_wall MCP authorization server is being removed

On 2026-07-15 the_wall began removing its entire MCP sub-service (`the_wall/mcp`) on branch `mcp-jaguar` (commit "remove the_wall/mcp and references"), and MCP-6 (re-platforming that server onto the Ruby MCP SDK) was deprecated. The removed code includes `the_wall/mcp/lib/http/routes/oauth_routes.rb`, the OAuth 2.1 authorization server this ADR's Phase 1 delegates to. the_wall will retain Castle Black authentication as an HTTP API with no sign-in UI. This amendment revises Phase 1's mechanism to match. The Phase 2 Better-Auth end-state (per ADR-0003) is unchanged.

### Revised Phase 1 decision

- **Before:** dp-neuro is a resource server that delegates the OAuth/SSO sign-in to the_wall's already-deployed authorization server at `mcp.dealpath.com`.
- **After:** dp-neuro's MCP HTTP transport hosts the OAuth 2.1 authorization server itself — re-implemented in TypeScript in `apps/mcp` — and calls the_wall's Castle Black endpoints (`/account/verify_domain`, `/account/login`, `/saml/sso/{domain}` plus the SAML ACS relay) as an HTTP API to verify credentials. The resource-server layer already shipped for MCP-25 (`apps/mcp/src/oauth.ts`) stays; the authorization server is added in the same dp-neuro origin. Because the authorization server and the resource server are now the same origin, the discovery document's `authorization_servers` points at dp-neuro itself, and dp-neuro must also serve the RFC 8414 document at `/.well-known/oauth-authorization-server` (MCP-25 served only the RFC 9728 protected-resource document).
- This is the option previously recorded as "Port the_wall's OAuth flow to TypeScript" and rejected (see Alternatives Considered). The rejection is reversed because its premise — that a live, deployed the_wall authorization server exists to delegate to instead — is being removed. Its recorded costs (owning security-critical authorization-server logic, promoting Redis to a hard dependency, and still issuing the opaque 14-day token) are now accepted, because the lower-cost delegate option no longer exists.
- **What does not change:** the credential a caller ends up with is still the_wall's opaque 14-day `ApiUserToken`, minted by Castle Black (`ApiUserToken.generate` in `castle_black/lib/http/routes/saml_routes.rb`); dp-neuro verifies it with the existing `wallAuthInfoForToken` bridge (`apps/mcp/src/auth.ts:44`); and no `wallTokenBroker` is needed in Phase 1 (the token is already a the_wall token). "No new authorization server" and "no database on the MCP surface" no longer hold — dp-neuro now owns the authorization server and adds Redis.

### What moves, what stays

| Tier | Responsibility | Where it lives after this change |
|---|---|---|
| 1. Identity provider + credential verification | Castle Black: `/account/verify_domain`, `/account/login`, `/saml/sso/{domain}`, the SAML ACS + relay handoff (`castle_black/lib/http/routes/saml_routes.rb`) | Stays in the_wall, exposed as an HTTP API (no UI) |
| 2. OAuth 2.1 authorization server + sign-in UI | Dynamic client registration, PKCE, the two-step domain→SSO/password flow, the SAML callback, the token endpoint, and the rendered sign-in pages (was `the_wall/mcp/lib/http/routes/oauth_routes.rb`) | Moves to dp-neuro (`apps/mcp`, TypeScript) |
| 3. Resource server (RFC 9728) | Discovery, `401 + WWW-Authenticate`, bearer-token verification | Already in dp-neuro (`apps/mcp/src/oauth.ts`, shipped for MCP-25) |

The constraint that shapes the whole change: Tier 1 cannot move. SAML SSO, the domain→SSO lookup, and email/password verification are Castle Black's responsibility and stay in the_wall. "Move the authorization server to dp-neuro" therefore means porting Tier 2's orchestration and UI and having it call Tier 1 as an HTTP API — a TypeScript re-implementation, not a code copy.

### Component port map

| Capability (in `oauth_routes.rb`) | dp-neuro home | Notes |
|---|---|---|
| `POST /oauth/register` (RFC 7591 dynamic client registration) | new authorization-server route | store client record in Redis |
| `GET`/`POST /oauth/authorize` (domain form → email/password form → SSO button) | new route + HTML templates | the rendered forms, CSS, logo, and font become dp-neuro assets |
| `GET /oauth/saml_callback` (cookie + `token_key` handoff, correlation nonce, shard capture) | new route | depends on the Castle Black relay repoint below |
| `GET /oauth/callback` (JS-redirect to the client's loopback `redirect_uri`) | new route | direct port |
| `POST /oauth/token` (PKCE S256 verify, code → token) | new route | direct port |
| `/.well-known/oauth-authorization-server` (RFC 8414) | new route | new — MCP-25 served only the RFC 9728 protected-resource document |
| `/.well-known/oauth-protected-resource` (RFC 9728) | `apps/mcp/src/oauth.ts` | already shipped (MCP-25) |
| `CastleBlackClient#verify_domain` / `#login` (+ the `SSO_REQUIRED` fallback) | new Castle Black HTTP client in dp-neuro | Faraday → fetch |
| `AuthConnector.verify_api_token` (login-time `:mcp` feature-flag + full-member gate) | existing `wallAuthInfoForToken` (`apps/mcp/src/auth.ts:44`) | reuse |
| Redis namespaces `clients` / `codes` / `states` | dp-neuro Redis | new dependency |

### New dependencies this adds to dp-neuro's MCP surface

- **Redis.** The authorization server is stateful: dynamic-client-registration records (roughly 7-day TTL), authorization codes (roughly 10-minute TTL), and SAML correlation nonces. `apps/mcp` has no Redis today (MCP-25 is stateless), so this promotes Redis to a hard correctness dependency for the MCP HTTP transport. This is the cost recorded in the comparison matrix's footnote 5, now incurred.
- **HTTP routing, form-body parsing, and cookie handling.** `apps/mcp/src/http.ts` runs raw `node:http` (`createServer`) with no router; the authorization server needs roughly 8 routes, form POSTs, `Set-Cookie` clearing on the SAML callback, and an HTML JS-redirect page.
- **Static sign-in UI assets.** The domain form, the email/password form, the "Sign in with SSO" button, the page shell and CSS, the Dealpath logo, and the Geist font move to dp-neuro as served assets. This is the "the_wall keeps auth as an API, no UI" split made concrete: the sign-in UI is now dp-neuro's to serve and maintain.
- **A Castle Black HTTP client in dp-neuro.** A port of the deleted `Mcp::CastleBlackClient` (`verify_domain`, `login`, and the `SSO_REQUIRED` fallback that redirects a password attempt into the SAML flow).

### SAML relay coupling and the `mcp_url` repoint (the_wall-side work)

- The SAML sign-in is a three-party handshake that binds the authorization server's callback location into Castle Black. dp-neuro would redirect the browser to `CASTLE_BLACK_PUBLIC_URL/saml/sso/{domain}?RelayState=<dp-neuro-host>/oauth/saml_callback`; Castle Black allowlists that `RelayState` against `Dealpath::SETTINGS[:mcp_url]` and requires the path `/oauth/saml_callback` (`castle_black/lib/http/routes/saml_routes.rb:139-155`), then hands the token back through a short-lived `httpOnly` cookie keyed by an opaque `token_key`, carrying `{token, shard_url}`.
- Consequence: the_wall's `mcp_url` setting (`config/production.yml:7` and the equivalent per-tier configs) must be repointed from the removed the_wall MCP host to dp-neuro's MCP host, and dp-neuro must serve `/oauth/saml_callback` at exactly that host and path and parse the cookie payload (a port of `parse_saml_relay_cookie`, including the shard capture from MCP-15/AIX-70). The Castle Black relay code and endpoints stay in the_wall — they are the API the_wall retains.

### Sequencing constraint

- `mcp-jaguar` must not merge to develop until (a) dp-neuro's authorization server is deployed and verified and (b) `mcp_url` and the Castle Black relay allowlist are repointed at dp-neuro. Merging the removal first would leave a window with no authorization server at all, and every MCP sign-in would fail. The revised Phase 1 therefore blocks the the_wall MCP removal; the two land in coordination — dp-neuro authorization server live and verified, then repoint `mcp_url`, then merge `mcp-jaguar`.

### Passages this amendment revises

- **Context, third established-fact bullet** ("the_wall already runs a complete, spec-shaped OAuth 2.1 authorization server, and it is live in production"): accurate when written; that server is being decommissioned, so Phase 1 no longer delegates to it and instead re-implements it in dp-neuro.
- **Decision → "Phase 1 — now":** dp-neuro is now the authorization server, not only a resource server. The `wallAuthInfoForToken` verification, the no-Postgres property of the MCP surface, and "no `wallTokenBroker`" still hold; "no new authorization server" and "no database on the MCP surface" do not — dp-neuro owns the authorization server and adds Redis.
- **Alternatives Considered → "Port the_wall's OAuth flow to TypeScript (rejected)":** reclassified as the chosen Phase 1 mechanism; its listed costs are now accepted rather than avoided.
- **Comparison matrix:** the "Delegate to the_wall (Phase 1, chosen)" column is no longer available as written; the operative column is now "Port the_wall OAuth to TS". Driver 5 (topology — DB-free Lambda) moves from ✅ to ⚠️ as Redis becomes a hard dependency (matrix footnote 5); drivers 1, 2, and 4 (SSO, OAuth 2.1 for clients, no broker yet) stay satisfied.
- **Consequences and Risks:** the runtime dependency "on the_wall's MCP authorization server being up" becomes a dependency on Castle Black's verify/login/SAML endpoints and the SAML relay; add the Redis dependency and the `mcp_url` / relay-allowlist repoint as new operational items.

### Phase 2 is unchanged

- The end-state remains ADR-0003's Better-Auth, run platform-side, with the MCP a resource server validating audience-bound JWTs. Hosting the authorization server in dp-neuro changes the shape of the Phase 2 cutover from repointing discovery to an external issuer to swapping the authorization-server implementation within the same service (the_wall-delegating → Better-Auth) and retiring the Castle Black client. The confused-deputy / audience gap is unchanged in Phase 1: the credential is still the opaque, non-audience-bound 14-day the_wall token.

### Tracking

- No tracker issue covers the authorization-server port yet — MCP-25 built only the resource server and scoped the authorization server to the_wall. File one on the MCP team, blocking `mcp-jaguar`, with the component port map above as its scope. Rough size 5–8 points, dominated by the Redis, HTTP-routing, and static-asset plumbing and the SAML-relay repoint rather than the OAuth logic itself. Update MCP-25's out-of-scope note, which currently records the authorization server as staying in the_wall.

## References

- `docs/reference/modernization/authn-strategy.md` — the `Authenticator` / `AuthResult` / principal seam.
- `docs/reference/legacy_assessments/legacy-authn-assessment.md` — the_wall's AuthN, the MCP OAuth 2.1 flow, and the token weaknesses compared here.
- `ADR-0002` — the unified principal authorization this feeds.
- `ADR-0003` — the platform-wide AuthN adapter/seam this retains; its Better-Auth choice this reaffirms as the MCP's Phase 2 end-state (not reopened).
- `the_wall/mcp/lib/http/routes/oauth_routes.rb` — the deployed OAuth authorization server delegated to.
- `apps/mcp/src/auth.ts`, `http.ts`, `lambda.ts`, `stdio.ts`; `packages/tenant/ai/src/wall/authenticator.ts` — the current transport and verify path.
- MCP authorization spec (stdio-vs-HTTP; resource server; RFC 9728/8414/7591/8707).
