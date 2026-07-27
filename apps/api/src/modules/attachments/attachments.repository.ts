import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { StorageDriverKey } from "../../storage/storage.interface";

type Client = PrismaService | Prisma.TransactionClient;

export interface CreateAttachmentParams {
  voucherId: string;
  driver: StorageDriverKey;
  storageKey: string | null;
  data: Buffer | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  pageNo: number;
  uploadedBy: string;
}

export type AttachmentWithVoucherUnit = Prisma.AttachmentGetPayload<{
  include: { voucher: { include: { account: true } } };
}>;

@Injectable()
export class AttachmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findVoucherAccountUnit(voucherId: string) {
    return this.prisma.expenseVoucher.findUnique({
      where: { id: voucherId },
      select: { id: true, hasBill: true, accountId: true, account: { select: { unitId: true } } },
    });
  }

  async countActiveForVoucher(voucherId: string): Promise<number> {
    return this.prisma.attachment.count({ where: { voucherId, deletedAt: null } });
  }

  async create(params: CreateAttachmentParams, client: Client = this.prisma) {
    return client.attachment.create({
      data: { ...params, data: params.data ? Buffer.from(params.data) : null },
    });
  }

  async findById(id: string): Promise<AttachmentWithVoucherUnit | null> {
    return this.prisma.attachment.findUnique({
      where: { id },
      include: { voucher: { include: { account: true } } },
    });
  }

  // Bytes-only removal (FR-DOC-013, BR-015): clears both storage-location columns and
  // stamps deletion metadata, but the row itself is retained permanently — never a hard
  // DELETE (also enforced at the database level by the migration's REVOKE DELETE).
  async softDelete(id: string, deletedBy: string, client: Client = this.prisma) {
    return client.attachment.update({
      where: { id },
      data: { data: null, storageKey: null, deletedAt: new Date(), deletedBy },
    });
  }
}
