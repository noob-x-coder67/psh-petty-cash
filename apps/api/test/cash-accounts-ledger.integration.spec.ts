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
import { LedgerPostingRepository } from "../src/common/ledger/ledger-posting.repository";
import { PrismaService } from "../src/common/prisma/prisma.service";

// Assumes `pnpm db:migrate` and `pnpm db:seed` have already been run against
// DATABASE_URL. Exercises the full HTTP stack for the account/allocation flow, plus
// direct Prisma access (via the app's own PrismaService, which connects as psh_app —
// the same low-privilege role the running application uses) for the DB-level checks
// Phase 2's exit gate calls for.

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

async function ensureAccountForUnit(unitCode: string): Promise<{ id: string; unitId: string }> {
  const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: unitCode } });
  const existing = await prisma.pettyCashAccount.findUnique({ where: { unitId: unit.id } });
  if (existing) return existing;

  const cookies = await loginAs("financemanager@psh.local");
  const res = await request(app.getHttpServer())
    .post(`/accounts/${unit.id}`)
    .set("Cookie", cookies)
    .expect(201);
  return res.body as { id: string; unitId: string };
}

describe("PSH-ISB exclusion completes Phase 1's deferred exit-gate item", () => {
  it("rejects account creation for PSH-ISB via the API", async () => {
    const pshIsb = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-ISB" } });
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer()).post(`/accounts/${pshIsb.id}`).set("Cookie", cookies).expect(400);
  });

  it("rejects account creation for PSH-ISB via direct SQL, bypassing the API entirely", async () => {
    const pshIsb = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-ISB" } });
    await expect(
      prisma.$executeRaw`INSERT INTO petty_cash_accounts (id, unit_id, updated_at) VALUES (${randomUUID()}::uuid, ${pshIsb.id}::uuid, now())`,
    ).rejects.toThrow(/fk_account_requires_enabled_unit/);
  });
});

