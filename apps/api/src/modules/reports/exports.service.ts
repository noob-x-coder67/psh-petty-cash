import type { Readable } from "node:stream";
import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ReportExport, ReportExportFormat } from "@prisma/client";
import type { CreateExportRequest, ExportStatusResponse, ReportKey } from "@psh/contracts";
import { AuditLogRepository } from "../../common/audit/audit-log.repository";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { ATTACHMENT_STORAGE, type AttachmentStorage } from "../../storage/storage.interface";
import { buildCsv } from "./exports/csv-builder";
import { buildExcelBuffer } from "./exports/excel-builder";
import { buildPdfBuffer } from "./exports/pdf-builder";
import { retryTransientPrismaRead } from "./exports/transient-prisma-retry";
import { ExportsRepository } from "./exports.repository";
import { ReportsService } from "./reports.service";

// Every report reports.service.ts implements, as of Phase 7 (RPT-09/10 built per
// ADR-0003 once monthly_closings existed) — all 16 RPT-* keys now have a real dataset.
const EXPORTABLE_REPORT_KEYS: ReadonlySet<string> = new Set([
  "RPT-01",
  "RPT-02",
  "RPT-03",
  "RPT-04",
  "RPT-05",
  "RPT-06",
  "RPT-07",
  "RPT-08",
  "RPT-09",
  "RPT-10",
  "RPT-11",
  "RPT-12",
  "RPT-13",
  "RPT-14",
  "RPT-15",
  "RPT-16",
]);

interface FormatMeta {
  mimeType: string;
  extension: string;
}

const FORMAT_META: Record<ReportExportFormat, FormatMeta> = {
  CSV: { mimeType: "text/csv", extension: "csv" },
  EXCEL: { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx" },
  PDF: { mimeType: "application/pdf", extension: "pdf" },
};

@Injectable()
export class ExportsService {
  constructor(
    private readonly exportsRepository: ExportsRepository,
    private readonly reportsService: ReportsService,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly prisma: PrismaService,
    @Inject(ATTACHMENT_STORAGE) private readonly storage: AttachmentStorage,
  ) {}

  async createExport(input: CreateExportRequest & { actor: AuthenticatedUser }): Promise<ExportStatusResponse> {
    if (!EXPORTABLE_REPORT_KEYS.has(input.reportKey)) {
      throw new ConflictException(`${input.reportKey} does not have an export pipeline yet`);
    }

    // Build Plan §3.7: the endpoint returns { exportId, status } immediately and
    // generates the file afterward — this is what makes it "asynchronous-capable now"
    // even though, in this single-process demo, generation runs in-process rather than
    // on a real queue (a backend-only change later, per ADR-0002).
    const exportRow = await this.prisma.$transaction(async (tx) => {
      const created = await this.exportsRepository.create(
        {
          reportKey: input.reportKey,
          filters: input.filters,
          format: input.format,
          generatedBy: input.actor.id,
        },
        tx,
      );
      await this.auditLogRepository.record(tx, {
        actorId: input.actor.id,
        actorRole: input.actor.roleKeys[0] ?? null,
        action: "REPORT_EXPORT_REQUESTED",
        entityType: "report_exports",
        entityId: created.id,
        unitId: null,
        after: { reportKey: input.reportKey, format: input.format, filters: input.filters },
      });
      return created;
    });

    // Fire-and-forget: the HTTP response doesn't wait on this. Failures are caught and
    // recorded as a FAILED row (surfaced to the poller), never an unhandled rejection.
    void this.generate(exportRow.id, input.reportKey, input.filters, input.actor).catch(async (error: unknown) => {
      await this.exportsRepository.markFailed(
        exportRow.id,
        error instanceof Error ? error.message : "Export generation failed",
      );
    });

    return this.toStatusResponse(exportRow);
  }

  async getStatus(id: string, user: AuthenticatedUser): Promise<ExportStatusResponse> {
    const exportRow = await this.exportsRepository.findById(id);
    if (!exportRow) {
      throw new NotFoundException(`Export ${id} not found`);
    }
    this.assertOwnership(exportRow, user);
    return this.toStatusResponse(exportRow);
  }

  async download(id: string, user: AuthenticatedUser): Promise<{ stream: Readable; fileName: string; mimeType: string }> {
    const exportRow = await this.exportsRepository.findById(id);
    if (!exportRow) {
      throw new NotFoundException(`Export ${id} not found`);
    }
    this.assertOwnership(exportRow, user);
    if (exportRow.status !== "READY" || !exportRow.driver || !exportRow.fileName || !exportRow.mimeType) {
      throw new ConflictException(`Export ${id} is not ready for download (status: ${exportRow.status})`);
    }

    const stream = await this.storage.open({
      driver: exportRow.driver,
      storageKey: exportRow.storageKey,
      data: exportRow.data ? Buffer.from(exportRow.data) : null,
    });
    await this.exportsRepository.markDownloaded(id);
    return { stream, fileName: exportRow.fileName, mimeType: exportRow.mimeType };
  }

  private async generate(
    exportId: string,
    reportKey: ReportKey,
    filters: CreateExportRequest["filters"],
    actor: AuthenticatedUser,
  ): Promise<void> {
    const response = await retryTransientPrismaRead(() => this.reportsService.getReport(reportKey, filters, actor));
    const exportRow = await this.exportsRepository.findById(exportId);
    const format = exportRow?.format ?? "CSV";
    const meta = FORMAT_META[format];

    let buffer: Buffer;
    switch (format) {
      case "CSV":
        buffer = Buffer.from(buildCsv(response), "utf-8");
        break;
      case "EXCEL":
        buffer = await buildExcelBuffer(response);
        break;
      case "PDF":
        buffer = await buildPdfBuffer(response);
        break;
    }

    const fileName = `${reportKey}_${new Date().toISOString().slice(0, 10)}.${meta.extension}`;
    const locator = await this.storage.save(buffer, { scopeKey: exportId, fileName });
    await this.exportsRepository.markReady(exportId, {
      driver: locator.driver,
      storageKey: locator.storageKey,
      data: locator.data,
      fileName,
      mimeType: meta.mimeType,
      sizeBytes: buffer.byteLength,
      rowCount: response.rows.length,
    });
  }

  private assertOwnership(exportRow: ReportExport, user: AuthenticatedUser): void {
    // Appendix A "Export reports": Own for Center User/In-Charge, All for Finance/
    // Auditor/Super Admin. An export blob has no unit of its own (its filters might
    // span several units), so "Own" is interpreted at the export-row level: your own
    // generated exports, or every export if your role carries all-unit scope.
    if (user.unitScope.all) {
      return;
    }
    if (exportRow.generatedBy !== user.id) {
      throw new ForbiddenException("This export was not generated by you");
    }
  }

  private toStatusResponse(exportRow: ReportExport): ExportStatusResponse {
    return {
      exportId: exportRow.id,
      status: exportRow.status,
      rowCount: exportRow.rowCount,
      fileRef: exportRow.fileName,
      errorMessage: exportRow.errorMessage,
    };
  }
}
