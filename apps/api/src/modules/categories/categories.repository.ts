import { Injectable } from "@nestjs/common";
import { Prisma, type ExpenseCategory } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

type Client = PrismaService | Prisma.TransactionClient;

export type ExpenseCategoryRule = Pick<
  ExpenseCategory,
  "id" | "name" | "requiresExplanation" | "isActive"
>;

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(includeInactive: boolean, client: Client = this.prisma): Promise<ExpenseCategory[]> {
    return client.expenseCategory.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async findById(id: string, client: Client = this.prisma): Promise<ExpenseCategory | null> {
    return client.expenseCategory.findUnique({ where: { id } });
  }

  async findByName(name: string, client: Client = this.prisma): Promise<ExpenseCategory | null> {
    return client.expenseCategory.findUnique({ where: { name } });
  }

  async lockRulesForExpenseCreation(
    ids: string[],
    client: Prisma.TransactionClient,
  ): Promise<ExpenseCategoryRule[]> {
    if (ids.length === 0) return [];

    // A SHARE row lock keeps category activation/rule metadata stable until the voucher
    // commits. Admin category mutations take a conflicting lock, closing the check/write
    // race without serializing expense creators against one another.
    const idList = Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));
    return client.$queryRaw<ExpenseCategoryRule[]>(Prisma.sql`
      SELECT
        id,
        name,
        requires_explanation AS "requiresExplanation",
        is_active AS "isActive"
      FROM expense_categories
      WHERE id IN (${idList})
      FOR SHARE
    `);
  }

  async lockOrdering(client: Prisma.TransactionClient): Promise<void> {
    // Serializes create/rename/reorder rank calculations. No row exists to lock before
    // the first category is created, so a table lock is the only race-free primitive.
    await client.$executeRawUnsafe("LOCK TABLE expense_categories IN SHARE ROW EXCLUSIVE MODE");
  }

  async shiftAtOrAfter(sortOrder: number, client: Prisma.TransactionClient): Promise<void> {
    await client.expenseCategory.updateMany({
      where: { sortOrder: { gte: sortOrder } },
      data: { sortOrder: { increment: 1 } },
    });
  }

  async create(name: string, sortOrder: number, client: Prisma.TransactionClient): Promise<ExpenseCategory> {
    return client.expenseCategory.create({ data: { name, sortOrder } });
  }

  async update(
    id: string,
    data: { name?: string; isActive?: boolean },
    client: Prisma.TransactionClient,
  ): Promise<ExpenseCategory> {
    return client.expenseCategory.update({ where: { id }, data });
  }

  async updateSortOrder(id: string, sortOrder: number, client: Prisma.TransactionClient): Promise<void> {
    await client.expenseCategory.update({ where: { id }, data: { sortOrder } });
  }
}
