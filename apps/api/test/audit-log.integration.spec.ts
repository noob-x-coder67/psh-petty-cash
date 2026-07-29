import { randomUUID } from "node:crypto";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed-data";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

// Assumes `pnpm db:migrate` and `pnpm db:seed` have already been run against
// DATABASE_URL. Proves rule 16 / FR-AUD-002: every mutating endpoint retrofitted with
// audit logging actually writes a row, in the same transaction as the change.

let app: INestApplication;
let prisma: PrismaService;

function extractCookies(res: request.Response): string[] {
  const raw = res.headers["set-cookie"] as unknown;
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") return [raw];
  return [];
}

async function loginAs(email: string, password = DEMO_PASSWORD, expectedStatus = 200): Promise<request.Response> {
  return request(app.getHttpServer()).post("/auth/login").send({ email, password }).expect(expectedStatus);
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

describe("login/logout write audit rows", () => {
  it("LOGIN_SUCCESS is recorded for a correct login", async () => {
    const res = await loginAs("financeofficer@psh.local");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "financeofficer@psh.local" } });
    const entries = await prisma.auditLog.findMany({
      where: { entityType: "users", entityId: user.id, action: "LOGIN_SUCCESS" },
      orderBy: { occurredAt: "desc" },
    });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.actorId).toBe(user.id);
    expect(res.body.user.email).toBe("financeofficer@psh.local");
  });

  it("LOGIN_FAILURE is recorded for a wrong password, with a reason", async () => {
    await loginAs("financeofficer@psh.local", "wrong-password", 401);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "financeofficer@psh.local" } });
    const entries = await prisma.auditLog.findMany({
      where: { entityType: "users", entityId: user.id, action: "LOGIN_FAILURE" },
      orderBy: { occurredAt: "desc" },
    });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.reason).toBe("INVALID_CREDENTIALS");
  });

  it("LOGOUT is recorded", async () => {
    const loginRes = await loginAs("auditor@psh.local");
    const cookies = extractCookies(loginRes);
    const csrfToken = cookies
      .map((c) => c.split(";")[0])
      .find((c) => c?.startsWith("psh_csrf_token="))
      ?.split("=")[1];

    await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrfToken ?? "")
      .expect(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "auditor@psh.local" } });
    const entries = await prisma.auditLog.findMany({
      where: { entityType: "sessions", actorId: user.id, action: "LOGOUT" },
    });
    expect(entries.length).toBeGreaterThan(0);
  });
});

describe("account/allocation mutations write audit rows", () => {
  it("ACCOUNT_ENABLE is recorded with the new account in `after`", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const loginRes = await loginAs("financemanager@psh.local");
    const cookies = extractCookies(loginRes);

    const alreadyExists = await prisma.pettyCashAccount.findUnique({ where: { unitId: unit.id } });
    if (!alreadyExists) {
      await request(app.getHttpServer()).post(`/accounts/${unit.id}`).set("Cookie", cookies).expect(201);
    }

    const account = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const entries = await prisma.auditLog.findMany({
      where: { entityType: "petty_cash_accounts", entityId: account.id, action: "ACCOUNT_ENABLE" },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.unitId).toBe(unit.id);
    expect((entries[0]?.after as { unitId?: string } | null)?.unitId).toBe(unit.id);
  });

  it("ALLOCATION_CREATE and ALLOCATION_CONFIRM are both recorded, confirm shows a before/after transition", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const financeOfficerCookies = extractCookies(await loginAs("financeofficer@psh.local"));

    const createRes = await request(app.getHttpServer())
      .post("/allocations")
      .set("Cookie", financeOfficerCookies)
      .send({ unitId: unit.id, amount: "42.00", issueDate: "2026-07-15", idempotencyKey: randomUUID() })
      .expect(201);

    const createEntries = await prisma.auditLog.findMany({
      where: { entityType: "cash_allocations", entityId: createRes.body.id, action: "ALLOCATION_CREATE" },
    });
    expect(createEntries).toHaveLength(1);

    const sukkurCookies = extractCookies(await loginAs("user.sukkur@psh.local"));
    await request(app.getHttpServer())
      .post(`/allocations/${createRes.body.id}/confirm`)
      .set("Cookie", sukkurCookies)
      .send({ confirmedAmount: "42.00", confirmedDate: "2026-07-15" })
      .expect(201);

    const confirmEntries = await prisma.auditLog.findMany({
      where: { entityType: "cash_allocations", entityId: createRes.body.id, action: "ALLOCATION_CONFIRM" },
    });
    expect(confirmEntries).toHaveLength(1);
    const before = confirmEntries[0]?.before as { confirmedAt?: string | null } | null;
    const after = confirmEntries[0]?.after as { confirmedAt?: string | null } | null;
    expect(before?.confirmedAt).toBeNull();
    expect(after?.confirmedAt).not.toBeNull();
  });
});

