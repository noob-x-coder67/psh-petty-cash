import { randomUUID } from "node:crypto";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed-data";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

let app: INestApplication;
let prisma: PrismaService;
const sessions = new Map<string, string[]>();

function extractCookies(res: request.Response): string[] {
  const raw = res.headers["set-cookie"] as unknown;
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") return [raw];
  return [];
}

async function loginAs(email: string): Promise<string[]> {
  const cached = sessions.get(email);
  if (cached) return cached;
  const res = await request(app.getHttpServer()).post("/auth/login").send({ email, password: DEMO_PASSWORD }).expect(200);
  const cookies = extractCookies(res);
  sessions.set(email, cookies);
  return cookies;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.use(cookieParser());
  await app.init();
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app.close();
});

describe("expense-category reads", () => {
  it("a unit user can read active categories in persisted display order", async () => {
    const cookies = await loginAs("user.sohawa@psh.local");
    const res = await request(app.getHttpServer()).get("/expense-categories").set("Cookie", cookies).expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(24);
    expect(res.body.every((category: { isActive: boolean }) => category.isActive)).toBe(true);
    const ranks = res.body.map((category: { sortOrder: number }) => category.sortOrder);
    expect(ranks).toEqual([...ranks].sort((left, right) => left - right));
    expect(res.body.find((category: { name: string }) => category.name === "Miscellaneous")).toMatchObject({
      requiresExplanation: true,
    });
  });
});

describe("category.manage server-side permission gate", () => {
  it.each([
    "financeofficer@psh.local",
    "user.sohawa@psh.local",
    "auditor@psh.local",
  ])("%s gets 403 from the Administration API", async (email) => {
    const cookies = await loginAs(email);
    await request(app.getHttpServer()).get("/admin/categories").set("Cookie", cookies).expect(403);
    await request(app.getHttpServer())
      .post("/admin/categories")
      .set("Cookie", cookies)
      .send({ name: `Forbidden ${randomUUID()}` })
      .expect(403);
  });

  it("Finance Manager and Super Admin can read the full Administration list", async () => {
    for (const email of ["financemanager@psh.local", "superadmin@psh.local"]) {
      const cookies = await loginAs(email);
      const res = await request(app.getHttpServer()).get("/admin/categories").set("Cookie", cookies).expect(200);
      expect(res.body.some((category: { name: string }) => category.name === "Miscellaneous")).toBe(true);
    }
  });
});

describe("managed category lifecycle and audit trail", () => {
  const marker = randomUUID().slice(0, 8);
  const initialName = `Phase Two ${marker}`;
  const renamedName = `A Phase Two ${marker}`;
  let categoryId = "";

  afterAll(async () => {
    // DELETE is revoked by design. Leave the test row inactive so it cannot appear in
    // expense selectors if this shared integration database is reused.
    if (!categoryId) return;
    await prisma.expenseCategory.update({ where: { id: categoryId }, data: { isActive: false } });
  });

  it("Finance Manager creates a category at its natural alphabetical rank", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .post("/admin/categories")
      .set("Cookie", cookies)
      .send({ name: `  ${initialName}  ` })
      .expect(201);

    categoryId = res.body.id as string;
    expect(res.body.name).toBe(initialName);
    const ordered = await prisma.expenseCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    const index = ordered.findIndex((category) => category.id === categoryId);
    expect(index).toBeGreaterThan(0);
    expect(ordered[index - 1]!.name.localeCompare(initialName, "en", { sensitivity: "base" })).toBeLessThan(0);

    expect(
      await prisma.auditLog.count({
        where: { entityType: "expense_categories", entityId: categoryId, action: "CATEGORY_CREATE" },
      }),
    ).toBe(1);
  });

  it("case-insensitive duplicate names return 409", async () => {
    const cookies = await loginAs("superadmin@psh.local");
    await request(app.getHttpServer())
      .post("/admin/categories")
      .set("Cookie", cookies)
      .send({ name: initialName.toLocaleLowerCase("en") })
      .expect(409);
  });

  it("Super Admin renames the category and A-Z ordering is recomputed", async () => {
    const cookies = await loginAs("superadmin@psh.local");
    const res = await request(app.getHttpServer())
      .patch(`/admin/categories/${categoryId}`)
      .set("Cookie", cookies)
      .send({ name: renamedName })
      .expect(200);

    expect(res.body).toMatchObject({ id: categoryId, name: renamedName, sortOrder: 1 });
    expect(
      await prisma.auditLog.count({
        where: { entityType: "expense_categories", entityId: categoryId, action: "CATEGORY_UPDATE" },
      }),
    ).toBe(1);
  });

  it("Finance Manager can apply and restore an explicit complete ordering", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const before = await prisma.expenseCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    const reversedIds = before.map((category) => category.id).reverse();

    const reordered = await request(app.getHttpServer())
      .put("/admin/categories/order")
      .set("Cookie", cookies)
      .send({ categoryIds: reversedIds })
      .expect(200);
    expect(reordered.body[0].id).toBe(reversedIds[0]);

    await request(app.getHttpServer())
      .put("/admin/categories/order")
      .set("Cookie", cookies)
      .send({ categoryIds: before.map((category) => category.id) })
      .expect(200);

    expect(
      await prisma.auditLog.count({
        where: { entityType: "expense_categories", action: "CATEGORY_REORDER" },
      }),
    ).toBeGreaterThanOrEqual(2);
  });

  it("deactivation removes the category from normal reads but preserves it for historical reads", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .patch(`/admin/categories/${categoryId}`)
      .set("Cookie", cookies)
      .send({ isActive: false })
      .expect(200);

    const unitCookies = await loginAs("user.sohawa@psh.local");
    const active = await request(app.getHttpServer()).get("/expense-categories").set("Cookie", unitCookies).expect(200);
    expect(active.body.some((category: { id: string }) => category.id === categoryId)).toBe(false);

    const historical = await request(app.getHttpServer())
      .get("/expense-categories?includeInactive=true")
      .set("Cookie", unitCookies)
      .expect(200);
    expect(historical.body.find((category: { id: string }) => category.id === categoryId)).toMatchObject({
      isActive: false,
    });
  });
});
