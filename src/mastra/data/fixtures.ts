// Fixture Tenant data for the POC. Swap these reads for Neuro operations later;
// every tool goes through the functions at the bottom of this file.

export type Role = "DealLead" | "Analyst";

export type FieldType = "currency" | "percent" | "number" | "option" | "text";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  // Roles that can read the field. Omitted means every role can.
  visibleTo?: Role[];
}

export const dealFields: FieldDef[] = [
  { key: "property_type", label: "Property Type", type: "option", options: ["Multifamily", "Office", "Industrial", "Retail"] },
  { key: "market", label: "Market", type: "option", options: ["Austin", "Dallas", "Houston", "Denver"] },
  { key: "purchase_price", label: "Purchase Price", type: "currency" },
  { key: "asking_price", label: "Asking Price", type: "currency" },
  { key: "units", label: "Units", type: "number" },
  { key: "price_per_unit", label: "Price per Unit", type: "currency" },
  { key: "cap_rate", label: "Going-in Cap Rate", type: "percent" },
  { key: "occupancy", label: "Occupancy", type: "percent" },
  { key: "year_built", label: "Year Built", type: "number" },
  { key: "seller_reserve", label: "Seller Reserve Price", type: "currency", visibleTo: ["DealLead"] },
];

export type FieldValue = string | number | null;

export interface Deal {
  id: string;
  name: string;
  stage: string;
  fields: Record<string, FieldValue>;
}

export const deals: Deal[] = [
  {
    id: "D-1001",
    name: "Riverside Flats",
    stage: "Screening",
    fields: {
      property_type: "Multifamily",
      market: "Austin",
      purchase_price: 58_800_000,
      asking_price: null, // only in the offering memorandum, which the POC does not read
      units: 240,
      price_per_unit: 245_000,
      cap_rate: 5.4,
      occupancy: 93,
      year_built: 1998,
      seller_reserve: 56_000_000,
    },
  },
  {
    id: "D-1002",
    name: "Lamar Station",
    stage: "Screening",
    fields: {
      property_type: "Office",
      market: "Dallas",
      purchase_price: 31_500_000,
      asking_price: null,
      units: null,
      price_per_unit: null,
      cap_rate: 7.1,
      occupancy: 78,
      year_built: 2006,
      seller_reserve: null,
    },
  },
];

export interface Comp {
  id: string;
  name: string;
  market: string;
  property_type: string;
  sale_price: number;
  units: number | null;
  price_per_unit: number | null;
  cap_rate: number;
  sale_date: string;
}

export const comps: Comp[] = [
  { id: "C-201", name: "Mueller Lofts", market: "Austin", property_type: "Multifamily", sale_price: 46_800_000, units: 240, price_per_unit: 195_000, cap_rate: 5.6, sale_date: "2026-03-14" },
  { id: "C-202", name: "Barton Ridge", market: "Austin", property_type: "Multifamily", sale_price: 39_900_000, units: 190, price_per_unit: 210_000, cap_rate: 5.3, sale_date: "2026-01-22" },
  { id: "C-203", name: "East Sixth Commons", market: "Austin", property_type: "Multifamily", sale_price: 61_880_000, units: 260, price_per_unit: 238_000, cap_rate: 4.9, sale_date: "2025-11-05" },
  { id: "C-204", name: "Domain Terrace", market: "Austin", property_type: "Multifamily", sale_price: 63_800_000, units: 290, price_per_unit: 220_000, cap_rate: 5.0, sale_date: "2026-05-30" },
  { id: "C-205", name: "Riverside Gardens", market: "Austin", property_type: "Multifamily", sale_price: 36_900_000, units: 180, price_per_unit: 205_000, cap_rate: 5.5, sale_date: "2025-09-18" },
  // Only two Dallas office comps: the comparison must refuse (eval case 11).
  { id: "C-301", name: "Ross Tower Annex", market: "Dallas", property_type: "Office", sale_price: 28_000_000, units: null, price_per_unit: null, cap_rate: 7.4, sale_date: "2026-02-11" },
  { id: "C-302", name: "Cedar Springs Plaza", market: "Dallas", property_type: "Office", sale_price: 34_200_000, units: null, price_per_unit: null, cap_rate: 6.9, sale_date: "2025-12-03" },
];

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  focus: string[];
  canReadDeal: boolean;
}

