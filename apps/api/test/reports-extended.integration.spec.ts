import { randomUUID } from "node:crypto";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

// Covers the 10 Phase 6e report datasets (RPT-02/05/07/08/11/12/13/14/15/16) — basic
// shape/permission checks for all of them, plus reconciliation against a direct query
// for the financially meaningful ones, matching reports.integration.spec.ts's own
// standard for RPT-01/03/04/06.

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

const WIDE_RANGE = { dateFrom: "2000-01-01", dateTo: "3000-01-01" };

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.use(cookieParser());
  await app.init();
  prisma = app.get(PrismaService);

  // RPT-09/RPT-10 below used to randomize their base year, which only *probably*
  // avoided colliding with a past run's leftover state in the same bounded range — over
  // enough runs that collision became routine rather than rare. monthly_closings has
  // DELETE revoked from psh_app by design (a genuine financial-record immutability rule,
  // migration 20260727101836), so this can't be fixed by deleting old rows; instead
  // RPT_BASE_YEAR (below) is computed strictly greater than any year FTZ-RAJA/REHAB-CHK's
  // monthly_closings has ever contained — permanent isolation without deleting anything.
  const [ftzRaja, rehabChk] = await Promise.all([
    prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "FTZ-RAJA" } }),
    prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "REHAB-CHK" } }),
  ]);
  const [ftzRajaAccount, rehabChkAccount] = await Promise.all([
    prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: ftzRaja.id } }),
    prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: rehabChk.id } }),
  ]);
  const maxYear = await prisma.monthlyClosing.aggregate({
    where: { accountId: { in: [ftzRajaAccount.id, rehabChkAccount.id] } },
    _max: { periodYear: true },
  });
  // RPT-09 writes to (RPT_BASE_YEAR - 1); +2 keeps that strictly past the historical max.
  RPT_BASE_YEAR = (maxYear._max.periodYear ?? 4998) + 2;
});

afterAll(async () => {
  await app.close();
});

describe("RPT-02 Unit Ledger", () => {
  it("returns ledger rows for a unit-scoped user's own unit only", async () => {
    const cookies = await loginAs("user.sohawa@psh.local");
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-02")
      .query({ filters: filtersQuery(WIDE_RANGE) })
      .set("Cookie", cookies)
      .expect(200);
    expect(res.body.rows.length).toBeGreaterThan(0);
    expect(res.body.rows.every((row: { unitCode: string }) => row.unitCode === "PSH-SOH")).toBe(true);
  });

  it("the sum of signed amounts for one unit's ledger rows matches its cached balance change", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
    const account = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-02")
      .query({ filters: filtersQuery({ ...WIDE_RANGE, unitIds: [unit.id] }) })
      .set("Cookie", cookies)
      .expect(200);

    const signedSum = (res.body.rows as Array<{ amount: string; direction: number }>).reduce(
      (sum: Prisma.Decimal, row) => sum.plus(new Prisma.Decimal(row.amount).times(row.direction)),
      new Prisma.Decimal(0),
    );
    expect(signedSum.toFixed(2)).toBe(account.cachedBalance.toFixed(2));
  });
});

describe("RPT-05 Vendor/Payee Analysis", () => {
  it("grand total matches a direct SUM(bill_total) for active vouchers in range", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const direct = await prisma.expenseVoucher.aggregate({
      where: { state: "ACTIVE" },
      _sum: { billTotal: true },
    });
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-05")
      .query({ filters: filtersQuery(WIDE_RANGE) })
      .set("Cookie", cookies)
      .expect(200);
    expect(res.body.totalAmount).toBe((direct._sum.billTotal ?? new Prisma.Decimal(0)).toFixed(2));
  });
});

describe("RPT-07 Negative Balance", () => {
  it("only reports streaks for accounts whose cached balance is currently negative or that recovered", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-07")
      .query({ filters: filtersQuery(WIDE_RANGE) })
      .set("Cookie", cookies)
      .expect(200);

    const negativeAccounts = await prisma.pettyCashAccount.count({ where: { cachedBalance: { lt: 0 } } });
    // Every currently-negative account must have at least one open (endDate: null) streak.
    const openStreakUnits = new Set(
      (res.body.rows as Array<{ unitCode: string; endDate: string | null }>)
        .filter((row) => row.endDate === null)
        .map((row) => row.unitCode),
    );
    expect(openStreakUnits.size).toBe(negativeAccounts);
  });
});

