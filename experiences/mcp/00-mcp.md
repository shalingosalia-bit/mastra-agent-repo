---
type: spec-stack
status: partly-built
---
# The Neuro MCP surface

Neuro exposes itself to AI clients over the Model Context Protocol. A client — Claude Code, Claude Desktop, a custom agent, another company's product — connects, authenticates as a real principal in a real tenant, and calls the same operations the web UI and the API call.

The server is `apps/mcp`. Its README is the operational reference: routes, configuration, how to run it. This document is the surface's plan — what it exposes, what it will expose, and the decisions that shape it.

## What the surface is

**A pure OAuth 2.1 resource server.** It verifies tokens and runs no login flow. The authorization server is the auth scope's own OAuth provider surface, which the MCP server names in its RFC 9728 discovery document. A client that arrives without a token gets a 401 pointing at that document, follows it, obtains a token, and comes back. The document names the authorization server as `{AUTH_ISSUER}/api/auth`, and `apps/auth` serves that issuer's metadata at `/.well-known/oauth-authorization-server/api/auth`, where RFC 8414 §3.1 puts it. Nothing about sign-in lives in this package. `apps/auth` runs that authorization server: Better-Auth's OAuth provider with dynamic client registration (RFC 7591), PKCE and RFC 8414 discovery (`packages/shared/authn/src/providers/better-auth.ts:761`, `apps/auth/src/composition/compose.ts:398`), covered by `apps/auth/src/composition/app.test.ts` §S-11. The provider runs that protocol, and Neuro mints the access token of each grant with its own issuer. A client's unscoped `neuro:mcp` token from that flow verifies here, and MCP answers 403 to a scoped one (ADR-0037 §Issuance decision 1).

That split matters for isolation. **The MCP endpoint follows the auth scope**, like every other surface: a silo tenant's endpoint names its own tenant's issuer, pooled tenants share their pool's. So a client authorizing against one tenant never learns another scope's issuer — which a single global endpoint could not achieve.

**Tokens from the authorization server.** `apps/auth` mounts DCR (RFC 7591), PKCE auth-code against the user's existing web session and RFC 8414 discovery, and mints the access token of each grant with Neuro's issuer, so an unscoped `neuro:mcp` token from that flow verifies at MCP and is accepted. MCP answers 403 to a scoped one, which includes every client credentials token and every token in a tenant that sets a scope ceiling. A client names MCP by its URL as the RFC 8707 `resource` where `apps/auth` has `MCP_PUBLIC_URL` set, or names `neuro:mcp` or nothing and gets MCP (ADR-0037 §Issuance decision 1).

**Tools are derived, never declared.** `@mastra/mcp`'s `MCPServer` reads the Mastra instance in `@neuro/ai` and turns each agent into an `ask_<name>` tool and each workflow into a `run_<name>` tool, taking the input schema from the Mastra definition. Adding an agent to `@neuro/ai` adds an MCP tool with no change in the MCP package, and a tool's schema cannot drift from the thing it calls.

The domain operations arrive the same way. `operationTools()` in `@neuro/ai` reads `OPERATIONS`, the registry of declared operations in `@neuro/core/operations`, and builds one tool per declaration it offers: the name is the declaration's id with `.` and `-` replaced by `_`, the description is its `summary`, and the input schema is the schema the HTTP routes already parse bodies with. So `entity.query` reaches a client as `entity_query`.

**What it offers is every read and one write.** `agentMayStart` keeps `proposal.create` and drops the rest, so a model proposes a value and a person accepts it. That is the posture `apps/dpagentic/CLAUDE.md` rule 14 states for the in-app chat, and the two agent surfaces take the same one: a value reaches `field_values` through an acceptance and never through a tool. Widening it is a deliberate change, and `apps/mcp/src/wiring.test.ts` fails when a write other than the proposal appears in the served list.

## The rule that makes this safe

**No tool takes a tenant or a principal as input.** Both ride the Mastra request context, which the transport builds from the verified token.

This is the whole basis on which these tools can be handed to an arbitrary MCP client. A `tenantId` in an input schema is not a parameter — it is a tenant the calling model gets to choose, and a model's inputs are attacker-influenced in a way a web form's are not. `apps/mcp/src/wiring.test.ts` asserts that no exposed schema mentions either, so a tool that added one fails the suite rather than shipping.

The same rule applies inside the workflow. `ingestDocumentWorkflow` re-reads the tenant from the request context in each step rather than passing it between them, so the tenant a row lands in has exactly one source for the whole run.

## Authority

Two stages per request, in order, per [`../../coreservices/authn/04-proposed-model.md`](../../coreservices/authn/04-proposed-model.md):

| Stage | Question | Where the answer comes from |
| --- | --- | --- |
| Verify | Is this token genuine, from our scope's issuer, for this surface, and still live? | The scope's JWKS, pure CPU, then one read of the issued-token record (`neuro_access_token_live`). |
| Hydrate | Who does it name in this tenant, and what may they do? | `principals` rows in that tenant's database. |

Roles never come from a claim ([ADR-0011](../../reference/adrs/)), so a revoked role takes effect on the next request rather than whenever the token happens to expire. A subject that verifies but hydrates to nothing is a stranger in that tenant whatever the token says.

The token's `kind` and `act` reach hydration, and neither is assumed. That matters twice: hydration rejects a claimed kind that disagrees with the `principals` row, so agent policy is never evaluated as a person's, and `act` is what re-reads a support session on every request and puts the performer in the change log.

