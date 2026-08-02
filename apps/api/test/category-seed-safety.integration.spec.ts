import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedDatabase } from "../../../prisma/seed";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = new PrismaClient();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("normal database seed preserves Finance-managed categories", () => {
  it("does not overwrite a rename, deactivation, rule, or custom order", async () => {
    const before = await prisma.expenseCategory.findMany({ orderBy: { id: "asc" } });
    const target = before.find((category) => !category.requiresExplanation && category.isActive);
    if (!target) throw new Error("Expected an active standard category fixture");

    const financeName = `Finance managed ${target.id.slice(0, 8)}`;
    try {
      await prisma.expenseCategory.update({
        where: { id: target.id },
        data: { name: financeName, isActive: false, sortOrder: before.length + 100 },
      });
      const financeManagedState = await prisma.expenseCategory.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          requiresExplanation: true,
          isActive: true,
          sortOrder: true,
        },
      });

      await seedDatabase(prisma);

      const afterReseed = await prisma.expenseCategory.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          requiresExplanation: true,
          isActive: true,
          sortOrder: true,
        },
      });
      expect(afterReseed).toEqual(financeManagedState);
    } finally {
      for (const category of before) {
        await prisma.expenseCategory.update({
          where: { id: category.id },
          data: {
            name: category.name,
            requiresExplanation: category.requiresExplanation,
            isActive: category.isActive,
            sortOrder: category.sortOrder,
          },
        });
      }
    }
  });
});
