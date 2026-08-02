import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type ReportPreset as PrismaReportPreset } from "@prisma/client";
import {
  ReportFilterSchema,
  type CreatePresetRequest,
  type ReportKey,
  type ReportPreset,
} from "@psh/contracts";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PresetsRepository } from "./presets.repository";

function toContractShape(row: PrismaReportPreset): ReportPreset {
  return {
    id: row.id,
    userId: row.userId,
    reportKey: row.reportKey as ReportKey,
    name: row.name,
    // Phase 1 migrated every live legacy `category` value to `categoryId`. Parse on
    // reads as well as writes so an unmigrated/stale preset cannot be silently applied.
    filters: ReportFilterSchema.parse(row.filters),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class PresetsService {
  constructor(private readonly presetsRepository: PresetsRepository) {}

  async create(input: CreatePresetRequest, user: AuthenticatedUser): Promise<ReportPreset> {
    try {
      const created = await this.presetsRepository.create({
        userId: user.id,
        reportKey: input.reportKey,
        name: input.name,
        filters: input.filters,
      });
      return toContractShape(created);
    } catch (error) {
      // uq_preset_user_report_name — a friendlier 409 than a raw constraint-violation 500.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException(`A preset named "${input.name}" already exists for this report`);
      }
      throw error;
    }
  }

  async listForUser(user: AuthenticatedUser, reportKey?: string): Promise<ReportPreset[]> {
    const rows = await this.presetsRepository.listForUser(user.id, reportKey);
    return rows.map(toContractShape);
  }

  async delete(id: string, user: AuthenticatedUser): Promise<void> {
    const preset = await this.presetsRepository.findById(id);
    if (!preset) {
      throw new NotFoundException(`Preset ${id} not found`);
    }
    // Presets are strictly per-user (SRS §12.8 "saved presets per Finance user") — unlike
    // exports, there's no all-scope-role exception; nobody manages another user's presets.
    if (preset.userId !== user.id) {
      throw new ForbiddenException("This preset belongs to another user");
    }
    await this.presetsRepository.delete(id);
  }
}
