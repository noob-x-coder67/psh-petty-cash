import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../../prisma/seed-data";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

// FR-CLS-001..009. Uses PSH-BWL (not touched by the reports-reconciliation suites'
// wide-date-range read-only queries, and not the same account driven negative by the
// negative-balance-test fixture) so its ledger state stays predictable across runs.

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

// Computed in beforeAll, not randomized and not a fixed literal — see the comment there.
let TEST_YEAR: number;
const TEST_MONTH = 3;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.use(cookieParser());
  await app.init();
  prisma = app.get(PrismaService);

  // monthly_closings is a financial record with DELETE revoked from the app's own DB
  // role (psh_app) by design (migration 20260727101836, mirroring the ledger/audit-log
  // immutability rule) — so resetting this fixture by deleting it is not an option, and
  // picking "a random future year" was never actually safe: reused indefinitely against
  // a database with no teardown, a fixed or randomized year only *probably* avoids
  // colliding with a past run's leftover state, and that probability gets worse every
  // time this suite runs (verified against this exact failure: a past run's "reopen +
  // recount" step left PSH-BWL's row OPEN with a real physicalCashCount set, which a
  // later run's "before any cash count exists" test found instead of a truly untouched
  // period). Computing one past whatever this account has ever used is genuine,
  // permanent isolation instead: every run's fixture year is strictly greater than any
  // year this account's monthly_closings has ever contained, so it can never collide
  // with past state, without deleting anything.
  const [bwl, soh] = await Promise.all([
    prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BWL" } }),
    prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } }),
  ]);
  const [bwlAccount, sohAccount] = await Promise.all([
    prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: bwl.id } }),
    prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: soh.id } }),
  ]);
  const maxYear = await prisma.monthlyClosing.aggregate({
    where: { accountId: { in: [bwlAccount.id, sohAccount.id] } },
    _max: { periodYear: true },
  });
  TEST_YEAR = (maxYear._max.periodYear ?? 2199) + 1;
});

afterAll(async () => {
  await app.close();
});

describe("GET /monthly-close/:unitId/:year/:month — before any cash count exists", () => {
  it("returns a virtual OPEN row with a live expected balance", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BWL" } });
    const cookies = await loginAs("financemanager@psh.local");
    const res = await request(app.getHttpServer())
      .get(`/monthly-close/${unit.id}/${TEST_YEAR}/${TEST_MONTH}`)
      .set("Cookie", cookies)
      .expect(200);

    expect(res.body.status).toBe("OPEN");
    expect(res.body.physicalCashCount).toBeNull();
    expect(typeof res.body.expectedBalance).toBe("string");
    expect(res.body.summary).toBeDefined();
  });

  it("requires authentication", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BWL" } });
    await request(app.getHttpServer()).get(`/monthly-close/${unit.id}/${TEST_YEAR}/${TEST_MONTH}`).expect(401);
  });

  it("a unit-scoped user cannot view a different unit's closing", async () => {
    const otherUnit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SUK" } });
    const cookies = await loginAs("user.sohawa@psh.local");
    await request(app.getHttpServer())
      .get(`/monthly-close/${otherUnit.id}/${TEST_YEAR}/${TEST_MONTH}`)
      .set("Cookie", cookies)
      .expect(403);
  });
});

describe("POST /monthly-close — record cash count (FR-CLS-002/003/004)", () => {
  it("recording a count matching the expected balance needs no remarks", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BWL" } });
    const cookies = await loginAs("financeofficer@psh.local");

    const before = await request(app.getHttpServer())
      .get(`/monthly-close/${unit.id}/${TEST_YEAR}/${TEST_MONTH}`)
      .set("Cookie", cookies)
      .expect(200);

    const res = await request(app.getHttpServer())
      .post("/monthly-close")
      .set("Cookie", cookies)
      .send({
        unitId: unit.id,
        periodYear: TEST_YEAR,
        periodMonth: TEST_MONTH,
        physicalCashCount: before.body.expectedBalance,
      })
      .expect(201);

    expect(res.body.variance).toBe("0.00");
    expect(res.body.status).toBe("OPEN");
    expect(res.body.countedByName).toBe("Finance Officer");
  });

  it("recording a mismatched count without remarks is rejected with 400", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
    const cookies = await loginAs("financeofficer@psh.local");
    await request(app.getHttpServer())
      .post("/monthly-close")
      .set("Cookie", cookies)
      .send({ unitId: unit.id, periodYear: TEST_YEAR, periodMonth: 4, physicalCashCount: "999999.99" })
      .expect(400);
  });

  it("recording the same mismatched count with remarks succeeds and records the variance", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
    const cookies = await loginAs("financeofficer@psh.local");
    const res = await request(app.getHttpServer())
      .post("/monthly-close")
      .set("Cookie", cookies)
      .send({
        unitId: unit.id,
        periodYear: TEST_YEAR,
        periodMonth: 4,
        physicalCashCount: "999999.99",
        remarks: "Physical count higher than expected — investigating",
      })
      .expect(201);
    expect(new Prisma.Decimal(res.body.variance).isZero()).toBe(false);
    expect(res.body.remarks).toContain("investigating");
  });

  it("a Center User (has cash_count.enter) can record a count for their own unit", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-SOH" } });
    const cookies = await loginAs("user.sohawa@psh.local");
    const before = await request(app.getHttpServer())
      .get(`/monthly-close/${unit.id}/${TEST_YEAR}/5`)
      .set("Cookie", cookies)
      .expect(200);
    await request(app.getHttpServer())
      .post("/monthly-close")
      .set("Cookie", cookies)
      .send({ unitId: unit.id, periodYear: TEST_YEAR, periodMonth: 5, physicalCashCount: before.body.expectedBalance })
      .expect(201);
  });
});

