import { randomUUID } from "node:crypto";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed-data";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

// Assumes `pnpm db:migrate` and `pnpm db:seed` have already been run against
// DATABASE_URL. Uses PSH-CCS (already has an account from Phase 2's tests) rather than
// a fresh unit — no seeded demo user is scoped to a unit without prior transaction
// history, so every assertion reads the *current* balance/state first and checks
// deltas, same convention as the Phase 2 tests.

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

function baseVoucherBody(unitId: string, overrides: Record<string, unknown> = {}) {
  return {
    unitId,
    expenseDate: "2026-07-15",
    vendorName: "Test Hardware Store",
    justification: "Routine building maintenance supplies",
    billTotal: "100.00",
    hasBill: true,
    lines: [{ description: "Supplies", category: "BUILDING", amount: "100.00" }],
    ...overrides,
  };
}

describe("category and OTHER-explanation validation (AC-004, AC-005, BR-007)", () => {
  it("rejects a category outside BUILDING/VEHICLE/OTHER at the schema layer", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const cookies = await loginAs("user.sohawa@psh.local");
    await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", cookies)
      .send(
        baseVoucherBody(unit.id, {
          lines: [{ description: "Supplies", category: "TRAVEL", amount: "100.00" }],
        }),
      )
      .expect(400);
  });

  it("rejects OTHER category without an explanation", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const cookies = await loginAs("user.sohawa@psh.local");
    await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", cookies)
      .send(
        baseVoucherBody(unit.id, {
          lines: [{ description: "Misc", category: "OTHER", amount: "100.00" }],
        }),
      )
      .expect(400);
  });

  it("accepts OTHER category with a real explanation", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const cookies = await loginAs("user.sohawa@psh.local");
    await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", cookies)
      .send(
        baseVoucherBody(unit.id, {
          lines: [
            { description: "Misc", category: "OTHER", amount: "100.00", otherExplanation: "Kitchen supplies" },
          ],
        }),
      )
      .expect(201);
  });
});

describe("total-equality (BR-005), enforced twice", () => {
  it("rejects a mismatched line/bill total at the service layer", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const cookies = await loginAs("user.sohawa@psh.local");
    await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", cookies)
      .send(
        baseVoucherBody(unit.id, {
          billTotal: "100.00",
          lines: [{ description: "Supplies", category: "BUILDING", amount: "40.00" }],
        }),
      )
      .expect(400);
  });

  it("rejects a mismatched total at the database layer, bypassing the service entirely", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const account = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "user.sohawa@psh.local" } });

    await expect(
      prisma.$transaction(async (tx) => {
        const category = await tx.expenseCategory.findUniqueOrThrow({
          where: { name: "Repair & Maintenance: Building" },
        });
        const voucher = await tx.expenseVoucher.create({
          data: {
            voucherNo: `DIRECT-TEST-${randomUUID()}`,
            accountId: account.id,
            expenseDate: new Date("2026-07-15"),
            vendorName: "Direct SQL Vendor",
            justification: "Bypassing the service layer on purpose",
            billTotal: new Prisma.Decimal("100.00"),
            hasBill: true,
            enteredBy: user.id,
          },
        });
        await tx.expenseLine.create({
          data: {
            voucherId: voucher.id,
            lineNo: 1,
            description: "Mismatched",
            categoryId: category.id,
            amount: new Prisma.Decimal("40.00"),
          },
        });
        await tx.$executeRawUnsafe("SET CONSTRAINTS ck_voucher_totals IMMEDIATE");
      }),
    ).rejects.toThrow(/does not match bill total/);
  });
});

