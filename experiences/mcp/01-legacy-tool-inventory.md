# The legacy MCP tool catalogue

What the the_wall MCP server exposed before it moved to `dealpath/mcp`. Kept as a capability checklist: it is evidence of what customers actually asked an AI client to do, which is more useful than a guess when deciding what the Neuro surface should expose next.

**This is not a port list.** Each of these tools was a wrapper over one the_wall REST endpoint — legacy numeric ids, the legacy field model, that API's error envelope. The Neuro equivalents call domain operations in `@neuro/core` and take entity-type handles rather than ids, so they are new tools that serve the same intent, not translations. Restating them from the operation side is both less work and less wrong than porting the wrappers.

The grouping below is the legacy registry's own. `Neuro home` names where the capability lives or will live in this stack; **absent** means nothing covers it yet and it needs a decision, not just an implementation.

## Entities and fields

| Legacy tool | Neuro home |
| --- | --- |
| `get_entity` | `@neuro/core` operations — entity read |
| `search_entities` | `@neuro/core` operations + `docs/coreservices/search/` |
| `get_entity_associations` | type relations, `docs/coredata/entity-fields/17-type-relations-and-capabilities.md` |
| `get_entity_history` | the change log |
| `list_entity_types` | the type registry |
| `get_field_values_for_entities` | `@neuro/core` operations — field read |
| `list_fields`, `list_field_options` | the field-system descriptors |
| `get_entity_creation_requirements` | required-field descriptors |
| `create_entity`, `update_entity` | `@neuro/core` operations — entity write |
| `update_field_value`, `batch_edit_field_values` | `@neuro/core` operations — field write |
| `get_current_user` | the hydrated principal, already on the request context |
| `search_members` | the principal directory |

## Workflow and status

| Legacy tool | Neuro home |
| --- | --- |
| `list_transitions` | `docs/coreservices/flow/` |
| `update_record_status`, `update_record_workflow` | `docs/coreservices/flow/` |

## Tasks

The legacy surface spent a third of its tools here, several of them narrow variants of one write. `docs/coreservices/flow/05-work-items.md` is the Neuro model.

| Legacy tool | Neuro home |
| --- | --- |
| `list_tasks`, `search_tasks`, `get_task`, `get_task_blockers` | `docs/coreservices/flow/05-work-items.md` |
| `create_task`, `update_task` | `docs/coreservices/flow/05-work-items.md` |
| `start_task`, `complete_task`, `update_task_status` | one status write, not three |
| `set_task_assignee`, `update_task_members` | task participants |
| `update_task_due_date`, `accept_due_date_link_chain` | due-date chains |
| `set_task_latest_update` | task activity |
| `set_task_info_field`, `add_task_info_field` | the field system, not a task-specific path |
| `add_checklist_item`, `update_checklist_item`, `delete_checklist_item` | checklists |

## Documents and files

| Legacy tool | Neuro home |
| --- | --- |
| `list_entity_documents`, `get_document_download_url` | `docs/coreservices/documents/` + `@neuro/storage` |
| `list_task_files`, `attach_document_to_task`, `detach_document_from_task` | `docs/coreservices/documents/` |
| `get_task_file_upload_token`, `upload_task_file`, `download_task_file` | presigned S3 uploads, `@neuro/storage` |
| `get_box_upload_token` | **absent** — Box.com ingest, `docs/reference/modernization/11-aix-integration.md` |

## Financial models

No Neuro equivalent exists for any of these, and the model itself has not been designed. Flagged as a group rather than row by row.

`get_financial_model_template_for_entity`, `list_financial_model_templates`, `list_financial_model_versions`, `attach_financial_model`, `create_financial_model`, `create_financial_model_version`, `update_financial_model_version`, `set_selected_financial_model_version`, `create_excel_import` — **all absent.**

## Comps and listings

Backed by Essos, a separate legacy service, so these were never the_wall reads.

| Legacy tool | Neuro home |
| --- | --- |
| `get_external_comp`, `search_rca_comps` | **absent** — comp analytics |
| `search_listings`, `get_listing`, `list_listing_filters` | **absent** — listings |

## Contact logs

| Legacy tool | Neuro home |
| --- | --- |
| `list_contact_logs` | `docs/coreservices/messaging/channels/` |

## What the shape of the list argues

**A tool per endpoint is the wrong granularity.** Sixty-one tools is a menu the model reads before every decision, and the task variants show why it grew that way: `start_task`, `complete_task` and `update_task_status` are one write with three names, and `set_task_info_field` duplicates the field system for one entity type. A Neuro surface that exposes operations rather than endpoints is smaller without covering less.

**Reads and writes are not symmetric in risk.** The legacy surface gated every write behind one `feature_access.mcp_write` flag — a single switch for "may this team's agents change anything". The authz plan replaces that with per-type, per-record authority the agent inherits from its authorizing user, which is finer and needs no separate flag.

**A third of the catalogue has no Neuro model yet.** Financial models, comps and listings are absent, not unbuilt — nothing has designed them. They are product decisions, and the legacy tool list is the evidence that customers used them.
