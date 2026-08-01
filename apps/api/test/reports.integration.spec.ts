import { randomUUID } from "node:crypto";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed-data";
import { rebuildBalances } from "../../../scripts/rebuild-balances";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

// Assumes `pnpm db:migrate` and `pnpm db:seed` (plus, for the reconciliation suite below,
// the Phase 6 volume seed) have already been run against DATABASE_URL. Phase 6's revised
// exit gate (ADR-0003) is "Finance reviews and accepts RPT-01/03/04/06... report totals
// reconcile to the ledger exactly" — the second describe block below is that reconciliation,
// asserted directly rather than only eyeballed.

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
  const res = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email, password: DEMO_PASSWORD })
    .expect(200);
  const cookies = extractCookies(res);
  sessions.set(email, cookies);
  return cookies;
}

function filtersQuery(filter: Record<string, unknown>): string {
  return JSON.stringify(filter);
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

describe("GET /reports/:reportKey — auth, validation and unit scope", () => {
  it("requires authentication", async () => {
    await request(app.getHttpServer()).get("/reports/RPT-01").expect(401);
  });

  it("rejects an unknown report key with 400, not 500", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer()).get("/reports/RPT-99").set("Cookie", cookies).expect(400);
  });

  // The "returns 501 for a report key that's valid but not yet implemented" case this
  // test used to cover (against RPT-09, then RPT-02 before that) no longer has a real
  // target — all 16 ReportKeySchema values now have a dataset behind them as of Phase 7
  // (RPT-09/10 shipped once monthly_closings existed, per ADR-0003). The switch
  // statement's `default: throw new NotImplementedException(...)` in reports.service.ts
  // stays as a defensive guard against a future ReportKeySchema addition landing without
  // a matching case, but there's no way to reach it through the API anymore to test it.

  it("rejects a malformed filters query string with 400", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .get("/reports/RPT-01")
      .query({ filters: "{not json" })
      .set("Cookie", cookies)
      .expect(400);
  });

  it("a unit-scoped user only sees their own unit in RPT-01, even across a wide date range", async () => {
    const cookies = await loginAs("user.sohawa@psh.local");
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-01")
      .query({ filters: filtersQuery({ dateFrom: "2020-01-01", dateTo: "3000-01-01" }) })
      .set("Cookie", cookies)
      .expect(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].unitCode).toBe("PSH-CCS");
  });

  it("a unit-scoped user explicitly requesting a foreign unit gets zero rows, not 403 or expanded access", async () => {
    const sukkur = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const cookies = await loginAs("user.sohawa@psh.local");
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-01")
      .query({ filters: filtersQuery({ unitIds: [sukkur.id] }) })
      .set("Cookie", cookies)
      .expect(200);
    expect(res.body.rows).toEqual([]);
  });

  it("a finance role sees every petty-cash unit, and PSH-ISB never appears (BR-016)", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-01")
      .query({ filters: filtersQuery({ dateFrom: "2020-01-01", dateTo: "3000-01-01" }) })
      .set("Cookie", cookies)
      .expect(200);
    expect(res.body.rows.length).toBeGreaterThanOrEqual(9);
    expect(res.body.rows.some((row: { unitCode: string }) => row.unitCode === "PSH-ISB")).toBe(false);
  });
});

describe("RPT-14 audit trail — audit.view gate and keyset pagination (Phase 8)", () => {
  it("a UNIT_USER (has report.export but not audit.view) gets 403 on RPT-14, but 200 on RPT-01", async () => {
    const cookies = await loginAs("user.sohawa@psh.local");
    await request(app.getHttpServer()).get("/reports/RPT-14").set("Cookie", cookies).expect(403);
    await request(app.getHttpServer()).get("/reports/RPT-01").set("Cookie", cookies).expect(200);
  });

  it("a second cursor-paginated page returns no rows repeated from the first page", async () => {
    // Deterministic volume, isolated from whatever else the shared test database is
    // doing concurrently: 60 audit rows written directly (not through 60 real HTTP
    // logins, which would trip ThrottlerGuard's per-IP rate limit) under one unique
    // marker action, guaranteeing a real page boundary (limit 50) to cross regardless of
    // test execution order or other files' concurrent activity.
    const financeOfficer = await prisma.user.findUniqueOrThrow({ where: { email: "financeofficer@psh.local" } });
    const marker = `RPT14-PAGINATION-PROBE-${randomUUID()}`;
    await prisma.auditLog.createMany({
      data: Array.from({ length: 60 }, () => ({
        actorId: financeOfficer.id,
        actorRole: "FINANCE_OFFICER",
        action: marker,
        entityType: "users",
        entityId: financeOfficer.id,
      })),
    });

    const cookies = await loginAs("financemanager@psh.local");
    const filters = filtersQuery({ dateFrom: "2000-01-01", dateTo: "3000-01-01", action: marker });

    const firstPage = await request(app.getHttpServer())
      .get("/reports/RPT-14")
      .query({ filters })
      .set("Cookie", cookies)
      .expect(200);

    expect(firstPage.body.nextCursor).not.toBeNull();

    const secondPage = await request(app.getHttpServer())
      .get("/reports/RPT-14")
      .query({
        filters,
        cursorOccurredAt: firstPage.body.nextCursor.occurredAt,
        cursorId: firstPage.body.nextCursor.id,
      })
      .set("Cookie", cookies)
      .expect(200);

    expect(secondPage.body.rows.length).toBeGreaterThan(0);
    const firstIds = new Set(firstPage.body.rows.map((row: { id: string }) => row.id));
    const overlap = secondPage.body.rows.filter((row: { id: string }) => firstIds.has(row.id));
    expect(overlap).toEqual([]);
  });
});