describe("RPT-08 Allocation and Replenishment", () => {
  it("summary totals reconcile against a direct query over cash_allocations", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const [issuedAgg, confirmedAgg, pendingCount] = await Promise.all([
      prisma.cashAllocation.aggregate({ _sum: { amount: true } }),
      prisma.cashAllocation.aggregate({ where: { confirmedAt: { not: null } }, _sum: { confirmedAmount: true } }),
      prisma.cashAllocation.count({ where: { confirmedAt: null } }),
    ]);
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-08")
      .query({ filters: filtersQuery(WIDE_RANGE) })
      .set("Cookie", cookies)
      .expect(200);

    expect(res.body.summary.totalIssued).toBe((issuedAgg._sum.amount ?? new Prisma.Decimal(0)).toFixed(2));
    expect(res.body.summary.totalConfirmed).toBe(
      (confirmedAgg._sum.confirmedAmount ?? new Prisma.Decimal(0)).toFixed(2),
    );
    expect(res.body.summary.pendingCount).toBe(pendingCount);
  });
});

// RPT-09/10 (Phase 7, deferred from Phase 6 per ADR-0003) — computed in beforeAll, not
// randomized (see that comment for the full reasoning). Units are disjoint from
// month-close's (PSH-BWL/PSH-SOH) and replenishments' (PSH-COE) own fixture units, so no
// cross-file interference regardless of year value.
let RPT_BASE_YEAR: number;

async function recordAndCloseMonth(
  app: INestApplication,
  unitId: string,
  year: number,
  month: number,
  cookies: string[],
): Promise<void> {
  const before = await request(app.getHttpServer())
    .get(`/monthly-close/${unitId}/${year}/${month}`)
    .set("Cookie", cookies)
    .expect(200);
  const recorded = await request(app.getHttpServer())
    .post("/monthly-close")
    .set("Cookie", cookies)
    .send({ unitId, periodYear: year, periodMonth: month, physicalCashCount: before.body.expectedBalance })
    .expect(201);
  await request(app.getHttpServer())
    .post(`/monthly-close/${recorded.body.id}/close`)
    .set("Cookie", cookies)
    .expect(201);
}

describe("RPT-09 Three-Month Compliance", () => {
  it("is eligible once all 3 preceding months are CLOSED, matching a direct monthly_closings query", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "FTZ-RAJA" } });
    const cookies = await loginAs("financemanager@psh.local");
    // precedingThreeMonths(RPT_BASE_YEAR, 1) = Oct/Nov/Dec of RPT_BASE_YEAR - 1.
    const prevYear = RPT_BASE_YEAR - 1;
    for (const month of [10, 11, 12]) {
      await recordAndCloseMonth(app, unit.id, prevYear, month, cookies);
    }

    const res = await request(app.getHttpServer())
      .get("/reports/RPT-09")
      .query({
        filters: JSON.stringify({
          unitIds: [unit.id],
          dateFrom: `${RPT_BASE_YEAR}-01-01`,
          dateTo: `${RPT_BASE_YEAR}-01-28`,
        }),
      })
      .set("Cookie", cookies)
      .expect(200);

    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].isEligibleForReplenishment).toBe(true);
    expect(res.body.rows[0].requiredMonths.every((m: { status: string }) => m.status === "CLOSED")).toBe(true);
    expect(res.body.summary.eligibleCount).toBe(1);
  });

  it("is not eligible (MISSING months) for a target period nothing has ever touched", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "FTZ-RAJA" } });
    const cookies = await loginAs("financemanager@psh.local");
    const freshYear = RPT_BASE_YEAR + 50;

    const res = await request(app.getHttpServer())
      .get("/reports/RPT-09")
      .query({
        filters: JSON.stringify({
          unitIds: [unit.id],
          dateFrom: `${freshYear}-06-01`,
          dateTo: `${freshYear}-06-28`,
        }),
      })
      .set("Cookie", cookies)
      .expect(200);

    expect(res.body.rows[0].isEligibleForReplenishment).toBe(false);
    expect(res.body.rows[0].requiredMonths.every((m: { status: string }) => m.status === "MISSING")).toBe(true);
    expect(res.body.summary.heldCount).toBe(1);
  });
});

