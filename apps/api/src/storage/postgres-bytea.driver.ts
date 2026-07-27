import { Readable } from "node:stream";
import { Injectable, NotFoundException } from "@nestjs/common";
import type { AttachmentStorage, ArchiveResult, StorageLocator } from "./storage.interface";

// Demo driver (FR-DOC-014): bytes live inline in the attachments row's `data` column.
// save() doesn't write anywhere itself — it just returns the locator the repository
// persists; delete() has nothing to do beyond that, since clearing `data` is the same
// UPDATE that sets deleted_at (AttachmentsRepository.softDelete), not a separate step.
@Injectable()
export class PostgresByteaStorageDriver implements AttachmentStorage {
  async save(bytes: Buffer): Promise<StorageLocator> {
    return { driver: "POSTGRES_BYTEA", storageKey: null, data: bytes };
  }

  async open(locator: StorageLocator): Promise<Readable> {
    if (!locator.data) {
      throw new NotFoundException("Attachment bytes are not available");
    }
    return Readable.from(locator.data);
  }

  async delete(): Promise<void> {
    // No-op — see class comment.
  }

  async archive(): Promise<ArchiveResult> {
    return { status: "not_available" };
  }
}