describe("RPT-01 reconciles exactly to the ledger (Phase 6 exit gate, ADR-0003)", () => {
  it("expectedBalance for every account matches the drift-checked cached balance, at full seeded volume", async () => {
    const drifts = await rebuildBalances(prisma);
    expect(drifts).toEqual([]);

    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-01")
      .query({ filters: filtersQuery({ dateFrom: "2000-01-01", dateTo: "3000-01-01" }) })
      .set("Cookie", cookies)
      .expect(200);

    const accounts = await prisma.pettyCashAccount.findMany({ include: { unit: true } });
    expect(res.body.rows.length).toBe(accounts.length);
    for (const row of res.body.rows as Array<{ unitCode: string; expectedBalance: string }>) {
      const account = accounts.find((candidate) => candidate.unit.code === row.unitCode);
      expect(account).toBeDefined();
      expect(row.expectedBalance).toBe(account?.cachedBalance.toFixed(2));
    }
  }, 60_000);

  it("openingBalance + allocations + replenishments - expenditure + adjustments equals expectedBalance for every row", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-01")
      .query({ filters: filtersQuery({ dateFrom: "2000-01-01", dateTo: "3000-01-01" }) })
      .set("Cookie", cookies)
      .expect(200);

    type Row = {
      openingBalance: string;
      allocations: string;
      replenishments: string;
      expenditure: string;
      adjustments: string;
      expectedBalance: string;
    };
    for (const row of res.body.rows as Row[]) {
      const reconciled = new Prisma.Decimal(row.openingBalance)
        .plus(row.allocations)
        .plus(row.replenishments)
        .minus(row.expenditure)
        .plus(row.adjustments);
      expect(reconciled.toFixed(2)).toBe(new Prisma.Decimal(row.expectedBalance).toFixed(2));
    }

    const totalsReconciled = new Prisma.Decimal(res.body.totals.openingBalance)
      .plus(res.body.totals.allocations)
      .plus(res.body.totals.replenishments)
      .minus(res.body.totals.expenditure)
      .plus(res.body.totals.adjustments);
    expect(totalsReconciled.toFixed(2)).toBe(new Prisma.Decimal(res.body.totals.expectedBalance).toFixed(2));
  });
});