describe("negative balance (BR-011) — allowed, never blocked", () => {
  it("saves a voucher that drives the balance negative and reports balanceWarning", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const account = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const cookies = await loginAs("user.sohawa@psh.local");

    // PSH-CCS is a shared fixture account reused by many tests against one persistent
    // dev DB, and this test itself drives the balance further negative every time it
    // runs. An earlier version of this fixture used cachedBalance.abs() + 500 as the
    // bill amount, which — applied to an already-negative balance, repeatedly, run
    // after run across a whole session — compounds by roughly 2x every run and
    // eventually overflows NUMERIC(14,2) (confirmed: PSH-CCS reached -5.26e11 and the
    // next abs()-derived bill amount exceeded the column's 10^12 limit). The actual
    // intent only needs "a bill large enough that posting it leaves the balance
    // negative" — if the balance is already negative, any small positive amount
    // already satisfies that; only a non-negative starting balance needs a margin
    // added on top of it (never on top of its absolute value).
    const bigAmount = (account.cachedBalance.isNegative() ? new Prisma.Decimal("10.00") : account.cachedBalance.plus("500.00")).toFixed(2);
    const res = await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", cookies)
      .send(
        baseVoucherBody(unit.id, {
          billTotal: bigAmount,
          lines: [{ description: "Large emergency repair", category: "BUILDING", amount: bigAmount }],
        }),
      )
      .expect(201);

    expect(res.body.balanceWarning).toBe(true);
    const after = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    expect(after.cachedBalance.isNegative()).toBe(true);
  });
});

describe("20-way concurrent voucher creation (Phase 3 exit gate)", () => {
  it("produces a correct balance_after chain and no duplicate voucher numbers", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const before = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const cookies = await loginAs("user.sukkur@psh.local");

    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        request(app.getHttpServer())
          .post("/expenses")
          .set("Cookie", cookies)
          .send(baseVoucherBody(unit.id, { billTotal: "1.00", lines: [{ description: "x", category: "BUILDING", amount: "1.00" }] })),
      ),
    );

    for (const res of responses) {
      expect(res.status).toBe(201);
    }
    const voucherNos = responses.map((r) => r.body.voucher.voucherNo as string);
    expect(new Set(voucherNos).size).toBe(20);

    const after = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    expect(after.cachedBalance.toFixed(2)).toBe(before.cachedBalance.minus("20.00").toFixed(2));

    const entries = await prisma.cashLedgerEntry.findMany({
      where: { accountId: before.id, sourceTable: "expense_vouchers", sourceId: { in: responses.map((r) => r.body.voucher.id) } },
      orderBy: { createdAt: "asc" },
    });
    expect(entries).toHaveLength(20);
    let running = before.cachedBalance;
    for (const entry of entries) {
      running = running.plus(entry.amount.times(entry.direction));
      expect(entry.balanceAfter.toFixed(2)).toBe(running.toFixed(2));
    }
  });
});

describe("privileged edit (BR-009, BR-010, FR-EXP-015/016)", () => {
  it("a Centre user gets 403 attempting to edit a saved voucher", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const cookies = await loginAs("user.sohawa@psh.local");
    const createRes = await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", cookies)
      .send(baseVoucherBody(unit.id))
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/expenses/${createRes.body.voucher.id}`)
      .set("Cookie", cookies)
      .send({ reason: "Trying to fix a typo myself", vendorName: "Changed Vendor" })
      .expect(403);
  });

  it("Finance Manager can edit a non-financial field with a mandatory reason, audited", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const sohawaCookies = await loginAs("user.sohawa@psh.local");
    const createRes = await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", sohawaCookies)
      .send(baseVoucherBody(unit.id, { vendorName: "Original Vendor Name" }))
      .expect(201);

    const financeManagerCookies = await loginAs("financemanager@psh.local");
    const editRes = await request(app.getHttpServer())
      .patch(`/expenses/${createRes.body.voucher.id}`)
      .set("Cookie", financeManagerCookies)
      .send({ reason: "Vendor name was misspelled at entry", vendorName: "Corrected Vendor Name" })
      .expect(200);

    expect(editRes.body.vendorName).toBe("Corrected Vendor Name");

    const auditEntries = await prisma.auditLog.findMany({
      where: { entityType: "expense_vouchers", entityId: createRes.body.voucher.id, action: "EXPENSE_EDIT" },
    });
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]?.reason).toBe("Vendor name was misspelled at entry");
    expect((auditEntries[0]?.before as { vendorName?: string } | null)?.vendorName).toBe("Original Vendor Name");
    expect((auditEntries[0]?.after as { vendorName?: string } | null)?.vendorName).toBe("Corrected Vendor Name");
  });

  it("rejects editing an already-reversed voucher", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const sohawaCookies = await loginAs("user.sohawa@psh.local");
    const createRes = await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", sohawaCookies)
      .send(baseVoucherBody(unit.id))
      .expect(201);

    const financeManagerCookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .post(`/expenses/${createRes.body.voucher.id}/reverse`)
      .set("Cookie", financeManagerCookies)
      .send({ reason: "Testing edit-after-reverse rejection" })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/expenses/${createRes.body.voucher.id}`)
      .set("Cookie", financeManagerCookies)
      .send({ reason: "Should not be allowed", vendorName: "Nope" })
      .expect(409);
  });
});

