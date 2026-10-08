---
type: tool-evidence
owner: Shalin Gosalia (AI Platform), with the experience POD PMs
pod: AI Platform, with the experience PODs
state: initial-draft
phase: 1b
---

# Current MCP tools mapped to client outcomes

Each tool the Dealpath MCP beta serves today, the [client outcomes](../outcomes.md) it serves, its beta usage, and its home in Neuro. It shows which outcomes clients already use Dealpath for, and where they do the work themselves with raw tools.

State: **Initial draft, not final.** The outcome links are judgment calls and change as outcomes and experiences are reviewed.

This map starts from the MCP beta, the first evidence set. The MCP tools stay as they are. This map uses what clients learned from them to check the POC's specs and the agentic foundation. Each agent or tool that rolls out adds its usage, defects and outcomes here. Experiences use the latest version to revise their eval cases and agents.

## How it is used

1. **As validation.** The POC's specs and the agentic foundation are checked against what clients do with the MCP beta today.
2. **As evidence** for the Progress column in the outcome register.
3. **As a checklist.** An [experience stack](../../experience-stack-template.md) checks its needs against this map for capabilities and beta defects to cover.
4. **Not as a design for Neuro agents.** A Neuro agent is designed from the outcome it serves, so it is never a group of these tools. No `dealpath/mcp` code is reused in Neuro ([README](../README.md)), and the MCP tools need no change.

## Sources and method

1. **Tools:** the beta set `dealpath/mcp` registers in `packages/ai/src/tools/thewall/registry.ts` at its September 2026 `main` merge, plus four tools the live connector serves that the repository snapshot lacks (marked *live only*).
2. **Beta calls:** Sentry `mcp.tool.calls` for the 30 days before 19 August 2026 (`docs/mcp_by_tool.csv` in `shalingosalia-bit/dealpath-mcp`). One account's automated traffic produces most of the task volume. The counts show what some clients rely on and do not measure demand across clients.
3. **Neuro home:** from [`01-legacy-tool-inventory.md`](../mcp/01-legacy-tool-inventory.md), with the owning stack's state. Mapped means the inventory names a home whose state this map has not checked.
4. **Cross-cutting** tools serve every outcome that reads a record, so they count toward none on their own.

## The map

### Finding records and fields

| Tool | Access | Client outcomes | Beta calls | Neuro home today |
|---|---|---|---|---|
| `get_current_user` | Read | Cross-cutting | 58 | Request context (built) |
| `list_entity_types` | Read | Cross-cutting | 17 | Type registry (built) |
| `list_fields` | Read | Cross-cutting | 430 | Field descriptors (built) |
| `list_field_options` | Read | Cross-cutting | 80 | Field descriptors (built) |
| `search_entities` | Read | Cross-cutting | 707 | `search.entities`, `entity.query` (built; search partly built) |
| `get_entity` | Read | Cross-cutting | 202 | `entity.query` (built) |
| `get_entity_associations` | Read | CO-3, CO-9 | 89 | Type relations (built) |
| `search_members` | Read | CO-10, CO-15 | 9 | Principal directory (mapped) |
| `get_field_values_for_entities` | Read | Cross-cutting | 396 | Field reads (built) |

### Status and history

| Tool | Access | Client outcomes | Beta calls | Neuro home today |
|---|---|---|---|---|
| `list_workflow_statuses` | Read | CO-14, CO-15 | 0 | Not in the inventory; flow is the likely home |
| `list_transitions` | Read | CO-10, CO-14, CO-15 | 2169 | Flow (partly built) |
| `search_status_changes` | Read | CO-14, FO-8 | 0 | Not in the inventory; flow is the likely home |
| `get_entity_history` | Read | CO-9, FO-5, FO-8 | 0 | Change log (mapped) |
| `update_record_status` | Write | CO-4, CO-10 | 10 | Flow (partly built) |
| `update_record_workflow` | Write | CO-9 | 2 | Flow (partly built) |

### Tasks and diligence

| Tool | Access | Client outcomes | Beta calls | Neuro home today |
|---|---|---|---|---|
| `list_tasks` | Read | CO-10, CO-13, CO-15 | 23 | Flow work items (partly built) |
| `search_tasks` | Read | CO-10, CO-13, CO-15 | 4471 | Flow work items (partly built) |
| `get_task` | Read | CO-10, CO-15 | 6888 | Flow work items (partly built) |
| `list_phases` | Read | CO-10 | 0 | Not in the inventory; flow is the likely home |
| `get_task_blockers` | Read | CO-10, CO-15 | 4 | Flow work items (partly built) |
| `create_task` | Write | CO-10, CO-15 | 5 | Flow work items (partly built) |
| `create_critical_date` | Write | CO-10, CO-13 | 0 | Not in the inventory; needs a home |
| `update_task` | Write | CO-10 | 1 | Flow work items (partly built) |
| `start_task` | Write | CO-10, CO-15 | 1 | Flow work items (partly built) |
| `complete_task` | Write | CO-10, CO-15 | 0 | Flow work items (partly built) |
| `update_task_status` | Write | CO-10, CO-15 | 5 | Flow work items (partly built) |
| `set_task_assignee` | Write | CO-15 | 1 | Task participants (mapped) |
| `update_task_members` | Write | CO-15 | 0 | Task participants (mapped) |
| `set_task_latest_update` | Write | CO-15 | 2 | Task activity (mapped) |
| `update_task_due_date` | Write | CO-10 | 2 | Due-date chains (mapped) |
| `accept_due_date_link_chain` | Write | CO-10 | 0 | Due-date chains (mapped) |
| `add_task_info_field` | Write | CO-10 | 0 | Field system (built) |
| `set_task_info_field` | Write | CO-10 | 0 | Field system (built) |
| `add_checklist_item` | Write | CO-10 | 1 | Checklists (mapped) |
| `update_checklist_item` | Write | CO-10 | 0 | Checklists (mapped) |
| `delete_checklist_item` | Write | CO-10 | 0 | Checklists (mapped) |

