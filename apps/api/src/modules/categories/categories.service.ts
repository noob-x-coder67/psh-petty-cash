import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { ExpenseCategory, Prisma } from "@prisma/client";
import type {
  CreateExpenseCategoryRequest,
  ReorderExpenseCategoriesRequest,
  UpdateExpenseCategoryRequest,
} from "@psh/contracts";
import { AuditLogRepository } from "../../common/audit/audit-log.repository";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CategoriesRepository } from "./categories.repository";

const alphabeticalCollator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly prisma: PrismaService,
  ) {}

  async list(includeInactive = false): Promise<ExpenseCategory[]> {
    return this.categoriesRepository.list(includeInactive);
  }

  async create(input: CreateExpenseCategoryRequest, actor: AuthenticatedUser): Promise<ExpenseCategory> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.categoriesRepository.lockOrdering(tx);

        const existing = await this.categoriesRepository.findByName(input.name, tx);
        if (existing) {
          throw new ConflictException(`Category ${input.name} already exists`);
        }

        const categories = await this.categoriesRepository.list(true, tx);
        const insertAt =
          categories.filter((category) => alphabeticalCollator.compare(category.name, input.name) < 0).length + 1;
        await this.categoriesRepository.shiftAtOrAfter(insertAt, tx);
        const created = await this.categoriesRepository.create(input.name, insertAt, tx);

        // Alphabetical is the required default. A deliberate custom order is a bonus
        // capability, but adding a new category always re-establishes the full A-Z list
        // rather than trying to splice one alphabetical rank into an arbitrary order.
        await this.normalizeAlphabeticalOrder(tx);
        const after = (await this.categoriesRepository.findById(created.id, tx))!;

        await this.auditLogRepository.record(tx, {
          actorId: actor.id,
          actorRole: actor.roleKeys[0] ?? null,
          action: "CATEGORY_CREATE",
          entityType: "expense_categories",
          entityId: created.id,
          unitId: null,
          after,
        });
        return after;
      });
    } catch (error: unknown) {
      // The CITEXT unique constraint is the concurrency-safe final defense. Convert its
      // Prisma error to the same stable 409 returned by the friendly pre-check above.
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(`Category ${input.name} already exists`);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateExpenseCategoryRequest, actor: AuthenticatedUser): Promise<ExpenseCategory> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.categoriesRepository.lockOrdering(tx);
        const before = await this.categoriesRepository.findById(id, tx);
        if (!before) {
          throw new NotFoundException(`Category ${id} not found`);
        }

        if (input.name && input.name.toLocaleLowerCase("en") !== before.name.toLocaleLowerCase("en")) {
          const duplicate = await this.categoriesRepository.findByName(input.name, tx);
          if (duplicate && duplicate.id !== id) {
            throw new ConflictException(`Category ${input.name} already exists`);
          }
        }

        const updated = await this.categoriesRepository.update(id, input, tx);

        // A rename re-establishes the default A-Z order. Finance can deliberately apply
        // a custom order again through the explicit reorder route afterward.
        if (input.name !== undefined && input.name !== before.name) {
          await this.normalizeAlphabeticalOrder(tx);
        }
        const after = (await this.categoriesRepository.findById(id, tx))!;

        await this.auditLogRepository.record(tx, {
          actorId: actor.id,
          actorRole: actor.roleKeys[0] ?? null,
          action: "CATEGORY_UPDATE",
          entityType: "expense_categories",
          entityId: id,
          unitId: null,
          before,
          after,
        });
        return { ...updated, sortOrder: after.sortOrder };
      });
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(`Category ${input.name ?? id} already exists`);
      }
      throw error;
    }
  }

  async reorder(input: ReorderExpenseCategoriesRequest, actor: AuthenticatedUser): Promise<ExpenseCategory[]> {
    const uniqueIds = new Set(input.categoryIds);
    if (uniqueIds.size !== input.categoryIds.length) {
      throw new BadRequestException("categoryIds must not contain duplicates");
    }

    return this.prisma.$transaction(async (tx) => {
      await this.categoriesRepository.lockOrdering(tx);
      const before = await this.categoriesRepository.list(true, tx);
      const existingIds = new Set(before.map((category) => category.id));
      if (
        existingIds.size !== input.categoryIds.length ||
        input.categoryIds.some((categoryId) => !existingIds.has(categoryId))
      ) {
        throw new BadRequestException("categoryIds must contain every category exactly once");
      }

      for (const [index, categoryId] of input.categoryIds.entries()) {
        await this.categoriesRepository.updateSortOrder(categoryId, index + 1, tx);
      }
      const after = await this.categoriesRepository.list(true, tx);

      await this.auditLogRepository.record(tx, {
        actorId: actor.id,
        actorRole: actor.roleKeys[0] ?? null,
        action: "CATEGORY_REORDER",
        entityType: "expense_categories",
        // audit_logs.entity_id is UUID. Anchor this collection mutation to the first
        // category in the submitted order; the complete affected set is in before/after.
        entityId: input.categoryIds[0]!,
        unitId: null,
        before: before.map(({ id, name, sortOrder }) => ({ id, name, sortOrder })),
        after: after.map(({ id, name, sortOrder }) => ({ id, name, sortOrder })),
      });
      return after;
    });
  }

  async restoreAlphabetical(actor: AuthenticatedUser): Promise<ExpenseCategory[]> {
    return this.prisma.$transaction(async (tx) => {
      await this.categoriesRepository.lockOrdering(tx);
      const before = await this.categoriesRepository.list(true, tx);
      if (before.length === 0) {
        throw new BadRequestException("At least one category is required");
      }

      await this.normalizeAlphabeticalOrder(tx);
      const after = await this.categoriesRepository.list(true, tx);

      await this.auditLogRepository.record(tx, {
        actorId: actor.id,
        actorRole: actor.roleKeys[0] ?? null,
        action: "CATEGORY_REORDER",
        entityType: "expense_categories",
        entityId: after[0]!.id,
        unitId: null,
        before: before.map(({ id, name, sortOrder }) => ({ id, name, sortOrder })),
        after: after.map(({ id, name, sortOrder }) => ({ id, name, sortOrder })),
        diff: { mode: "ALPHABETICAL" },
      });
      return after;
    });
  }

  private async normalizeAlphabeticalOrder(tx: Prisma.TransactionClient): Promise<void> {
    const categories = await this.categoriesRepository.list(true, tx);
    categories.sort((left, right) => alphabeticalCollator.compare(left.name, right.name));
    for (const [index, category] of categories.entries()) {
      if (category.sortOrder !== index + 1) {
        await this.categoriesRepository.updateSortOrder(category.id, index + 1, tx);
      }
    }
  }
}