describe("reversal (BR-020, FR-EXP-017) — no hard deletion, auditable compensating entry", () => {
  it("reverses a voucher: original marked REVERSED, balance restored, audited", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const before = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const sohawaCookies = await loginAs("user.sohawa@psh.local");

    const createRes = await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", sohawaCookies)
      .send(baseVoucherBody(unit.id, { billTotal: "75.00", lines: [{ description: "x", category: "VEHICLE", amount: "75.00" }] }))
      .expect(201);

    const afterExpense = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    expect(afterExpense.cachedBalance.toFixed(2)).toBe(before.cachedBalance.minus("75.00").toFixed(2));

    const financeManagerCookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .post(`/expenses/${createRes.body.voucher.id}/reverse`)
      .set("Cookie", financeManagerCookies)
      .send({ reason: "Entered against the wrong vendor by mistake" })
      .expect(201);

    const original = await prisma.expenseVoucher.findUniqueOrThrow({ where: { id: createRes.body.voucher.id } });
    expect(original.state).toBe("REVERSED");
    expect(original.reversedByVoucherId).not.toBeNull();

    // Original voucher row is untouched — retained, not deleted (BR-020).
    expect(original.billTotal.toFixed(2)).toBe("75.00");

    const afterReversal = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    expect(afterReversal.cachedBalance.toFixed(2)).toBe(before.cachedBalance.toFixed(2));

    const reversalEntry = await prisma.cashLedgerEntry.findFirstOrThrow({
      where: { sourceTable: "expense_vouchers", sourceId: original.reversedByVoucherId ?? undefined, entryType: "REVERSAL" },
    });
    expect(reversalEntry.direction).toBe(1);

    const auditEntries = await prisma.auditLog.findMany({
      where: { entityType: "expense_vouchers", entityId: original.id, action: "EXPENSE_REVERSE" },
    });
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]?.reason).toBe("Entered against the wrong vendor by mistake");
  });
});

describe("Expense Register aggregate unit scope", () => {
  it("returns an explicit 403 when a Center User requests unitId=all or omits unitId", async () => {
    const cookies = await loginAs("user.sohawa@psh.local");

    await request(app.getHttpServer())
      .get("/expenses")
      .query({ unitId: "all" })
      .set("Cookie", cookies)
      .expect(403);

    await request(app.getHttpServer()).get("/expenses").set("Cookie", cookies).expect(403);
  });

  it.each(["financeofficer@psh.local", "auditor@psh.local"])(
    "does not extend aggregate Expenses access to %s",
    async (email) => {
      const cookies = await loginAs(email);
      await request(app.getHttpServer())
        .get("/expenses")
        .query({ unitId: "all" })
        .set("Cookie", cookies)
        .expect(403);
    },
  );

  it("returns rows from multiple units, with unit identity, for Finance Manager and Super Admin", async () => {
    const ccs = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const sukkur = await prisma.organizationalUnit.findUniqueOrThrow({
      where: { code: "PSH-SUK" },
    });
    const marker = `AggregateRegister-${Date.now()}`;

    await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", await loginAs("user.sohawa@psh.local"))
      .send(baseVoucherBody(ccs.id, { vendorName: marker }))
      .expect(201);
    await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", await loginAs("user.sukkur@psh.local"))
      .send(baseVoucherBody(sukkur.id, { vendorName: marker }))
      .expect(201);

    for (const email of ["financemanager@psh.local", "superadmin@psh.local"]) {
      const response = await request(app.getHttpServer())
        .get("/expenses")
        .query({ unitId: "all", q: marker })
        .set("Cookie", await loginAs(email))
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(
        new Set(response.body.map((row: { unit: { code: string } }) => row.unit.code)),
      ).toEqual(new Set(["PSH-CCS", "PSH-SUK"]));
    }
  });
});

