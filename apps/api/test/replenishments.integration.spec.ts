import { randomUUID } from "node:crypto";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

// Phase 7's exit gate, verbatim from the Build Plan: "Fourth-month replenishment
// blocked when any of three preceding months is not CLOSED; exception recorded with
// actor/reason/time; timeline renders correctly across a year boundary." The
// year-boundary math itself is exhaustively unit-tested in replenishments.rules.spec.ts
// (every rollover case); this file proves the whole stack wires that logic up correctly
// against a real database, real permissions, and a real ledger post on confirmation.

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

// Randomized per run for the same reason month-close.integration.spec.ts randomizes its
// test year — these tests write real, persistent monthly_closings rows with no teardown.
const BASE_YEAR = 2400 + Math.floor(Math.random() * 500);

function ym(monthOffset: number): { year: number; month: number } {
  // monthOffset 0 => (BASE_YEAR, 1); handles rollover the same way the app does.
  let year = BASE_YEAR;
  let month = 1 + monthOffset;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  return { year, month };
}

async function recordAndClose(unitId: string, year: number, month: number, cookies: string[]): Promise<void> {
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

describe("GET /compliance/:unitId", () => {
  it("returns a 14-month timeline and the next-replenishment evaluation", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-COE" } });
    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .get(`/compliance/${unit.id}`)
      .set("Cookie", cookies)
      .expect(200);

    expect(res.body.timeline).toHaveLength(14);
    expect(res.body.nextReplenishment.requiredMonths).toHaveLength(3);
    expect(typeof res.body.nextReplenishment.isCompliant).toBe("boolean");
  });

  it("requires authentication", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-COE" } });
    await request(app.getHttpServer()).get(`/compliance/${unit.id}`).expect(401);
  });

  it("a unit-scoped user cannot view another unit's compliance", async () => {
    const otherUnit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const cookies = await loginAs("user.sohawa@psh.local");
    await request(app.getHttpServer()).get(`/compliance/${otherUnit.id}`).set("Cookie", cookies).expect(403);
  });
});

describe("POST /replenishments — three-month hold (Phase 7 exit gate)", () => {
  it("is blocked with 409 when a preceding month has never been closed", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-COE" } });
    const financeCookies = await loginAs("financeofficer@psh.local");
    const target = ym(10); // nothing recorded for months 7/8/9 in this fresh BASE_YEAR block

    await request(app.getHttpServer())
      .post("/replenishments")
      .set("Cookie", financeCookies)
      .send({
        unitId: unit.id,
        amount: "1000.00",
        issueDate: `${target.year}-${String(target.month).padStart(2, "0")}-15`,
        idempotencyKey: randomUUID(),
      })
      .expect(409);
  });

  it("succeeds once all 3 preceding months are CLOSED", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-COE" } });
    const financeManagerCookies = await loginAs("financemanager@psh.local");
    const financeOfficerCookies = await loginAs("financeofficer@psh.local");

    const m1 = ym(1);
    const m2 = ym(2);
    const m3 = ym(3);
    const target = ym(4);
    await recordAndClose(unit.id, m1.year, m1.month, financeManagerCookies);
    await recordAndClose(unit.id, m2.year, m2.month, financeManagerCookies);
    await recordAndClose(unit.id, m3.year, m3.month, financeManagerCookies);

    const res = await request(app.getHttpServer())
      .post("/replenishments")
      .set("Cookie", financeOfficerCookies)
      .send({
        unitId: unit.id,
        amount: "5000.00",
        issueDate: `${target.year}-${String(target.month).padStart(2, "0")}-05`,
        referenceNo: `COMPLIANT-${randomUUID()}`,
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    expect(res.body.isCompliant).toBe(true);
    expect(res.body.exceptionReason).toBeNull();
  });

  it("a Finance Officer (no override permission) is blocked even when non-compliant, with or without a reason", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-COE" } });
    const financeOfficerCookies = await loginAs("financeofficer@psh.local");
    const target = ym(20); // block of months with no closings recorded at all

    await request(app.getHttpServer())
      .post("/replenishments")
      .set("Cookie", financeOfficerCookies)
      .send({
        unitId: unit.id,
        amount: "1000.00",
        issueDate: `${target.year}-${String(target.month).padStart(2, "0")}-10`,
        exceptionReason: "I would like to override this please",
        idempotencyKey: randomUUID(),
      })
      .expect(409);
  });

  it("a Finance Manager overriding without a reason gets 400", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-COE" } });
    const financeManagerCookies = await loginAs("financemanager@psh.local");
    const target = ym(24);

    await request(app.getHttpServer())
      .post("/replenishments")
      .set("Cookie", financeManagerCookies)
      .send({
        unitId: unit.id,
        amount: "1000.00",
        issueDate: `${target.year}-${String(target.month).padStart(2, "0")}-10`,
        idempotencyKey: randomUUID(),
      })
      .expect(400);
  });

  it("a Finance Manager overriding with a reason succeeds, recording actor/reason/time (FR-REP-004)", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-COE" } });
    const financeManagerCookies = await loginAs("financemanager@psh.local");
    const target = ym(28);

    const res = await request(app.getHttpServer())
      .post("/replenishments")
      .set("Cookie", financeManagerCookies)
      .send({
        unitId: unit.id,
        amount: "2500.00",
        issueDate: `${target.year}-${String(target.month).padStart(2, "0")}-10`,
        exceptionReason: "Unit relocated mid-quarter; closings will be backfilled",
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    expect(res.body.isCompliant).toBe(false);
    expect(res.body.exceptionReason).toContain("relocated");
    expect(res.body.exceptionByName).toBe("Finance Manager");
    expect(res.body.exceptionAt).not.toBeNull();

    const auditRows = await prisma.auditLog.findMany({
      where: { entityType: "replenishments", action: "REPLENISHMENT_CREATE" },
      orderBy: { occurredAt: "desc" },
      take: 1,
    });
    expect(auditRows[0]?.reason).toContain("relocated");
  });

  it("rejects a duplicate reference number on the same account with 409", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-COE" } });
    const financeManagerCookies = await loginAs("financemanager@psh.local");
    const target = ym(32);
    const reference = `DUP-${randomUUID()}`;

    await request(app.getHttpServer())
      .post("/replenishments")
      .set("Cookie", financeManagerCookies)
      .send({
        unitId: unit.id,
        amount: "500.00",
        issueDate: `${target.year}-${String(target.month).padStart(2, "0")}-01`,
        referenceNo: reference,
        exceptionReason: "test duplicate reference",
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/replenishments")
      .set("Cookie", financeManagerCookies)
      .send({
        unitId: unit.id,
        amount: "600.00",
        issueDate: `${target.year}-${String(target.month).padStart(2, "0")}-02`,
        referenceNo: reference,
        exceptionReason: "test duplicate reference again",
        idempotencyKey: randomUUID(),
      })
      .expect(409);
  });

  it("idempotencyKey replay returns the original replenishment instead of creating a duplicate", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-COE" } });
    const financeManagerCookies = await loginAs("financemanager@psh.local");
    const target = ym(36);
    const key = randomUUID();
    const payload = {
      unitId: unit.id,
      amount: "700.00",
      issueDate: `${target.year}-${String(target.month).padStart(2, "0")}-01`,
      exceptionReason: "idempotency test",
      idempotencyKey: key,
    };

    const first = await request(app.getHttpServer())
      .post("/replenishments")
      .set("Cookie", financeManagerCookies)
      .send(payload)
      .expect(201);
    const second = await request(app.getHttpServer())
      .post("/replenishments")
      .set("Cookie", financeManagerCookies)
      .send(payload)
      .expect(201);
    expect(second.body.id).toBe(first.body.id);
  });
});

