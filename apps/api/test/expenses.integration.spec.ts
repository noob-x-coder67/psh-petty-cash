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

// Assumes `pnpm db:migrate` and `pnpm db:seed` have already been run against
// DATABASE_URL. Uses PSH-SOH (already has an account from Phase 2's tests) rather than
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
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
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
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
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
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
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
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
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
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
    const account = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "user.sohawa@psh.local" } });

    await expect(
      prisma.$transaction(async (tx) => {
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
            category: "BUILDING",
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
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
    const account = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const cookies = await loginAs("user.sohawa@psh.local");

    const bigAmount = account.cachedBalance.plus("500.00").toFixed(2);
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
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
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
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
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
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
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
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
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
