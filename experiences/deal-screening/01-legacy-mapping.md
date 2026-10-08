# Legacy Mapping

Legacy Dealpath has no deal screening. A DealLead reads the deal and its documents by hand, and the MCP beta lets a client's own AI read and write deal fields. This experience keeps what clients rely on, and adds a verdict per criterion with sources, proposals and a record of each run.

## How It Works Today

| Where | How screening happens | Evidence |
|---|---|---|
| Legacy Dealpath | A DealLead or an Analyst reads the deal and its documents by hand. No screening feature exists for deals | Shalin Gosalia's draft, pull request #1399 |
| Legacy Connect | A buy-side Tenant matches inbound listings to its buy box with a saved search over one shared listing table | [Connect](../connect/03-requirements-and-user-stories.md) CN30 |
| Legacy Connect | Values an AI extracted from an offering are stored as untyped JSON in `listing_ai_enhancements` | [Connect](../connect/06-legacy-functionality-map.md) §Legacy items |
| The MCP beta | Clients read deal fields and write them from their own AI client, with 217 `update_field_value` calls | [Tool evidence](../evidence/mcp-tools-to-outcomes.md) §The map |

## Pitfalls and Constraints

| # | Pitfall | Evidence | Constraint |
|---|---|---|---|
| 1 | The beta writes a value as soon as it is called | [POC brief](../briefs/agentic-foundation-poc.md) §Who Is Affected | Every write is a proposal a User accepts (DS6) |
| 2 | The beta keeps no record of what it read or changed | [POC brief](../briefs/agentic-foundation-poc.md) §Who Is Affected | Every screening runs as a session with a record (DSN3) |
| 3 | The beta dropped filters and rejected option values | [Tool evidence](../evidence/mcp-tools-to-outcomes.md) §Beta defects to test against | Each criterion resolves to a field and option before any check (DS1) |
| 4 | The beta reported values absent from the deal | The MCP beta's golden dataset, its hallucination cases | A value with no source is Unknown (DS5) |

## Parity and Beyond

| Legacy behaviour | Here | User experience |
|---|---|---|
| Reading a deal and its documents to screen it | Better: the agent checks each criterion and cites each value's source | UX1 |
| Matching a listing to a buy box with a saved search | Better: a verdict per criterion on any deal, including one created from a listing | UX1 |
| Values an AI extracted from an offering | Parity: values found in documents arrive as proposals to accept | UX3 |
| Reading and writing deal fields from Claude | Better: the same verdict, with writes as proposals | UX4 |
| Triage of inbound listings and their dispositions | Not carried: [Connect screener](../connect/connect-screener/00-connect-screener.md) owns it | — |

## Findings

| Finding | Status | Source |
|---|---|---|
| Clients update deal fields through the MCP beta, with 217 `update_field_value` calls | Observed | [Tool evidence](../evidence/mcp-tools-to-outcomes.md) §The map |
| The beta dropped filters and rejected option values. Those cases become eval cases | Observed | [Tool evidence](../evidence/mcp-tools-to-outcomes.md) §Beta defects to test against |
| The beta reported values absent from the deal | Observed | The MCP beta's golden dataset, its hallucination cases |
| Screening and triage is a client outcome | Observed | Ground Up Vision Plan, slides 8 and 9 |
| A DealLead will not act on a value without its source | Assumed | FO-2 in the [outcome register](../outcomes.md) |
| Four criteria is a typical screening | To test | None yet. The example in the `00` uses four |

Sources: the tool evidence map and the MCP beta's golden dataset, from beta usage before 2026-08-19. Connect's requirements and legacy functionality map. The Ground Up Vision Plan, September 2026.