### Documents and files

| Tool | Access | Client outcomes | Beta calls | Neuro home today |
|---|---|---|---|---|
| `list_entity_documents` | Read | CO-4, CO-7, CO-10, FO-2 | 7 | Document listing (partly built) |
| `get_document_download_url` | Read | CO-4, CO-7, CO-10 | 3 | Storage (built) |
| `list_task_files` | Read | CO-10 | 3 | Documents (partly built) |
| `download_task_file` | Read | CO-10 | 0 | Storage (built) |
| `get_task_file_upload_token` | Read | CO-7, CO-10 | 1 | Presigned uploads (built) |
| `upload_task_file` | Write | CO-7, CO-10 | 1 | Presigned uploads (built) |
| `attach_document_to_task` | Write | CO-7, CO-10 | 0 | Documents (partly built) |
| `detach_document_from_task` | Write | CO-10 | 0 | Documents (partly built) |

### Record changes

| Tool | Access | Client outcomes | Beta calls | Neuro home today |
|---|---|---|---|---|
| `get_entity_creation_requirements` | Read | CO-1, CO-8, CO-12 | 34 | Required-field descriptors (built) |
| `create_entity` | Write | CO-1, CO-8, CO-9, CO-12 | 18 | `entity.create` (built) |
| `update_entity` | Write | CO-1, CO-13 | 12 | Entity write (built) |
| `update_field_value` | Write | CO-4, CO-13 | 217 | `field-value.set`, through `proposal.create` for agents (built) |
| `batch_edit_field_values` | Write | CO-1, CO-13 | 0 | Field write (built) |
| `resolve_address` | Read | CO-1, CO-5 | 0 | Not in the inventory; needs a home |

### Comps and listings

| Tool | Access | Client outcomes | Beta calls | Neuro home today |
|---|---|---|---|---|
| `search_rca_comps` | Read | CO-5 | 0 | Absent |
| `get_external_comp` | Read | CO-5 | 0 | Absent |
| `list_attached_comps` | Read, *live only* | CO-5 | 0 | Absent |
| `list_listing_filters` | Read | CO-2 | 8 | Absent |
| `search_listings` | Read | CO-2 | 14 | Absent |
| `get_listing` | Read | CO-2 | 2 | Absent |

### Financial models

| Tool | Access | Client outcomes | Beta calls | Neuro home today |
|---|---|---|---|---|
| `list_financial_model_templates` | Read | CO-6 | 2 | Absent |
| `get_financial_model_template_for_entity` | Read | CO-6 | 6 | Absent |
| `list_financial_model_versions` | Read | CO-6 | 3 | Absent |
| `get_box_upload_token` | Read | CO-6 | 0 | Absent |
| `attach_financial_model` | Write | CO-6 | 0 | Absent |
| `create_financial_model` | Write | CO-6 | 0 | Absent |
| `create_financial_model_version` | Write | CO-6 | 0 | Absent |
| `update_financial_model_version` | Write | CO-6 | 0 | Absent |
| `set_selected_financial_model_version` | Write | CO-6 | 0 | Absent |
| `create_excel_import` | Write | CO-6 | 0 | Absent |
| `create_line_item` | Write, *live only* | CO-6 | 0 | Absent |
| `edit_line_item` | Write, *live only* | CO-6 | 0 | Absent |

### Contacts and touchpoints

| Tool | Access | Client outcomes | Beta calls | Neuro home today |
|---|---|---|---|---|
| `list_contact_logs` | Read | CO-3 | 82 | Messaging channels (mapped) |
| `create_contact_log` | Write, *live only* | CO-3 | 0 | Messaging channels (mapped) |

## Beta defects to test against

Tracked in Linear or listed in the beta Knowledge Brief §4. An experience whose flow needs one of these capabilities adds the matching eval case.

| Beta defect | Outcomes | Requirement for the Neuro capability |
|---|---|---|
| `list_tasks` returns an empty response ([MCP-94](https://linear.app/dealpath/issue/MCP-94)) | CO-10, CO-15 | Listing an entity's tasks returns them |
| `create_task` needs a `phase_id` ([MCP-92](https://linear.app/dealpath/issue/MCP-92)) | CO-10 | Creating a task needs no identifier the agent cannot read |
| Filtering or reading `Current Phase` crashes on some records | CO-14 | Every record's current phase reads and filters without error |
| `search_listings` fails on the `status` filter | CO-2 | Listing search filters on status |
| Financial model versions carry no "current" flag | CO-6 | A model's current version is marked |
| `batch_edit_field_values` skips the conditional-field check `update_field_value` makes | CO-1, CO-13 | Bulk and single field writes apply the same conditional-field check |
| Filters silently dropped, state abbreviations rejected, only `gte`/`lte` accepted | All | Field lookup resolves fields and options before any filter |

## Changing this map

Change a tool's outcomes, add a tool or update a Neuro home by pull request, reviewed per [`decision-rights.md`](../decision-rights.md). Check an outcome added to the register against this map in the same change.