export const dealTeams: Record<string, TeamMember[]> = {
  "D-1001": [
    { id: "U-1", name: "Dana Kim", role: "DealLead", focus: ["overall"], canReadDeal: true },
    { id: "U-2", name: "Raj Patel", role: "Analyst", focus: ["pricing", "cap rate", "comps"], canReadDeal: true },
    { id: "U-3", name: "Ana Ortiz", role: "Asset Manager", focus: ["occupancy", "physical condition", "year built"], canReadDeal: true },
    // Still on the team but lost access to the deal: never assign (eval case 9).
    { id: "U-4", name: "Sam Reed", role: "Legal", focus: ["title", "documents"], canReadDeal: false },
  ],
  "D-1002": [
    { id: "U-1", name: "Dana Kim", role: "DealLead", focus: ["overall"], canReadDeal: true },
    { id: "U-2", name: "Raj Patel", role: "Analyst", focus: ["pricing", "cap rate", "comps"], canReadDeal: true },
  ],
};

// The Tenant's people. A memo goes to the DealLead's manager for approval in Flow.
export interface User {
  id: string;
  name: string;
  role: Role | "Approver";
  managerId?: string;
}

export const users: User[] = [
  { id: "U-1", name: "Dana Kim", role: "DealLead", managerId: "U-9" },
  { id: "U-2", name: "Raj Patel", role: "Analyst", managerId: "U-1" },
  { id: "U-9", name: "Morgan Lee", role: "Approver" },
];

export function findUser(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

// ---- Reads. Each applies the caller's visibility, the way the deal page does. ----

export function findDeal(idOrName: string): Deal | undefined {
  const q = idOrName.trim().toLowerCase();
  return deals.find((d) => d.id.toLowerCase() === q || d.name.toLowerCase() === q)
    ?? deals.find((d) => d.name.toLowerCase().includes(q));
}

export function canSee(field: FieldDef, role: Role): boolean {
  return !field.visibleTo || field.visibleTo.includes(role);
}

export function visibleFields(role: Role): FieldDef[] {
  return dealFields.filter((f) => canSee(f, role));
}

// The deal's value for a field as this role sees it: null when absent or hidden.
export function readValue(deal: Deal, key: string, role: Role): FieldValue {
  const def = dealFields.find((f) => f.key === key);
  if (!def || !canSee(def, role)) return null;
  return deal.fields[key] ?? null;
}

// ---- Accepted field values. Only a DealLead's acceptance of a proposal sets one
// (foundation/proposals.ts); the store re-applies them at start-up. ----

const originalFields = new Map(deals.map((d) => [d.id, { ...d.fields }]));

export function setFieldValue(dealId: string, key: string, value: FieldValue) {
  const deal = deals.find((d) => d.id === dealId);
  if (deal) deal.fields[key] = value;
}

// For tests: the fixtures as shipped.
export function restoreFixtures() {
  for (const d of deals) d.fields = { ...originalFields.get(d.id)! };
}

// A value as the field's type expects it, or why it can't be.
export function coerceValue(field: FieldDef, raw: string | number): { ok: true; value: string | number } | { ok: false; message: string } {
  if (field.type === "option") {
    const option = field.options?.find((o) => o.toLowerCase() === String(raw).trim().toLowerCase());
    return option ? { ok: true, value: option } : { ok: false, message: `${field.label} must be one of: ${field.options?.join(", ")}.` };
  }
  if (field.type === "text") return { ok: true, value: String(raw).trim() };
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, message: `${field.label} needs a number, not "${raw}".` };
}