describe("RPT-10 Cash Count and Variance", () => {
  it("reflects a closed month's recorded cash count, matching a direct monthly_closings query", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "REHAB-CHK" } });
    const account = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const cookies = await loginAs("financemanager@psh.local");
    const year = RPT_BASE_YEAR;
    const month = 3;
    await recordAndCloseMonth(app, unit.id, year, month, cookies);

    const direct = await prisma.monthlyClosing.findUniqueOrThrow({
      where: { accountId_periodYear_periodMonth: { accountId: account.id, periodYear: year, periodMonth: month } },
    });

    const res = await request(app.getHttpServer())
      .get("/reports/RPT-10")
      .query({ filters: JSON.stringify({ unitIds: [unit.id], dateFrom: `${year}-03-01`, dateTo: `${year}-03-28` }) })
      .set("Cookie", cookies)
      .expect(200);

    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].status).toBe("CLOSED");
    expect(res.body.rows[0].physicalCashCount).toBe(direct.physicalCashCount?.toFixed(2));
    expect(res.body.rows[0].expectedBalance).toBe(direct.expectedBalance?.toFixed(2));
    expect(res.body.rows[0].variance).toBe(direct.variance?.toFixed(2));
    expect(res.body.summary.closedCount).toBe(1);
  });

  it("still returns a row (status OPEN, null fields) for a period with no monthly_closings row at all", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "REHAB-CHK" } });
    const cookies = await loginAs("financemanager@psh.local");
    const freshYear = RPT_BASE_YEAR + 60;

    const res = await request(app.getHttpServer())
      .get("/reports/RPT-10")
      .query({
        filters: JSON.stringify({ unitIds: [unit.id], dateFrom: `${freshYear}-07-01`, dateTo: `${freshYear}-07-28` }),
      })
      .set("Cookie", cookies)
      .expect(200);

    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].status).toBe("OPEN");
    expect(res.body.rows[0].physicalCashCount).toBeNull();
    expect(res.body.rows[0].expectedBalance).toBeNull();
    expect(res.body.summary.openCount).toBe(1);
  });
});

describe("RPT-11 Backdated and Duplicate Warnings", () => {
  it("backdated count matches a direct count of is_backdated vouchers", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const directCount = await prisma.expenseVoucher.count({ where: { state: "ACTIVE", isBackdated: true } });
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-11")
      .query({ filters: filtersQuery(WIDE_RANGE) })
      .set("Cookie", cookies)
      .expect(200);
    expect(res.body.summary.backdatedCount).toBe(directCount);
  });
});

describe("RPT-12 Monthly Attachment Index", () => {
  it("row count matches a direct count of attachments for vouchers in range", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const directCount = await prisma.attachment.count({});
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-12")
      .query({ filters: filtersQuery(WIDE_RANGE) })
      .set("Cookie", cookies)
      .expect(200);
    expect(res.body.rows.length).toBe(directCount);
  });
});

describe("RPT-13 User Activity", () => {
  it("entries count for a known user matches a direct count of their vouchers", async () => {
    // enteredBy is only ever a UNIT_USER/UNIT_INCHARGE — expense.create isn't granted to
    // SUPER_ADMIN (see ROLE_PERMISSIONS in prisma/seed.ts) — so a user who structurally
    // can never own a voucher was never a valid target here, and this only ever passed
    // because the old shared dev database happened to carry incidental superadmin-authored
    // rows from unrelated manual testing. Create a real fixture voucher for a user who can
    // actually enter one, so the assertion no longer depends on that kind of accidental
    // cross-run state.
    const sohawaUser = await prisma.user.findUniqueOrThrow({ where: { email: "user.sohawa@psh.local" } });
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
    const sohawaCookies = await loginAs("user.sohawa@psh.local");
    await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", sohawaCookies)
      .send({
        unitId: unit.id,
        expenseDate: "2026-07-15",
        vendorName: "RPT-13 Fixture Vendor",
        justification: "RPT-13 user-activity fixture voucher",
        billTotal: "100.00",
        hasBill: true,
        lines: [{ description: "Supplies", category: "BUILDING", amount: "100.00" }],
      })
      .expect(201);

    const directCount = await prisma.expenseVoucher.count({
      where: { state: "ACTIVE", enteredBy: sohawaUser.id },
    });
    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-13")
      .query({ filters: filtersQuery(WIDE_RANGE) })
      .set("Cookie", cookies)
      .expect(200);
    const row = (res.body.rows as Array<{ userId: string; entriesCount: number }>).find(
      (r) => r.userId === sohawaUser.id,
    );
    expect(row?.entriesCount).toBe(directCount);
  });
});