describe("Expense Register search/filter (SRS §12.6, Phase 5e)", () => {
  it("global search matches vendor name, voucher number, or justification", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const cookies = await loginAs("user.sohawa@psh.local");
    const marker = `Zynthex-${Date.now()}`;

    const created = await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", cookies)
      .send(baseVoucherBody(unit.id, { vendorName: marker }))
      .expect(201);

    const res = await request(app.getHttpServer())
      .get("/expenses")
      .query({ unitId: unit.id, q: marker })
      .set("Cookie", cookies)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((v: { vendorName: string }) => v.vendorName === marker)).toBe(true);
    expect(res.body.some((v: { id: string }) => v.id === created.body.voucher.id)).toBe(true);
  });

  it("checked filter returns only Checked (or only Unchecked) vouchers", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const sohawaCookies = await loginAs("user.sohawa@psh.local");
    const marker = `CheckFilter-${Date.now()}`;

    const created = await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", sohawaCookies)
      .send(baseVoucherBody(unit.id, { vendorName: marker }))
      .expect(201);

    const financeManagerCookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .post(`/expenses/${created.body.voucher.id}/check`)
      .set("Cookie", financeManagerCookies)
      .send({})
      .expect(201);

    const checkedRes = await request(app.getHttpServer())
      .get("/expenses")
      .query({ unitId: unit.id, q: marker, checked: "true" })
      .set("Cookie", sohawaCookies)
      .expect(200);
    expect(checkedRes.body).toHaveLength(1);
    expect(checkedRes.body[0].id).toBe(created.body.voucher.id);

    const uncheckedRes = await request(app.getHttpServer())
      .get("/expenses")
      .query({ unitId: unit.id, q: marker, checked: "false" })
      .set("Cookie", sohawaCookies)
      .expect(200);
    expect(uncheckedRes.body).toHaveLength(0);
  });

  it("category filter returns only vouchers with a matching line category", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const cookies = await loginAs("user.sohawa@psh.local");
    const marker = `CategoryFilter-${Date.now()}`;

    await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", cookies)
      .send(
        baseVoucherBody(unit.id, {
          vendorName: marker,
          lines: [{ description: "Fuel", category: "VEHICLE", amount: "100.00" }],
        }),
      )
      .expect(201);

    const vehicleRes = await request(app.getHttpServer())
      .get("/expenses")
      .query({ unitId: unit.id, q: marker, category: "VEHICLE" })
      .set("Cookie", cookies)
      .expect(200);
    expect(vehicleRes.body).toHaveLength(1);

    const buildingRes = await request(app.getHttpServer())
      .get("/expenses")
      .query({ unitId: unit.id, q: marker, category: "BUILDING" })
      .set("Cookie", cookies)
      .expect(200);
    expect(buildingRes.body).toHaveLength(0);
  });

  it("date range filter excludes vouchers outside the range", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-CCS" } });
    const cookies = await loginAs("user.sohawa@psh.local");
    const marker = `DateFilter-${Date.now()}`;

    await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", cookies)
      .send(baseVoucherBody(unit.id, { vendorName: marker, expenseDate: "2026-06-01" }))
      .expect(201);

    const inRangeRes = await request(app.getHttpServer())
      .get("/expenses")
      .query({ unitId: unit.id, q: marker, dateFrom: "2026-05-01", dateTo: "2026-06-30" })
      .set("Cookie", cookies)
      .expect(200);
    expect(inRangeRes.body).toHaveLength(1);

    const outOfRangeRes = await request(app.getHttpServer())
      .get("/expenses")
      .query({ unitId: unit.id, q: marker, dateFrom: "2026-07-01", dateTo: "2026-07-31" })
      .set("Cookie", cookies)
      .expect(200);
    expect(outOfRangeRes.body).toHaveLength(0);
  });
});