describe("audit rows roll back with their business mutation", () => {
  // Two real, HTTP-reachable, mid-transaction Postgres failures — chosen because both
  // reach the real database inside the $transaction rather than being rejected by a
  // JS-level guard before the transaction even opens (which would prove nothing about
  // atomicity). Both prove rule 16 / FR-AUD-002's actual claim directly: the audit row
  // is the last statement in the same $transaction as the business write, so a failure
  // anywhere in that transaction must leave neither behind.

  it("REPLENISHMENT_CREATE: a duplicate reference number leaves no orphaned audit row", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-COE" } });
    const cookies = extractCookies(await loginAs("financemanager@psh.local"));
    const reference = `ATOMIC-${randomUUID()}`;
    const year = 2900 + Math.floor(Math.random() * 500); // isolated from other integration files' own random ranges
    const body = (day: string, amount: string) => ({
      unitId: unit.id,
      amount,
      issueDate: `${year}-06-${day}`,
      referenceNo: reference,
      exceptionReason: "audit-atomicity test",
      idempotencyKey: randomUUID(),
    });

    await request(app.getHttpServer())
      .post("/replenishments")
      .set("Cookie", cookies)
      .send(body("01", "111.00"))
      .expect(201);

    const countAfterFirst = await prisma.auditLog.count({
      where: { entityType: "replenishments", action: "REPLENISHMENT_CREATE" },
    });
    const replenishmentCountAfterFirst = await prisma.replenishment.count({
      where: { accountId: (await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } })).id, referenceNo: reference },
    });
    expect(replenishmentCountAfterFirst).toBe(1);

    // Same referenceNo, different idempotencyKey so the idempotent-replay short-circuit
    // doesn't fire — this must reach the real unique index inside the transaction.
    await request(app.getHttpServer())
      .post("/replenishments")
      .set("Cookie", cookies)
      .send(body("02", "222.00"))
      .expect(409);

    const countAfterSecond = await prisma.auditLog.count({
      where: { entityType: "replenishments", action: "REPLENISHMENT_CREATE" },
    });
    const replenishmentCountAfterSecond = await prisma.replenishment.count({
      where: { accountId: (await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } })).id, referenceNo: reference },
    });

    expect(countAfterSecond).toBe(countAfterFirst); // no orphaned audit row for the failed attempt
    expect(replenishmentCountAfterSecond).toBe(1); // the business row wasn't double-written either
  });

  it("EXPENSE_CREATE: a zero-total voucher (real CHECK-constraint failure) leaves no orphaned audit row", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
    const account = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const cookies = extractCookies(await loginAs("user.sohawa@psh.local"));

    const countBefore = await prisma.auditLog.count({ where: { entityType: "expense_vouchers", action: "EXPENSE_CREATE" } });
    const voucherCountBefore = await prisma.expenseVoucher.count({ where: { accountId: account.id } });

    // billTotal/lines-sum both "0.00" passes the service's JS-level total-equality
    // check (BR-005 layer one), so this reaches the transaction and only fails there,
    // on ck_voucher_bill_total_positive — a real, in-transaction Postgres failure, not
    // a JS validation short-circuit.
    const res = await request(app.getHttpServer())
      .post("/expenses")
      .set("Cookie", cookies)
      .send({
        unitId: unit.id,
        expenseDate: "2026-07-20",
        vendorName: "Zero Total Test Vendor",
        justification: "Audit-atomicity test — expected to fail on a DB CHECK constraint",
        billTotal: "0.00",
        hasBill: true,
        lines: [{ description: "Zero-amount line", category: "BUILDING", amount: "0.00" }],
      });

    expect(res.status).not.toBe(201); // must not have succeeded — this is proving a failure path

    const countAfter = await prisma.auditLog.count({ where: { entityType: "expense_vouchers", action: "EXPENSE_CREATE" } });
    const voucherCountAfter = await prisma.expenseVoucher.count({ where: { accountId: account.id } });

    expect(countAfter).toBe(countBefore); // no orphaned audit row for the failed attempt
    expect(voucherCountAfter).toBe(voucherCountBefore); // the voucher wasn't half-written either
  });
});

describe("audit_logs is append-only at the database level (FR-AUD-003)", () => {
  it("UPDATE as psh_app is rejected outright (no RULE here, unlike the ledger)", async () => {
    const entry = await prisma.auditLog.findFirstOrThrow();
    await expect(
      prisma.$executeRaw`UPDATE audit_logs SET action = 'TAMPERED' WHERE id = ${entry.id}::uuid`,
    ).rejects.toThrow(/permission denied/);
  });

  it("DELETE as psh_app is rejected outright", async () => {
    const entry = await prisma.auditLog.findFirstOrThrow();
    await expect(prisma.$executeRaw`DELETE FROM audit_logs WHERE id = ${entry.id}::uuid`).rejects.toThrow(
      /permission denied/,
    );
  });
});