**A token this surface has no correct authority for answers 403.** Two shapes take that answer: a non-user kind, and a token stating a `scope` nothing here applies. Accepting either would give a read-consented client every role its subject was granted (`docs/coreservices/authn/04-proposed-model.md` §Where `scope` is enforced).

The audience check is what keeps surfaces separate. A `neuro:tenant-api` token presented to the MCP endpoint is a 401, not a warning — see [`../../coreservices/authn/05-token-and-claims-spec.md`](../../coreservices/authn/05-token-and-claims-spec.md).

## What is exposed today

| Tool | Backed by |
| --- | --- |
| `ask_assistant` | The retrieval-augmented Neuro assistant |
| `run_ingestDocument` | Embed a document and persist it so it becomes searchable |
| `searchDocuments` | pgvector retrieval over the document store |
| One tool per declaration an agent may start | The domain operations in `@neuro/core`: querying a record set, faceting, nearby records, search, suggestions, what an agent may do on one record, and proposing a value |

Two properties of the operation tools. A proposal records `source: 'agent'`, which the write path reads before it rejects a proposal against a field a tenant's actions made propose-only, so a tenant narrows the surface further per field. And `entity_capabilities` answers `agentCapabilitiesFor` for one record, which is how those grants and restrictions reach a client at all: a tool list is fixed for the session and the answer is per record, so the list is never narrowed and the client asks.

Four areas have no declaration yet: workspaces, dashboards, view persistence and notifications. None of them reaches a surface built from the registry, and declaring one exposes it here.

## Not built yet

**Agent identity (S-12).** Today a delegated token answers 403, so a client presents a plain user token and acts as that user. The design is that authorizing an MCP client provisions (or reuses) an `agent` principal whose `external_id` is the OAuth client id. Per RFC 8693 §4.1 and [`../../coreservices/authn/05-token-and-claims-spec.md`](../../coreservices/authn/05-token-and-claims-spec.md), such a token states `sub` = the user, `act` = the agent, `scope` = what was consented, and `att: 'delegated'`. Effective authority is then the intersection of the principal plan, the scope plan, the agent policy and the user's access, and both identities stamp the change log. Revoking the grant kills the agent without touching the user. See [`../../coreservices/authn/13-surface-wiring.md`](../../coreservices/authn/13-surface-wiring.md) §The Neuro-native MCP surface and [ADR-0012](../../coreservices/authn/ADR-0012-identity-data-placement.md).

**Deployment.** Two execution modes, selected by `MCP_SERVERLESS`.

| Mode | `MCP_SERVERLESS` | Host | Sessions |
| --- | --- | --- | --- |
| Container (default) | unset or `false` | One standing process — an `sst.aws.Service` on ECS Fargate is the shape it needs | Tracked, and a session may only be continued by the caller who opened it |
| Serverless | `true` | Per-invocation, on a **Node** runtime: AWS Lambda, a Vercel Node Function, a Worker with Node HTTP compatibility | None. A request carrying a session id is refused with `400 sessions-not-supported` |

The container mode cannot simply be deployed per-invocation, and the reason is the session-ownership map in `apps/mcp/src/http.ts` rather than anything about the transport. That map is one process's memory, and its check allows a session id it does not recognise — so several instances would each hold an empty map and the check that enforces isolation would compare nothing and pass every time. Serverless mode holds no sessions rather than carrying a check that cannot work.

Authority is unchanged between them: every request on the `/mcp` route carries its own bearer token and is verified and hydrated on its own, so identity never rested on session state. (`/health` and the RFC 9728 metadata route are public by design and reach no tenant data.) A per-invocation host needs `createMcpRequestHandler`, which returns a `(req, res)` handler; `createMcpHttpServer` is the standing container.

**A Node runtime is required either way, and `MCP_SERVERLESS=true` does not remove that.** `MCPServer.startHTTP` takes a Node `IncomingMessage`/`ServerResponse`, and `createMcpRequestHandler` forwards them unchanged; the serverless flag drops session state, it does not convert Fetch objects. So an edge or fetch-only Worker handler needs an adapter that materialises a Node request/response pair before either mode can serve it, and none is provided here. What the flag does remove is the stateful-host requirement, which is what this document previously described as making serverless impossible.

Nothing provisions the server in any environment yet, and no serverless deployment has been exercised beyond the unit level, so the modes are implemented and unproven in the field. See [`../../../devops/deployment-surfaces.md`](../../../devops/deployment-surfaces.md).

**Per-scope provisioning.** The configuration supports one endpoint per auth scope. Nothing creates them.

## Prior art

The the_wall MCP server that used to live here was a surface over the legacy REST API, and it moved to `dealpath/mcp` with the rest of that stack. Its tool catalogue is a useful checklist of what customers actually asked an MCP client to do — [`01-legacy-tool-inventory.md`](01-legacy-tool-inventory.md) records it, mapped to where the equivalent capability lives in Neuro.

Two things from that surface are deliberately not carried over. It authenticated by verifying a the_wall API token and gated writes on a `feature_access.mcp_write` flag; the scope model plus the authz plan replace both. And it exposed each REST endpoint as its own tool, which is why there were sixty-one of them — a shape worth not repeating, since a tool per endpoint spends the model's context on a menu rather than on the task.