describe("closed-period enforcement (assertPeriodNotClosed, FR-CLS territory)", () => {
  // PSH-SUK, not PSH-CCS/PSH-BHW — those two already carry month-close.integration.spec.ts's
  // own close/reopen lifecycle fixture. A dedicated MAX(periodYear for this account) + 1
  // period is genuine, permanent isolation (same reasoning as month-close.integration.spec.ts's
  // own TEST_YEAR) — never colliding with any period this account's monthly_closings has ever
  // held, without deleting anything (DELETE is revoked on monthly_closings by design).
  let closedYear: number;
  const closedMonth: number = 6;

  beforeAll(async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const account = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const maxYear = await prisma.monthlyClosing.aggregate({
      where: { accountId: account.id },
      _max: { periodYear: true },
    });
    closedYear = (maxYear._max.periodYear ?? 2299) + 1;

    // Recording (Finance Officer) and closing (Finance Manager) are separate roles per
    // ADR-0007 — Finance Manager/Super Admin no longer hold cash_count.enter at all, and
    // closing itself no longer needs a recorded count, but a count is still recorded
    // here anyway just to exercise the normal path this fixture originally modeled.
    const financeOfficerCookies = await loginAs("financeofficer@psh.local");
    // Just needs any valid closed month as a precondition for the tests below — not an
    // exact balance match (PSH-SUK is a heavily shared fixture; see
    // month-close.integration.spec.ts's own note on why an arbitrary count + unconditional
    // remarks is used instead of trying to echo the live expected balance back exactly).
    await request(app.getHttpServer())
      .post("/monthly-close")
      .set("Cookie", financeOfficerCookies)
      .send({
        unitId: unit.id,
        periodYear: closedYear,
        periodMonth: closedMonth,
        denominations: [{ denomination: 5000, count: 1 }, { denomination: 1000, count: 0 }, { denomination: 500, count: 0 }, { denomination: 100, count: 0 }, { denomination: 50, count: 0 }, { denomination: 20, count: 0 }, { denomination: 10, count: 0 }],
        remarks: "closed-period fixture setup — count not expected to match live balance",
      })
      .expect(201);

    const financeManagerCookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .post("/monthly-close/close")
      .set("Cookie", financeManagerCookies)
      .send({ unitId: unit.id, periodYear: closedYear, periodMonth: closedMonth })
      .expect(201);
  });

  it("rejects a new voucher dated into the closed period with 409", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const cookies = await loginAs("user.sukkur@psh.local");
    const dated = `${closedYear}-${String(closedMonth).padStart(2, "0")}-15`;
    await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", cookies)
      .send(baseVoucherBody(unit.id, { expenseDate: dated }))
      .expect(409);
  });

  it("still accepts a voucher dated into a different, still-open period on the same account", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const cookies = await loginAs("user.sukkur@psh.local");
    const openMonth = closedMonth === 12 ? 1 : closedMonth + 1;
    const openYear = closedMonth === 12 ? closedYear + 1 : closedYear;
    const dated = `${openYear}-${String(openMonth).padStart(2, "0")}-15`;
    await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", cookies)
      .send(baseVoucherBody(unit.id, { expenseDate: dated }))
      .expect(201);
  });
});
