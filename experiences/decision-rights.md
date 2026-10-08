---
type: decision-rights
owner: Shalin Gosalia
pod: AI Platform, with the experience PODs
state: working-draft
---

# Decision rights: AI Platform and the experience PODs

AI Platform (the horizontal POD) decides the rules every POD shares. Each of the three to four experience PODs (the vertical PODs) decides how those rules apply in its domain. Neither overrides the other's decisions. Each POD owner checks their column of the matrix below before this document is final.

Source: GroundUp POD strategy, October 2026 draft, the vertical vs. horizontal decision-rights matrix.

## The matrix

| Layer | Decision area | AI Platform | Experience PODs | How the two split it |
|---|---|---|---|---|
| Experience | Presentation layer: UI and UX for the domain | | Decides | Chad Schmidt and the experience POD product managers own the shared design component library every POD uses |
| Agentic | The orchestrator's routing patterns: which agent handles a request, and how autonomous it is (auto-execute or human in the loop) | Decides | | One mechanism for every POD, including build-or-buy calls on orchestration tooling and the protocols agents and tools use (A2A, MCP) |
| Agentic | Which competences a domain gets, and which specialists serve them | | Decides | A competence is what can be done to a record of one type. A specialist does it, with its own instructions and model, on AI Platform's specialist registry |
| Agentic | Evals: the tooling and shared harness (scorers, LLM as a judge, human-review queue, cost caps) | Decides the harness | Decides the rubric | AI Platform owns the harness and the eval tool. Each POD owns its domain's rubric and fixtures |
| Agentic | AI governance and guardrails: permissions and policy enforcement across every agentic surface | Decides the shared policy | Decides per-agent rules | AI Platform owns the shared compliance policy and the prompt-library playground. Each POD writes its agents' own guardrail rules (privacy, security) |
| Agentic | Human-in-the-loop checkpoints: the review gate and audit trail, and the domain rules for when a human must sign off | Decides the mechanism | Decides the trigger rules | AI Platform builds the review gate and the audit trail. Each POD sets its own triggers, such as deal-status moves or financial-model finalisation |
| Tools and data | Agent Tool Surface: contract, schemas and publishing | Decides | | One tool registry, with the plugin mechanism each POD uses to publish its own tools into it, so every client offers the same tools |
| Tools and data | Domain tool implementations, skills and prompts that carry out what a specialist decides | | Decides | Each POD builds these on the shared registry |
| Tools and data | Entity and record model content, and domain data feeds (comps, listings, Excel, Outlook) | Decides schema and pipeline | Decides content and feed quality | AI Platform manages the schema and pipeline (Snowflake, AWS). Each POD owns its domain content and the ingestion quality of its feeds |
| Infrastructure | Runtime (core services, BuilderOps, observability, Tenant provisioning) | Partners | | John Lorance's team owns core infrastructure. AI Platform is the product bridge between that team and the experience PODs |
| Operations | Pricing and agent-KPI tracking (Pendo) | | Decides | Each POD sets its own pricing input and instruments its agents' KPIs |

## How it applies to this folder

| Document | AI Platform decides | Experience PODs decide |
|---|---|---|
| [Outcome register](outcomes.md) | Nothing | Ursula Sage, Jeff Blasbalg and the PM team own it. Every POD cites its ids |
| A brief, such as the [POC brief](briefs/agentic-foundation-poc.md) | The foundation layers the experiences need | Nothing in a brief overrides a POD's column |
| An experience stack | As secondary owner, per [`experience-stack-template.md`](../experience-stack-template.md) §Ownership | As primary owner, per the same section |
| [Tool evidence](evidence/mcp-tools-to-outcomes.md) | The tool-to-outcome links, beta usage and Neuro homes | Which links fit their domain, as experiences are defined |
| [The template](../experience-stack-template.md) | The sections every document keeps | Nothing. Any product manager uses it |

Documents are filed by type. A POD's scope is every document whose `pod` field names it. A reorganisation changes `pod` fields and moves no file.
