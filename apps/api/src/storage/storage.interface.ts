import type { Readable } from "node:stream";

export type StorageDriverKey = "POSTGRES_BYTEA" | "FILESYSTEM";

// What the AttachmentsRepository stores on the `attachments` row — never both driver
// modes populated at once (ck_attachment_bytes_pair enforces this in the database too).
export interface StorageLocator {
  driver: StorageDriverKey;
  storageKey: string | null;
  data: Buffer | null;
}

export interface ArchiveResult {
  status: "not_available";
}

// SRS §20.3's literal contract is `open(id, userContext)`/`delete(id, authorization)` —
// deliberately narrowed here to operate on a StorageLocator instead of a bare id, so the
// driver only ever handles bytes and never needs to know about vouchers, units or RBAC.
// Authorization (does this user have unit scope over this attachment's voucher) stays in
// AttachmentsService, matching the assertUnitScope pattern already used by ExpensesService.
export interface AttachmentStorage {
  // scopeKey namespaces the storage path (e.g. a voucher id for receipts, a report
  // export id for generated PDF/Excel/CSV files) — it isn't specific to attachments,
  // this interface is the one storage seam for every kind of stored file (rule 18).
  save(bytes: Buffer, metadata: { scopeKey: string; fileName: string }): Promise<StorageLocator>;
  open(locator: StorageLocator): Promise<Readable>;
  delete(locator: StorageLocator): Promise<void>;
  archive(month: string, scope: string): Promise<ArchiveResult>;
}

export const ATTACHMENT_STORAGE = Symbol("ATTACHMENT_STORAGE");
