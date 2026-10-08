# Best practices and patterns: what the industry calls a workspace

The word covers two unrelated patterns, and choosing between them is the first design act. This doc separates them, then surveys the analogues for the one Neuro is building, and ends with the disciplines each analogue teaches.

Sources are public product documentation and observed product behavior; inference is marked as such. Links are collected at the end.

## The two patterns

| | **Container** | **Lens** |
|---|---|---|
| Examples | Slack workspace, Notion teamspace, Linear team | Salesforce Lightning App, Dynamics model-driven app, ServiceNow Configurable Workspace, SAP Fiori Space, Airtable Interface |
| What it is | a membership and data-ownership boundary | a curated experience over shared data |
| Records | belong to it | belong to the tenant; the lens selects |
| Grants access? | yes — being a member is the access | no — access is decided elsewhere |
| Why a customer wants it | keep two projects' data apart | give two roles two different applications |

**Why this matters more than it looks.** These solve different customer problems and both are called "workspace", so a design that does not choose gets both halves and satisfies neither. In the container pattern, access follows structure — which is why Slack, Notion, and Linear all use *structural* boundaries (a private team, a private teamspace) rather than permission flags for the cases that must be airtight. In the lens pattern, access is orthogonal — a Lightning App assigned to your profile does not grant you a single record.

Neuro is building the lens. It already has the container: tenancy (pool and silo), and, one level down, `views.scope ∈ personal | group | shared` with membership joined at read from `group_members` (`docs/experiences/views/04-proposed-model.md`). Adding a third containment concept would put one fact in three homes.

## The analogues

### Microsoft Dynamics / Power Apps model-driven apps — the closest structural match

An app is: a **sitemap** (areas → groups → subareas, each subarea targeting a table, dashboard, web resource, or URL), a **selected subset** of the environment's forms, views, charts, and dashboards, an **icon and description**, an optional **welcome page**, and **security-role assignment**. Apps have a **draft status and an explicit publish**. All apps in an environment read one Dataverse data model — the app never owns tables. Apps ship inside **solutions**, which are the portable unit that moves an app between environments.

Four things to take:

1. **The sitemap is data with a defined grammar** (three levels, typed subareas), not a component tree.
2. **Component selection is subtractive from what exists**, not additive authoring. By default every form and view of an included table is enabled, and the maker *clears* what should not appear. That keeps the app from becoming a place where views get authored.
3. **Draft and publish are first-class.** A nav change is tried before anyone sees it.
4. **The app is packaged and portable.** This is the answer to the tenant-transfer requirement in `CLAUDE.md`, arrived at independently by a product that had to solve environment promotion.

### Salesforce Lightning Apps — the closest, and the cautionary tale

An admin configures: **navigation items** (the first item becomes the landing page), **branding** (name, logo, color), a **navigation style** (standard versus console), a **utility bar** of always-available tools, the **user profiles** the app is assigned to, and — notably — **whether end users may personalize the navigation bar**, an explicit per-app toggle. An app assigned to no profile is invisible in the App Launcher.

Two things to take, one to refuse:

- Take: **assignment is to a role/profile, not to a person**, with per-person entitlement falling out of it.
- Take: **personalization is a per-workspace policy**, not a global product decision. Some workspaces are a designed flow and must not be rearranged; others are a starting point.
- Refuse: Salesforce accumulated **parallel, mutually confusing layout systems** — this is already named as the failure mode `docs/experiences/views/04-proposed-model.md` collapses its three view kinds to avoid. A workspace must not become a place where layouts are authored, or the same accretion happens one level up.

### ServiceNow Configurable Workspaces — the persona framing

ServiceNow ships workspaces "for processes and personas specific to their products", built in UI Builder over a component library, with route configuration mapping URLs into the workspace, and an app shell that lets a user move between a configurable workspace and the classic environment **without separate browser tabs**.

One thing to take: **the shell hosts more than one experience and switching is cheap**. A tenant migrating from Classic to something else does it person by person, not in a cutover — which is precisely the shape of the Classic → Agentic transition. (Route configuration and experience-record internals are not documented publicly at a level worth copying; treated as inference and not relied on.)

### SAP Fiori Spaces and Pages — the admin/user seam

Spaces group related content; pages within a space organize it. Spaces replaced an earlier flat "groups and catalogs" model explicitly because that model did not scale for business users. The division of labor is stated plainly: **only administrators create spaces; end users personalize a page's sections and tiles within them**, both through a WYSIWYG editor.

Take: **the admin/user seam**, and the historical lesson behind it — a flat, unnamed collection of togglable content is the thing spaces replaced, and `feature_access` is exactly that flat collection (`01`, M1).

### Airtable Interfaces — the external-user case, and the sharpest warning

An interface is a curated set of layouts over a base. Two properties matter here:

1. **Interface-only users**: an interface can be shared with someone who has *no access to the underlying base at all*. Access is genuinely absent, not hidden.
2. **User-based filtering** narrows records per viewer, configured on the interface page.

Take the first. **Do not take the second as a security mechanism.** Airtable can combine them safely only because the interface-only user has no other door to the data; the filter is a convenience on top of an access boundary that already holds. Neuro's equivalent boundary is `is_external = true` principals, who get access only from per-record grants (`docs/coreservices/authz/10-access-templates-and-defaults.md`). Workspace scope rides *on top of* that; it is never the thing making Connect safe. Getting this backwards reproduces legacy pitfall P3 in `docs/experiences/views/01-legacy-pitfalls.md` — presentation-layer security — at the shell level, where it would be worse, because the shell is what an external user is handed.

