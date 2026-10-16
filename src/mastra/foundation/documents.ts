import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { dealpathDocumentBytes } from "../data/dealpath/deals";
import { DecisionError } from "./proposals";
import { newId, now, one, rows, run } from "./store";

// Documents an agent may read: an OM a person uploads in the app, or one
// attached to the deal in Dealpath. The agent reads page by page, so every value
// it offers cites its page. A document's text is data, never an instruction.

const uploadDir = () => process.env.POC_UPLOAD_DIR ?? join(homedir(), ".config", "mastra-agent-repo", "uploads");
const MAX_BYTES = 20 * 1024 * 1024;

export interface UploadedDocument {
  id: string;
  name: string;
  pages: number | null;
  uploadedBy: string;
  uploadedAt: string;
}

export async function saveUpload(tenantId: string, userId: string, name: string, base64: string): Promise<UploadedDocument> {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) throw new DecisionError("The file is empty.", 400);
  if (bytes.length > MAX_BYTES) throw new DecisionError("The file is over 20 MB.", 400);
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new DecisionError("Only PDF files can be read.", 400);
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const id = newId("DOC");
  mkdirSync(uploadDir(), { recursive: true });
  const path = join(uploadDir(), `${id}.pdf`);
  writeFileSync(path, bytes);
  const t = now();
  await run(
    `INSERT INTO poc_documents (id, tenant_id, name, mime, path, pages, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, name, "application/pdf", path, pdf.numPages, userId, t],
  );
  return { id, name, pages: pdf.numPages, uploadedBy: userId, uploadedAt: t };
}

export async function listUploads(tenantId: string): Promise<UploadedDocument[]> {
  const found = await rows<{ id: string; name: string; pages: number | null; uploaded_by: string; uploaded_at: string }>(
    `SELECT id, name, pages, uploaded_by, uploaded_at FROM poc_documents WHERE tenant_id = ? ORDER BY uploaded_at DESC`, [tenantId],
  );
  return found.map((d) => ({ id: d.id, name: d.name, pages: d.pages, uploadedBy: d.uploaded_by, uploadedAt: d.uploaded_at }));
}

export interface DocumentPages {
  id: string;
  name: string;
  pageCount: number;
  pages: { page: number; text: string }[];
  truncated: boolean;
}

const MAX_CHARS = 60_000;

// A document's text, one entry per page, from page `from` on.
export async function readDocumentPages(tenantId: string, documentId: string, from = 1): Promise<DocumentPages> {
  let name: string;
  let bytes: Uint8Array;
  const dealpathId = /^DPDOC-(\d+)$/.exec(documentId)?.[1];
  if (dealpathId) {
    const doc = await dealpathDocumentBytes(Number(dealpathId));
    name = doc.name;
    bytes = doc.bytes;
  } else {
    const row = await one<{ name: string; path: string }>(`SELECT name, path FROM poc_documents WHERE id = ? AND tenant_id = ?`, [documentId, tenantId]);
    if (!row) throw new DecisionError(`No document ${documentId}.`, 404);
    name = row.name;
    bytes = new Uint8Array(readFileSync(row.path));
  }
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  const pages: { page: number; text: string }[] = [];
  let used = 0;
  let truncated = false;
  for (let i = Math.max(1, from) - 1; i < text.length; i++) {
    const pageText = text[i].replace(/[ \t]+/g, " ").trim();
    if (used + pageText.length > MAX_CHARS) { truncated = true; break; }
    used += pageText.length;
    pages.push({ page: i + 1, text: pageText });
  }
  return { id: documentId, name, pageCount: text.length, pages, truncated };
}