describe("RPT-14 Audit Trail", () => {
  // Phase 8 gave RPT-14 keyset pagination (limit 50/page) — a single-page row count can
  // no longer equal the full-range direct count. Walking every page and summing is the
  // equivalent, still-meaningful reconciliation: every row in range is accounted for
  // exactly once, just not all in one response.
  //
  // This must NOT walk the whole WIDE_RANGE history: audit_logs is append-only and this
  // test database accumulates rows across every suite run (4700+ at last count), which
  // would mean ~95 page-fetch requests from this one test alone — comfortably enough to
  // blow through ThrottlerGuard's global 100-req/60s-per-IP ceiling (common.module.ts)
  // by itself, taking the rest of this file down with it. Seeding a known, bounded row
  // count under a unique marker action keeps this test's request volume small and
  // constant regardless of how much unrelated history the shared test DB has piled up.
  it("summed row count across every page matches a direct count of seeded probe rows", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const financeOfficer = await prisma.user.findUniqueOrThrow({ where: { email: "financeofficer@psh.local" } });
    const marker = `RPT14-RECONCILE-PROBE-${randomUUID()}`;
    const seedCount = 120; // 3 pages at the repository's fixed limit of 50 (50 + 50 + 20)
    await prisma.auditLog.createMany({
      data: Array.from({ length: seedCount }, () => ({
        actorId: financeOfficer.id,
        actorRole: "FINANCE_OFFICER",
        action: marker,
        entityType: "users",
        entityId: financeOfficer.id,
      })),
    });

    let total = 0;
    let cursor: { occurredAt: string; id: string } | null = null;
    for (let page = 0; page < 10 && (page === 0 || cursor !== null); page += 1) {
      const query: Record<string, string> = { filters: filtersQuery({ ...WIDE_RANGE, action: marker }) };
      if (cursor) {
        query.cursorOccurredAt = cursor.occurredAt;
        query.cursorId = cursor.id;
      }
      const res: request.Response = await request(app.getHttpServer())
        .get("/reports/RPT-14")
        .query(query)
        .set("Cookie", cookies)
        .expect(200);
      total += res.body.rows.length;
      cursor = res.body.nextCursor;
    }
    expect(total).toBe(seedCount);
  });

  // No seeded demo user is both unit-scoped AND holds audit.view (UNIT_USER, the only
  // unit-scoped seeded role, deliberately does not — see reports.controller.ts's RPT-14
  // gate) — a fixture Unit In-Charge is created directly so the unit-scoping guarantee
  // is still exercised through a real login, not just asserted against seed data.
  it("a Unit In-Charge only sees audit rows tied to their own unit", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
    const financeOfficer = await prisma.user.findUniqueOrThrow({ where: { email: "financeofficer@psh.local" } });
    const inchargeRole = await prisma.role.findUniqueOrThrow({ where: { key: "UNIT_INCHARGE" } });
    const fixtureUser = await prisma.user.upsert({
      where: { email: "rpt14-fixture-incharge@psh.local" },
      update: {},
      create: {
        email: "rpt14-fixture-incharge@psh.local",
        username: "rpt14-fixture-incharge",
        fullName: "RPT-14 Fixture Unit In-Charge",
        passwordHash: financeOfficer.passwordHash, // same DEMO_PASSWORD hash, so loginAs's fixed password works
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: fixtureUser.id, roleId: inchargeRole.id } },
      update: {},
      create: { userId: fixtureUser.id, roleId: inchargeRole.id },
    });
    await prisma.userUnitAccess.upsert({
      where: { userId_unitId: { userId: fixtureUser.id, unitId: unit.id } },
      update: {},
      create: { userId: fixtureUser.id, unitId: unit.id, grantedBy: financeOfficer.id },
    });

    // try/finally, not cleanup-after-assertions: a thrown expectation (or an unrelated
    // 429 from a throttled request) would otherwise skip cleanup entirely, leaking this
    // fixture past this test and breaking organization-schema.integration.spec.ts's exact
    // user-count assertion on every later run until someone deletes it by hand — this is
    // exactly what happened the first time this test existed.
    try {
      const cookies = await loginAs("rpt14-fixture-incharge@psh.local");
      const res = await request(app.getHttpServer())
        .get("/reports/RPT-14")
        .query({ filters: filtersQuery(WIDE_RANGE) })
        .set("Cookie", cookies)
        .expect(200);
      expect(res.body.rows.length).toBeGreaterThan(0);
      expect(
        (res.body.rows as Array<{ unitCode: string | null }>).every((row) => row.unitCode === unit.code),
      ).toBe(true);
    } finally {
      // organization-schema.integration.spec.ts asserts an exact total user count against
      // Appendix E's seeded list — this fixture must not outlive this test. Audit rows
      // referencing this actorId are untouched (audit_logs has no FK to users by design),
      // matching BR-020's "audit rows outlive the actor" guarantee.
      await prisma.session.deleteMany({ where: { userId: fixtureUser.id } });
      await prisma.userUnitAccess.deleteMany({ where: { userId: fixtureUser.id } });
      await prisma.userRole.deleteMany({ where: { userId: fixtureUser.id } });
      await prisma.user.delete({ where: { id: fixtureUser.id } });
    }
  });
});