### Notion, Slack, Linear — the container pattern, surveyed to be refused

Notion's teamspaces are sub-containers of a workspace, each with its own membership, permission defaults, and (on Enterprise) the ability to override workspace-level security settings. Slack scopes roles to the workspace. Linear scopes to teams, with private teams as a structural boundary.

Three things are worth taking even though the pattern is refused:

1. **Nobody makes the customer configure this on day one.** Every one of these products works out of the box and the structure is opt-in. This is the same conclusion `docs/coreservices/authz/10` reached for permissions with its one permissive seed rule, and it is a hard requirement here: a tenant that never hears the word "workspace" must get a working app.
2. **Open / closed / private is a useful axis** — for Neuro's lens it becomes *who may discover a workspace in the switcher*, which is a different question from *who may use it*.
3. **Structural boundaries beat permission flags** when something must be airtight — which is the argument for keeping Connect's safety in `is_external` and grants rather than in the lens.

## Agentic UI: what an "agent-forward" workspace actually is

The 2026 consensus across the agentic-UI literature is that a serious agent surface is **not a chat sidebar bolted onto an app**. The direction is generative UI — the agent declares or selects the application's own components rather than emitting prose or executable code — formalized in emerging specifications for agent-to-UI communication (A2UI, MCP Apps, AG-UI). The recurring pattern set for enterprise agents is: **planning visibility, tool-use disclosure, memory surfacing, multi-step workflow tracking, and recovery routing** — all of which are about making an autonomous actor legible and correctable, not about chat.

Neuro is unusually well placed here, and this is the reason the Agentic workspace costs almost nothing to specify: `ViewHost = 'page' | 'section' | 'chat'` already exists in the views model, and the resolved section shape is serializable data rather than a query, so the *same* resolved view renders in an RSC page, a Nitro JSON response, and a chat card. An agent-forward workspace is therefore **a placement decision plus a home surface**, not a second rendering path. If specifying it requires new components, the views model is being bypassed.

The corollary, and the discipline: agent-forward must not mean *less legible*. The five patterns above are workspace-independent obligations of the agent surface — they belong in `docs/coreservices/messaging/threads` and the agent design, not in a workspace's chrome enum. A workspace decides how much room the agent gets; it never decides how honest the agent is.

## The disciplines, collected

Nine rules the survey converges on, each traceable to at least two analogues:

1. **Sitemap is data with a bounded grammar.** (Dynamics, Salesforce)
2. **Compose by reference; never author presentation inside the lens.** (Dynamics' subtractive selection; Salesforce's parallel-systems failure)
3. **Assign to roles, not people; entitlement falls out.** (Salesforce, Dynamics)
4. **Admin authors, user personalizes — and whether they may is per-workspace.** (Fiori, Salesforce)
5. **Draft and publish, so a change can be tried.** (Dynamics, Fiori)
6. **Packaged and portable, so it moves between environments and tenants.** (Dynamics solutions)
7. **The shell hosts several experiences and switching is cheap.** (ServiceNow, Salesforce App Launcher)
8. **Zero configuration required on day one.** (Notion, Slack, Linear)
9. **The lens is never the access boundary.** (Airtable, and every container-pattern product)

## Sources

- [Create or edit a model-driven app — Microsoft Learn](https://learn.microsoft.com/en-us/power-apps/maker/model-driven-apps/create-edit-app)
- [Enhance Efficiency with Custom Lightning Apps — Salesforce Trailhead](https://trailhead.salesforce.com/content/learn/modules/lex_customization/lex_customization_apps)
- [Personalized Navigation Considerations — Salesforce Help](https://help.salesforce.com/s/articleView?id=sf.user_userdisplay_tabs_lex_considerations.htm&language=en_US&type=5)
- [Agent Workspace (Legacy) versus Configurable Workspaces — ServiceNow Community](https://www.servicenow.com/community/next-experience-articles/learn-about-the-differences-between-agent-workspace-legacy-and/ta-p/2332026)
- [Further step of SAP Fiori 3: Spaces and Pages — SAP Design](https://medium.com/sap-design/further-step-of-sap-fiori-3-available-spaces-and-pages-852dc8c8488e)
- [Best practices for structuring spaces and pages — SAP](https://blogs.sap.com/2020/11/06/sap-fiori-for-sap-s-4hana-best-practices-for-structuring-spaces-and-pages/)
- [Introducing Interface Designer permissions — Airtable](https://blog.airtable.com/interface-designer-permissions/)
- [Interface Designer permissions — Airtable Support](https://support.airtable.com/docs/interface-designer-permissions)
- [Multi-tenant permissions done right: what Slack, Notion, and Linear can teach us — WorkOS](https://workos.com/blog/multi-tenant-permissions-slack-notion-linear)
- [Notion workspace versus teamspace — Connex Digital](https://connex.digital/blog/notion-workspace-vs-team-space-understanding-the-key-differences/)
- [The developer's guide to generative UI in 2026 — CopilotKit](https://www.copilotkit.ai/blog/the-developer-s-guide-to-generative-ui-in-2026)
- [Agentic UX: frontend design patterns for AI agents — Zylos Research](https://zylos.ai/research/2026-05-28-agentic-ux-frontend-design-patterns-ai-agents/)
- [Agent UX: UI design for AI agents in 2026 — Fuse Lab Creative](https://fuselabcreative.com/ui-design-for-ai-agents/)
- [Dealpath Connect for investors](https://www.dealpath.com/dealpath-connect-buyer/) · [for brokers](https://www.dealpath.com/dealpath-connect-seller/)