describe("allocation posts to the ledger only on confirmation (FR-CASH-003)", () => {
  it("creating an allocation posts no ledger entry and does not move the balance", async () => {
    const account = await ensureAccountForUnit("PSH-CCS");
    const before = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { id: account.id } });

    const cookies = await loginAs("financeofficer@psh.local");
    const res = await request(app.getHttpServer())
      .post("/allocations")
      .set("Cookie", cookies)
      .send({
        unitId: account.unitId,
        amount: "5000.00",
        issueDate: "2026-07-01",
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    expect(res.body.confirmedAt).toBeNull();
    const ledgerCount = await prisma.cashLedgerEntry.count({
      where: { accountId: account.id, sourceId: res.body.id },
    });
    expect(ledgerCount).toBe(0);

    const after = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(after.cachedBalance.equals(before.cachedBalance)).toBe(true);
  });

  it("confirming posts exactly one ALLOCATION ledger entry and updates the balance", async () => {
    const account = await ensureAccountForUnit("PSH-CCS");
    const before = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { id: account.id } });

    const financeOfficerCookies = await loginAs("financeofficer@psh.local");
    const createRes = await request(app.getHttpServer())
      .post("/allocations")
      .set("Cookie", financeOfficerCookies)
      .send({
        unitId: account.unitId,
        amount: "1234.56",
        issueDate: "2026-07-02",
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    // Confirmed by the unit's own Center User (Appendix A: allocation.confirm_receipt).
    const sohawaCookies = await loginAs("user.sohawa@psh.local");
    await request(app.getHttpServer())
      .post(`/allocations/${createRes.body.id}/confirm`)
      .set("Cookie", sohawaCookies)
      .send({ confirmedDate: "2026-07-02" })
      .expect(201);

    const ledgerEntries = await prisma.cashLedgerEntry.findMany({
      where: { sourceTable: "cash_allocations", sourceId: createRes.body.id },
    });
    expect(ledgerEntries).toHaveLength(1);
    expect(ledgerEntries[0]?.entryType).toBe("ALLOCATION");
    expect(ledgerEntries[0]?.direction).toBe(1);

    const after = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(after.cachedBalance.toFixed(2)).toBe(before.cachedBalance.plus("1234.56").toFixed(2));
  });

  it("rejects confirming the same allocation twice", async () => {
    const account = await ensureAccountForUnit("PSH-CCS");
    const financeOfficerCookies = await loginAs("financeofficer@psh.local");
    const createRes = await request(app.getHttpServer())
      .post("/allocations")
      .set("Cookie", financeOfficerCookies)
      .send({
        unitId: account.unitId,
        amount: "100.00",
        issueDate: "2026-07-03",
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    const sohawaCookies = await loginAs("user.sohawa@psh.local");
    await request(app.getHttpServer())
      .post(`/allocations/${createRes.body.id}/confirm`)
      .set("Cookie", sohawaCookies)
      .send({ confirmedDate: "2026-07-03" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/allocations/${createRes.body.id}/confirm`)
      .set("Cookie", sohawaCookies)
      .send({ confirmedDate: "2026-07-03" })
      .expect(409);
  });

  it("rejects confirming an allocation outside the caller's unit scope", async () => {
    const sohAccount = await ensureAccountForUnit("PSH-CCS");
    const financeOfficerCookies = await loginAs("financeofficer@psh.local");
    const createRes = await request(app.getHttpServer())
      .post("/allocations")
      .set("Cookie", financeOfficerCookies)
      .send({
        unitId: sohAccount.unitId,
        amount: "50.00",
        issueDate: "2026-07-04",
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    // user.sukkur is scoped to PSH-SUK only, not PSH-CCS.
    const sukkurCookies = await loginAs("user.sukkur@psh.local");
    await request(app.getHttpServer())
      .post(`/allocations/${createRes.body.id}/confirm`)
      .set("Cookie", sukkurCookies)
      .send({ confirmedDate: "2026-07-04" })
      .expect(403);
  });

  it("idempotencyKey replay returns the original allocation instead of creating a duplicate", async () => {
    const account = await ensureAccountForUnit("PSH-CCS");
    const key = randomUUID();
    const financeOfficerCookies = await loginAs("financeofficer@psh.local");
    const first = await request(app.getHttpServer())
      .post("/allocations")
      .set("Cookie", financeOfficerCookies)
      .send({ unitId: account.unitId, amount: "10.00", issueDate: "2026-07-05", idempotencyKey: key })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post("/allocations")
      .set("Cookie", financeOfficerCookies)
      .send({ unitId: account.unitId, amount: "10.00", issueDate: "2026-07-05", idempotencyKey: key })
      .expect(201);
    expect(second.body.id).toBe(first.body.id);
  });
});

describe("the cash ledger is append-only at the database level (BR-020, rule 17)", () => {
  it("UPDATE as the running app's own role (psh_app) is a silent no-op", async () => {
    const account = await ensureAccountForUnit("PSH-CCS");
    const entry = await prisma.cashLedgerEntry.findFirst({ where: { accountId: account.id } });
    expect(entry).not.toBeNull();

    await prisma.$executeRaw`UPDATE cash_ledger_entries SET amount = 999999.99 WHERE id = ${entry?.id}::uuid`;

    const reloaded = await prisma.cashLedgerEntry.findUniqueOrThrow({ where: { id: entry?.id } });
    expect(reloaded.amount.toFixed(2)).not.toBe("999999.99");
  });

  it("DELETE as the running app's own role (psh_app) is rejected outright", async () => {
    const account = await ensureAccountForUnit("PSH-CCS");
    const entry = await prisma.cashLedgerEntry.findFirstOrThrow({ where: { accountId: account.id } });

    await expect(
      prisma.$executeRaw`DELETE FROM cash_ledger_entries WHERE id = ${entry.id}::uuid`,
    ).rejects.toThrow(/permission denied/);
  });
});

describe("concurrent confirmations produce a correct balance_after chain", () => {
  it("two allocations confirmed concurrently on the same account never lose an update", async () => {
    const account = await ensureAccountForUnit("PSH-CCS");
    const before = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { id: account.id } });

    const financeOfficerCookies = await loginAs("financeofficer@psh.local");
    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post("/allocations")
        .set("Cookie", financeOfficerCookies)
        .send({ unitId: account.unitId, amount: "300.00", issueDate: "2026-07-06", idempotencyKey: randomUUID() }),
      request(app.getHttpServer())
        .post("/allocations")
        .set("Cookie", financeOfficerCookies)
        .send({ unitId: account.unitId, amount: "700.00", issueDate: "2026-07-06", idempotencyKey: randomUUID() }),
    ]);

    const sohawaCookies = await loginAs("user.sohawa@psh.local");
    await Promise.all([
      request(app.getHttpServer())
        .post(`/allocations/${a.body.id}/confirm`)
        .set("Cookie", sohawaCookies)
        .send({ confirmedDate: "2026-07-06" }),
      request(app.getHttpServer())
        .post(`/allocations/${b.body.id}/confirm`)
        .set("Cookie", sohawaCookies)
        .send({ confirmedDate: "2026-07-06" }),
    ]);

    const after = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(after.cachedBalance.toFixed(2)).toBe(before.cachedBalance.plus("1000.00").toFixed(2));

    const entries = await prisma.cashLedgerEntry.findMany({
      where: { accountId: account.id, sourceTable: "cash_allocations", sourceId: { in: [a.body.id, b.body.id] } },
      orderBy: { createdAt: "asc" },
    });
    expect(entries).toHaveLength(2);
    // Concurrent requests can be serialized by the row lock in either order — 300-then-
    // 700 and 700-then-300 are both valid outcomes. What must hold regardless of order
    // is the chain property: each entry's balance_after is the previous balance plus
    // its own signed amount, with no lost update.
    const amounts = entries.map((e) => e.amount.toFixed(2)).sort();
    expect(amounts).toEqual(["300.00", "700.00"]);
    let running = before.cachedBalance;
    for (const entry of entries) {
      running = running.plus(entry.amount.times(entry.direction));
      expect(entry.balanceAfter.toFixed(2)).toBe(running.toFixed(2));
    }
    expect(running.toFixed(2)).toBe(before.cachedBalance.plus("1000.00").toFixed(2));
  });
});

describe("rebuild-balances (Phase 2 exit gate: zero drift over a 500-entry fixture)", () => {
  it("reports zero drift after 500 synthetic ledger entries posted through the same posting path", async () => {
    const account = await ensureAccountForUnit("PSH-BHW");
    // Drives LedgerPostingRepository directly rather than through HTTP — this test is
    // about balance-computation correctness at volume, not the API layer (which the
    // smaller, focused tests above already cover), and 500 real HTTP round-trips would
    // also trip the global per-IP rate limiter, itself a legitimate control.
    const ledgerPostingRepository = app.get(LedgerPostingRepository);
    const financeManager = await prisma.user.findUniqueOrThrow({ where: { email: "financemanager@psh.local" } });

    for (let i = 0; i < 500; i += 1) {
      const amount = i % 2 === 0 ? "5.00" : "3.00";
      await ledgerPostingRepository.postEntry({
        accountId: account.id,
        entryType: "ALLOCATION",
        direction: 1,
        amount: new Prisma.Decimal(amount),
        effectiveDate: new Date("2026-07-10"),
        sourceTable: "cash_allocations",
        sourceId: randomUUID(),
        createdBy: financeManager.id,
      });
    }

    const drifts = await rebuildBalances(prisma);
    expect(drifts).toEqual([]);
  }, 60_000);
});