describe("RPT-03/04/06 reconcile against a direct query for one seeded unit-month", () => {
  async function pickMonthWithData(accountId: string): Promise<{ dateFrom: string; dateTo: string }> {
    const latest = await prisma.expenseVoucher.findFirstOrThrow({
      where: { accountId, state: "ACTIVE" },
      orderBy: { expenseDate: "desc" },
    });
    const year = latest.expenseDate.getUTCFullYear();
    const month = latest.expenseDate.getUTCMonth() + 1;
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(monthEnd.getTime() - 1);
    return { dateFrom: monthStart.toISOString().slice(0, 10), dateTo: lastDay.toISOString().slice(0, 10) };
  }

  it("RPT-03's total line amount matches a direct SUM(expense_lines.amount) for the same unit-month", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const account = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const { dateFrom, dateTo } = await pickMonthWithData(account.id);
    const monthEndExclusive = new Date(new Date(`${dateTo}T00:00:00.000Z`).getTime() + 86_400_000);

    const direct = await prisma.expenseLine.aggregate({
      where: {
        voucher: {
          accountId: account.id,
          state: "ACTIVE",
          expenseDate: { gte: new Date(`${dateFrom}T00:00:00.000Z`), lt: monthEndExclusive },
        },
      },
      _sum: { amount: true },
      _count: true,
    });

    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-03")
      .query({ filters: filtersQuery({ unitIds: [unit.id], dateFrom, dateTo }) })
      .set("Cookie", cookies)
      .expect(200);

    expect(res.body.summary.lineCount).toBe(direct._count);
    expect(res.body.summary.totalAmount).toBe((direct._sum.amount ?? new Prisma.Decimal(0)).toFixed(2));
    expect(
      res.body.rows.every(
        (row: { categoryId: string; category: { id: string; name: string; sortOrder: number } }) =>
          row.categoryId === row.category.id && row.category.name.length > 0 && row.category.sortOrder > 0,
      ),
    ).toBe(true);
  });

  it("RPT-03 filters directly by managed category ID and returns current category metadata", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const account = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const fixtureLine = await prisma.expenseLine.findFirstOrThrow({
      where: { voucher: { accountId: account.id, state: "ACTIVE" } },
      include: { category: true, voucher: true },
      orderBy: { voucher: { expenseDate: "desc" } },
    });
    const expenseDate = fixtureLine.voucher.expenseDate.toISOString().slice(0, 10);
    const direct = await prisma.expenseLine.aggregate({
      where: {
        categoryId: fixtureLine.categoryId,
        voucher: { accountId: account.id, state: "ACTIVE", expenseDate: fixtureLine.voucher.expenseDate },
      },
      _sum: { amount: true },
      _count: true,
    });

    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-03")
      .query({
        filters: filtersQuery({
          unitIds: [unit.id],
          dateFrom: expenseDate,
          dateTo: expenseDate,
          categoryId: fixtureLine.categoryId,
        }),
      })
      .set("Cookie", cookies)
      .expect(200);

    expect(res.body.summary.lineCount).toBe(direct._count);
    expect(res.body.summary.totalAmount).toBe((direct._sum.amount ?? new Prisma.Decimal(0)).toFixed(2));
    expect(
      res.body.rows.every(
        (row: { categoryId: string; category: { id: string; name: string } }) =>
          row.categoryId === fixtureLine.categoryId &&
          row.category.id === fixtureLine.categoryId &&
          row.category.name === fixtureLine.category.name,
      ),
    ).toBe(true);
  });

  it("RPT-04's grand total matches the same direct SUM for the same unit-month", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const account = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const { dateFrom, dateTo } = await pickMonthWithData(account.id);
    const monthEndExclusive = new Date(new Date(`${dateTo}T00:00:00.000Z`).getTime() + 86_400_000);

    const direct = await prisma.expenseLine.aggregate({
      where: {
        voucher: {
          accountId: account.id,
          state: "ACTIVE",
          expenseDate: { gte: new Date(`${dateFrom}T00:00:00.000Z`), lt: monthEndExclusive },
        },
      },
      _sum: { amount: true },
    });

    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-04")
      .query({ filters: filtersQuery({ unitIds: [unit.id], dateFrom, dateTo }) })
      .set("Cookie", cookies)
      .expect(200);

    const categories = await prisma.expenseCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    expect(res.body.totalAmount).toBe((direct._sum.amount ?? new Prisma.Decimal(0)).toFixed(2));
    expect(res.body.rows.map((row: { categoryId: string }) => row.categoryId)).toEqual(
      categories.map((category) => category.id),
    );
    expect(
      res.body.rows.every(
        (row: { categoryId: string; category: { id: string; name: string; isActive: boolean } }) => {
          const directCategory = categories.find((category) => category.id === row.categoryId);
          return (
            row.category.id === row.categoryId &&
            row.category.name === directCategory?.name &&
            row.category.isActive === directCategory?.isActive
          );
        },
      ),
    ).toBe(true);
    const rowSum = (res.body.rows as Array<{ totalAmount: string }>).reduce(
      (sum: Prisma.Decimal, row) => sum.plus(row.totalAmount),
      new Prisma.Decimal(0),
    );
    expect(rowSum.toFixed(2)).toBe(res.body.totalAmount);
  });

  it("RPT-06's voucher counts match a direct count for the same unit-month", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const account = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const { dateFrom, dateTo } = await pickMonthWithData(account.id);
    const monthEndExclusive = new Date(new Date(`${dateTo}T00:00:00.000Z`).getTime() + 86_400_000);

    const [total, checked, missingBill] = await Promise.all([
      prisma.expenseVoucher.count({
        where: {
          accountId: account.id,
          state: "ACTIVE",
          expenseDate: { gte: new Date(`${dateFrom}T00:00:00.000Z`), lt: monthEndExclusive },
        },
      }),
      prisma.expenseVoucher.count({
        where: {
          accountId: account.id,
          state: "ACTIVE",
          expenseDate: { gte: new Date(`${dateFrom}T00:00:00.000Z`), lt: monthEndExclusive },
          checkedAt: { not: null },
        },
      }),
      prisma.expenseVoucher.count({
        where: {
          accountId: account.id,
          state: "ACTIVE",
          expenseDate: { gte: new Date(`${dateFrom}T00:00:00.000Z`), lt: monthEndExclusive },
          hasBill: false,
        },
      }),
    ]);

    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-06")
      .query({ filters: filtersQuery({ unitIds: [unit.id], dateFrom, dateTo }) })
      .set("Cookie", cookies)
      .expect(200);

    expect(res.body.summary.totalVouchers).toBe(total);
    expect(res.body.summary.checkedCount).toBe(checked);
    expect(res.body.summary.uncheckedCount).toBe(total - checked);
    expect(res.body.summary.missingBillCount).toBe(missingBill);
  });
});
