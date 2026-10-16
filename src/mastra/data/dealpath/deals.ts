import { acceptedValues, deals, findDeal, useDealpathFields, type Deal, type FieldDef, type FieldType, type FieldValue } from "../fixtures";
import { callDealpath, DealpathNotConnected, hasTokens } from "./client";

// Brings a Dealpath deal into the deal table the tools read, the first time a
// tool asks for it. Its fields keep their Dealpath names, so every value cites
// the field the DealLead sees in Dealpath. Dealpath applies the signed-in User's
// permissions, so a field they cannot read never arrives.

export const DEALPATH_PREFIX = "DP-";

// Field definitions met so far, by Dealpath name. The Tenant has over a thousand
// deal fields, so they are looked up by search, never listed whole.
const knownFields = new Map<string, FieldDef>();

export function dealpathField(name: string): FieldDef | undefined {
  return knownFields.get(name.toLowerCase());
}
useDealpathFields(dealpathField);

function typeOf(dataType?: string, subtype?: string): FieldType {
  if (dataType === "number" || dataType === "formula") {
    if (subtype === "percentage") return "percent";
    if (subtype === "dollars") return "currency";
    return "number";
  }
  if (dataType === "list") return "option";
  return "text";
}

function remember(def: FieldDef) {
  if (!knownFields.has(def.key.toLowerCase())) knownFields.set(def.key.toLowerCase(), def);
}

// "$4721126" → 4721126, "100.0%" → 100, "499590 sqft" → 499590, ["A","B"] → "A, B".
export function normalize(raw: unknown): { value: FieldValue; type: FieldType } {
  if (raw === null || raw === undefined) return { value: null, type: "text" };
  if (Array.isArray(raw)) return raw.length ? { value: raw.map(String).join(", "), type: "option" } : { value: null, type: "option" };
  if (typeof raw === "number") return { value: raw, type: "number" };
  const s = String(raw).trim();
  if (s === "") return { value: null, type: "text" };
  const m = /^(-?)\$?\s*([\d,]*\.?\d+)\s*(%|sqft|sf|years?)?$/i.exec(s);
  if (m) {
    const n = Number(`${m[1]}${m[2].replace(/,/g, "")}`);
    const type: FieldType = s.includes("$") ? "currency" : m[3] === "%" ? "percent" : "number";
    return { value: n, type };
  }
  return { value: s, type: "text" };
}

function toDeal(entity: any): Deal {
  const fields: Record<string, FieldValue> = {};
  const fieldDefs: FieldDef[] = [];
  for (const f of entity.fields ?? []) {
    const { value, type } = normalize(f.value);
    if (value === null) continue;
    fields[f.name] = value;
    const def = dealpathField(f.name) ?? { key: f.name, label: f.name, type };
    fieldDefs.push(def);
    remember(def);
  }
  return {
    id: `${DEALPATH_PREFIX}${entity.entity_id}`,
    name: entity.name,
    stage: String(fields["Deal Status"] ?? fields["Current Phase"] ?? "Unknown"),
    fields,
    origin: { system: "dealpath", id: Number(entity.entity_id), workflow: entity.workflow?.standard_workflow_type },
    fieldDefs,
  };
}

export async function importDeal(dealpathId: number): Promise<Deal> {
  const entity = await callDealpath("get_entity", { entity_type: "Deal", entity_id: dealpathId });
  const deal = toDeal(entity);
  // Values accepted in this app sit on top of Dealpath's until Neuro writes them back.
  deal.fields = { ...deal.fields, ...acceptedValues.get(deal.id) };
  const at = deals.findIndex((d) => d.id === deal.id);
  if (at >= 0) deals[at] = deal;
  else deals.push(deal);
  return deal;
}

export type DealLookup =
  | { status: "found"; deal: Deal }
  | { status: "choose"; candidates: { id: string; name: string; workflow?: string }[] }
  | { status: "none"; message: string };

// A deal by id or name: the sandbox deals first, then Dealpath.
export async function lookupDeal(query: string): Promise<DealLookup> {
  const local = findDeal(query);
  if (local) {
    if (local.origin && !local.fieldDefs) return { status: "found", deal: await importDeal(local.origin.id) };
    return { status: "found", deal: local };
  }
  if (!hasTokens()) return { status: "none", message: `No sandbox deal matches "${query}", and Dealpath is not connected (open /poc/dealpath/connect).` };

  const id = /^(?:DP-)?(\d{5,})$/i.exec(query.trim())?.[1];
  if (id) return { status: "found", deal: await importDeal(Number(id)) };

  const found = await callDealpath("search_entities", {
    entity_type: "Deal",
    filters: [{ field: "Deal Name", operator: "contains", value: query.trim() }],
    include_workflow_type: true,
    entity_ids_only: true,
    limit: 10,
  });
  const matches: { id: number; name: string; workflow?: { standard_workflow_type?: string } }[] = found.entities ?? [];
  if (matches.length === 0) return { status: "none", message: `No deal in Dealpath has a name containing "${query}".` };
  if (matches.length === 1) return { status: "found", deal: await importDeal(matches[0].id) };
  return {
    status: "choose",
    candidates: matches.map((m) => ({ id: `${DEALPATH_PREFIX}${m.id}`, name: m.name, workflow: m.workflow?.standard_workflow_type })),
  };
}

// The deal a tool was given, loading it from Dealpath when it is not loaded yet.
export async function ensureDeal(idOrName: string): Promise<Deal | undefined> {
  try {
    const result = await lookupDeal(idOrName);
    return result.status === "found" ? result.deal : undefined;
  } catch (err) {
    if (err instanceof DealpathNotConnected) return undefined;
    throw err;
  }
}

// Dealpath deal fields whose names match the criteria's words. Each term is
// matched on its own, so one criterion's miss never hides another's hit.
export async function searchDealpathFields(terms: string[]): Promise<(FieldDef & { matchedTerms: string[]; semantic: boolean })[]> {
  const result = await callDealpath("list_fields", { entity_type: "Deal", searches: terms.slice(0, 20) });
  return (result.fields ?? []).map((f: any) => {
    const def: FieldDef = { key: f.name, label: f.name, type: typeOf(f.data_type, f.data_subtype) };
    remember(def);
    return { ...def, matchedTerms: f.matched_terms ?? [], semantic: f.match === "semantic" };
  });
}

export async function dealpathDocuments(dealpathId: number): Promise<{ id: string; name: string; type?: string; created?: string }[]> {
  const result = await callDealpath("list_entity_documents", { entity_id: dealpathId });
  return (result.documents ?? []).map((d: any) => ({
    id: `DPDOC-${d.id}`,
    name: d.name,
    type: d.file_type ?? d.type,
    created: d.created_at ?? d.created,
  }));
}

// A Dealpath document's bytes. Text files come back as text, others as base64.
export async function dealpathDocumentBytes(documentId: number): Promise<{ name: string; bytes: Uint8Array; mime?: string }> {
  const result = await callDealpath("download_document", { document_id: documentId });
  const content: string = result.content ?? result.data ?? "";
  const encoding: string | undefined = result.encoding;
  const bytes = encoding === "base64" || !/^[\x09\x0a\x0d\x20-\x7e]*$/.test(content.slice(0, 200))
    ? Uint8Array.from(Buffer.from(content, "base64"))
    : new TextEncoder().encode(content);
  return { name: result.name ?? result.file_name ?? `Document ${documentId}`, bytes, mime: result.mime_type ?? result.content_type };
}
