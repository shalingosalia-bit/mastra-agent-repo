# GRO1 Experiences

This folder holds the designs for the jobs Users and Agents do in Dealpath, and for the views and tools they do them in. It mirrors the GRO1 Experiences initiative in Linear, which owns the work of every stack here.

| Kind | What it specifies | Format |
|---|---|---|
| Experience stack | One job a User or an Agent gets done, using what other stacks own | [`../experience-stack-template.md`](../experience-stack-template.md) |
| Capability stack | A model or a surface it owns, such as workspaces, filters or Connect | [`../spec-stack-template.md`](../spec-stack-template.md) |

Each stack states its status in its own `00-*.md` frontmatter. [`docs/README.md`](../README.md) indexes every stack with its owning Linear project.

## Capability stacks

| Stack | Status |
|---|---|
| [`views/`](views/00-views.md) | Partly built |
| [`workspaces/`](workspaces/00-workspaces.md) | Partly built |
| [`filters/`](filters/00-filters.md) | Proposed |
| [`design-system/`](design-system/00-design-system-reference.md) | Reference |
| [`branding/`](branding/00-branding.md) | Proposed |
| [`mcp/`](mcp/00-mcp.md) | Partly built |
| [`connect/`](connect/00-connect.md) | Design only |
| [`connect/connect-screener/`](connect/connect-screener/00-connect-screener.md) | Design only, a sub-stack of `connect/` |

## Two Tracks That Meet at the Outcome

| Track | Question it answers | Direction |
|---|---|---|
| [`outcomes.md`](outcomes.md) | Why: what clients need, and how far Dealpath is toward each outcome | The goal both tracks serve |
| Experience stacks | How: what a User or an Agent does to reach an outcome | Top-down, from the outcome to the stacks it needs |
| [`evidence/`](evidence/mcp-tools-to-outcomes.md) | What exists today: the tools clients already use, mapped to outcomes | Bottom-up |
| [`briefs/`](briefs/) | What now: which experiences and foundation pieces are built next | Scope |

Each experience is designed from its outcomes, then checked against the tool evidence for them ([`../experience-stack-template.md`](../experience-stack-template.md) §Separation of Concerns).

## Experience stacks

Generated from each experience's `00` frontmatter by `bun run experiences:index`.

<!-- experiences:begin -->
| Experience | Outcomes | Owner | Status | Depends on |
|---|---|---|---|---|
| [Deal Review (POC)](deal-screening/00-deal-screening.md) | CO-4, CO-5, CO-7, CO-10, FO-1, FO-2, FO-5, FO-9 | Frances Lo; Shalin Gosalia | Proposed | `entity-fields` (Built), `agentic` (Design only), `documents` (Partly built), `flow` (Partly built), `views` (Partly built), `mcp` (Partly built) |
<!-- experiences:end -->

## Shared by Every Experience

[`decision-rights.md`](decision-rights.md) says who decides what between AI Platform and the experience PODs, by layer.

## Product Folder Structure

Product managers write the files below. The capability stacks in this folder belong to their engineering owners.

```text
docs/
├── experience-stack-template.md     the format every experience and brief follows
└── experiences/
    ├── outcomes.md                  the outcome register
    ├── decision-rights.md           who decides what, by layer
    ├── evidence/                    MCP beta usage mapped to outcomes, to check the POC against. Grows as agents roll out
    ├── briefs/                      what is built next, by when
    └── <experience>/                one folder per experience stack
        ├── 00-<experience>.md       the activity, its User experiences and measures
        ├── 01-legacy-mapping.md     how the job is done today
        ├── 02-design-and-ux.md      each User experience, step by step, with links to its prototypes
        ├── 03-requirements-and-user-stories.md
        ├── 04-proposed-model.md     the stacks each requirement uses
        └── 05-agentic-experience.md the agents, flows, guardrails and evals
```

## Owners and Reviewers