describe("close/reopen lifecycle (FR-CLS-006/007)", () => {
  it("a Center User (lacks month.close) gets 403 trying to close", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BWL" } });
    const financeCookies = await loginAs("financeofficer@psh.local");
    const row = await request(app.getHttpServer())
      .get(`/monthly-close/${unit.id}/${TEST_YEAR}/${TEST_MONTH}`)
      .set("Cookie", financeCookies)
      .expect(200);

    const sohawaCookies = await loginAs("user.sohawa@psh.local");
    await request(app.getHttpServer()).post(`/monthly-close/${row.body.id}/close`).set("Cookie", sohawaCookies).expect(403);
  });

  it("Finance Manager closes the month, then it cannot be closed again", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BWL" } });
    const financeCookies = await loginAs("financemanager@psh.local");
    const row = await request(app.getHttpServer())
      .get(`/monthly-close/${unit.id}/${TEST_YEAR}/${TEST_MONTH}`)
      .set("Cookie", financeCookies)
      .expect(200);

    const closeRes = await request(app.getHttpServer())
      .post(`/monthly-close/${row.body.id}/close`)
      .set("Cookie", financeCookies)
      .expect(201);
    expect(closeRes.body.status).toBe("CLOSED");
    expect(closeRes.body.closedByName).toBe("Finance Manager");

    await request(app.getHttpServer())
      .post(`/monthly-close/${row.body.id}/close`)
      .set("Cookie", financeCookies)
      .expect(409);
  });

  it("cannot record a new cash count on a closed month without reopening first", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BWL" } });
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .post("/monthly-close")
      .set("Cookie", cookies)
      .send({ unitId: unit.id, periodYear: TEST_YEAR, periodMonth: TEST_MONTH, physicalCashCount: "0.00", remarks: "test" })
      .expect(409);
  });

  it("reopening without a reason is rejected", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BWL" } });
    const cookies = await loginAs("financemanager@psh.local");
    const row = await request(app.getHttpServer())
      .get(`/monthly-close/${unit.id}/${TEST_YEAR}/${TEST_MONTH}`)
      .set("Cookie", cookies)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/monthly-close/${row.body.id}/reopen`)
      .set("Cookie", cookies)
      .send({ reason: "" })
      .expect(400);
  });

  it("Finance Manager reopens the month with a reason, and it's editable again", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BWL" } });
    const cookies = await loginAs("financemanager@psh.local");
    const row = await request(app.getHttpServer())
      .get(`/monthly-close/${unit.id}/${TEST_YEAR}/${TEST_MONTH}`)
      .set("Cookie", cookies)
      .expect(200);

    const reopenRes = await request(app.getHttpServer())
      .post(`/monthly-close/${row.body.id}/reopen`)
      .set("Cookie", cookies)
      .send({ reason: "Correcting the physical count after a recount" })
      .expect(201);
    expect(reopenRes.body.status).toBe("OPEN");
    expect(reopenRes.body.reopenReason).toContain("recount");

    await request(app.getHttpServer())
      .post("/monthly-close")
      .set("Cookie", cookies)
      .send({ unitId: unit.id, periodYear: TEST_YEAR, periodMonth: TEST_MONTH, physicalCashCount: row.body.expectedBalance })
      .expect(201);
  });

  it("closing a monthly closing id that doesn't exist returns 404", async () => {
    const cookies = await loginAs("financemanager@psh.local");
    await request(app.getHttpServer())
      .post("/monthly-close/00000000-0000-7000-8000-000000000000/close")
      .set("Cookie", cookies)
      .expect(404);
  });

  it("every close/reopen/cash-count action writes an audit_logs row", async () => {
    const unit = await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: "PSH-BWL" } });
    const account = await prisma.pettyCashAccount.findUniqueOrThrow({ where: { unitId: unit.id } });
    const closing = await prisma.monthlyClosing.findUniqueOrThrow({
      where: { accountId_periodYear_periodMonth: { accountId: account.id, periodYear: TEST_YEAR, periodMonth: TEST_MONTH } },
    });
    const auditRows = await prisma.auditLog.findMany({
      where: { entityType: "monthly_closings", entityId: closing.id },
    });
    const actions = auditRows.map((row) => row.action);
    expect(actions).toContain("MONTH_CLOSE_CASH_COUNT");
    expect(actions).toContain("MONTH_CLOSE");
    expect(actions).toContain("MONTH_REOPEN");
  });
});