describe("RPT-15 Cross-Unit Comparison", () => {
  it("ranks units in descending expenditure order with no gaps", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-15")
      .query({ filters: filtersQuery(WIDE_RANGE) })
      .set("Cookie", cookies)
      .expect(200);

    const rows = res.body.rows as Array<{ rank: number; expenditure: string }>;
    expect(rows.map((r) => r.rank)).toEqual(rows.map((_, index) => index + 1));
    for (let i = 1; i < rows.length; i += 1) {
      expect(new Prisma.Decimal(rows[i - 1]?.expenditure ?? 0).greaterThanOrEqualTo(rows[i]?.expenditure ?? 0)).toBe(
        true,
      );
    }
  });
});

describe("RPT-16 Line-Item Analysis", () => {
  it("grand total matches a direct SUM(expense_lines.amount) for active vouchers", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    const direct = await prisma.expenseLine.aggregate({
      where: { voucher: { state: "ACTIVE" } },
      _sum: { amount: true },
    });
    const res = await request(app.getHttpServer())
      .get("/reports/RPT-16")
      .query({ filters: filtersQuery(WIDE_RANGE) })
      .set("Cookie", cookies)
      .expect(200);
    expect(res.body.totalAmount).toBe((direct._sum.amount ?? new Prisma.Decimal(0)).toFixed(2));
  });
});

describe("all 14 implemented reports are also exportable", () => {
  it.each([
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
  ])("%s accepts an export request and reaches READY", async (reportKey) => {
    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .post("/exports")
      .set("Cookie", cookies)
      .send({ reportKey, filters: {}, format: "CSV" })
      .expect(201);
    expect(res.body.status).toBe("PENDING");

    // Waited out to a terminal state rather than left fire-and-forget — otherwise the
    // background generation can still be running when this file's afterAll disconnects
    // Prisma, surfacing as an unrelated "Engine is not yet connected" unhandled rejection.
    const deadline = Date.now() + 15_000;
    let status = res.body.status;
    const exportId = res.body.exportId;
    while (status === "PENDING" && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const poll = await request(app.getHttpServer()).get(`/exports/${exportId}`).set("Cookie", cookies).expect(200);
      status = poll.body.status;
    }
    expect(status).toBe("READY");
  }, 20_000);
});
