import { Injectable } from "@nestjs/common";
import type { Prisma, ReportExport, ReportExportFormat } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { StorageDriverKey } from "../../storage/storage.interface";

export interface CreateReportExportParams {
  reportKey: string;
  filters: unknown;
  format: ReportExportFormat;
  generatedBy: string;
}

export interface MarkReadyParams {
  driver: StorageDriverKey;
  storageKey: string | null;
  data: Buffer | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  rowCount: number;
}

@Injectable()
export class ExportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreateReportExportParams, tx: Prisma.TransactionClient = this.prisma): Promise<ReportExport> {
    return tx.reportExport.create({
      data: {
        reportKey: params.reportKey,
        filters: params.filters as Prisma.InputJsonValue,
        format: params.format,
        generatedBy: params.generatedBy,
      },
    });
  }

  async findById(id: string): Promise<ReportExport | null> {
    return this.prisma.reportExport.findUnique({ where: { id } });
  }

  async markReady(id: string, params: MarkReadyParams): Promise<ReportExport> {
    return this.prisma.reportExport.update({
      where: { id },
      data: {
        status: "READY",
        driver: params.driver,
        storageKey: params.storageKey,
        data: params.data ? Buffer.from(params.data) : null,
        fileName: params.fileName,
        mimeType: params.mimeType,
        sizeBytes: params.sizeBytes,
        rowCount: params.rowCount,
      },
    });
  }

  async markFailed(id: string, errorMessage: string): Promise<ReportExport> {
    return this.prisma.reportExport.update({
      where: { id },
      data: { status: "FAILED", errorMessage },
    });
  }

  async markDownloaded(id: string): Promise<ReportExport> {
    return this.prisma.reportExport.update({
      where: { id },
      data: { downloadedAt: new Date() },
    });
  }
}