| Artifact | Owner | Reviews, in order |
|---|---|---|
| An experience stack | The POD's product manager as primary. The AI Platform product manager as secondary when `agentic: true` | A peer bar raiser with the `product-bar-raiser-spec-ready` skill, then Shalin Gosalia for the AI Platform column, then Kenter Wu or John Lorance to merge |
| A brief | The product manager named in its `owner` | A peer bar raiser, then Shalin Gosalia, then Kenter Wu or John Lorance |
| [`outcomes.md`](outcomes.md) | Ursula Sage, Jeff Blasbalg and the product team | A peer bar raiser, then Shalin Gosalia, then Kenter Wu or John Lorance |
| [`decision-rights.md`](decision-rights.md) | Shalin Gosalia. Each POD's product manager validates their own column | Each named POD owner, then Kenter Wu or John Lorance |
| [`evidence/`](evidence/mcp-tools-to-outcomes.md) | Shalin Gosalia. Each agent's or tool's owner adds its usage after rollout | A peer bar raiser, then Shalin Gosalia, then Kenter Wu or John Lorance |

[`../experience-stack-template.md`](../experience-stack-template.md) §Ownership and §Review and Sign-Off state what each owner decides and what each review covers. Jeff Blasbalg is an optional second product reviewer on any of these. Request each review by hand on the pull request.

## The Agentic Foundation POC

The POC tests the foundation on one experience, [`deal-screening/`](deal-screening/00-deal-screening.md), titled "Deal Review (POC)". It runs four kinds of specialist across three pillars: screening, comparison with comps, and follow-up tasks with a decision memo and approval. [The POC brief](briefs/agentic-foundation-poc.md) sets its scope and dates.

1. **"(POC)" in a title marks requirements AI Platform drafted for the POC.** The owner replaces them as they refine the stack, and drops the label at sign-off. The folder name never changes.
2. **Shalin Gosalia drafts and maintains deal review for the POC.** Frances Lo stays its primary owner, and her sign-off moves it past `proposed`.
3. **Its task and memo specialists stand in for Henderson Beck's agents,** and its comparison specialist for Deal & Portfolio's. Each POD's agents replace them as their own experiences, in their own folders.
4. **The POC builds against the stack as it stands at `proposed`,** without waiting for owner sign-off. Its acceptance criteria are `05` §Eval Cases 1 to 3 and 6 to 13, §Bounds and Cost, and §Authority and Proposals. Cases 4 and 5 join with document reads.
5. **The bar-raiser review is optional** for a change scoped to the POC. Every other product change runs it.

## How to Contribute

1. **Start from an outcome** in [`outcomes.md`](outcomes.md). Propose a missing outcome to its owners first.
2. **Add a candidate row** to the table below by pull request: the experience, its outcomes and its owner. A candidate needs no other document.
3. **Register the experience** in [`docs/README.md`](../README.md), then write its `00` from [`../experience-stack-template.md`](../experience-stack-template.md), copying [`deal-screening/`](deal-screening/00-deal-screening.md). Remove its candidate row.
4. **Check the agents you need** against existing `05` documents. Reuse an agent another experience declares, and cite its brief.
5. **Raise each missing foundation piece** as a `New` or `Extend` row in `04` §Gaps. AI Platform reviews open Gaps rows across all experiences every two weeks, ranked by how many experiences need each one.
6. **Run the checks**, `bun run check:experiences` and `bun run check:top-line`, then the `editor` and `specstack-review` skills.
7. **Enroll a bar raiser** from another POD, who runs the `product-bar-raiser-spec-ready` skill on the change. It scores the spec, its ownership and its timeline, and lists the decisions the approvers must agree on. Fix findings until every document scores 9 or more.
8. **Open a draft pull request** into `develop` for the reviews in §Owners and Reviewers, with the bar raiser's score table as a comment.

### Candidates

| Experience | Outcomes | Owner | Next step |
|---|---|---|---|
| Task agent | CO-10, CO-15 | Henderson Beck, until its POD is agreed | A `00` once his task agent exercise sets its flows. It replaces deal review's POC task and memo specialists |
