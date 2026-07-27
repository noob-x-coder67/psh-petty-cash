import { createHash } from "node:crypto";
import type { Readable } from "node:stream";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { AuditLogRepository } from "../../common/audit/audit-log.repository";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { ATTACHMENT_STORAGE, type AttachmentStorage } from "../../storage/storage.interface";
import { AttachmentsRepository } from "./attachments.repository";

// FR-DOC-001: JPG, JPEG, PNG and PDF only — matched against sniffed magic bytes, never
// the client-supplied MIME type or file extension.
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
export const UPLOAD_MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES ?? 2 * 1024 * 1024);

export interface UploadAttachmentInput {
  voucherId: string;
  originalName: string;
  bytes: Buffer;
  actor: AuthenticatedUser;
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly attachmentsRepository: AttachmentsRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly prisma: PrismaService,
    @Inject(ATTACHMENT_STORAGE) private readonly storage: AttachmentStorage,
  ) {}

  async upload(input: UploadAttachmentInput) {
    const voucher = await this.attachmentsRepository.findVoucherAccountUnit(input.voucherId);
    if (!voucher) {
      throw new NotFoundException(`Voucher ${input.voucherId} not found`);
    }
    this.assertUnitScope(voucher.account.unitId, input.actor);

    if (input.bytes.byteLength > UPLOAD_MAX_BYTES) {
      throw new BadRequestException(`File exceeds the ${UPLOAD_MAX_BYTES}-byte upload limit`);
    }

    // FR-DOC-002, Build Plan §6.4: magic-byte sniffing, not the client-supplied MIME
    // type or extension — an extension check alone accepts a renamed executable.
    const sniffed = await fileTypeFromBuffer(input.bytes);
    if (!sniffed || !ALLOWED_MIME_TYPES.has(sniffed.mime)) {
      throw new BadRequestException("File must be a JPG, PNG or PDF, verified by content");
    }

    let finalBytes = input.bytes;
    if (sniffed.mime === "image/jpeg" || sniffed.mime === "image/png") {
      // Re-encode to strip EXIF/embedded payloads (Build Plan §6.4). rotate() bakes in
      // any EXIF orientation before the metadata carrying it is discarded.
      const image = sharp(input.bytes).rotate();
      finalBytes = sniffed.mime === "image/jpeg" ? await image.jpeg().toBuffer() : await image.png().toBuffer();
    }

    const sha256 = createHash("sha256").update(finalBytes).digest("hex");
    const pageNo = (await this.attachmentsRepository.countActiveForVoucher(input.voucherId)) + 1;
    const locator = await this.storage.save(finalBytes, {
      voucherId: input.voucherId,
      fileName: input.originalName,
    });

    return this.prisma.$transaction(async (tx) => {
      const attachment = await this.attachmentsRepository.create(
        {
          voucherId: input.voucherId,
          driver: locator.driver,
          storageKey: locator.storageKey,
          data: locator.data,
          fileName: input.originalName,
          mimeType: sniffed.mime,
          sizeBytes: finalBytes.byteLength,
          sha256,
          pageNo,
          uploadedBy: input.actor.id,
        },
        tx,
      );

      await this.auditLogRepository.record(tx, {
        actorId: input.actor.id,
        actorRole: input.actor.roleKeys[0] ?? null,
        action: "ATTACHMENT_UPLOAD",
        entityType: "attachments",
        entityId: attachment.id,
        unitId: voucher.account.unitId,
        after: attachment,
      });

      return attachment;
    });
  }

  async openForView(
    attachmentId: string,
    actor: AuthenticatedUser,
  ): Promise<{ stream: Readable; fileName: string; mimeType: string }> {
    const attachment = await this.attachmentsRepository.findById(attachmentId);
    if (!attachment || attachment.deletedAt) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }
    this.assertUnitScope(attachment.voucher.account.unitId, actor);

    const stream = await this.storage.open({
      driver: attachment.driver,
      storageKey: attachment.storageKey,
      data: attachment.data ? Buffer.from(attachment.data) : null,
    });
    return { stream, fileName: attachment.fileName, mimeType: attachment.mimeType };
  }

  // No HTTP endpoint yet — the archive-confirmation-triggered eligible-deletion workflow
  // (ArchivesModule) is deferred until Month Close exists to supply "a completed month".
  // This proves the deletion *mechanism* itself: bytes go, metadata and the voucher stay.
  async deleteBytes(attachmentId: string, actor: AuthenticatedUser): Promise<void> {
    const attachment = await this.attachmentsRepository.findById(attachmentId);
    if (!attachment || attachment.deletedAt) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }
    this.assertUnitScope(attachment.voucher.account.unitId, actor);
    await this.storage.delete({
      driver: attachment.driver,
      storageKey: attachment.storageKey,
      data: attachment.data ? Buffer.from(attachment.data) : null,
    });
    await this.attachmentsRepository.softDelete(attachmentId, actor.id);
  }

  private assertUnitScope(unitId: string, actor: AuthenticatedUser): void {
    if (actor.unitScope.all) {
      return;
    }
    if (!actor.unitScope.unitIds.includes(unitId)) {
      throw new ForbiddenException("Attachment is outside your authorized scope");
    }
  }
}