describe("POST /replenishments/:id/confirm", () => {
  it("posts a REPLENISHMENT ledger entry and updates the account balance", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-COE" } });
    const account = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const before = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { id: account.id } });

    const financeManagerCookies = await loginAs("financemanager@psh.local");
    const target = ym(40);
    const createRes = await request(app.getHttpServer())
      .post("/replenishments")
      .set("Cookie", financeManagerCookies)
      .send({
        unitId: unit.id,
        amount: "1234.56",
        issueDate: `${target.year}-${String(target.month).padStart(2, "0")}-01`,
        exceptionReason: "confirm-flow test",
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/replenishments/${createRes.body.id}/confirm`)
      .set("Cookie", financeManagerCookies)
      .send({ confirmedAmount: "1234.56", confirmedDate: `${target.year}-${String(target.month).padStart(2, "0")}-02` })
      .expect(201);

    const ledgerEntries = await prisma.cashLedgerEntry.findMany({
      where: { sourceTable: "replenishments", sourceId: createRes.body.id },
    });
    expect(ledgerEntries).toHaveLength(1);
    expect(ledgerEntries[0]?.entryType).toBe("REPLENISHMENT");
    expect(ledgerEntries[0]?.direction).toBe(1);

    const after = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(after.cachedBalance.toFixed(2)).toBe(before.cachedBalance.plus("1234.56").toFixed(2));
  });

  it("rejects confirming the same replenishment twice", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-COE" } });
    const financeManagerCookies = await loginAs("financemanager@psh.local");
    const target = ym(44);
    const createRes = await request(app.getHttpServer())
      .post("/replenishments")
      .set("Cookie", financeManagerCookies)
      .send({
        unitId: unit.id,
        amount: "100.00",
        issueDate: `${target.year}-${String(target.month).padStart(2, "0")}-01`,
        exceptionReason: "double-confirm test",
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/replenishments/${createRes.body.id}/confirm`)
      .set("Cookie", financeManagerCookies)
      .send({ confirmedAmount: "100.00", confirmedDate: `${target.year}-${String(target.month).padStart(2, "0")}-02` })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/replenishments/${createRes.body.id}/confirm`)
      .set("Cookie", financeManagerCookies)
      .send({ confirmedAmount: "100.00", confirmedDate: `${target.year}-${String(target.month).padStart(2, "0")}-02` })
      .expect(409);
  });
});
