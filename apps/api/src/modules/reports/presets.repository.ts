import { Injectable } from "@nestjs/common";
import type { Prisma, ReportPreset } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

export interface CreatePresetParams {
  userId: string;
  reportKey: string;
  name: string;
  filters: unknown;
}

@Injectable()
export class PresetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreatePresetParams): Promise<ReportPreset> {
    return this.prisma.reportPreset.create({
      data: {
        userId: params.userId,
        reportKey: params.reportKey,
        name: params.name,
        filters: params.filters as Prisma.InputJsonValue,
      },
    });
  }

  async listForUser(userId: string, reportKey?: string): Promise<ReportPreset[]> {
    return this.prisma.reportPreset.findMany({
      where: { userId, reportKey },
      orderBy: { name: "asc" },
    });
  }

  async findById(id: string): Promise<ReportPreset | null> {
    return this.prisma.reportPreset.findUnique({ where: { id } });
  }

  // report_presets is user-preference data, not a financial/audit record (rule 9 scopes
  // "no hard deletion" to those specifically) — a real DELETE, not a soft-delete or
  // compensating entry, per the Phase 6a migration's own comment on this table.
  async delete(id: string): Promise<void> {
    await this.prisma.reportPreset.delete({ where: { id } });
  }
}
