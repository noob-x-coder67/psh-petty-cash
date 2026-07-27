import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import type { AttachmentStorage, ArchiveResult, StorageLocator } from "./storage.interface";

// Production driver (FR-DOC-014): bytes live on private VPS disk, outside the web root,
// streamed only through the authenticated /attachments/:id/view|download endpoints —
// never a public/predictable path (FR-DOC-005). UPLOAD_ROOT must sit outside anything
// served statically.
const UPLOAD_ROOT = process.env.UPLOAD_ROOT ?? path.join(process.cwd(), "var", "attachments");

@Injectable()
export class FilesystemStorageDriver implements AttachmentStorage {
  async save(bytes: Buffer, metadata: { voucherId: string; fileName: string }): Promise<StorageLocator> {
    await this.scanForMalware(bytes);
    const key = `${metadata.voucherId}/${randomUUID()}-${metadata.fileName}`;
    const fullPath = path.join(UPLOAD_ROOT, key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, bytes);
    return { driver: "FILESYSTEM", storageKey: key, data: null };
  }

  async open(locator: StorageLocator): Promise<Readable> {
    if (!locator.storageKey) {
      throw new NotFoundException("Attachment bytes are not available");
    }
    return createReadStream(path.join(UPLOAD_ROOT, locator.storageKey));
  }

  async delete(locator: StorageLocator): Promise<void> {
    if (!locator.storageKey) {
      return;
    }
    await rm(path.join(UPLOAD_ROOT, locator.storageKey), { force: true });
  }

  async archive(): Promise<ArchiveResult> {
    return { status: "not_available" };
  }

  // Build Plan §6.4: "Malware-scan hook (ClamAV) in the production storage driver; a
  // no-op in demo, but the interface point exists from Phase 4 so adding it is not a
  // redesign." ClamAV itself is explicitly out of scope for this phase.
  private async scanForMalware(_bytes: Buffer): Promise<void> {
    // Intentionally empty until ClamAV is wired up.
  }
}
